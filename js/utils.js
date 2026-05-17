// js/utils.js
const Utils = {
    // Formatear bytes a KB, MB, GB, etc.
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    // Generar un ID único para carpetas/archivos
    generateId() {
        return 'sh_' + Math.random().toString(36).substr(2, 9);
    },

    // Verificar si un archivo debe ir por Base64 o API (estrictamente 15MB)
    isBase64File(file) {
        const limitMB = 15;
        return file.size <= limitMB * 1024 * 1024;
    }
};
