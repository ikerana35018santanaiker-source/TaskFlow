const firebaseConfig = {
    apiKey: "AIzaSyDKurDI4iIcV_6LnzLkML0E3hM9hqWaMZg",
    authDomain: "shareit-c1222.firebaseapp.com",
    databaseURL: "https://shareit-c1222-default-rtdb.firebaseio.com",
    projectId: "shareit-c1222",
    storageBucket: "shareit-c1222.firebasestorage.app",
    messagingSenderId: "466346058481",
    appId: "1:466346058481:web:733bcea3730cac9d9a3f50"
};

// Solo inicializar una vez
if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Referencias globales
const auth = firebase.auth();
const database = firebase.database();

console.log('🔥 Firebase inicializado correctamente');
