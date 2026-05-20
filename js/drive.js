// js/drive.js — Drive UI and file management
import {
  listenToFiles, uploadFile, createFolderRecord, updateFile,
  trashFile, restoreFile, deleteFile, setShareToken,
  getStorageUsage, getStorageLimit, emptyTrash
} from "./storage.js";
import {
  showToast, openModal, closeModal, formatBytes, formatDate,
  getFileIcon, isImage, isVideo, isAudio, isText, isPdf, generateToken
} from "./ui.js";

let _uid = null;
let _isAnon = false;
let _allFiles = [];
let _currentSection = "my-drive";
let _currentFolder = "root";
let _folderStack = []; // [{id, name}]
let _viewMode = "grid"; // grid | list
let _ctxTarget = null;
let _unsubscribe = null;

// ===== PLANS DATA =====
const PLANS = {
  personal: [
    {
      id: "free", name: "Gratuito", storage: "15 GB", featured: false,
      features: ["15 GB almacenamiento", "IA básica", "200 créditos IA únicos"],
      monthly: "0", annual: "0"
    },
    {
      id: "plus", name: "Plus", storage: "125 GB", featured: true,
      features: ["125 GB almacenamiento", "350 créditos IA/mes", "IA avanzada básica"],
      monthly: "0,49", monthlyAfter: "1,99", annual: "15,99", annualAfter: "22,99"
    },
    {
      id: "pro", name: "Pro", storage: "350 GB", featured: false,
      features: ["350 GB almacenamiento", "750 créditos IA/mes", "IA premium", "Herramientas profesionales"],
      monthly: "19,99", annual: "199,99"
    }
  ],
  empresa: [
    {
      id: "empresa-free", name: "Empresa Gratuito", storage: "Básico", featured: false,
      features: ["Almacenamiento básico", "IA básica", "Colaboración simple"],
      monthly: "0", annual: "0"
    },
    {
      id: "business-pro", name: "Business Pro", storage: "500 TB", featured: true,
      features: ["500 TB almacenamiento", "2.000–5.000 créditos IA", "IA empresarial", "Seguridad avanzada"],
      monthly: "59,99", annual: "719,88"
    },
    {
      id: "business-infinity", name: "Business Infinity", storage: "1000 TB", featured: false,
      features: ["1000 TB almacenamiento", "Créditos IA ilimitados", "IA corporativa avanzada", "APIs y automatización"],
      monthly: "79,99", annual: "959,88"
    }
  ]
};

// ===== INIT DRIVE =====
export function initDrive(user) {
  _uid = user.uid;
  _isAnon = user.isAnonymous || _uid === "anon";
  _currentSection = "my-drive";
  _currentFolder = "root";
  _folderStack = [];

  updateUserUI(user);
  setupDragDrop();

  if (_isAnon) {
    _allFiles = [];
    renderFiles();
    return;
  }

  if (_unsubscribe) _unsubscribe();
  _unsubscribe = listenToFiles(_uid, files => {
    _allFiles = files;
    renderFiles();
    updateStorageUI();
  });
}

// ===== USER UI =====
function updateUserUI(user) {
  const avatar = document.getElementById("user-avatar");
  const displayName = document.getElementById("user-display-name");
  const emailShort = document.getElementById("user-email-short");

  if (user.photoURL) {
    avatar.innerHTML = `<img src="${user.photoURL}" alt="avatar" />`;
  } else {
    const initials = (user.displayName || user.email || "A").slice(0, 1).toUpperCase();
    avatar.textContent = initials;
  }
  displayName.textContent = user.displayName || "Usuario";
  emailShort.textContent = user.email || (user.isAnonymous ? "Anónimo" : "—");
}

// ===== STORAGE UI =====
async function updateStorageUI() {
  if (_isAnon) return;
  const used = await getStorageUsage(_uid);
  const limit = await getStorageLimit(_uid);
  const pct = Math.min((used / limit) * 100, 100);
  const limitGB = limit / (1024 ** 3);
  document.getElementById("storage-used-label").textContent =
    `${formatBytes(used)} de ${limitGB >= 1000 ? formatBytes(limit) : limitGB + " GB"}`;
  document.getElementById("storage-fill").style.width = pct + "%";
}

// ===== NAVIGATE =====
window.navigateTo = function(section) {
  _currentSection = section;
  _currentFolder = "root";
  _folderStack = [];

  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.section === section);
  });

  const titles = {
    "my-drive": "Mi unidad",
    "shared": "Compartidos conmigo",
    "starred": "Destacados",
    "backup": "Copias de seguridad",
    "trash": "Papelera",
  };
  document.getElementById("section-title").textContent = titles[section] || section;
  updateBreadcrumb();
  renderFiles();
};

