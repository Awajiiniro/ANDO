const api = {
  bootstrap: (token) => fetch("/api/bootstrap", {
    headers: { "authorization": `Bearer ${token}` }
  }).then((res) => res.json()),
  register: (payload, token) => postJson("/api/register", payload, token),
  send: (payload, token) => postJson("/api/message", payload, token),
  clear: (token) => postJson("/api/clear", {}, token),
};

const colors = ["#2f8f83", "#7c6fdb", "#d36b58", "#4a90a4", "#b88a2d", "#617c58"];
const state = {
  me: null,
  keyPair: null,
  publicJwk: null,
  users: [],
  messages: [],
  activeUserId: null,
  decrypted: new Map(),
  authToken: null,
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value);
}

const el = {
  displayName: document.querySelector("#display-name"),
  saveIdentity: document.querySelector("#save-identity"),
  fingerprint: document.querySelector("#fingerprint"),
  peopleList: document.querySelector("#people-list"),
  search: document.querySelector("#search"),
  chatTitle: document.querySelector("#chat-title"),
  chatSubtitle: document.querySelector("#chat-subtitle"),
  chatAvatar: document.querySelector("#chat-avatar"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  messageInput: document.querySelector("#message-input"),
  sendButton: document.querySelector("#send-button"),
  toast: document.querySelector("#toast"),
  details: document.querySelector(".details-panel"),
  securityInfo: document.querySelector("#security-info"),
  closeDetails: document.querySelector("#close-details"),
  backendProof: document.querySelector("#backend-proof"),
  privacyShield: document.querySelector("#privacy-shield"),
  clearChat: document.querySelector("#clear-chat"),
  menuToggle: document.querySelector("#menu-toggle"),
  sidebar: document.querySelector(".sidebar"),
  logoutBtn: document.querySelector("#logout-btn"),
};

function postJson(url, payload, token) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const data = await res.json();
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired, please log in again");
    }
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}

