from ..database.firebase_service import FirebaseService
import time

class Transporte:
    """
    Clase que representa un vehículo de transporte (ej. el trencito).
    Gestiona su ubicación GPS y su disponibilidad en tiempo real.
    """
    def __init__(self, transporte_id, nombre="Trencito Colonial"):
        self.id = transporte_id
        self.nombre = nombre
        self.lat = 0.0
        self.lng = 0.0
        self.estado = "Disponible"  # Disponible, Ocupado, Fuera de Servicio
        self.db = FirebaseService().get_reference(f"transportes/{self.id}")
        
        # Inicializar en Firebase
        self.push_to_db()

    def actualizar_ubicacion(self, lat, lng):
        """Actualiza las coordenadas GPS del transporte."""
        self.lat = lat
        self.lng = lng
        print(f"📍 [ZONA ENCARAMAO] {self.nombre} moviéndose a: {lat}, {lng}")
        self.push_to_db()

    def cambiar_estado(self, nuevo_estado):
        """Cambia el estado operativo del transporte."""
        self.estado = nuevo_estado
        print(f"🔄 [ZONA ENCARAMAO] {self.nombre} cambió su estado a: {nuevo_estado}")
        self.push_to_db()

    def push_to_db(self):
        """Sincroniza los datos actuales con Firebase Realtime Database."""
        try:
            self.db.set({
                "nombre": self.nombre,
                "lat": self.lat,
                "lng": self.lng,
                "estado": self.estado,
                "ultima_actualizacion": time.time()
            })
        except Exception as e:
            print(f"⚠️ [ZONA ENCARAMAO] No se pudo sincronizar con Firebase: {e}")

    def obtener_info(self):
        """Retorna un diccionario con la info actual."""
        return {
            "id": self.id,
            "nombre": self.nombre,
            "lat": self.lat,
            "lng": self.lng,
            "estado": self.estado
        }
