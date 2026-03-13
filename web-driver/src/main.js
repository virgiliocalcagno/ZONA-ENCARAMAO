import './style.css'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, child, get, update } from 'firebase/database'

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
let map, heat, driverMarker;
const requestsRef = ref(database, 'stop_requests');
let currentRequests = [];

// Estado del Driver (AJUSTADO CERCA DEL PUNTO DE CALOR PARA PRUEBAS)
const driverState = {
    lat: 18.4731, 
    lng: -69.8858,
    currentAlertId: null
};

// --- Utils Distancia (Haversine) ---
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // en metros
}

// --- Init Mapa ---
function initMap() {
    map = L.map('driver-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([driverState.lat, driverState.lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Marcador del Conductor
    const driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class='size-10 bg-primary rounded-full border-4 border-white shadow-xl flex items-center justify-center'><span class='material-symbols-outlined text-white text-xl'>directions_bus</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    driverMarker = L.marker([driverState.lat, driverState.lng], {icon: driverIcon, zIndexOffset: 1000}).addTo(map);

    // Inicializar Heatmap (vacío)
    heat = L.heatLayer([], {radius: 35, blur: 25, maxZoom: 17, gradient: {0.4: 'blue', 0.6: 'cyan', 0.8: 'lime', 1: 'yellow'}}).addTo(map);
}

// --- Pasajeros ---
window.updatePax = (v) => {
    pax = Math.max(0, Math.min(35, pax + v));
    document.getElementById('pax-count').innerText = pax;
    set(child(transporteRef, 'pasajeros'), pax);
}

// --- Alertas Visuales ---
const ALARM_SOUND = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

function showProximityAlert(request) {
    if (driverState.currentAlertId === request.id) return;
    driverState.currentAlertId = request.id;
    
    ALARM_SOUND.play().catch(e => console.log('Autoplay audio blocked'));

    const card = document.getElementById('alert-card');
    card.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
    card.classList.add('opacity-100', 'translate-y-0');
    
    document.getElementById('alert-ping').classList.remove('hidden');
    document.getElementById('alert-actions').classList.remove('hidden');
    document.getElementById('alert-icon').classList.add('animate-bounce'); // Añadida animación de brinco al muñequito
    document.getElementById('alert-title').innerText = "¡Pasajero Cercano!";
    document.getElementById('alert-desc').innerText = `A ${Math.round(request.distance)} metros de tu posición`;
}

function showRequestAlert(request) {
    if (driverState.currentAlertId === request.id) return;
    driverState.currentAlertId = request.id;
    
    ALARM_SOUND.play().catch(e => console.log('Autoplay audio blocked'));

    const card = document.getElementById('request-alert-card');
    card.classList.remove('opacity-0', '-translate-y-10', 'pointer-events-none');
    card.classList.add('opacity-100', 'translate-y-0');
    
    const icon = document.getElementById('request-alert-icon');
    if(icon) icon.classList.add('animate-bounce');
}

function hideAlert() {
    const card = document.getElementById('alert-card');
    card.classList.remove('opacity-100', 'translate-y-0');
    card.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
    
    document.getElementById('alert-ping').classList.add('hidden');
    document.getElementById('alert-actions').classList.add('hidden');
    document.getElementById('alert-icon').classList.remove('animate-bounce');
    driverState.currentAlertId = null;
}

function hideRequestAlert() {
    const card = document.getElementById('request-alert-card');
    card.classList.remove('opacity-100', 'translate-y-0');
    card.classList.add('opacity-0', '-translate-y-10', 'pointer-events-none');
    
    const icon = document.getElementById('request-alert-icon');
    if(icon) icon.classList.remove('animate-bounce');
    
    driverState.currentAlertId = null;
}

// Acciones globales expuestas a la ventana
window.acceptAlert = () => {
    if (driverState.currentAlertId) {
        update(ref(database, `stop_requests/${driverState.currentAlertId}`), { status: 'picked_up' });
        window.updatePax(1);
        hideAlert();
    }
};

window.dismissAlert = () => {
    hideAlert();
};

window.acceptRequest = () => {
    if (driverState.currentAlertId) {
        update(ref(database, `stop_requests/${driverState.currentAlertId}`), { status: 'picked_up' });
        window.updatePax(1);
        hideRequestAlert();
    }
};

window.dismissRequest = () => {
    hideRequestAlert();
};

window.simulateAlert = () => {
    showProximityAlert({id: 'sim_1', distance: 15});
}

window.simulateArrival = () => {
    const banner = document.getElementById('alert-card');
    const title = document.getElementById('alert-title');
    const desc = document.getElementById('alert-desc');
    const icon = document.getElementById('alert-icon');
    
    // Paso 1: Notificación de aproximación
    title.innerText = "Llegando a parada...";
    desc.innerText = "Estimado: 5 segundos";
    icon.innerText = "schedule";
    banner.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
    banner.classList.add('opacity-100', 'translate-y-0');

    let countdown = 5;
    const interval = setInterval(() => {
        countdown--;
        desc.innerText = `Estimado: ${countdown} segundos`;
        if (countdown <= 0) {
            clearInterval(interval);
            // Paso 2: Llegada real
            ALARM_SOUND.play();
            title.innerText = "¡HEMOS LLEGADO!";
            desc.innerText = "Parada: Calle El Conde";
            icon.innerText = "location_on";
            icon.classList.add('animate-bounce');
            
            // Mostrar botones de acción tras llegar
            document.getElementById('alert-actions').classList.remove('hidden');
            
            // Simular cierre automático en 10 seg si no hay acción
            setTimeout(() => {
                if(banner.classList.contains('opacity-100')) hideAlert();
            }, 10000);
        }
    }, 1000);
}

// --- Tracking Conductor ---
function startTracking() {
    // Simulamos actualización constante para disparar lógica de proximidad
    setInterval(() => {
        // En PC usamos coordenadas fijas si el GPS no se mueve o no está disponible
        // (Esto asegura que la lógica de proximidad SIEMPRE se ejecute)
        update(transporteRef, {
            lat: driverState.lat,
            lng: driverState.lng,
            last_update: Date.now()
        });
        checkProximity();
    }, 2000);

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition((position) => {
            const { latitude, longitude } = position.coords;
            // Solo actualizamos si realmente estamos en un dispositivo móvil con GPS
            // En PC, estas coordenadas suelen ser erráticas
            // driverState.lat = latitude;
            // driverState.lng = longitude;
            
            if(driverMarker) driverMarker.setLatLng([driverState.lat, driverState.lng]);
            if(map) map.setView([driverState.lat, driverState.lng], 17);
        });
    }
}

