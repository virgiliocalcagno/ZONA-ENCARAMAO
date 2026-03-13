import './style.css'
import L from 'leaflet'
import 'leaflet-draw'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, push, get } from 'firebase/database'

// --- Asegurar L global para plugins externos ---
window.L = L;

console.log("🛡️ ZONA ENCARAMAO: Cargando configuración...");
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
const mapContainer = document.getElementById('map');
const leafletMap = L.map(mapContainer, {
    center: ZONA_COLONIAL_CENTER,
    zoom: 16,
    zoomControl: false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(leafletMap);

L.control.zoom({ position: 'topright' }).addTo(leafletMap);

// Capas permanentes (Definidas antes de los listeners)
const polygonsLayer = new L.FeatureGroup().addTo(leafletMap);
const stopsLayer = new L.FeatureGroup().addTo(leafletMap);
const routesLayer = new L.FeatureGroup().addTo(leafletMap);
let heatmapLayer; // Se inicializará tras cargar el plugin

// Variable para el control de visibilidad del heatmap
let showHeatmap = true;

// --- Carga dinámica del plugin Heatmap ---
const scriptHeat = document.createElement('script');
scriptHeat.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
scriptHeat.onload = () => {
    heatmapLayer = L.heatLayer([], { radius: 25, blur: 15, max: 1.0 }).addTo(leafletMap);
    console.log("🔥 Heatmap Plugin cargado correctamente");
};
document.head.appendChild(scriptHeat);

// --- Capas de Dibujo ---
const drawnItems = new L.FeatureGroup();
leafletMap.addLayer(drawnItems);

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

// (Listener obsoleto de autoguardado de shapes removido)

// --- Marcadores de Flota ---
const shuttleIcon = L.divIcon({
    className: 'custom-shuttle-icon',
    html: `<div style="background: #136dec; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 15px #136dec;"></div>`,
    iconSize: [18, 18]
});

const shuttleMarker = L.marker(ZONA_COLONIAL_CENTER, { icon: shuttleIcon }).addTo(leafletMap);
shuttleMarker.bindPopup("<b>Trencito ZONA ENCARAMAO</b><br>Estado: En Vivo");

// --- Sincronización Real-Time ---
// Escuchar ubicación del transporte
onValue(ref(database, 'transporte/trencito_1'), (snapshot) => {
    const data = snapshot.val();
    if (data && data.lat && data.lng) {
        shuttleMarker.setLatLng([data.lat, data.lng]);
    }
});

// Escuchar solicitudes de recogida (stop_requests)
const requestsList = document.getElementById('requests-list');
const statWait = document.getElementById('stat-wait');

onValue(ref(database, 'stop_requests'), (snapshot) => {
    const data = snapshot.val();
    requestsList.innerHTML = '';
    
    // Preparar puntos para el heatmap
    const heatPoints = [];

    if (data) {
        let pendingCount = 0;
        let totalWaitTime = 0;
        let totalRequestsFinished = 0;

        const now = Date.now();

        Object.entries(data).sort((a,b) => b[1].timestamp - a[1].timestamp).forEach(([id, req]) => {
            // Heatmap: solo puntos pendientes o muy recientes (1 para máxima intensidad)
            if (req.status === 'pending' && req.lat && req.lng) {
                heatPoints.push([req.lat, req.lng, 1.0]);
            } else if (req.status === 'picked_up' && req.lat && req.lng) {
                heatPoints.push([req.lat, req.lng, 0.4]); // Intensidad baja para completados recientes
            }

            // Stats para el promedio
            if (req.status === 'picked_up' && req.timestamp) {
                const waitTime = now - req.timestamp;
                totalWaitTime += waitTime;
                totalRequestsFinished++;
            }

            const isPending = req.status === 'pending';
            if (isPending) pendingCount++;

            // Mostrar solo los últimos 15 en la lista visual
            const item = document.createElement('div');
            item.className = `request-item ${!isPending ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="request-info">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="status-badge-small ${req.status}">${req.status.toUpperCase()}</span>
                        <h4>ID: ${id.slice(-4)}</h4>
                    </div>
                    <p>${new Date(req.timestamp).toLocaleTimeString()}</p>
                </div>
                ${isPending ? `<button class="btn-action" onclick="deleteRequest('${id}')">Descartar</button>` : ''}
            `;
            if (requestsList.children.length < 15) requestsList.appendChild(item);
        });

        // Actualizar Heatmap (Solo si ya cargó el plugin)
        if (heatmapLayer) {
            heatmapLayer.setLatLngs(heatPoints);
        }

        if (requestsList.innerHTML === '') {
            requestsList.innerHTML = '<p style="padding: 1rem; color: var(--text-dim);">No hay actividad reciente.</p>';
        }

        // Actualizar UI del promedio de espera
        if (totalRequestsFinished > 0) {
            const avgMs = totalWaitTime / totalRequestsFinished;
            const avgMins = Math.floor(avgMs / 60000);
            const avgSecs = Math.floor((avgMs % 60000) / 1000);
            if (statWait) statWait.innerText = `${avgMins.toString().padStart(2, '0')}:${avgSecs.toString().padStart(2, '0')} min`;
        } else {
            if (statWait) statWait.innerText = `00:00 min`;
        }

    } else {
        requestsList.innerHTML = '<p style="padding: 1rem; color: var(--text-dim);">No hay solicitudes pendientes.</p>';
        if (statWait) statWait.innerText = `00:00 min`;
        if (heatmapLayer) heatmapLayer.setLatLngs([]);
    }
});

window.deleteRequest = (id) => {
    set(ref(database, `stop_requests/${id}`), null);
};

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
        let title = 'Configuración del Sistema';
        if (targetView === 'monitoring') title = 'Centro de Monitoreo';
        if (targetView === 'commercial') title = 'Zona Comercial';
        viewTitle.innerText = title;
        
        // Forzar actualización de mapa si volvemos a Monitoreo
        if (targetView === 'monitoring') {
            setTimeout(() => leafletMap.invalidateSize(), 150);
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
};

const closeModal = (modal) => {
    modal.classList.remove('active');
};

// --- Panel de Alertas ---
const modalAlerts = document.getElementById('modal-alerts');
const btnConfigAlerts = document.getElementById('config-alerts').querySelector('.btn-config');
btnConfigAlerts.addEventListener('click', () => openModal(modalAlerts));

const formAlerts = document.getElementById('form-alerts');
const alertSpeed = document.getElementById('alert-speed');
const alertDeviation = document.getElementById('alert-deviation');

formAlerts.addEventListener('submit', (e) => {
    e.preventDefault();
    set(ref(database, 'admin_config/alerts'), {
        speed_limit: parseInt(alertSpeed.value),
        deviation_meters: parseInt(alertDeviation.value),
        timestamp: Date.now()
    }).then(() => {
        closeModal(modalAlerts);
        alert("Alertas globales actualizadas");
    });
});

onValue(ref(database, 'admin_config/alerts'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if(data.speed_limit) alertSpeed.value = data.speed_limit;
        if(data.deviation_meters) alertDeviation.value = data.deviation_meters;
    }
});

// --- Flujo Experto de Dibujo ---
const drawingModePanel = document.getElementById('drawing-mode-panel');
const drawingInstructions = document.getElementById('drawing-instructions');
let currentDrawingModal = null;
let currentDrawHandler = null;
let lastDrawnLayer = null;

// Configuración visual experta para el dibujo
const drawOptions = {
    polygon: {
        allowIntersection: false,
        showArea: true,
        metric: true,
        repeatMode: true, // Permite dibujar varios en puntos si se desea (aunque lo limitaremos)
        shapeOptions: {
            color: '#f8c214',
            weight: 4,
            opacity: 0.9,
            fillColor: '#f8c214',
            fillOpacity: 0.3
        },
        icon: new L.DivIcon({
            iconSize: new L.Point(12, 12),
            className: 'leaflet-div-icon leaflet-editing-icon'
        }),
        touchIcon: new L.DivIcon({
            iconSize: new L.Point(20, 20),
            className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
        })
    },
    marker: {
        icon: L.divIcon({
            className: 'stop-marker-admin',
            html: `<div style="background: white; border: 3px solid #136dec; width: 14px; height: 14px; border-radius: 50%;"></div>`
        })
    },
    polyline: {
        shapeOptions: {
            color: '#136dec',
            weight: 5,
            opacity: 0.9
        }
    }
};

const startDrawingMode = (modal, drawType, instructions) => {
    console.log(`🎨 Iniciando modo dibujo: ${drawType}`);
    closeModal(modal);
    currentDrawingModal = modal;
    
    // Desactivar heatmap temporalmente para que no robe clics
    if (heatmapLayer) {
        leafletMap.removeLayer(heatmapLayer);
        console.log("🔥 Heatmap desactivado para dibujo");
    }
    
    // Cambiar vista a monitoreo para ver el mapa
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="monitoring"]').classList.add('active');
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.getElementById('monitoring-view').classList.add('active');
    
    // Limpiar cualquier dibujo previo no guardado
    drawnItems.clearLayers();
    lastDrawnLayer = null;

    // Forzar redibujado de Leaflet al cambiar de pestaña y luego iniciar dibujo
    setTimeout(() => {
        leafletMap.invalidateSize();
        console.log("📍 Mapa redimensionado, activando herramienta...");
        
        try {
            // Instanciar el handler manualmente
            if (drawType === 'polygon') currentDrawHandler = new L.Draw.Polygon(leafletMap, drawOptions.polygon);
            else if (drawType === 'marker') currentDrawHandler = new L.Draw.Marker(leafletMap, drawOptions.marker);
            else if (drawType === 'polyline') currentDrawHandler = new L.Draw.Polyline(leafletMap, drawOptions.polyline);
            
            if (currentDrawHandler) {
                currentDrawHandler.enable();
                console.log("✅ Handler de dibujo habilitado");
            } else {
                console.error("❌ No se pudo crear el handler de dibujo para:", drawType);
            }
        } catch (err) {
            console.error("❌ Error fatal al iniciar dibujo:", err);
            alert("Error al iniciar herramienta de dibujo. Revisa la consola.");
        }
    }, 400);
    
    // Configurar y mostrar panel flotante
    drawingInstructions.innerText = instructions;
    drawingModePanel.classList.remove('hidden');
};

