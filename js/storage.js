// js/storage.js - Sistema de almacenamiento híbrido Base64 + Puter.js

const StorageManager = {
    puterReady: false,
    uploadQueue: [],
    currentUploads: new Map(),

    // Inicializar Puter.js
    async initPuter() {
        try {
            if (typeof puter !== 'undefined') {
                // En producción: puter.auth.setAPIKey('tu-api-key')
                this.puterReady = true;
                console.log('✅ Puter.js listo para almacenamiento grande');
                return true;
            } else {
                console.warn('⚠️ Puter.js no cargado. Solo archivos <15MB disponibles');
                this.puterReady = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Error inicializando Puter:', error);
            this.puterReady = false;
            return false;
        }
    },

    // Subir archivo (decide automáticamente el método)
    async uploadFile(userId, file, onProgress = null) {
        // Verificar espacio disponible
        const spaceAvailable = await this.checkSpaceAvailable(userId, file.size);
        if (!spaceAvailable) {
            throw new Error('No tienes suficiente espacio de almacenamiento');
        }

        if (Utils.isBase64File(file)) {
            return await this._uploadAsBase64(userId, file, onProgress);
        } else {
            return await this._uploadToPuter(userId, file, onProgress);
        }
    },

    // Subir archivo pequeño como Base64
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
                        parentFolder: null,
                        inTrash: false,
                        starred: false,
                        shared: false,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP
                    };
                    
                    // Guardar en Firebase
                    await Database.createFile(userId, fileData);
                    
                    // Actualizar espacio usado
                    await Database.updateStorageUsed(userId);
                    
                    console.log(`✅ Archivo guardado en Base64: ${file.name}`);
                    resolve(fileData);
                } catch (error) {
                    console.error('❌ Error guardando Base64:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('❌ Error leyendo archivo:', error);
                reject(error);
            };
            
            reader.readAsDataURL(file);
        });
    },

    // Subir archivo grande a Puter.js
    async _uploadToPuter(userId, file, onProgress) {
        if (!this.puterReady) {
            throw new Error('Puter.js no está disponible. El archivo es demasiado grande para Base64.');
        }
        
        try {
            if (onProgress) onProgress(10);
            
            // Subir a Puter.js
            const puterFile = await puter.upload(file, {
                name: file.name,
                dedicated: true
            });
            
            if (onProgress) onProgress(80);
            
            const fileId = Utils.generateId();
            const fileData = {
                id: fileId,
                name: Utils.sanitizeFileName(file.name),
                originalName: file.name,
                type: file.type,
                size: file.size,
                puterFileId: puterFile.id || puterFile.uid,
                puterUrl: puterFile.url || null,
                storageMethod: 'puter',
                userId: userId,
                parentFolder: null,
                inTrash: false,
                starred: false,
                shared: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            // Guardar metadatos en Firebase
            await Database.createFile(userId, fileData);
            
            // Actualizar espacio usado
            await Database.updateStorageUsed(userId);
            
            if (onProgress) onProgress(100);
            
            console.log(`✅ Archivo subido a Puter.js: ${file.name}`);
            return fileData;
        } catch (error) {
            console.error('❌ Error subiendo a Puter.js:', error);
            throw new Error('Error al subir a la nube: ' + error.message);
        }
    },

    // Obtener URL de acceso al archivo
    async getFileUrl(fileData) {
        if (!fileData) return null;
        
        if (fileData.storageMethod === 'base64' && fileData.base64Url) {
            return fileData.base64Url;
        }
        
        if (fileData.storageMethod === 'puter' && fileData.puterFileId && this.puterReady) {
            try {
                const puterFile = await puter.fs.get(fileData.puterFileId);
                return puterFile.url || puterFile.link;
            } catch (error) {
                console.error('❌ Error obteniendo URL de Puter:', error);
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
        
        // Si es Base64, descargar directamente
        if (url.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.originalName || fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        // Si es URL externa, abrir en nueva pestaña
        window.open(url, '_blank');
    },

    // Verificar espacio disponible
    async checkSpaceAvailable(userId, newFileSize) {
        const userProfile = await Database.getUserProfile(userId);
        if (!userProfile) return false;
        
        const plan = PLANS.PERSONAL.GRATUITO; // Por defecto
        const maxStorage = plan.storage || 15 * 1024 * 1024 * 1024;
        const currentUsed = userProfile.storageUsed || 0;
        
        return (currentUsed + newFileSize) <= maxStorage;
    },

    // Eliminar archivo y liberar espacio
    async deleteFilePermanently(userId, fileData) {
        // Si está en Puter, eliminar de allí también
        if (fileData.storageMethod === 'puter' && fileData.puterFileId && this.puterReady) {
            try {
                await puter.fs.delete(fileData.puterFileId);
            } catch (error) {
                console.warn('⚠️ No se pudo eliminar de Puter:', error);
            }
        }
        
        await Database.deleteFile(userId, fileData.id);
        await Database.updateStorageUsed(userId);
    },

    // Procesar cola de subida
    async processUploadQueue(userId) {
        while (this.uploadQueue.length > 0) {
            const { file, resolve, reject } = this.uploadQueue.shift();
            try {
                const result = await this.uploadFile(userId, file);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }
    }
};

console.log('☁️ Sistema de almacenamiento cargado');