function handleUnauthorized() {
  localStorage.removeItem("ando.auth_token");
  localStorage.removeItem("ando.auth_user");
  window.location.href = "/login.html";
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function textToBytes(value) {
  return new TextEncoder().encode(value);
}

function bytesToText(value) {
  return new TextDecoder().decode(value);
}

async function sha256(value) {
  return bytesToBase64(await crypto.subtle.digest("SHA-256", textToBytes(value)));
}

async function loadIdentity() {
  const saved = JSON.parse(localStorage.getItem("ando.identity") || "null");
  if (saved?.privateKey && saved?.publicKey && saved?.user) {
    state.keyPair = {
      privateKey: await crypto.subtle.importKey("jwk", saved.privateKey, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]),
      publicKey: await crypto.subtle.importKey("jwk", saved.publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []),
    };
    state.publicJwk = saved.publicKey;
    state.me = saved.user;
    return;
  }

  state.keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  state.publicJwk = await crypto.subtle.exportKey("jwk", state.keyPair.publicKey);
  state.me = {
    id: crypto.randomUUID(),
    name: `ANDO Tester ${Math.floor(Math.random() * 900 + 100)}`,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
  await persistIdentity();
}

async function persistIdentity() {
  localStorage.setItem("ando.identity", JSON.stringify({
    user: state.me,
    privateKey: await crypto.subtle.exportKey("jwk", state.keyPair.privateKey),
    publicKey: state.publicJwk,
  }));
}

async function registerIdentity() {
  state.me.name = el.displayName.value.trim() || state.me.name;
  const { user, users } = await api.register({
    id: state.me.id,
    name: state.me.name,
    color: state.me.color,
    publicKey: state.publicJwk,
  }, state.authToken);
  state.me = user;
  state.users = users;
  await persistIdentity();
  await renderIdentity();
  renderPeople();
  toast("Identity saved and public key registered.");
}

async function renderIdentity() {
  el.displayName.value = state.me.name;
  const fp = (await sha256(JSON.stringify(state.publicJwk))).slice(0, 22);
  el.fingerprint.textContent = `Key fingerprint: ${fp}`;
}

async function importPeerPublicKey(publicJwk) {
  return crypto.subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

async function deriveAesKey(peerPublicJwk) {
  const peerPublicKey = await importPeerPublicKey(peerPublicJwk);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    state.keyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptFor(peer, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(peer.publicKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textToBytes(plaintext));
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

async function decryptMessage(message) {
  if (state.decrypted.has(message.id)) return state.decrypted.get(message.id);
  if (![message.senderId, message.recipientId].includes(state.me.id)) return null;

  const peerPublicKey = message.senderId === state.me.id
    ? getUser(message.recipientId)?.publicKey
    : message.senderPublicKey;

  if (!peerPublicKey) return null;

  try {
    const key = await deriveAesKey(peerPublicKey);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(message.iv) },
      key,
      base64ToBytes(message.ciphertext),
    );
    const text = bytesToText(plaintext);
    state.decrypted.set(message.id, text);
    return text;
  } catch {
    return null;
  }
}

function getUser(id) {
  return state.users.find((user) => user.id === id);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}

function conversationMessages(userId) {
  return state.messages
    .filter((message) =>
      (message.senderId === state.me.id && message.recipientId === userId) ||
      (message.senderId === userId && message.recipientId === state.me.id)
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

function renderPeople() {
  const query = el.search.value.trim().toLowerCase();
  const people = state.users
    .filter((user) => user.id !== state.me.id)
    .filter((user) => !query || user.name.toLowerCase().includes(query));

  if (!people.length) {
    el.peopleList.innerHTML = `<div class="empty-state">Open ANDO in another browser or profile to register a second tester.</div>`;
    return;
  }

  el.peopleList.innerHTML = people.map((user) => {
    const unread = state.messages.filter((message) => message.senderId === user.id && message.recipientId === state.me.id).length;
    return `
      <button class="person ${state.activeUserId === user.id ? "active" : ""}" data-user-id="${user.id}">
        <span class="avatar" style="background:${user.color}">${initials(user.name)}</span>
        <span>
          <span class="person-name">${escapeHtml(user.name)}</span>
          <span class="person-note">E2EE ready · 24h messages</span>
        </span>
        ${unread ? `<span class="badge">${unread}</span>` : ""}
      </button>
    `;
  }).join("");
}

async function renderMessages() {
  const peer = getUser(state.activeUserId);
  if (!peer) {
    el.messages.innerHTML = `<div class="empty-state">Choose someone from the left to begin an encrypted test conversation.</div>`;
    el.messageInput.disabled = true;
    el.sendButton.disabled = true;
    return;
  }

  el.messageInput.disabled = false;
  el.sendButton.disabled = false;
  const items = await Promise.all(conversationMessages(peer.id).map(async (message) => {
    const mine = message.senderId === state.me.id;
    const text = await decryptMessage(message);
    const expires = formatRemaining(message.expiresAt - Date.now());
    return `
      <div class="message-row ${mine ? "mine" : ""}">
        ${mine ? "" : `<span class="msg-avatar" style="background:${peer.color}">${initials(peer.name)}</span>`}
        <div class="bubble">
          <div>${text ? escapeHtml(text) : `<span class="encrypted-placeholder">Unable to decrypt on this device</span>`}</div>
          <div class="message-meta">Encrypted · disappears in ${expires}</div>
        </div>
        ${mine ? `<span class="msg-avatar" style="background:${state.me.color}">${initials(state.me.name)}</span>` : ""}
      </div>
    `;
  }));

  el.messages.innerHTML = items.join("") || `<div class="empty-state">No messages yet. Send the first encrypted note.</div>`;
  el.messages.scrollTop = el.messages.scrollHeight;
}

function selectUser(userId) {
  const user = getUser(userId);
  if (!user) return;
  state.activeUserId = userId;
  el.chatTitle.textContent = user.name;
  el.chatSubtitle.textContent = "End-to-end encrypted · messages expire after 24 hours";
  el.chatAvatar.classList.remove("app-avatar");
  el.chatAvatar.removeAttribute("aria-label");
  el.chatAvatar.textContent = initials(user.name);
  el.chatAvatar.style.background = user.color;
  el.sidebar.classList.remove("open");
  renderPeople();
  renderMessages();
}

async function sendMessage(event) {
  event.preventDefault();
  const peer = getUser(state.activeUserId);
  const text = el.messageInput.value.trim();
  if (!peer || !text) return;

  const encrypted = await encryptFor(peer, text);
  const { message } = await api.send({
    senderId: state.me.id,
    recipientId: peer.id,
    senderPublicKey: state.publicJwk,
    ...encrypted,
  }, state.authToken);
  state.messages.push(message);
  state.decrypted.set(message.id, text);
  el.messageInput.value = "";
  autosize(el.messageInput);
  renderPeople();
  renderMessages();
}

function formatRemaining(ms) {
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function autosize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function setShield(active) {
  el.privacyShield.classList.toggle("active", active);
}

function installScreenGuard() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("copy", (event) => event.preventDefault());
  document.addEventListener("cut", (event) => event.preventDefault());
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const captureLike = key === "printscreen" || (event.ctrlKey && key === "p") || (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key));
    if (captureLike) {
      event.preventDefault();
      setShield(true);
      toast("Screen guard activated.");
      setTimeout(() => setShield(false), 1600);
    }
  });
  document.addEventListener("visibilitychange", () => setShield(document.hidden));
  window.addEventListener("blur", () => setShield(true));
  window.addEventListener("focus", () => setTimeout(() => setShield(false), 300));
}

function connectEvents() {
  const events = new EventSource("/api/events?token=" + encodeURIComponent(state.authToken));
  let opened = false;
  events.addEventListener("users", (event) => {
    opened = true;
    state.users = JSON.parse(event.data);
    renderPeople();
  });
  events.addEventListener("message", async (event) => {
    opened = true;
    const message = JSON.parse(event.data);
    if (!state.messages.some((item) => item.id === message.id)) {
      state.messages.push(message);
      if (message.recipientId === state.me.id) toast("New encrypted message received.");
      renderPeople();
      await renderMessages();
    }
  });
  events.addEventListener("expired", () => {
    const now = Date.now();
    state.messages = state.messages.filter((message) => message.expiresAt > now);
    renderPeople();
    renderMessages();
  });
  events.addEventListener("cleared", () => {
    opened = true;
    state.messages = [];
    state.decrypted.clear();
    renderPeople();
    renderMessages();
  });
  events.onerror = () => {
    if (!opened) events.close();
  };
  startPolling();
}

function mergeBootSnapshot(boot) {
  state.users = asArray(boot.users);
  boot.messages = asArray(boot.messages);
  updateBackendProof(boot);
  const known = new Set(state.messages.map((message) => message.id));
  for (const message of boot.messages) {
    if (!known.has(message.id)) state.messages.push(message);
  }
  const liveIds = new Set(boot.messages.map((message) => message.id));
  state.messages = state.messages.filter((message) => liveIds.has(message.id));
}

function updateBackendProof(boot = {}) {
  const ttl = boot.ttlMs || 24 * 60 * 60 * 1000;
  const count = asArray(boot.messages ?? state.messages).length;
  el.backendProof.textContent = `Backend audit: plaintext stored = ${boot.serverStoresPlaintext === true}; encrypted envelopes = ${count}; TTL = ${Math.round(ttl / 3_600_000)}h.`;
}

function startPolling() {
  setInterval(async () => {
    try {
      const boot = await api.bootstrap(state.authToken);
      mergeBootSnapshot(boot);
      renderPeople();
      await renderMessages();
    } catch {
      // The next poll will retry quietly.
    }
  }, 2000);
}

async function init() {
  if (!crypto?.subtle) {
    document.body.innerHTML = "<main class='empty-state'>ANDO needs a secure browser context with Web Crypto support.</main>";
    return;
  }

  // Check for auth token
  const token = localStorage.getItem("ando.auth_token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  state.authToken = token;

  installScreenGuard();
  await loadIdentity();
  await renderIdentity();
  const boot = await api.bootstrap(state.authToken);
  state.users = asArray(boot.users);
  state.messages = asArray(boot.messages);
  updateBackendProof(boot);
  await registerIdentity();
  connectEvents();
  renderPeople();
  renderMessages();
}

el.saveIdentity.addEventListener("click", registerIdentity);
el.displayName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") registerIdentity();
});
el.search.addEventListener("input", renderPeople);
el.peopleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-id]");
  if (button) selectUser(button.dataset.userId);
});
el.composer.addEventListener("submit", sendMessage);
el.messageInput.addEventListener("input", () => autosize(el.messageInput));
el.securityInfo.addEventListener("click", () => el.details.classList.add("open"));
el.closeDetails.addEventListener("click", () => el.details.classList.remove("open"));
el.menuToggle.addEventListener("click", () => el.sidebar.classList.toggle("open"));
el.clearChat.addEventListener("click", async () => {
  await api.clear(state.authToken);
  toast("Test message store cleared.");
});
el.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("ando.auth_token");
  localStorage.removeItem("ando.auth_user");
  window.location.href = "/login.html";
});

