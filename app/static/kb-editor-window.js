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
  const normalized = safeText(method).toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
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

const titleEl = document.getElementById("kb-window-title");
const titleInput = document.getElementById("kb-window-title-input");
const visibilitySelect = document.getElementById("kb-window-visibility");
const customerLabel = document.getElementById("kb-window-customer-label");
const customerSelect = document.getElementById("kb-window-customer-id");
const editorHost = document.getElementById("kb-window-editor-host");
const previewEl = document.getElementById("kb-window-preview");
const uploadHint = document.getElementById("kb-window-upload-hint");
const saveBtn = document.getElementById("kb-window-save");
const deleteBtn = document.getElementById("kb-window-delete");
const closeBtn = document.getElementById("kb-window-close");
const statusEl = document.getElementById("kb-window-status");

const query = new URLSearchParams(window.location.search);
const articleSlug = safeText(query.get("slug")).trim();
let currentArticle = null;
let kbEditor = null;

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = safeText(message);
  }
}

function isSafeHref(href) {
  const value = safeText(href).trim();
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:|mailto:|tel:)/i.test(value);
}

function isSafeImageSrc(src) {
  const value = safeText(src).trim();
  if (!value) return false;
  return value.startsWith("/") || /^https?:/i.test(value) || /^data:image\//i.test(value);
}

