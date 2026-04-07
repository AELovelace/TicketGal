const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const shell = document.querySelector(".shell");
const userShell = document.getElementById("user-shell");
const adminShell = document.getElementById("admin-shell");
const welcomeText = document.getElementById("welcome-text");

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const microsoftLoginBtn = document.getElementById("microsoft-login-btn");
const microsoftAuthBlock = document.getElementById("microsoft-auth-block");
const localLoginBlock = document.getElementById("local-login-block");
const localLoginDivider = document.getElementById("local-login-divider");
const localLoginBtn = document.getElementById("local-login-btn");
const registerLink = document.getElementById("register-link");

const loginStatus = document.getElementById("login-status");

const userCreateForm = document.getElementById("create-ticket-form");
const userTicketsBody = document.getElementById("tickets-body");
const userListStatus = document.getElementById("list-status");
const userCreateStatus = document.getElementById("create-status");
const userRefreshBtn = document.getElementById("refresh-btn");
const userStatusFilter = document.getElementById("user-status-filter");

const userDropZone = document.getElementById("drop-zone");
const userDropHint = document.getElementById("drop-hint");
const userAiAssistBtn = document.getElementById("ticket-ai-assist");
const userAiAssistStatus = document.getElementById("ticket-ai-status");

const adminCreateForm = document.getElementById("admin-create-ticket-form");
const adminStatusBody = document.getElementById("admin-status-body");
const adminStatusMessage = document.getElementById("admin-status-message");
const adminCreateStatus = document.getElementById("admin-create-status");
const adminStatusRefreshBtn = document.getElementById("admin-status-refresh-btn");
const adminStatusFilter = document.getElementById("admin-status-filter");

const adminDropZone = document.getElementById("admin-drop-zone");
const adminDropHint = document.getElementById("admin-drop-hint");
const adminAiAssistBtn = document.getElementById("admin-ticket-ai-assist");
const adminAiAssistStatus = document.getElementById("admin-ticket-ai-status");

const refreshUsersBtn = document.getElementById("refresh-users-btn");
const pendingUsersEl = document.getElementById("pending-users");
const userManagementListEl = document.getElementById("user-management-list");
const userSearchInput = document.getElementById("user-search");
const alertsFeed = document.getElementById("alerts-feed");
const alertsStatus = document.getElementById("alerts-status");
const alertsList = document.getElementById("alerts-list");
const alertsRefreshBtn = document.getElementById("alerts-refresh-btn");
const adminAlertsToggle = document.getElementById("admin-alerts-toggle");

// Password reset modal elements
const passwordResetModal = document.getElementById("password-reset-modal");
const passwordResetClose = document.getElementById("password-reset-close");
const passwordResetUserEmail = document.getElementById("password-reset-user-email");
const passwordResetInput = document.getElementById("password-reset-input");
const passwordResetSubmit = document.getElementById("password-reset-submit");
const passwordResetStatus = document.getElementById("password-reset-status");

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
const ticketViewer = document.getElementById("ticket-viewer");
const ticketViewerClose = document.getElementById("ticket-viewer-close");
const ticketViewerMeta = document.getElementById("ticket-viewer-meta");
const ticketViewerUpdate = document.getElementById("ticket-viewer-update");
const ticketViewerUpdateStatus = document.getElementById("ticket-viewer-update-status");
const ticketViewerHistory = document.getElementById("ticket-viewer-history");

const ADMIN_STATUSES = ["Open", "Pending", "Closed", "Resolved"];
const USER_STATUSES = ["Open", "Resolved"];
const USER_LOCKED_CURRENT = ["pending", "closed", "pending closed"];

let currentUser = null;
let currentAdminPage = "admin-page-create";
let cachedTickets = [];
let cachedProperties = [];
let alertsPollTimer = null;
let userPasswordAuthEnabled = true;
let microsoftAuthEnabled = false;

const authRedirectState = readAndClearAuthRedirectState();

const DISMISSED_ALERTS_KEY = "ticketgal.dismissed_alert_ids";

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
}

