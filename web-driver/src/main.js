import './style.css'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, child, get } from 'firebase/database'

const firebaseConfig = {
    projectId: "zona-encaramao",
    appId: "1:963735768136:web:ce0a0f519b4f54ed3bdc7d",
    storageBucket: "zona-encaramao.firebasestorage.app",
    apiKey: "AIzaSyD1mmvniE3IhCJtR2F-c1GHCS5Xohdiuqw",
    authDomain: "zona-encaramao.firebaseapp.com",
    messagingSenderId: "963735768136",
    databaseURL: "https://zona-encaramao-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const transporteRef = ref(database, 'transporte/trencito_1');

let pax = 12;

window.updatePax = (v) => {
    pax = Math.max(0, Math.min(35, pax + v));
    document.getElementById('pax-count').innerText = pax;
    set(child(transporteRef, 'pasajeros'), pax);
}

window.simulateAlert = () => {
    renderAlert("CALLE EL CONDE");
}

function renderAlert(location) {
    const card = document.getElementById('alert-card');
    if (!card) return;
    card.style.opacity = '1';
    card.innerHTML = `
        <span class="material-symbols-outlined text-primary text-8xl mb-4 animate-bounce">hail</span>
        <h2 class="text-primary text-3xl font-black uppercase tracking-widest mb-2">Solicitud de Parada</h2>
        <div class="bg-primary text-white text-5xl font-black py-6 px-10 rounded-xl shadow-2xl my-4">${location}</div>
        <button onclick="location.reload()" class="mt-8 bg-white text-background-dark py-4 px-8 rounded-xl text-xl font-black uppercase">Atendido</button>
    `;
}

// --- Listeners ---

// Escuchar solicitudes
onValue(ref(database, 'solicitudes'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        renderAlert("ZONA COLONIAL");
    }
});

// Reloj
setInterval(() => {
    const timeEl = document.getElementById('time');
    if (timeEl) {
        const now = new Date();
        timeEl.innerText = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    }
}, 1000);

// Cargar estado inicial
get(child(transporteRef, 'pasajeros')).then((snapshot) => {
    if (snapshot.exists()) {
        pax = snapshot.val();
        const paxCountEl = document.getElementById('pax-count');
        if (paxCountEl) paxCountEl.innerText = pax;
    }
});

console.log("✅ App Conductor ZONA ENCARAMAO Inicializada");
