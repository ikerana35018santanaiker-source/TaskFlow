// js/firebase-config.js
// Configuración estricta de ShareIt para Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDKurDI4iIcV_6LnzLkML0E3hM9hqWaMZg",
  authDomain: "shareit-c1222.firebaseapp.com",
  databaseURL: "https://shareit-c1222-default-rtdb.firebaseio.com",
  projectId: "shareit-c1222",
  storageBucket: "shareit-c1222.firebasestorage.app",
  messagingSenderId: "466346058481",
  appId: "1:466346058481:web:733bcea3730cac9d9a3f50"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a servicios que usaremos
const auth = firebase.auth();
const database = firebase.database();
