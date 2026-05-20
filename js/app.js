// js/app.js — Orquestador principal de ShareIt

const App = {
    initialized: false,

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('🚀 Iniciando ShareIt…');

        // Completar login por link mágico si aplica
        try { await Auth.completeSignInWithLink(); } catch (_) {}

        // Observar autenticación
        Auth.onAuthStateChanged(async user => {
            if (user) {
                console.log('👤 Usuario autenticado:', user.uid);
                try { await Auth.createUserProfile(user); } catch (_) {}
                await UI.renderApp(user);
                this._setupRealtimeListeners(user.uid);
            } else {
                console.log('👋 No autenticado');
                this._showAuthScreen();
            }
        });

        this._setupGlobalEvents();
        this._checkSharedLink();
    },

    _showAuthScreen() {
        document.getElementById('loading-screen').style.display  = 'none';
        document.getElementById('auth-container').style.display  = 'flex';
        document.getElementById('app-container').style.display   = 'none';
        document.getElementById('ia-panel').style.display        = 'none';
        document.getElementById('fab-ia').style.display          = 'none';
        document.getElementById('upload-panel').style.display    = 'none';
    },

    _setupRealtimeListeners(userId) {
        // Cambios en archivos
        const filesRef = database.ref(`files/${userId}`);
        filesRef.on('child_changed', () => {
            if (UI.currentView && UI.currentView !== 'shared') {
                UI.navigateTo(UI.currentView, UI.currentFolder);
            }
        });
        filesRef.on('child_removed', () => {
            if (UI.currentView && UI.currentView !== 'shared') {
                UI.navigateTo(UI.currentView, UI.currentFolder);
            }
        });

        // Cambios en perfil (barra almacenamiento)
        database.ref(`users/${userId}`).on('value', snap => {
            const profile = snap.val();
            if (profile) UI.updateStorageBar(profile);
        });
    },

    _setupGlobalEvents() {
        // Atajos de teclado
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Escape') {
                UI.closeModal();
                UI.closeFilePreview?.();
                document.querySelector('.context-menu')?.remove();
            }
            if (e.ctrlKey && e.key === 'u') { e.preventDefault(); document.getElementById('file-input')?.click(); }
            if (e.ctrlKey && e.key === 'n') { e.preventDefault(); UI.createFolder(); }
            if (e.ctrlKey && e.key === 'i') { e.preventDefault(); UI.toggleIAPanel(); }
        });

        // Drag & drop global
        const main = document.getElementById('main-content');
        if (main) {
            let dragCounter = 0;
            main.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; main.classList.add('drag-over'); });
            main.addEventListener('dragleave', e => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; main.classList.remove('drag-over'); } });
            main.addEventListener('dragover',  e => e.preventDefault());
            main.addEventListener('drop', async e => {
                e.preventDefault(); dragCounter = 0; main.classList.remove('drag-over');
                if (e.dataTransfer.files.length) await UI.handleFileUpload(e.dataTransfer.files);
            });
        }

        // Resize panel IA
        this._setupIAPanelResize();

        window.addEventListener('online',  () => UI.showNotification('Conexión restablecida', 'success'));
        window.addEventListener('offline', () => UI.showNotification('Sin conexión a internet', 'error'));
    },

    _setupIAPanelResize() {
        const panel = document.getElementById('ia-panel');
        if (!panel) return;
        let isResizing = false, startX, startY, startW, startH;

        panel.addEventListener('mousedown', e => {
            if (!e.target.classList.contains('ia-resize-handle')) return;
            isResizing = true; startX = e.clientX; startY = e.clientY;
            startW = panel.offsetWidth; startH = panel.offsetHeight;

            const onMove = e => {
                if (!isResizing) return;
                panel.style.width  = Math.max(300, startW - (e.clientX - startX)) + 'px';
                panel.style.height = Math.max(400, startH + (e.clientY - startY)) + 'px';
            };
            const onUp = () => { isResizing = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    },

    async _checkSharedLink() {
        const sharedId = new URLSearchParams(window.location.search).get('shared');
        if (!sharedId) return;
        if (!auth.currentUser) {
            try { await Auth.signInAnonymously(); } catch (_) {}
        }
    }
};

// ── Arrancar ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(err => {
        console.error('❌ Error fatal al iniciar ShareIt:', err);
        const ls = document.getElementById('loading-screen');
        if (ls) ls.innerHTML = `
            <div style="text-align:center;color:#fff;padding:40px;">
                <i class="fa-solid fa-triangle-exclamation fa-3x" style="color:#FF6B6B;"></i>
                <h2 style="margin:20px 0 8px;">Error al cargar ShareIt</h2>
                <p style="color:#A0A0B8;margin-bottom:20px;">Por favor recarga la página</p>
                <button onclick="location.reload()" style="background:#6C5CE7;color:#fff;border:none;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:1rem;">
                    <i class="fa-solid fa-rotate"></i> Recargar
                </button>
            </div>`;
    });
});

window.addEventListener('unhandledrejection', ev => {
    console.warn('⚠️ Promesa rechazada:', ev.reason);
});

console.log('🚀 App.js cargado');
