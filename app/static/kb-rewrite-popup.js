function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

const resultEl = document.getElementById("kb-rewrite-result");
const statusEl = document.getElementById("kb-rewrite-status");
const insertBtn = document.getElementById("kb-rewrite-insert");
const replaceBtn = document.getElementById("kb-rewrite-replace");
const closeBtn = document.getElementById("kb-rewrite-close");

function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = safeText(text);
  }
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (safeText(event.data?.type).trim() !== "kb-rewrite-popup-data") return;
  if (resultEl) {
    resultEl.value = safeText(event.data?.rewritten_text);
    resultEl.focus();
  }
});

function postApply(mode) {
  if (!window.opener || window.opener.closed) {
    setStatus("Editor window is unavailable.");
    return;
  }
  const rewrittenText = safeText(resultEl?.value).trim();
  if (!rewrittenText) {
    setStatus("Nothing to apply.");
    return;
  }
  window.opener.postMessage(
    { type: "kb-rewrite-apply", mode, rewritten_text: rewrittenText },
    window.location.origin,
  );
  setStatus("Applied to editor.");
}

if (insertBtn) {
  insertBtn.addEventListener("click", () => postApply("insert"));
}

if (replaceBtn) {
  replaceBtn.addEventListener("click", () => postApply("replace"));
}

if (closeBtn) {
  closeBtn.addEventListener("click", () => window.close());
}

if (window.opener && !window.opener.closed) {
  window.opener.postMessage({ type: "kb-rewrite-ready" }, window.location.origin);
}
