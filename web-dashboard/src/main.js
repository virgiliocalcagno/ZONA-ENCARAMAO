import './style.css'
import L from 'leaflet'
import 'leaflet-draw'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, push } from 'firebase/database'

// --- Firebase Config ---
const firebaseConfig = {
  projectId: "zona-encaramao",
  appId: "1:963735768136:web:7e2491b3c4f6a3703bdc7d",
  storageBucket: "zona-encaramao.firebasestorage.app",
  apiKey: "AIzaSyD1mmvniE3IhCJtR2F-c1GHCS5Xohdiuqw",
  authDomain: "zona-encaramao.firebaseapp.com",
  messagingSenderId: "963735768136",
  databaseURL: "https://zona-encaramao-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- Configuración del Mapa ---
const ZONA_COLONIAL_CENTER = [18.4730, -69.8860];
const map = L.map('map', {
    center: ZONA_COLONIAL_CENTER,
    zoom: 16,
    zoomControl: false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

// --- Capas de Dibujo ---
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
    edit: { 
        featureGroup: drawnItems,
        poly: { allowIntersection: false }
    },
    draw: {
        polygon: {
            allowIntersection: false,
            showArea: true,
            drawError: { color: '#e1e100', message: '<strong>¡No puedes cruzar líneas!<strong>' },
            shapeOptions: { 
                color: '#f8c214',
                weight: 4,
                opacity: 0.8,
                fillColor: '#f8c214',
                fillOpacity: 0.2
            }
        },
        polyline: { 
            shapeOptions: { 
                color: '#136dec',
                weight: 5
            } 
        },
        rectangle: false,
        circle: false,
        marker: true,
        circlemarker: false
    }
});
// El control de dibujo se añadirá dinámicamente al abrir los modales correspondientes

// Traducción básica de mensajes

L.drawLocal.draw.toolbar.buttons.polygon = 'Dibujar Perímetro (Multi-punto)';
L.drawLocal.draw.handlers.polygon.tooltip.start = 'Haz clic para empezar a dibujar el área.';
L.drawLocal.draw.handlers.polygon.tooltip.cont = 'Sigue haciendo clic para añadir puntos.';
L.drawLocal.draw.handlers.polygon.tooltip.end = 'Haz clic en el primer punto para cerrar el área.';

// Guardar geometrías en Firebase al dibujar
map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;
    const type = e.layerType;
    drawnItems.addLayer(layer);
    
    // Guardar en Firebase nodo 'admin_config'
    const geoData = layer.toGeoJSON();
    push(ref(database, 'admin_config/shapes'), {
        type: type,
        geometry: geoData.geometry,
        timestamp: Date.now()
    });
});

// --- Marcadores de Flota ---
const shuttleIcon = L.divIcon({
    className: 'custom-shuttle-icon',
    html: `<div style="background: #136dec; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 15px #136dec;"></div>`,
    iconSize: [18, 18]
});

const shuttleMarker = L.marker(ZONA_COLONIAL_CENTER, { icon: shuttleIcon }).addTo(map);
shuttleMarker.bindPopup("<b>Trencito ZONA ENCARAMAO</b><br>Estado: En Vivo");

// --- Sincronización Real-Time ---
// Escuchar ubicación del transporte
onValue(ref(database, 'transporte/trencito_1'), (snapshot) => {
    const data = snapshot.val();
    if (data && data.lat && data.lng) {
        shuttleMarker.setLatLng([data.lat, data.lng]);
    }
});

// Escuchar solicitudes de recogida
const requestsList = document.getElementById('requests-list');
onValue(ref(database, 'solicitudes'), (snapshot) => {
    const data = snapshot.val();
    requestsList.innerHTML = '';
    if (data) {
        Object.entries(data).forEach(([id, req]) => {
            const item = document.createElement('div');
            item.className = 'request-item';
            item.innerHTML = `
                <div class="request-info">
                    <h4>Usuario ID: ${id.slice(-4)}</h4>
                    <p>Solicitado a las: ${new Date(req.timestamp).toLocaleTimeString()}</p>
                </div>
                <button class="btn-action" onclick="deleteRequest('${id}')">Atender</button>
            `;
            requestsList.appendChild(item);
        });
    } else {
        requestsList.innerHTML = '<p style="padding: 1rem; color: var(--text-dim);">No hay solicitudes pendientes.</p>';
    }
});

window.deleteRequest = (id) => {
    set(ref(database, `solicitudes/${id}`), null);
};

// Cargar dibujos guardados previamente
onValue(ref(database, 'admin_config/shapes'), (snapshot) => {
    drawnItems.clearLayers();
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(item => {
            L.geoJSON(item.geometry, {
                style: { color: item.type === 'polygon' ? '#136dec' : '#f8c214', weight: 3 },
                onEachFeature: (feature, layer) => {
                    drawnItems.addLayer(layer);
                }
            }).addTo(map);
        });
    }
});

