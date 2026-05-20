// js/storage.js — File storage logic (Base64 for <15MB, Puter.js for larger)
import { db } from "./firebase.js";
import {
  ref, set, get, push, remove, update, onValue, off
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { showToast } from "./ui.js";

const SMALL_FILE_LIMIT = 15 * 1024 * 1024; // 15 MB in bytes
const FREE_PLAN_LIMIT = 15 * 1024 * 1024 * 1024; // 15 GB

// ===== GET USER DB REF =====
export function userRef(uid, path = "") {
  return ref(db, `users/${uid}${path ? "/" + path : ""}`);
}

// ===== GET USER STORAGE USAGE =====
export async function getStorageUsage(uid) {
  try {
    const snap = await get(userRef(uid, "meta/storageUsed"));
    return snap.exists() ? snap.val() : 0;
  } catch { return 0; }
}

// ===== UPDATE STORAGE USAGE =====
export async function updateStorageUsage(uid, delta) {
  const current = await getStorageUsage(uid);
  const newVal = Math.max(0, current + delta);
  await set(userRef(uid, "meta/storageUsed"), newVal);
  return newVal;
}

// ===== GET STORAGE LIMIT =====
export async function getStorageLimit(uid) {
  try {
    const snap = await get(userRef(uid, "meta/plan"));
    const plan = snap.exists() ? snap.val() : "free";
    const limits = {
      free: 15 * 1024 * 1024 * 1024,
      plus: 125 * 1024 * 1024 * 1024,
      pro: 350 * 1024 * 1024 * 1024,
      "business-free": 5 * 1024 * 1024 * 1024,
      "business-pro": 500 * 1024 * 1024 * 1024 * 1024,
      "business-infinity": 1000 * 1024 * 1024 * 1024 * 1024,
    };
    return limits[plan] || FREE_PLAN_LIMIT;
  } catch { return FREE_PLAN_LIMIT; }
}

// ===== FILE TO BASE64 =====
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== UPLOAD VIA PUTER.JS =====
async function uploadToPuter(file, uid, fileId) {
  return new Promise((resolve, reject) => {
    // Puter.js SDK – loaded from CDN in HTML
    if (typeof puter === "undefined") {
      reject(new Error("Puter.js no disponible"));
      return;
    }
    const path = `shareit/${uid}/${fileId}_${file.name}`;
    puter.fs.write(path, file, { overwrite: true })
      .then(puterFile => {
        resolve({ type: "puter", path, name: puterFile.name });
      })
      .catch(reject);
  });
}

// ===== MAIN UPLOAD FUNCTION =====
export async function uploadFile(file, uid, parentPath, onProgress) {
  if (!uid || uid === "anon") {
    showToast("Los usuarios anónimos no pueden subir archivos.");
    throw new Error("Anonymous");
  }

  const used = await getStorageUsage(uid);
  const limit = await getStorageLimit(uid);

  if (used + file.size > limit) {
    showToast("⚠️ Has alcanzado tu límite de almacenamiento.");
    throw new Error("StorageFull");
  }

  const filesRef = userRef(uid, "files");
  const newRef = push(filesRef);
  const fileId = newRef.key;

  let storageData = {};

  onProgress?.(0);

  if (file.size <= SMALL_FILE_LIMIT) {
    // Store as base64 in Realtime DB
    const base64 = await fileToBase64(file);
    storageData = { type: "base64", data: base64 };
    onProgress?.(80);
  } else {
    // Store via Puter.js
    try {
      const puterResult = await uploadToPuter(file, uid, fileId);
      storageData = puterResult;
      onProgress?.(80);
    } catch (err) {
      // Fallback: still try base64 (may fail for very large files)
      console.warn("Puter upload failed, attempting base64:", err);
      const base64 = await fileToBase64(file);
      storageData = { type: "base64", data: base64 };
      onProgress?.(80);
    }
  }

  const fileRecord = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    parent: parentPath || "root",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    starred: false,
    shared: false,
    shareToken: null,
    trashed: false,
    storage: storageData,
  };

  await set(newRef, fileRecord);
  await updateStorageUsage(uid, file.size);
  onProgress?.(100);
  return fileRecord;
}

// ===== CREATE FOLDER =====
export async function createFolderRecord(uid, name, parentPath) {
  const foldersRef = userRef(uid, "files");
  const newRef = push(foldersRef);
  const folderId = newRef.key;

  const folder = {
    id: folderId,
    name,
    type: "folder",
    size: 0,
    parent: parentPath || "root",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    starred: false,
    shared: false,
    shareToken: null,
    trashed: false,
  };

  await set(newRef, folder);
  return folder;
}

// ===== LISTEN TO FILES =====
export function listenToFiles(uid, callback) {
  const filesRef = userRef(uid, "files");
  const handler = snapshot => {
    const files = [];
    snapshot.forEach(child => {
      files.push({ ...child.val(), _key: child.key });
    });
    callback(files);
  };
  onValue(filesRef, handler);
  return () => off(filesRef, "value", handler);
}

// ===== UPDATE FILE =====
export async function updateFile(uid, fileId, data) {
  await update(userRef(uid, `files/${fileId}`), { ...data, modifiedAt: Date.now() });
}

// ===== TRASH FILE =====
export async function trashFile(uid, fileId) {
  await update(userRef(uid, `files/${fileId}`), { trashed: true, modifiedAt: Date.now() });
}

// ===== RESTORE FILE =====
export async function restoreFile(uid, fileId) {
  await update(userRef(uid, `files/${fileId}`), { trashed: false, modifiedAt: Date.now() });
}

// ===== PERMANENTLY DELETE =====
export async function deleteFile(uid, fileId, fileSize) {
  await remove(userRef(uid, `files/${fileId}`));
  if (fileSize) await updateStorageUsage(uid, -fileSize);
}

// ===== GET FILE DATA (for preview/download) =====
export async function getFileData(uid, fileId) {
  const snap = await get(userRef(uid, `files/${fileId}`));
  return snap.exists() ? snap.val() : null;
}

// ===== SHARE: SET TOKEN =====
export async function setShareToken(uid, fileId, token, isPublic) {
  await update(userRef(uid, `files/${fileId}`), {
    shared: isPublic,
    shareToken: token,
    modifiedAt: Date.now()
  });
  if (isPublic && token) {
    // Store in public share index
    await set(ref(db, `shares/${token}`), { uid, fileId, createdAt: Date.now() });
  }
}

// ===== GET SHARED FILE BY TOKEN =====
export async function getSharedFile(token) {
  const snap = await get(ref(db, `shares/${token}`));
  if (!snap.exists()) return null;
  const { uid, fileId } = snap.val();
  return await getFileData(uid, fileId);
}

// ===== EMPTY TRASH =====
export async function emptyTrash(uid, files) {
  const trashed = files.filter(f => f.trashed);
  for (const f of trashed) {
    await deleteFile(uid, f.id, f.size);
  }
}
