const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const shell = document.querySelector(".shell");
const userShell = document.getElementById("user-shell");
const adminShell = document.getElementById("admin-shell");
const welcomeText = document.getElementById("welcome-text");
const userNavButtons = Array.from(document.querySelectorAll(".user-nav-btn"));
const userPages = Array.from(document.querySelectorAll(".user-page"));

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const microsoftLoginBtn = document.getElementById("microsoft-login-btn");
const microsoftAuthBlock = document.getElementById("microsoft-auth-block");
const localLoginBlock = document.getElementById("local-login-block");
const localLoginDivider = document.getElementById("local-login-divider");
const localLoginBtn = document.getElementById("local-login-btn");
const registerLink = document.getElementById("register-link");

const loginStatus = document.getElementById("login-status");
const brandStrip = document.getElementById("brand-strip");
const brandTopLeft = document.getElementById("brand-top-left");
const brandTopSeparator = document.getElementById("brand-top-separator");
const brandTopRight = document.getElementById("brand-top-right");
const brandAuthEyebrow = document.getElementById("brand-auth-eyebrow");
const brandAuthTitle = document.getElementById("brand-auth-title");
const brandAuthDescription = document.getElementById("brand-auth-description");
const brandHeroEyebrow = document.getElementById("brand-hero-eyebrow");
const brandHeroTitle = document.getElementById("brand-hero-title");

const userCreateForm = document.getElementById("create-ticket-form");
const userTicketsBody = document.getElementById("tickets-body");
const userListStatus = document.getElementById("list-status");
const userCreateStatus = document.getElementById("create-status");
const userRefreshBtn = document.getElementById("refresh-btn");
const userStatusFilter = document.getElementById("user-status-filter");
const userInProgressBody = document.getElementById("user-in-progress-body");
const userInProgressStatus = document.getElementById("user-in-progress-status");
const userInProgressRefreshBtn = document.getElementById("user-in-progress-refresh-btn");
const userPropertyNote = document.getElementById("user-property-note");
const userPropertyChip = document.getElementById("user-property-chip");

const userDropZone = document.getElementById("drop-zone");
const userDropHint = document.getElementById("drop-hint");
const userAiAssistBtn = document.getElementById("ticket-ai-assist");
const userAiAssistStatus = document.getElementById("ticket-ai-status");

const adminCreateForm = document.getElementById("admin-create-ticket-form");
const adminModalCreateForm = document.getElementById("admin-modal-create-ticket-form");
const adminStatusBody = document.getElementById("admin-status-body");
const adminStatusMessage = document.getElementById("admin-status-message");
const adminCreateStatus = document.getElementById("admin-create-status");
const adminModalCreateStatus = document.getElementById("admin-modal-create-status");
const adminStatusRefreshBtn = document.getElementById("admin-status-refresh-btn");
const adminStatusCreateBtn = document.getElementById("admin-status-create-btn");
const adminTicketSearchInput = document.getElementById("admin-ticket-search");
const adminStatusFilter = document.getElementById("admin-status-filter");

const adminDropZone = document.getElementById("admin-drop-zone");
const adminDropHint = document.getElementById("admin-drop-hint");
const adminModalDropZone = document.getElementById("admin-modal-drop-zone");
const adminModalDropHint = document.getElementById("admin-modal-drop-hint");
const adminAiAssistBtn = document.getElementById("admin-ticket-ai-assist");
const adminAiAssistStatus = document.getElementById("admin-ticket-ai-status");
const adminModalAiAssistBtn = document.getElementById("admin-modal-ticket-ai-assist");
const adminModalAiAssistStatus = document.getElementById("admin-modal-ticket-ai-status");

const refreshUsersBtn = document.getElementById("refresh-users-btn");
const pendingUsersEl = document.getElementById("pending-users");
const userManagementListEl = document.getElementById("user-management-list");
const userSearchInput = document.getElementById("user-search");
const lockoutKeyTypeEl = document.getElementById("lockout-key-type");
const lockoutKeyValueEl = document.getElementById("lockout-key-value");
const clearLockoutBtn = document.getElementById("clear-lockout-btn");
const refreshLockoutsBtn = document.getElementById("refresh-lockouts-btn");
const lockoutStatusEl = document.getElementById("lockout-status");
const lockoutListEl = document.getElementById("lockout-list");
const alertsFeed = document.getElementById("alerts-feed");
const alertsStatus = document.getElementById("alerts-status");
const alertsList = document.getElementById("alerts-list");
const alertsRefreshBtn = document.getElementById("alerts-refresh-btn");
const adminAlertsToggle = document.getElementById("admin-alerts-toggle");
const ticketViewerModeStatus = document.getElementById("ticket-viewer-mode-status");
const ticketViewerModeButtons = Array.from(document.querySelectorAll("[data-viewer-mode-toggle]"));

// Password reset modal elements
const passwordResetModal = document.getElementById("password-reset-modal");
const passwordResetClose = document.getElementById("password-reset-close");
const passwordResetUserEmail = document.getElementById("password-reset-user-email");
const passwordResetInput = document.getElementById("password-reset-input");
const passwordResetSubmit = document.getElementById("password-reset-submit");
const passwordResetStatus = document.getElementById("password-reset-status");

// Audit log modal elements
const auditLogModal = document.getElementById("audit-log-modal");
const auditLogClose = document.getElementById("audit-log-close");
const auditLogBody = document.getElementById("audit-log-body");
const auditLogStatus = document.getElementById("audit-log-status");
const auditLogActionFilter = document.getElementById("audit-log-action-filter");
const auditLogFilterBtn = document.getElementById("audit-log-filter-btn");
const auditLogResetBtn = document.getElementById("audit-log-reset-btn");
const auditLogPrev = document.getElementById("audit-log-prev");
const auditLogNext = document.getElementById("audit-log-next");
const auditLogPageInfo = document.getElementById("audit-log-page-info");
const kbAccessLogModal = document.getElementById("kb-access-log-modal");
const kbAccessLogClose = document.getElementById("kb-access-log-close");
const kbAccessLogBody = document.getElementById("kb-access-log-body");
const kbAccessLogStatus = document.getElementById("kb-access-log-status");
const kbAccessLogSearchFilter = document.getElementById("kb-access-log-search-filter");
const kbAccessLogResultFilter = document.getElementById("kb-access-log-result-filter");
const kbAccessLogFilterBtn = document.getElementById("kb-access-log-filter-btn");
const kbAccessLogResetBtn = document.getElementById("kb-access-log-reset-btn");
const kbAccessLogPrev = document.getElementById("kb-access-log-prev");
const kbAccessLogNext = document.getElementById("kb-access-log-next");
const kbAccessLogPageInfo = document.getElementById("kb-access-log-page-info");
const loginAccessLogModal = document.getElementById("login-access-log-modal");
const loginAccessLogClose = document.getElementById("login-access-log-close");
const loginAccessLogBody = document.getElementById("login-access-log-body");
const loginAccessLogStatus = document.getElementById("login-access-log-status");
const loginAccessLogSearchFilter = document.getElementById("login-access-log-search-filter");
const loginAccessLogFilterBtn = document.getElementById("login-access-log-filter-btn");
const loginAccessLogResetBtn = document.getElementById("login-access-log-reset-btn");
const loginAccessLogExportBtn = document.getElementById("login-access-log-export-btn");
const loginAccessLogPrev = document.getElementById("login-access-log-prev");
const loginAccessLogNext = document.getElementById("login-access-log-next");
const loginAccessLogPageInfo = document.getElementById("login-access-log-page-info");
const failedLoginLogModal = document.getElementById("failed-login-log-modal");
const failedLoginLogClose = document.getElementById("failed-login-log-close");
const failedLoginLogBody = document.getElementById("failed-login-log-body");
const failedLoginLogStatus = document.getElementById("failed-login-log-status");
const failedLoginLogSearchFilter = document.getElementById("failed-login-log-search-filter");
const failedLoginLogFilterBtn = document.getElementById("failed-login-log-filter-btn");
const failedLoginLogResetBtn = document.getElementById("failed-login-log-reset-btn");
const failedLoginLogExportBtn = document.getElementById("failed-login-log-export-btn");
const failedLoginLogPrev = document.getElementById("failed-login-log-prev");
const failedLoginLogNext = document.getElementById("failed-login-log-next");
const failedLoginLogPageInfo = document.getElementById("failed-login-log-page-info");

let auditLogOffset = 0;
const AUDIT_LOG_PAGE_SIZE = 50;
let kbAccessLogOffset = 0;
const KB_ACCESS_LOG_PAGE_SIZE = 50;
let loginAccessLogOffset = 0;
const LOGIN_ACCESS_LOG_PAGE_SIZE = 50;
let failedLoginLogOffset = 0;
const FAILED_LOGIN_LOG_PAGE_SIZE = 50;

let currentResetUserId = null;

if (userSearchInput) {
  userSearchInput.addEventListener("input", () => {
    const query = userSearchInput.value.trim().toLowerCase();
    [pendingUsersEl, userManagementListEl].forEach((container) => {
      if (!container) return;
      container.querySelectorAll(".pending-row").forEach((row) => {
        const email = (row.textContent || "").toLowerCase();
        row.style.display = !query || email.includes(query) ? "" : "none";
      });
    });
  });
}

const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const adminPages = Array.from(document.querySelectorAll(".admin-page"));
const adminPropertySelect = document.getElementById("admin-ticket-property");
const adminModalPropertySelect = document.getElementById("admin-modal-ticket-property");
const ticketViewer = document.getElementById("ticket-viewer");
const ticketViewerClose = document.getElementById("ticket-viewer-close");
const adminCreateTicketModal = document.getElementById("admin-create-ticket-modal");
const adminCreateTicketModalClose = document.getElementById("admin-create-ticket-modal-close");
const adminSyncTicketsBtn = document.getElementById("admin-sync-tickets-btn");
const adminSyncTicketsStatus = document.getElementById("admin-sync-tickets-status");
const adminRescanKbBtn = document.getElementById("admin-rescan-kb-btn");
const adminRescanKbStatus = document.getElementById("admin-rescan-kb-status");

let reportLoadedPeriod = null;
let reportRequestSeq = 0;
const ticketViewerMeta = document.getElementById("ticket-viewer-meta");
const ticketViewerUpdate = document.getElementById("ticket-viewer-update");
const ticketViewerUpdateStatus = document.getElementById("ticket-viewer-update-status");
const ticketViewerHistory = document.getElementById("ticket-viewer-history");

const ADMIN_STATUSES = ["Open", "Pending", "Closed", "Resolved"];
const USER_STATUSES = ["Open", "Resolved"];
const USER_LOCKED_CURRENT = ["pending", "closed", "pending closed"];

let currentUser = null;
let currentAdminPage = "admin-page-create";
let currentUserPage = "user-page-in-progress";
let cachedTickets = [];
let lastTicketLoadMeta = {
  pagesFetched: 0,
  usingCacheFallback: false,
  fallbackDetail: "",
};
let cachedProperties = [];
let alertsPollTimer = null;
let userPasswordAuthEnabled = true;
let microsoftAuthEnabled = false;

const authRedirectState = readAndClearAuthRedirectState();

const DISMISSED_ALERTS_KEY = "ticketgal.dismissed_alert_ids";
const TICKET_VIEWER_MODE_KEY = "ticketgal.ticket_viewer_mode";
const TICKET_VIEWER_STANDALONE_PARAM = "viewer_standalone";

let ticketViewerMode = "modal";
let pendingTicketViewerLaunch = null;
let pendingTicketViewerLaunchHandled = false;
let isStandaloneTicketViewerWindow = false;
let baseDocumentTitle = document.title;

function getDismissedAlertIds() {
  try {
    const raw = localStorage.getItem(DISMISSED_ALERTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => safeText(value)));
  } catch {
    return new Set();
  }
}

