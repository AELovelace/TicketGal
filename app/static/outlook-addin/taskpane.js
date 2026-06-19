"use strict";

// ---- XHR helper (IE11-compatible, no fetch) ------------------------------

function request(method, url, body, headers, callback) {
  var req = new XMLHttpRequest();
  req.open(method, url, true);
  req.withCredentials = true;
  if (body) req.setRequestHeader("Content-Type", "application/json");
  for (var key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      req.setRequestHeader(key, headers[key]);
    }
  }
  req.onload = function() {
    var data = null;
    try { data = JSON.parse(req.responseText); } catch (e) {}
    callback(null, req.status, data);
  };
  req.onerror = function() { callback(new Error("Network error"), null, null); };
  req.send(body ? JSON.stringify(body) : null);
}

// ---- view helpers --------------------------------------------------------

function showView(name) {
  var views = ["login", "loading", "form", "success"];
  for (var i = 0; i < views.length; i++) {
    var el = document.getElementById("view-" + views[i]);
    if (el) el.hidden = (views[i] !== name);
  }
}

function setLoadingMsg(msg) {
  var el = document.getElementById("loading-msg");
  if (el) el.textContent = msg;
}

function showLoginError(msg) {
  var el = document.getElementById("login-error");
  if (el) { el.textContent = msg; el.hidden = false; }
}

function clearLoginError() {
  var el = document.getElementById("login-error");
  if (el) { el.textContent = ""; el.hidden = true; }
}

function showFormError(msg) {
  var el = document.getElementById("form-error");
  if (el) { el.textContent = msg; el.hidden = false; }
}

function clearFormError() {
  var el = document.getElementById("form-error");
  if (el) { el.textContent = ""; el.hidden = true; }
}

// ---- CSRF ----------------------------------------------------------------

function getCsrfToken() {
  var parts = document.cookie.split(";");
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i].trim().split("=");
    if (pair[0] === "ticketgal_csrf") {
      return decodeURIComponent(pair.slice(1).join("="));
    }
  }
  return "";
}

// ---- auth ----------------------------------------------------------------

function checkAuth() {
  setLoadingMsg("Checking session…");
  showView("loading");
  request("GET", "/auth/me", null, {}, function(err, status) {
    if (!err && status === 200) {
      startEmailRead();
    } else {
      showView("login");
    }
  });
}

function handleLogin(e) {
  e.preventDefault();
  clearLoginError();
  var email = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value;
  var btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  request("POST", "/auth/login", { email: email, password: password }, {}, function(err, status, data) {
    if (!err && status === 200) {
      startEmailRead();
    } else {
      var msg = (data && data.detail) ? data.detail : "Login failed. Check your credentials.";
      showLoginError(err ? "Network error. Is TicketGal reachable?" : msg);
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
}

// ---- email reading -------------------------------------------------------

function startEmailRead() {
  setLoadingMsg("Reading email…");
  showView("loading");

  var item = null;
  try { item = Office.context.mailbox.item; } catch (e) {}
  if (!item) {
    showFormError("No email is open. Please open a message in Outlook and try again.");
    showView("form");
    return;
  }

  var subject = item.subject || "";
  var from = item.from || {};
  var senderEmail = from.emailAddress || "";
  var senderName = from.displayName || "";

  item.body.getAsync(Office.CoercionType.Text, function(result) {
    var body = "";
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      body = (result.value || "").substring(0, 6000);
    }
    callAiAssist(subject, body, senderEmail, senderName);
  });
}

// ---- AI assist -----------------------------------------------------------

function callAiAssist(subject, body, senderEmail, senderName) {
  setLoadingMsg("Analyzing email with AI…");

  var payload = { description: body || subject };
  if (subject) payload.ticket_title = subject;

  request("POST", "/api/tickets/ai-assist", payload, { "x-csrf-token": getCsrfToken() }, function(err, status, data) {
    if (!err && status === 200 && data) {
      populateForm(data, subject, senderEmail, senderName, true);
    } else {
      populateForm(null, subject, senderEmail, senderName, false);
    }
  });
}

// ---- form population -----------------------------------------------------

function splitDisplayName(displayName) {
  var parts = (displayName || "").trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function populateForm(aiResult, subject, senderEmail, senderName, aiUsed) {
  var name = splitDisplayName(senderName);
  var title = subject || "";
  var description = "";
  var priority = "";
  var type = "";

  if (aiResult) {
    title = aiResult.ticket_title || title;
    description = aiResult.description || "";
    priority = aiResult.ticket_priority || "";
    type = aiResult.ticket_type || "";
  }

  document.getElementById("field-title").value = title;
  document.getElementById("field-description").value = description;
  document.getElementById("field-priority").value = priority;
  document.getElementById("field-type").value = type;
  document.getElementById("field-user-email").value = senderEmail;
  document.getElementById("field-first-name").value = name.first;
  document.getElementById("field-last-name").value = name.last;

  var aiNote = document.getElementById("ai-note");
  if (aiNote) aiNote.hidden = !aiUsed;

  clearFormError();
  showView("form");
}

// ---- ticket submission ---------------------------------------------------

function handleSubmit(e) {
  e.preventDefault();
  clearFormError();

  var btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Creating…";

  var title = document.getElementById("field-title").value.trim();
  var description = document.getElementById("field-description").value.trim();
  var priority = document.getElementById("field-priority").value;
  var type = document.getElementById("field-type").value;
  var userEmail = document.getElementById("field-user-email").value.trim();
  var firstName = document.getElementById("field-first-name").value.trim();
  var lastName = document.getElementById("field-last-name").value.trim();

  if (!title) {
    showFormError("Title is required.");
    btn.disabled = false; btn.textContent = "Create Ticket"; return;
  }
  if (!description) {
    showFormError("Description is required.");
    btn.disabled = false; btn.textContent = "Create Ticket"; return;
  }

  var payload = { ticket_title: title, description: description };
  if (priority) payload.ticket_priority = priority;
  if (type) payload.ticket_type = type;
  if (userEmail) payload.end_user_email = userEmail;
  if (firstName) payload.end_user_first_name = firstName;
  if (lastName) payload.end_user_last_name = lastName;

  request("POST", "/api/tickets", payload, { "x-csrf-token": getCsrfToken() }, function(err, status, data) {
    if (err) {
      showFormError("Network error. Is TicketGal reachable?");
      btn.disabled = false; btn.textContent = "Create Ticket"; return;
    }
    if (status === 200 || status === 202) {
      showSuccess(data);
    } else {
      var msg = (data && data.detail) ? data.detail : "Failed to create ticket. Please try again.";
      showFormError(msg);
      btn.disabled = false; btn.textContent = "Create Ticket";
    }
  });
}

function showSuccess(data) {
  var idEl = document.getElementById("success-ticket-id");
  if (idEl) {
    var ticketId = data && (data.ticket_id || (data.transaction && data.transaction.id ? "queued #" + data.transaction.id : null));
    idEl.textContent = ticketId ? "Ticket ID: " + ticketId : "";
  }
  showView("success");
}

// ---- reset ---------------------------------------------------------------

function handleNewTicket() { checkAuth(); }

// ---- init ----------------------------------------------------------------

// Attach form listeners immediately — don't wait for Office.onReady so that
// the login form is interactive even if Office.js initialisation is slow.
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("ticket-form").addEventListener("submit", handleSubmit);
  document.getElementById("new-ticket-btn").addEventListener("click", handleNewTicket);
});

// checkAuth needs the mailbox, so it still waits for Office to be ready.
Office.onReady(function() {
  checkAuth();
});
