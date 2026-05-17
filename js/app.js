// js/app.js
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.completeSignInWithLink();

    Auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userSnap = await database.ref(`users/${user.uid}`).once('value');
            const userData = userSnap.val() || {};
            UI.renderApp(user, userData);
        } else {
            document.getElementById('auth-container').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
        }
    });

    // Manejar acceso mediante link compartido
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('shared');
    if (sharedId) {
        const file = await ShareManager.getSharedFile(sharedId);
        if (file) UI.previewFile(file);
    }
});