// ===== OPEN FOLDER =====
function openFolder(folder) {
  _folderStack.push({ id: _currentFolder, name: _currentFolder === "root" ? "Mi unidad" : folder.name });
  _currentFolder = folder.id;
  updateBreadcrumb();
  renderFiles();
}

// ===== BREADCRUMB =====
function updateBreadcrumb() {
  const bc = document.getElementById("breadcrumb");
  bc.innerHTML = "";

  const rootCrumb = document.createElement("span");
  rootCrumb.className = "crumb";
  rootCrumb.textContent = _currentSection === "my-drive" ? "Mi unidad" :
    { shared: "Compartidos", starred: "Destacados", backup: "Copias de seguridad", trash: "Papelera" }[_currentSection];
  rootCrumb.onclick = () => { _folderStack = []; _currentFolder = "root"; updateBreadcrumb(); renderFiles(); };
  bc.appendChild(rootCrumb);

  _folderStack.forEach((crumb, i) => {
    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = "/";
    bc.appendChild(sep);

    const el = document.createElement("span");
    el.className = "crumb";
    el.textContent = crumb.name;
    el.onclick = () => {
      _folderStack = _folderStack.slice(0, i + 1);
      _currentFolder = crumb.id;
      updateBreadcrumb();
      renderFiles();
    };
    bc.appendChild(el);
  });

  if (_folderStack.length > 0) {
    const last = bc.lastElementChild;
    last.className = "crumb active";
  } else {
    rootCrumb.className = "crumb active";
  }
}

// ===== GET VISIBLE FILES =====
function getVisibleFiles() {
  if (_currentSection === "trash") {
    return _allFiles.filter(f => f.trashed);
  }
  if (_currentSection === "starred") {
    return _allFiles.filter(f => f.starred && !f.trashed);
  }
  if (_currentSection === "shared") {
    return _allFiles.filter(f => f.shared && !f.trashed);
  }
  if (_currentSection === "backup") {
    return []; // placeholder
  }
  // my-drive
  return _allFiles.filter(f => f.parent === _currentFolder && !f.trashed);
}

// ===== RENDER FILES =====
function renderFiles(searchQuery = "") {
  const grid = document.getElementById("files-grid");
  const empty = document.getElementById("files-empty");
  grid.className = `files-grid${_viewMode === "list" ? " list-view" : ""}`;

  let files = getVisibleFiles();
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    files = _allFiles.filter(f => !f.trashed && f.name?.toLowerCase().includes(q));
  }

  if (files.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Folders first, then files, sorted by date desc
  const sorted = [...files].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  grid.innerHTML = "";
  sorted.forEach((file, i) => {
    const card = createFileCard(file, i);
    grid.appendChild(card);
  });
}

// ===== CREATE FILE CARD =====
function createFileCard(file, index) {
  const card = document.createElement("div");
  card.className = `file-card${file.starred ? " starred" : ""}`;
  card.style.animationDelay = `${index * 0.03}s`;
  card.dataset.id = file.id;

  // Thumbnail
  const thumb = document.createElement("div");
  thumb.className = "file-thumb";

  if (file.type === "folder") {
    thumb.innerHTML = `<span class="file-icon">📁</span>`;
    card.addEventListener("dblclick", () => openFolder(file));
  } else if (isImage(file.name, file.type) && file.storage?.type === "base64" && file.storage?.data) {
    const img = document.createElement("img");
    img.src = file.storage.data;
    img.loading = "lazy";
    img.alt = file.name;
    thumb.appendChild(img);
  } else if (isVideo(file.name, file.type) && file.storage?.type === "base64" && file.storage?.data) {
    const vid = document.createElement("video");
    vid.src = file.storage.data;
    vid.preload = "metadata";
    thumb.appendChild(vid);
  } else {
    thumb.innerHTML = `<span class="file-icon">${getFileIcon(file.name, file.type)}</span>`;
  }

  // Info
  const info = document.createElement("div");
  info.className = "file-info";

  const name = document.createElement("div");
  name.className = "file-name";
  name.textContent = file.name;
  name.title = file.name;

  const meta = document.createElement("div");
  meta.className = "file-meta";

  const size = document.createElement("span");
  size.textContent = file.type === "folder" ? "Carpeta" : formatBytes(file.size);

  const starBtn = document.createElement("button");
  starBtn.className = "file-star";
  starBtn.title = file.starred ? "Quitar de destacados" : "Destacar";
  starBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="${file.starred ? 'var(--warning)' : 'none'}" stroke="${file.starred ? 'var(--warning)' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  starBtn.onclick = e => { e.stopPropagation(); toggleStar(file); };

  meta.appendChild(size);
  meta.appendChild(starBtn);
  info.appendChild(name);
  info.appendChild(meta);

  card.appendChild(thumb);
  card.appendChild(info);

  // Context menu
  card.addEventListener("contextmenu", e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, file);
  });

  // Click to preview (not folder)
  if (file.type !== "folder") {
    card.addEventListener("click", () => previewFile(file));
  }

  return card;
}