init().catch((error) => {
  console.error(error);
  toast(error.message || "ANDO failed to start.");
});

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function textToBytes(value) {
  return new TextEncoder().encode(value);
}

function bytesToText(value) {
  return new TextDecoder().decode(value);
}

async function sha256(value) {
  return bytesToBase64(await crypto.subtle.digest("SHA-256", textToBytes(value)));
}

async function loadIdentity() {
  const saved = JSON.parse(localStorage.getItem("ando.identity") || "null");
  if (saved?.privateKey && saved?.publicKey && saved?.user) {
    state.keyPair = {
      privateKey: await crypto.subtle.importKey("jwk", saved.privateKey, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]),
      publicKey: await crypto.subtle.importKey("jwk", saved.publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []),
    };
    state.publicJwk = saved.publicKey;
    state.me = saved.user;
    return;
  }

  state.keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  state.publicJwk = await crypto.subtle.exportKey("jwk", state.keyPair.publicKey);
  state.me = {
    id: crypto.randomUUID(),
    name: `ANDO Tester ${Math.floor(Math.random() * 900 + 100)}`,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
  await persistIdentity();
}

async function persistIdentity() {
  localStorage.setItem("ando.identity", JSON.stringify({
    user: state.me,
    privateKey: await crypto.subtle.exportKey("jwk", state.keyPair.privateKey),
    publicKey: state.publicJwk,
  }));
}

