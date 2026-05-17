// js/database.js - Operaciones con Realtime Database

const Database = {
    // ========== REFERENCIAS ==========
    getUserRef(userId) {
        return database.ref(`users/${userId}`);
    },

    getUserFilesRef(userId) {
        return database.ref(`files/${userId}`);
    },

    getSharedLinksRef() {
        return database.ref('shared_links');
    },

    // ========== PERFIL DE USUARIO ==========
    async getUserProfile(userId) {
        const snap = await this.getUserRef(userId).once('value');
        return snap.val() || null;
    },

    async updateUserProfile(userId, data) {
        await this.getUserRef(userId).update(data);
    },

    // ========== ARCHIVOS ==========
    async createFile(userId, fileData) {
        const fileId = fileData.id || Utils.generateId();
        const ref = this.getUserFilesRef(userId).child(fileId);
        
        const data = {
            ...fileData,
            id: fileId,
            createdAt: fileData.createdAt || firebase.database.ServerValue.TIMESTAMP,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            inTrash: false,
            starred: false,
            shared: false
        };
        
        await ref.set(data);
        return data;
    },

    async getFile(userId, fileId) {
        const snap = await this.getUserFilesRef(userId).child(fileId).once('value');
        return snap.val() || null;
    },

    async updateFile(userId, fileId, updates) {
        updates.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        await this.getUserFilesRef(userId).child(fileId).update(updates);
    },

    async deleteFile(userId, fileId) {
        await this.getUserFilesRef(userId).child(fileId).remove();
    },

    // Obtener todos los archivos de un usuario
    async getAllUserFiles(userId) {
        const snap = await this.getUserFilesRef(userId).once('value');
        const data = snap.val();
        return data ? Object.values(data) : [];
    },

    // Obtener archivos por vista
    async getFilesByView(userId, view) {
        const allFiles = await this.getAllUserFiles(userId);
        
        switch (view) {
            case 'my-drive':
                return allFiles.filter(f => !f.inTrash && !f.parentFolder);
            case 'trash':
                return allFiles.filter(f => f.inTrash);
            case 'starred':
                return allFiles.filter(f => f.starred && !f.inTrash);
            case 'recent':
                return allFiles
                    .filter(f => !f.inTrash)
                    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
                    .slice(0, 50);
            case 'shared':
                return allFiles.filter(f => f.shared && !f.inTrash);
            default:
                return allFiles.filter(f => !f.inTrash);
        }
    },

    // Obtener archivos de una carpeta
    async getFilesInFolder(userId, folderId) {
        const allFiles = await this.getAllUserFiles(userId);
        return allFiles.filter(f => f.parentFolder === folderId && !f.inTrash);
    },

    // Buscar archivos
    async searchFiles(userId, query) {
        const allFiles = await this.getAllUserFiles(userId);
        const q = query.toLowerCase();
        return allFiles.filter(f => 
            !f.inTrash && f.name?.toLowerCase().includes(q)
        );
    },

    // ========== CARPETAS ==========
    async createFolder(userId, folderName, parentFolder = null) {
        const folderData = {
            id: Utils.generateId(),
            name: folderName || 'Nueva carpeta',
            type: 'folder',
            parentFolder: parentFolder,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            inTrash: false,
            starred: false
        };
        return await this.createFile(userId, folderData);
    },

    // ========== PAPELERA ==========
    async moveToTrash(userId, fileId) {
        await this.updateFile(userId, fileId, { inTrash: true });
    },

    async restoreFromTrash(userId, fileId) {
        await this.updateFile(userId, fileId, { inTrash: false });
    },

    async emptyTrash(userId) {
        const trashFiles = await this.getFilesByView(userId, 'trash');
        const promises = trashFiles.map(f => this.deleteFile(userId, f.id));
        await Promise.all(promises);
    },

    // ========== COMPARTIR ==========
    async createShareLink(userId, fileId, permissions = 'read') {
        const shareId = Utils.generateId();
        const shareData = {
            shareId,
            fileId,
            ownerId: userId,
            permissions,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            accessCount: 0
        };
        
        await this.getSharedLinksRef().child(shareId).set(shareData);
        await this.updateFile(userId, fileId, { shared: true });
        
        return shareId;
    },

    async getSharedFile(shareId) {
        const linkSnap = await this.getSharedLinksRef().child(shareId).once('value');
        if (!linkSnap.exists()) return null;
        
        const linkData = linkSnap.val();
        
        // Incrementar contador
        await this.getSharedLinksRef().child(shareId).child('accessCount')
            .set(firebase.database.ServerValue.increment(1));
        
        // Obtener archivo original
        const fileSnap = await this.getUserFilesRef(linkData.ownerId)
            .child(linkData.fileId).once('value');
        
        return {
            ...fileSnap.val(),
            shareInfo: linkData
        };
    },

    // ========== ALMACENAMIENTO ==========
    async getStorageUsed(userId) {
        const files = await this.getAllUserFiles(userId);
        return files.reduce((total, file) => total + (file.size || 0), 0);
    },

    async updateStorageUsed(userId) {
        const used = await this.getStorageUsed(userId);
        await this.updateUserProfile(userId, { storageUsed: used });
        return used;
    }
};

console.log('🗄️ Base de datos cargada');