const stopDrawingModeUI = () => {
    drawingModePanel.classList.add('hidden');
    if (currentDrawHandler) {
        currentDrawHandler.disable();
    }
    // Reactivar heatmap si estaba activo
    if (heatmapLayer && !leafletMap.hasLayer(heatmapLayer)) {
        heatmapLayer.addTo(leafletMap);
        console.log("🔥 Heatmap reactivado");
    }
};

const cancelDrawingMode = () => {
    stopDrawingModeUI();
    if (currentDrawingModal) {
        openModal(currentDrawingModal);
        
        // Regresar a vista de configuración si estábamos ahí
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-view="config"]').classList.add('active');
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById('config-view').classList.add('active');
    }
    currentDrawHandler = null;
    currentDrawingModal = null;
};

const modalCommercial = document.getElementById('modal-commercial');
const btnOpenCommercial = document.getElementById('btn-open-commercial');
if(btnOpenCommercial) btnOpenCommercial.addEventListener('click', () => openModal(modalCommercial));

// --- CRUD Comercial (Pasaporte Colonial) ---
const formCommercial = document.getElementById('form-commercial');
const commercialListAdmin = document.getElementById('commercial-list-admin');

formCommercial.addEventListener('submit', (e) => {
    e.preventDefault();
    const commercialId = push(ref(database, 'commercial_offers')).key;
    
    const offerData = {
        id: commercialId,
        title: document.getElementById('comm-name').value,
        icon: document.getElementById('comm-icon').value,
        shortDesc: document.getElementById('comm-short-desc').value,
        desc: document.getElementById('comm-desc').value,
        validationCode: document.getElementById('comm-code').value,
        validUntil: document.getElementById('comm-date').value,
        social: {
            instagram: document.getElementById('comm-ig').value,
            whatsapp: document.getElementById('comm-wa').value
        },
        timestamp: Date.now()
    };

    set(ref(database, `commercial_offers/${commercialId}`), offerData).then(() => {
        formCommercial.reset();
        alert("Socio comercial añadido con éxito");
    });
});