function setDismissedAlertIds(ids) {
  try {
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore localStorage errors.
  }
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

function dismissAlert(alertId) {
  const id = safeText(alertId).trim();
  if (!id) return;
  const ids = getDismissedAlertIds();
  ids.add(id);
  setDismissedAlertIds(ids);
}

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

function setBaseDocumentTitle(value) {
  const text = safeText(value).trim();
  if (!text) return;
  baseDocumentTitle = text;
  if (!ticketViewer || ticketViewer.classList.contains("hidden")) {
    document.title = text;
  }
}

function restoreBaseDocumentTitle() {
  document.title = baseDocumentTitle;
}

function setTicketViewerDocumentTitle({ ticketId = "", queueId = "", ticketTitle = "", queued = false } = {}) {
  const idPart = queued
    ? (safeText(queueId).trim() ? `Queued #${safeText(queueId).trim()}` : "Queued Ticket")
    : (safeText(ticketId).trim() ? `#${safeText(ticketId).trim()}` : "Ticket");
  const titlePart = safeText(ticketTitle).trim() || "(no title)";
  document.title = `${idPart} - ${titlePart}`;
}

function readTicketViewerMode() {
  let stored = "";
  try {
    stored = safeText(localStorage.getItem(TICKET_VIEWER_MODE_KEY)).trim().toLowerCase();
  } catch {
    stored = "";
  }
  return stored === "window" ? "window" : "modal";
}

function writeTicketViewerMode(mode) {
  const nextMode = mode === "window" ? "window" : "modal";
  ticketViewerMode = nextMode;
  try {
    localStorage.setItem(TICKET_VIEWER_MODE_KEY, nextMode);
  } catch {
    // Ignore storage failures and keep in-memory preference.
  }
  updateTicketViewerModeUi();
}

function updateTicketViewerModeUi() {
  const isWindowMode = ticketViewerMode === "window";
  ticketViewerModeButtons.forEach((button) => {
    button.textContent = isWindowMode ? "Viewer: Window" : "Viewer: Modal";
  });
  if (ticketViewerModeStatus) {
    ticketViewerModeStatus.textContent = isWindowMode
      ? "Ticket Viewer opens in a separate window."
      : "Ticket Viewer opens as a modal in this tab.";
  }
}

function toggleTicketViewerMode() {
  writeTicketViewerMode(ticketViewerMode === "window" ? "modal" : "window");
}

function parsePendingTicketViewerLaunch() {
  const params = new URLSearchParams(window.location.search);
  const ticketIdRaw = safeText(params.get("open_ticket_id")).trim();
  const queueIdRaw = safeText(params.get("open_queue_id")).trim();

  const ticketId = Number(ticketIdRaw);
  if (Number.isFinite(ticketId) && ticketId > 0) {
    return { type: "ticket", id: String(ticketId) };
  }

  const queueId = Number(queueIdRaw);
  if (Number.isFinite(queueId) && queueId > 0) {
    return { type: "queue", id: String(queueId) };
  }

  return null;
}

function parseStandaloneTicketViewerWindowFlag() {
  const params = new URLSearchParams(window.location.search);
  return safeText(params.get(TICKET_VIEWER_STANDALONE_PARAM)).trim() === "1";
}

function applyStandaloneTicketViewerLayout() {
  document.body.classList.add("ticket-viewer-standalone");
  if (ticketViewerClose) {
    ticketViewerClose.textContent = "Close Window";
  }
}

function clearPendingTicketViewerLaunchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete("open_ticket_id");
  params.delete("open_queue_id");
  params.delete(TICKET_VIEWER_STANDALONE_PARAM);
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function buildTicketViewerWindowUrl({ ticketId = "", queueId = "" } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.delete("open_ticket_id");
  url.searchParams.delete("open_queue_id");
  url.searchParams.set(TICKET_VIEWER_STANDALONE_PARAM, "1");
  if (ticketId) {
    url.searchParams.set("open_ticket_id", String(ticketId));
  }
  if (queueId) {
    url.searchParams.set("open_queue_id", String(queueId));
  }
  return url.toString();
}

function launchTicketViewerWindow({ ticketId = "", queueId = "" } = {}) {
  const popupUrl = buildTicketViewerWindowUrl({ ticketId, queueId });
  const popup = window.open(popupUrl, "_blank", "noopener,noreferrer,width=1380,height=920");
  return popup;
}

async function openTicketViewerByPreference(ticketId) {
  if (ticketViewerMode === "window") {
    const popup = launchTicketViewerWindow({ ticketId });
    if (popup) return;
  }
  await openTicketViewer(ticketId);
}

async function openQueuedTicketViewerByPreference(queueId) {
  if (ticketViewerMode === "window") {
    const popup = launchTicketViewerWindow({ queueId });
    if (popup) return;
  }
  await openQueuedTicketViewer(queueId);
}

async function maybeOpenPendingTicketViewerLaunch() {
  if (pendingTicketViewerLaunchHandled || !pendingTicketViewerLaunch || !currentUser) return;
  pendingTicketViewerLaunchHandled = true;
  try {
    if (isStandaloneTicketViewerWindow) {
      applyStandaloneTicketViewerLayout();
    }
    if (pendingTicketViewerLaunch.type === "queue") {
      await openQueuedTicketViewer(pendingTicketViewerLaunch.id);
    } else {
      await openTicketViewer(pendingTicketViewerLaunch.id);
    }
  } catch {
    // If the launch payload cannot be opened, keep the app usable.
  } finally {
    clearPendingTicketViewerLaunchFromUrl();
  }
}

function readCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function isStateChangingMethod(method) {
  const normalized = safeText(method || "GET").toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

function readAndClearAuthRedirectState() {
  const params = new URLSearchParams(window.location.search);
  const error = safeText(params.get("auth_error")).trim();
  const success = safeText(params.get("auth_success")).trim();

  if (!error && !success) {
    return { error: "", success: "" };
  }

  params.delete("auth_error");
  params.delete("auth_success");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, document.title, nextUrl);

  return { error, success };
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
  if (brandAuthDescription && branding.auth_description) {
    brandAuthDescription.textContent = safeText(branding.auth_description);
  }
  if (brandHeroEyebrow && branding.hero_eyebrow) {
    brandHeroEyebrow.textContent = safeText(branding.hero_eyebrow);
  }
  if (brandHeroTitle && branding.operations_title) {
    brandHeroTitle.textContent = safeText(branding.operations_title);
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

  const productName = safeText(branding.product_name).trim();
  if (productName) {
    setBaseDocumentTitle(productName);
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

function htmlToReadableText(value) {
  const raw = safeText(value);
  if (!raw) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  doc.querySelectorAll("script, style, link").forEach((el) => el.remove());

  let text = (doc.body?.textContent || raw)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  text = stripAteraCssNoise(text);

  return text;
}

function stripAteraCssNoise(value) {
  let text = safeText(value).trim();
  if (!text) return "";

  // Some Atera comments can include serialized CSS text before actual message content.
  // Remove leading selector/declaration blocks if present.
  const cssBlockPrefix = /^(?:[.#a-zA-Z0-9_\-\s,>:+*\[\]="'()]+)\{[^{}]{0,5000}\}\s*/;
  for (let i = 0; i < 5; i += 1) {
    if (!cssBlockPrefix.test(text)) break;
    text = text.replace(cssBlockPrefix, "").trim();
  }

  // Remove a common malformed prefix where tag selectors are flattened to text.
  text = text.replace(
    /^((?:p|strong|em|ul|ol|li|img|h[1-6]|span|div|hr|b|i|u|a)\s*,\s*)+(?:p|strong|em|ul|ol|li|img|h[1-6]|span|div|hr|b|i|u|a)\s*\{[^{}]{0,5000}\}\s*/i,
    "",
  ).trim();

  // Remove leading bare CSS declaration runs that may survive malformed content.
  const cssDeclarationsPrefix = /^(?:[a-z-]+\s*:\s*[^;\n]+;\s*){2,}/i;
  text = text.replace(cssDeclarationsPrefix, "").trim();

  return text;
}

function decodeHtmlEntities(value) {
  const text = safeText(value);
  if (!text) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function isSafeCommentHref(href) {
  const value = safeText(href).trim();
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:|mailto:|tel:)/i.test(value);
}

function sanitizeTicketCommentNode(node) {
  if (!node) return document.createTextNode("");

  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return document.createTextNode("");
  }

  const allowedTags = new Set([
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
    "img",
    "hr",
    "span",
    "div",
  ]);

  const tagName = safeText(node.tagName).toLowerCase();

  if (!allowedTags.has(tagName)) {
    const fragment = document.createDocumentFragment();
    Array.from(node.childNodes || []).forEach((child) => {
      fragment.appendChild(sanitizeTicketCommentNode(child));
    });
    return fragment;
  }

  const clean = document.createElement(tagName);

  if (tagName === "a") {
    const href = safeText(node.getAttribute("href")).trim();
    if (isSafeCommentHref(href)) {
      clean.setAttribute("href", href);
      clean.setAttribute("rel", "noopener noreferrer nofollow");
      if (!href.startsWith("/") && !href.startsWith("#") && !/^mailto:|^tel:/i.test(href)) {
        clean.setAttribute("target", "_blank");
      }
    }
  }

  if (tagName === "img") {
    const src = safeText(node.getAttribute("src")).trim();
    const safeSrc = src.startsWith("/") || /^https?:/i.test(src) || /^data:image\//i.test(src);
    if (safeSrc) {
      clean.setAttribute("src", src);
    }
    const alt = safeText(node.getAttribute("alt")).trim();
    if (alt) {
      clean.setAttribute("alt", alt);
    }
    clean.setAttribute("loading", "lazy");
  }

  Array.from(node.childNodes || []).forEach((child) => {
    clean.appendChild(sanitizeTicketCommentNode(child));
  });

  return clean;
}

function renderTicketCommentContent(value) {
  const raw = safeText(value);
  const wrapper = document.createElement("div");
  wrapper.className = "history-comment";

  if (!raw.trim()) {
    return wrapper;
  }

  const decoded = /&lt;\/?[a-z][^&]*&gt;/i.test(raw) ? decodeHtmlEntities(raw) : raw;
  const candidate = stripAteraCssNoise(decoded);

  const parser = new DOMParser();
  const doc = parser.parseFromString(candidate, "text/html");
  doc.querySelectorAll("script, style, link, iframe, object, embed, form, input, button, textarea, select, meta")
    .forEach((el) => el.remove());

  const hasSupportedElements = Boolean(
    doc.body?.querySelector("h1,h2,h3,h4,h5,h6,p,br,strong,b,em,i,u,ul,ol,li,blockquote,code,pre,a,img,hr,span,div"),
  );

  if (!hasSupportedElements) {
    wrapper.textContent = htmlToReadableText(candidate);
    return wrapper;
  }

  let appended = false;
  Array.from(doc.body?.childNodes || []).forEach((child) => {
    const sanitized = sanitizeTicketCommentNode(child);
    if (!sanitized) return;
    if (sanitized.nodeType === Node.TEXT_NODE && !safeText(sanitized.textContent).trim()) return;
    wrapper.appendChild(sanitized);
    appended = true;
  });

  if (!appended) {
    wrapper.textContent = htmlToReadableText(candidate);
  }

  return wrapper;
}

function toTimestamp(value) {
  const text = safeText(value).trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatAlertTime(value) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) return "";

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 60_000) return "just now";
  if (elapsedMs < 3_600_000) return `${Math.max(1, Math.floor(elapsedMs / 60_000))}m ago`;
  if (elapsedMs < 86_400_000) return `${Math.max(1, Math.floor(elapsedMs / 3_600_000))}h ago`;

  return new Date(timestamp).toLocaleString();
}

function formatAbsoluteAlertTime(value) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) return "";
  return new Date(timestamp).toLocaleString();
}

function alertSeverityClass(value) {
  const severity = safeText(value).trim().toLowerCase();
  if (!severity) return "alert-severity-info";
  if (severity.includes("critical")) return "alert-severity-critical";
  if (severity.includes("high")) return "alert-severity-high";
  if (severity.includes("warn")) return "alert-severity-warning";
  if (severity.includes("medium")) return "alert-severity-medium";
  if (severity.includes("low")) return "alert-severity-low";
  if (severity.includes("info")) return "alert-severity-info";
  return "alert-severity-info";
}

function normalizeAlertItem(alert) {
  const rawAlertId =
    alert?.AlertID ??
    alert?.AlertId ??
    alert?.Id ??
    alert?.ID ??
    null;

  const title =
    safeText(alert?.AlertTitle) ||
    safeText(alert?.Title) ||
    safeText(alert?.AlertType) ||
    safeText(alert?.DeviceName) ||
    safeText(alert?.CustomerName) ||
    "Atera Alert";

  const message =
    safeText(alert?.AlertMessage) ||
    safeText(alert?.Message) ||
    safeText(alert?.Description) ||
    "";

  const severity =
    safeText(alert?.AlertSeverity) ||
    safeText(alert?.Severity) ||
    safeText(alert?.Priority) ||
    "Info";

  const machineName =
    safeText(alert?.DeviceName) ||
    safeText(alert?.AgentName) ||
    safeText(alert?.MachineName) ||
    "";

  const machineId =
    safeText(alert?.AgentId) ||
    safeText(alert?.DeviceGuid) ||
    safeText(alert?.DeviceID) ||
    safeText(alert?.MachineId) ||
    "";

  const source = safeText(alert?.CustomerName) || "";
  const createdAt =
    safeText(alert?.CreatedDate) ||
    safeText(alert?.Created) ||
    safeText(alert?.CreationTime) ||
    safeText(alert?.CreatedAt) ||
    safeText(alert?.LastUpdated) ||
    "";

  const remoteAlertId = safeText(rawAlertId).trim();
  const alertId = remoteAlertId || `${title}|${createdAt}|${machineName}|${machineId}`;

  return { title, message, severity, source, createdAt, machineName, machineId, alertId, remoteAlertId };
}

function normalizeForMatch(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferPriorityFromAlert(entry) {
  const severity = safeText(entry?.severity).toLowerCase();
  const context = [entry?.title, entry?.message, entry?.source, entry?.machineName]
    .map((value) => safeText(value).toLowerCase())
    .join(" ");

  if (
    severity.includes("critical") ||
    /ransom|malware|virus|security breach|compromised|data loss|disk full/i.test(context)
  ) {
    return "Critical";
  }
  if (
    severity.includes("high") ||
    /outage|down|offline|unreachable|not responding|service unavailable|failed login storm/i.test(context)
  ) {
    return "High";
  }
  if (severity.includes("medium") || severity.includes("warn") || /degraded|latency|slow/i.test(context)) {
    return "Medium";
  }
  if (severity.includes("low") || severity.includes("info")) {
    return "Low";
  }
  return "";
}

function inferTypeFromAlert(entry) {
  const context = [entry?.title, entry?.message]
    .map((value) => safeText(value).toLowerCase())
    .join(" ");

  if (/request|new user|access|permission|onboard|install|setup|reset password/i.test(context)) {
    return "Request";
  }
  if (/repeat|recurring|intermittent|keeps happening|again/i.test(context)) {
    return "Problem";
  }
  if (/change|maintenance|upgrade|patch|migration|rollout/i.test(context)) {
    return "Change";
  }
  return "Incident";
}

function inferPropertyFromAlert(entry) {
  if (!Array.isArray(cachedProperties) || !cachedProperties.length) {
    return null;
  }

  const source = normalizeForMatch(entry?.source);
  const haystack = normalizeForMatch(
    [entry?.source, entry?.title, entry?.message, entry?.machineName, entry?.machineId].join(" "),
  );

  let best = null;
  let bestScore = 0;

  cachedProperties.forEach((property) => {
    const name = safeText(property?.customer_name);
    const normalizedName = normalizeForMatch(name);
    if (!normalizedName) return;

    let score = 0;
    if (source && (source === normalizedName || source.includes(normalizedName) || normalizedName.includes(source))) {
      score += 10;
    }
    if (haystack.includes(normalizedName)) {
      score += 6;
    }

    const tokens = normalizedName.split(" ").filter((token) => token.length >= 3);
    tokens.forEach((token) => {
      if (haystack.includes(token)) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      best = property;
    }
  });

  if (!best || bestScore < 3) {
    return null;
  }

  return {
    customer_id: Number(best.customer_id),
    customer_name: safeText(best.customer_name),
  };
}

function buildAlertTicketDraft(entry) {
  const title = safeText(entry?.title).trim().slice(0, 160) || "Atera Alert Follow-Up";
  const lines = [
    "Atera alert details:",
    `Title: ${safeText(entry?.title) || "(none)"}`,
    `Severity: ${safeText(entry?.severity) || "Info"}`,
  ];

  if (entry?.source) {
    lines.push(`Customer: ${safeText(entry.source)}`);
  }
  if (entry?.machineName) {
    lines.push(`Machine: ${safeText(entry.machineName)}`);
  }
  if (entry?.machineId) {
    lines.push(`Machine ID: ${safeText(entry.machineId)}`);
  }
  const absoluteTime = formatAbsoluteAlertTime(entry?.createdAt);
  if (absoluteTime) {
    lines.push(`Event Time: ${absoluteTime}`);
  }
  if (entry?.message) {
    lines.push("", "Alert Message:", safeText(entry.message));
  }

  const guessedPriority = inferPriorityFromAlert(entry);
  const guessedType = inferTypeFromAlert(entry);
  const guessedProperty = inferPropertyFromAlert(entry);

  return {
    ticket_title: title,
    description: lines.join("\n").slice(0, 4000),
    ticket_priority: guessedPriority,
    ticket_type: guessedType,
    property_customer_id: guessedProperty?.customer_id ?? null,
    property_name: guessedProperty?.customer_name ?? "",
  };
}

function ensureAdminCreateTicketPage() {
  if (currentUser?.role !== "admin") {
    throw new Error("Only admins can create ticket drafts from alerts.");
  }
  setAdminPage("admin-page-create");
}

async function createTicketDraftFromAlert(entry, triggerButton) {
  const button = triggerButton instanceof HTMLButtonElement ? triggerButton : null;
  const statusTarget = adminAiAssistStatus || alertsStatus;
  const adminTitle = document.getElementById("admin-ticket-title");
  const adminDescription = document.getElementById("admin-ticket-description");
  const adminPriority = document.getElementById("admin-ticket-priority");
  const adminType = document.getElementById("admin-ticket-type");

  if (!(adminTitle instanceof HTMLInputElement) || !(adminDescription instanceof HTMLTextAreaElement)) {
    throw new Error("Create ticket fields are unavailable.");
  }

  const draft = buildAlertTicketDraft(entry);

  ensureAdminCreateTicketPage();
  adminTitle.value = draft.ticket_title;
  adminDescription.value = draft.description;

  if (adminPriority instanceof HTMLSelectElement && draft.ticket_priority) {
    adminPriority.value = draft.ticket_priority;
  }
  if (adminType instanceof HTMLSelectElement && draft.ticket_type) {
    adminType.value = draft.ticket_type;
  }
  if (
    adminPropertySelect instanceof HTMLSelectElement &&
    draft.property_customer_id !== null &&
    Array.from(adminPropertySelect.options).some((option) => option.value === String(draft.property_customer_id))
  ) {
    adminPropertySelect.value = String(draft.property_customer_id);
  }

  if (statusTarget) {
    const guessedParts = [];
    if (draft.ticket_priority) guessedParts.push(`priority ${draft.ticket_priority}`);
    if (draft.ticket_type) guessedParts.push(`type ${draft.ticket_type}`);
    if (draft.property_name) guessedParts.push(`property ${draft.property_name}`);
    statusTarget.textContent = guessedParts.length
      ? `Guessing ${guessedParts.join(", ")} and generating AI draft...`
      : "Generating ticket draft from alert...";
  }
  if (button) {
    button.disabled = true;
    button.textContent = "Creating...";
  }

  try {
    const aiResult = await api("/api/tickets/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: draft.description,
        ticket_title: draft.ticket_title,
      }),
    });

    const changed = applyAiAssistToForm("admin-", aiResult || {}, true);
    const fallbackUsed = Boolean(aiResult?.fallback_used);
    const fallbackReason = safeText(aiResult?.fallback_reason).trim();

    if (statusTarget) {
      if (changed && fallbackUsed) {
        statusTarget.textContent = fallbackReason
          ? `Ticket draft created with fallback rewrite. ${fallbackReason}.`
          : "Ticket draft created with fallback rewrite.";
      } else if (changed) {
        statusTarget.textContent = "Ticket draft created from alert. Review and submit.";
      } else if (fallbackUsed) {
        statusTarget.textContent = fallbackReason
          ? `Ticket draft loaded from alert, fallback rewrite made no field changes. ${fallbackReason}.`
          : "Ticket draft loaded from alert, fallback rewrite made no field changes.";
      } else {
        statusTarget.textContent = "Ticket draft loaded from alert. Review and submit.";
      }
    }

    const createSection = document.getElementById("admin-page-create");
    if (createSection) {
      createSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Create Ticket";
    }
  }
}

function stopAlertsPolling() {
  if (alertsPollTimer) {
    clearInterval(alertsPollTimer);
    alertsPollTimer = null;
  }
}

function startAlertsPolling() {
  stopAlertsPolling();
  alertsPollTimer = setInterval(() => {
    loadAlerts({ silent: true });
  }, 60_000);
}

async function loadAlerts(options = {}) {
  const silent = options.silent === true;
  if (!alertsFeed || !alertsStatus || !alertsList || !currentUser) return;

  if (currentUser.role !== "admin") {
    stopAlertsPolling();
    alertsList.innerHTML = "";
    alertsStatus.textContent = "Alerts are available to admins only.";
    return;
  }

  if (!silent) {
    alertsStatus.textContent = "Loading alerts...";
  }

  try {
    const result = await api("/api/alerts");
    const items = Array.isArray(result?.items) ? result.items : [];
    const dismissedIds = getDismissedAlertIds();
    const normalized = items
      .map(normalizeAlertItem)
      .filter((entry) => !dismissedIds.has(safeText(entry.alertId)));

    normalized.sort((a, b) => {
      const at = toTimestamp(a.createdAt) ?? 0;
      const bt = toTimestamp(b.createdAt) ?? 0;
      return bt - at;
    });

    const topAlerts = normalized.slice(0, 30);
    alertsList.innerHTML = "";

    if (!topAlerts.length) {
      alertsStatus.textContent = "No alerts right now.";
      return;
    }

    topAlerts.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "alert-item";

      const severityTag = document.createElement("span");
      severityTag.className = `alert-severity ${alertSeverityClass(entry.severity)}`;
      severityTag.textContent = safeText(entry.severity || "Info");

      const title = document.createElement("h3");
      title.textContent = entry.title;

      const meta = document.createElement("div");
      meta.className = "alert-meta";
      const parts = [entry.source, formatAlertTime(entry.createdAt)].filter(Boolean);
      meta.textContent = parts.join(" • ");

      const eventTime = document.createElement("div");
      eventTime.className = "alert-meta";
      const absoluteTime = formatAbsoluteAlertTime(entry.createdAt);
      eventTime.textContent = absoluteTime ? `Event Time: ${absoluteTime}` : "";

      const machine = document.createElement("div");
      machine.className = "alert-meta";
      const machineParts = [];
      if (entry.machineName) {
        machineParts.push(`Machine: ${entry.machineName}`);
      }
      if (entry.machineId) {
        machineParts.push(`ID: ${entry.machineId}`);
      }
      machine.textContent = machineParts.join(" • ");

      const message = document.createElement("div");
      message.textContent = entry.message;

      const dismissBtn = document.createElement("button");
      dismissBtn.type = "button";
      dismissBtn.className = "alert-dismiss-btn";
      dismissBtn.textContent = "Dismiss";
      dismissBtn.disabled = !entry.remoteAlertId;
      if (!entry.remoteAlertId) {
        dismissBtn.title = "This alert does not expose a dismissible Atera ID.";
      }
      dismissBtn.addEventListener("click", async () => {
        if (!entry.remoteAlertId) {
          if (alertsStatus) {
            alertsStatus.textContent = "This alert cannot be dismissed in Atera because no AlertID was provided.";
          }
          return;
        }

        const previousLabel = dismissBtn.textContent;
        dismissBtn.disabled = true;
        dismissBtn.textContent = "Dismissing...";

        try {
          await api(`/api/alerts/${encodeURIComponent(entry.remoteAlertId)}/dismiss`, {
            method: "POST",
          });

          dismissAlert(entry.alertId);
          item.remove();
          if (!alertsList.children.length) {
            alertsStatus.textContent = "No alerts right now.";
          } else if (alertsStatus) {
            alertsStatus.textContent = "Alert dismissed in Atera.";
          }
        } catch (error) {
          dismissBtn.disabled = false;
          dismissBtn.textContent = previousLabel;
          if (alertsStatus) {
            alertsStatus.textContent = `Failed to dismiss alert in Atera: ${error.message}`;
          }
        }
      });

      const createTicketBtn = document.createElement("button");
      createTicketBtn.type = "button";
      createTicketBtn.className = "alert-create-ticket-btn";
      createTicketBtn.textContent = "Create Ticket";
      createTicketBtn.addEventListener("click", async () => {
        try {
          await createTicketDraftFromAlert(entry, createTicketBtn);
        } catch (error) {
          if (alertsStatus) {
            alertsStatus.textContent = `Failed to build ticket draft: ${safeText(error.message)}`;
          }
        }
      });

      const actions = document.createElement("div");
      actions.className = "alert-actions";
      actions.appendChild(createTicketBtn);
      actions.appendChild(dismissBtn);

      item.appendChild(severityTag);
      item.appendChild(title);
      if (meta.textContent) item.appendChild(meta);
      if (eventTime.textContent) item.appendChild(eventTime);
      if (machine.textContent) item.appendChild(machine);
      if (entry.message) item.appendChild(message);
      item.appendChild(actions);
      alertsList.appendChild(item);
    });

    alertsStatus.textContent = `Showing ${topAlerts.length} alerts.`;
  } catch (error) {
    if (!silent) {
      alertsStatus.textContent = `Failed to load alerts: ${error.message}`;
    }
  }
}

async function api(path, options = {}) {
  const method = safeText(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (isStateChangingMethod(method)) {
    const csrfToken = readCookie("ticketgal_csrf");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    method,
    headers,
  });

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
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

function setAdminPage(pageId) {
  currentAdminPage = pageId;
  adminPages.forEach((page) => page.classList.toggle("hidden", page.id !== pageId));
  navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.adminPage === pageId));
  if (pageId === "admin-page-users" && currentUser?.role === "admin") {
    loadUsers();
  }
  if (pageId === "admin-page-knowledgebase") {
    loadKBArticles("admin");
  }
}

function setUserPage(pageId) {
  currentUserPage = pageId;
  userPages.forEach((page) => page.classList.toggle("hidden", page.id !== pageId));
  userNavButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.userPage === pageId));
  if (pageId === "user-page-knowledgebase") {
    loadKBArticles("user");
  }
}

function updateUserPropertyContext() {
  const propertyName = safeText(currentUser?.property_name).trim();

  if (userPropertyNote) {
    userPropertyNote.textContent = propertyName
      ? `New tickets will be assigned to ${propertyName}.`
      : "No property is assigned to your account yet. New tickets will stay unpinned until an admin assigns one.";
  }

  if (userPropertyChip) {
    userPropertyChip.textContent = propertyName || "No property assigned";
    userPropertyChip.classList.toggle("is-unassigned", !propertyName);
  }
}

function isUserInProgressTicket(ticket) {
  if (Boolean(ticket?._queued)) {
    return true;
  }
  const normalizedStatus = safeText(ticket?.TicketStatus).trim().toLowerCase();
  return normalizedStatus === "open" || normalizedStatus === "pending" || normalizedStatus === "pending closed";
}

function getSelectedTicketStatuses(filterContainer) {
  return new Set(
    Array.from(filterContainer?.querySelectorAll("input[type='checkbox']:checked") || [])
      .map((input) => String(input.value || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeTicketSearchQuery(value) {
  return safeText(value).trim().toLowerCase();
}

function ticketMatchesAdminSearch(ticket, query) {
  if (!query) return true;

  const searchableParts = [
    safeText(ticket?._queued ? ticket?._queuedTransactionId : ticket?.TicketID),
    safeText(ticket?.TicketTitle),
    safeText(ticket?.EndUserEmail || ticket?.end_user_email),
    safeText(ticket?.CustomerName),
    safeText(ticket?.TicketStatus),
    safeText(ticket?.TicketPriority),
    safeText(ticket?.TicketType),
    htmlToReadableText(ticket?.FirstComment || ""),
  ];

  return searchableParts.some((value) => normalizeTicketSearchQuery(value).includes(query));
}

function renderTicketsFromCache() {
  const statusFilterContainer = currentUser?.role === "admin"
    ? adminStatusFilter
    : userStatusFilter;
  const selectedStatuses = getSelectedTicketStatuses(statusFilterContainer);
  const adminSearchQuery = normalizeTicketSearchQuery(adminTicketSearchInput?.value || "");

  const userFilteredTickets = currentUser?.role === "admin"
    ? []
    : cachedTickets.filter((ticket) => {
        const ticketStatus = safeText(ticket?.TicketStatus).trim().toLowerCase();
        return Boolean(ticket?._queued) || selectedStatuses.size === 0 || selectedStatuses.has(ticketStatus);
      });
  const userInProgressTickets = currentUser?.role === "admin"
    ? []
    : cachedTickets.filter((ticket) => isUserInProgressTicket(ticket));
  const adminVisibleTickets = currentUser?.role === "admin"
    ? cachedTickets.filter((ticket) => {
        const ticketStatus = safeText(ticket?.TicketStatus).trim().toLowerCase();
        const matchesStatus = Boolean(ticket?._queued) || selectedStatuses.size === 0 || selectedStatuses.has(ticketStatus);
        return matchesStatus && ticketMatchesAdminSearch(ticket, adminSearchQuery);
      })
    : [];

  userTicketsBody.innerHTML = "";
  if (userInProgressBody) {
    userInProgressBody.innerHTML = "";
  }
  adminStatusBody.innerHTML = "";

  if (currentUser?.role === "admin") {
    adminVisibleTickets.forEach((ticket) => {
      adminStatusBody.appendChild(statusManagementRow(ticket));
    });
  } else {
    userFilteredTickets.forEach((ticket) => {
      userTicketsBody.appendChild(ticketListRow(ticket, false));
    });
    if (userInProgressBody) {
      userInProgressTickets.forEach((ticket) => {
        userInProgressBody.appendChild(ticketListRow(ticket, false));
      });
    }
  }

  const pagesFetched = Number(lastTicketLoadMeta?.pagesFetched || 0);
  const pagesText = pagesFetched > 1 ? `${pagesFetched} pages` : "1 page";
  const usingCacheFallback = Boolean(lastTicketLoadMeta?.usingCacheFallback);
  const fallbackDetail = safeText(lastTicketLoadMeta?.fallbackDetail);

  if (currentUser?.role === "admin") {
    const queuedCount = adminVisibleTickets.filter((ticket) => Boolean(ticket?._queued)).length;
    if (adminVisibleTickets.length) {
      adminStatusMessage.textContent = `Loaded ${adminVisibleTickets.length} tickets from ${pagesText}.`;
    } else if (adminSearchQuery) {
      adminStatusMessage.textContent = "No tickets match the current filters.";
    } else {
      adminStatusMessage.textContent = "No tickets found.";
    }
    if (queuedCount > 0) {
      adminStatusMessage.textContent += ` ${queuedCount} queued ticket${queuedCount === 1 ? " is" : "s are"} awaiting replay.`;
    }
    if (usingCacheFallback) {
      const detail = fallbackDetail ? ` ${fallbackDetail}` : "";
      adminStatusMessage.textContent += ` Running in degraded mode using cached data.${detail}`;
    }
  } else {
    userListStatus.textContent = userFilteredTickets.length
      ? `Loaded ${userFilteredTickets.length} tickets from ${pagesText}.`
      : "No tickets match the selected statuses.";
    if (userInProgressStatus) {
      userInProgressStatus.textContent = userInProgressTickets.length
        ? `Showing ${userInProgressTickets.length} ticket${userInProgressTickets.length === 1 ? "" : "s"} still in progress.`
        : "No in-progress tickets right now.";
    }
    if (usingCacheFallback) {
      const detail = fallbackDetail ? ` ${fallbackDetail}` : "";
      userListStatus.textContent += ` Running in degraded mode using cached data.${detail}`;
      if (userInProgressStatus) {
        userInProgressStatus.textContent += ` Running in degraded mode using cached data.${detail}`;
      }
    }
  }
}

function formatUiDateTime(value) {
  const text = safeText(value).trim();
  if (!text) return "-";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? text
    : parsed.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function normalizeLockoutKeyValue(keyType, keyValue) {
  const raw = safeText(keyValue).trim();
  if (!raw) return "";
  return keyType === "email" ? raw.toLowerCase() : raw;
}

async function clearLockoutEntry(keyType, keyValue) {
  const normalizedType = safeText(keyType).trim().toLowerCase();
  const normalizedValue = normalizeLockoutKeyValue(normalizedType, keyValue);
  if (!normalizedValue) {
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = "Provide an email or IP value to clear.";
    }
    return;
  }

  try {
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = "Clearing lockout entry...";
    }
    await api("/api/admin/security/login-rate-limits/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key_type: normalizedType,
        key_value: normalizedValue,
      }),
    });
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = `Cleared ${normalizedType} lockout entry for ${normalizedValue}.`;
    }
    await loadLoginRateLimits();
  } catch (error) {
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = `Failed to clear lockout: ${error.message}`;
    }
  }
}

