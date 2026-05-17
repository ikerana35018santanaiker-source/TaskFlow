// js/ui.js - Interfaz de usuario completa

const UI = {
    currentUser: null,
    currentView: 'my-drive',
    currentFolder: null,
    selectedFiles: new Set(),
    filesCache: [],
    isSidebarOpen: true,

    // ========== INICIALIZACIÓN ==========
    async renderApp(user) {
        this.currentUser = user;
        
        // Ocultar pantalla de carga y auth
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('auth-container').style.display = 'none';
        
        // Mostrar app
        const appContainer = document.getElementById('app-container');
        appContainer.style.display = 'flex';
        setTimeout(() => appContainer.classList.add('visible'), 50);
        
        // Cargar perfil
        await this.loadUserProfile();
        
        // Inicializar almacenamiento
        await StorageManager.initPuter();
        
        // Inicializar chat IA
        ChatIA.init();
        
        // Navegar a la vista inicial
        this.navigateTo('my-drive');
        
        // Verificar link compartido en URL
        await this.checkSharedLink();
        
        console.log('✅ App renderizada correctamente');
    },

    // Cargar perfil de usuario
    async loadUserProfile() {
        if (!this.currentUser) return;
        
        const profile = await Database.getUserProfile(this.currentUser.uid);
        if (!profile) return;
        
        // Actualizar UI con datos del perfil
        document.getElementById('user-name').textContent = 
            profile.displayName || this.currentUser.email?.split('@')[0] || 'Usuario';
        
        document.getElementById('user-plan').textContent = 
            profile.plan === 'PERSONAL_GRATUITO' ? 'Plan Gratuito' : 'Plan Premium';
        
        // Avatar
        const avatarUrl = profile.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'User')}&background=6C5CE7&color=fff&size=40`;
        document.getElementById('user-avatar').src = avatarUrl;
        
        // Actualizar barra de almacenamiento
        this.updateStorageBar(profile);
        
        // Deshabilitar subida para anónimos
        if (profile.isAnonymous) {
            const uploadBtn = document.getElementById('upload-btn');
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.title = 'Los usuarios anónimos no pueden subir archivos';
                uploadBtn.style.opacity = '0.5';
            }
        }
    },

    // Actualizar barra de almacenamiento
    updateStorageBar(profile) {
        const storageUsed = profile.storageUsed || 0;
        const plan = PLANS.PERSONAL.GRATUITO;
        const maxStorage = plan.storage;
        const percentage = Math.min(100, (storageUsed / maxStorage) * 100);
        
        document.getElementById('storage-progress').style.width = percentage + '%';
        document.getElementById('storage-text').textContent = 
            `${Utils.formatBytes(storageUsed)} / ${Utils.formatBytes(maxStorage)} usado`;
        
        // Cambiar color si está casi lleno
        if (percentage > 90) {
            document.getElementById('storage-progress').style.background = '#FF6B6B';
        }
    },

    // ========== NAVEGACIÓN ==========
    async navigateTo(view, folderId = null) {
        this.currentView = view;
        this.currentFolder = folderId;
        this.selectedFiles.clear();
        this.updateToolbar();
        
        // Actualizar botones de navegación
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-view="${view}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        // Actualizar título
        const titles = {
            'my-drive': 'Mi unidad',
            'shared': 'Compartidos conmigo',
            'recent': 'Recientes',
            'starred': 'Destacados',
            'trash': 'Papelera'
        };
        document.getElementById('current-view-title').textContent = titles[view] || 'Archivos';
        
        // Mostrar loader
        this.showContentLoader(true);
        
        try {
            let files = [];
            
            if (folderId) {
                files = await Database.getFilesInFolder(this.currentUser.uid, folderId);
            } else if (view === 'shared') {
                files = await ShareManager.getSharedWithMe(this.currentUser.uid);
            } else {
                files = await Database.getFilesByView(this.currentUser.uid, view);
            }
            
            this.filesCache = files;
            this.renderFileList(files);
        } catch (error) {
            console.error('❌ Error navegando:', error);
            this.showNotification('Error al cargar archivos', 'error');
        } finally {
            this.showContentLoader(false);
        }
    },

    // ========== RENDERIZADO DE ARCHIVOS ==========
    renderFileList(files) {
        const container = document.getElementById('file-list');
        const emptyState = document.getElementById('empty-state');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!files || files.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        files.forEach((file, index) => {
            const card = this.createFileCard(file, index);
            container.appendChild(card);
        });
    },

    createFileCard(file, index) {
        const card = document.createElement('div');
        card.className = 'file-card animate__animated animate__fadeInUp';
        card.style.animationDelay = `${index * 0.05}s`;
        card.dataset.fileId = file.id;
        
        const isFolder = file.type === 'folder';
        const iconClass = isFolder ? 'fa-solid fa-folder' : Utils.getFileIcon(file.name, file.type);
        const iconColor = isFolder ? '#FFD43B' : Utils.getFileColor(file.name, file.type);
        
        card.innerHTML = `
            <div class="file-icon">
                <i class="${iconClass}" style="color: ${iconColor}; font-size: 2rem;"></i>
                ${file.starred ? '<i class="fa-solid fa-star" style="color: #FFD43B; font-size: 0.8rem; position: absolute; top: 8px; left: 8px;"></i>' : ''}
            </div>
            <div class="file-name" title="${file.originalName || file.name}">${Utils.truncate(file.originalName || file.name, 25)}</div>
            <div class="file-meta">
                ${!isFolder ? Utils.formatBytes(file.size) : 'Carpeta'} · ${Utils.formatDate(file.updatedAt || file.createdAt)}
            </div>
            <div class="file-actions">
                ${!isFolder ? `<button onclick="event.stopPropagation(); UI.previewFile('${file.id}')" title="Vista previa"><i class="fa-solid fa-eye"></i></button>` : ''}
                <button onclick="event.stopPropagation(); UI.shareFileDialog('${file.id}')" title="Compartir"><i class="fa-solid fa-share-nodes"></i></button>
                <button onclick="event.stopPropagation(); UI.toggleStar('${file.id}')" title="Destacar"><i class="fa-solid fa-star"></i></button>
                <button onclick="event.stopPropagation(); UI.moveToTrash('${file.id}')" title="Mover a papelera"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // Eventos
        card.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                // Selección múltiple
                this.toggleFileSelection(file.id, card);
            } else if (isFolder) {
                // Navegar a carpeta
                this.navigateTo('my-drive', file.id);
            } else {
                // Abrir archivo
                this.previewFile(file.id);
            }
        });
        
        // Doble clic para abrir
        card.addEventListener('dblclick', (e) => {
            if (isFolder) {
                this.navigateTo('my-drive', file.id);
            } else {
                this.previewFile(file.id);
            }
        });
        
        // Click derecho
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, file);
        });
        
        return card;
    },

    // ========== OPERACIONES CON ARCHIVOS ==========
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const user = this.currentUser;
        if (!user) return;
        
        // Verificar si es anónimo
        const profile = await Database.getUserProfile(user.uid);
        if (profile?.isAnonymous) {
            this.showNotification('Los usuarios anónimos no pueden subir archivos', 'error');
            return;
        }
        
        for (const file of files) {
            try {
                this.showNotification(`Subiendo ${file.name}...`, 'success');
                
                await StorageManager.uploadFile(user.uid, file, (progress) => {
                    console.log(`Progreso ${file.name}: ${progress}%`);
                });
                
                this.showNotification(`${file.name} subido correctamente`, 'success');
            } catch (error) {
                this.showNotification(`Error al subir ${file.name}: ${error.message}`, 'error');
            }
        }
        
        // Recargar vista actual
        this.navigateTo(this.currentView, this.currentFolder);
        await this.loadUserProfile();
    },

    async createFolder() {
        const folderName = prompt('Nombre de la carpeta:');
        if (!folderName || !folderName.trim()) return;
        
        try {
            await Database.createFolder(this.currentUser.uid, folderName.trim(), this.currentFolder);
            this.showNotification('Carpeta creada', 'success');
            this.navigateTo(this.currentView, this.currentFolder);
        } catch (error) {
            this.showNotification('Error al crear carpeta', 'error');
        }
    },

    async previewFile(fileId) {
        const file = await Database.getFile(this.currentUser.uid, fileId);
        if (!file) return;
        
        if (file.type === 'folder') {
            this.navigateTo('my-drive', file.id);
            return;
        }
        
        try {
            const url = await StorageManager.getFileUrl(file);
            if (url) {
                if (url.startsWith('data:')) {
                    // Mostrar preview en modal para imágenes
                    if (file.type?.startsWith('image/')) {
                        this.showModal(`
                            <div style="text-align: center;">
                                <h3>${file.originalName || file.name}</h3>
                                <img src="${url}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;" alt="${file.name}">
                            </div>
                        `);
                    } else {
                        window.open(url, '_blank');
                    }
                } else {
                    window.open(url, '_blank');
                }
            } else {
                this.showNotification('No se puede previsualizar este archivo', 'error');
            }
        } catch (error) {
            this.showNotification('Error al abrir archivo', 'error');
        }
    },

    async moveToTrash(fileId) {
        if (!confirm('¿Mover a la papelera?')) return;
        
        try {
            await Database.moveToTrash(this.currentUser.uid, fileId);
            this.showNotification('Movido a la papelera', 'success');
            this.navigateTo(this.currentView, this.currentFolder);
            await this.loadUserProfile();
        } catch (error) {
            this.showNotification('Error al mover a la papelera', 'error');
        }
    },

    async toggleStar(fileId) {
        const file = await Database.getFile(this.currentUser.uid, fileId);
        if (!file) return;
        
        await Database.updateFile(this.currentUser.uid, fileId, { 
            starred: !file.starred 
        });
        
        this.navigateTo(this.currentView, this.currentFolder);
    },

    // ========== COMPARTIR ==========
    async shareFileDialog(fileId) {
        const file = await Database.getFile(this.currentUser.uid, fileId);
        if (!file) return;
        
        try {
            const result = await ShareManager.createShareLink(this.currentUser.uid, fileId);
            
            this.showModal(`
                <h3><i class="fa-solid fa-share-nodes"></i> Compartir: ${Utils.truncate(file.name, 30)}</h3>
                <div style="margin: 20px 0;">
                    <label>Link de acceso:</label>
                    <div class="input-group" style="margin-top: 8px;">
                        <input type="text" value="${result.link}" readonly class="input-field" id="share-link-input">
                        <button class="btn btn-primary btn-sm" onclick="ShareManager.copyToClipboard('${result.link}')">
                            <i class="fa-solid fa-copy"></i> Copiar
                        </button>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm" onclick="ShareManager.shareByEmail('${result.link}', prompt('Email del destinatario:'))">
                        <i class="fa-solid fa-envelope"></i> Enviar por email
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="window.open('${ShareManager.generateQRCode(result.link)}', '_blank')">
                        <i class="fa-solid fa-qrcode"></i> Código QR
                    </button>
                </div>
            `);
        } catch (error) {
            this.showNotification('Error al compartir', 'error');
        }
    },

    // ========== BÚSQUEDA ==========
    async searchFiles() {
        const query = document.getElementById('search-input')?.value.trim();
        
        if (!query) {
            this.navigateTo(this.currentView, this.currentFolder);
            return;
        }
        
        this.showContentLoader(true);
        
        try {
            const results = await Database.searchFiles(this.currentUser.uid, query);
            this.renderFileList(results);
        } catch (error) {
            this.showNotification('Error en búsqueda', 'error');
        } finally {
            this.showContentLoader(false);
        }
    },

    // ========== PERFIL Y AJUSTES ==========
    async showProfileModal() {
        const profile = await Database.getUserProfile(this.currentUser.uid);
        if (!profile) return;
        
        this.showModal(`
            <div class="profile-settings">
                <h2><i class="fa-solid fa-user-gear"></i> Mi perfil</h2>
                
                <div class="profile-avatar-section" style="text-align: center; margin: 20px 0;">
                    <img src="${profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'User')}&background=6C5CE7&color=fff&size=120`}" 
                         style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--primary);">
                    <button class="btn btn-outline btn-sm mt-10" onclick="UI.changeAvatar()">
                        <i class="fa-solid fa-camera"></i> Cambiar foto
                    </button>
                </div>
                
                <div class="input-group mt-10">
                    <label>Nombre de usuario</label>
                    <input type="text" id="profile-username" class="input-field" value="${profile.displayName || ''}" placeholder="Tu nombre">
                </div>
                
                <div class="input-group mt-10">
                    <label>Correo electrónico</label>
                    <input type="email" class="input-field" value="${profile.email || this.currentUser.email || ''}" readonly>
                </div>
                
                <div class="input-group mt-10">
                    <label>Plan actual</label>
                    <input type="text" class="input-field" value="${profile.plan || 'Gratuito'}" readonly>
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="UI.saveProfile()">
                        <i class="fa-solid fa-floppy-disk"></i> Guardar cambios
                    </button>
                    <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
                </div>
            </div>
        `);
    },

    async changeAvatar() {
        const url = prompt('URL de tu nueva foto de perfil:');
        if (!url) return;
        
        try {
            await Database.updateUserProfile(this.currentUser.uid, { photoURL: url });
            this.showNotification('Foto actualizada', 'success');
            await this.loadUserProfile();
            this.showProfileModal(); // Recargar modal
        } catch (error) {
            this.showNotification('Error al actualizar foto', 'error');
        }
    },

    async saveProfile() {
        const username = document.getElementById('profile-username')?.value.trim();
        
        if (!username) {
            this.showNotification('El nombre no puede estar vacío', 'error');
            return;
        }
        
        try {
            await Database.updateUserProfile(this.currentUser.uid, { 
                displayName: username 
            });
            
            // Actualizar en Firebase Auth
            const user = this.currentUser;
            if (user) {
                await user.updateProfile({ displayName: username });
            }
            
            this.showNotification('Perfil actualizado', 'success');
            this.closeModal();
            await this.loadUserProfile();
        } catch (error) {
            this.showNotification('Error al guardar perfil', 'error');
        }
    },

    showPlansModal() {
        this.showModal(`
            <h2><i class="fa-solid fa-crown"></i> Planes ShareIt</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
                <div class="plan-card" style="padding: 20px; border: 1px solid var(--glass-border); border-radius: var(--radius); text-align: center;">
                    <h3>Gratuito</h3>
                    <p style="font-size: 2rem; font-weight: 700;">0€</p>
                    <p>15 GB</p>
                    <p>IA básica</p>
                    <p>200 créditos</p>
                    <button class="btn btn-outline btn-sm mt-10" disabled>Actual</button>
                </div>
                <div class="plan-card" style="padding: 20px; border: 1px solid var(--primary); border-radius: var(--radius); text-align: center;">
                    <h3>Plus</h3>
                    <p style="font-size: 2rem; font-weight: 700;">1,99€</p>
                    <p>125 GB</p>
                    <p>IA avanzada</p>
                    <p>350 créditos/mes</p>
                    <button class="btn btn-primary btn-sm mt-10" onclick="UI.showNotification('Pagos no disponibles aún', 'error')">Mejorar</button>
                </div>
                <div class="plan-card" style="padding: 20px; border: 1px solid var(--glass-border); border-radius: var(--radius); text-align: center;">
                    <h3>Pro</h3>
                    <p style="font-size: 2rem; font-weight: 700;">19,99€</p>
                    <p>350 GB</p>
                    <p>IA premium</p>
                    <p>750 créditos/mes</p>
                    <button class="btn btn-primary btn-sm mt-10" onclick="UI.showNotification('Pagos no disponibles aún', 'error')">Mejorar</button>
                </div>
            </div>
        `);
    },

    // ========== MODAL ==========
    showModal(content) {
        const overlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        
        if (overlay && modalContent) {
            modalContent.innerHTML = content;
            overlay.style.display = 'flex';
        }
    },

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    // ========== NOTIFICACIONES ==========
    showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate__animated animate__fadeInRight`;
        notification.innerHTML = `
            <i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i>
            ${message}
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOutRight 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    // ========== UTILIDADES UI ==========
    showLoading(show) {
        const loader = document.getElementById('loading-screen');
        if (loader) loader.style.display = show ? 'flex' : 'none';
    },

    showContentLoader(show) {
        const loader = document.getElementById('content-loader');
        if (loader) loader.style.display = show ? 'block' : 'none';
    },

    showEmailAuthForm() {
        const section = document.getElementById('email-auth-section');
        if (section) {
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            this.isSidebarOpen = !this.isSidebarOpen;
            sidebar.classList.toggle('open', this.isSidebarOpen);
        }
    },

    toggleIAPanel() {
        const panel = document.getElementById('ia-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'flex';
            
            if (!isVisible) {
                document.getElementById('ia-input')?.focus();
            }
        }
    },

    toggleFileSelection(fileId, cardElement) {
        if (this.selectedFiles.has(fileId)) {
            this.selectedFiles.delete(fileId);
            cardElement?.classList.remove('selected');
        } else {
            this.selectedFiles.add(fileId);
            cardElement?.classList.add('selected');
        }
        this.updateToolbar();
    },

    updateToolbar() {
        const toolbar = document.getElementById('toolbar');
        const count = document.getElementById('selected-count');
        
        if (this.selectedFiles.size > 0) {
            if (toolbar) toolbar.style.display = 'flex';
            if (count) count.textContent = `${this.selectedFiles.size} seleccionado(s)`;
        } else {
            if (toolbar) toolbar.style.display = 'none';
        }
    },

    async checkSharedLink() {
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get('shared');
        
        if (sharedId) {
            const file = await ShareManager.getSharedFile(sharedId);
            if (file) {
                this.showNotification('Archivo compartido cargado', 'success');
                this.previewFile(file.id);
            }
        }
    },

    showContextMenu(x, y, file) {
        // Implementación básica de menú contextual
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu glass';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            z-index: 5000;
            padding: 8px;
            min-width: 180px;
            border-radius: var(--radius);
        `;
        
        menu.innerHTML = `
            <button class="nav-btn" onclick="UI.previewFile('${file.id}'); document.querySelector('.context-menu').remove();">
                <i class="fa-solid fa-eye"></i> Abrir
            </button>
            <button class="nav-btn" onclick="UI.shareFileDialog('${file.id}'); document.querySelector('.context-menu').remove();">
                <i class="fa-solid fa-share"></i> Compartir
            </button>
            <button class="nav-btn" onclick="UI.toggleStar('${file.id}'); document.querySelector('.context-menu').remove();">
                <i class="fa-solid fa-star"></i> Destacar
            </button>
            <button class="nav-btn" onclick="StorageManager.downloadFile(${JSON.stringify(file)}); document.querySelector('.context-menu').remove();">
                <i class="fa-solid fa-download"></i> Descargar
            </button>
            <hr style="border-color: var(--glass-border); margin: 4px 0;">
            <button class="nav-btn" style="color: var(--danger);" onclick="UI.moveToTrash('${file.id}'); document.querySelector('.context-menu').remove();">
                <i class="fa-solid fa-trash"></i> Eliminar
            </button>
        `;
        
        document.body.appendChild(menu);
        
        // Cerrar al hacer click fuera
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                document.querySelector('.context-menu')?.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }
};

console.log('🎨 UI cargada completamente');