// ===== STAR TOGGLE =====
async function toggleStar(file) {
  if (_isAnon) return;
  await updateFile(_uid, file.id, { starred: !file.starred });
}

// ===== PREVIEW =====
window.previewFile = function(file) {
  document.getElementById("preview-filename").textContent = file.name;
  const body = document.getElementById("preview-body");
  body.innerHTML = "";

  window._previewFile = file;

  const data = file.storage?.data;
  const name = file.name;
  const type = file.type;

  if (!data && file.storage?.type !== "base64") {
    body.innerHTML = `<div class="preview-unsupported"><span style="font-size:48px">${getFileIcon(name, type)}</span><p>Vista previa no disponible para archivos de Puter</p><button class="btn-ghost" onclick="downloadPreviewFile()">Descargar</button></div>`;
    openModal("preview-modal");
    return;
  }

  if (isImage(name, type)) {
    const img = document.createElement("img");
    img.src = data;
    img.alt = name;
    body.appendChild(img);
  } else if (isVideo(name, type)) {
    const vid = document.createElement("video");
    vid.src = data;
    vid.controls = true;
    vid.autoplay = false;
    body.appendChild(vid);
  } else if (isAudio(name, type)) {
    const aud = document.createElement("audio");
    aud.src = data;
    aud.controls = true;
    body.appendChild(aud);
  } else if (isPdf(name)) {
    const iframe = document.createElement("iframe");
    iframe.src = data;
    body.appendChild(iframe);
  } else if (isText(name)) {
    // Decode base64 text
    try {
      const raw = atob(data.split(",")[1] || data);
      const pre = document.createElement("pre");
      pre.className = "preview-text";
      pre.textContent = raw;
      body.appendChild(pre);
    } catch {
      body.innerHTML = `<div class="preview-unsupported"><p>No se pudo leer el archivo</p></div>`;
    }
  } else {
    body.innerHTML = `<div class="preview-unsupported"><span style="font-size:48px">${getFileIcon(name, type)}</span><p>Vista previa no disponible</p><button class="btn-ghost" onclick="downloadPreviewFile()">Descargar</button></div>`;
  }

  openModal("preview-modal");
};

window.downloadPreviewFile = function() {
  const file = window._previewFile;
  if (!file) return;
  if (file.storage?.data) {
    const a = document.createElement("a");
    a.href = file.storage.data;
    a.download = file.name;
    a.click();
  }
};

// ===== CONTEXT MENU =====
function showContextMenu(x, y, file) {
  _ctxTarget = file;
  const menu = document.getElementById("context-menu");
  menu.classList.remove("hidden");

  // Position within viewport
  const menuW = 200, menuH = 250;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);
  menu.style.left = left + "px";
  menu.style.top = top + "px";
}

window.ctxOpen = function() {
  if (_ctxTarget) {
    if (_ctxTarget.type === "folder") openFolder(_ctxTarget);
    else previewFile(_ctxTarget);
  }
  hideContextMenu();
};
window.ctxShare = function() { if (_ctxTarget) showShareModal(_ctxTarget); hideContextMenu(); };
window.ctxDownload = function() {
  if (_ctxTarget?.storage?.data) {
    const a = document.createElement("a");
    a.href = _ctxTarget.storage.data;
    a.download = _ctxTarget.name;
    a.click();
  }
  hideContextMenu();
};
window.ctxRename = function() {
  if (_ctxTarget) {
    document.getElementById("rename-input").value = _ctxTarget.name;
    openModal("rename-modal");
  }
  hideContextMenu();
};
window.ctxStar = function() { if (_ctxTarget) toggleStar(_ctxTarget); hideContextMenu(); };
window.ctxTrash = async function() {
  if (_ctxTarget) {
    await trashFile(_uid, _ctxTarget.id);
    showToast(`"${_ctxTarget.name}" movido a papelera`);
  }
  hideContextMenu();
};
function hideContextMenu() { document.getElementById("context-menu").classList.add("hidden"); }

