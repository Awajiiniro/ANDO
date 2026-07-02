import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { initializeDatabase } from "./db/init.js";
import { createAuthQueries } from "./db/auth.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createAuthRoutes } from "./routes/auth.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const distDir = join(publicDir, "dist");
const PORT = Number(process.env.PORT || 3000);
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

// Initialize database and auth
const db = initializeDatabase();
const authQueries = createAuthQueries(db);
const auth = createAuthMiddleware();
const authRoutes = createAuthRoutes(db, auth, authQueries);

const users = new Map();
let messages = [];
const clients = new Set();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function pruneExpired() {
  const now = Date.now();
  const before = messages.length;
  messages = messages.filter((message) => message.expiresAt > now);
  if (before !== messages.length) broadcast("expired", { removed: before - messages.length });
}

function publicUsers() {
  return [...users.values()].map(({ privateNote, ...user }) => user);
}

function broadcast(type, payload) {
  const packet = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(packet);
}

async function serveStatic(req, res) {
  const rawPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const requested = rawPath === "/" ? "/index.html" : decodeURIComponent(rawPath);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const relativePath = safePath.replace(/^\/+/, "") || "index.html";
  const candidateRoots = [distDir, publicDir];

  for (const root of candidateRoots) {
    const filePath = join(root, relativePath);

    if (!filePath.startsWith(root)) {
      continue;
    }

    try {
      const data = await readFile(filePath);
      res.writeHead(200, {
        "content-type": mime[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(data);
      return;
    } catch {
      continue;
    }
  }

  res.writeHead(404);
  res.end("Not found");
}

const server = createServer(async (req, res) => {
  pruneExpired();
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // Auth routes (no authentication required)
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      await authRoutes.register(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      await authRoutes.login(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register-phone") {
      await authRoutes.registerPhone(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login-phone") {
      await authRoutes.loginPhone(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/google") {
      await authRoutes.googleCallback(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/verify") {
      await authRoutes.verify(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      await authRoutes.logout(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users/search") {
      await authRoutes.searchUsers(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users/contacts") {
      await authRoutes.searchContacts(req, res);
      return;
    }

    // Protected routes - require authentication
    const token = auth.extractToken(req);
    if (!token) {
      // For SSE and bootstrap, we need token
      if (req.method === "GET" && (url.pathname === "/api/events" || url.pathname === "/api/bootstrap")) {
        sendJson(res, 401, { error: "Missing authorization token" });
        return;
      }
      // For POST message/register, also require token
      if (req.method === "POST" && (url.pathname === "/api/message" || url.pathname === "/api/register")) {
        sendJson(res, 401, { error: "Missing authorization token" });
        return;
      }
    }

    const payload = token ? auth.verifyToken(token) : null;
    if (token && !payload) {
      sendJson(res, 401, { error: "Invalid or expired token" });
      return;
    }

    const userId = payload?.userId;

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      });
      clients.add(res);
      res.write(`event: ready\ndata: ${JSON.stringify({ users: publicUsers(), now: Date.now() })}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(res, 200, {
        users: publicUsers(),
        messages,
        ttlMs: MESSAGE_TTL_MS,
        serverStoresPlaintext: false,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await parseBody(req);
      if (!body.name || !body.publicKey) {
        sendJson(res, 400, { error: "name and publicKey are required" });
        return;
      }
      const id = body.id || randomUUID();
      const user = {
        id,
        authUserId: userId,
        name: String(body.name).slice(0, 60),
        publicKey: body.publicKey,
        color: body.color || "#2f8f83",
        registeredAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      users.set(id, user);
      broadcast("users", publicUsers());
      sendJson(res, 200, { user, users: publicUsers() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/message") {
      const body = await parseBody(req);
      const required = ["senderId", "recipientId", "ciphertext", "iv", "senderPublicKey"];
      if (!required.every((key) => body[key])) {
        sendJson(res, 400, { error: "encrypted message envelope is incomplete" });
        return;
      }
      if (!users.has(body.senderId) || !users.has(body.recipientId)) {
        sendJson(res, 404, { error: "sender or recipient is not registered" });
        return;
      }
      const now = Date.now();
      const message = {
        id: randomUUID(),
        senderId: body.senderId,
        recipientId: body.recipientId,
        senderPublicKey: body.senderPublicKey,
        ciphertext: body.ciphertext,
        iv: body.iv,
        createdAt: now,
        expiresAt: now + MESSAGE_TTL_MS,
      };
      messages.push(message);
      broadcast("message", message);
      sendJson(res, 201, { message });
      return;
    }

    if (req.method === "DELETE" && url.pathname === "/api/messages/expired") {
      const before = messages.length;
      pruneExpired();
      sendJson(res, 200, { removed: before - messages.length, remaining: messages.length });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/clear") {
      messages = [];
      broadcast("cleared", { at: Date.now() });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "server error" });
  }
});

setInterval(pruneExpired, 60_000).unref();

server.listen(PORT, () => {
  console.log(`ANDO is running at http://localhost:${PORT}`);
});