async function registerIdentity() {
  state.me.name = el.displayName.value.trim() || state.me.name;
  const { user, users } = await api.register({
    id: state.me.id,
    name: state.me.name,
    color: state.me.color,
    publicKey: state.publicJwk,
  });
  state.me = user;
  state.users = users;
  await persistIdentity();
  await renderIdentity();
  renderPeople();
  toast("Identity saved and public key registered.");
}

async function renderIdentity() {
  el.displayName.value = state.me.name;
  const fp = (await sha256(JSON.stringify(state.publicJwk))).slice(0, 22);
  el.fingerprint.textContent = `Key fingerprint: ${fp}`;
}

async function importPeerPublicKey(publicJwk) {
  return crypto.subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

async function deriveAesKey(peerPublicJwk) {
  const peerPublicKey = await importPeerPublicKey(peerPublicJwk);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    state.keyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptFor(peer, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(peer.publicKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textToBytes(plaintext));
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

async function decryptMessage(message) {
  if (state.decrypted.has(message.id)) return state.decrypted.get(message.id);
  if (![message.senderId, message.recipientId].includes(state.me.id)) return null;

  const peerPublicKey = message.senderId === state.me.id
    ? getUser(message.recipientId)?.publicKey
    : message.senderPublicKey;

  if (!peerPublicKey) return null;

  try {
    const key = await deriveAesKey(peerPublicKey);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(message.iv) },
      key,
      base64ToBytes(message.ciphertext),
    );
    const text = bytesToText(plaintext);
    state.decrypted.set(message.id, text);
    return text;
  } catch {
    return null;
  }
}

function getUser(id) {
  return state.users.find((user) => user.id === id);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}

function conversationMessages(userId) {
  return state.messages
    .filter((message) =>
      (message.senderId === state.me.id && message.recipientId === userId) ||
      (message.senderId === userId && message.recipientId === state.me.id)
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

function renderPeople() {
  const query = el.search.value.trim().toLowerCase();
  const people = state.users
    .filter((user) => user.id !== state.me.id)
    .filter((user) => !query || user.name.toLowerCase().includes(query));

  if (!people.length) {
    el.peopleList.innerHTML = `<div class="empty-state">Open ANDO in another browser or profile to register a second tester.</div>`;
    return;
  }

  el.peopleList.innerHTML = people.map((user) => {
    const unread = state.messages.filter((message) => message.senderId === user.id && message.recipientId === state.me.id).length;
    return `
      <button class="person ${state.activeUserId === user.id ? "active" : ""}" data-user-id="${user.id}">
        <span class="avatar" style="background:${user.color}">${initials(user.name)}</span>
        <span>
          <span class="person-name">${escapeHtml(user.name)}</span>
          <span class="person-note">E2EE ready · 24h messages</span>
        </span>
        ${unread ? `<span class="badge">${unread}</span>` : ""}
      </button>
    `;
  }).join("");
}

async function renderMessages() {
  const peer = getUser(state.activeUserId);
  if (!peer) {
    el.messages.innerHTML = `<div class="empty-state">Choose someone from the left to begin an encrypted test conversation.</div>`;
    el.messageInput.disabled = true;
    el.sendButton.disabled = true;
    return;
  }

  el.messageInput.disabled = false;
  el.sendButton.disabled = false;
  const items = await Promise.all(conversationMessages(peer.id).map(async (message) => {
    const mine = message.senderId === state.me.id;
    const text = await decryptMessage(message);
    const expires = formatRemaining(message.expiresAt - Date.now());
    return `
      <div class="message-row ${mine ? "mine" : ""}">
        ${mine ? "" : `<span class="msg-avatar" style="background:${peer.color}">${initials(peer.name)}</span>`}
        <div class="bubble">
          <div>${text ? escapeHtml(text) : `<span class="encrypted-placeholder">Unable to decrypt on this device</span>`}</div>
          <div class="message-meta">Encrypted · disappears in ${expires}</div>
        </div>
        ${mine ? `<span class="msg-avatar" style="background:${state.me.color}">${initials(state.me.name)}</span>` : ""}
      </div>
    `;
  }));

  el.messages.innerHTML = items.join("") || `<div class="empty-state">No messages yet. Send the first encrypted note.</div>`;
  el.messages.scrollTop = el.messages.scrollHeight;
}

function selectUser(userId) {
  const user = getUser(userId);
  if (!user) return;
  state.activeUserId = userId;
  el.chatTitle.textContent = user.name;
  el.chatSubtitle.textContent = "End-to-end encrypted · messages expire after 24 hours";
  el.chatAvatar.classList.remove("app-avatar");
  el.chatAvatar.removeAttribute("aria-label");
  el.chatAvatar.textContent = initials(user.name);
  el.chatAvatar.style.background = user.color;
  el.sidebar.classList.remove("open");
  renderPeople();
  renderMessages();
}

async function sendMessage(event) {
  event.preventDefault();
  const peer = getUser(state.activeUserId);
  const text = el.messageInput.value.trim();
  if (!peer || !text) return;

  const encrypted = await encryptFor(peer, text);
  const { message } = await api.send({
    senderId: state.me.id,
    recipientId: peer.id,
    senderPublicKey: state.publicJwk,
    ...encrypted,
  });
  state.messages.push(message);
  state.decrypted.set(message.id, text);
  el.messageInput.value = "";
  autosize(el.messageInput);
  renderPeople();
  renderMessages();
}

function formatRemaining(ms) {
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function autosize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function setShield(active) {
  el.privacyShield.classList.toggle("active", active);
}

function installScreenGuard() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("copy", (event) => event.preventDefault());
  document.addEventListener("cut", (event) => event.preventDefault());
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const captureLike = key === "printscreen" || (event.ctrlKey && key === "p") || (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key));
    if (captureLike) {
      event.preventDefault();
      setShield(true);
      toast("Screen guard activated.");
      setTimeout(() => setShield(false), 1600);
    }
  });
  document.addEventListener("visibilitychange", () => setShield(document.hidden));
  window.addEventListener("blur", () => setShield(true));
  window.addEventListener("focus", () => setTimeout(() => setShield(false), 300));
}