function checkProximity() {
    let closestRequest = null;
    let minDistance = 150; // Alerta si está a menos de 150 metros

    currentRequests.forEach(req => {
        const dist = getDistance(driverState.lat, driverState.lng, req.lat, req.lng);
        req.distance = dist;
        if (dist < minDistance) {
            minDistance = dist;
            closestRequest = req;
        }
    });

    if (closestRequest) {
        showProximityAlert(closestRequest);
    } else {
        // Automatically hide alert if driver moves away or if all requests are resolved
        if (driverState.currentAlertId && currentRequests.length === 0) {
            hideAlert();
        }
    }
}

// --- Escuchar Mapa de Demanda ---
onValue(requestsRef, (snapshot) => {
    const data = snapshot.val();
    const heatmapPoints = [];
    currentRequests = [];

    if (data) {
        Object.keys(data).forEach(key => {
            const req = data[key];
            const dist = getDistance(driverState.lat, driverState.lng, req.lat, req.lng);
            
            // Caso 1: Solicitud Pendiente (Calor Fuerte)
            if (req.status === 'pending' && req.lat && req.lng) {
                heatmapPoints.push([req.lat, req.lng, 1.5]);
                currentRequests.push({id: key, ...req});
            } 
            // Caso 2: Aceptada pero el tren NO ha pasado aún (Calor Suave)
            else if (req.status === 'picked_up' && req.lat && req.lng && dist > 30) {
                heatmapPoints.push([req.lat, req.lng, 0.7]);
            }
        });
    }

    if(heat) heat.setLatLngs(heatmapPoints);
    
    // Si no hay solicitudes pendientes, reseteamos la alerta
    if (heatmapPoints.length === 0) {
        hideAlert();
        hideRequestAlert();
    } else {
        // Disparar alerta amarilla si hay ALGUNA solicitud pendiente
        // (Tomamos la más reciente para la notificación visual)
        const latestRequest = currentRequests[currentRequests.length - 1];
        if (latestRequest && latestRequest.status === 'pending') {
            showRequestAlert(latestRequest);
        }
        
        // Ejecutamos proximidad para disparar la alerta azul si el chofer está cerca
        checkProximity();
    }
});

// --- Próxima Parada ---
let activeStops = [];
let lastAnnouncedStop = null;

onValue(ref(database, 'admin_config/stops'), (snapshot) => {
    const data = snapshot.val();
    activeStops = data ? Object.values(data) : [];
});

function announceStop(stopName) {
    if (lastAnnouncedStop === stopName) return;
    lastAnnouncedStop = stopName;

    const utterance = new SpeechSynthesisUtterance(`Próxima parada, ${stopName}`);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
}

function updateNextStop() {
    if (activeStops.length === 0) {
        document.getElementById('next-stop-container').classList.add('hidden');
        return;
    }

    // Buscar parada más cercana por delante (simplificado: la más cercana física)
    let closestStop = null;
    let minDistance = 150; // Solo mostrar si está a menos de 150m

    activeStops.forEach(stop => {
        const dist = getDistance(driverState.lat, driverState.lng, stop.lat, stop.lng);
        if (dist < minDistance) {
            minDistance = dist;
            closestStop = stop;
        }
    });

    const container = document.getElementById('next-stop-container');
    const nameEl = document.getElementById('next-stop-name');

    if (closestStop) {
        container.classList.remove('hidden');
        container.classList.add('flex');
        nameEl.innerText = closestStop.name;
        
        // Anunciar por voz si está muy cerca (ej. 30 metros)
        if (minDistance < 40) {
            announceStop(closestStop.name);
        }
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
}

// Reloj y Lógica de Paradas
setInterval(() => {
    const timeEl = document.getElementById('time');
    if (timeEl) {
        const now = new Date();
        timeEl.innerText = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    }
    updateNextStop();
}, 1000);

// Inicializar
window.onload = () => {
    initMap();
    startTracking();
    get(child(transporteRef, 'pasajeros')).then((snapshot) => {
        if (snapshot.exists()) {
            pax = snapshot.val();
            document.getElementById('pax-count').innerText = pax;
        }
    });
};

console.log("✅ Ecosistema Conductor ZONA ENCARAMAO Inicializado");