function openAuditLogModal() {
  if (!auditLogModal) return;
  auditLogOffset = 0;
  if (auditLogActionFilter) auditLogActionFilter.value = "";
  auditLogModal.classList.remove("hidden");
  auditLogModal.focus();
  loadAuditLog();
}

function closeAuditLogModal() {
  if (auditLogModal) auditLogModal.classList.add("hidden");
}

function openKBAccessLogModal() {
  if (!kbAccessLogModal) return;
  kbAccessLogOffset = 0;
  if (kbAccessLogSearchFilter) kbAccessLogSearchFilter.value = "";
  if (kbAccessLogResultFilter) kbAccessLogResultFilter.value = "";
  kbAccessLogModal.classList.remove("hidden");
  kbAccessLogModal.focus();
  loadKBAccessLog();
}

function closeKBAccessLogModal() {
  if (kbAccessLogModal) kbAccessLogModal.classList.add("hidden");
}

function openLoginAccessLogModal(options = {}) {
  if (!loginAccessLogModal) return;
  const search = safeText(options?.search || "").trim();
  loginAccessLogOffset = 0;
  if (loginAccessLogSearchFilter) loginAccessLogSearchFilter.value = search;
  loginAccessLogModal.classList.remove("hidden");
  loginAccessLogModal.focus();
  loadLoginAccessLog();
}

function closeLoginAccessLogModal() {
  if (loginAccessLogModal) loginAccessLogModal.classList.add("hidden");
}

function openFailedLoginLogModal(options = {}) {
  if (!failedLoginLogModal) return;
  const search = safeText(options?.search || "").trim();
  failedLoginLogOffset = 0;
  if (failedLoginLogSearchFilter) failedLoginLogSearchFilter.value = search;
  failedLoginLogModal.classList.remove("hidden");
  failedLoginLogModal.focus();
  loadFailedLoginLog();
}

function closeFailedLoginLogModal() {
  if (failedLoginLogModal) failedLoginLogModal.classList.add("hidden");
}

function formatAuditMetadata(metadata) {
  if (!metadata) return "-";
  try {
    const parsed = JSON.parse(metadata);
    const parts = Object.entries(parsed)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${key}: ${value}`);
    return parts.join("  ") || "-";
  } catch {
    return safeText(metadata) || "-";
  }
}

function buildAuditDetailStack(primaryText, secondaryText = "") {
  const wrap = document.createElement("div");
  wrap.className = "audit-detail-stack";

  const primary = document.createElement("div");
  primary.className = "audit-detail-primary";
  primary.textContent = primaryText || "-";
  wrap.appendChild(primary);

  if (secondaryText) {
    const secondary = document.createElement("div");
    secondary.className = "audit-detail-secondary";
    secondary.textContent = secondaryText;
    wrap.appendChild(secondary);
  }

  return wrap;
}

function loginAuditBadgeClass(action) {
  const normalized = safeText(action).trim().toLowerCase();
  if (normalized.includes("success")) return "audit-action-allowed";
  if (normalized.includes("locked_out")) return "audit-action-denied";
  return "audit-action-admin";
}

function escapeCsvField(value) {
  const text = safeText(value);
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildLoginAuditCsv(entries, outcome) {
  const header = ["time", "outcome", "method", "email", "ip_address", "reason", "details"];
  const rows = entries.map((entry) => [
    safeText(entry?.created_at),
    outcome,
    safeText(entry?.method),
    safeText(entry?.email),
    safeText(entry?.ip),
    safeText(entry?.reason),
    formatAuditMetadata(entry?.metadata),
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvField(value)).join(","))
    .join("\r\n");
}

function triggerCsvDownload(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllLoginAuditEntries(outcome, searchText = "") {
  const pageSize = 500;
  const entries = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      outcome,
      limit: String(pageSize),
      offset: String(offset),
    });
    if (searchText) params.set("search", searchText);

    const data = await api(`/api/admin/login-audit?${params.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    entries.push(...items);

    if (items.length < pageSize || entries.length >= Number(data?.total || 0)) {
      break;
    }
    offset += pageSize;
  }

  return entries;
}

async function exportLoginAuditCsv({ outcome, searchFilter, statusEl, buttonEl }) {
  if (currentUser?.role !== "admin") return;

  const searchText = safeText(searchFilter?.value || "").trim();
  const filenamePrefix = outcome === "success" ? "login-access-log" : "failed-login-log";
  const exportLabel = buttonEl ? buttonEl.textContent : "Export CSV";

  try {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Exporting...";
    }
    if (statusEl) {
      statusEl.textContent = "Preparing CSV export...";
    }

    const entries = await fetchAllLoginAuditEntries(outcome, searchText);
    if (!entries.length) {
      if (statusEl) {
        statusEl.textContent = "No matching login records to export.";
      }
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const csvText = buildLoginAuditCsv(entries, outcome);
    triggerCsvDownload(`${filenamePrefix}-${stamp}.csv`, csvText);
    if (statusEl) {
      statusEl.textContent = `Exported ${entries.length} login record${entries.length === 1 ? "" : "s"}.`;
    }
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = `Failed to export login audit log: ${error.message}`;
    }
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = exportLabel;
    }
  }
}

async function loadLoginAuditPage({
  outcome,
  offset,
  pageSize,
  searchFilter,
  body,
  status,
  prev,
  next,
  pageInfo,
}) {
  if (!body || currentUser?.role !== "admin") return;

  const searchText = safeText(searchFilter?.value || "").trim();
  const params = new URLSearchParams({
    outcome,
    limit: String(pageSize),
    offset: String(offset),
  });
  if (searchText) params.set("search", searchText);

  if (status) status.textContent = "Loading...";
  if (prev) prev.disabled = true;
  if (next) next.disabled = true;

  try {
    const data = await api(`/api/admin/login-audit?${params.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    const total = Number(data?.total || 0);

    body.innerHTML = "";
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "muted";
      cell.textContent = outcome === "success"
        ? "No successful login events found."
        : "No failed login events found.";
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      items.forEach((entry) => {
        const tr = document.createElement("tr");

        const tdTime = document.createElement("td");
        tdTime.className = "audit-col-time";
        tdTime.textContent = formatUiDateTime(entry?.created_at);
        tr.appendChild(tdTime);

        const tdOutcome = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `audit-action-badge ${loginAuditBadgeClass(entry?.action)}`;
        badge.textContent = outcome === "success"
          ? safeText(entry?.method) || "Successful Login"
          : safeText(entry?.action).includes("locked_out")
            ? "Locked Out"
            : "Failed Login";
        tdOutcome.appendChild(badge);
        tr.appendChild(tdOutcome);

        const tdUser = document.createElement("td");
        const userLabel = safeText(entry?.email) || "unknown";
        const userSecondary = outcome === "success"
          ? safeText(entry?.actor_email) && safeText(entry?.actor_email) !== userLabel
            ? `Actor: ${safeText(entry?.actor_email)}`
            : ""
          : safeText(entry?.method) ? `Method: ${safeText(entry?.method)}` : "";
        tdUser.appendChild(buildAuditDetailStack(userLabel, userSecondary));
        tr.appendChild(tdUser);

        const tdIp = document.createElement("td");
        tdIp.appendChild(buildAuditDetailStack(safeText(entry?.ip) || "unknown"));
        tr.appendChild(tdIp);

        const tdDetails = document.createElement("td");
        const primary = outcome === "success"
          ? (safeText(entry?.method) ? `${safeText(entry?.method)} sign-in` : "Successful sign-in")
          : (safeText(entry?.reason) || "No failure reason recorded");
        const secondary = formatAuditMetadata(entry?.metadata);
        tdDetails.appendChild(buildAuditDetailStack(primary, secondary && secondary !== "-" ? secondary : ""));
        tr.appendChild(tdDetails);

        body.appendChild(tr);
      });
    }

    const pageNum = Math.floor(offset / pageSize) + 1;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (pageInfo) pageInfo.textContent = `Page ${pageNum} of ${totalPages}  (${total} total)`;
    if (prev) prev.disabled = offset <= 0;
    if (next) next.disabled = offset + pageSize >= total;
    if (status) status.textContent = "";
  } catch (error) {
    if (status) status.textContent = `Failed to load login audit log: ${error.message}`;
  }
}

async function loadLoginAccessLog() {
  await loadLoginAuditPage({
    outcome: "success",
    offset: loginAccessLogOffset,
    pageSize: LOGIN_ACCESS_LOG_PAGE_SIZE,
    searchFilter: loginAccessLogSearchFilter,
    body: loginAccessLogBody,
    status: loginAccessLogStatus,
    prev: loginAccessLogPrev,
    next: loginAccessLogNext,
    pageInfo: loginAccessLogPageInfo,
  });
}

async function loadFailedLoginLog() {
  await loadLoginAuditPage({
    outcome: "failed",
    offset: failedLoginLogOffset,
    pageSize: FAILED_LOGIN_LOG_PAGE_SIZE,
    searchFilter: failedLoginLogSearchFilter,
    body: failedLoginLogBody,
    status: failedLoginLogStatus,
    prev: failedLoginLogPrev,
    next: failedLoginLogNext,
    pageInfo: failedLoginLogPageInfo,
  });
}

async function loadAuditLog() {
  if (!auditLogBody || currentUser?.role !== "admin") return;

  const actionFilter = safeText(auditLogActionFilter?.value || "").trim();
  const params = new URLSearchParams({
    limit: String(AUDIT_LOG_PAGE_SIZE),
    offset: String(auditLogOffset),
  });
  if (actionFilter) params.set("action", actionFilter);

  if (auditLogStatus) auditLogStatus.textContent = "Loading...";
  if (auditLogPrev) auditLogPrev.disabled = true;
  if (auditLogNext) auditLogNext.disabled = true;

  try {
    const data = await api(`/api/admin/audit-log?${params.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    const total = Number(data?.total || 0);

    auditLogBody.innerHTML = "";
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "muted";
      cell.textContent = "No audit log entries found.";
      row.appendChild(cell);
      auditLogBody.appendChild(row);
    } else {
      items.forEach((entry) => {
        const tr = document.createElement("tr");

        const tdTime = document.createElement("td");
        tdTime.className = "audit-col-time";
        tdTime.textContent = formatUiDateTime(entry?.created_at);
        tr.appendChild(tdTime);

        const tdAction = document.createElement("td");
        tdAction.className = "audit-col-action";
        const actionBadge = document.createElement("span");
        const action = safeText(entry?.action);
        actionBadge.className = `audit-action-badge audit-action-${action.split(".")[0]}`;
        actionBadge.textContent = action;
        tdAction.appendChild(actionBadge);
        tr.appendChild(tdAction);

        const tdActor = document.createElement("td");
        tdActor.textContent = safeText(entry?.actor_email) || (entry?.actor_user_id ? `#${entry.actor_user_id}` : "system");
        tr.appendChild(tdActor);

        const tdTarget = document.createElement("td");
        tdTarget.textContent = safeText(entry?.target_email) || (entry?.target_user_id ? `#${entry.target_user_id}` : "—");
        tr.appendChild(tdTarget);

        const tdMeta = document.createElement("td");
        tdMeta.className = "audit-col-meta";
        if (entry?.metadata) {
          try {
            const parsed = JSON.parse(entry.metadata);
            const parts = Object.entries(parsed)
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .map(([k, v]) => `${k}: ${v}`);
            tdMeta.textContent = parts.join("  ");
          } catch {
            tdMeta.textContent = safeText(entry.metadata);
          }
        } else {
          tdMeta.textContent = "—";
        }
        tr.appendChild(tdMeta);

        auditLogBody.appendChild(tr);
      });
    }

    const pageNum = Math.floor(auditLogOffset / AUDIT_LOG_PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE));
    if (auditLogPageInfo) auditLogPageInfo.textContent = `Page ${pageNum} of ${totalPages}  (${total} total)`;
    if (auditLogPrev) auditLogPrev.disabled = auditLogOffset <= 0;
    if (auditLogNext) auditLogNext.disabled = auditLogOffset + AUDIT_LOG_PAGE_SIZE >= total;
    if (auditLogStatus) auditLogStatus.textContent = "";
  } catch (error) {
    if (auditLogStatus) auditLogStatus.textContent = `Failed to load audit log: ${error.message}`;
  }
}

async function loadKBAccessLog() {
  if (!kbAccessLogBody || currentUser?.role !== "admin") return;

  const searchFilter = safeText(kbAccessLogSearchFilter?.value || "").trim();
  const resultFilter = safeText(kbAccessLogResultFilter?.value || "").trim();
  const params = new URLSearchParams({
    limit: String(KB_ACCESS_LOG_PAGE_SIZE),
    offset: String(kbAccessLogOffset),
  });
  if (searchFilter) params.set("search", searchFilter);
  if (resultFilter) params.set("result", resultFilter);

  if (kbAccessLogStatus) kbAccessLogStatus.textContent = "Loading...";
  if (kbAccessLogPrev) kbAccessLogPrev.disabled = true;
  if (kbAccessLogNext) kbAccessLogNext.disabled = true;

  try {
    const data = await api(`/api/admin/kb-access-log?${params.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    const total = Number(data?.total || 0);

    kbAccessLogBody.innerHTML = "";
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "muted";
      cell.textContent = "No knowledgebase access entries found.";
      row.appendChild(cell);
      kbAccessLogBody.appendChild(row);
    } else {
      items.forEach((entry) => {
        const tr = document.createElement("tr");

        const tdTime = document.createElement("td");
        tdTime.className = "audit-col-time";
        tdTime.textContent = formatUiDateTime(entry?.created_at);
        tr.appendChild(tdTime);

        const tdResult = document.createElement("td");
        tdResult.className = "audit-col-action";
        const resultBadge = document.createElement("span");
        const result = safeText(entry?.access_result) || "unknown";
        resultBadge.className = `audit-action-badge audit-action-${result}`;
        resultBadge.textContent = result;
        tdResult.appendChild(resultBadge);
        tr.appendChild(tdResult);

        const tdActor = document.createElement("td");
        tdActor.textContent = safeText(entry?.actor_email) || (entry?.actor_user_id ? `#${entry.actor_user_id}` : "unknown");
        tr.appendChild(tdActor);

        const tdArticle = document.createElement("td");
        const articleTitle = safeText(entry?.article_title).trim();
        const articleSlug = safeText(entry?.article_slug).trim();
        tdArticle.textContent = articleTitle && articleSlug
          ? `${articleTitle} (${articleSlug})`
          : articleTitle || articleSlug || (entry?.article_id ? `#${entry.article_id}` : "-");
        tr.appendChild(tdArticle);

        const tdMeta = document.createElement("td");
        tdMeta.className = "audit-col-meta";
        tdMeta.textContent = formatAuditMetadata(entry?.metadata);
        tr.appendChild(tdMeta);

        kbAccessLogBody.appendChild(tr);
      });
    }

    const pageNum = Math.floor(kbAccessLogOffset / KB_ACCESS_LOG_PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / KB_ACCESS_LOG_PAGE_SIZE));
    if (kbAccessLogPageInfo) kbAccessLogPageInfo.textContent = `Page ${pageNum} of ${totalPages}  (${total} total)`;
    if (kbAccessLogPrev) kbAccessLogPrev.disabled = kbAccessLogOffset <= 0;
    if (kbAccessLogNext) kbAccessLogNext.disabled = kbAccessLogOffset + KB_ACCESS_LOG_PAGE_SIZE >= total;
    if (kbAccessLogStatus) kbAccessLogStatus.textContent = "";
  } catch (error) {
    if (kbAccessLogStatus) kbAccessLogStatus.textContent = `Failed to load KB access log: ${error.message}`;
  }
}

async function loadLoginRateLimits() {
  if (currentUser?.role !== "admin" || !lockoutListEl) return;

  if (lockoutStatusEl) {
    lockoutStatusEl.textContent = "Loading lockout data...";
  }

  try {
    const snapshot = await api("/api/admin/security/login-rate-limits?limit=100");
    const activeLockouts = Array.isArray(snapshot?.active_lockouts) ? snapshot.active_lockouts : [];
    const recentFailures = Array.isArray(snapshot?.recent_failed_attempts) ? snapshot.recent_failed_attempts : [];

    lockoutListEl.innerHTML = "";

    const activeHeader = document.createElement("h4");
    activeHeader.textContent = `Active Lockouts (${activeLockouts.length})`;
    lockoutListEl.appendChild(activeHeader);

    if (!activeLockouts.length) {
      const emptyActive = document.createElement("p");
      emptyActive.className = "muted";
      emptyActive.textContent = "No active lockouts.";
      lockoutListEl.appendChild(emptyActive);
    } else {
      activeLockouts.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "pending-row";

        const details = document.createElement("span");
        const entryType = safeText(entry?.key_type).toUpperCase();
        const entryValue = safeText(entry?.key_value);
        const count = Number(entry?.failure_count || 0);
        const remainingSeconds = Number(entry?.seconds_until_unlock || 0);
        details.textContent = `${entryType}: ${entryValue} | Failures: ${count} | Unlocks in ${remainingSeconds}s`;

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Clear";
        clearBtn.dataset.lockoutKeyType = safeText(entry?.key_type).toLowerCase();
        clearBtn.dataset.lockoutKeyValue = entryValue;

        row.appendChild(details);
        row.appendChild(clearBtn);
        lockoutListEl.appendChild(row);
      });
    }

    const recentHeader = document.createElement("h4");
    recentHeader.textContent = `Recent Failed Attempts (${recentFailures.length})`;
    lockoutListEl.appendChild(recentHeader);

    if (!recentFailures.length) {
      const emptyRecent = document.createElement("p");
      emptyRecent.className = "muted";
      emptyRecent.textContent = "No recent failed attempts in the current window.";
      lockoutListEl.appendChild(emptyRecent);
    } else {
      recentFailures.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "pending-row";

        const details = document.createElement("span");
        const entryType = safeText(entry?.key_type).toUpperCase();
        const entryValue = safeText(entry?.key_value);
        const count = Number(entry?.failure_count || 0);
        const lockedLabel = entry?.is_locked ? "LOCKED" : "not locked";
        details.textContent = `${entryType}: ${entryValue} | Failures: ${count} | Last failed: ${formatUiDateTime(entry?.last_failed_at)} | ${lockedLabel}`;

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Clear";
        clearBtn.dataset.lockoutKeyType = safeText(entry?.key_type).toLowerCase();
        clearBtn.dataset.lockoutKeyValue = entryValue;

        row.appendChild(details);
        row.appendChild(clearBtn);
        lockoutListEl.appendChild(row);
      });
    }

    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = `Window ${snapshot?.window_minutes || 15}m, lockout ${snapshot?.lockout_minutes || 30}m. Email max ${snapshot?.max_attempts_per_email || 5}, IP max ${snapshot?.max_attempts_per_ip || 20}.`;
    }
  } catch (error) {
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = `Failed to load lockout data: ${error.message}`;
    }
    if (lockoutListEl) {
      lockoutListEl.innerHTML = "";
    }
  }
}

