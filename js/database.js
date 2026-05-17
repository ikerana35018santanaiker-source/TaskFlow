// js/database.js
const Database = {
    // Crear referencia a archivos de un usuario
    getUserFilesRef(userId) {
        return database.ref(`files/${userId}`);
    },

    // Crear carpeta
    async createFolder(userId, folderName, parentFolder = 'root') {
        const folderId = Utils.generateId();
        const folderData = {
            id: folderId,
            name: folderName,
            type: 'folder',
            parentFolder: parentFolder,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            inTrash: false
        };
        await this.getUserFilesRef(userId).child(folderId).set(folderData);
        return folderData;
    },

    // Mover a papelera
    async moveToTrash(userId, fileId) {
        await this.getUserFilesRef(userId).child(fileId).update({ inTrash: true });
    },

    // Eliminar permanentemente
    async deletePermanently(userId, fileId) {
        await this.getUserFilesRef(userId).child(fileId).remove();
    },

    // Obtener todos los archivos (incluye papelera)
    async getAllUserFiles(userId) {
        const snap = await this.getUserFilesRef(userId).once('value');
        return snap.val() ? Object.values(snap.val()) : [];
    }
};