function connectEvents() {
  const events = new EventSource("/api/events");
  let opened = false;
  events.addEventListener("users", (event) => {
    opened = true;
    state.users = JSON.parse(event.data);
    renderPeople();
  });
  events.addEventListener("message", async (event) => {
    opened = true;
    const message = JSON.parse(event.data);
    if (!state.messages.some((item) => item.id === message.id)) {
      state.messages.push(message);
      if (message.recipientId === state.me.id) toast("New encrypted message received.");
      renderPeople();
      await renderMessages();
    }
  });
  events.addEventListener("expired", () => {
    const now = Date.now();
    state.messages = state.messages.filter((message) => message.expiresAt > now);
    renderPeople();
    renderMessages();
  });
  events.addEventListener("cleared", () => {
    opened = true;
    state.messages = [];
    state.decrypted.clear();
    renderPeople();
    renderMessages();
  });
  events.onerror = () => {
    if (!opened) events.close();
  };
  startPolling();
}

function mergeBootSnapshot(boot) {
  state.users = asArray(boot.users);
  boot.messages = asArray(boot.messages);
  updateBackendProof(boot);
  const known = new Set(state.messages.map((message) => message.id));
  for (const message of boot.messages) {
    if (!known.has(message.id)) state.messages.push(message);
  }
  const liveIds = new Set(boot.messages.map((message) => message.id));
  state.messages = state.messages.filter((message) => liveIds.has(message.id));
}

