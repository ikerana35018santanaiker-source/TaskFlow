// js/auth.js — Authentication module
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showScreen, showToast } from "./ui.js";
import { initDrive } from "./drive.js";

let phoneConfirmation = null;

// ===== AUTH STATE OBSERVER =====
export function initAuth() {
  // Check if returning from email link
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      email = window.prompt("Por favor ingresa tu correo para confirmar:");
    }
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        window.localStorage.removeItem("emailForSignIn");
        window.history.replaceState({}, document.title, "/");
      })
      .catch(err => showToast("Error al verificar enlace: " + err.message));
  }

  onAuthStateChanged(auth, user => {
    if (user) {
      window._currentUser = user;
      initDrive(user);
      showScreen("drive-screen");
    } else {
      window._currentUser = null;
    }
  });
}

// ===== SHOW AUTH SCREEN =====
window.showAuth = function(tab) {
  showScreen("auth-screen");
  switchTab(tab);
};

// ===== TAB SWITCH =====
window.switchTab = function(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".auth-form").forEach(f => f.classList.add("hidden"));

  if (tab === "login") {
    document.getElementById("tab-login").classList.add("active");
    document.getElementById("login-form").classList.remove("hidden");
  } else {
    document.getElementById("tab-register").classList.add("active");
    document.getElementById("register-form").classList.remove("hidden");
  }
};

// ===== GOOGLE LOGIN =====
window.loginWithGoogle = async function() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    showToast("Error con Google: " + err.message);
  }
};

// ===== EMAIL/PASSWORD LOGIN =====
window.loginWithEmail = async function() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  if (!email || !password) { errEl.textContent = "Completa todos los campos."; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = translateAuthError(err.code);
  }
};

// ===== REGISTER =====
window.registerWithEmail = async function() {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("register-error");
  errEl.textContent = "";

  if (!name || !email || !password) { errEl.textContent = "Completa todos los campos."; return; }
  if (password.length < 6) { errEl.textContent = "La contraseña debe tener mínimo 6 caracteres."; return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
  } catch (err) {
    errEl.textContent = translateAuthError(err.code);
  }
};

// ===== PHONE AUTH =====
window.showPhoneAuth = function() {
  document.querySelectorAll(".auth-form").forEach(f => f.classList.add("hidden"));
  document.getElementById("phone-form").classList.remove("hidden");
};

window.sendPhoneCode = async function() {
  const phone = document.getElementById("phone-number").value.trim();
  const errEl = document.getElementById("phone-error");
  errEl.textContent = "";

  if (!phone) { errEl.textContent = "Introduce un número de teléfono."; return; }

  try {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" });
    }
    phoneConfirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    document.getElementById("phone-code-step").classList.remove("hidden");
    showToast("Código enviado ✓");
  } catch (err) {
    errEl.textContent = "Error: " + err.message;
  }
};

window.verifyPhoneCode = async function() {
  const code = document.getElementById("phone-code").value.trim();
  const errEl = document.getElementById("phone-error");
  if (!code) { errEl.textContent = "Introduce el código."; return; }
  try {
    await phoneConfirmation.confirm(code);
  } catch (err) {
    errEl.textContent = "Código incorrecto o caducado.";
  }
};

// ===== EMAIL LINK AUTH =====
window.showEmailLinkAuth = function() {
  document.querySelectorAll(".auth-form").forEach(f => f.classList.add("hidden"));
  document.getElementById("emaillink-form").classList.remove("hidden");
};

window.sendEmailLink = async function() {
  const email = document.getElementById("emaillink-email").value.trim();
  const msgEl = document.getElementById("emaillink-msg");
  msgEl.textContent = "";
  msgEl.style.color = "var(--danger)";

  if (!email) { msgEl.textContent = "Introduce tu correo."; return; }

  const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    msgEl.style.color = "var(--success)";
    msgEl.textContent = "¡Enlace enviado! Revisa tu correo.";
  } catch (err) {
    msgEl.textContent = "Error: " + err.message;
  }
};

// ===== ANONYMOUS =====
window.enterAnonymous = function() {
  window._currentUser = { uid: "anon", displayName: "Anónimo", email: null, isAnonymous: true };
  initDrive(window._currentUser);
  showScreen("drive-screen");
  showToast("Modo anónimo — no puedes subir archivos");
};

// ===== LOGOUT =====
window.logoutUser = async function() {
  try {
    await signOut(auth);
    showScreen("splash-screen");
    showToast("Sesión cerrada");
  } catch (err) {
    showToast("Error al cerrar sesión");
  }
};

// ===== ERROR TRANSLATOR =====
function translateAuthError(code) {
  const map = {
    "auth/user-not-found": "No existe una cuenta con este correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/email-already-in-use": "Este correo ya está en uso.",
    "auth/invalid-email": "Correo no válido.",
    "auth/weak-password": "La contraseña es demasiado débil.",
    "auth/too-many-requests": "Demasiados intentos. Inténtalo más tarde.",
    "auth/network-request-failed": "Error de red. Comprueba tu conexión.",
  };
  return map[code] || "Error de autenticación. Inténtalo de nuevo.";
}
