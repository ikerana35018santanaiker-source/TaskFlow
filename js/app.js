// js/app.js - Orquestador principal de ShareIt

const App = {
    initialized: false,

    // Inicializar la aplicación
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Iniciando ShareIt...');
        
        // Verificar link mágico al cargar
        await Auth.completeSignInWithLink();
        
        // Configurar observador de autenticación
        this.setupAuthObserver();
        
        // Configurar eventos globales
        this.setupGlobalEvents();
        
        // Verificar links compartidos
        this.checkSharedAccess();
        
        this.initialized = true;
        console.log('✅ ShareIt inicializado correctamente');
    },

    // Configurar observador de autenticación
    setupAuthObserver() {
        Auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 Usuario autenticado:', user.uid);
                
                // Crear/actualizar perfil en BD
                await Auth.createUserProfile(user);
                
                // Renderizar la aplicación
                await UI.renderApp(user);
                
                // Configurar listener de cambios en tiempo real
                this.setupRealtimeListeners(user.uid);
            } else {
                console.log('👋 Usuario no autenticado');
                this.showAuthScreen();
            }
        });
    },

    // Mostrar pantalla de autenticación
    showAuthScreen() {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('ia-panel').style.display = 'none';
        document.getElementById('fab-ia').style.display = 'none';
    },

    // Configurar listeners en tiempo real
    setupRealtimeListeners(userId) {
        // Escuchar cambios en archivos
        const filesRef = Database.getUserFilesRef(userId);
        
        filesRef.on('child_changed', (snapshot) => {
            console.log('📝 Archivo actualizado:', snapshot.key);
            // Actualizar solo si estamos en la vista correcta
            if (UI.currentView !== 'shared') {
                UI.navigateTo(UI.currentView, UI.currentFolder);
            }
        });
        
        filesRef.on('child_removed', (snapshot) => {
            console.log('🗑️ Archivo eliminado:', snapshot.key);
            if (UI.currentView !== 'shared') {
                UI.navigateTo(UI.currentView, UI.currentFolder);
            }
        });
        
        // Escuchar cambios en perfil
        const userRef = Database.getUserRef(userId);
        userRef.on('value', (snapshot) => {
            const profile = snapshot.val();
            if (profile) {
                UI.updateStorageBar(profile);
            }
        });
    },

    // Configurar eventos globales
    setupGlobalEvents() {
        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            // Ctrl+N: Nueva carpeta
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                UI.createFolder();
            }
            
            // Ctrl+U: Subir archivo
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                document.getElementById('file-input')?.click();
            }
            
            // Escape: Cerrar modales
            if (e.key === 'Escape') {
                UI.closeModal();
                document.querySelector('.context-menu')?.remove();
            }
            
            // Ctrl+I: Toggle chat IA
            if (e.ctrlKey && e.key === 'i') {
                e.preventDefault();
                UI.toggleIAPanel();
            }
        });
        
        // Cerrar modal al hacer click fuera
        document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                UI.closeModal();
            }
        });
        
        // Drag and drop para subir archivos
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                mainContent.classList.add('drag-over');
            });
            
            mainContent.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                mainContent.classList.remove('drag-over');
            });
            
            mainContent.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                mainContent.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    await UI.handleFileUpload(files);
                }
            });
        }
        
        // Redimensionar panel IA
        this.setupIAPanelResize();
        
        // Manejar cambios de conexión
        window.addEventListener('online', () => {
            UI.showNotification('Conexión restablecida', 'success');
        });
        
        window.addEventListener('offline', () => {
            UI.showNotification('Sin conexión a internet', 'error');
        });
    },

    // Configurar redimensionamiento del panel IA
    setupIAPanelResize() {
        const panel = document.getElementById('ia-panel');
        if (!panel) return;
        
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        
        const handleMouseDown = (e) => {
            if (e.target.classList.contains('ia-resize-handle')) {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = panel.offsetWidth;
                startHeight = panel.offsetHeight;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
        };
        
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(300, startWidth - (e.clientX - startX));
            const newHeight = Math.max(400, startHeight + (e.clientY - startY));
            panel.style.width = newWidth + 'px';
            panel.style.height = newHeight + 'px';
        };
        
        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        panel.addEventListener('mousedown', handleMouseDown);
    },

    // Verificar acceso compartido por URL
    async checkSharedAccess() {
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get('shared');
        
        if (sharedId) {
            console.log('🔗 Detectado link compartido:', sharedId);
            
            // Si no hay usuario autenticado, iniciar como anónimo
            if (!auth.currentUser) {
                try {
                    await Auth.signInAnonymously();
                } catch (error) {
                    console.error('❌ Error acceso anónimo para link compartido:', error);
                }
            }
        }
    },

    // Manejar errores globales
    handleGlobalError(error, context = '') {
        console.error(`❌ Error en ${context}:`, error);
        
        // Errores críticos
        if (error.code === 'PERMISSION_DENIED') {
            UI.showNotification('No tienes permisos para realizar esta acción', 'error');
        } else if (error.code === 'NETWORK_ERROR') {
            UI.showNotification('Error de conexión. Verifica tu internet', 'error');
        } else if (error.message?.includes('quota')) {
            UI.showNotification('Has alcanzado el límite de almacenamiento', 'error');
        } else {
            UI.showNotification('Ocurrió un error inesperado', 'error');
        }
    }
};

// ========== INICIAR APLICACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(error => {
        console.error('❌ Error fatal al iniciar ShareIt:', error);
        document.getElementById('loading-screen').innerHTML = `
            <div style="text-align: center;">
                <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #FF6B6B;"></i>
                <h2 class="mt-20">Error al cargar ShareIt</h2>
                <p class="text-secondary">Por favor recarga la página</p>
                <button class="btn btn-primary mt-20" onclick="location.reload()">
                    <i class="fa-solid fa-rotate"></i> Recargar
                </button>
            </div>
        `;
    });
});

// Manejar errores no capturados
window.addEventListener('error', (event) => {
    console.error('❌ Error no capturado:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Promesa rechazada no manejada:', event.reason);
    App.handleGlobalError(event.reason, 'Promesa no manejada');
});

console.log('🚀 ShareIt App cargado - Esperando DOM...');
