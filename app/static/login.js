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

const brandStrip = document.getElementById("brand-strip");
const brandTopLeft = document.getElementById("brand-top-left");
const brandTopSeparator = document.getElementById("brand-top-separator");
const brandTopRight = document.getElementById("brand-top-right");
const brandAuthEyebrow = document.getElementById("brand-auth-eyebrow");
const brandAuthTitle = document.getElementById("brand-auth-title");
const brandAuthDescription = document.getElementById("brand-auth-description");

const localLoginFallbackNote = document.getElementById("local-login-fallback-note");

let userPasswordAuthEnabled = true;  // server allows non-admin password accounts (register link)
let microsoftAuthEnabled = false;    // M365 app registration is configured
let passwordLoginVisible = false;    // server says M365 is broken/unconfigured, so show the emergency form
let microsoftFlowFailed = false;     // we just came back from a Microsoft sign-in that errored
const emergencyRequested = new URLSearchParams(window.location.search).get("emergency") === "1";  // manual escape hatch

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeBrandImageSrc(value) {
  const src = safeText(value).trim();
  if (!src) return "";
  if (/^\//.test(src) || /^https?:\/\//i.test(src)) {
    return src;
  }
  return "";
}

function applyBrandStripSlot(slotEl, fallbackText, imageSrc, imageAlt) {
  if (!slotEl) return false;

  const src = normalizeBrandImageSrc(imageSrc);
  slotEl.textContent = "";

  if (src) {
    const logo = document.createElement("img");
    logo.className = "brand-strip-logo";
    logo.src = src;
    logo.alt = safeText(imageAlt).trim() || safeText(fallbackText).trim() || "Brand logo";
    slotEl.classList.add("brand-strip-slot-image");
    slotEl.appendChild(logo);
    return true;
  }

  slotEl.classList.remove("brand-strip-slot-image");
  slotEl.textContent = safeText(fallbackText);
  return false;
}

function applyAuthModeVisibility() {
  const showMicrosoft = microsoftAuthEnabled;
  // Password form is an emergency fallback only: M365 unconfigured/unreachable, a failed M365 round trip,
  // or ?emergency=1. The server still enforces who may actually log in with a password.
  const showLocal = passwordLoginVisible || microsoftFlowFailed || emergencyRequested || !showMicrosoft;
  const showLocalDivider = showMicrosoft && showLocal;

  if (localLoginBlock) {
    localLoginBlock.classList.toggle("hidden", !showLocal);
  }
  if (localLoginDivider) {
    localLoginDivider.classList.toggle("hidden", !showLocalDivider);
  }
  if (localLoginFallbackNote) {
    // Explain why the form appeared when M365 is supposed to be the way in.
    localLoginFallbackNote.classList.toggle("hidden", !(showMicrosoft && showLocal));
  }
  if (registerLink) {
    registerLink.classList.toggle("hidden", !(showLocal && userPasswordAuthEnabled));  // no self-signup in emergency-only mode
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

function normalizeNextUrl(value) {
  const next = safeText(value).trim();
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "";
}

function buildPendingApprovalUrl(email) {
  const params = new URLSearchParams();
  const normalizedEmail = safeText(email).trim().toLowerCase();
  const next = normalizeNextUrl(new URLSearchParams(window.location.search).get("next"));
  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }
  if (next) {
    params.set("next", next);
  }
  const query = params.toString();
  return query ? `/pending-approval?${query}` : "/pending-approval";
}

async function loadBranding() {
  try {
    const result = await fetch("/api/branding", { credentials: "include" });
    if (!result.ok) return;

    const brand = await result.json();
    const leftIsImage = applyBrandStripSlot(
      brandTopLeft,
      brand.top_banner_left,
      brand.top_banner_left_image,
      brand.top_banner_left_image_alt,
    );
    const rightIsImage = applyBrandStripSlot(
      brandTopRight,
      brand.top_banner_right,
      brand.top_banner_right_image,
      brand.top_banner_right_image_alt,
    );
    const hasAnyImage = leftIsImage || rightIsImage;

    if (brandTopSeparator) {
      brandTopSeparator.classList.toggle("hidden", hasAnyImage);
    }
    if (brandStrip) {
      brandStrip.classList.toggle("brand-strip-has-image", hasAnyImage);
    }

    if (brandAuthEyebrow && brand.auth_eyebrow) brandAuthEyebrow.textContent = safeText(brand.auth_eyebrow);
    if (brandAuthTitle && brand.portal_title) brandAuthTitle.textContent = safeText(brand.portal_title);
    if (brandAuthDescription && brand.auth_description) brandAuthDescription.textContent = safeText(brand.auth_description);

    // Login page shows copyright only — help text/email are suppressed here.
    const footerHelp = document.getElementById("footer-help");
    const footerCopyright = document.getElementById("footer-copyright");
    if (footerHelp) footerHelp.classList.add("hidden");
    if (footerCopyright && brand.footer_copyright) {
      footerCopyright.textContent = safeText(brand.footer_copyright);
      footerCopyright.classList.remove("hidden");
    }
  } catch {
    // Keep default text.
  }
}

async function checkSignupsEnabled() {
  if (!registerLink) return;

  // applyAuthModeVisibility already decided whether the link shows; only tweak its text here.
  if (!userPasswordAuthEnabled || registerLink.classList.contains("hidden")) {
    return;
  }

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
      microsoftAuthEnabled = false;  // can't tell what's configured, so fall back to showing the password form
      applyAuthModeVisibility();
      return;
    }

    const data = await result.json();
    microsoftAuthEnabled = Boolean(data?.microsoft_enabled);
    userPasswordAuthEnabled = data?.user_password_auth_enabled !== false;
    passwordLoginVisible = data?.password_login_visible !== false;  // older servers without the field: keep showing it

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

  // No client-side block here: when user password auth is off, the server still lets admins in
  // (emergency access) and returns a clear error for everyone else.
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
      if (response.status === 403 && detail === "Account pending admin approval") {
        window.location.assign(buildPendingApprovalUrl(loginEmail?.value || ""));
        return;
      }
      throw new Error(detail);
    }

    const _nextParam = normalizeNextUrl(new URLSearchParams(window.location.search).get("next"));
    const _safeDest = _nextParam || "/";
    window.location.assign(_safeDest);
  } catch (error) {
    if (loginStatus) loginStatus.textContent = `Login failed: ${safeText(error?.message || "Unknown error")}`;
  }
}

function init() {
  const redirectState = readAuthRedirectState();
  microsoftFlowFailed = Boolean(redirectState.error);  // M365 bounced us back with an error → reveal the fallback
  // Visibility is applied once /auth/providers answers (loadAuthProviders), so the form never flashes.
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