function closeTicketViewer() {
  if (isStandaloneTicketViewerWindow) {
    window.close();
    return;
  }
  if (!ticketViewer) return;
  ticketViewer.classList.add("hidden");
  if (ticketViewerMeta) ticketViewerMeta.innerHTML = "";
  if (ticketViewerUpdate) ticketViewerUpdate.innerHTML = "";
  if (ticketViewerUpdateStatus) ticketViewerUpdateStatus.textContent = "";
  if (ticketViewerHistory) ticketViewerHistory.innerHTML = "";
  restoreBaseDocumentTitle();
}

function closePasswordResetModal() {
  if (!passwordResetModal) return;
  passwordResetModal.classList.add("hidden");
  passwordResetInput.value = "";
  passwordResetStatus.textContent = "";
  currentResetUserId = null;
}

async function openPasswordResetModal(userId, userEmail) {
  if (!passwordResetModal) return;
  currentResetUserId = userId;
  passwordResetUserEmail.textContent = safeText(userEmail);
  passwordResetInput.value = "";
  passwordResetStatus.textContent = "";
  passwordResetModal.classList.remove("hidden");
  passwordResetInput.focus();
}

async function submitPasswordReset() {
  if (!currentResetUserId) return;
  const password = passwordResetInput.value.trim();
  if (password.length < 8) {
    passwordResetStatus.textContent = "Password must be at least 8 characters.";
    return;
  }
  
  try {
    passwordResetStatus.textContent = "Resetting password...";
    await api(`/api/admin/users/${currentResetUserId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: password }),
    });
    passwordResetStatus.textContent = "Password reset successfully!";
    setTimeout(() => {
      closePasswordResetModal();
      loadUsers();
    }, 1500);
  } catch (error) {
    passwordResetStatus.textContent = `Error: ${error.message}`;
  }
}

async function openTicketViewer(ticketId) {
  if (!ticketViewer || !ticketViewerMeta || !ticketViewerHistory) return;

  ticketViewer.classList.remove("hidden");
  ticketViewerMeta.innerHTML = "Loading ticket...";
  if (ticketViewerUpdate) ticketViewerUpdate.innerHTML = "";
  if (ticketViewerUpdateStatus) ticketViewerUpdateStatus.textContent = "";
  ticketViewerHistory.innerHTML = "";

  try {
    const result = await api(`/api/tickets/${ticketId}/history`);
    const ticket = result?.ticket || {};
    const comments = result?.comments || [];
    const pendingOps = Array.isArray(result?.pending_ops) ? result.pending_ops : [];
    const historyFromCache = Boolean(result?.degraded) || safeText(result?.history_source).toLowerCase() === "cache";

    ticketViewerMeta.innerHTML = `
      <strong>#${safeText(ticket.TicketID)} - ${safeText(ticket.TicketTitle)}</strong><br>
      Status: ${safeText(ticket.TicketStatus || "")}&nbsp;&nbsp;|&nbsp;&nbsp;
      Company: ${safeText(ticket.CustomerName || "")}&nbsp;&nbsp;|&nbsp;&nbsp;
      End User: ${safeText(ticket.EndUserEmail || "")}
    `;
    setTicketViewerDocumentTitle({
      ticketId: safeText(ticket.TicketID || ticketId),
      ticketTitle: safeText(ticket.TicketTitle),
      queued: false,
    });

    if (ticketViewerUpdate) {
      const heading = document.createElement("h3");
      heading.textContent = "Post Update";
      const controls = buildUpdateControls(ticket, currentUser?.role === "admin");
      controls.classList.add("viewer-update-form");

      ticketViewerUpdate.innerHTML = "";
      ticketViewerUpdate.appendChild(heading);
      ticketViewerUpdate.appendChild(controls);
    }

    ticketViewerHistory.innerHTML = "";

    if (!comments.length && !pendingOps.length) {
      if (historyFromCache) {
        ticketViewerHistory.innerHTML = '<div class="history-entry muted">History is temporarily unavailable from Atera. Showing cached ticket details only.</div>';
      } else {
        ticketViewerHistory.innerHTML = '<div class="history-entry muted">No ticket history found.</div>';
      }
      return;
    }

    comments.forEach((entry) => {
      const el = document.createElement("div");
      el.className = "history-entry";

      const author = document.createElement("div");
      const authorStrong = document.createElement("strong");
      authorStrong.textContent = safeText(entry.FirstName || "") || safeText(entry.Email || "Unknown");
      author.appendChild(authorStrong);
      if (entry.IsInternal) {
        author.appendChild(document.createTextNode(" (Internal)"));
      }

      const date = document.createElement("div");
      date.className = "muted";
      date.textContent = safeText(entry.Date || "");

      const comment = renderTicketCommentContent(entry.Comment || "");

      el.appendChild(author);
      el.appendChild(date);
      el.appendChild(comment);
      ticketViewerHistory.appendChild(el);
    });

    // Render any pending (queued) operations that haven't synced to Atera yet
    if (pendingOps.length > 0) {
      const fmtDate = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        return isNaN(d.getTime()) ? safeText(iso) : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
      };
      pendingOps.forEach((op) => {
        if (op._type === "comment") {
          const el = document.createElement("div");
          el.className = "history-entry history-entry-queued";
          const badge = document.createElement("div");
          badge.className = "queued-badge";
          badge.textContent = `⏳ Pending sync — queued ${fmtDate(op._createdAt)}`;
          const commentEl = renderTicketCommentContent(op.Comment || "");
          el.appendChild(badge);
          el.appendChild(commentEl);
          if (op.follow_up_status) {
            const statusNote = document.createElement("div");
            statusNote.className = "muted";
            statusNote.textContent = `Status will change to: ${safeText(op.follow_up_status)}`;
            el.appendChild(statusNote);
          }
          ticketViewerHistory.appendChild(el);
        } else if (op._type === "status_change") {
          const el = document.createElement("div");
          el.className = "history-entry history-entry-queued";
          const badge = document.createElement("div");
          badge.className = "queued-badge";
          badge.textContent = `⏳ Pending status change → "${safeText(op.new_status)}" — queued ${fmtDate(op._createdAt)}`;
          el.appendChild(badge);
          ticketViewerHistory.appendChild(el);
        }
      });
    }
  } catch (error) {
    ticketViewerMeta.innerHTML = "";
    ticketViewerHistory.innerHTML = `<div class=\"history-entry\">Failed to load history: ${safeText(error.message)}</div>`;
    restoreBaseDocumentTitle();
  }
}

async function openQueuedTicketViewer(queueId) {
  if (!ticketViewer || !ticketViewerMeta || !ticketViewerHistory) return;

  ticketViewer.classList.remove("hidden");
  ticketViewerMeta.innerHTML = "Loading queued ticket...";
  if (ticketViewerUpdate) ticketViewerUpdate.innerHTML = "";
  if (ticketViewerUpdateStatus) ticketViewerUpdateStatus.textContent = "";
  ticketViewerHistory.innerHTML = "";

  try {
    const result = await api(`/api/queued-tickets/${queueId}/history`);
    const ticket = result?.ticket || {};
    const pendingOps = Array.isArray(result?.pending_ops) ? result.pending_ops : [];

    ticketViewerMeta.innerHTML = `
      <strong>Queued Ticket - ${safeText(ticket.TicketTitle)}</strong><br>
      Status: Queued&nbsp;&nbsp;|&nbsp;&nbsp;
      Company: ${safeText(ticket.CustomerName || "")}&nbsp;&nbsp;|&nbsp;&nbsp;
      End User: ${safeText(ticket.EndUserEmail || "")}
    `;
    setTicketViewerDocumentTitle({
      queueId: safeText(queueId),
      ticketTitle: safeText(ticket.TicketTitle),
      queued: true,
    });

    if (ticketViewerUpdate && currentUser?.role === "admin") {
      const heading = document.createElement("h3");
      heading.textContent = "Queue Update";
      const controls = buildUpdateControls(ticket, true);
      controls.classList.add("viewer-update-form");

      ticketViewerUpdate.innerHTML = "";
      ticketViewerUpdate.appendChild(heading);
      ticketViewerUpdate.appendChild(controls);
    }

    ticketViewerHistory.innerHTML = "";
    if (!pendingOps.length) {
      ticketViewerHistory.innerHTML = '<div class="history-entry muted">No queued follow-up updates yet.</div>';
      return;
    }

    const fmtDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      return isNaN(d.getTime()) ? safeText(iso) : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    };

    pendingOps.forEach((op) => {
      const el = document.createElement("div");
      el.className = "history-entry history-entry-queued";
      const badge = document.createElement("div");
      badge.className = "queued-badge";
      if (op._type === "comment") {
        badge.textContent = `⏳ Queued update — ${fmtDate(op._createdAt)}`;
        el.appendChild(badge);
        el.appendChild(renderTicketCommentContent(op.Comment || ""));
        if (op.follow_up_status) {
          const statusNote = document.createElement("div");
          statusNote.className = "muted";
          statusNote.textContent = `Status will change to: ${safeText(op.follow_up_status)}`;
          el.appendChild(statusNote);
        }
      } else {
        badge.textContent = `⏳ Queued status change → "${safeText(op.new_status)}" — ${fmtDate(op._createdAt)}`;
        el.appendChild(badge);
      }
      ticketViewerHistory.appendChild(el);
    });
  } catch (error) {
    ticketViewerMeta.innerHTML = "";
    ticketViewerHistory.innerHTML = `<div class="history-entry">Failed to load queued ticket: ${safeText(error.message)}</div>`;
    restoreBaseDocumentTitle();
  }
}

function showAuth() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  if (shell) {
    shell.classList.remove("admin-mode");
    shell.classList.remove("user-mode");
  }
}

function showApp() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function setCreateFormStatusOptions(prefix, statuses) {
  const select = document.getElementById(`${prefix}ticket-status`);
  if (!select) return;
  select.innerHTML = "";
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });
}

function populatePropertySelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;

  select.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No Property";
  select.appendChild(noneOption);

  cachedProperties.forEach((property) => {
    const option = document.createElement("option");
    option.value = String(property.customer_id);
    option.textContent = safeText(property.customer_name || `Property ${property.customer_id}`);
    select.appendChild(option);
  });
}

function populatePropertySelects() {
  populatePropertySelect(adminPropertySelect);
  populatePropertySelect(adminModalPropertySelect);
}

function getCreateStatusElement(prefix, isAdmin) {
  if (!isAdmin) return userCreateStatus;
  if (prefix === "admin-modal-") return adminModalCreateStatus || adminCreateStatus;
  return adminCreateStatus;
}

function getAiAssistStatusElement(prefix, isAdmin) {
  if (!isAdmin) return userAiAssistStatus;
  if (prefix === "admin-modal-") return adminModalAiAssistStatus || adminAiAssistStatus;
  return adminAiAssistStatus;
}

function resetCreateForm(prefix, isAdmin) {
  const form = document.getElementById(`${prefix}create-ticket-form`);
  if (form instanceof HTMLFormElement) {
    form.reset();
  }

  const statusEl = getCreateStatusElement(prefix, isAdmin);
  if (statusEl) {
    statusEl.textContent = "";
  }

  const aiStatusEl = getAiAssistStatusElement(prefix, isAdmin);
  if (aiStatusEl) {
    aiStatusEl.textContent = "";
  }

  const technicianInput = document.getElementById(`${prefix}technician-id`);
  if (technicianInput instanceof HTMLInputElement) {
    technicianInput.value = "1";
  }

  if (isAdmin) {
    setCreateFormStatusOptions(prefix, ADMIN_STATUSES);
    const propertySelect = document.getElementById(`${prefix}ticket-property`);
    if (propertySelect instanceof HTMLSelectElement) {
      propertySelect.value = "";
    }
  } else {
    const emailInput = document.getElementById("end-user-email");
    if (emailInput instanceof HTMLInputElement) {
      emailInput.value = currentUser.email;
    }
    setCreateFormStatusOptions(prefix, USER_STATUSES);
  }

  const dropHint = document.getElementById(`${prefix}drop-hint`);
  if (dropHint) {
    dropHint.textContent = "Tip: drag directly from Outlook, or drop a saved .eml/.msg file.";
  }
}

function openAdminCreateTicketModal({ reset = false } = {}) {
  if (!adminCreateTicketModal) return;
  if (reset) {
    resetCreateForm("admin-modal-", true);
  }
  adminCreateTicketModal.classList.remove("hidden");
}

function closeAdminCreateTicketModal() {
  if (!adminCreateTicketModal) return;
  adminCreateTicketModal.classList.add("hidden");
}

function applyRoleView() {
  if (!currentUser) {
    showAuth();
    return;
  }

  showApp();
  const isAdmin = currentUser.role === "admin";

  if (shell) {
    shell.classList.toggle("admin-mode", isAdmin);
    shell.classList.toggle("user-mode", !isAdmin);
  }

  if (alertsFeed) {
    alertsFeed.classList.toggle("hidden", !isAdmin);
  }

  if (appView) {
    const alertsEnabledInStorage = localStorage.getItem("ticketgal.alerts_enabled") !== "false";
    const shouldShowAlerts = isAdmin && alertsEnabledInStorage;
    appView.classList.toggle("alerts-enabled", shouldShowAlerts);
    if (adminAlertsToggle) {
      adminAlertsToggle.checked = alertsEnabledInStorage;
    }
  }

  if (userAiAssistBtn) {
    userAiAssistBtn.classList.toggle("hidden", !isAdmin);
  }

  welcomeText.textContent = isAdmin
    ? `Admin view for ${currentUser.email}`
    : `User view for ${currentUser.email}`;

  userShell.classList.toggle("hidden", isAdmin);
  adminShell.classList.toggle("hidden", !isAdmin);

  const userEmail = document.getElementById("end-user-email");
  userEmail.value = currentUser.email;
  userEmail.readOnly = true;
  userEmail.classList.add("readonly");
  document.getElementById("technician-id").disabled = true;

  setCreateFormStatusOptions("", USER_STATUSES);
  setCreateFormStatusOptions("admin-", ADMIN_STATUSES);
  setCreateFormStatusOptions("admin-modal-", ADMIN_STATUSES);

  if (isAdmin) {
    setAdminPage(currentAdminPage);
  } else {
    updateUserPropertyContext();
    setUserPage(currentUserPage);
  }
}

function statusClassName(value) {
  const status = safeText(value).trim().toLowerCase();
  if (status === "open") return "status-open";
  if (status === "pending" || status === "pending closed") return "status-pending";
  if (status === "resolved") return "status-resolved";
  if (status === "closed") return "status-closed";
  return "";
}

function buildStatusReadOnlyCell(ticket) {
  const wrap = document.createElement("div");
  wrap.className = "status-wrap";

  const status = document.createElement("strong");
  status.textContent = safeText(ticket.TicketStatus || "Open");
  const statusClass = statusClassName(ticket.TicketStatus || "Open");
  if (statusClass) {
    status.classList.add(statusClass);
  }
  wrap.appendChild(status);

  if (currentUser?.role !== "admin") {
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.textContent = "Status updates require Post Update action";
    wrap.appendChild(hint);
  }

  return wrap;
}

function buildUpdateControls(ticket, isAdminTable) {
  const wrap = document.createElement("div");
  const isQueued = Boolean(ticket?._queued);

  const comment = document.createElement("textarea");
  comment.rows = 3;
  comment.placeholder = isQueued ? "Add queued update for replay" : "Add ticket update";
  comment.dataset.role = "comment-text";

  if (isAdminTable) {
    const recomposeBtn = document.createElement("button");
    recomposeBtn.type = "button";
    recomposeBtn.dataset.role = "comment-recompose";
    recomposeBtn.textContent = "Recompose";

    const recomposeStatus = document.createElement("span");
    recomposeStatus.className = "muted";
    recomposeStatus.dataset.role = "comment-recompose-status";

    recomposeBtn.addEventListener("click", async () => {
      const text = comment.value.trim();
      if (!text) {
        recomposeStatus.textContent = "Enter an update first.";
        return;
      }
      recomposeBtn.disabled = true;
      recomposeStatus.textContent = "Rewriting...";
      try {
        const aiResult = await api("/api/tickets/ai-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: text }),
        });
        const rewritten = safeText(aiResult?.description || "").trim();
        if (rewritten) {
          comment.value = rewritten.slice(0, 4000);
          const fallbackUsed = Boolean(aiResult?.fallback_used);
          const fallbackReason = safeText(aiResult?.fallback_reason || "").trim();
          if (fallbackUsed) {
            recomposeStatus.textContent = fallbackReason
              ? `Fallback rewrite applied. ${fallbackReason}`
              : "Fallback rewrite applied. Review before posting.";
          } else {
            recomposeStatus.textContent = "Rewrite applied. Review before posting.";
          }
        } else {
          recomposeStatus.textContent = "AI returned no rewrite.";
        }
      } catch (err) {
        recomposeStatus.textContent = `Recompose failed: ${safeText(err.message)}`;
      } finally {
        recomposeBtn.disabled = false;
      }
    });

    const recomposeDiv = document.createElement("div");
    recomposeDiv.className = "actions";
    recomposeDiv.appendChild(recomposeBtn);
    recomposeDiv.appendChild(recomposeStatus);
    wrap.appendChild(recomposeDiv);
  }

  const tech = document.createElement("input");
  tech.type = "number";
  tech.min = "1";
  tech.placeholder = "Technician ID (admin)";
  tech.dataset.role = "tech-id";
  tech.disabled = !isAdminTable;
  if (isAdminTable) {
    tech.value = "1";
  }

  const internalLabel = document.createElement("label");
  internalLabel.className = "checkbox-inline-label";
  const internal = document.createElement("input");
  internal.type = "checkbox";
  internal.dataset.role = "internal";
  internal.disabled = !isAdminTable;
  internalLabel.appendChild(internal);
  internalLabel.appendChild(document.createTextNode(" Internal"));

  const resolveLabel = document.createElement("label");
  resolveLabel.className = "checkbox-inline-label";
  const resolve = document.createElement("input");
  resolve.type = "checkbox";
  resolve.dataset.role = "resolve-with-update";
  resolve.disabled = isAdminTable || USER_LOCKED_CURRENT.includes((ticket.TicketStatus || "").toLowerCase());
  resolveLabel.appendChild(resolve);
  resolveLabel.appendChild(document.createTextNode(" Mark Resolved with update"));

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.dataset.role = "comment-save";
  if (isQueued) {
    saveBtn.dataset.queuedTransactionId = String(ticket._queuedTransactionId || "");
    saveBtn.textContent = "Queue Update";
  } else {
    saveBtn.dataset.ticketId = String(ticket.TicketID);
    saveBtn.textContent = "Post Update";
  }

  let companyLabel = null;
  let companySaveBtn = null;
  if (isAdminTable) {
    companyLabel = document.createElement("label");
    companyLabel.textContent = "Set company: ";

    const companySelect = document.createElement("select");
    companySelect.dataset.role = "ticket-company-select";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No Property";
    companySelect.appendChild(emptyOption);

    const selectedCompanyId = safeText(ticket.CustomerID || "").trim();
    let matchedCurrentCompany = false;
    cachedProperties.forEach((property) => {
      const option = document.createElement("option");
      option.value = String(property.customer_id);
      option.textContent = safeText(property.customer_name || `Property ${property.customer_id}`);
      option.selected = option.value === selectedCompanyId;
      if (option.selected) {
        matchedCurrentCompany = true;
      }
      companySelect.appendChild(option);
    });

    if (!matchedCurrentCompany && selectedCompanyId) {
      const currentOption = document.createElement("option");
      currentOption.value = selectedCompanyId;
      currentOption.textContent = safeText(ticket.CustomerName || `Property ${selectedCompanyId}`);
      currentOption.selected = true;
      companySelect.appendChild(currentOption);
    } else if (!selectedCompanyId) {
      companySelect.value = "";
    }

    companySaveBtn = document.createElement("button");
    companySaveBtn.type = "button";
    companySaveBtn.dataset.role = "ticket-company-save";
    if (isQueued) {
      companySaveBtn.dataset.queuedTransactionId = String(ticket._queuedTransactionId || "");
      companySaveBtn.textContent = "Queue Company";
    } else {
      companySaveBtn.dataset.ticketId = String(ticket.TicketID);
      companySaveBtn.textContent = "Save Company";
    }

    companyLabel.appendChild(companySelect);
  }

  wrap.appendChild(comment);
  wrap.appendChild(tech);
  wrap.appendChild(internalLabel);
  if (isAdminTable) {
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Set status: ";
    const statusSelect = document.createElement("select");
    statusSelect.dataset.role = "update-status-select";
    const noChangeOption = document.createElement("option");
    noChangeOption.value = "";
    noChangeOption.textContent = "— no change —";
    statusSelect.appendChild(noChangeOption);
    ADMIN_STATUSES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      opt.selected = s === (ticket.TicketStatus || "");
      statusSelect.appendChild(opt);
    });
    statusLabel.appendChild(statusSelect);
    wrap.appendChild(statusLabel);
  } else {
    wrap.appendChild(resolveLabel);
  }
  wrap.appendChild(saveBtn);
  if (companyLabel && companySaveBtn) {
    wrap.appendChild(companyLabel);
    wrap.appendChild(companySaveBtn);
  }

  return wrap;
}

