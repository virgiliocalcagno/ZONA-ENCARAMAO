import './style.css'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, push, serverTimestamp } from 'firebase/database'

const firebaseConfig = {
    projectId: "zona-encaramao",
    appId: "1:963735768136:web:503ce6d41b5a2d883bdc7d",
    storageBucket: "zona-encaramao.firebasestorage.app",
    apiKey: "AIzaSyD1mmvniE3IhCJtR2F-c1GHCS5Xohdiuqw",
    authDomain: "zona-encaramao.firebaseapp.com",
    messagingSenderId: "963735768136",
    databaseURL: "https://zona-encaramao-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- Gestión de Pantallas ---
window.changeScreen = (id) => {
    console.log("Cambiando a pantalla:", id);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    }
}

// --- Solicitud de Parada ---
window.requestPickup = () => {
    console.log("Solicitando parada...");
    push(ref(database, 'solicitudes'), {
        timestamp: serverTimestamp(),
        status: 'pending'
    }).then(() => {
        alert("🚀 ¡Solicitud enviada! El conductor ha sido notificado.");
    }).catch(err => {
        console.error("Error al enviar solicitud:", err);
        alert("Hubo un problema al enviar la solicitud. Por favor intenta de nuevo.");
    });
}

// --- Sincronización Real-Time ---
const trainIcon = document.querySelector('.material-symbols-outlined.text-primary.text-xl');
const trencitoDiv = trainIcon ? trainIcon.parentElement.parentElement : null;

onValue(ref(database, 'transporte/trencito_1'), (snapshot) => {
    const data = snapshot.val();
    if (data && data.lat && data.lng && trencitoDiv) {
        // Simulación visual básica por ahora
        const offsetX = (data.lng + 69.8860) * 10000; 
        const offsetY = (data.lat - 18.4730) * 10000;
        trencitoDiv.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
});

console.log("✅ App Cliente ZONA ENCARAMAO Inicializada");
