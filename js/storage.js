// js/storage.js - Almacenamiento con Puter.js (SIN API KEY)

const StorageManager = {
    puterReady: false,
    puterFS: null,

    // Inicializar Puter.js - NO necesita API Key
    async initPuter() {
        try {
            if (typeof puter !== 'undefined') {
                console.log('✅ Puter.js detectado, inicializando...');
                
                // Puter.js se inicializa automáticamente
                // No necesita auth ni API Key para funcionar
                this.puterFS = puter.fs;
                
                // Verificar que funciona listando el directorio raíz
                try {
                    const rootDir = await this.puterFS.readdir('/');
                    console.log('✅ Puter.js operativo. Directorio raíz:', rootDir);
                } catch (e) {
                    // Puede que el directorio raíz esté vacío, es normal
                    console.log('✅ Puter.js listo (directorio vacío)');
                }
                
                this.puterReady = true;
                return true;
            } else {
                console.warn('⚠️ Puter.js no está cargado en el HTML');
                this.puterReady = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Error al inicializar Puter.js:', error);
            this.puterReady = false;
            return false;
        }
    },

    // Subir archivo - Decide automáticamente el método
    async uploadFile(userId, file, onProgress = null) {
        // Verificar espacio disponible
        const spaceAvailable = await this.checkSpaceAvailable(userId, file.size);
        if (!spaceAvailable) {
            throw new Error('No tienes suficiente espacio de almacenamiento');
        }

        // Decidir método según tamaño (15 MB)
        if (Utils.isBase64File(file)) {
            console.log(`📦 Usando Base64 para: ${file.name} (${Utils.formatBytes(file.size)})`);
            return await this._uploadAsBase64(userId, file, onProgress);
        } else {
            console.log(`☁️ Usando Puter.js para: ${file.name} (${Utils.formatBytes(file.size)})`);
            return await this._uploadToPuter(userId, file, onProgress);
        }
    },

    // Subir archivo pequeño como Base64 en Firebase
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
                    console.log(`✅ Base64 guardado: ${file.name}`);
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    },

    // Subir archivo grande a Puter.js
    async _uploadToPuter(userId, file, onProgress) {
        if (!this.puterReady) {
            // Si Puter no está listo, intentar inicializar
            const initialized = await this.initPuter();
            if (!initialized) {
                throw new Error('Puter.js no está disponible. El archivo es demasiado grande.');
            }
        }
        
        try {
            if (onProgress) onProgress(5);
            
            // Crear carpeta del usuario en Puter
            const userFolder = `/shareit_${userId}`;
            try {
                await this.puterFS.mkdir(userFolder);
            } catch (e) {
                // La carpeta ya existe, continuar
            }
            
            if (onProgress) onProgress(10);
            
            // Subir archivo a Puter.js
            const uploadResult = await this.puterFS.upload(
                file,
                `${userFolder}/${file.name}`,
                {
                    overwrite: true,
                    onProgress: (progress) => {
                        if (onProgress) {
                            // Progreso de 10% a 90%
                            const scaledProgress = 10 + Math.round(progress.percent * 0.8);
                            onProgress(scaledProgress);
                        }
                    }
                }
            );
            
            if (onProgress) onProgress(95);
            
            // Guardar referencia en Firebase
            const fileId = Utils.generateId();
            const fileData = {
                id: fileId,
                name: Utils.sanitizeFileName(file.name),
                originalName: file.name,
                type: file.type,
                size: file.size,
                puterPath: uploadResult.path || `${userFolder}/${file.name}`,
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
            console.log(`✅ Puter.js subido: ${file.name}`);
            resolve(fileData);
            
        } catch (error) {
            console.error('❌ Error subiendo a Puter.js:', error);
            throw new Error('Error al subir archivo grande: ' + error.message);
        }
    },

    // Obtener URL del archivo para descarga/preview
    async getFileUrl(fileData) {
        if (!fileData) return null;
        
        // Si es Base64, devolver directamente
        if (fileData.storageMethod === 'base64' && fileData.base64Url) {
            return fileData.base64Url;
        }
        
        // Si está en Puter, obtener URL de descarga
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                const url = await this.puterFS.getDownloadUrl(fileData.puterPath);
                return url;
            } catch (error) {
                console.error('❌ Error obteniendo URL de Puter:', error);
                // Intentar leer el archivo como alternativa
                try {
                    const content = await this.puterFS.read(fileData.puterPath);
                    return content; // Puede ser base64 o blob URL
                } catch (e) {
                    console.error('❌ Error lectura alternativa:', e);
                    return null;
                }
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
        
        // Si es Base64
        if (url.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.originalName || fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        // Si es URL externa
        window.open(url, '_blank');
    },

    // Eliminar archivo permanentemente
    async deleteFilePermanently(userId, fileData) {
        // Si está en Puter, eliminar el archivo físico
        if (fileData.storageMethod === 'puter' && fileData.puterPath && this.puterReady) {
            try {
                await this.puterFS.delete(fileData.puterPath);
                console.log('🗑️ Archivo eliminado de Puter:', fileData.puterPath);
            } catch (error) {
                console.warn('⚠️ No se pudo eliminar de Puter:', error.message);
            }
        }
        
        // Eliminar de Firebase
        await Database.deleteFile(userId, fileData.id);
        await Database.updateStorageUsed(userId);
    },

    // Verificar espacio disponible
    async checkSpaceAvailable(userId, newFileSize) {
        const profile = await Database.getUserProfile(userId);
        if (!profile) return false;
        
        const planId = profile.plan || 'PERSONAL_GRATUITO';
        const maxStorage = PLANS.getStorageLimit(planId);
        const currentUsed = profile.storageUsed || 0;
        
        return (currentUsed + newFileSize) <= maxStorage;
    },

    // Obtener estadísticas de almacenamiento
    async getStorageStats(userId) {
        const profile = await Database.getUserProfile(userId);
        const planId = profile?.plan || 'PERSONAL_GRATUITO';
        const plan = PLANS.getPlanById(planId);
        
        return {
            used: profile?.storageUsed || 0,
            total: plan?.storage || 15 * 1024 * 1024 * 1024,
            planName: plan?.name || 'Gratuito',
            percentage: ((profile?.storageUsed || 0) / (plan?.storage || 1)) * 100
        };
    }
};

console.log('☁️ StorageManager cargado (Base64 + Puter.js sin API Key)');
