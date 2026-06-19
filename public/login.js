const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

const state = {
  emailMode: "signin", // signin or signup
  phoneMode: "signin", // signin or signup
};

const el = {
  tabs: document.querySelectorAll(".tab-btn"),
  emailTab: document.querySelector("#email-tab"),
  phoneTab: document.querySelector("#phone-tab"),
  googleTab: document.querySelector("#google-tab"),
  emailForm: document.querySelector("#email-form"),
  phoneForm: document.querySelector("#phone-form"),
  emailInput: document.querySelector("#email-input"),
  emailPassword: document.querySelector("#email-password"),
  emailName: document.querySelector("#email-name"),
  emailNameLabel: document.querySelector("#email-name-label"),
  emailToggle: document.querySelector("#email-toggle"),
  emailSubmit: document.querySelector("#email-submit"),
  emailError: document.querySelector("#email-error"),
  phoneInput: document.querySelector("#phone-input"),
  phonePassword: document.querySelector("#phone-password"),
  phoneName: document.querySelector("#phone-name"),
  phoneNameLabel: document.querySelector("#phone-name-label"),
  phoneToggle: document.querySelector("#phone-toggle"),
  phoneSubmit: document.querySelector("#phone-submit"),
  phoneError: document.querySelector("#phone-error"),
  googleBtn: document.querySelector("#google-btn"),
  googleError: document.querySelector("#google-error"),
  toast: document.querySelector("#toast"),
};

function showError(element, message) {
  element.textContent = message;
  element.classList.add("show");
}

function hideError(element) {
  element.classList.remove("show");
  element.textContent = "";
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 3000);
}

function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.classList.add("loading");
    button.innerHTML = `<span class="spinner"></span> ${button.textContent.split(' ')[0]}...`;
  } else {
    button.disabled = false;
    button.classList.remove("loading");
    button.innerHTML = button.dataset.originalText || "Sign In";
  }
}

function storeToken(token, user) {
  localStorage.setItem("ando.auth_token", token);
  localStorage.setItem("ando.auth_user", JSON.stringify(user));
  window.location.href = "/";
}

// Tab switching
el.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    el.tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    el.emailTab.classList.remove("active");
    el.phoneTab.classList.remove("active");
    el.googleTab.classList.remove("active");

    if (tabName === "email") {
      el.emailTab.classList.add("active");
    } else if (tabName === "phone") {
      el.phoneTab.classList.add("active");
    } else if (tabName === "google") {
      el.googleTab.classList.add("active");
    }
  });
});

// Email tab
el.emailToggle.addEventListener("click", (e) => {
  e.preventDefault();
  state.emailMode = state.emailMode === "signin" ? "signup" : "signin";

  if (state.emailMode === "signup") {
    el.emailName.style.display = "block";
    el.emailNameLabel.style.display = "block";
    el.emailToggle.textContent = "Already have an account? Sign in";
    el.emailSubmit.textContent = "Create Account";
  } else {
    el.emailName.style.display = "none";
    el.emailNameLabel.style.display = "none";
    el.emailToggle.textContent = "Don't have an account? Sign up";
    el.emailSubmit.textContent = "Sign In";
  }
  hideError(el.emailError);
});

el.emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(el.emailError);

  const email = el.emailInput.value.trim();
  const password = el.emailPassword.value;

  if (!email || !password) {
    showError(el.emailError, "Email and password are required");
    return;
  }

  if (state.emailMode === "signup") {
    const fullName = el.emailName.value.trim();
    if (!fullName) {
      showError(el.emailError, "Full name is required");
      return;
    }

    try {
      setLoading(el.emailSubmit, true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(el.emailError, data.error || "Registration failed");
        return;
      }

      storeToken(data.token, data.user);
    } catch (error) {
      showError(el.emailError, error.message || "Registration failed");
    } finally {
      setLoading(el.emailSubmit, false);
    }
  } else {
    try {
      setLoading(el.emailSubmit, true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(el.emailError, data.error || "Login failed");
        return;
      }

      storeToken(data.token, data.user);
    } catch (error) {
      showError(el.emailError, error.message || "Login failed");
    } finally {
      setLoading(el.emailSubmit, false);
    }
  }
});

// Phone tab
el.phoneToggle.addEventListener("click", (e) => {
  e.preventDefault();
  state.phoneMode = state.phoneMode === "signin" ? "signup" : "signin";

  if (state.phoneMode === "signup") {
    el.phoneName.style.display = "block";
    el.phoneNameLabel.style.display = "block";
    el.phoneToggle.textContent = "Already have an account? Sign in";
    el.phoneSubmit.textContent = "Create Account";
  } else {
    el.phoneName.style.display = "none";
    el.phoneNameLabel.style.display = "none";
    el.phoneToggle.textContent = "Don't have an account? Sign up";
    el.phoneSubmit.textContent = "Sign In";
  }
  hideError(el.phoneError);
});

el.phoneForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(el.phoneError);

  const phone = el.phoneInput.value.trim();
  const password = el.phonePassword.value;

  if (!phone || !password) {
    showError(el.phoneError, "Phone and password are required");
    return;
  }

  if (state.phoneMode === "signup") {
    const fullName = el.phoneName.value.trim();
    if (!fullName) {
      showError(el.phoneError, "Full name is required");
      return;
    }

    try {
      setLoading(el.phoneSubmit, true);
      const res = await fetch("/api/auth/register-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password, fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(el.phoneError, data.error || "Registration failed");
        return;
      }

      storeToken(data.token, data.user);
    } catch (error) {
      showError(el.phoneError, error.message || "Registration failed");
    } finally {
      setLoading(el.phoneSubmit, false);
    }
  } else {
    try {
      setLoading(el.phoneSubmit, true);
      const res = await fetch("/api/auth/login-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(el.phoneError, data.error || "Login failed");
        return;
      }

      storeToken(data.token, data.user);
    } catch (error) {
      showError(el.phoneError, error.message || "Login failed");
    } finally {
      setLoading(el.phoneSubmit, false);
    }
  }
});

// Google sign-in
el.googleBtn.addEventListener("click", async () => {
  hideError(el.googleError);

  try {
    setLoading(el.googleBtn, true);

    // Load Google's gapi library
    return new Promise((resolve) => {
      window.onload = () => {
        if (!window.google) {
          showError(el.googleError, "Google Sign-In library failed to load");
          setLoading(el.googleBtn, false);
          resolve();
          return;
        }

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });

        google.accounts.id.renderButton(el.googleBtn, {
          type: "standard",
          size: "large",
          text: "signin_with",
        });

        resolve();
      };

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    });
  } catch (error) {
    showError(el.googleError, error.message || "Google Sign-In failed");
  } finally {
    setLoading(el.googleBtn, false);
  }
});

async function handleGoogleCallback(response) {
  hideError(el.googleError);

  try {
    setLoading(el.googleBtn, true);

    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: response.credential }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(el.googleError, data.error || "Google authentication failed");
      return;
    }

    storeToken(data.token, data.user);
  } catch (error) {
    showError(el.googleError, error.message || "Google authentication failed");
  } finally {
    setLoading(el.googleBtn, false);
  }
}

// Store original button text for loading state
el.emailSubmit.dataset.originalText = el.emailSubmit.textContent;
el.phoneSubmit.dataset.originalText = el.phoneSubmit.textContent;
el.googleBtn.dataset.originalText = el.googleBtn.textContent;

// Check if already logged in
const token = localStorage.getItem("ando.auth_token");
if (token) {
  window.location.href = "/";
}
