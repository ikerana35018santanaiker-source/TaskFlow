// js/storage.js - CORREGIDO

const StorageManager = {
    puterReady: false,

    async initPuter() {
        try {
            // Verificar si Puter.js está disponible
            if (typeof puter === 'undefined') {
                console.warn('⚠️ Puter.js no detectado. Verifica que el script esté cargado.');
                this.puterReady = false;
                return false;
            }
            
            console.log('✅ Puter.js detectado correctamente');
            
            // Verificar que el sistema de archivos funciona
            try {
                const testDir = await puter.fs.readdir('/');
                console.log('✅ Sistema de archivos Puter operativo');
            } catch (e) {
                // Puede fallar si el directorio no existe, es normal
                console.log('ℹ️ Puter.js listo (directorio vacío o nuevo)');
            }
            
            this.puterReady = true;
            return true;
        } catch (error) {
            console.error('❌ Error al verificar Puter.js:', error);
            this.puterReady = false;
            return false;
        }
    },

    async uploadFile(userId, file, onProgress = null) {
        const spaceAvailable = await this.checkSpaceAvailable(userId, file.size);
        if (!spaceAvailable) {
            throw new Error('No tienes suficiente espacio de almacenamiento');
        }

        if (Utils.isBase64File(file)) {
            return await this._uploadAsBase64(userId, file, onProgress);
        } else {
            // Verificar Puter.js antes de subir
            if (!this.puterReady) {
                await this.initPuter();
                if (!this.puterReady) {
                    throw new Error('Puter.js no está disponible para archivos grandes (>15MB)');
                }
            }
            return await this._uploadToPuter(userId, file, onProgress);
        }
    },

    async _uploadAsBase64(userId, file, onProgress) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onprogress = (e) => {
                if (onProgress && e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    onProgress(progress);
                }
            };
            
            reader.onload = async (e) => {
                try {
                    const fileId = Utils.generateId();
                    const fileData = {
                        id: fileId,
                        name: Utils.sanitizeFileName(file.name),
                        originalName: file.name,
                        type: file.type,
                        size: file.size,
                        base64Url: e.target.result,
                        storageMethod: 'base64',
                        userId: userId,
                        parentFolder: UI.currentFolder || null,
                        inTrash: false,
                        starred: false,
                        shared: false,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP
                    };
                    
                    await Database.createFile(userId, fileData);
                    await Database.updateStorageUsed(userId);
                    
                    if (onProgress) onProgress(100);
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    },

    async _uploadToPuter(userId, file, onProgress) {
        try {
            if (onProgress) onProgress(5);
            
            const userFolder = `/shareit_${userId}`;
            try {
                await puter.fs.mkdir(userFolder);
            } catch (e) {
                // Ya existe
            }
            
            if (onProgress) onProgress(10);
            
            const uploadResult = await puter.fs.upload(
                file,
                `${userFolder}/${Date.now()}_${file.name}`,
                {
                    overwrite: true,
                    onProgress: (progress) => {
                        if (onProgress) {
                            const scaledProgress = 10 + Math.round(progress.percent * 0.85);
                            onProgress(scaledProgress);
                        }
                    }
                }
            );
            
            if (onProgress) onProgress(95);
            
            const fileId = Utils.generateId();
            const fileData = {
                id: fileId,
                name: Utils.sanitizeFileName(file.name),
                originalName: file.name,
                type: file.type,
                size: file.size,
                puterPath: uploadResult.path,
                puterFileId: uploadResult.id || uploadResult.uid,
                storageMethod: 'puter',
                userId: userId,
                parentFolder: UI.currentFolder || null,
                inTrash: false,
                starred: false,
                shared: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            await Database.createFile(userId, fileData);
            await Database.updateStorageUsed(userId);
            
            if (onProgress) onProgress(100);
            return fileData;
        } catch (error) {
            console.error('❌ Error Puter.js:', error);
            throw error;
        }
    },

    async getFileUrl(fileData) {
        if (!fileData) return null;
        
        if (fileData.storageMethod === 'base64' && fileData.base64Url) {
            return fileData.base64Url;
        }
        
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                const url = await puter.fs.getDownloadUrl(fileData.puterPath);
                return url;
            } catch (error) {
                console.error('Error obteniendo URL:', error);
                // Intentar leer el contenido
                try {
                    const content = await puter.fs.read(fileData.puterPath);
                    if (typeof content === 'string') {
                        return content; // Podría ser base64 o texto
                    }
                } catch (e) {
                    console.error('Error lectura alternativa:', e);
                }
                return null;
            }
        }
        
        return null;
    },

    async downloadFile(fileData) {
        const url = await this.getFileUrl(fileData);
        if (!url) throw new Error('No se puede acceder al archivo');
        
        if (url.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.originalName || fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        window.open(url, '_blank');
    },

    async deleteFilePermanently(userId, fileData) {
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                await puter.fs.delete(fileData.puterPath);
            } catch (error) {
                console.warn('No se pudo eliminar de Puter:', error.message);
            }
        }
        
        await Database.deleteFile(userId, fileData.id);
        await Database.updateStorageUsed(userId);
    },

    async checkSpaceAvailable(userId, newFileSize) {
        const profile = await Database.getUserProfile(userId);
        if (!profile) return false;
        
        const planId = profile.plan || 'PERSONAL_GRATUITO';
        const maxStorage = PLANS.getStorageLimit(planId);
        const currentUsed = profile.storageUsed || 0;
        
        return (currentUsed + newFileSize) <= maxStorage;
    }
};

console.log('☁️ StorageManager cargado (con verificación de Puter.js)');
