from ..database.firebase_service import FirebaseService
import time

class Solicitud:
    """
    Gestiona las peticiones de recogida realizadas por los usuarios.
    """
    def __init__(self, solicitud_id, usuario_id, lat, lng):
        self.id = solicitud_id
        self.usuario_id = usuario_id
        self.lat = lat
        self.lng = lng
        self.estado = "Pendiente"  # Pendiente, En camino, Completada, Cancelada
        self.timestamp = time.time()
        self.db = FirebaseService().get_reference(f"solicitudes/{self.id}")
        
        self.crear_solicitud()

    def crear_solicitud(self):
        """Registra la nueva solicitud en la base de datos."""
        print(f"📩 [ZONA ENCARAMAO] Nueva solicitud de recogida del usuario {self.usuario_id} en {self.lat}, {self.lng}")
        self.push_to_db()

    def cambiar_estado(self, nuevo_estado):
        """Actualiza el progreso de la solicitud."""
        self.estado = nuevo_estado
        print(f"🔔 [ZONA ENCARAMAO] Solicitud {self.id} pasó a estado: {nuevo_estado}")
        self.push_to_db()

    def push_to_db(self):
        """Sincroniza con Firebase."""
        try:
            self.db.set({
                "usuario_id": self.usuario_id,
                "lat": self.lat,
                "lng": self.lng,
                "estado": self.estado,
                "timestamp": self.timestamp
            })
        except Exception as e:
            print(f"⚠️ [ZONA ENCARAMAO] Error al registrar solicitud: {e}")