onValue(ref(database, 'commercial_offers'), (snapshot) => {
    commercialListAdmin.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(offer => {
            const item = document.createElement('div');
            item.className = 'list-item-admin';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-symbols-outlined">${offer.icon}</span>
                    <span><b>${offer.title}</b> - ${offer.validationCode}</span>
                </div>
                <button class="btn-delete" onclick="deleteCommercial('${offer.id}')">Eliminar</button>
            `;
            commercialListAdmin.appendChild(item);
        });
    } else {
        commercialListAdmin.innerHTML = '<p style="padding: 1rem; color: var(--text-dim);">No hay comercios registrados.</p>';
    }
});

window.deleteCommercial = (id) => {
    if(confirm("¿Eliminar este establecimiento del Pasaporte Colonial?")) {
        set(ref(database, `commercial_offers/${id}`), null);
    }
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
        closeModal(modalUnits); // Cierra el modal automáticamente
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
leafletMap.on(L.Draw.Event.CREATED, (e) => {
    console.log("✨ Figura creada con éxito!");
    lastDrawnLayer = e.layer;
    drawnItems.addLayer(lastDrawnLayer);
    
    // HABILITAR EDICIÓN INMEDIATA: Esto permite mover los puntos
    if (lastDrawnLayer.editing) {
        lastDrawnLayer.editing.enable();
        console.log("🛠️ Modo edición activado en la figura");
    }

    if (currentDrawingModal) {
        // Ocultar panel de dibujo y abrir modal
        stopDrawingModeUI();
        openModal(currentDrawingModal);
        
        // Habilitar el botón de guardado
        if(currentDrawingModal === modalPolygons) {
            document.getElementById('btn-save-polygon').disabled = false;
            document.getElementById('btn-save-polygon').innerText = "Guardar Geocerca (Listo)";
        }
        if(currentDrawingModal === modalStops) document.getElementById('btn-save-stop').disabled = false;
        if(currentDrawingModal === modalRoutes) document.getElementById('btn-save-route').disabled = false;
        
        currentDrawHandler = null;
    }
});

// Debug de clicks en mapa
leafletMap.on('click', (e) => {
    if (currentDrawHandler) {
        console.log(`🖱️ Clic en mapa detectado en: ${e.latlng.lat}, ${e.latlng.lng}`);
    }
});

const formPolygon = document.getElementById('form-polygon');
const polygonsListAdmin = document.getElementById('polygons-list-admin');

document.getElementById('btn-draw-polygon').addEventListener('click', () => {
    startDrawingMode(modalPolygons, 'polygon', "Dibuja el perímetro haciendo clic en el mapa. Conecta el último punto para terminar.");
});

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
        document.getElementById('btn-save-polygon').disabled = true; // Reinicia el botón
        drawnItems.clearLayers(); // Limpiar el trazo temporal
        lastDrawnLayer = null;
        alert("Geocerca guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/polygons'), (snapshot) => {
    polygonsListAdmin.innerHTML = '';
    polygonsLayer.clearLayers();
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
        Object.values(data).forEach(poly => {
            const layer = L.geoJSON(poly.geometry, {
                style: { color: '#f8c214', weight: 4, opacity: 0.8, fillColor: '#f8c214', fillOpacity: 0.2 }
            }).bindPopup(`<b>Zona: ${poly.name}</b>`).addTo(polygonsLayer);
            
            // Etiqueta permanente en el centro
            const center = layer.getBounds().getCenter();
            L.marker(center, {
                icon: L.divIcon({
                    className: 'poly-label',
                    html: `<div style="color: #f8c214; font-weight: 800; font-size: 10px; white-space: nowrap; text-shadow: 1px 1px 2px black;">${poly.name.toUpperCase()}</div>`,
                    iconSize: [100, 20]
                })
            }).addTo(polygonsLayer);
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

document.getElementById('btn-draw-stop').addEventListener('click', () => {
    startDrawingMode(modalStops, 'marker', "Haz clic en el mapa para marcar el punto de recogida oficial.");
});

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
        document.getElementById('btn-save-stop').disabled = true; // Reinicia el botón
        drawnItems.clearLayers(); // Limpiar el trazo temporal
        lastDrawnLayer = null;
        alert("Parada guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/stops'), (snapshot) => {
    stopsListAdmin.innerHTML = '';
    stopsLayer.clearLayers();
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
                    html: `<div style="background: white; border: 2px solid #136dec; width: 10px; height: 10px; border-radius: 50%;"></div>`
                })
            }).bindPopup(`<b>Parada: ${stop.name}</b>`).addTo(stopsLayer);
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

document.getElementById('btn-draw-route').addEventListener('click', () => {
    startDrawingMode(modalRoutes, 'polyline', "Traza la ruta calle por calle. Haz doble clic en el último punto para terminar.");
});

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
        document.getElementById('btn-save-route').disabled = true; // Reinicia el botón
        drawnItems.clearLayers(); // Limpiar el trazo temporal
        lastDrawnLayer = null;
        alert("Ruta guardada con éxito");
    });
});

onValue(ref(database, 'admin_config/routes'), (snapshot) => {
    routesListAdmin.innerHTML = '';
    routesLayer.clearLayers();
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
                style: { color: '#136dec', weight: 5, opacity: 0.8 }
            }).bindPopup(`<b>Ruta: ${route.name}</b>`).addTo(routesLayer);
        });
    }
});

window.deleteRoute = (id) => {
    if(confirm("¿Eliminar esta ruta?")) {
        set(ref(database, `admin_config/routes/${id}`), null);
    }
};

// --- Sembrado de Datos de Ejemplo (Solo si está vacío) ---
get(ref(database, 'admin_config/stops')).then((snapshot) => {
    if (!snapshot.exists()) {
        const demoStops = {
            stop_1: { id: 'stop_1', name: 'Calle El Conde', lat: 18.4735, lng: -69.8855, timestamp: Date.now() },
            stop_2: { id: 'stop_2', name: 'Parque Colón', lat: 18.4730, lng: -69.8860, timestamp: Date.now() },
            stop_3: { id: 'stop_3', name: 'Pata de Palo', lat: 18.4740, lng: -69.8845, timestamp: Date.now() }
        };
        set(ref(database, 'admin_config/stops'), demoStops);
    }
});

get(ref(database, 'commercial_offers')).then((snapshot) => {
    if (!snapshot.exists()) {
        const demoOfferId = "demo_coffee";
        set(ref(database, `commercial_offers/${demoOfferId}`), {
            id: demoOfferId,
            title: "Café de la Ciudad",
            icon: "local_cafe",
            shortDesc: "Café gratis con tu desayuno",
            desc: "Disfruta de un café artesanal dominicano totalmente gratis al presentar tu ticket de ZONA ENCARAMAO en desayunos seleccionados.",
            validationCode: "COLONIAL-CAFE",
            validUntil: "31 DIC 2026",
            social: {
                instagram: "https://instagram.com/zona_colonial",
                whatsapp: "https://wa.me/18091234567"
            },
            timestamp: Date.now()
        });
        console.log("☕ Oferta demo sembrada con éxito");
    }
});

console.log("🛡️ ZONA ENCARAMAO: Centro de Control Experto Iniciado");
