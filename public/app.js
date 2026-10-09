// ---------- element shortcuts ----------
const $ = (id) => document.getElementById(id);

const authView = $("authView");
const sessionView = $("sessionView");
const signupForm = $("signupForm");
const loginForm = $("loginForm");
const tabSignup = $("tabSignup");
const tabLogin = $("tabLogin");
const message = $("message");

// ---------- helpers ----------
function setMessage(el, text, type) {
  el.textContent = text;
  el.className = type || "";
}

// Sends JSON to the backend and returns { ok, status, data }.
// Same origin (served by Express), so "/api/..." needs no host or CORS.
async function postJSON(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Cannot reach the server. Is `npm run dev` running?" },
    };
  }
}

// ---------- tabs ----------
function showTab(which) {
  const signup = which === "signup";
  signupForm.hidden = !signup;
  loginForm.hidden = signup;
  tabSignup.setAttribute("aria-selected", String(signup));
  tabLogin.setAttribute("aria-selected", String(!signup));
  setMessage(message, "");
}
tabSignup.addEventListener("click", () => showTab("signup"));
tabLogin.addEventListener("click", () => showTab("login"));

// ---------- session (token kept in localStorage) ----------
function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function renderSession() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const loggedIn = Boolean(token && user);

  authView.hidden = loggedIn;
  sessionView.hidden = !loggedIn;

  if (loggedIn) {
    $("whoName").textContent = user.username;
    $("whoEmail").textContent = user.email;
    $("tokenBox").value = token;
  }
}

// ---------- signup ----------
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("suUsername").value.trim();
  const email = $("suEmail").value.trim();
  const password = $("suPassword").value;

  if (!username || !email || !password) {
    return setMessage(message, "Fill in username, email and password.", "error");
  }
  if (password.length < 6) {
    return setMessage(message, "Password must be at least 6 characters.", "error");
  }

  const btn = signupForm.querySelector("button[type=submit]");
  btn.disabled = true;
  const { ok, data } = await postJSON("/api/auth/signup", { username, email, password });
  btn.disabled = false;

  if (!ok) return setMessage(message, data.error || "Signup failed.", "error");

  signupForm.reset();
  showTab("login");
  $("liEmail").value = email;
  setMessage(message, "Account created. Log in to continue.", "success");
  $("liPassword").focus();
});

// ---------- login ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("liEmail").value.trim();
  const password = $("liPassword").value;

  if (!email || !password) {
    return setMessage(message, "Enter your email and password.", "error");
  }

  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  const { ok, data } = await postJSON("/api/auth/login", { email, password });
  btn.disabled = false;

  if (!ok) return setMessage(message, data.error || "Login failed.", "error");

  saveSession(data.token, data.user);
  loginForm.reset();
  setMessage(message, "");
  renderSession();
});

// ---------- copy token and log out ----------
$("copyBtn").addEventListener("click", async () => {
  const sessionMsg = $("sessionMsg");
  try {
    await navigator.clipboard.writeText($("tokenBox").value);
    setMessage(sessionMsg, "Token copied.", "success");
  } catch {
    $("tokenBox").select();
    setMessage(sessionMsg, "Press Cmd+C to copy the selected token.", "");
  }
});

$("logoutBtn").addEventListener("click", () => {
  clearSession();
  setMessage($("sessionMsg"), "");
  renderSession();
  showTab("login");
});

// ---------- start ----------
renderSession();