// ===== SHARE MODAL =====
function showShareModal(file) {
  let token = file.shareToken || generateToken();
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${token}`;
  document.getElementById("share-link-input").value = shareUrl;

  const toggle = document.getElementById("public-toggle");
  if (file.shared) toggle.classList.add("on");
  else toggle.classList.remove("on");

  document.getElementById("share-status-note").textContent =
    file.shared ? "Cualquiera con el link puede ver este archivo." : "El acceso está restringido.";

  window._shareFile = { ...file, shareToken: token };
  openModal("share-modal");
}

window.togglePublicAccess = async function() {
  const file = window._shareFile;
  if (!file || _isAnon) return;
  const toggle = document.getElementById("public-toggle");
  const newState = !toggle.classList.contains("on");
  toggle.classList.toggle("on", newState);

  const token = file.shareToken || generateToken();
  await setShareToken(_uid, file.id, token, newState);
  window._shareFile = { ...file, shared: newState, shareToken: token };

  document.getElementById("share-status-note").textContent =
    newState ? "Cualquiera con el link puede ver este archivo." : "El acceso está restringido.";
};

window.copyShareLink = function() {
  const input = document.getElementById("share-link-input");
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "¡Copiado!";
    setTimeout(() => btn.textContent = "Copiar", 2000);
  });
};

// ===== RENAME =====
window.confirmRename = async function() {
  const newName = document.getElementById("rename-input").value.trim();
  if (!newName || !_ctxTarget) return;
  await updateFile(_uid, _ctxTarget.id, { name: newName });
  showToast("Renombrado correctamente");
  closeModal("rename-modal");
};

// ===== NEW MENU =====
window.showNewMenu = function() {
  const menu = document.getElementById("new-menu");
  const btn = document.querySelector(".new-btn");
  const rect = btn.getBoundingClientRect();
  menu.style.left = rect.left + "px";
  menu.style.top = (rect.bottom + 6) + "px";
  menu.classList.toggle("hidden");
};

window.openUploadFile = function() {
  document.getElementById("file-input").click();
  document.getElementById("new-menu").classList.add("hidden");
};
window.openUploadFolder = function() {
  document.getElementById("folder-input").click();
  document.getElementById("new-menu").classList.add("hidden");
};
window.createFolder = function() {
  document.getElementById("folder-name-input").value = "";
  openModal("folder-modal");
  document.getElementById("new-menu").classList.add("hidden");
};
window.confirmCreateFolder = async function() {
  const name = document.getElementById("folder-name-input").value.trim() || "Sin título";
  if (_isAnon) { showToast("Los usuarios anónimos no pueden crear carpetas."); return; }
  await createFolderRecord(_uid, name, _currentFolder);
  showToast(`Carpeta "${name}" creada`);
  closeModal("folder-modal");
};

// ===== FILE UPLOAD HANDLER =====
window.handleFileUpload = async function(fileList) {
  if (_isAnon) { showToast("Los usuarios anónimos no pueden subir archivos."); return; }
  const files = Array.from(fileList);
  if (files.length === 0) return;

  const toast = document.getElementById("upload-toast");
  const list = document.getElementById("upload-list");
  list.innerHTML = "";
  toast.classList.remove("hidden");

  for (const file of files) {
    const itemId = "up-" + Math.random().toString(36).slice(2);
    const item = document.createElement("div");
    item.className = "upload-item";
    item.innerHTML = `
      <div class="upload-item-name">
        <span>${file.name.length > 28 ? file.name.slice(0,28)+"…" : file.name}</span>
        <span id="${itemId}-pct">0%</span>
      </div>
      <div class="upload-progress-bar">
        <div class="upload-progress-fill" id="${itemId}-bar" style="width:0%"></div>
      </div>`;
    list.appendChild(item);

    try {
      await uploadFile(file, _uid, _currentFolder, pct => {
        document.getElementById(`${itemId}-pct`).textContent = pct + "%";
        document.getElementById(`${itemId}-bar`).style.width = pct + "%";
      });
      document.getElementById(`${itemId}-pct`).textContent = "✓";
      document.getElementById(`${itemId}-bar`).style.background = "var(--success)";
    } catch (err) {
      if (err.message !== "Anonymous" && err.message !== "StorageFull") {
        document.getElementById(`${itemId}-pct`).textContent = "✗";
        document.getElementById(`${itemId}-bar`).style.background = "var(--danger)";
        showToast(`Error al subir ${file.name}`);
      }
    }
  }

  setTimeout(() => {
    toast.classList.add("hidden");
    list.innerHTML = "";
  }, 3000);

  // Reset file input
  document.getElementById("file-input").value = "";
  document.getElementById("folder-input").value = "";
};

window.closeUploadToast = function() {
  document.getElementById("upload-toast").classList.add("hidden");
};

// ===== SEARCH =====
window.searchFiles = function(query) {
  renderFiles(query);
};

// ===== VIEW TOGGLE =====
window.toggleView = function() {
  _viewMode = _viewMode === "grid" ? "list" : "grid";
  document.getElementById("view-icon-grid").style.display = _viewMode === "grid" ? "block" : "none";
  document.getElementById("view-icon-list").style.display = _viewMode === "list" ? "block" : "none";
  renderFiles();
};

// ===== SIDEBAR TOGGLE =====
window.toggleSidebar = function() {
  document.getElementById("sidebar").classList.toggle("open");
};

// ===== DRAG & DROP =====
function setupDragDrop() {
  const main = document.querySelector(".drive-main");
  const overlay = document.getElementById("drop-overlay");
  if (!main) return;

  let dragCounter = 0;
  main.addEventListener("dragenter", e => { e.preventDefault(); dragCounter++; overlay.classList.add("active"); });
  main.addEventListener("dragleave", () => { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; overlay.classList.remove("active"); } });
  main.addEventListener("dragover", e => e.preventDefault());
  main.addEventListener("drop", e => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove("active");
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files);
  });
}

// ===== PLANS =====
let _planPeriod = "monthly";
window.showPlans = function() {
  renderPlans();
  openModal("plans-modal");
};
window.setPeriod = function(period) {
  _planPeriod = period;
  document.querySelectorAll(".plan-period-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  renderPlans();
};
function renderPlans() {
  const grid = document.querySelector(".plans-grid");
  const allPlans = [...PLANS.personal, ...PLANS.empresa];
  grid.innerHTML = allPlans.map(plan => `
    <div class="plan-card${plan.featured ? " featured" : ""}">
      ${plan.featured ? '<div class="plan-badge">Popular</div>' : ""}
      <div class="plan-name">${plan.name}</div>
      <div class="plan-price">
        ${plan[_planPeriod === "monthly" ? "monthly" : "annual"] === "0"
          ? "Gratis"
          : `${plan[_planPeriod === "monthly" ? "monthly" : "annual"]} €<span>/${_planPeriod === "monthly" ? "mes" : "año"}</span>`}
      </div>
      ${plan.monthlyAfter && _planPeriod === "monthly"
        ? `<div style="font-size:11px;color:var(--text-muted)">Después ${plan.monthlyAfter} €/mes</div>` : ""}
      ${plan.annualAfter && _planPeriod === "annual"
        ? `<div style="font-size:11px;color:var(--text-muted)">Después ${plan.annualAfter} €/año</div>` : ""}
      <ul class="plan-features">
        ${plan.features.map(f => `<li>${f}</li>`).join("")}
      </ul>
      <button class="plan-cta">Próximamente</button>
    </div>
  `).join("");
}

// ===== SETTINGS =====
window.showSettingsModal = function() { showToast("Ajustes próximamente"); };

// ===== GLOBAL CLOSE ON OUTSIDE CLICK =====
document.addEventListener("click", e => {
  if (!e.target.closest("#new-menu") && !e.target.closest(".new-btn")) {
    document.getElementById("new-menu").classList.add("hidden");
  }
  if (!e.target.closest("#context-menu") && !e.target.closest(".file-card")) {
    hideContextMenu();
  }
  if (!e.target.closest(".sidebar") && !e.target.closest(".sidebar-toggle")) {
    document.getElementById("sidebar")?.classList.remove("open");
  }
});

// ===== HANDLE SHARED FILE LINK =====
export async function handleSharedLink() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("share");
  if (!token) return false;

  const { getSharedFile } = await import("./storage.js");
  const file = await getSharedFile(token);
  if (file && file.shared) {
    // Show preview in a simple shared view
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);font-family:var(--font-body);color:var(--text);gap:20px;padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-size:20px;font-weight:800;">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="var(--accent)"/><path d="M12 30 L24 18 L36 30" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ShareIt
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px;max-width:500px;width:100%;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">${getFileIcon(file.name, file.type)}</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-display);margin-bottom:6px;">${file.name}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">${formatBytes(file.size)} · Compartido</div>
          ${file.storage?.data ? `<a href="${file.storage.data}" download="${file.name}" style="background:var(--accent);color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Descargar</a>` : '<p style="color:var(--text-muted)">No disponible</p>'}
        </div>
        <a href="/" style="color:var(--accent-light);font-size:13px;text-decoration:none;">Ir a ShareIt →</a>
      </div>`;
    return true;
  } else {
    showToast("Enlace no válido o el archivo no es público.");
    return false;
  }
}
