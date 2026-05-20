// js/auth.js — Autenticación completa de ShareIt

const Auth = {
    googleProvider: null,

    _getProvider() {
        if (!this.googleProvider) {
            this.googleProvider = new firebase.auth.GoogleAuthProvider();
        }
        return this.googleProvider;
    },

    // ── Google ────────────────────────────────────────────────────────────
    async signInWithGoogle() {
        try {
            _showAuthLoading(true);
            const result = await auth.signInWithPopup(this._getProvider());
            UI.showNotification('¡Bienvenido!', 'success');
            return result.user;
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Registro con email ────────────────────────────────────────────────
    async signUpWithEmail() {
        const email    = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        if (!this.validateEmailPassword(email, password)) return;

        try {
            _showAuthLoading(true);
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await this.createUserProfile(result.user);
            UI.showNotification('¡Cuenta creada con éxito!', 'success');
            return result.user;
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Login con email ───────────────────────────────────────────────────
    async signInWithEmail() {
        const email    = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        if (!email || !password) {
            UI.showNotification('Completa todos los campos', 'error');
            return;
        }

        try {
            _showAuthLoading(true);
            const result = await auth.signInWithEmailAndPassword(email, password);
            UI.showNotification('¡Bienvenido de nuevo!', 'success');
            return result.user;
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Anónimo ───────────────────────────────────────────────────────────
    async signInAnonymously() {
        try {
            _showAuthLoading(true);
            const result = await auth.signInAnonymously();
            await database.ref(`users/${result.user.uid}`).set({
                isAnonymous: true,
                plan: 'PERSONAL_GRATUITO',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                storageUsed: 0
            });
            UI.showNotification('Acceso anónimo — solo lectura', 'success');
            return result.user;
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Link mágico: enviar ───────────────────────────────────────────────
    async sendSignInLinkToEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        if (!email) { UI.showNotification('Ingresa tu correo primero', 'error'); return; }

        try {
            _showAuthLoading(true);
            await auth.sendSignInLinkToEmail(email, {
                url: window.location.href,
                handleCodeInApp: true
            });
            window.localStorage.setItem('emailForSignIn', email);
            UI.showNotification('¡Link mágico enviado! Revisa tu correo 📧', 'success');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Link mágico: completar ────────────────────────────────────────────
    async completeSignInWithLink() {
        if (!auth.isSignInWithEmailLink(window.location.href)) return null;
        let email = window.localStorage.getItem('emailForSignIn')
            || window.prompt('Confirma tu correo para acceder:');
        if (!email) return null;

        try {
            const result = await auth.signInWithEmailLink(email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            window.history.replaceState({}, document.title, window.location.pathname);
            return result.user;
        } catch (error) {
            this.handleAuthError(error);
            return null;
        }
    },

    // ── Restablecer contraseña ────────────────────────────────────────────
    async sendPasswordResetEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        if (!email) { UI.showNotification('Ingresa tu correo primero', 'error'); return; }

        try {
            _showAuthLoading(true);
            await auth.sendPasswordResetEmail(email);
            UI.showNotification('Link de restablecimiento enviado 📧', 'success');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            _showAuthLoading(false);
        }
    },

    // ── Cerrar sesión ─────────────────────────────────────────────────────
    async signOut() {
        try {
            await auth.signOut();
            UI.showNotification('Sesión cerrada', 'success');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    },

    // ── Observer ──────────────────────────────────────────────────────────
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    // ── Crear perfil ──────────────────────────────────────────────────────
    async createUserProfile(user) {
        const userRef  = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            await userRef.set({
                email:       user.email || '',
                displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
                photoURL:    user.photoURL  || '',
                plan:        'PERSONAL_GRATUITO',
                storageUsed: 0,
                iaCreditsUsed: 0,
                createdAt:   firebase.database.ServerValue.TIMESTAMP,
                isAnonymous: false
            });
        }
    },

    // ── Validación básica ─────────────────────────────────────────────────
    validateEmailPassword(email, password) {
        if (!email || !password) { UI.showNotification('Completa todos los campos', 'error'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.showNotification('Correo no válido', 'error'); return false; }
        if (password.length < 6) { UI.showNotification('Contraseña mínimo 6 caracteres', 'error'); return false; }
        return true;
    },

    // ── Errores ───────────────────────────────────────────────────────────
    handleAuthError(error) {
        const msgs = {
            'auth/email-already-in-use':   'Este correo ya está registrado',
            'auth/invalid-email':           'Correo electrónico inválido',
            'auth/user-not-found':          'No existe una cuenta con este correo',
            'auth/wrong-password':          'Contraseña incorrecta',
            'auth/weak-password':           'La contraseña debe tener al menos 6 caracteres',
            'auth/too-many-requests':       'Demasiados intentos. Espera unos minutos',
            'auth/network-request-failed':  'Sin conexión a internet',
            'auth/user-disabled':           'Esta cuenta ha sido deshabilitada',
            'auth/operation-not-allowed':   'Método de login no habilitado',
            'auth/popup-blocked':           'Popup bloqueado por el navegador',
        };
        const msg = msgs[error.code] || error.message || 'Error de autenticación';
        UI.showNotification(msg, 'error');

        const errEl = document.getElementById('auth-error');
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
            setTimeout(() => errEl.style.display = 'none', 5000);
        }
    }
};

// Helper interno: muestra/oculta el spinner del botón de auth sin depender de loading-screen
function _showAuthLoading(show) {
    const btns = document.querySelectorAll('#auth-container button');
    btns.forEach(b => b.disabled = show);
}

console.log('🔐 Auth cargado');