function ticketListRow(ticket, isAdminTable) {
  const tr = document.createElement("tr");
  const isQueued = Boolean(ticket._queued);

  const idTd = document.createElement("td");
  idTd.textContent = isQueued ? "—" : safeText(ticket.TicketID);
  tr.appendChild(idTd);

  const titleTd = document.createElement("td");
  if (isQueued) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ticket-open-btn";
    openBtn.dataset.role = "open-queued-ticket";
    openBtn.dataset.queuedTransactionId = String(ticket._queuedTransactionId || "");
    openBtn.textContent = safeText(ticket.TicketTitle);
    const badge = document.createElement("span");
    badge.className = "queued-badge";
    badge.textContent = " ⏳ Pending sync";
    titleTd.appendChild(openBtn);
    titleTd.appendChild(badge);
  } else {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ticket-open-btn";
    openBtn.dataset.role = "open-ticket";
    openBtn.dataset.ticketId = String(ticket.TicketID);
    openBtn.textContent = safeText(ticket.TicketTitle);
    titleTd.appendChild(openBtn);
  }
  tr.appendChild(titleTd);

  const statusTd = document.createElement("td");
  if (isQueued) {
    statusTd.className = "status-queued";
    statusTd.textContent = "Queued";
  } else {
    statusTd.appendChild(buildStatusReadOnlyCell(ticket));
  }
  tr.appendChild(statusTd);

  const companyTd = document.createElement("td");
  companyTd.textContent = safeText(ticket.CustomerName || "");
  tr.appendChild(companyTd);

  const emailTd = document.createElement("td");
  emailTd.textContent = safeText(ticket.EndUserEmail || "");
  tr.appendChild(emailTd);

  const updateTd = document.createElement("td");
  if (isQueued) {
    updateTd.textContent = "—";
  } else {
    updateTd.appendChild(buildUpdateControls(ticket, isAdminTable));
  }
  tr.appendChild(updateTd);

  return tr;
}

function statusManagementRow(ticket) {
  const tr = document.createElement("tr");
  const isQueued = Boolean(ticket._queued);

  const idTd = document.createElement("td");
  idTd.textContent = isQueued ? "—" : safeText(ticket.TicketID);
  tr.appendChild(idTd);

  const titleTd = document.createElement("td");
  if (isQueued) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ticket-open-btn";
    openBtn.dataset.role = "open-queued-ticket";
    openBtn.dataset.queuedTransactionId = String(ticket._queuedTransactionId || "");
    openBtn.textContent = safeText(ticket.TicketTitle);
    const badge = document.createElement("span");
    badge.className = "queued-badge";
    badge.textContent = " ⏳ Pending sync";
    titleTd.appendChild(openBtn);
    titleTd.appendChild(badge);
  } else {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "ticket-open-btn";
    openBtn.dataset.role = "open-ticket";
    openBtn.dataset.ticketId = String(ticket.TicketID);
    openBtn.textContent = safeText(ticket.TicketTitle);
    titleTd.appendChild(openBtn);
    const descText = htmlToReadableText(ticket.FirstComment || "").trim();
    if (descText) {
      const desc = document.createElement("div");
      desc.className = "muted ticket-description-preview";
      desc.textContent = descText.length > 120 ? descText.slice(0, 120) + "…" : descText;
      titleTd.appendChild(desc);
    }
  }
  tr.appendChild(titleTd);

  const emailTd = document.createElement("td");
  emailTd.textContent = safeText(ticket.EndUserEmail || ticket.end_user_email || "");
  tr.appendChild(emailTd);

  const currentTd = document.createElement("td");
  if (isQueued) {
    currentTd.className = "status-queued";
    currentTd.textContent = "Queued";
  } else {
    const statusClass = statusClassName(ticket.TicketStatus || "Open");
    if (statusClass) {
      currentTd.classList.add(statusClass);
    }
    currentTd.textContent = safeText(ticket.TicketStatus || "Open");
  }
  tr.appendChild(currentTd);

  const detailsTd = document.createElement("td");
  detailsTd.className = "ticket-details-cell";
  const fmt = (iso) => {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? safeText(iso) : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };
  if (isQueued) {
    const queuedLine = document.createElement("div");
    queuedLine.textContent = `Queued: ${fmt(ticket._queuedCreatedAt || "")}`;
    const attLine = document.createElement("div");
    attLine.className = "muted";
    attLine.textContent = `Attempts: ${safeText(ticket._queuedAttempts || 0)}`;
    detailsTd.appendChild(queuedLine);
    detailsTd.appendChild(attLine);
  } else {
    const createdRaw = ticket.TicketCreatedDate || "";
    const updatedRaw = ticket.LastEndUserCommentTimestamp || "";
    const createdLine = document.createElement("div");
    createdLine.textContent = `Created: ${fmt(createdRaw)}`;
    const updatedLine = document.createElement("div");
    updatedLine.className = "muted";
    updatedLine.textContent = `Last activity: ${fmt(updatedRaw)}`;
    detailsTd.appendChild(createdLine);
    detailsTd.appendChild(updatedLine);
  }
  tr.appendChild(detailsTd);

  const actionTd = document.createElement("td");
  if (isQueued) {
    const select = document.createElement("select");
    select.dataset.role = "admin-status-select";
    const noChangeOption = document.createElement("option");
    noChangeOption.value = "";
    noChangeOption.textContent = "— no change —";
    noChangeOption.selected = true;
    select.appendChild(noChangeOption);
    ADMIN_STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      select.appendChild(option);
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.role = "admin-status-save";
    btn.dataset.queuedTransactionId = String(ticket._queuedTransactionId || "");
    btn.textContent = "Apply";

    actionTd.appendChild(select);
    actionTd.appendChild(btn);
  } else {
    const select = document.createElement("select");
    select.dataset.role = "admin-status-select";
    ADMIN_STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status.toLowerCase() === safeText(ticket.TicketStatus || "Open").toLowerCase();
      select.appendChild(option);
    });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.role = "admin-status-save";
    btn.dataset.ticketId = String(ticket.TicketID);
    btn.textContent = "Apply";
    actionTd.appendChild(select);
    actionTd.appendChild(btn);
  }
  tr.appendChild(actionTd);

  return tr;
}

function readCreateForm(prefix) {
  return {
    ticket_title: document.getElementById(`${prefix}ticket-title`).value.trim(),
    description: document.getElementById(`${prefix}ticket-description`).value.trim(),
    end_user_email: document.getElementById(`${prefix}end-user-email`).value.trim(),
    ticket_priority: document.getElementById(`${prefix}ticket-priority`).value,
    ticket_type: document.getElementById(`${prefix}ticket-type`).value,
    ticket_status: document.getElementById(`${prefix}ticket-status`).value,
    technician_contact_id: document.getElementById(`${prefix}technician-id`).value,
  };
}

function applyAiAssistToForm(prefix, aiResult, appendDescription = false) {
  const title = document.getElementById(`${prefix}ticket-title`);
  const description = document.getElementById(`${prefix}ticket-description`);
  const priority = document.getElementById(`${prefix}ticket-priority`);
  const type = document.getElementById(`${prefix}ticket-type`);
  let changed = false;

  if (title && aiResult.ticket_title) {
    const nextValue = safeText(aiResult.ticket_title).slice(0, 160);
    if (title.value !== nextValue) {
      title.value = nextValue;
      changed = true;
    }
  }
  if (description && aiResult.description) {
    const aiSummary = safeText(aiResult.description).slice(0, 4000);
    if (appendDescription) {
      // Append AI summary to existing fallback report
      const separator = description.value ? "\n\n" : "";
      const nextValue = (description.value + separator + aiSummary).slice(0, 4000);
      if (description.value !== nextValue) {
        description.value = nextValue;
        changed = true;
      }
    } else {
      // Replace description (original behavior)
      if (description.value !== aiSummary) {
        description.value = aiSummary;
        changed = true;
      }
    }
  }

  const allowedPriorities = ["", "Low", "Medium", "High", "Critical"];
  const priorityValue = safeText(aiResult.ticket_priority);
  if (priority instanceof HTMLSelectElement && allowedPriorities.includes(priorityValue)) {
    if (priority.value !== priorityValue) {
      priority.value = priorityValue;
      changed = true;
    }
  }

  const allowedTypes = ["", "Incident", "Problem", "Request", "Change"];
  const typeValue = safeText(aiResult.ticket_type);
  if (type instanceof HTMLSelectElement && allowedTypes.includes(typeValue)) {
    if (type.value !== typeValue) {
      type.value = typeValue;
      changed = true;
    }
  }

  return changed;
}

async function runAiAssist(prefix, isAdmin) {
  const statusEl = getAiAssistStatusElement(prefix, isAdmin);
  if (!statusEl) return;

  const descriptionEl = document.getElementById(`${prefix}ticket-description`);
  const titleEl = document.getElementById(`${prefix}ticket-title`);
  const descriptionValue = safeText(descriptionEl?.value).trim();
  const titleValue = safeText(titleEl?.value).trim();

  if (!descriptionValue) {
    statusEl.textContent = "Enter a description first.";
    return;
  }

  statusEl.textContent = "Rewriting and extracting fields...";

  try {
    const aiResult = await api("/api/tickets/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: descriptionValue,
        ticket_title: titleValue,
      }),
    });

    const changed = applyAiAssistToForm(prefix, aiResult || {});
    const fallbackUsed = Boolean(aiResult?.fallback_used);
    const fallbackReason = safeText(aiResult?.fallback_reason).trim();

    if (changed && fallbackUsed) {
      statusEl.textContent = fallbackReason
        ? `Fallback rewrite applied. ${fallbackReason}. Review before creating ticket.`
        : "Fallback rewrite applied. Review before creating ticket.";
    } else if (changed) {
      statusEl.textContent = "AI draft applied. Review before creating ticket.";
    } else if (fallbackUsed) {
      statusEl.textContent = fallbackReason
        ? `Fallback rewrite was used, but it did not change any fields. ${fallbackReason}.`
        : "Fallback rewrite was used, but it did not change any fields.";
    } else {
      statusEl.textContent = "AI draft received, but it did not change any fields.";
    }
  } catch (error) {
    statusEl.textContent = `AI assist failed: ${error.message}`;
  }
}

function applyEmlToForm(prefix, parsed) {
  const title = document.getElementById(`${prefix}ticket-title`);
  const description = document.getElementById(`${prefix}ticket-description`);
  const email = document.getElementById(`${prefix}end-user-email`);

  if (parsed.subject) title.value = parsed.subject;
  if (parsed.body) description.value = parsed.body.slice(0, 4000);
  if (currentUser?.role === "admin" && parsed.from) {
    email.value = parsed.from;
  }
}

function parseEml(text) {
  const subjectMatch = text.match(/^Subject:\s*(.*)$/im);
  const fromMatch = text.match(/^From:\s*(.*)$/im);

  const bodySplit = text.split(/\r?\n\r?\n/);
  const body = bodySplit.length > 1 ? bodySplit.slice(1).join("\n\n") : text;

  let email = "";
  if (fromMatch) {
    const bracket = fromMatch[1].match(/<([^>]+)>/);
    if (bracket) {
      email = bracket[1].trim();
    } else {
      const plain = fromMatch[1].match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      email = plain ? plain[0] : "";
    }
  }

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : "",
    from: email,
    body: body.trim(),
  };
}

function hasParsedEmailContent(parsed) {
  return Boolean(parsed?.subject || parsed?.body || parsed?.from);
}

function isLikelyBinaryText(text) {
  const value = safeText(text);
  if (!value) return false;

  const nullBytes = (value.match(/\u0000/g) || []).length;
  const replacementChars = (value.match(/�/g) || []).length;
  const controlChars = (value.match(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;

  const length = value.length;
  if (nullBytes > 0) return true;
  if (replacementChars / length > 0.02) return true;
  if (controlChars / length > 0.01) return true;

  return false;
}

function normalizeDroppedBody(text) {
  const value = safeText(text).replace(/\r\n/g, "\n");
  if (!value) return "";
  if (isLikelyBinaryText(value)) return "";

  return value
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDroppedText(text) {
  const parsed = parseEml(text);
  parsed.body = normalizeDroppedBody(parsed.body);
  if (hasParsedEmailContent(parsed)) {
    return parsed;
  }

  const normalized = safeText(text).replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { subject: "", from: "", body: "" };
  }

  const lines = normalized.split("\n");
  const subjectLine = lines.find((line) => /^subject\s*:/i.test(line));
  const fromLine = lines.find((line) => /^from\s*:/i.test(line));

  const subject = subjectLine ? subjectLine.replace(/^subject\s*:/i, "").trim() : "";
  let from = "";
  if (fromLine) {
    const maybeEmail = fromLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    from = maybeEmail ? maybeEmail[0] : "";
  }

  return {
    subject,
    from,
    body: normalizeDroppedBody(normalized),
  };
}

async function getDataTransferText(dataTransfer, type) {
  if (!dataTransfer) return "";

  const syncData = dataTransfer.getData(type);
  if (syncData) return syncData;

  const item = Array.from(dataTransfer.items || []).find(
    (candidate) => candidate.kind === "string" && safeText(candidate.type).toLowerCase() === type.toLowerCase(),
  );
  if (!item) return "";

  return new Promise((resolve) => {
    item.getAsString((value) => resolve(value || ""));
  });
}

async function parseDroppedDataTransfer(dataTransfer) {
  if (!dataTransfer) return null;

  let parsedPlain = null;
  const plain = await getDataTransferText(dataTransfer, "text/plain");
  if (plain) {
    parsedPlain = parseDroppedText(plain);
  }

  let parsedHtml = null;
  const html = await getDataTransferText(dataTransfer, "text/html");
  if (html) {
    const textBody = htmlToReadableText(html);
    parsedHtml = parseDroppedText(textBody);
    if (!hasParsedEmailContent(parsedHtml) && textBody) {
      parsedHtml = { subject: "", from: "", body: normalizeDroppedBody(textBody) };
    }
  }

  const merged = {
    subject: parsedPlain?.subject || parsedHtml?.subject || "",
    from: parsedPlain?.from || parsedHtml?.from || "",
    // Prefer html body because Outlook plain payload can contain RTF/noisy artifacts.
    body: parsedHtml?.body || parsedPlain?.body || "",
  };

  if (hasParsedEmailContent(merged)) {
    return merged;
  }

  return null;
}

async function parseDroppedFileViaApi(file) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = new Headers();
  const csrfToken = readCookie("ticketgal_csrf");
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch("/api/emails/parse-drop", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        detail = body?.detail || JSON.stringify(body);
      } else {
        detail = await response.text();
      }
    } catch {
      // Keep default detail.
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();
  return {
    subject: safeText(parsed?.subject),
    from: safeText(parsed?.from),
    body: safeText(parsed?.body),
  };
}

function bindDropZone(zone, hint, prefix) {
  if (!zone || !hint) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
    });
  });

  zone.addEventListener("drop", async (event) => {
    const files = event.dataTransfer?.files;
    let parsedFromFile = null;
    if (files && files.length > 0) {
      const file = files[0];
      const fileName = safeText(file.name).toLowerCase();

      if (fileName.endsWith(".eml") || fileName.endsWith(".msg") || file.type.startsWith("text/")) {
        try {
          parsedFromFile = await parseDroppedFileViaApi(file);
        } catch {
          parsedFromFile = null;
        }

        if (!parsedFromFile && (fileName.endsWith(".eml") || file.type.startsWith("text/"))) {
          try {
            const text = await file.text();
            parsedFromFile = parseDroppedText(text);
          } catch {
            parsedFromFile = null;
          }
        }
      }

      const parsedFromTransfer = await parseDroppedDataTransfer(event.dataTransfer);
      const merged = {
        subject: parsedFromFile?.subject || parsedFromTransfer?.subject || "",
        from: parsedFromFile?.from || parsedFromTransfer?.from || "",
        body: parsedFromTransfer?.body || parsedFromFile?.body || "",
      };

      if (hasParsedEmailContent(merged)) {
        applyEmlToForm(prefix, merged);
        hint.textContent = `Loaded ${file.name}. Review and create ticket.`;
        return;
      }
    }

    const parsedFromTransfer = await parseDroppedDataTransfer(event.dataTransfer);
    if (parsedFromTransfer && hasParsedEmailContent(parsedFromTransfer)) {
      applyEmlToForm(prefix, parsedFromTransfer);
      hint.textContent = "Loaded Outlook drop content. Review and create ticket.";
      return;
    }

    hint.textContent = "Drop an Outlook email or .eml/.msg file to auto-fill fields.";
  });
}

async function loadTickets() {
  try {
    const pageSize = 50;
    const maxPages = 200;
    const allTickets = [];
    const seenTicketIds = new Set();
    let totalItemCount = null;
    let pagesFetched = 0;
    let usingCacheFallback = false;
    let fallbackDetail = "";

    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("items_in_page", String(pageSize));

      const result = await api(`/api/tickets?${params.toString()}`);
      const items = Array.isArray(result?.items) ? result.items : [];
      pagesFetched += 1;
      if (Boolean(result?.degraded) || safeText(result?.source).toLowerCase() === "cache") {
        usingCacheFallback = true;
        fallbackDetail = safeText(result?.detail);
      }

      const maybeTotal = Number(result?.totalItemCount);
      if (Number.isFinite(maybeTotal) && maybeTotal >= 0) {
        totalItemCount = maybeTotal;
      }

      items.forEach((ticket) => {
        const isQueued = Boolean(ticket?._queued);
        const ticketId = isQueued
          ? `_queued_${safeText(ticket._queuedTransactionId)}`
          : safeText(ticket?.TicketID);
        if (!ticketId || seenTicketIds.has(ticketId)) return;
        seenTicketIds.add(ticketId);
        allTickets.push(ticket);
      });

      if (items.length < pageSize) {
        break;
      }

      if (totalItemCount !== null && allTickets.length >= totalItemCount) {
        break;
      }
    }

    if (currentUser?.role === "admin") {
      try {
        const queueResult = await api("/api/admin/queue/status?limit=100");
        const pendingCreates = Array.isArray(queueResult?.pending_create_tickets)
          ? queueResult.pending_create_tickets
          : [];

        pendingCreates.forEach((tx) => {
          const payload = tx?.payload || {};
          const ticket = {
            TicketID: null,
            TicketTitle: safeText(payload.TicketTitle || "(no title)"),
            TicketStatus: "Queued",
            EndUserEmail: safeText(payload.EndUserEmail || ""),
            CustomerName: "",
            TicketPriority: safeText(payload.TicketPriority || ""),
            TicketType: safeText(payload.TicketType || ""),
            _queued: true,
            _queuedTransactionId: Number(tx?.id || 0),
            _queuedCreatedAt: safeText(tx?.created_at || ""),
            _queuedAttempts: Number(tx?.attempts || 0),
            _queuedStatus: safeText(tx?.status || "pending"),
          };
          const syntheticId = `_queued_${safeText(ticket._queuedTransactionId)}`;
          if (!syntheticId || seenTicketIds.has(syntheticId)) {
            return;
          }
          seenTicketIds.add(syntheticId);
          allTickets.push(ticket);
        });
      } catch {
        // Keep the status page usable even if queue metadata fails to load.
      }
    }

    if (currentUser?.role === "admin") {
      allTickets.sort((left, right) => {
        const leftQueued = Boolean(left?._queued);
        const rightQueued = Boolean(right?._queued);
        if (leftQueued !== rightQueued) {
          return leftQueued ? -1 : 1;
        }
        if (leftQueued && rightQueued) {
          const leftQueuedAt = Date.parse(safeText(left?._queuedCreatedAt || "")) || 0;
          const rightQueuedAt = Date.parse(safeText(right?._queuedCreatedAt || "")) || 0;
          return rightQueuedAt - leftQueuedAt;
        }
        const leftId = Number(left?.TicketID || 0);
        const rightId = Number(right?.TicketID || 0);
        return rightId - leftId;
      });
    }

    cachedTickets = allTickets;
    lastTicketLoadMeta = {
      pagesFetched,
      usingCacheFallback,
      fallbackDetail,
    };
    renderTicketsFromCache();
  } catch (error) {
    if (currentUser?.role === "admin") {
      adminStatusMessage.textContent = `Failed to load statuses: ${error.message}`;
    } else {
      userListStatus.textContent = `Failed to load tickets: ${error.message}`;
      if (userInProgressStatus) {
        userInProgressStatus.textContent = `Failed to load tickets: ${error.message}`;
      }
    }
  }
}