function closeTicketViewer() {
  if (!ticketViewer) return;
  ticketViewer.classList.add("hidden");
  if (ticketViewerMeta) ticketViewerMeta.innerHTML = "";
  if (ticketViewerUpdate) ticketViewerUpdate.innerHTML = "";
  if (ticketViewerUpdateStatus) ticketViewerUpdateStatus.textContent = "";
  if (ticketViewerHistory) ticketViewerHistory.innerHTML = "";
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

    ticketViewerMeta.innerHTML = `
      <strong>#${safeText(ticket.TicketID)} - ${safeText(ticket.TicketTitle)}</strong><br>
      Status: ${safeText(ticket.TicketStatus || "")}&nbsp;&nbsp;|&nbsp;&nbsp;
      Company: ${safeText(ticket.CustomerName || "")}&nbsp;&nbsp;|&nbsp;&nbsp;
      End User: ${safeText(ticket.EndUserEmail || "")}
    `;

    if (ticketViewerUpdate) {
      const heading = document.createElement("h3");
      heading.textContent = "Post Update";
      const controls = buildUpdateControls(ticket, currentUser?.role === "admin");
      controls.classList.add("viewer-update-form");

      ticketViewerUpdate.innerHTML = "";
      ticketViewerUpdate.appendChild(heading);
      ticketViewerUpdate.appendChild(controls);
    }

    if (!comments.length) {
      ticketViewerHistory.innerHTML = '<div class="history-entry muted">No ticket history found.</div>';
      return;
    }

    ticketViewerHistory.innerHTML = "";
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
  } catch (error) {
    ticketViewerMeta.innerHTML = "";
    ticketViewerHistory.innerHTML = `<div class=\"history-entry\">Failed to load history: ${safeText(error.message)}</div>`;
  }
}

