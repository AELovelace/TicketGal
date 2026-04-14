const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginStatus = document.getElementById("login-status");
const microsoftLoginBtn = document.getElementById("microsoft-login-btn");
const microsoftAuthBlock = document.getElementById("microsoft-auth-block");
const localLoginBlock = document.getElementById("local-login-block");
const localLoginDivider = document.getElementById("local-login-divider");
const localLoginBtn = document.getElementById("local-login-btn");
const registerLink = document.getElementById("register-link");

const brandTopLeft = document.getElementById("brand-top-left");
const brandTopRight = document.getElementById("brand-top-right");
const brandAuthEyebrow = document.getElementById("brand-auth-eyebrow");
const brandAuthTitle = document.getElementById("brand-auth-title");
const brandAuthDescription = document.getElementById("brand-auth-description");

let userPasswordAuthEnabled = true;
let microsoftAuthEnabled = false;

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function applyAuthModeVisibility() {
  const showMicrosoft = microsoftAuthEnabled;
  const showLocal = userPasswordAuthEnabled;
  const showLocalDivider = showMicrosoft && showLocal;

  if (localLoginBlock) {
    localLoginBlock.classList.toggle("hidden", !showLocal);
  }
  if (localLoginDivider) {
    localLoginDivider.classList.toggle("hidden", !showLocalDivider);
  }
  if (registerLink) {
    registerLink.classList.toggle("hidden", !showLocal);
  }
  if (microsoftAuthBlock) {
    microsoftAuthBlock.classList.toggle("hidden", !showMicrosoft);
  }
}

function readAuthRedirectState() {
  const params = new URLSearchParams(window.location.search);
  const error = safeText(params.get("auth_error")).trim();
  const success = safeText(params.get("auth_success")).trim();

  params.delete("auth_error");
  params.delete("auth_success");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, document.title, nextUrl);

  return { error, success };
}

async function loadBranding() {
  try {
    const result = await fetch("/api/branding", { credentials: "include" });
    if (!result.ok) return;

    const brand = await result.json();
    if (brandTopLeft && brand.top_banner_left) brandTopLeft.textContent = safeText(brand.top_banner_left);
    if (brandTopRight && brand.top_banner_right) brandTopRight.textContent = safeText(brand.top_banner_right);
    if (brandAuthEyebrow && brand.auth_eyebrow) brandAuthEyebrow.textContent = safeText(brand.auth_eyebrow);
    if (brandAuthTitle && brand.portal_title) brandAuthTitle.textContent = safeText(brand.portal_title);
    if (brandAuthDescription && brand.auth_description) brandAuthDescription.textContent = safeText(brand.auth_description);
  } catch {
    // Keep default text.
  }
}

async function checkSignupsEnabled() {
  if (!registerLink) return;

  if (!userPasswordAuthEnabled) {
    registerLink.classList.add("hidden");
    return;
  }

  registerLink.classList.remove("hidden");

  try {
    const result = await fetch("/api/settings/signups", { credentials: "include" });
    if (!result.ok) return;
    const data = await result.json();
    if (!data.signups_enabled) {
      registerLink.innerHTML = '<span class="muted">New user registration is currently disabled.</span>';
    }
  } catch {
    // Leave default link.
  }
}

async function loadAuthProviders() {
  if (!microsoftLoginBtn || !microsoftAuthBlock) return;

  try {
    const result = await fetch("/auth/providers", { credentials: "include" });
    if (!result.ok) {
      microsoftAuthEnabled = false;
      applyAuthModeVisibility();
      return;
    }

    const data = await result.json();
    microsoftAuthEnabled = Boolean(data?.microsoft_enabled);
    userPasswordAuthEnabled = data?.user_password_auth_enabled !== false;

    if (microsoftAuthEnabled && data?.microsoft_label) {
      microsoftLoginBtn.textContent = safeText(data.microsoft_label);
    }

    if (loginPassword instanceof HTMLInputElement) {
      loginPassword.placeholder = userPasswordAuthEnabled ? "" : "Admin password only";
    }

    applyAuthModeVisibility();
  } catch {
    microsoftAuthEnabled = false;
    applyAuthModeVisibility();
  }
}

async function submitPasswordLogin(event) {
  event.preventDefault();

  if (!userPasswordAuthEnabled) {
    if (loginStatus) loginStatus.textContent = "Use Sign in with Microsoft 365.";
    return;
  }

  if (loginStatus) loginStatus.textContent = "Signing in...";

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: safeText(loginEmail?.value || "").trim(),
        password: safeText(loginPassword?.value || ""),
      }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        detail = safeText(body?.detail || detail);
      } else {
        detail = safeText(await response.text() || detail);
      }
      throw new Error(detail);
    }

    window.location.assign("/");
  } catch (error) {
    if (loginStatus) loginStatus.textContent = `Login failed: ${safeText(error?.message || "Unknown error")}`;
  }
}

function init() {
  const redirectState = readAuthRedirectState();
  if (loginStatus) {
    if (redirectState.error) {
      loginStatus.textContent = redirectState.error;
    } else if (redirectState.success === "microsoft") {
      loginStatus.textContent = "Microsoft sign-in successful.";
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", submitPasswordLogin);
  }

  if (microsoftLoginBtn) {
    microsoftLoginBtn.addEventListener("click", () => {
      if (loginStatus) loginStatus.textContent = "Redirecting to Microsoft 365...";
      window.location.assign("/auth/microsoft/login");
    });
  }

  loadBranding();
  loadAuthProviders().then(checkSignupsEnabled);
}

init();
