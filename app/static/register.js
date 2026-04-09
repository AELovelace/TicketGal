const registerForm = document.getElementById("register-form");
const registerStatus = document.getElementById("register-status");
const brandTopLeft = document.getElementById("brand-top-left");
const brandTopRight = document.getElementById("brand-top-right");
const brandAuthEyebrow = document.getElementById("brand-auth-eyebrow");
const brandAuthTitle = document.getElementById("brand-auth-title");
const brandRegisterDescription = document.getElementById("brand-register-description");
const registerAllowedDomainsNote = document.getElementById("register-allowed-domains-note");
let userPasswordAuthEnabled = true;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "include", ...options });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      detail = body?.detail || JSON.stringify(body);
    } else {
      detail = await response.text();
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : null;
}

function applyBranding(branding) {
  if (!branding || typeof branding !== "object") return;

  if (brandTopLeft && branding.top_banner_left) {
    brandTopLeft.textContent = String(branding.top_banner_left);
  }
  if (brandTopRight && branding.top_banner_right) {
    brandTopRight.textContent = String(branding.top_banner_right);
  }
  if (brandAuthEyebrow && branding.auth_eyebrow) {
    brandAuthEyebrow.textContent = String(branding.auth_eyebrow);
  }
  if (brandAuthTitle && branding.portal_title) {
    brandAuthTitle.textContent = String(branding.portal_title);
  }
  if (brandRegisterDescription && branding.register_description) {
    brandRegisterDescription.textContent = String(branding.register_description);
  }
  if (registerAllowedDomainsNote && branding.allowed_domains_note) {
    registerAllowedDomainsNote.textContent = String(branding.allowed_domains_note);
  }

  if (branding.product_name) {
    document.title = `${String(branding.product_name)} - Register`;
  }
}

async function loadBranding() {
  try {
    const response = await fetch("/api/branding", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    applyBranding(data);
  } catch {
    // Keep static defaults if branding endpoint is unavailable.
  }
}

// If already logged in, send straight to the app.
// Also check if signups are disabled.
(async () => {
  await loadBranding();

  try {
    await api("/auth/me");
    window.location.href = "/";
    return;
  } catch {
    // Not logged in — show the form.
  }

  try {
    const result = await fetch("/auth/providers", { credentials: "include" });
    if (result.ok) {
      const data = await result.json();
      userPasswordAuthEnabled = data?.user_password_auth_enabled !== false;
    }
  } catch {
    // If provider info fails, keep existing behavior.
  }

  if (!userPasswordAuthEnabled) {
    registerForm.innerHTML = `
      <p class="card-kicker">REGISTRATION</p>
      <h2>Microsoft 365 Required</h2>
      <p class="muted">User password registration is disabled. Use Microsoft 365 sign-in on the main page.</p>
      <p class="muted register-link"><a href="/">Back to Sign In</a></p>
    `;
    return;
  }

  // Check if signups are enabled
  try {
    const result = await fetch("/api/settings/signups");
    const data = await result.json();
    if (!data.signups_enabled) {
      registerForm.innerHTML = `
        <p class="card-kicker">REGISTRATION</p>
        <h2>Signups Disabled</h2>
        <p class="muted">New user registration is currently disabled by the administrator. Please contact your admin for access.</p>
        <p class="muted register-link"><a href="/">Back to Sign In</a></p>
      `;
      return;
    }
  } catch {
    // If we can't check, leave the form visible.
  }
})();

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerStatus.textContent = "Submitting registration...";

  try {
    const result = await api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("register-email").value.trim(),
        password: document.getElementById("register-password").value,
      }),
    });
    registerStatus.textContent = result?.message || "Registration submitted.";
    registerForm.reset();
  } catch (error) {
    registerStatus.textContent = `Registration failed: ${error.message}`;
  }
});
