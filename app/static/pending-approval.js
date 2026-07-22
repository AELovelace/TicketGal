const brandStrip = document.getElementById("brand-strip");
const brandTopLeft = document.getElementById("brand-top-left");
const brandTopSeparator = document.getElementById("brand-top-separator");
const brandTopRight = document.getElementById("brand-top-right");
const brandAuthEyebrow = document.getElementById("brand-auth-eyebrow");
const brandAuthTitle = document.getElementById("brand-auth-title");
const pendingApprovalDescription = document.getElementById("pending-approval-description");
const pendingApprovalEmail = document.getElementById("pending-approval-email");
const pendingApprovalLoginLink = document.getElementById("pending-approval-login-link");

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

function normalizeNextUrl(value) {
  const next = safeText(value).trim();
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
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

function applyBranding(branding) {
  if (!branding || typeof branding !== "object") return;

  const leftIsImage = applyBrandStripSlot(
    brandTopLeft,
    branding.top_banner_left,
    branding.top_banner_left_image,
    branding.top_banner_left_image_alt,
  );
  const rightIsImage = applyBrandStripSlot(
    brandTopRight,
    branding.top_banner_right,
    branding.top_banner_right_image,
    branding.top_banner_right_image_alt,
  );
  const hasAnyImage = leftIsImage || rightIsImage;

  if (brandTopSeparator) {
    brandTopSeparator.classList.toggle("hidden", hasAnyImage);
  }
  if (brandStrip) {
    brandStrip.classList.toggle("brand-strip-has-image", hasAnyImage);
  }

  if (brandAuthEyebrow && branding.auth_eyebrow) {
    brandAuthEyebrow.textContent = safeText(branding.auth_eyebrow);
  }
  if (brandAuthTitle && branding.portal_title) {
    brandAuthTitle.textContent = safeText(branding.portal_title);
  }
  if (branding.product_name) {
    document.title = `${safeText(branding.product_name)} - Awaiting Approval`;
  }

  const footerHelp = document.getElementById("footer-help");
  const footerHelpText = document.getElementById("footer-help-text");
  const footerHelpEmail = document.getElementById("footer-help-email");
  const footerCopyright = document.getElementById("footer-copyright");
  const hasFooterHelp = branding.footer_help_text || branding.footer_help_email;
  if (footerHelp) footerHelp.classList.toggle("hidden", !hasFooterHelp);
  if (footerHelpText) footerHelpText.textContent = safeText(branding.footer_help_text);
  if (footerHelpEmail && branding.footer_help_email) {
    const email = safeText(branding.footer_help_email).trim();
    footerHelpEmail.textContent = email;
    footerHelpEmail.href = `mailto:${email}`;
  }
  if (footerCopyright && branding.footer_copyright) {
    footerCopyright.textContent = safeText(branding.footer_copyright);
    footerCopyright.classList.remove("hidden");
  }
}

async function loadBranding() {
  try {
    const response = await fetch("/api/branding", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    applyBranding(data);
  } catch {
    // Keep the fallback copy if branding is unavailable.
  }
}

function initPageState() {
  const params = new URLSearchParams(window.location.search);
  const email = safeText(params.get("email")).trim();
  const next = normalizeNextUrl(params.get("next"));

  if (email && pendingApprovalEmail) {
    pendingApprovalEmail.textContent = `Account: ${email}`;
    pendingApprovalEmail.classList.remove("hidden");
  }

  if (pendingApprovalLoginLink) {
    pendingApprovalLoginLink.href = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  }
}

loadBranding();
initPageState();
