// js/storage.js - CORREGIDO (Puter.js sin errores de consola)

const StorageManager = {
    puterReady: false,
    puterChecked: false,

    // Inicializar Puter.js - Versión robusta
    async initPuter() {
        // Si ya verificamos, no volver a verificar
        if (this.puterChecked) {
            return this.puterReady;
        }
        
        this.puterChecked = true;
        
        try {
            // Verificar si el script de Puter.js se cargó
            if (typeof puter === 'undefined') {
                console.log('ℹ️ Puter.js no está disponible. Solo se usarán archivos <15MB.');
                this.puterReady = false;
                return false;
            }
            
            // Verificar que puter.fs existe
            if (!puter.fs || typeof puter.fs.readdir !== 'function') {
                console.log('⚠️ Puter.js cargado pero fs no disponible. Usando solo Base64.');
                this.puterReady = false;
                return false;
            }
            
            // Probar el sistema de archivos
            try {
                await puter.fs.readdir('/');
                console.log('✅ Puter.js operativo correctamente');
                this.puterReady = true;
                return true;
            } catch (e) {
                // Si falla readdir, puede ser porque el directorio está vacío
                // Intentar crear un directorio de prueba
                try {
                    await puter.fs.mkdir('/shareit_test');
                    await puter.fs.delete('/shareit_test');
                    console.log('✅ Puter.js operativo (verificación alternativa)');
                    this.puterReady = true;
                    return true;
                } catch (e2) {
                    console.log('⚠️ Puter.js no pudo verificar el sistema de archivos:', e2.message);
                    this.puterReady = false;
                    return false;
                }
            }
        } catch (error) {
            console.log('ℹ️ Puter.js no disponible:', error.message);
            this.puterReady = false;
            return false;
        }
    },

    // Subir archivo
    async uploadFile(userId, file, onProgress = null) {
        // Verificar espacio
        const spaceAvailable = await this.checkSpaceAvailable(userId, file.size);
        if (!spaceAvailable) {
            throw new Error('No tienes suficiente espacio de almacenamiento');
        }

        // Decidir método según tamaño
        if (Utils.isBase64File(file)) {
            console.log(`📦 Base64: ${file.name} (${Utils.formatBytes(file.size)})`);
            return await this._uploadAsBase64(userId, file, onProgress);
        } else {
            // Para archivos grandes, verificar Puter
            await this.initPuter();
            
            if (this.puterReady) {
                console.log(`☁️ Puter.js: ${file.name} (${Utils.formatBytes(file.size)})`);
                return await this._uploadToPuter(userId, file, onProgress);
            } else {
                throw new Error('El archivo es demasiado grande (>15MB) y Puter.js no está disponible. Intenta con un archivo más pequeño.');
            }
        }
    },

    // Subir como Base64
    async _uploadAsBase64(userId, file, onProgress) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onprogress = (e) => {
                if (onProgress && e.lengthComputable) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
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
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsDataURL(file);
        });
    },

    // Subir a Puter.js
    async _uploadToPuter(userId, file, onProgress) {
        try {
            if (onProgress) onProgress(5);
            
            // Crear carpeta del usuario
            const userFolder = `/shareit_${userId}`;
            try {
                await puter.fs.mkdir(userFolder);
            } catch (e) {
                // Ya existe, ignorar
            }
            
            if (onProgress) onProgress(10);
            
            // Subir archivo
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const uploadResult = await puter.fs.upload(
                file,
                `${userFolder}/${fileName}`,
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
                puterPath: uploadResult.path || `${userFolder}/${fileName}`,
                puterFileId: uploadResult.id || uploadResult.uid || fileId,
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
            console.error('❌ Error subiendo a Puter:', error);
            throw new Error('Error al subir a Puter.js: ' + error.message);
        }
    },

    // Obtener URL del archivo
    async getFileUrl(fileData) {
        if (!fileData) return null;
        
        // Base64
        if (fileData.storageMethod === 'base64' && fileData.base64Url) {
            return fileData.base64Url;
        }
        
        // Puter.js
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                const url = await puter.fs.getDownloadUrl(fileData.puterPath);
                return url;
            } catch (error) {
                console.log('No se pudo obtener URL de descarga, intentando leer archivo...');
                try {
                    const content = await puter.fs.read(fileData.puterPath);
                    if (typeof content === 'string') {
                        return content;
                    }
                } catch (e) {
                    console.error('Error lectura alternativa:', e);
                }
                return null;
            }
        }
        
        return null;
    },

    // Descargar archivo
    async downloadFile(fileData) {
        const url = await this.getFileUrl(fileData);
        if (!url) {
            throw new Error('No se puede acceder al archivo');
        }
        
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

    // Eliminar permanentemente
    async deleteFilePermanently(userId, fileData) {
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                await puter.fs.delete(fileData.puterPath);
            } catch (error) {
                console.log('No se pudo eliminar de Puter:', error.message);
            }
        }
        
        await Database.deleteFile(userId, fileData.id);
        await Database.updateStorageUsed(userId);
    },

    // Verificar espacio
    async checkSpaceAvailable(userId, newFileSize) {
        const profile = await Database.getUserProfile(userId);
        if (!profile) return false;
        
        const planId = profile.plan || 'PERSONAL_GRATUITO';
        const maxStorage = PLANS.getStorageLimit(planId);
        const currentUsed = profile.storageUsed || 0;
        
        return (currentUsed + newFileSize) <= maxStorage;
    }
};

// Inicializar Puter cuando el script cargue
setTimeout(() => {
    StorageManager.initPuter().then(ready => {
        if (ready) {
            console.log('✅ Puter.js inicializado automáticamente');
        } else {
            console.log('ℹ️ Puter.js no disponible - usando solo Base64 para archivos <15MB');
        }
    });
}, 1000);

console.log('☁️ StorageManager cargado (con detección robusta de Puter.js)');
