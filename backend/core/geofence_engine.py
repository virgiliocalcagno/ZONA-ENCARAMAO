import time
from datetime import datetime
from shapely.geometry import Point, Polygon
from firebase_admin import db

# Si corres directamente este script para la simulación, inicializamos Firebase
if __name__ == '__main__':
    import os
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from backend.database.firebase_service import FirebaseService
    # Iniciar conexión global
    firebase_service = FirebaseService()

class GeofenceEngine:
    """
    Motor Experto de Vigilancia Geográfica para ZONA ENCARAMAO.
    Mantiene en memoria los polígonos de alerta y verifica las posiciones en tiempo real.
    """
    def __init__(self):
        self.zona_primaria_polygon = None
        self._listener_activo = False

    def inicializar_geocerca(self):
        """
        Descarga los puntos del perímetro inicial desde Firebase y establece el listener
        para actualizar el polígono dinámicamente sin necesidad de reiniciar el servicio.
        """
        ref_geocerca = db.reference('configuracion/geocercas/zona_primaria/puntos')
        
        # Primero intentamos obtener los datos actuales
        puntos_data = ref_geocerca.get()
        if puntos_data:
            self._construir_poligono(puntos_data)
        else:
            print("⚠️ [GEOFENCE] No se encontró configuración inicial para zona_primaria. Esperando datos...")

        # Configuramos el listener para escuchar cambios futuros
        if not self._listener_activo:
            ref_geocerca.listen(self._on_geocerca_change)
            self._listener_activo = True
            print("✅ [GEOFENCE] Listener de actualización en tiempo real activado.")

    def _on_geocerca_change(self, event):
        """Callback invocado por Firebase cuando los puntos de la geocerca cambian."""
        # event.data contiene los nuevos datos de la ruta en la que estamos escuchando
        print(f"🔄 [GEOFENCE] Detectado cambio en la base de datos (Geocerca actualizada).")
        if event.data:
            # Si el evento es en la raíz, re-construimos con todo
            if event.path == '/':
                self._construir_poligono(event.data)
            else:
                # Si es una modificación parcial, para este ejemplo volvemos a descargar
                # todo para evitar desincronizaciones complejas, o reconstruir desde root
                full_data = db.reference('configuracion/geocercas/zona_primaria/puntos').get()
                if full_data:
                    self._construir_poligono(full_data)

    def _construir_poligono(self, puntos_list):
        """
        Construye el objeto Polygon de Shapely en la memoria.
        Espera una lista de diccionarios [{'lat': 18.x, 'lng': -69.y}, ...].
        """
        try:
            # Verificamos si es una lista o un dict devuelto por firebase
            puntos = puntos_list if isinstance(puntos_list, list) else list(puntos_list.values())
            
            # Shapely usa formato (x, y) que es equivalente a (lng, lat)
            coords = [(p['lng'], p['lat']) for p in puntos if p is not None]
            
            if len(coords) >= 3:
                self.zona_primaria_polygon = Polygon(coords)
                print(f"🌐 [GEOFENCE] Polígono 'Zona Primaria' construido con éxito en memoria ({len(coords)} vértices).")
            else:
                print("⚠️ [GEOFENCE] Error: Un polígono válido necesita al menos 3 puntos.")
        except Exception as e:
            print(f"❌ [GEOFENCE] Error al construir el polígono: {e}")

    def verificar_posicion(self, transport_id, lat, lng):
        """
        Verifica si la ubicación exacta (lat, lng) está dentro de la geocerca en memoria.
        Genera alertas automáticas si se viola el perímetro.
        """
        if not self.zona_primaria_polygon:
            print("⚠️ [GEOFENCE] Motor de Geocercas no inicializado (o sin zona definida). Se ignora revisión de posición.")
            return

        # Shapely Point (x, y) -> (lng, lat)
        current_pos = Point(lng, lat)

        # Verificamos si está dentro del polígono (o tocando el borde)
        is_inside = self.zona_primaria_polygon.contains(current_pos) or self.zona_primaria_polygon.touches(current_pos)

        print(f"📍 Evaluando {transport_id} en ({lat:.5f}, {lng:.5f}) -> Dentro de Zona: {is_inside}")

        if not is_inside:
            self._disparar_alerta(transport_id)

    def _disparar_alerta(self, transport_id):
        """Registra la alerta de seguridad y cambia el estado de la unidad en Firebase."""
        print(f"🚨 [ALERTA] Unidad {transport_id} FUERA DE PERÍMETRO. Escribiendo logs de seguridad...")
        
        # 1. Registrar Alerta en nodo /alertas/seguridad
        ref_alertas = db.reference('alertas/seguridad')
        nueva_alerta = ref_alertas.push()
        nueva_alerta.set({
            'unidad_id': transport_id,
            'mensaje': 'UNIDAD FUERA DE PERÍMETRO',
            'timestamp': int(time.time() * 1000),
            'fecha': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })

        # 2. Cambiar estado del transporte a fuera_de_ruta
        ref_transporte = db.reference(f'transporte/{transport_id}')
        ref_transporte.update({
            'status': 'fuera_de_ruta',
            'last_update': int(time.time() * 1000)
        })