// --- Lógica de Navegación de Vistas y Modales ---
const navItems = document.querySelectorAll('.nav-item[data-view]');
const views = document.querySelectorAll('.view-container');
const viewTitle = document.getElementById('view-title');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        
        // Actualizar UI de Navegación
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Cambiar Vistas
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === `${targetView}-view`) {
                view.classList.add('active');
            }
        });
        
        // Actualizar Título del Header
        viewTitle.innerText = targetView === 'monitoring' ? 'Centro de Monitoreo' : 'Configuración del Sistema';
        
        // Forzar actualización de mapa si volvemos a Monitoreo
        if (targetView === 'monitoring') {
            setTimeout(() => map.invalidateSize(), 150);
        }
    });
});

const modalUnits = document.getElementById('modal-units');
const modalPolygons = document.getElementById('modal-polygons');
const modalStops = document.getElementById('modal-stops');
const modalRoutes = document.getElementById('modal-routes');

const btnConfigUnits = document.getElementById('config-units').querySelector('.btn-config');
const btnConfigPolygons = document.getElementById('config-polygons').querySelector('.btn-config');
const btnConfigStops = document.getElementById('config-stops').querySelector('.btn-config');
const btnConfigRoutes = document.getElementById('config-routes').querySelector('.btn-config');

const closeButtons = document.querySelectorAll('.close-modal');

const openModal = (modal) => {
    modal.classList.add('active');
    if (modal === modalPolygons || modal === modalStops || modal === modalRoutes) {
        map.addControl(drawControl);
    }
};

const closeModal = (modal) => {
    modal.classList.remove('active');
    map.removeControl(drawControl);
};

btnConfigUnits.addEventListener('click', () => openModal(modalUnits));
btnConfigPolygons.addEventListener('click', () => openModal(modalPolygons));
btnConfigStops.addEventListener('click', () => openModal(modalStops));
btnConfigRoutes.addEventListener('click', () => openModal(modalRoutes));

closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        closeModal(e.target.closest('.modal-overlay'));
    });
});

// --- CRUD Unidades ---
const formUnit = document.getElementById('form-unit');
const unitsListAdmin = document.getElementById('units-list-admin');

formUnit.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('unit-id').value;
    const driver = document.getElementById('unit-driver').value;
    
    set(ref(database, `admin_config/units/${id}`), {
        id,
        driver,
        status: 'Inactivo',
        timestamp: Date.now()
    }).then(() => {
        formUnit.reset();
        // La lista se actualizará automáticamente por el listener onValue
        alert("Unidad guardada correctamente");
    }).catch(err => {
        console.error("Error al guardar unidad:", err);
        alert("Error al guardar: " + err.message);
    });
});

onValue(ref(database, 'admin_config/units'), (snapshot) => {
    unitsListAdmin.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(unit => {
            const item = document.createElement('div');
            item.className = 'list-item-admin';
            item.innerHTML = `
                <span><b>${unit.id}</b> - ${unit.driver}</span>
                <button class="btn-delete" onclick="deleteUnit('${unit.id}')">Eliminar</button>
            `;
            unitsListAdmin.appendChild(item);
        });
    }
});

window.deleteUnit = (id) => {
    if(confirm("¿Eliminar esta unidad?")) {
        set(ref(database, `admin_config/units/${id}`), null);
    }
};

// --- CRUD Geocercas (Vincular último dibujo) ---
let lastDrawnLayer = null;
map.on(L.Draw.Event.CREATED, (e) => {
    lastDrawnLayer = e.layer;
    const type = e.layerType;
    drawnItems.addLayer(lastDrawnLayer);
    
    // Si estamos en configuración de polígonos, abrimos el modal
    if (document.getElementById('config-view').classList.contains('active')) {
        openModal(modalPolygons);
    }
});

const formPolygon = document.getElementById('form-polygon');
const polygonsListAdmin = document.getElementById('polygons-list-admin');

