// js/share.js - Sistema de compartición con links aleatorios

const ShareManager = {
    // Crear link para compartir
    async createShareLink(userId, fileId, permissions = 'read') {
        try {
            const shareId = await Database.createShareLink(userId, fileId, permissions);
            const shareableLink = `${window.location.origin}?shared=${shareId}`;
            return {
                shareId,
                link: shareableLink,
                fileId
            };
        } catch (error) {
            console.error('❌ Error creando link:', error);
            throw error;
        }
    },

    // Obtener archivo compartido
    async getSharedFile(shareId) {
        try {
            const fileData = await Database.getSharedFile(shareId);
            return fileData;
        } catch (error) {
            console.error('❌ Error obteniendo archivo compartido:', error);
            return null;
        }
    },

    // Revocar acceso compartido
    async revokeShareLink(userId, fileId, shareId) {
        try {
            await database.ref(`shared_links/${shareId}`).remove();
            await Database.updateFile(userId, fileId, { shared: false });
            return true;
        } catch (error) {
            console.error('❌ Error revocando link:', error);
            throw error;
        }
    },

    // Obtener todos los links compartidos por un usuario
    async getUserSharedLinks(userId) {
        try {
            const snap = await database.ref('shared_links')
                .orderByChild('ownerId')
                .equalTo(userId)
                .once('value');
            
            const links = snap.val();
            return links ? Object.values(links) : [];
        } catch (error) {
            console.error('❌ Error obteniendo links compartidos:', error);
            return [];
        }
    },

    // Generar código QR para link (placeholder)
    generateQRCode(link) {
        // En una implementación real, usarías una librería QR
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
    },

    // Copiar link al portapapeles
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                UI.showNotification('¡Link copiado al portapapeles!', 'success');
                return true;
            } else {
                // Fallback para navegadores antiguos
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                UI.showNotification('¡Link copiado!', 'success');
                return true;
            }
        } catch (error) {
            console.error('❌ Error copiando al portapapeles:', error);
            UI.showNotification('No se pudo copiar el link', 'error');
            return false;
        }
    },

    // Compartir por email (placeholder)
    async shareByEmail(link, recipientEmail) {
        // En producción, usarías un servicio de email
        const subject = 'Archivo compartido contigo - ShareIt';
        const body = `¡Hola!\n\nTe han compartido un archivo en ShareIt.\n\nAccede aquí: ${link}\n\nSaludos.`;
        const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink);
        return true;
    },

    // Verificar permisos de acceso
    async checkAccessPermission(shareId, userId) {
        const linkSnap = await database.ref(`shared_links/${shareId}`).once('value');
        if (!linkSnap.exists()) return false;
        
        const linkData = linkSnap.val();
        
        // El dueño siempre tiene acceso
        if (linkData.ownerId === userId) return 'owner';
        
        // Usuarios con link tienen acceso de lectura
        return linkData.permissions || 'read';
    },

    // Obtener archivos compartidos conmigo
    async getSharedWithMe(userId) {
        try {
            // Obtener todos los links donde el usuario ha accedido
            const allLinksSnap = await database.ref('shared_links').once('value');
            const allLinks = allLinksSnap.val();
            
            if (!allLinks) return [];
            
            const sharedFiles = [];
            
            for (const [shareId, linkData] of Object.entries(allLinks)) {
                if (linkData.accessCount > 0) {
                    const fileData = await Database.getFile(linkData.ownerId, linkData.fileId);
                    if (fileData && !fileData.inTrash) {
                        sharedFiles.push({
                            ...fileData,
                            shareId,
                            sharedBy: linkData.ownerId,
                            permissions: linkData.permissions
                        });
                    }
                }
            }
            
            return sharedFiles;
        } catch (error) {
            console.error('❌ Error obteniendo compartidos:', error);
            return [];
        }
    }
};

console.log('🔗 Sistema de compartición cargado');