async function loadUsers() {
  if (currentUser?.role !== "admin") return;

  // Clear any active search filter so newly loaded data is fully visible.
  if (userSearchInput) {
    userSearchInput.value = "";
  }

  try {
    const pending = await api("/api/admin/users?pending_only=true");
    pendingUsersEl.innerHTML = "";
    const pendingItems = (pending?.items || []).sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    if (!pendingItems.length) {
      pendingUsersEl.textContent = "No pending users.";
    } else {
      pendingItems.forEach((user) => {
        const row = document.createElement("div");
        row.className = "pending-row";
        row.innerHTML = `<span>${safeText(user.email)}</span>`;
        const approve = document.createElement("button");
        approve.type = "button";
        approve.textContent = "Approve";
        approve.addEventListener("click", async () => {
          await api(`/api/admin/users/${user.id}/approve`, { method: "POST" });
          await loadUsers();
        });
        row.appendChild(approve);
        pendingUsersEl.appendChild(row);
      });
    }

    const all = await api("/api/admin/users");
    const items = (all?.items || []).sort((a, b) => (a.email || "").localeCompare(b.email || ""));

    userManagementListEl.innerHTML = "";

    if (!items.length) {
      userManagementListEl.textContent = "No users found.";
      return;
    }

    items.forEach((user) => {
      const mgmtRow = document.createElement("div");
      mgmtRow.className = "pending-row";
      const info = document.createElement("div");
      info.className = "user-account-summary";
      const infoTitle = document.createElement("div");
      infoTitle.className = "user-account-title";
      infoTitle.textContent = `${safeText(user.email)} (${safeText(user.role)})`;
      const infoMeta = document.createElement("div");
      infoMeta.className = "user-account-meta";
      const propertyLabel = safeText(user.property_name).trim() || "No property assigned";
      const lastLoginAt = safeText(user.last_login_at).trim();
      const lastLoginIp = safeText(user.last_login_ip).trim() || "none recorded";
      const loginMethod = safeText(user.last_login_method).trim();
      const loginLabel = lastLoginAt
        ? `Last successful login: ${formatUiDateTime(lastLoginAt)}${loginMethod ? ` via ${loginMethod}` : ""}`
        : "Last successful login: none recorded";
      infoMeta.textContent = `Property: ${propertyLabel} | Last IP: ${lastLoginIp} | ${loginLabel}`;
      info.appendChild(infoTitle);
      info.appendChild(infoMeta);

      const auditActions = document.createElement("div");
      auditActions.className = "user-account-audit-actions";

      const openAccessLogBtn = document.createElement("button");
      openAccessLogBtn.type = "button";
      openAccessLogBtn.textContent = "Access Log";
      openAccessLogBtn.addEventListener("click", () => {
        openLoginAccessLogModal({ search: safeText(user.email) });
      });

      const openFailedLogBtn = document.createElement("button");
      openFailedLogBtn.type = "button";
      openFailedLogBtn.textContent = "Failed Logins";
      openFailedLogBtn.addEventListener("click", () => {
        openFailedLoginLogModal({ search: safeText(user.email) });
      });

      auditActions.appendChild(openAccessLogBtn);
      auditActions.appendChild(openFailedLogBtn);
      info.appendChild(auditActions);

      const propertySelect = document.createElement("select");
      const clearOption = document.createElement("option");
      clearOption.value = "";
      clearOption.textContent = "No Property";
      propertySelect.appendChild(clearOption);
      cachedProperties.forEach((property) => {
        const option = document.createElement("option");
        option.value = String(property.customer_id);
        option.textContent = safeText(property.customer_name || `Property ${property.customer_id}`);
        option.selected = Number(user.property_customer_id) === Number(property.customer_id);
        propertySelect.appendChild(option);
      });

      const assignPropertyBtn = document.createElement("button");
      assignPropertyBtn.type = "button";
      assignPropertyBtn.textContent = "Assign Property";
      assignPropertyBtn.addEventListener("click", async () => {
        const selected = propertySelect.value ? Number(propertySelect.value) : null;
        const selectedName = selected
          ? (cachedProperties.find((p) => Number(p.customer_id) === selected)?.customer_name || null)
          : null;

        await api(`/api/admin/users/${user.id}/property`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_customer_id: selected,
            property_name: selectedName,
          }),
        });
        await loadUsers();
      });

      const roleSelect = document.createElement("select");
      ["user", "admin"].forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        option.selected = user.role === role;
        roleSelect.appendChild(option);
      });

      const applyRoleBtn = document.createElement("button");
      applyRoleBtn.type = "button";
      applyRoleBtn.textContent = "Apply Role";
      applyRoleBtn.disabled = Number(user.id) === Number(currentUser.id);
      applyRoleBtn.addEventListener("click", async () => {
        await api(`/api/admin/users/${user.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleSelect.value }),
        });
        await loadUsers();
      });

      const resetPasswordBtn = document.createElement("button");
      resetPasswordBtn.type = "button";
      resetPasswordBtn.textContent = "Reset Password";
      resetPasswordBtn.addEventListener("click", () => {
        openPasswordResetModal(user.id, user.email);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete User";
      deleteBtn.disabled = Number(user.id) === Number(currentUser.id);
      deleteBtn.addEventListener("click", async () => {
        await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
        await loadUsers();
      });

      mgmtRow.appendChild(info);
      mgmtRow.appendChild(propertySelect);
      mgmtRow.appendChild(assignPropertyBtn);
      mgmtRow.appendChild(roleSelect);
      mgmtRow.appendChild(applyRoleBtn);
      mgmtRow.appendChild(resetPasswordBtn);
      mgmtRow.appendChild(deleteBtn);
      userManagementListEl.appendChild(mgmtRow);
    });

    await loadLoginRateLimits();
  } catch (error) {
    pendingUsersEl.textContent = `Failed: ${error.message}`;
    userManagementListEl.textContent = `Failed: ${error.message}`;
    if (lockoutStatusEl) {
      lockoutStatusEl.textContent = `Failed to load lockout data: ${error.message}`;
    }
  }
}

async function submitCreateForm(prefix, isAdmin) {
  const statusEl = getCreateStatusElement(prefix, isAdmin);
  if (!statusEl) return;
  statusEl.textContent = "Creating ticket...";

  const formData = readCreateForm(prefix);
  const payload = {
    ticket_title: formData.ticket_title,
    description: formData.description,
    end_user_email: formData.end_user_email,
    ticket_priority: formData.ticket_priority,
    ticket_type: formData.ticket_type,
    ticket_status: formData.ticket_status,
  };

  if (isAdmin && formData.technician_contact_id) {
    payload.technician_contact_id = Number(formData.technician_contact_id);
  }
  const propertySelect = isAdmin
    ? document.getElementById(`${prefix}ticket-property`)
    : null;
  if (isAdmin && propertySelect instanceof HTMLSelectElement && propertySelect.value) {
    payload.customer_id = Number(propertySelect.value);
  }

  const result = await api("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  statusEl.textContent = Boolean(result?.queued)
    ? "Atera is unavailable. Ticket create request was queued for retry."
    : "Ticket created successfully.";
  resetCreateForm(prefix, isAdmin);
  const completionMessage = Boolean(result?.queued)
    ? "Atera is unavailable. Ticket create request was queued for retry."
    : "Ticket created successfully.";
  statusEl.textContent = completionMessage;

  if (!isAdmin) {
    setUserPage("user-page-in-progress");
    if (userInProgressStatus) {
      userInProgressStatus.textContent = completionMessage;
    }
  }

  if (prefix === "admin-modal-") {
    closeAdminCreateTicketModal();
    if (adminStatusMessage) {
      adminStatusMessage.textContent = statusEl.textContent;
    }
  }
  await loadTickets();
}

async function loadProperties() {
  if (currentUser?.role !== "admin") return;
  try {
    const result = await api("/api/admin/properties");
    cachedProperties = result?.items || [];
    populatePropertySelects();
  } catch {
    cachedProperties = [];
    populatePropertySelects();
  }
}

function renderAiSummaryWithTicketLinks(container, text) {
  if (!container) return;

  const content = String(text || "");
  container.textContent = "";

  const fragment = document.createDocumentFragment();
  const ticketPattern = /#(\d+)\b/g;
  let cursor = 0;
  let match;

  while ((match = ticketPattern.exec(content)) !== null) {
    const start = match.index;
    const end = ticketPattern.lastIndex;

    if (start > cursor) {
      fragment.appendChild(document.createTextNode(content.slice(cursor, start)));
    }

    const ticketId = match[1];
    const ticketBtn = document.createElement("button");
    ticketBtn.type = "button";
    ticketBtn.className = "ai-ticket-link";
    ticketBtn.dataset.ticketId = ticketId;
    ticketBtn.textContent = `#${ticketId}`;
    fragment.appendChild(ticketBtn);

    cursor = end;
  }

  if (cursor < content.length) {
    fragment.appendChild(document.createTextNode(content.slice(cursor)));
  }

  container.appendChild(fragment);
}

async function loadReport(period, customStart = null, customEnd = null) {
  const requestId = ++reportRequestSeq;
  const loading = document.getElementById("report-loading");
  const statsEl = document.getElementById("report-stats");
  const customerSection = document.getElementById("report-customer-section");
  const aiSection = document.getElementById("report-ai-section");
  const customerBody = document.getElementById("report-customer-body");
  const aiSummaryEl = document.getElementById("report-ai-summary");
  const aiLoadingEl = document.getElementById("report-ai-loading");
  const customControls = document.getElementById("report-custom-controls");

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });

  if (customControls) {
    customControls.classList.toggle("hidden", period !== "custom");
  }

  if (loading) loading.classList.remove("hidden");
  if (statsEl) statsEl.classList.add("hidden");
  if (customerSection) customerSection.classList.add("hidden");
  if (aiSection) aiSection.classList.add("hidden");
  if (aiLoadingEl) aiLoadingEl.classList.add("hidden");

  try {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("include_ai", "0");
    if (period === "custom") {
      if (!customStart || !customEnd) {
        throw new Error("Select both start and end dates for custom range.");
      }
      params.set("custom_start", customStart);
      params.set("custom_end", customEnd);
    }

    const result = await api(`/api/reports/summary?${params.toString()}`);
    if (requestId !== reportRequestSeq) {
      return;
    }

    const openedEl = document.getElementById("report-opened-count");
    const resolvedEl = document.getElementById("report-resolved-count");
    const openEl = document.getElementById("report-open-count");
    const pendingEl = document.getElementById("report-pending-count");
    if (openedEl) openedEl.textContent = String(result.opened_count ?? "\u2014");
    if (resolvedEl) resolvedEl.textContent = String(result.resolved_count ?? "\u2014");
    if (openEl) openEl.textContent = String(result.currently_open_count ?? "\u2014");
    if (pendingEl) pendingEl.textContent = String(result.currently_pending_count ?? "\u2014");
    if (statsEl) statsEl.classList.remove("hidden");

    if (customerBody) {
      customerBody.innerHTML = "";
      const customers = Array.isArray(result.by_customer) ? result.by_customer : [];
      customers.forEach((row) => {
        const tr = document.createElement("tr");
        const nameTd = document.createElement("td");
        nameTd.textContent = safeText(row.customer_name);
        const openedTd = document.createElement("td");
        openedTd.textContent = String(row.opened ?? 0);
        const resolvedTd = document.createElement("td");
        resolvedTd.textContent = String(row.resolved ?? 0);
        const pendingTd = document.createElement("td");
        pendingTd.textContent = String(row.pending ?? 0);
        tr.appendChild(nameTd);
        tr.appendChild(openedTd);
        tr.appendChild(resolvedTd);
        tr.appendChild(pendingTd);
        customerBody.appendChild(tr);
      });
      if (customers.length > 0 && customerSection) customerSection.classList.remove("hidden");
    }

    if (aiSummaryEl && aiSection) {
      aiSummaryEl.className = "report-ai-summary";
      aiSummaryEl.textContent = "";
      aiSection.classList.remove("hidden");
    }
    if (aiLoadingEl) {
      aiLoadingEl.classList.remove("hidden");
    }

    reportLoadedPeriod = period === "custom"
      ? `custom:${customStart || ""}:${customEnd || ""}`
      : period;

    // Fetch AI analysis separately so core report stats render immediately.
    const aiParams = new URLSearchParams(params);
    aiParams.set("include_ai", "1");
    try {
      const aiResult = await api(`/api/reports/summary?${aiParams.toString()}`);
      if (requestId !== reportRequestSeq) {
        return;
      }

      if (aiSummaryEl && aiSection) {
        const pendingText = safeText(aiResult.pending_appendix || "")
          .replace(/^Pending watchlist \(net-neutral\):\s*/i, "")
          .trim();

        if (aiResult.ai_error) {
          aiSummaryEl.className = "report-ai-error";
          renderAiSummaryWithTicketLinks(aiSummaryEl, pendingText
            ? `AI service unavailable\n\nPending Watchlist (Net-Neutral)\n${pendingText}`
            : safeText(aiResult.ai_error));
        } else {
          const sections = [];
          if (aiResult.ai_summary) {
            sections.push(`Summary\n${safeText(aiResult.ai_summary).trim()}`);
          }
          if (aiResult.open_request_context) {
            sections.push(`Open Ticket Summary\n${safeText(aiResult.open_request_context).trim()}`);
          }
          if (aiResult.pending_request_context) {
            sections.push(`Pending Ticket Breakdown\n${safeText(aiResult.pending_request_context).trim()}`);
          }
          if (aiResult.resolved_request_context) {
            sections.push(`Resolved / Closed Highlights\n${safeText(aiResult.resolved_request_context).trim()}`);
          }
          if (pendingText) {
            sections.push(`Pending Watchlist (Net-Neutral)\n${pendingText}`);
          }
          aiSummaryEl.className = "report-ai-summary";
          renderAiSummaryWithTicketLinks(aiSummaryEl, sections.length
            ? sections.join("\n\n")
            : "No AI summary available.");
        }
        aiSection.classList.remove("hidden");
      }
    } catch (error) {
      if (requestId !== reportRequestSeq) {
        return;
      }
      if (aiSummaryEl && aiSection) {
        aiSummaryEl.className = "report-ai-error";
        renderAiSummaryWithTicketLinks(aiSummaryEl, `AI summary unavailable: ${error.message}`);
        aiSection.classList.remove("hidden");
      }
    } finally {
      if (requestId === reportRequestSeq && aiLoadingEl) {
        aiLoadingEl.classList.add("hidden");
      }
    }
  } catch (error) {
    if (statsEl) {
      statsEl.classList.remove("hidden");
      const openedEl = document.getElementById("report-opened-count");
      if (openedEl) openedEl.textContent = "Error";
    }
    if (aiLoadingEl) {
      aiLoadingEl.classList.add("hidden");
    }
  } finally {
    if (loading) loading.classList.add("hidden");
  }
}

async function syncTicketsFromAtera() {
  if (!adminSyncTicketsBtn) return;

  adminSyncTicketsBtn.disabled = true;
  if (adminSyncTicketsStatus) {
    adminSyncTicketsStatus.textContent = "Syncing tickets from Atera...";
  }

  try {
    const result = await api("/api/admin/sync-tickets-from-atera", {
      method: "POST",
    });
    const syncedCount = Number(result?.ticket_count || 0);
    if (adminSyncTicketsStatus) {
      adminSyncTicketsStatus.textContent = `Sync complete. ${syncedCount} tickets synced.`;
    }

    if (reportLoadedPeriod) {
      if (reportLoadedPeriod.startsWith("custom:")) {
        const [, customStart = "", customEnd = ""] = reportLoadedPeriod.split(":");
        if (customStart && customEnd) {
          await loadReport("custom", customStart, customEnd);
        }
      } else {
        await loadReport(reportLoadedPeriod);
      }
    }
  } catch (error) {
    if (adminSyncTicketsStatus) {
      adminSyncTicketsStatus.textContent = `Sync failed: ${error.message}`;
    }
  } finally {
    adminSyncTicketsBtn.disabled = false;
  }
}

async function rescanKnowledgebaseFromDisk() {
  if (!adminRescanKbBtn) return;

  adminRescanKbBtn.disabled = true;
  if (adminRescanKbStatus) {
    adminRescanKbStatus.textContent = "Rescanning knowledgebase markdown files...";
  }

  try {
    const result = await api("/api/admin/rescan-knowledgebase", {
      method: "POST",
    });

    const scanned = Number(result?.scanned_files || 0);
    const inserted = Number(result?.inserted || 0);
    const updated = Number(result?.updated || 0);
    const reactivated = Number(result?.reactivated || 0);
    const deactivated = Number(result?.deactivated || 0);
    const skippedCompanyAssigned = Number(result?.skipped_company_assigned_without_customer_id || 0);
    const skippedDuplicateSlug = Number(result?.skipped_duplicate_slug || 0);

    if (adminRescanKbStatus) {
      adminRescanKbStatus.textContent =
        `KB rescan complete. Scanned ${scanned}. Added ${inserted}, updated ${updated}, reactivated ${reactivated}, deactivated ${deactivated}.`
        + (skippedCompanyAssigned > 0
          ? ` Skipped ${skippedCompanyAssigned} company-assigned files without customer ID metadata.`
          : "")
        + (skippedDuplicateSlug > 0
          ? ` Skipped ${skippedDuplicateSlug} files because their slugs conflicted with another scanned file.`
          : "");
    }

    if (currentUser?.role === "admin") {
      await loadKBArticles("admin");
    }
  } catch (error) {
    if (adminRescanKbStatus) {
      adminRescanKbStatus.textContent = `KB rescan failed: ${error.message}`;
    }
  } finally {
    adminRescanKbBtn.disabled = false;
  }
}

