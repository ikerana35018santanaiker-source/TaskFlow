// js/share.js
const ShareManager = {
    // Crear link compartido
    async createShareLink(userId, fileId) {
        const shareId = 'link_' + Utils.generateId();
        const shareData = {
            shareId,
            fileId,
            ownerId: userId,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            accessCount: 0
        };
        await database.ref(`shared_links/${shareId}`).set(shareData);
        return `${window.location.origin}?shared=${shareId}`;
    },

    // Obtener archivo desde link compartido
    async getSharedFile(shareId) {
        const snap = await database.ref(`shared_links/${shareId}`).once('value');
        if (!snap.exists()) return null;
        const linkData = snap.val();
        // Incrementar contador
        await database.ref(`shared_links/${shareId}/accessCount`).set(firebase.database.ServerValue.increment(1));
        // Obtener datos del archivo original
        const fileSnap = await database.ref(`files/${linkData.ownerId}/${linkData.fileId}`).once('value');
        return fileSnap.val();
    }
};