function updateBackendProof(boot = {}) {
  const ttl = boot.ttlMs || 24 * 60 * 60 * 1000;
  const count = asArray(boot.messages ?? state.messages).length;
  el.backendProof.textContent = `Backend audit: plaintext stored = ${boot.serverStoresPlaintext === true}; encrypted envelopes = ${count}; TTL = ${Math.round(ttl / 3_600_000)}h.`;
}

function startPolling() {
  setInterval(async () => {
    try {
      const boot = await api.bootstrap();
      mergeBootSnapshot(boot);
      renderPeople();
      await renderMessages();
    } catch {
      // The next poll will retry quietly.
    }
  }, 2000);
}

async function init() {
  if (!crypto?.subtle) {
    document.body.innerHTML = "<main class='empty-state'>ANDO needs a secure browser context with Web Crypto support.</main>";
    return;
  }

  installScreenGuard();
  await loadIdentity();
  await renderIdentity();
  const boot = await api.bootstrap();
  state.users = asArray(boot.users);
  state.messages = asArray(boot.messages);
  updateBackendProof(boot);
  await registerIdentity();
  connectEvents();
  renderPeople();
  renderMessages();
}

el.saveIdentity.addEventListener("click", registerIdentity);
el.displayName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") registerIdentity();
});
el.search.addEventListener("input", renderPeople);
el.peopleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-id]");
  if (button) selectUser(button.dataset.userId);
});
el.composer.addEventListener("submit", sendMessage);
el.messageInput.addEventListener("input", () => autosize(el.messageInput));
el.securityInfo.addEventListener("click", () => el.details.classList.add("open"));
el.closeDetails.addEventListener("click", () => el.details.classList.remove("open"));
el.menuToggle.addEventListener("click", () => el.sidebar.classList.toggle("open"));
el.clearChat.addEventListener("click", async () => {
  await api.clear();
  toast("Test message store cleared.");
});

init().catch((error) => {
  console.error(error);
  toast(error.message || "ANDO failed to start.");
});