async function postUpdateFromRow(row, ticketId, isAdmin, statusTarget = null) {
  const comment = row.querySelector("[data-role='comment-text']");
  const techId = row.querySelector("[data-role='tech-id']");
  const internal = row.querySelector("[data-role='internal']");
  const resolve = row.querySelector("[data-role='resolve-with-update']");

  if (!(comment instanceof HTMLTextAreaElement) || !(techId instanceof HTMLInputElement) || !(internal instanceof HTMLInputElement)) {
    return;
  }

  const payload = {
    comment_text: comment.value.trim(),
    is_internal: internal.checked,
  };

  if (isAdmin && techId.value) {
    payload.technician_id = Number(techId.value);
  }

  if (isAdmin) {
    const statusSelect = row.querySelector("[data-role='update-status-select']");
    if (statusSelect instanceof HTMLSelectElement && statusSelect.value) {
      payload.ticket_status = statusSelect.value;
    }
  }

  if (!isAdmin && resolve instanceof HTMLInputElement) {
    payload.mark_resolved = resolve.checked;
  }

  const saveBtn = row.querySelector("[data-role='comment-save']");
  const queuedTransactionId = saveBtn instanceof HTMLElement ? safeText(saveBtn.dataset.queuedTransactionId || "") : "";

  const result = await api(
    queuedTransactionId
      ? `/api/queued-tickets/${queuedTransactionId}/updates`
      : `/api/tickets/${ticketId}/updates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const wasQueued = Boolean(result?.queued);

  if (isAdmin) {
    if (statusTarget) {
      statusTarget.textContent = wasQueued
        ? queuedTransactionId
          ? `Update for queued ticket ${queuedTransactionId} was stored for replay.`
          : `Update for ticket ${ticketId} was queued and will sync when Atera recovers.`
        : `Posted update for ticket ${ticketId}.`;
    } else if (adminStatusMessage) {
      adminStatusMessage.textContent = wasQueued
        ? queuedTransactionId
          ? `Update for queued ticket ${queuedTransactionId} was stored for replay.`
          : `Update for ticket ${ticketId} was queued and will sync when Atera recovers.`
        : `Posted update for ticket ${ticketId}.`;
    }
  } else {
    const text = wasQueued
      ? `Update for ticket ${ticketId} was queued and will sync when Atera recovers.`
      : payload.mark_resolved
        ? `Posted update and marked ticket ${ticketId} as Resolved.`
        : `Posted update for ticket ${ticketId}.`;
    if (statusTarget) {
      statusTarget.textContent = text;
    } else {
      userListStatus.textContent = text;
    }
  }

  comment.value = "";
  if (resolve instanceof HTMLInputElement) {
    resolve.checked = false;
  }

  await loadTickets();
}

async function saveTicketCompanyFromRow(row, ticketId, statusTarget = null) {
  const companySelect = row.querySelector("[data-role='ticket-company-select']");
  const saveBtn = row.querySelector("[data-role='ticket-company-save']");
  if (!(companySelect instanceof HTMLSelectElement) || !(saveBtn instanceof HTMLElement)) {
    return;
  }

  const queuedTransactionId = safeText(saveBtn.dataset.queuedTransactionId || "");
  const endpoint = queuedTransactionId
    ? `/api/queued-tickets/${queuedTransactionId}/company`
    : `/api/tickets/${ticketId}/company`;

  const result = await api(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: companySelect.value ? Number(companySelect.value) : null,
    }),
  });

  const message = queuedTransactionId
    ? `Company change for queued ticket ${queuedTransactionId} was stored for replay.`
    : `Updated company for ticket ${ticketId}.`;

  if (statusTarget) {
    statusTarget.textContent = message;
  } else if (adminStatusMessage) {
    adminStatusMessage.textContent = message;
  }

  await loadTickets();

  if (queuedTransactionId) {
    await openQueuedTicketViewer(queuedTransactionId);
  } else {
    await openTicketViewer(ticketId);
  }

  return result;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!userPasswordAuthEnabled) {
    loginStatus.textContent = "Use Sign in with Microsoft 365.";
    return;
  }

  loginStatus.textContent = "Signing in...";

  try {
    await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value,
      }),
    });
    loginStatus.textContent = "Login successful.";
    await refreshMe();
  } catch (error) {
    loginStatus.textContent = `Login failed: ${error.message}`;
  }
});

if (microsoftLoginBtn) {
  microsoftLoginBtn.addEventListener("click", () => {
    loginStatus.textContent = "Redirecting to Microsoft 365...";
    window.location.assign("/auth/microsoft/login");
  });
}


logoutBtn.addEventListener("click", async () => {
  await api("/auth/logout", { method: "POST" });
  window.location.assign("/login");
});

userCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitCreateForm("", false);
  } catch (error) {
    userCreateStatus.textContent = `Failed to create ticket: ${error.message}`;
  }
});

adminCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitCreateForm("admin-", true);
  } catch (error) {
    adminCreateStatus.textContent = `Failed to create ticket: ${error.message}`;
  }
});

if (adminModalCreateForm) {
  adminModalCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await submitCreateForm("admin-modal-", true);
    } catch (error) {
      if (adminModalCreateStatus) {
        adminModalCreateStatus.textContent = `Failed to create ticket: ${error.message}`;
      }
    }
  });
}

if (userAiAssistBtn) {
  userAiAssistBtn.addEventListener("click", async () => {
    if (currentUser?.role !== "admin") {
      return;
    }
    await runAiAssist("", false);
  });
}

if (adminAiAssistBtn) {
  adminAiAssistBtn.addEventListener("click", async () => {
    await runAiAssist("admin-", true);
  });
}

if (adminModalAiAssistBtn) {
  adminModalAiAssistBtn.addEventListener("click", async () => {
    await runAiAssist("admin-modal-", true);
  });
}

userRefreshBtn.addEventListener("click", loadTickets);
if (userInProgressRefreshBtn) {
  userInProgressRefreshBtn.addEventListener("click", loadTickets);
}
if (adminStatusRefreshBtn) {
  adminStatusRefreshBtn.addEventListener("click", async () => {
    await Promise.all([loadTickets(), loadAlerts()]);
  });
}
if (adminStatusCreateBtn) {
  adminStatusCreateBtn.addEventListener("click", () => {
    openAdminCreateTicketModal({ reset: true });
  });
}
refreshUsersBtn.addEventListener("click", loadUsers);
if (refreshLockoutsBtn) {
  refreshLockoutsBtn.addEventListener("click", () => loadLoginRateLimits());
}
if (clearLockoutBtn) {
  clearLockoutBtn.addEventListener("click", async () => {
    const keyType = safeText(lockoutKeyTypeEl?.value || "email").toLowerCase();
    const keyValue = safeText(lockoutKeyValueEl?.value || "");
    await clearLockoutEntry(keyType, keyValue);
  });
}
if (lockoutListEl) {
  lockoutListEl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button[data-lockout-key-type][data-lockout-key-value]");
    if (!(button instanceof HTMLButtonElement)) return;
    const keyType = safeText(button.dataset.lockoutKeyType || "").toLowerCase();
    const keyValue = safeText(button.dataset.lockoutKeyValue || "");
    await clearLockoutEntry(keyType, keyValue);
  });
}
if (alertsRefreshBtn) {
  alertsRefreshBtn.addEventListener("click", () => loadAlerts());
}
const reportAiSummaryEl = document.getElementById("report-ai-summary");
if (reportAiSummaryEl) {
  reportAiSummaryEl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const linkBtn = target.closest(".ai-ticket-link");
    if (!(linkBtn instanceof HTMLButtonElement)) return;

    const ticketId = Number(linkBtn.dataset.ticketId || 0);
    if (!Number.isFinite(ticketId) || ticketId <= 0) return;

    await openTicketViewerByPreference(ticketId);
  });
}
if (adminSyncTicketsBtn) {
  adminSyncTicketsBtn.addEventListener("click", syncTicketsFromAtera);
}
if (adminRescanKbBtn) {
  adminRescanKbBtn.addEventListener("click", rescanKnowledgebaseFromDisk);
}

if (userStatusFilter) {
  userStatusFilter.addEventListener("change", renderTicketsFromCache);
}
if (adminStatusFilter) {
  adminStatusFilter.addEventListener("change", renderTicketsFromCache);
}
if (adminTicketSearchInput) {
  adminTicketSearchInput.addEventListener("input", renderTicketsFromCache);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.adminPage) {
      setAdminPage(button.dataset.adminPage);
    }
  });
});

userNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.userPage) {
      setUserPage(button.dataset.userPage);
    }
  });
});

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const period = btn.dataset.period;
    if (period === "custom") {
      const customControls = document.getElementById("report-custom-controls");
      if (customControls) customControls.classList.remove("hidden");
      return;
    }
    loadReport(period);
  });
});

const reportCustomRunBtn = document.getElementById("report-custom-run");
if (reportCustomRunBtn) {
  reportCustomRunBtn.addEventListener("click", () => {
    const startInput = document.getElementById("report-custom-start");
    const endInput = document.getElementById("report-custom-end");
    const customStart = startInput instanceof HTMLInputElement ? startInput.value : "";
    const customEnd = endInput instanceof HTMLInputElement ? endInput.value : "";
    loadReport("custom", customStart, customEnd);
  });
}

userTicketsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const openBtn = target.closest("[data-role='open-ticket']");
  if (openBtn instanceof HTMLElement) {
    const ticketId = openBtn.dataset.ticketId;
    if (ticketId) {
      await openTicketViewerByPreference(ticketId);
    }
    return;
  }

  const openQueuedBtn = target.closest("[data-role='open-queued-ticket']");
  if (openQueuedBtn instanceof HTMLElement) {
    const queueId = openQueuedBtn.dataset.queuedTransactionId;
    if (queueId) {
      await openQueuedTicketViewerByPreference(queueId);
    }
    return;
  }

  const commentSaveBtn = target.closest("[data-role='comment-save']");
  if (commentSaveBtn instanceof HTMLElement) {
    const row = commentSaveBtn.closest("tr");
    const ticketId = commentSaveBtn.dataset.ticketId;
    const queueId = commentSaveBtn.dataset.queuedTransactionId;
    if (!row || (!ticketId && !queueId)) return;

    try {
      await postUpdateFromRow(row, ticketId || "", false);
    } catch (error) {
      userListStatus.textContent = `Update failed: ${error.message}`;
    }
  }
});

if (userInProgressBody) {
  userInProgressBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const openBtn = target.closest("[data-role='open-ticket']");
    if (openBtn instanceof HTMLElement) {
      const ticketId = openBtn.dataset.ticketId;
      if (ticketId) {
        await openTicketViewerByPreference(ticketId);
      }
      return;
    }

    const openQueuedBtn = target.closest("[data-role='open-queued-ticket']");
    if (openQueuedBtn instanceof HTMLElement) {
      const queueId = openQueuedBtn.dataset.queuedTransactionId;
      if (queueId) {
        await openQueuedTicketViewerByPreference(queueId);
      }
      return;
    }

    const commentSaveBtn = target.closest("[data-role='comment-save']");
    if (commentSaveBtn instanceof HTMLElement) {
      const row = commentSaveBtn.closest("tr");
      const ticketId = commentSaveBtn.dataset.ticketId;
      const queueId = commentSaveBtn.dataset.queuedTransactionId;
      if (!row || (!ticketId && !queueId)) return;

      try {
        await postUpdateFromRow(row, ticketId || "", false, userInProgressStatus);
      } catch (error) {
        if (userInProgressStatus) {
          userInProgressStatus.textContent = `Update failed: ${error.message}`;
        }
      }
    }
  });
}

adminStatusBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const openBtn = target.closest("[data-role='open-ticket']");
  if (openBtn instanceof HTMLElement) {
    const ticketId = openBtn.dataset.ticketId;
    if (ticketId) {
      await openTicketViewerByPreference(ticketId);
    }
    return;
  }

  const openQueuedBtn = target.closest("[data-role='open-queued-ticket']");
  if (openQueuedBtn instanceof HTMLElement) {
    const queueId = openQueuedBtn.dataset.queuedTransactionId;
    if (queueId) {
      await openQueuedTicketViewerByPreference(queueId);
    }
    return;
  }

  const saveBtn = target.closest("[data-role='admin-status-save']");
  if (saveBtn instanceof HTMLElement) {
    const row = saveBtn.closest("tr");
    const ticketId = saveBtn.dataset.ticketId;
    const queuedTransactionId = saveBtn.dataset.queuedTransactionId;
    const select = row?.querySelector("[data-role='admin-status-select']");
    if ((!ticketId && !queuedTransactionId) || !(select instanceof HTMLSelectElement) || !select.value) return;

    try {
      const result = await api(
        queuedTransactionId
          ? `/api/queued-tickets/${queuedTransactionId}/status`
          : `/api/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket_status: select.value }),
        }
      );
      adminStatusMessage.textContent = queuedTransactionId
        ? `Status change for queued ticket ${queuedTransactionId} was stored for replay.`
        : Boolean(result?.queued)
          ? `Status change for ticket ${ticketId} was queued and will sync when Atera recovers.`
          : `Updated status for ticket ${ticketId}.`;
      await loadTickets();
    } catch (error) {
      adminStatusMessage.textContent = `Status update failed: ${error.message}`;
    }
  }
});

if (ticketViewer) {
  ticketViewer.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const companySaveBtn = target.closest("[data-role='ticket-company-save']");
    if (companySaveBtn instanceof HTMLElement) {
      const row = companySaveBtn.closest(".viewer-update-form");
      const ticketId = companySaveBtn.dataset.ticketId;
      const queuedTransactionId = companySaveBtn.dataset.queuedTransactionId;
      if (!row || (!ticketId && !queuedTransactionId)) return;

      try {
        await saveTicketCompanyFromRow(row, ticketId || "", ticketViewerUpdateStatus);
      } catch (error) {
        if (ticketViewerUpdateStatus) {
          ticketViewerUpdateStatus.textContent = `Company update failed: ${error.message}`;
        }
      }
      return;
    }

    const saveBtn = target.closest("[data-role='comment-save']");
    if (!(saveBtn instanceof HTMLElement)) return;

    const row = saveBtn.closest(".viewer-update-form");
    const ticketId = saveBtn.dataset.ticketId;
    const queuedTransactionId = saveBtn.dataset.queuedTransactionId;
    if (!row || (!ticketId && !queuedTransactionId)) return;

    try {
      await postUpdateFromRow(row, ticketId || "", currentUser?.role === "admin", ticketViewerUpdateStatus);
      if (queuedTransactionId) {
        await openQueuedTicketViewer(queuedTransactionId);
      } else {
        await openTicketViewer(ticketId);
      }
    } catch (error) {
      if (ticketViewerUpdateStatus) {
        ticketViewerUpdateStatus.textContent = `Update failed: ${error.message}`;
      }
    }
  });
}

bindDropZone(userDropZone, userDropHint, "");
bindDropZone(adminDropZone, adminDropHint, "admin-");
bindDropZone(adminModalDropZone, adminModalDropHint, "admin-modal-");

if (ticketViewerClose) {
  ticketViewerClose.addEventListener("click", closeTicketViewer);
}
if (ticketViewer) {
  ticketViewer.addEventListener("click", (event) => {
    if (event.target === ticketViewer) {
      closeTicketViewer();
    }
  });
}

if (adminCreateTicketModalClose) {
  adminCreateTicketModalClose.addEventListener("click", closeAdminCreateTicketModal);
}
if (adminCreateTicketModal) {
  adminCreateTicketModal.addEventListener("click", (event) => {
    if (event.target === adminCreateTicketModal) {
      closeAdminCreateTicketModal();
    }
  });
}

// Password reset modal handlers
if (passwordResetClose) {
  passwordResetClose.addEventListener("click", closePasswordResetModal);
}
if (passwordResetModal) {
  passwordResetModal.addEventListener("click", (event) => {
    if (event.target === passwordResetModal) {
      closePasswordResetModal();
    }
  });
}
if (passwordResetSubmit) {
  passwordResetSubmit.addEventListener("click", submitPasswordReset);
}
if (passwordResetInput) {
  passwordResetInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      submitPasswordReset();
    }
  });
}

const openAuditLogBtn = document.getElementById("open-audit-log-btn");
const openLoginAccessLogBtn = document.getElementById("open-login-access-log-btn");
const openFailedLoginLogBtn = document.getElementById("open-failed-login-log-btn");
const openKBAccessLogBtn = document.getElementById("open-kb-access-log-btn");
if (openAuditLogBtn) {
  openAuditLogBtn.addEventListener("click", openAuditLogModal);
}
if (openLoginAccessLogBtn) {
  openLoginAccessLogBtn.addEventListener("click", () => openLoginAccessLogModal());
}
if (openFailedLoginLogBtn) {
  openFailedLoginLogBtn.addEventListener("click", () => openFailedLoginLogModal());
}
if (openKBAccessLogBtn) {
  openKBAccessLogBtn.addEventListener("click", openKBAccessLogModal);
}
if (auditLogClose) {
  auditLogClose.addEventListener("click", closeAuditLogModal);
}
if (auditLogModal) {
  auditLogModal.addEventListener("click", (event) => {
    if (event.target === auditLogModal) closeAuditLogModal();
  });
}
if (auditLogFilterBtn) {
  auditLogFilterBtn.addEventListener("click", () => {
    auditLogOffset = 0;
    loadAuditLog();
  });
}
if (auditLogResetBtn) {
  auditLogResetBtn.addEventListener("click", () => {
    if (auditLogActionFilter) auditLogActionFilter.value = "";
    auditLogOffset = 0;
    loadAuditLog();
  });
}
if (auditLogActionFilter) {
  auditLogActionFilter.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      auditLogOffset = 0;
      loadAuditLog();
    }
  });
}
if (auditLogPrev) {
  auditLogPrev.addEventListener("click", () => {
    auditLogOffset = Math.max(0, auditLogOffset - AUDIT_LOG_PAGE_SIZE);
    loadAuditLog();
  });
}
if (auditLogNext) {
  auditLogNext.addEventListener("click", () => {
    auditLogOffset += AUDIT_LOG_PAGE_SIZE;
    loadAuditLog();
  });
}
if (kbAccessLogClose) {
  kbAccessLogClose.addEventListener("click", closeKBAccessLogModal);
}
if (kbAccessLogModal) {
  kbAccessLogModal.addEventListener("click", (event) => {
    if (event.target === kbAccessLogModal) closeKBAccessLogModal();
  });
}
if (kbAccessLogFilterBtn) {
  kbAccessLogFilterBtn.addEventListener("click", () => {
    kbAccessLogOffset = 0;
    loadKBAccessLog();
  });
}
if (kbAccessLogResetBtn) {
  kbAccessLogResetBtn.addEventListener("click", () => {
    if (kbAccessLogSearchFilter) kbAccessLogSearchFilter.value = "";
    if (kbAccessLogResultFilter) kbAccessLogResultFilter.value = "";
    kbAccessLogOffset = 0;
    loadKBAccessLog();
  });
}
if (kbAccessLogSearchFilter) {
  kbAccessLogSearchFilter.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      kbAccessLogOffset = 0;
      loadKBAccessLog();
    }
  });
}
if (kbAccessLogResultFilter) {
  kbAccessLogResultFilter.addEventListener("change", () => {
    kbAccessLogOffset = 0;
    loadKBAccessLog();
  });
}
if (kbAccessLogPrev) {
  kbAccessLogPrev.addEventListener("click", () => {
    kbAccessLogOffset = Math.max(0, kbAccessLogOffset - KB_ACCESS_LOG_PAGE_SIZE);
    loadKBAccessLog();
  });
}
if (kbAccessLogNext) {
  kbAccessLogNext.addEventListener("click", () => {
    kbAccessLogOffset += KB_ACCESS_LOG_PAGE_SIZE;
    loadKBAccessLog();
  });
}
if (loginAccessLogClose) {
  loginAccessLogClose.addEventListener("click", closeLoginAccessLogModal);
}
if (loginAccessLogModal) {
  loginAccessLogModal.addEventListener("click", (event) => {
    if (event.target === loginAccessLogModal) closeLoginAccessLogModal();
  });
}
if (loginAccessLogFilterBtn) {
  loginAccessLogFilterBtn.addEventListener("click", () => {
    loginAccessLogOffset = 0;
    loadLoginAccessLog();
  });
}
if (loginAccessLogResetBtn) {
  loginAccessLogResetBtn.addEventListener("click", () => {
    if (loginAccessLogSearchFilter) loginAccessLogSearchFilter.value = "";
    loginAccessLogOffset = 0;
    loadLoginAccessLog();
  });
}
if (loginAccessLogExportBtn) {
  loginAccessLogExportBtn.addEventListener("click", async () => {
    await exportLoginAuditCsv({
      outcome: "success",
      searchFilter: loginAccessLogSearchFilter,
      statusEl: loginAccessLogStatus,
      buttonEl: loginAccessLogExportBtn,
    });
  });
}
if (loginAccessLogSearchFilter) {
  loginAccessLogSearchFilter.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      loginAccessLogOffset = 0;
      loadLoginAccessLog();
    }
  });
}
if (loginAccessLogPrev) {
  loginAccessLogPrev.addEventListener("click", () => {
    loginAccessLogOffset = Math.max(0, loginAccessLogOffset - LOGIN_ACCESS_LOG_PAGE_SIZE);
    loadLoginAccessLog();
  });
}
if (loginAccessLogNext) {
  loginAccessLogNext.addEventListener("click", () => {
    loginAccessLogOffset += LOGIN_ACCESS_LOG_PAGE_SIZE;
    loadLoginAccessLog();
  });
}
if (failedLoginLogClose) {
  failedLoginLogClose.addEventListener("click", closeFailedLoginLogModal);
}
if (failedLoginLogModal) {
  failedLoginLogModal.addEventListener("click", (event) => {
    if (event.target === failedLoginLogModal) closeFailedLoginLogModal();
  });
}
if (failedLoginLogFilterBtn) {
  failedLoginLogFilterBtn.addEventListener("click", () => {
    failedLoginLogOffset = 0;
    loadFailedLoginLog();
  });
}
if (failedLoginLogResetBtn) {
  failedLoginLogResetBtn.addEventListener("click", () => {
    if (failedLoginLogSearchFilter) failedLoginLogSearchFilter.value = "";
    failedLoginLogOffset = 0;
    loadFailedLoginLog();
  });
}
if (failedLoginLogExportBtn) {
  failedLoginLogExportBtn.addEventListener("click", async () => {
    await exportLoginAuditCsv({
      outcome: "failed",
      searchFilter: failedLoginLogSearchFilter,
      statusEl: failedLoginLogStatus,
      buttonEl: failedLoginLogExportBtn,
    });
  });
}
if (failedLoginLogSearchFilter) {
  failedLoginLogSearchFilter.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      failedLoginLogOffset = 0;
      loadFailedLoginLog();
    }
  });
}
if (failedLoginLogPrev) {
  failedLoginLogPrev.addEventListener("click", () => {
    failedLoginLogOffset = Math.max(0, failedLoginLogOffset - FAILED_LOGIN_LOG_PAGE_SIZE);
    loadFailedLoginLog();
  });
}
if (failedLoginLogNext) {
  failedLoginLogNext.addEventListener("click", () => {
    failedLoginLogOffset += FAILED_LOGIN_LOG_PAGE_SIZE;
    loadFailedLoginLog();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTicketViewer();
    closeAdminCreateTicketModal();
    closePasswordResetModal();
    closeAuditLogModal();
    closeKBAccessLogModal();
    closeLoginAccessLogModal();
    closeFailedLoginLogModal();
  }
});

// Theme preference for admins
function applyTheme(enabled) {
  if (enabled) {
    document.body.classList.add("theme-premium");
  } else {
    document.body.classList.remove("theme-premium");
  }
}

function loadAdminThemePreference() {
  if (currentUser?.role !== "admin") {
    return;
  }
  applyTheme(Boolean(currentUser.theme_enabled));
}

const adminThemeToggle = document.getElementById("admin-theme-toggle");
if (adminThemeToggle) {
  adminThemeToggle.addEventListener("change", async () => {
    try {
      const result = await api("/api/admin/theme", { method: "PATCH" });
      const enabled = Boolean(result.theme_enabled);
      applyTheme(enabled);
      adminThemeToggle.checked = enabled;
      const statusEl = document.getElementById("theme-status");
      if (statusEl) {
        statusEl.textContent = enabled ? "Theme enabled." : "Theme disabled.";
      }
    } catch (error) {
      const statusEl = document.getElementById("theme-status");
      if (statusEl) {
        statusEl.textContent = `Failed to update theme: ${error.message}`;
      }
    }
  });
}

const adminSignupsToggle = document.getElementById("admin-signups-toggle");
if (adminSignupsToggle) {
  adminSignupsToggle.addEventListener("change", async () => {
    try {
      const result = await api("/api/admin/signups", { method: "PATCH" });
      const enabled = Boolean(result.signups_enabled);
      adminSignupsToggle.checked = enabled;
      const statusEl = document.getElementById("signups-status");
      if (statusEl) {
        statusEl.textContent = enabled ? "New user signups are open." : "New user signups are disabled.";
      }
    } catch (error) {
      const statusEl = document.getElementById("signups-status");
      if (statusEl) {
        statusEl.textContent = `Failed to update signups setting: ${error.message}`;
      }
    }
  });
}

if (adminAlertsToggle) {
  adminAlertsToggle.addEventListener("change", () => {
    const enabled = adminAlertsToggle.checked;
    if (appView) {
      appView.classList.toggle("alerts-enabled", enabled);
    }
    localStorage.setItem("ticketgal.alerts_enabled", enabled ? "true" : "false");
    const statusEl = document.getElementById("alerts-toggle-status");
    if (statusEl) {
      statusEl.textContent = enabled ? "Atera Alerts enabled." : "Atera Alerts disabled.";
    }
  });
}

