// js/auth.js - Sistema completo de autenticación

const Auth = {
    // Proveedor de Google
    googleProvider: new firebase.auth.GoogleAuthProvider(),

    // Iniciar sesión con Google
    async signInWithGoogle() {
        try {
            UI.showLoading(true);
            const result = await auth.signInWithPopup(this.googleProvider);
            console.log('✅ Login Google exitoso:', result.user.email);
            UI.showNotification('¡Bienvenido!', 'success');
            return result.user;
        } catch (error) {
            console.error('❌ Error Google login:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            UI.showLoading(false);
        }
    },

    // Registrar con Email y Contraseña
    async signUpWithEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        
        if (!this.validateEmailPassword(email, password)) return;
        
        try {
            UI.showLoading(true);
            const result = await auth.createUserWithEmailAndPassword(email, password);
            console.log('✅ Registro exitoso:', result.user.email);
            
            // Crear perfil en la base de datos
            await this.createUserProfile(result.user);
            
            UI.showNotification('¡Cuenta creada con éxito!', 'success');
            return result.user;
        } catch (error) {
            console.error('❌ Error registro:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            UI.showLoading(false);
        }
    },

    // Iniciar sesión con Email y Contraseña
    async signInWithEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        
        if (!email || !password) {
            UI.showNotification('Por favor completa todos los campos', 'error');
            return;
        }
        
        try {
            UI.showLoading(true);
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Login email exitoso:', result.user.email);
            UI.showNotification('¡Bienvenido de nuevo!', 'success');
            return result.user;
        } catch (error) {
            console.error('❌ Error login email:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            UI.showLoading(false);
        }
    },

    // Acceso anónimo
    async signInAnonymously() {
        try {
            UI.showLoading(true);
            const result = await auth.signInAnonymously();
            console.log('✅ Acceso anónimo:', result.user.uid);
            
            // Marcar como anónimo en la base de datos
            await database.ref(`users/${result.user.uid}`).set({
                isAnonymous: true,
                plan: 'PERSONAL_GRATUITO',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                storageUsed: 0
            });
            
            UI.showNotification('Acceso anónimo (solo lectura)', 'success');
            return result.user;
        } catch (error) {
            console.error('❌ Error acceso anónimo:', error);
            this.handleAuthError(error);
            throw error;
        } finally {
            UI.showLoading(false);
        }
    },

    // Enviar link mágico al correo
    async sendSignInLinkToEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        if (!email) {
            UI.showNotification('Por favor ingresa tu correo', 'error');
            return;
        }
        
        const actionCodeSettings = {
            url: window.location.href,
            handleCodeInApp: true
        };
        
        try {
            UI.showLoading(true);
            await auth.sendSignInLinkToEmail(email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
            UI.showNotification('¡Link mágico enviado! Revisa tu correo', 'success');
            alert('Se ha enviado un link de acceso a tu correo. Revisa también la carpeta de spam.');
        } catch (error) {
            console.error('❌ Error enviando link:', error);
            this.handleAuthError(error);
        } finally {
            UI.showLoading(false);
        }
    },

    // Completar inicio con link mágico
    async completeSignInWithLink() {
        if (!auth.isSignInWithEmailLink(window.location.href)) return null;
        
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = prompt('Por favor confirma tu correo para completar el acceso:');
            if (!email) return null;
        }
        
        try {
            UI.showLoading(true);
            const result = await auth.signInWithEmailLink(email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            console.log('✅ Link mágico exitoso:', result.user.email);
            UI.showNotification('¡Acceso confirmado!', 'success');
            return result.user;
        } catch (error) {
            console.error('❌ Error link mágico:', error);
            this.handleAuthError(error);
            return null;
        } finally {
            UI.showLoading(false);
        }
    },

    // Enviar correo de restablecimiento
    async sendPasswordResetEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        if (!email) {
            UI.showNotification('Ingresa tu correo para restablecer la contraseña', 'error');
            return;
        }
        
        try {
            UI.showLoading(true);
            await auth.sendPasswordResetEmail(email);
            UI.showNotification('Link de restablecimiento enviado', 'success');
            alert('Revisa tu correo para restablecer tu contraseña.');
        } catch (error) {
            console.error('❌ Error reset password:', error);
            this.handleAuthError(error);
        } finally {
            UI.showLoading(false);
        }
    },

    // Cerrar sesión
    async signOut() {
        try {
            await auth.signOut();
            console.log('👋 Sesión cerrada');
            UI.showNotification('Sesión cerrada', 'success');
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
        }
    },

    // Observar cambios de autenticación
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    // Crear perfil de usuario en la BD
    async createUserProfile(user) {
        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            await userRef.set({
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
                photoURL: user.photoURL || '',
                plan: 'PERSONAL_GRATUITO',
                storageUsed: 0,
                iaCreditsUsed: 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                isAnonymous: false
            });
        }
    },

    // Validar email y contraseña
    validateEmailPassword(email, password) {
        if (!email || !password) {
            UI.showNotification('Completa todos los campos', 'error');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            UI.showNotification('Ingresa un correo válido', 'error');
            return false;
        }
        if (password.length < 6) {
            UI.showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return false;
        }
        return true;
    },

    // Manejar errores de autenticación
    handleAuthError(error) {
        let message = 'Error de autenticación';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Este correo ya está registrado';
                break;
            case 'auth/invalid-email':
                message = 'Correo electrónico inválido';
                break;
            case 'auth/operation-not-allowed':
                message = 'Este método de inicio de sesión no está habilitado';
                break;
            case 'auth/weak-password':
                message = 'La contraseña debe tener al menos 6 caracteres';
                break;
            case 'auth/user-disabled':
                message = 'Esta cuenta ha sido deshabilitada';
                break;
            case 'auth/user-not-found':
                message = 'No existe una cuenta con este correo';
                break;
            case 'auth/wrong-password':
                message = 'Contraseña incorrecta';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos. Intenta más tarde';
                break;
            case 'auth/network-request-failed':
                message = 'Error de conexión. Verifica tu internet';
                break;
            case 'auth/popup-closed-by-user':
                message = 'Ventana de inicio de sesión cerrada';
                break;
            default:
                message = error.message || 'Error desconocido';
        }
        
        UI.showNotification(message, 'error');
        
        const errorElement = document.getElementById('auth-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => { errorElement.style.display = 'none'; }, 5000);
        }
    }
};

console.log('🔐 Sistema de autenticación cargado');