formPolygon.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lastDrawnLayer) {
        alert("Primero dibuja un área en el mapa");
        return;
    }
    
    const name = document.getElementById('poly-name').value;
    const geoData = lastDrawnLayer.toGeoJSON();
    
    const polyId = push(ref(database, 'admin_config/polygons')).key;
    set(ref(database, `admin_config/polygons/${polyId}`), {
        id: polyId,
        name: name,
        geometry: geoData.geometry,
        timestamp: Date.now()
    }).then(() => {
        formPolygon.reset();
        closeModal(modalPolygons);
        lastDrawnLayer = null;
        alert("Geocerca guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/polygons'), (snapshot) => {
    polygonsListAdmin.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(poly => {
            const item = document.createElement('div');
            item.className = 'list-item-admin';
            item.innerHTML = `
                <span>${poly.name}</span>
                <button class="btn-delete" onclick="deletePolygon('${poly.id}')">Eliminar</button>
            `;
            polygonsListAdmin.appendChild(item);
        });
        
        // También actualizar el mapa con las geocercas guardadas
        drawnItems.clearLayers();
        Object.values(data).forEach(poly => {
            L.geoJSON(poly.geometry, {
                style: { color: '#f8c214', weight: 4, opacity: 0.8, fillColor: '#f8c214', fillOpacity: 0.2 }
            }).bindPopup(`<b>${poly.name}</b>`).addTo(drawnItems);
        });
    }
});

window.deletePolygon = (id) => {
    if(confirm("¿Eliminar esta zona?")) {
        set(ref(database, `admin_config/polygons/${id}`), null);
    }
};

// --- CRUD Paradas ---
const formStop = document.getElementById('form-stop');
const stopsListAdmin = document.getElementById('stops-list-admin');

formStop.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lastDrawnLayer || lastDrawnLayer instanceof L.Polygon || lastDrawnLayer instanceof L.Polyline) {
        alert("Primero coloca un marcador en el mapa");
        return;
    }
    
    const name = document.getElementById('stop-name').value;
    const coords = lastDrawnLayer.getLatLng();
    
    const stopId = push(ref(database, 'admin_config/stops')).key;
    set(ref(database, `admin_config/stops/${stopId}`), {
        id: stopId,
        name: name,
        lat: coords.lat,
        lng: coords.lng,
        timestamp: Date.now()
    }).then(() => {
        formStop.reset();
        closeModal(modalStops);
        lastDrawnLayer = null;
        alert("Parada guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/stops'), (snapshot) => {
    stopsListAdmin.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(stop => {
            const item = document.createElement('div');
            item.className = 'list-item-admin';
            item.innerHTML = `
                <span>${stop.name}</span>
                <button class="btn-delete" onclick="deleteStop('${stop.id}')">Eliminar</button>
            `;
            stopsListAdmin.appendChild(item);
        });
        
        // Mostrar marcadores de paradas en el mapa
        Object.values(data).forEach(stop => {
            L.marker([stop.lat, stop.lng], {
                icon: L.divIcon({
                    className: 'stop-marker-admin',
                    html: `<div style="background: #white; border: 2px solid #136dec; width: 10px; height: 10px; border-radius: 50%;"></div>`
                })
            }).bindPopup(`<b>Parada: ${stop.name}</b>`).addTo(drawnItems);
        });
    }
});

window.deleteStop = (id) => {
    if(confirm("¿Eliminar esta parada?")) {
        set(ref(database, `admin_config/stops/${id}`), null);
    }
};

// --- CRUD Rutas ---
const formRoute = document.getElementById('form-route');
const routesListAdmin = document.getElementById('routes-list-admin');

formRoute.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lastDrawnLayer || !(lastDrawnLayer instanceof L.Polyline)) {
        alert("Primero dibuja una línea en el mapa");
        return;
    }
    
    const name = document.getElementById('route-name').value;
    const geoData = lastDrawnLayer.toGeoJSON();
    
    const routeId = push(ref(database, 'admin_config/routes')).key;
    set(ref(database, `admin_config/routes/${routeId}`), {
        id: routeId,
        name: name,
        geometry: geoData.geometry,
        timestamp: Date.now()
    }).then(() => {
        formRoute.reset();
        closeModal(modalRoutes);
        lastDrawnLayer = null;
        alert("Ruta guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/routes'), (snapshot) => {
    routesListAdmin.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(route => {
            const item = document.createElement('div');
            item.className = 'list-item-admin';
            item.innerHTML = `
                <span>${route.name}</span>
                <button class="btn-delete" onclick="deleteRoute('${route.id}')">Eliminar</button>
            `;
            routesListAdmin.appendChild(item);
        });
        
        // Mostrar líneas de rutas en el mapa
        Object.values(data).forEach(route => {
            L.geoJSON(route.geometry, {
                style: { color: '#136dec', weight: 5, opacity: 0.6 }
            }).bindPopup(`<b>Ruta: ${route.name}</b>`).addTo(drawnItems);
        });
    }
});

window.deleteRoute = (id) => {
    if(confirm("¿Eliminar esta ruta?")) {
        set(ref(database, `admin_config/routes/${id}`), null);
    }
};

console.log("🛡️ ZONA ENCARAMAO: Centro de Control Experto Iniciado");