function showAuth() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  if (shell) {
    shell.classList.remove("admin-mode");
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

function populatePropertySelects() {
  if (!adminPropertySelect) return;

  adminPropertySelect.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No Property";
  adminPropertySelect.appendChild(noneOption);

  cachedProperties.forEach((property) => {
    const option = document.createElement("option");
    option.value = String(property.customer_id);
    option.textContent = safeText(property.customer_name || `Property ${property.customer_id}`);
    adminPropertySelect.appendChild(option);
  });
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

  if (isAdmin) {
    setAdminPage(currentAdminPage);
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

  const comment = document.createElement("textarea");
  comment.rows = 3;
  comment.placeholder = "Add ticket update";
  comment.dataset.role = "comment-text";

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
  const internal = document.createElement("input");
  internal.type = "checkbox";
  internal.dataset.role = "internal";
  internal.disabled = !isAdminTable;
  internalLabel.appendChild(internal);
  internalLabel.appendChild(document.createTextNode(" Internal"));

  const resolveLabel = document.createElement("label");
  const resolve = document.createElement("input");
  resolve.type = "checkbox";
  resolve.dataset.role = "resolve-with-update";
  resolve.disabled = isAdminTable || USER_LOCKED_CURRENT.includes((ticket.TicketStatus || "").toLowerCase());
  resolveLabel.appendChild(resolve);
  resolveLabel.appendChild(document.createTextNode(" Mark Resolved with update"));

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.dataset.role = "comment-save";
  saveBtn.dataset.ticketId = String(ticket.TicketID);
  saveBtn.textContent = "Post Update";

  wrap.appendChild(comment);
  wrap.appendChild(tech);
  wrap.appendChild(internalLabel);
  if (!isAdminTable) {
    wrap.appendChild(resolveLabel);
  }
  wrap.appendChild(saveBtn);

  return wrap;
}

function ticketListRow(ticket, isAdminTable) {
  const tr = document.createElement("tr");

  const idTd = document.createElement("td");
  idTd.textContent = safeText(ticket.TicketID);
  tr.appendChild(idTd);

  const titleTd = document.createElement("td");
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "ticket-open-btn";
  openBtn.dataset.role = "open-ticket";
  openBtn.dataset.ticketId = String(ticket.TicketID);
  openBtn.textContent = safeText(ticket.TicketTitle);
  titleTd.appendChild(openBtn);
  tr.appendChild(titleTd);

  const statusTd = document.createElement("td");
  statusTd.appendChild(buildStatusReadOnlyCell(ticket));
  tr.appendChild(statusTd);

  const companyTd = document.createElement("td");
  companyTd.textContent = safeText(ticket.CustomerName || "");
  tr.appendChild(companyTd);

  const emailTd = document.createElement("td");
  emailTd.textContent = safeText(ticket.EndUserEmail || "");
  tr.appendChild(emailTd);

  const updateTd = document.createElement("td");
  updateTd.appendChild(buildUpdateControls(ticket, isAdminTable));
  tr.appendChild(updateTd);

  return tr;
}

function statusManagementRow(ticket) {
  const tr = document.createElement("tr");

  const idTd = document.createElement("td");
  idTd.textContent = safeText(ticket.TicketID);
  tr.appendChild(idTd);

  const titleTd = document.createElement("td");
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "ticket-open-btn";
  openBtn.dataset.role = "open-ticket";
  openBtn.dataset.ticketId = String(ticket.TicketID);
  openBtn.textContent = safeText(ticket.TicketTitle);
  titleTd.appendChild(openBtn);
  tr.appendChild(titleTd);

  const currentTd = document.createElement("td");
  const statusClass = statusClassName(ticket.TicketStatus || "Open");
  if (statusClass) {
    currentTd.classList.add(statusClass);
  }
  currentTd.textContent = safeText(ticket.TicketStatus || "Open");
  tr.appendChild(currentTd);

  const actionTd = document.createElement("td");
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
  const statusEl = isAdmin ? adminAiAssistStatus : userAiAssistStatus;
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
    const statusFilter = currentUser?.role === "admin"
      ? (adminStatusFilter?.value || "")
      : (userStatusFilter?.value || "");

    const pageSize = 50;
    const maxPages = 200;
    const allTickets = [];
    const seenTicketIds = new Set();
    let totalItemCount = null;
    let pagesFetched = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("items_in_page", String(pageSize));
      if (statusFilter) {
        params.set("ticket_status", statusFilter);
      }

      const result = await api(`/api/tickets?${params.toString()}`);
      const items = Array.isArray(result?.items) ? result.items : [];
      pagesFetched += 1;

      const maybeTotal = Number(result?.totalItemCount);
      if (Number.isFinite(maybeTotal) && maybeTotal >= 0) {
        totalItemCount = maybeTotal;
      }

      items.forEach((ticket) => {
        const ticketId = safeText(ticket?.TicketID);
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

    cachedTickets = allTickets;

    userTicketsBody.innerHTML = "";
    adminStatusBody.innerHTML = "";

    cachedTickets.forEach((ticket) => {
      if (currentUser?.role === "admin") {
        adminStatusBody.appendChild(statusManagementRow(ticket));
      } else {
        userTicketsBody.appendChild(ticketListRow(ticket, false));
      }
    });

    const pagesText = pagesFetched === 1 ? "1 page" : `${pagesFetched} pages`;

    if (currentUser?.role === "admin") {
      adminStatusMessage.textContent = cachedTickets.length
        ? `Loaded ${cachedTickets.length} tickets from ${pagesText}.`
        : "No tickets found.";
    } else {
      userListStatus.textContent = `Loaded ${cachedTickets.length} tickets from ${pagesText}.`;
    }
  } catch (error) {
    if (currentUser?.role === "admin") {
      adminStatusMessage.textContent = `Failed to load statuses: ${error.message}`;
    } else {
      userListStatus.textContent = `Failed to load tickets: ${error.message}`;
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
      const info = document.createElement("span");
      info.textContent = `${safeText(user.email)} (${safeText(user.role)})`;

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
  } catch (error) {
    pendingUsersEl.textContent = `Failed: ${error.message}`;
    userManagementListEl.textContent = `Failed: ${error.message}`;
  }
}

async function submitCreateForm(prefix, isAdmin) {
  const statusEl = isAdmin ? adminCreateStatus : userCreateStatus;
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
  if (isAdmin && adminPropertySelect?.value) {
    payload.customer_id = Number(adminPropertySelect.value);
  }

  await api("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  statusEl.textContent = "Ticket created successfully.";
  if (isAdmin) {
    adminCreateForm.reset();
    const adminTechInput = document.getElementById("admin-technician-id");
    if (adminTechInput instanceof HTMLInputElement) {
      adminTechInput.value = "1";
    }
    setCreateFormStatusOptions("admin-", ADMIN_STATUSES);
  } else {
    userCreateForm.reset();
    document.getElementById("end-user-email").value = currentUser.email;
    setCreateFormStatusOptions("", USER_STATUSES);
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

  if (!isAdmin && resolve instanceof HTMLInputElement) {
    payload.mark_resolved = resolve.checked;
  }

  await api(`/api/tickets/${ticketId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (isAdmin) {
    if (statusTarget) {
      statusTarget.textContent = `Posted update for ticket ${ticketId}.`;
    } else if (adminStatusMessage) {
      adminStatusMessage.textContent = `Posted update for ticket ${ticketId}.`;
    }
  } else {
    const text = payload.mark_resolved
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
  currentUser = null;
  stopAlertsPolling();
  if (alertsList) {
    alertsList.innerHTML = "";
  }
  if (alertsStatus) {
    alertsStatus.textContent = "Sign in to view alerts.";
  }
  applyTheme(false);
  showAuth();
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

userRefreshBtn.addEventListener("click", loadTickets);
if (adminStatusRefreshBtn) {
  adminStatusRefreshBtn.addEventListener("click", async () => {
    await Promise.all([loadTickets(), loadAlerts()]);
  });
}
refreshUsersBtn.addEventListener("click", loadUsers);
if (alertsRefreshBtn) {
  alertsRefreshBtn.addEventListener("click", () => loadAlerts());
}

if (userStatusFilter) {
  userStatusFilter.addEventListener("change", loadTickets);
}
if (adminStatusFilter) {
  adminStatusFilter.addEventListener("change", loadTickets);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAdminPage(button.dataset.adminPage);
  });
});

userTicketsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.role === "open-ticket") {
    const ticketId = target.dataset.ticketId;
    if (ticketId) {
      await openTicketViewer(ticketId);
    }
    return;
  }

  if (target.dataset.role === "comment-save") {
    const row = target.closest("tr");
    const ticketId = target.dataset.ticketId;
    if (!row || !ticketId) return;

    try {
      await postUpdateFromRow(row, ticketId, false);
    } catch (error) {
      userListStatus.textContent = `Update failed: ${error.message}`;
    }
  }
});

adminStatusBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.role === "open-ticket") {
    const ticketId = target.dataset.ticketId;
    if (ticketId) {
      await openTicketViewer(ticketId);
    }
    return;
  }

  if (target.dataset.role === "admin-status-save") {
    const row = target.closest("tr");
    const ticketId = target.dataset.ticketId;
    const select = row?.querySelector("[data-role='admin-status-select']");
    if (!ticketId || !(select instanceof HTMLSelectElement)) return;

    try {
      await api(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_status: select.value }),
      });
      adminStatusMessage.textContent = `Updated status for ticket ${ticketId}.`;
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
    if (target.dataset.role !== "comment-save") return;

    const row = target.closest(".viewer-update-form");
    const ticketId = target.dataset.ticketId;
    if (!row || !ticketId) return;

    try {
      await postUpdateFromRow(row, ticketId, currentUser?.role === "admin", ticketViewerUpdateStatus);
      await openTicketViewer(ticketId);
    } catch (error) {
      if (ticketViewerUpdateStatus) {
        ticketViewerUpdateStatus.textContent = `Update failed: ${error.message}`;
      }
    }
  });
}

bindDropZone(userDropZone, userDropHint, "");
bindDropZone(adminDropZone, adminDropHint, "admin-");

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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTicketViewer();
    closePasswordResetModal();
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
  } catch {
    currentUser = null;
    stopAlertsPolling();
    if (alertsList) {
      alertsList.innerHTML = "";
    }
    if (alertsStatus) {
      alertsStatus.textContent = "Sign in to view alerts.";
    }
    showAuth();
    if (authRedirectState.error) {
      loginStatus.textContent = authRedirectState.error;
    }
    checkSignupsEnabled();
    loadAuthProviders();
  }
}

refreshMe();
