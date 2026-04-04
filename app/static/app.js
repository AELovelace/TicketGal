const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const shell = document.querySelector(".shell");
const userShell = document.getElementById("user-shell");
const adminShell = document.getElementById("admin-shell");
const welcomeText = document.getElementById("welcome-text");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutBtn = document.getElementById("logout-btn");

const loginStatus = document.getElementById("login-status");
const registerStatus = document.getElementById("register-status");

const userCreateForm = document.getElementById("create-ticket-form");
const userTicketsBody = document.getElementById("tickets-body");
const userListStatus = document.getElementById("list-status");
const userCreateStatus = document.getElementById("create-status");
const userRefreshBtn = document.getElementById("refresh-btn");
const userStatusFilter = document.getElementById("user-status-filter");

const userDropZone = document.getElementById("drop-zone");
const userDropHint = document.getElementById("drop-hint");

const adminCreateForm = document.getElementById("admin-create-ticket-form");
const adminStatusBody = document.getElementById("admin-status-body");
const adminStatusMessage = document.getElementById("admin-status-message");
const adminCreateStatus = document.getElementById("admin-create-status");
const adminStatusRefreshBtn = document.getElementById("admin-status-refresh-btn");
const adminStatusFilter = document.getElementById("admin-status-filter");

const adminDropZone = document.getElementById("admin-drop-zone");
const adminDropHint = document.getElementById("admin-drop-hint");

const refreshUsersBtn = document.getElementById("refresh-users-btn");
const pendingUsersEl = document.getElementById("pending-users");
const userResetListEl = document.getElementById("user-reset-list");
const userManagementListEl = document.getElementById("user-management-list");

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

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
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

  // Some Atera comments can include serialized CSS text before actual message content.
  // Remove leading CSS selector/declaration blocks if present.
  const cssBlockPrefix = /^(?:[.#a-zA-Z0-9_\-\s,>:+*\[\]="'()]+)\{[^{}]{0,5000}\}\s*/;
  for (let i = 0; i < 5; i += 1) {
    if (!cssBlockPrefix.test(text)) break;
    text = text.replace(cssBlockPrefix, "").trim();
  }

  // Remove leading bare CSS declaration runs that may survive malformed content.
  const cssDeclarationsPrefix = /^(?:[a-z-]+\s*:\s*[^;\n]+;\s*){2,}/i;
  text = text.replace(cssDeclarationsPrefix, "").trim();

  return text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
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

      const comment = document.createElement("div");
      comment.textContent = htmlToReadableText(entry.Comment || "");

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

  const response = await fetch("/api/emails/parse-drop", {
    method: "POST",
    body: formData,
    credentials: "include",
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

  try {
    const pending = await api("/api/admin/users?pending_only=true");
    pendingUsersEl.innerHTML = "";
    const pendingItems = pending?.items || [];
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
    const items = all?.items || [];

    userResetListEl.innerHTML = "";
    userManagementListEl.innerHTML = "";

    if (!items.length) {
      userResetListEl.textContent = "No users found.";
      userManagementListEl.textContent = "No users found.";
      return;
    }

    items.forEach((user) => {
      const resetRow = document.createElement("div");
      resetRow.className = "pending-row";
      const label = document.createElement("span");
      label.textContent = safeText(user.email);
      const passInput = document.createElement("input");
      passInput.type = "password";
      passInput.placeholder = "New password (min 8)";
      passInput.minLength = 8;
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.textContent = "Reset Password";
      resetBtn.addEventListener("click", async () => {
        const password = passInput.value.trim();
        if (password.length < 8) return;
        await api(`/api/admin/users/${user.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: password }),
        });
        passInput.value = "";
      });
      resetRow.appendChild(label);
      resetRow.appendChild(passInput);
      resetRow.appendChild(resetBtn);
      userResetListEl.appendChild(resetRow);

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
      mgmtRow.appendChild(deleteBtn);
      userManagementListEl.appendChild(mgmtRow);
    });
  } catch (error) {
    pendingUsersEl.textContent = `Failed: ${error.message}`;
    userResetListEl.textContent = `Failed: ${error.message}`;
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

async function refreshMe() {
  try {
    const result = await api("/auth/me");
    currentUser = result.user;
    applyRoleView();
    if (currentUser.role === "admin") {
      await loadProperties();
    }
    await loadTickets();
    if (currentUser.role === "admin") {
      await loadUsers();
    }
  } catch {
    currentUser = null;
    showAuth();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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
    registerStatus.textContent = result.message;
  } catch (error) {
    registerStatus.textContent = `Registration failed: ${error.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/auth/logout", { method: "POST" });
  currentUser = null;
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

userRefreshBtn.addEventListener("click", loadTickets);
if (adminStatusRefreshBtn) {
  adminStatusRefreshBtn.addEventListener("click", loadTickets);
}
refreshUsersBtn.addEventListener("click", loadUsers);

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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTicketViewer();
  }
});

refreshMe();