function sanitizePreviewElement(root) {
  if (!root) return;
  const allowedTags = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "strong", "b", "em", "i", "u",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "a", "img", "hr", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
  ]);
  const allowedAttrs = new Set(["href", "src", "alt", "class"]);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
  const toUnwrap = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const tagName = safeText(node.tagName).toLowerCase();
    if (!allowedTags.has(tagName)) {
      toUnwrap.push(node);
      continue;
    }

    Array.from(node.attributes).forEach((attr) => {
      if (!allowedAttrs.has(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });

    if (tagName === "a") {
      const href = safeText(node.getAttribute("href")).trim();
      if (!isSafeHref(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("rel", "noopener noreferrer nofollow");
        if (!href.startsWith("/") && !href.startsWith("#") && !/^mailto:|^tel:/i.test(href)) {
          node.setAttribute("target", "_blank");
        }
      }
    }

    if (tagName === "img") {
      const src = safeText(node.getAttribute("src")).trim();
      if (!isSafeImageSrc(src)) {
        node.removeAttribute("src");
      }
      node.setAttribute("loading", "lazy");
    }
  }

  toUnwrap.forEach((node) => {
    while (node.firstChild) {
      node.parentNode.insertBefore(node.firstChild, node);
    }
    node.parentNode.removeChild(node);
  });
}

function renderPreview() {
  if (!previewEl) return;
  const content = getEditorContent();
  if (!content.trim()) {
    previewEl.innerHTML = '<p class="muted">Preview will appear here as you type.</p>';
    return;
  }

  const parseMarkdown =
    typeof marked !== "undefined"
      ? typeof marked.parse === "function"
        ? (src) => marked.parse(src)
        : typeof marked === "function"
        ? (src) => marked(src)
        : null
      : null;

  if (!parseMarkdown) {
    previewEl.textContent = content;
    return;
  }

  try {
    const rendered = parseMarkdown(content);
    previewEl.innerHTML = typeof rendered === "string" ? rendered : content;
    sanitizePreviewElement(previewEl);
  } catch {
    previewEl.textContent = content;
  }
}

function normalizeVisibilityControls() {
  if (!visibilitySelect || !customerLabel) return;
  customerLabel.style.display = visibilitySelect.value === "company_assigned" ? "block" : "none";
}

function isKBImageFile(file) {
  if (!file) return false;
  const fileType = safeText(file.type).toLowerCase();
  if (fileType.startsWith("image/")) return true;
  const fileName = safeText(file.name).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((extension) => fileName.endsWith(extension));
}

function notifyParent(type, slug) {
  if (!window.opener || window.opener.closed) return;
  try {
    window.opener.postMessage({ type, slug }, window.location.origin);
  } catch {
    // Ignore cross-window messaging failures.
  }
}

async function loadProperties() {
  if (!customerSelect) return;
  try {
    const result = await api("/api/admin/properties");
    const items = Array.isArray(result?.items) ? result.items : [];
    const options = items
      .map((property) => {
        const customerId = property.customer_id ?? property.CustomerID ?? "";
        const customerName = property.customer_name ?? property.CustomerName ?? "";
        return `<option value="${safeText(customerId)}">${safeText(customerName)}</option>`;
      })
      .join("");
    customerSelect.innerHTML = '<option value="">-- Select a property --</option>' + options;
  } catch (error) {
    setStatus(`Failed to load properties: ${safeText(error.message)}`);
  }
}

function createEditor() {
  if (!editorHost) return;
  const textarea = document.createElement("textarea");
  textarea.id = "kb-window-editor-textarea";
  textarea.rows = 18;
  editorHost.appendChild(textarea);

  if (typeof window.CodeMirror !== "undefined" && typeof window.CodeMirror.fromTextArea === "function") {
    kbEditor = window.CodeMirror.fromTextArea(textarea, {
      mode: "markdown",
      lineNumbers: true,
      lineWrapping: true,
      viewportMargin: Infinity,
    });
    kbEditor.on("change", () => {
      renderPreview();
    });
    if (uploadHint) {
      uploadHint.textContent = "Markdown syntax highlighting is enabled. Drag a PNG, JPG, GIF, or WebP image into the editor to upload and insert markdown.";
    }
  } else {
    kbEditor = {
      getValue: () => textarea.value,
      setValue: (value) => {
        textarea.value = safeText(value);
      },
      replaceSelection: (value) => {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
      },
      focus: () => textarea.focus(),
      getWrapperElement: () => textarea,
    };
    if (uploadHint) {
      uploadHint.textContent = "CodeMirror did not load, using plain textarea. Drag a PNG, JPG, GIF, or WebP image into the editor to upload and insert markdown.";
    }
    textarea.addEventListener("input", () => {
      renderPreview();
    });
  }
}

function getEditorContent() {
  return kbEditor && typeof kbEditor.getValue === "function" ? kbEditor.getValue() : "";
}

function setEditorContent(value) {
  if (kbEditor && typeof kbEditor.setValue === "function") {
    kbEditor.setValue(safeText(value));
    kbEditor.focus();
    renderPreview();
  }
}

function insertEditorText(value) {
  if (kbEditor && typeof kbEditor.replaceSelection === "function") {
    kbEditor.focus();
    kbEditor.replaceSelection(value, "end");
    renderPreview();
  }
}

async function uploadKBImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  return api("/api/knowledgebase/assets", {
    method: "POST",
    body: formData,
  });
}

async function handleImageDrop(fileList) {
  const files = Array.from(fileList || []).filter((file) => isKBImageFile(file));
  if (!files.length) {
    setStatus("Drop a PNG, JPG, GIF, or WebP image into the editor.");
    return;
  }

  setStatus(files.length === 1 ? "Uploading image..." : `Uploading ${files.length} images...`);
  try {
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadKBImage(file));
    }

    const markdownBlock = uploaded
      .map((result) => safeText(result?.markdown).trim())
      .filter(Boolean)
      .join("\n\n");

    if (markdownBlock) {
      const current = getEditorContent();
      const prefix = current && !current.endsWith("\n") ? "\n" : "";
      insertEditorText(`${prefix}${markdownBlock}\n`);
    }

    const lastUrl = safeText(uploaded[uploaded.length - 1]?.url).trim();
    let copied = false;
    if (lastUrl && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(lastUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    setStatus(copied
      ? "Image uploaded. Markdown inserted and URL copied to clipboard."
      : "Image uploaded and markdown inserted.");
  } catch (error) {
    setStatus(`Image upload failed: ${safeText(error.message)}`);
  }
}

