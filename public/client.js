// ── State ──────────────────────────────────────────────────────────
let ws = null;
let myName = "";
const uploadProgressBars = new Map(); // server-broadcast upload progress from other clients

// ── DOM References ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const loginScreen = $("login-screen");
const appEl = $("app");
const nicknameIn = $("nickname");
const joinBtn = $("join-btn");
const sidebar = $("sidebar");
const sidebarToggle = $("sidebar-toggle");
const userListEl = $("user-list");
const userCountEl = $("user-count");
const fileListEl = $("file-list");
const fileCountEl = $("file-count");
const noFilesEl = $("no-files");
const messagesEl = $("messages");
const msgInput = $("msg-input");
const sendBtn = $("send-btn");
const attachBtn = $("attach-btn");
const fileInput = $("file-input");
const dragOverlay = $("drag-overlay");
const connStatus = $("conn-status");
const myUploadsEl = $("my-uploads");

const qrModal = $("qr-modal");
const qrImageEl = $("qr-image");
const qrUrlBox = $("qr-url-box");
const qrUrlEl = $("qr-url");
const qrCopiedEl = $("qr-copied");
const loginQrBtn = $("login-qr-btn");
const headerQrBtn = $("header-qr-btn");
const qrCloseBtn = $("qr-close");

// ── QR Code Logic ──────────────────────────────────────────────────
let qrLoaded = false;

function openQrModal() {
  qrModal.classList.add("active");
  if (!qrLoaded) loadQrCode();
}

function closeQrModal() {
  qrModal.classList.remove("active");
}

async function loadQrCode() {
  qrImageEl.innerHTML =
    '<span style="color:var(--text-dim);font-size:13px;">Generating QR code...</span>';
  try {
    const infoRes = await fetch("/api/info");
    const info = await infoRes.json();
    const url =
      info.urls && info.urls[0]
        ? info.urls[0]
        : `${location.protocol}//${location.host}`;

    const qrRes = await fetch("/api/qrcode");
    const svg = await qrRes.text();

    qrImageEl.innerHTML = svg;
    qrUrlEl.textContent = url;
    qrLoaded = true;
  } catch (err) {
    qrImageEl.innerHTML =
      '<span style="color:var(--red);font-size:13px;">Could not generate QR code</span>';
  }
}

qrUrlBox.addEventListener("click", () => {
  navigator.clipboard.writeText(qrUrlEl.textContent).then(() => {
    qrCopiedEl.innerHTML =
      '<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><use href="#icon-check"></use></svg> Link copied to clipboard!';
    setTimeout(() => {
      qrCopiedEl.innerHTML = "&nbsp;";
    }, 2500);
  });
});

loginQrBtn.addEventListener("click", openQrModal);
headerQrBtn.addEventListener("click", openQrModal);
qrCloseBtn.addEventListener("click", closeQrModal);
qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) closeQrModal();
});

// ── Login ──────────────────────────────────────────────────────────
joinBtn.addEventListener("click", doJoin);
nicknameIn.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doJoin();
});

function doJoin() {
  const name = nicknameIn.value.trim();
  if (!name) {
    nicknameIn.focus();
    return;
  }
  myName = name;
  loginScreen.style.display = "none";
  appEl.classList.add("active");
  connectWS();
}

// ── WebSocket ──────────────────────────────────────────────────────
function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    connStatus.innerHTML = '<span class="dot"></span><span>Online</span>';
    connStatus.style.color = "var(--green)";
    ws.send(JSON.stringify({ type: "join", name: myName }));
  };

  ws.onclose = () => {
    connStatus.innerHTML =
      '<span class="dot" style="background:var(--red);"></span><span>Disconnected</span>';
    connStatus.style.color = "var(--red)";
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {};

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleWsMessage(msg);
    } catch (_) {}
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case "message":
      renderChatMessage(msg);
      break;
    case "users":
      renderUsers(msg.list);
      break;
    case "file-list":
      renderFileList(msg.files);
      break;
    case "file-shared":
      addFileToList(msg.file);
      break;
    case "file-deleted":
      removeFileFromList(msg.fileId);
      break;
    case "upload-progress":
      renderUploadProgress(msg);
      break;
  }
}

