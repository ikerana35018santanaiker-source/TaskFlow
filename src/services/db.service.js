// ═══════════════════════════════════════════════════════════════
// TASKFLOW — Database Service
// Firebase Realtime Database operations
//
// DB Structure:
// users/{uid}/
//   profile: { name, email, createdAt }
//   boards/{boardId}/
//     name, description, color, createdAt, updatedAt
//     columns/{columnId}/
//       name, order, createdAt
//       cards/{cardId}/
//         title, description, priority, dueDate, completed,
//         tags: [{text, color}], checklist: [{text, done}],
//         order, createdAt, updatedAt
// ═══════════════════════════════════════════════════════════════

import {
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  off,
  serverTimestamp,
  query,
  orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { db } from "../firebase-config.js";

// ─── Helper: user root path ──────────────────────────────────
const userPath = (uid) => `users/${uid}`;
const boardsPath = (uid) => `users/${uid}/boards`;
const boardPath = (uid, bid) => `users/${uid}/boards/${bid}`;
const columnsPath = (uid, bid) => `users/${uid}/boards/${bid}/columns`;
const columnPath = (uid, bid, cid) => `users/${uid}/boards/${bid}/columns/${cid}`;
const cardsPath = (uid, bid, cid) => `users/${uid}/boards/${bid}/columns/${cid}/cards`;
const cardPath = (uid, bid, cid, kid) => `users/${uid}/boards/${bid}/columns/${cid}/cards/${kid}`;

// ═══════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════

export async function saveUserProfile(uid, data) {
  await set(ref(db, `${userPath(uid)}/profile`), {
    ...data,
    updatedAt: Date.now()
  });
}

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `${userPath(uid)}/profile`));
  return snap.exists() ? snap.val() : null;
}

// ═══════════════════════════════════════════════════════════════
// BOARDS
// ═══════════════════════════════════════════════════════════════

export async function createBoard(uid, data) {
  const newRef = push(ref(db, boardsPath(uid)));
  const board = {
    id: newRef.key,
    name: data.name,
    description: data.description || '',
    color: data.color || '#6366f1',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await set(newRef, board);
  return board;
}

export async function updateBoard(uid, boardId, data) {
  await update(ref(db, boardPath(uid, boardId)), {
    ...data,
    updatedAt: Date.now()
  });
}

export async function deleteBoard(uid, boardId) {
  await remove(ref(db, boardPath(uid, boardId)));
}

// Real-time boards listener
export function onBoards(uid, callback) {
  const boardsRef = ref(db, boardsPath(uid));
  const listener = onValue(boardsRef, (snap) => {
    const boards = [];
    if (snap.exists()) {
      snap.forEach((child) => {
        boards.push({ id: child.key, ...child.val() });
      });
    }
    callback(boards);
  });
  return () => off(boardsRef, 'value', listener);
}

// Real-time single board listener (includes columns + cards)
export function onBoard(uid, boardId, callback) {
  const boardRef = ref(db, boardPath(uid, boardId));
  const listener = onValue(boardRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.key, ...snap.val() });
    } else {
      callback(null);
    }
  });
  return () => off(boardRef, 'value', listener);
}

// ═══════════════════════════════════════════════════════════════
// COLUMNS
// ═══════════════════════════════════════════════════════════════

export async function createColumn(uid, boardId, name) {
  const newRef = push(ref(db, columnsPath(uid, boardId)));
  const col = {
    id: newRef.key,
    name,
    order: Date.now(),
    createdAt: Date.now()
  };
  await set(newRef, col);
  return col;
}

export async function updateColumnName(uid, boardId, columnId, name) {
  await update(ref(db, columnPath(uid, boardId, columnId)), { name });
}

export async function deleteColumn(uid, boardId, columnId) {
  await remove(ref(db, columnPath(uid, boardId, columnId)));
}

// ═══════════════════════════════════════════════════════════════
// CARDS / TASKS
// ═══════════════════════════════════════════════════════════════

export async function createCard(uid, boardId, columnId, data) {
  const newRef = push(ref(db, cardsPath(uid, boardId, columnId)));
  const card = {
    id: newRef.key,
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium',
    dueDate: data.dueDate || null,
    completed: false,
    tags: data.tags || [],
    checklist: data.checklist || [],
    order: Date.now(),
    columnId,
    boardId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await set(newRef, card);
  return card;
}

export async function updateCard(uid, boardId, columnId, cardId, data) {
  await update(ref(db, cardPath(uid, boardId, columnId, cardId)), {
    ...data,
    updatedAt: Date.now()
  });
}

export async function deleteCard(uid, boardId, columnId, cardId) {
  await remove(ref(db, cardPath(uid, boardId, columnId, cardId)));
}

// Move card to another column (removes from old, adds to new)
export async function moveCard(uid, boardId, fromColumnId, toColumnId, cardId, cardData) {
  const updates = {};
  // Remove from old column
  updates[`${cardPath(uid, boardId, fromColumnId, cardId)}`] = null;
  // Add to new column
  updates[`${cardPath(uid, boardId, toColumnId, cardId)}`] = {
    ...cardData,
    columnId: toColumnId,
    order: Date.now(),
    updatedAt: Date.now()
  };
  // Firebase multi-location update
  const rootRef = ref(db);
  await update(rootRef, updates);
}

// Toggle card completion
export async function toggleCardComplete(uid, boardId, columnId, cardId, completed) {
  await update(ref(db, cardPath(uid, boardId, columnId, cardId)), {
    completed,
    updatedAt: Date.now()
  });
}
