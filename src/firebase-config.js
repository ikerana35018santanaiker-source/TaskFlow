// ═══════════════════════════════════════════════════════════════
// TASKFLOW — Firebase Configuration
//
// ⚠️  IMPORTANT: Replace the values below with your own Firebase
//    project credentials. Follow the setup guide in README.md
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ─── YOUR FIREBASE CONFIG ────────────────────────────────────
// Get these values from: Firebase Console → Project Settings → Your apps → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDKurDI4iIcV_6LnzLkML0E3hM9hqWaMZg",
  authDomain: "shareit-c1222.firebaseapp.com",
  databaseURL: "https://shareit-c1222-default-rtdb.firebaseio.com",
  projectId: "shareit-c1222",
  storageBucket: "shareit-c1222.firebasestorage.app",
  messagingSenderId: "466346058481",
  appId: "1:466346058481:web:733bcea3730cac9d9a3f50"
};
// ─────────────────────────────────────────────────────────────

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