// ── Chat Messages ──────────────────────────────────────────────────
function renderChatMessage(msg) {
  const div = document.createElement("div");

  if (msg.system) {
    div.className = "msg system";
    div.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-info"></use></svg>
      <span>${esc(msg.text)}</span>
    `;
  } else {
    const isOwn = msg.name === myName;
    div.className = `msg ${isOwn ? "own" : "other"}`;
    if (!isOwn) {
      const author = document.createElement("div");
      author.className = "msg-author";
      author.textContent = msg.name;
      div.appendChild(author);
    }
    const text = document.createElement("div");
    text.textContent = msg.text;
    div.appendChild(text);

    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = new Date(msg.time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    div.appendChild(time);
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Send Message ───────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMsg);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
});

function sendMsg() {
  const text = msgInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "message", text }));
  msgInput.value = "";
  msgInput.focus();
}

// ── Users ──────────────────────────────────────────────────────────
function renderUsers(list) {
  userCountEl.textContent = list.length;
  userListEl.innerHTML = "";
  for (const name of list) {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `<span class="user-dot"></span><span>${esc(name)}</span>`;
    userListEl.appendChild(div);
  }
}

// ── File List ──────────────────────────────────────────────────────
function renderFileList(files) {
  fileListEl.innerHTML = "";
  if (!files || files.length === 0) {
    fileListEl.innerHTML =
      '<div class="no-files" id="no-files">No files uploaded</div>';
    fileCountEl.textContent = "0";
    return;
  }
  fileCountEl.textContent = files.length;
  for (const f of files) addFileToList(f, true);
}

function addFileToList(f, batch) {
  const noF = document.getElementById("no-files");
  if (noF) noF.remove();

  if (fileListEl.querySelector(`[data-fid="${f.id}"]`)) return;

  const div = document.createElement("div");
  div.className = "file-item";
  div.dataset.fid = f.id;

  const iconInfo = getFileIconInfo(f.name);

  div.innerHTML = `
    <div class="file-icon" style="background:${iconInfo.bg}; color:${iconInfo.color};">
      <svg class="svg-icon" viewBox="0 0 24 24"><use href="#${iconInfo.id}"></use></svg>
    </div>
    <div class="file-info">
      <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
      <div class="file-meta">${formatSize(f.size)} · ${esc(f.uploadedBy)}</div>
    </div>
    <button class="file-delete" title="Delete file">
      <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-trash"></use></svg>
    </button>
  `;

  // Download on click
  div.querySelector(".file-info").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = `/download/${f.id}/${encodeURIComponent(f.name)}`;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Delete
  div.querySelector(".file-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm(`Delete "${f.name}"?`)) {
      fetch(`/files/${f.id}`, { method: "DELETE" });
    }
  });

  fileListEl.appendChild(div);
  if (!batch) {
    const count = fileListEl.querySelectorAll(".file-item").length;
    fileCountEl.textContent = count;
  }
}

function removeFileFromList(fileId) {
  const el = fileListEl.querySelector(`[data-fid="${fileId}"]`);
  if (el) el.remove();
  const count = fileListEl.querySelectorAll(".file-item").length;
  fileCountEl.textContent = count;
  if (count === 0) {
    fileListEl.innerHTML =
      '<div class="no-files" id="no-files">No files uploaded</div>';
  }
}

// ── Upload Progress in Chat (Broadcast) ────────────────────────────
function renderUploadProgress(msg) {
  const percent =
    msg.totalSize > 0
      ? Math.round((msg.bytesReceived / msg.totalSize) * 100)
      : 0;
  let bar = uploadProgressBars.get(msg.fileId);

  if (!bar) {
    bar = document.createElement("div");
    bar.className = "upload-bar";
    bar.innerHTML = `
      <div class="upload-bar-header">
        <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-upload"></use></svg>
        <span class="upload-bar-name">${esc(msg.userName)} is uploading: ${esc(msg.fileName)}</span>
      </div>
      <div class="ub-track"><div class="ub-fill" style="width:0%"></div></div>
      <div class="ub-status">
        <span class="ub-pct">0%</span>
        <span class="ub-size">0 / ${formatSize(msg.totalSize)}</span>
      </div>
    `;
    messagesEl.appendChild(bar);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    uploadProgressBars.set(msg.fileId, bar);
  }

  bar.querySelector(".ub-fill").style.width = percent + "%";
  bar.querySelector(".ub-pct").textContent = percent + "%";
  bar.querySelector(".ub-size").textContent =
    `${formatSize(msg.bytesReceived)} / ${formatSize(msg.totalSize)}`;

  if (msg.bytesReceived >= msg.totalSize && msg.totalSize > 0) {
    setTimeout(() => {
      bar.remove();
      uploadProgressBars.delete(msg.fileId);
    }, 2000);
  }
}

// ── File Upload (Streaming Direct via XHR) ──────────────────────────
attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  for (const file of fileInput.files) uploadFile(file);
  fileInput.value = "";
});

function uploadFile(file) {
  const id = Math.random().toString(36).slice(2, 10);

  const div = document.createElement("div");
  div.className = "my-upload-item";
  div.id = `upload-${id}`;
  div.innerHTML = `
    <div class="my-upload-header">
      <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-upload"></use></svg>
      <span class="my-upload-name">${esc(file.name)}</span>
    </div>
    <div class="my-upload-track"><div class="my-upload-fill" style="width:0%"></div></div>
    <div class="my-upload-status">
      <span class="my-upload-pct">0%</span>
      <span class="my-upload-size">0 / ${formatSize(file.size)}</span>
    </div>
  `;
  myUploadsEl.appendChild(div);

  const xhr = new XMLHttpRequest();
  xhr.open(
    "POST",
    `/upload?name=${encodeURIComponent(file.name)}&user=${encodeURIComponent(myName)}`,
  );
  xhr.timeout = 0; // Infinite timeout for up to 100GB files

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      div.querySelector(".my-upload-fill").style.width = pct + "%";
      div.querySelector(".my-upload-pct").textContent = pct + "%";
      div.querySelector(".my-upload-size").textContent =
        `${formatSize(e.loaded)} / ${formatSize(e.total)}`;
    }
  };

  xhr.onload = () => {
    div.classList.add("done");
    div.querySelector(".my-upload-fill").style.width = "100%";
    div.querySelector(".my-upload-pct").innerHTML =
      '<svg class="svg-icon" viewBox="0 0 24 24" style="width:13px;height:13px;color:var(--green);"><use href="#icon-check"></use></svg> Done';
    setTimeout(() => div.remove(), 3500);
  };

  xhr.onerror = () => {
    div.classList.add("error");
    div.querySelector(".my-upload-pct").innerHTML =
      '<svg class="svg-icon" viewBox="0 0 24 24" style="width:13px;height:13px;color:var(--red);"><use href="#icon-x"></use></svg> Upload failed';
  };

  xhr.send(file);
}

// ── Drag & Drop ────────────────────────────────────────────────────
let dragCounter = 0;
document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (appEl.classList.contains("active")) dragOverlay.classList.add("active");
});
document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dragOverlay.classList.remove("active");
  }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.remove("active");
  if (!appEl.classList.contains("active")) return;
  for (const file of e.dataTransfer.files) uploadFile(file);
});

// ── Mobile Sidebar Toggle ──────────────────────────────────────────
sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", (e) => {
  if (
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    e.target !== sidebarToggle
  ) {
    sidebar.classList.remove("open");
  }
});

// ── Helpers ────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function getFileIconInfo(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase();

  if (
    ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"].includes(ext)
  ) {
    return {
      id: "icon-file-image",
      bg: "rgba(59, 130, 246, 0.15)",
      color: "#60a5fa",
    };
  }
  if (["mp4", "mkv", "avi", "mov", "webm", "wmv", "flv"].includes(ext)) {
    return {
      id: "icon-file-video",
      bg: "rgba(168, 85, 247, 0.15)",
      color: "#c084fc",
    };
  }
  if (["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(ext)) {
    return {
      id: "icon-file-audio",
      bg: "rgba(234, 179, 8, 0.15)",
      color: "#facc15",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
    return {
      id: "icon-file-zip",
      bg: "rgba(249, 115, 22, 0.15)",
      color: "#fb923c",
    };
  }
  if (
    [
      "js",
      "ts",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "html",
      "css",
      "json",
      "sql",
      "php",
      "sh",
    ].includes(ext)
  ) {
    return {
      id: "icon-file-code",
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
    };
  }
  if (
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(
      ext,
    )
  ) {
    return {
      id: "icon-file-doc",
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#f87171",
    };
  }
  return {
    id: "icon-file-default",
    bg: "rgba(107, 114, 128, 0.15)",
    color: "#9ca3af",
  };
}