# =========================================================================
# SCRIPT DE SIMULACIÓN PARA DEMOSTRACIÓN (Como solicitado)
# =========================================================================
if __name__ == '__main__':
    print("Iniciando Módulo Experto de Geocercas ZONA ENCARAMAO...")

    # 1. MOCK DE GEOCERCA (Simulamos que el administrador ya dibujó un cuadro en la Zona Colonial)
    # Coordenadas aproximadas que encuadran la zona central
    mock_puntos = [
        {'lat': 18.4750, 'lng': -69.8870}, # Noroeste
        {'lat': 18.4750, 'lng': -69.8800}, # Noreste
        {'lat': 18.4690, 'lng': -69.8800}, # Sureste (Cerca de Ozama)
        {'lat': 18.4690, 'lng': -69.8870}  # Suroeste (Limítrofe calle Hostos)
    ]
    db.reference('configuracion/geocercas/zona_primaria/puntos').set(mock_puntos)
    print("✔️ Mock de geocerca inicial publicado en Firebase.")

    # 2. Instanciamos el Motor Experto e inicializamos
    motor = GeofenceEngine()
    motor.inicializar_geocerca()

    # Le damos un pequeño descanso para que el listener pueda confirmar (aunque el get inicial es sincrono)
    time.sleep(1)

    # 3. Datos de la Ubicación Simulada del Trencito (Hacia afuera de la zona colonial, rumbo al Malecón)
    simulacion_ruta = [
        {"desc": "Calle El Conde (Centro)", "lat": 18.4720, "lng": -69.8850},
        {"desc": "Calle Las Damas (Adentro)", "lat": 18.4735, "lng": -69.8835},
        {"desc": "Cruce Padre Billini (Limite Sur)", "lat": 18.4695, "lng": -69.8840},
        {"desc": "Avenida George Washington / Malecón (FUERA DE RUTA)", "lat": 18.4670, "lng": -69.8850},
    ]

    print("\n🛤️ Iniciando simulación de recorrido del Tren...")
    import threading
    
    # Creamos un estado falso del bus primero
    db.reference('transporte/trencito_1').set({
        'status': 'en_ruta',
        'lat': simulacion_ruta[0]['lat'],
        'lng': simulacion_ruta[0]['lng']
    })

    for paso in simulacion_ruta:
        print(f"\n🚍 Trencito avanzando por: {paso['desc']}")
        # Actualizamos firebase simulando el GPS del vehiculo real
        db.reference('transporte/trencito_1').update({
            'lat': paso['lat'],
            'lng': paso['lng']
        })
        
        # El Backend verifica silenciosamente la ubicacion
        motor.verificar_posicion('trencito_1', paso['lat'], paso['lng'])
        
        # Simulamos avance del tiempo
        time.sleep(2)
    
    print("\n✅ Simulación concluida.")
    # Revisamos que el estado en la base de datos sea 'fuera_de_ruta'
    estado_final = db.reference('transporte/trencito_1/status').get()
    print(f"🔍 Estado final del transporte en DB: {estado_final}")