ticketViewerModeButtons.forEach((button) => {
  button.addEventListener("click", toggleTicketViewerMode);
});

ticketViewerMode = readTicketViewerMode();
pendingTicketViewerLaunch = parsePendingTicketViewerLaunch();
isStandaloneTicketViewerWindow = parseStandaloneTicketViewerWindowFlag();
updateTicketViewerModeUi();

async function loadAdminSignupsPreference() {
  try {
    const result = await api("/api/settings/signups");
    const enabled = Boolean(result.signups_enabled);
    if (adminSignupsToggle) {
      adminSignupsToggle.checked = enabled;
    }
  } catch {
    // Ignore — non-admin or network error.
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
    const data = await result.json();
    if (!data.signups_enabled) {
      registerLink.innerHTML = '<span class="muted">New user registration is currently disabled.</span>';
    }
  } catch {
    // If we can't check, leave the link visible.
  }
}

async function loadAuthProviders() {
  if (!microsoftAuthBlock || !microsoftLoginBtn) return;

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
    applyAuthModeVisibility();

    const passwordInput = document.getElementById("login-password");
    if (passwordInput instanceof HTMLInputElement) {
      passwordInput.placeholder = userPasswordAuthEnabled ? "" : "Admin password only";
    }
  } catch {
    microsoftAuthEnabled = false;
    applyAuthModeVisibility();
  }
}

async function refreshMe() {
  try {
    const result = await api("/auth/me");
    currentUser = result.user;
    const targetPath = currentUser?.role === "admin" ? "/admin" : "/portal";
    if (window.location.pathname !== targetPath) {
      window.location.replace(targetPath);
      return;
    }
    updateKBButtonVisibility();
    applyRoleView();
    loadAdminThemePreference();
    if (currentUser.role === "admin") {
      await loadProperties();
      const adminThemeToggle = document.getElementById("admin-theme-toggle");
      if (adminThemeToggle) {
        adminThemeToggle.checked = Boolean(currentUser.theme_enabled);
      }
      await loadAdminSignupsPreference();
    }
    await loadTickets();
    if (currentUser.role === "admin") {
      await loadAlerts();
      startAlertsPolling();
      await loadUsers();
    } else {
      stopAlertsPolling();
      if (alertsList) {
        alertsList.innerHTML = "";
      }
      if (alertsStatus) {
        alertsStatus.textContent = "Alerts are available to admins only.";
      }
    }
    await maybeOpenPendingTicketViewerLaunch();
  } catch {
    window.location.assign("/login");
  }
}

loadBranding();
refreshMe();

// ========================
// Knowledgebase Module
// ========================

let kbCurrentArticle = null;
let kbProperties = [];
let kbEditor = null;

const kbEditorModal = document.getElementById("kb-editor-modal");
const kbEditorClose = document.getElementById("kb-editor-close");
const kbSearchInput = document.getElementById("kb-search-input");
const kbSearchBtn = document.getElementById("kb-search-btn");
const kbNewArticleBtn = document.getElementById("kb-new-article-btn");
const kbArticlesList = document.getElementById("kb-articles-list");
const kbArticleViewer = document.getElementById("kb-article-viewer");
const userKbSearchInput = document.getElementById("user-kb-search-input");
const userKbSearchBtn = document.getElementById("user-kb-search-btn");
const userKbArticlesList = document.getElementById("user-kb-articles-list");
const userKbArticleViewer = document.getElementById("user-kb-article-viewer");
const kbEditorTitleHeading = document.getElementById("kb-editor-title-heading");
const kbEditorTitleInput = document.getElementById("kb-editor-title-input");
const kbEditorVisibility = document.getElementById("kb-editor-visibility");
const kbEditorCustomerLabel = document.getElementById("kb-editor-customer-label");
const kbEditorCustomerId = document.getElementById("kb-editor-customer-id");
const kbEditorSave = document.getElementById("kb-editor-save");
const kbEditorCancel = document.getElementById("kb-editor-cancel");
const kbEditorDelete = document.getElementById("kb-editor-delete");
const kbEditorStatus = document.getElementById("kb-editor-status");
const kbEditorUploadHint = document.getElementById("kb-editor-upload-hint");

function getKBContext(target = null) {
  const resolvedTarget = target || (currentUser?.role === "admin" ? "admin" : "user");
  if (resolvedTarget === "user") {
    return {
      target: "user",
      searchInput: userKbSearchInput,
      searchBtn: userKbSearchBtn,
      articlesList: userKbArticlesList,
      articleViewer: userKbArticleViewer,
      allowEdit: false,
    };
  }

  return {
    target: "admin",
    searchInput: kbSearchInput,
    searchBtn: kbSearchBtn,
    articlesList: kbArticlesList,
    articleViewer: kbArticleViewer,
    allowEdit: true,
  };
}

function openKBModal() {
  if (currentUser?.role === "admin") {
    setAdminPage("admin-page-knowledgebase");
    return;
  }
  setUserPage("user-page-knowledgebase");
}

function closeKBModal() {
  kbCurrentArticle = null;
  [kbArticleViewer, userKbArticleViewer].forEach((viewer) => {
    if (!viewer) return;
    viewer.classList.add("hidden");
    viewer.innerHTML = "";
  });
}

async function loadKBArticles(target = null, search = "") {
  const context = getKBContext(target);
  if (!context.articlesList) return;

  const effectiveSearch = safeText(search || context.searchInput?.value || "").trim();
  context.articlesList.innerHTML = '<p class="muted">Loading articles...</p>';
  
  try {
    const query = effectiveSearch ? `?search=${encodeURIComponent(effectiveSearch)}` : "";
    const result = await api(`/api/knowledgebase/articles${query}`);
    context.articlesList.innerHTML = "";
    
    if (!result.items || result.items.length === 0) {
      context.articlesList.innerHTML = '<p class="muted">No articles found.</p>';
      if (context.articleViewer) {
        context.articleViewer.classList.add("hidden");
        context.articleViewer.innerHTML = "";
      }
      return;
    }
    
    result.items.forEach((article) => {
      const item = document.createElement("div");
      item.className = "kb-article-item";
      item.dataset.articleSlug = safeText(article.slug);
      const isPropertyAssigned = safeText(article.visibility_type) === "company_assigned";
      const propertyName = safeText(article.restricted_to_customer_name || "").trim();
      const badgeLabel = isPropertyAssigned
        ? `Property assigned: ${propertyName || "Unknown property"}`
        : safeText(article.visibility_type).replace(/_/g, " ");
      item.innerHTML = `
        <div class="kb-article-title">${safeText(article.title)}</div>
        <span class="kb-article-badge kb-badge-${article.visibility_type}">${badgeLabel}</span>
      `;
      item.addEventListener("click", () => displayKBArticle(article.slug, context.target));
      context.articlesList.appendChild(item);
    });
  } catch (error) {
    context.articlesList.innerHTML = `<p class="muted error">Failed to load articles: ${safeText(error.message)}</p>`;
  }
}

async function displayKBArticle(slug, target = null) {
  const context = getKBContext(target);
  if (!context.articleViewer) return;

  try {
    const article = await api(`/api/knowledgebase/articles/${slug}`);
    kbCurrentArticle = article;
    
    Array.from(context.articlesList?.querySelectorAll(".kb-article-item") || []).forEach((item) => {
      item.classList.toggle("active", item.dataset.articleSlug === safeText(article.slug));
    });
    
    context.articleViewer.classList.remove("hidden");
    const isAdminEditor = Boolean(currentUser && currentUser.role === "admin" && context.allowEdit);
    const editBtn = isAdminEditor ? `<button id="kb-edit-article-btn" type="button">Edit</button>` : "";
    
    context.articleViewer.innerHTML = `
      <div class="kb-article-header">
        <h1>${safeText(article.title)}</h1>
        <div class="kb-article-actions">
          ${editBtn}
        </div>
      </div>
      <div class="kb-article-content" id="kb-article-markdown"></div>
    `;
    
    const markdownEl = context.articleViewer.querySelector("#kb-article-markdown");
    if (markdownEl) {
      const markedParse =
        typeof marked !== "undefined"
          ? typeof marked.parse === "function"
            ? (src) => marked.parse(src)
            : typeof marked === "function"
            ? (src) => marked(src)
            : null
          : null;
      if (markedParse) {
        try {
          const rendered = markedParse(article.content || "");
          markdownEl.innerHTML = typeof rendered === "string" ? rendered : (article.content || "");
          sanitizeElement(markdownEl);
        } catch {
          markdownEl.textContent = article.content || "";
        }
      } else {
        markdownEl.textContent = article.content || "";
      }
    }
    
    if (isAdminEditor) {
      const editBtn = context.articleViewer.querySelector("#kb-edit-article-btn");
      if (editBtn) {
        editBtn.addEventListener("click", () => openKBEditor(article));
      }
    }
  } catch (error) {
    context.articleViewer.classList.remove("hidden");
    context.articleViewer.innerHTML = `<p class="muted error">Failed to load article: ${safeText(error.message)}</p>`;
  }
}

function openKBEditor(article = null) {
  const slug = safeText(article?.slug).trim();
  const url = slug ? `/kb-editor?slug=${encodeURIComponent(slug)}` : "/kb-editor";
  const availableWidth = Number(window.screen?.availWidth) || Number(window.innerWidth) || 1400;
  const availableHeight = Number(window.screen?.availHeight) || Number(window.innerHeight) || 900;
  const width = Math.max(900, Math.floor(availableWidth * 0.96));
  const height = Math.max(700, Math.floor(availableHeight * 0.96));
  const left = Math.max(0, Math.floor((availableWidth - width) / 2));
  const top = Math.max(0, Math.floor((availableHeight - height) / 2));
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const popup = window.open(url, "ticketgal-kb-editor", features);
  if (popup && typeof popup.focus === "function") {
    popup.focus();
    return;
  }
  if (kbEditorStatus) {
    kbEditorStatus.textContent = "Pop-up blocked. Allow pop-ups for this site and try again.";
  }
}

function closeKBEditor() {
  if (!kbEditorModal) return;
  kbEditorModal.classList.add("hidden");
  kbCurrentArticle = null;
  if (kbEditorStatus) {
    kbEditorStatus.textContent = "";
  }
}

function getKBEditorTextarea() {
  const textarea = document.getElementById("kb-content-fallback");
  return textarea instanceof HTMLTextAreaElement ? textarea : null;
}

function getKBEditorContent() {
  if (kbEditor && typeof kbEditor.getValue === "function") {
    return kbEditor.getValue();
  }
  const textarea = getKBEditorTextarea();
  return textarea ? textarea.value : "";
}

function setKBEditorContent(content) {
  const nextContent = safeText(content || "");
  if (kbEditor && typeof kbEditor.setValue === "function") {
    kbEditor.setValue(nextContent);
    kbEditor.focus();
    return;
  }
  const textarea = getKBEditorTextarea();
  if (textarea) {
    textarea.value = nextContent;
    textarea.focus();
  }
}

function insertTextAtCursor(textarea, text) {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
  const end = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : textarea.value.length;
  const prefix = textarea.value.slice(0, start);
  const suffix = textarea.value.slice(end);
  textarea.value = `${prefix}${text}${suffix}`;
  const nextCursor = start + text.length;
  textarea.selectionStart = nextCursor;
  textarea.selectionEnd = nextCursor;
  textarea.focus();
}

function insertKBEditorText(text) {
  if (kbEditor && typeof kbEditor.replaceSelection === "function") {
    kbEditor.focus();
    kbEditor.replaceSelection(text, "end");
    return;
  }
  const textarea = getKBEditorTextarea();
  if (textarea) {
    insertTextAtCursor(textarea, text);
  }
}

async function copyTextToClipboard(text) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function normalizeKBImageMarkdown(markdown) {
  const normalized = safeText(markdown || "").trim();
  return normalized ? `${normalized}\n` : "";
}

async function uploadKBImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  return api("/api/knowledgebase/assets", {
    method: "POST",
    body: formData,
  });
}

function isKBImageFile(file) {
  if (!file) return false;
  const fileType = safeText(file.type).toLowerCase();
  if (fileType.startsWith("image/")) {
    return true;
  }
  const fileName = safeText(file.name).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((extension) => fileName.endsWith(extension));
}

async function handleKBEditorImageDrop(fileList) {
  if (!kbEditorStatus) return;

  const files = Array.from(fileList || []).filter((file) => isKBImageFile(file));
  if (!files.length) {
    kbEditorStatus.textContent = "Drop a PNG, JPG, GIF, or WebP image into the editor.";
    return;
  }

  kbEditorStatus.textContent = files.length === 1 ? "Uploading image..." : `Uploading ${files.length} images...`;

  try {
    const uploaded = [];
    for (const file of files) {
      const result = await uploadKBImage(file);
      uploaded.push(result);
    }

    const markdownBlock = uploaded
      .map((result) => normalizeKBImageMarkdown(result?.markdown))
      .filter(Boolean)
      .join("\n");

    if (markdownBlock) {
      const current = getKBEditorContent();
      const prefix = current && !current.endsWith("\n") ? "\n" : "";
      insertKBEditorText(`${prefix}${markdownBlock}`);
    }

    const lastUrl = uploaded[uploaded.length - 1]?.url || "";
    const copied = lastUrl ? await copyTextToClipboard(lastUrl) : false;
    kbEditorStatus.textContent = copied
      ? "Image uploaded. Markdown inserted and the image URL was copied to your clipboard."
      : "Image uploaded and markdown inserted.";
  } catch (error) {
    kbEditorStatus.textContent = `Image upload failed: ${safeText(error.message)}`;
  }
}

function bindKBEditorImageDrop(container, textarea) {
  if (!container || !(textarea instanceof HTMLTextAreaElement) || container.dataset.uploadBound === "true") {
    return;
  }

  const onDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    container.classList.add("dragover");
  };
  const onDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    container.classList.remove("dragover");
  };
  const onDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    container.classList.remove("dragover");
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      await handleKBEditorImageDrop(files);
    }
  };

  container.addEventListener("dragenter", onDragEnter);
  container.addEventListener("dragover", onDragEnter);
  container.addEventListener("dragleave", onDragLeave);
  container.addEventListener("drop", onDrop);

  container.dataset.uploadBound = "true";
}

function initializeCodeMirrorContainer() {
  const container = document.getElementById("kb-editor-codemirror");
  if (!container) return;

  let textarea = container.querySelector("#kb-content-fallback");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    textarea = document.createElement("textarea");
    textarea.id = "kb-content-fallback";
    textarea.rows = 15;
    textarea.style.width = "100%";
    textarea.style.padding = "0.75rem";
    textarea.style.fontFamily = '"Courier New", monospace';
    textarea.style.fontSize = "0.9rem";
    textarea.style.border = "1px solid #ccbfa3";
    textarea.style.borderRadius = "6px";
    container.appendChild(textarea);
  }

  if (!kbEditor && typeof window.CodeMirror !== "undefined") {
    kbEditor = window.CodeMirror.fromTextArea(textarea, {
      mode: "markdown",
      lineNumbers: true,
      lineWrapping: true,
      viewportMargin: Infinity,
    });
  }

  bindKBEditorImageDrop(container, textarea);

  if (kbEditorUploadHint) {
    kbEditorUploadHint.textContent = typeof window.CodeMirror !== "undefined"
      ? "Markdown syntax highlighting is enabled. Drag a PNG, JPG, GIF, or WebP image into the editor to upload and insert markdown."
      : "CodeMirror did not load, using plain textarea. Drag a PNG, JPG, GIF, or WebP image into the editor to upload and insert markdown.";
  }
}

async function loadKBProperties() {
  try {
    const result = await api("/api/admin/properties");
    kbProperties = result.items || [];
    
    if (kbEditorCustomerId) {
      const options = kbProperties
        .map((property) => {
          const customerId = property.customer_id ?? property.CustomerID ?? "";
          const customerName = property.customer_name ?? property.CustomerName ?? "";
          return `<option value="${customerId}">${safeText(customerName)}</option>`;
        })
        .join("");
      kbEditorCustomerId.innerHTML = '<option value="">-- Select a property --</option>' + options;
    }
  } catch {
    kbProperties = [];
  }
}

function updateKBVisibilityLabel() {
  if (!kbEditorVisibility || !kbEditorCustomerLabel) return;
  const visibility = kbEditorVisibility.value;
  kbEditorCustomerLabel.style.display = visibility === "company_assigned" ? "block" : "none";
}

async function saveKBArticle() {
  if (!kbEditorTitleInput || !kbEditorVisibility || !kbEditorStatus) return;
  
  const title = kbEditorTitleInput.value.trim();
  const visibility = kbEditorVisibility.value;
  const customerId = kbEditorCustomerId && kbEditorCustomerId.value ? parseInt(kbEditorCustomerId.value) : null;
  const content = getKBEditorContent();
  
  if (!title || !content) {
    kbEditorStatus.textContent = "Title and content are required.";
    return;
  }
  
  kbEditorStatus.textContent = "Saving...";
  
  try {
    const isEdit = kbCurrentArticle && kbCurrentArticle.id;
    const method = isEdit ? "PATCH" : "POST";
    const url = isEdit ? `/api/knowledgebase/articles/${kbCurrentArticle.slug}` : "/api/knowledgebase/articles";
    
    const request = {
      title,
      visibility_type: visibility,
      content,
      ...(visibility === "company_assigned" && customerId ? { restricted_to_customer_id: customerId } : {})
    };
    
    const result = await api(url, {
      method,
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" }
    });
    
    kbEditorStatus.textContent = "Saved successfully!";
    setTimeout(() => {
      closeKBEditor();
      loadKBArticles("admin");
    }, 800);
  } catch (error) {
    kbEditorStatus.textContent = `Error: ${safeText(error.message)}`;
  }
}

async function deleteKBArticle() {
  if (!kbCurrentArticle || !kbCurrentArticle.slug) return;
  
  if (!confirm("Are you sure you want to delete this article?")) {
    return;
  }
  
  if (!kbEditorStatus) return;
  kbEditorStatus.textContent = "Deleting...";
  
  try {
    await api(`/api/knowledgebase/articles/${kbCurrentArticle.slug}`, { method: "DELETE" });
    kbEditorStatus.textContent = "Deleted successfully!";
    setTimeout(() => {
      closeKBEditor();
      loadKBArticles("admin");
    }, 800);
  } catch (error) {
    kbEditorStatus.textContent = `Error: ${safeText(error.message)}`;
  }
}

function sanitizeElement(el) {
  // Remove dangerous tags and attributes
  const allowedTags = ["p", "a", "img", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "code", "pre", "span", "div", "br", "strong", "em", "u"];
  const allowedAttrs = ["href", "src", "alt", "class"];
  
  const walker = document.createTreeWalker(
    el,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  const nodesToRemove = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!allowedTags.includes(node.tagName.toLowerCase())) {
      nodesToRemove.push(node);
    } else {
      // Remove disallowed attributes
      const attrs = Array.from(node.attributes);
      attrs.forEach((attr) => {
        if (!allowedAttrs.includes(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });
      
      // Validate href for security
      if (node.tagName.toLowerCase() === "a" && node.href) {
        if (!isSafeCommentHref(node.href)) {
          node.removeAttribute("href");
        }
      }
    }
  }
  
  nodesToRemove.forEach((node) => {
    while (node.firstChild) {
      node.parentNode.insertBefore(node.firstChild, node);
    }
    node.parentNode.removeChild(node);
  });
}

// Event listeners
if (kbSearchBtn) {
  kbSearchBtn.addEventListener("click", () => {
    loadKBArticles("admin");
  });
}

if (kbSearchInput) {
  kbSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      kbSearchBtn?.click();
    }
  });
}

if (userKbSearchBtn) {
  userKbSearchBtn.addEventListener("click", () => {
    loadKBArticles("user");
  });
}

if (userKbSearchInput) {
  userKbSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      userKbSearchBtn?.click();
    }
  });
}

if (kbNewArticleBtn) {
  kbNewArticleBtn.addEventListener("click", () => openKBEditor());
}

if (kbEditorClose) {
  kbEditorClose.addEventListener("click", closeKBEditor);
}

if (kbEditorVisibility) {
  kbEditorVisibility.addEventListener("change", updateKBVisibilityLabel);
}

if (kbEditorSave) {
  kbEditorSave.addEventListener("click", saveKBArticle);
}

if (kbEditorCancel) {
  kbEditorCancel.addEventListener("click", closeKBEditor);
}

if (kbEditorDelete) {
  kbEditorDelete.addEventListener("click", deleteKBArticle);
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  const eventType = safeText(event.data?.type).trim();
  if (eventType !== "kb-editor-saved" && eventType !== "kb-editor-deleted") {
    return;
  }
  loadKBArticles("admin");
  const slug = safeText(event.data?.slug).trim();
  if (slug && eventType === "kb-editor-saved") {
    displayKBArticle(slug, "admin").catch(() => {
      // Ignore display refresh errors after popup save.
    });
  }
  if (eventType === "kb-editor-deleted" && kbArticleViewer) {
    kbArticleViewer.classList.add("hidden");
    kbArticleViewer.innerHTML = "";
  }
});

// Show/hide KB button based on user role
function updateKBButtonVisibility() {
  if (!kbNewArticleBtn) return;
  kbNewArticleBtn.style.display = currentUser?.role === "admin" ? "block" : "none";
}

setTimeout(() => {
  updateKBButtonVisibility();
}, 100);