function bindEditorDrop() {
  const wrapper = kbEditor && typeof kbEditor.getWrapperElement === "function"
    ? kbEditor.getWrapperElement()
    : editorHost;
  if (!wrapper || wrapper.dataset.uploadBound === "true") return;

  const onDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorHost.classList.add("dragover");
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorHost.classList.remove("dragover");
  };

  const onDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorHost.classList.remove("dragover");
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      await handleImageDrop(files);
    }
  };

  wrapper.addEventListener("dragenter", onDragOver);
  wrapper.addEventListener("dragover", onDragOver);
  wrapper.addEventListener("dragleave", onDragLeave);
  wrapper.addEventListener("drop", onDrop);
  wrapper.dataset.uploadBound = "true";
}

async function loadArticleIfEditing() {
  if (!articleSlug) return;
  const article = await api(`/api/knowledgebase/articles/${encodeURIComponent(articleSlug)}`);
  currentArticle = article;

  if (titleEl) {
    titleEl.textContent = "Edit Article";
  }
  if (titleInput) {
    titleInput.value = safeText(article.title);
  }
  if (visibilitySelect) {
    visibilitySelect.value = safeText(article.visibility_type) || "public";
  }
  if (customerSelect) {
    customerSelect.value = article.restricted_to_customer_id ? String(article.restricted_to_customer_id) : "";
  }
  if (deleteBtn) {
    deleteBtn.style.display = "inline-flex";
  }
  setEditorContent(article.content || "");
  normalizeVisibilityControls();
}

async function saveArticle() {
  const title = safeText(titleInput?.value).trim();
  const visibility = safeText(visibilitySelect?.value).trim() || "public";
  const customerId = safeText(customerSelect?.value).trim();
  const content = safeText(getEditorContent()).trim();

  if (!title || !content) {
    setStatus("Title and content are required.");
    return;
  }

  setStatus("Saving...");

  const payload = {
    title,
    visibility_type: visibility,
    content,
  };
  if (visibility === "company_assigned" && customerId) {
    payload.restricted_to_customer_id = Number(customerId);
  }

  try {
    const isEdit = Boolean(currentArticle && currentArticle.slug);
    const result = await api(
      isEdit ? `/api/knowledgebase/articles/${encodeURIComponent(currentArticle.slug)}` : "/api/knowledgebase/articles",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const savedSlug = safeText(result?.slug || currentArticle?.slug).trim();
    notifyParent("kb-editor-saved", savedSlug);
    setStatus("Saved successfully.");

    setTimeout(() => {
      window.close();
    }, 300);
  } catch (error) {
    setStatus(`Save failed: ${safeText(error.message)}`);
  }
}

async function deleteArticle() {
  if (!currentArticle || !currentArticle.slug) return;
  if (!window.confirm("Delete this article?")) return;

  setStatus("Deleting...");
  try {
    await api(`/api/knowledgebase/articles/${encodeURIComponent(currentArticle.slug)}`, { method: "DELETE" });
    notifyParent("kb-editor-deleted", currentArticle.slug);
    setStatus("Deleted.");
    setTimeout(() => {
      window.close();
    }, 250);
  } catch (error) {
    setStatus(`Delete failed: ${safeText(error.message)}`);
  }
}

function bindEvents() {
  if (visibilitySelect) {
    visibilitySelect.addEventListener("change", normalizeVisibilityControls);
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", saveArticle);
  }
  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteArticle);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => window.close());
  }
}

async function init() {
  try {
    createEditor();
    bindEditorDrop();
    renderPreview();
    await loadProperties();
    normalizeVisibilityControls();
    await loadArticleIfEditing();
    bindEvents();
  } catch (error) {
    setStatus(`Failed to load editor: ${safeText(error.message)}`);
  }
}

init();
