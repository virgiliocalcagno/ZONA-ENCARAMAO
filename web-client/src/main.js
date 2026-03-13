import './style.css'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, push, set, serverTimestamp } from 'firebase/database'

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

// --- Estado Global App Usuario ---
let moveMap;
let markers = {}; 
let userMarker; 
let offersData = []; // Se cargará desde Firebase

const shuttleIcon = (label) => L.divIcon({
    className: 'custom-train-icon',
    html: `
        <div class="flex flex-col items-center">
            <div class="flex items-center justify-center size-10 bg-white dark:bg-slate-900 rounded-full shadow-lg border-2 border-primary">
                <span class="material-symbols-outlined text-primary text-xl">directions_bus</span>
            </div>
            <div class="mt-1 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full text-center whitespace-nowrap shadow-md uppercase tracking-tighter">${label}</div>
        </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 50]
});

function initUserMap() {
    moveMap = L.map('user-map', {
        center: [18.4735, -69.8855],
        zoom: 17,
        zoomControl: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(moveMap);
}

// Estado Global App Usuario
const userState = {
    ticketValid: false,
    lat: null,
    lng: null,
    inZone: false
};

// Polígono simplificado de la Zona Colonial (Referencia aproximada)
const ZONA_COLONIAL_BOUNDS = {
    north: 18.4770,
    south: 18.4680,
    east: -69.8800,
    west: -69.8900
};

function checkGeofence(lat, lng) {
    return (lat <= ZONA_COLONIAL_BOUNDS.north && lat >= ZONA_COLONIAL_BOUNDS.south &&
            lng <= ZONA_COLONIAL_BOUNDS.east && lng >= ZONA_COLONIAL_BOUNDS.west);
}

// --- Gestión de Pantallas ---
window.changeScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        // RESTRICCIÓN: Leaflet necesita recalcular tamaño al hacerse visible
        if (id === 'screen-map' && moveMap) {
            setTimeout(() => {
                moveMap.invalidateSize();
            }, 100);
        }
    }
}

// --- Validación de Ticket ---
window.validateTicket = () => {
    const input = document.getElementById('ticket-input');
    if (input.value.trim().length > 4) {
        userState.ticketValid = true;
        // Iniciar Geofencing al validar
        startGeofencing();
        window.changeScreen('screen-map');
    } else {
        alert("Por favor, ingrese un número de ticket válido.");
    }
}

// --- Geofencing & Localización ---
function startGeofencing() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition((position) => {
            userState.lat = position.coords.latitude;
            userState.lng = position.coords.longitude;
            
            userState.inZone = checkGeofence(userState.lat, userState.lng);
            
            const btn = document.getElementById('btn-request-stop');
            const warning = document.getElementById('geofencing-warning');
            
            if (userState.inZone) {
                // Habilitar botón porque está en la zona
                btn.removeAttribute('disabled');
                btn.className = "w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 active:scale-[0.98] flex items-center justify-center gap-2 transition-all";
                warning.innerHTML = `<span class="material-symbols-outlined text-[12px] align-middle">location_on</span> Zona Colonial Confirmada`;
                warning.className = "text-center text-[11px] text-green-500 font-bold mt-2";
            } else {
                // Deshabilitar botón
                btn.setAttribute('disabled', 'true');
                btn.className = "w-full bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed transition-all";
                warning.innerHTML = `<span class="material-symbols-outlined text-[12px] align-middle">error</span> Debe estar dentro de la zona para solicitar`;
                warning.className = "text-center text-[11px] text-orange-500 font-bold mt-2";
            }
        }, (error) => {
            console.error("Error obteniendo ubicación:", error);
            const warning = document.getElementById('geofencing-warning');
            warning.innerHTML = `<span class="material-symbols-outlined text-[12px] align-middle">gps_off</span> Activa tu GPS para usar el servicio`;
            warning.className = "text-center text-[11px] text-red-500 font-bold mt-2";
        }, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        });
    } else {
        console.error("Geolocalización no soportada");
    }
}

// --- Solicitud de Parada ---
window.requestPickup = () => {
    // Coordenadas finales: GPS real o simulación
    const finalLat = userState.lat || 18.4735;
    const finalLng = userState.lng || -69.8855;

    console.log("Solicitando parada en:", finalLat, finalLng);
    
    const newRequestRef = push(ref(database, 'stop_requests'));
    const requestId = newRequestRef.key;
    userState.currentRequestId = requestId;

    set(ref(database, `stop_requests/${requestId}`), {
        id: requestId,
        userId: "user_" + Math.random().toString(36).substr(2, 9),
        lat: finalLat,
        lng: finalLng,
        timestamp: serverTimestamp(),
        status: 'pending'
    }).then(() => {
        // Mostrar panel de estado y ocultar grupo de acción
        document.getElementById('request-action-group').classList.add('hidden');
        document.getElementById('request-status-panel').classList.remove('hidden');
        document.getElementById('request-status-panel').classList.add('flex');
        
        // Escuchar cambios en la solicitud
        onValue(ref(database, `stop_requests/${requestId}`), (snapshot) => {
            const reqData = snapshot.val();
            if (!reqData) {
                window.resetRequestUI();
                return;
            };

            const icon = document.getElementById('pax-status-icon');
            const title = document.getElementById('pax-status-title');
            const desc = document.getElementById('pax-status-desc');

            if (reqData.status === 'picked_up') {
                icon.innerText = "verified";
                title.innerText = "¡Conductor en camino!";
                desc.innerText = "Tu transporte ha confirmado la recogida.";
                
                // Efecto visual de éxito
                const etaLabel = document.getElementById('eta');
                if(etaLabel) {
                    etaLabel.innerText = "¡YA!";
                    etaLabel.className = "text-primary animate-bounce inline-block";
                }
            } else if (reqData.status === 'pending') {
                icon.innerText = "hail";
                title.innerText = "Solicitud Enviada";
                desc.innerText = "Buscando al conductor más cercano...";
            }
        });
    });
}

window.cancelRequest = () => {
    if (userState.currentRequestId) {
        set(ref(database, `stop_requests/${userState.currentRequestId}`), null);
        window.resetRequestUI();
    }
}

window.resetRequestUI = () => {
    userState.currentRequestId = null;
    document.getElementById('request-action-group').classList.remove('hidden');
    document.getElementById('request-status-panel').classList.add('hidden');
    document.getElementById('request-status-panel').classList.remove('flex');
    
    // Resetear textos y estilos
    const icon = document.getElementById('pax-status-icon');
    const title = document.getElementById('pax-status-title');
    const desc = document.getElementById('pax-status-desc');
    const etaLabel = document.getElementById('eta');

    if(icon) icon.innerText = "hail";
    if(title) title.innerText = "Sincronizando...";
    if(desc) desc.innerText = "Conectando con el conductor...";
    if(etaLabel) {
        etaLabel.innerText = "4 min";
        etaLabel.className = "text-primary";
    }
}

// --- Lógica de Pasaporte Colonial ---
function renderOffers() {
    const carousel = document.getElementById('offers-carousel');
    if (!carousel) return;

    if (offersData.length === 0) {
        carousel.innerHTML = '<p class="text-[10px] text-slate-400 p-4 w-full text-center">No hay ofertas disponibles en este momento.</p>';
        return;
    }

    carousel.innerHTML = offersData.map(offer => `
        <div onclick="window.showOfferDetail('${offer.id}')" class="snap-center shrink-0 w-full flex items-center gap-3 p-3 pt-8 pb-3 cursor-pointer active:scale-95 transition-transform">
           <div class="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm">
                <span class="material-symbols-outlined">${offer.icon || 'storefront'}</span>
           </div>
           <div class="pr-6 text-left">
               <p class="text-xs font-bold text-slate-900 dark:text-white leading-tight">${offer.title}</p>
               <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">${offer.shortDesc}</p>
           </div>
        </div>
    `).join('');
}

window.showOfferDetail = (offerId) => {
    const offer = offersData.find(o => o.id === offerId);
    if (!offer) return;

    const modal = document.getElementById('offer-modal');
    document.getElementById('modal-offer-icon').innerText = offer.icon || 'storefront';
    document.getElementById('modal-offer-icon-box').className = `size-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm bg-primary/10 text-primary`;
    document.getElementById('modal-offer-title').innerText = offer.title;
    document.getElementById('modal-offer-desc').innerText = offer.desc;
    document.getElementById('modal-offer-code').innerText = offer.validationCode;
    document.getElementById('modal-offer-date').innerText = `EXP: ${offer.validUntil}`;
    
    // Generar QR dinámico (Usa API externa gratuita)
    document.getElementById('modal-qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${offer.validationCode}`;
    
    // Social Links (Opcionales ahora que vienen de Firebase)
    const igLink = document.getElementById('modal-social-ig');
    const waLink = document.getElementById('modal-social-wa');
    
    if (offer.social) {
        if(offer.social.instagram) {
            igLink.href = offer.social.instagram;
            igLink.style.display = 'block';
        } else igLink.style.display = 'none';
        
        if(offer.social.whatsapp && offer.social.whatsapp !== '#') {
            waLink.href = offer.social.whatsapp;
            waLink.style.display = 'block';
        } else waLink.style.display = 'none';
    } else {
        igLink.style.display = 'none';
        waLink.style.display = 'none';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeOfferModal = () => {
    const modal = document.getElementById('offer-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// --- Sincronización Real-Time ---
// Escuchar ofertas comerciales
onValue(ref(database, 'commercial_offers'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        offersData = Object.values(data);
        renderOffers();
    }
});

// --- Seguimiento de Flota Completa ---
onValue(ref(database, 'transporte'), (snapshot) => {
    const data = snapshot.val();
    if (data && moveMap) {
        Object.keys(data).forEach(id => {
            const vehicle = data[id];
            if (vehicle.lat && vehicle.lng) {
                if (markers[id]) {
                    markers[id].setLatLng([vehicle.lat, vehicle.lng]);
                } else {
                    markers[id] = L.marker([vehicle.lat, vehicle.lng], {
                        icon: shuttleIcon(id === 'trencito_1' ? '#402' : id)
                    }).addTo(moveMap);
                }
            }
        });
    }
});

// Inicializar al cargar ventana
window.onload = () => {
    initUserMap();
    renderOffers(); // Inicializar ofertas
};

console.log("✅ Ecosistema de Usuario ZONA ENCARAMAO Inicializado");
