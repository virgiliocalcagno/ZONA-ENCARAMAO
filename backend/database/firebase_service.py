import firebase_admin
from firebase_admin import credentials, db
import os
import json

class FirebaseService:
    """
    Servicio centralizado para gestionar la conexión con Firebase Realtime Database.
    Usa el patrón Singleton para asegurar una única conexión en todo el proyecto.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        # El nombre del archivo de credenciales por defecto
        self.key_path = "serviceAccountKey.json"
        self.db_url = None # Se debe configurar según el proyecto del usuario
        
        self._conectar()
        self._initialized = True

    def _conectar(self):
        """Inicializa el SDK de Firebase de forma segura."""
        if not os.path.exists(self.key_path):
            print(f"⚠️ [ZONA ENCARAMAO] CRÍTICO: No se encontró {self.key_path}")
            print("Por favor, coloca tu archivo de credenciales en la raíz del proyecto.")
            return

        try:
            cred = credentials.Certificate(self.key_path)
            # Para Realtime Database necesitamos la URL. 
            # Intentaremos obtenerla del JSON si no se provee manualmente.
            with open(self.key_path) as f:
                data = json.load(f)
                project_id = data.get("project_id")
                if project_id:
                    self.db_url = f"https://{project_id}-default-rtdb.firebaseio.com/"

            firebase_admin.initialize_app(cred, {
                'databaseURL': self.db_url
            })
            print(f"🚀 [ZONA ENCARAMAO] Conexión establecida con Firebase: {project_id}")
        except Exception as e:
            print(f"❌ [ZONA ENCARAMAO] Error al conectar con Firebase: {e}")

    def get_reference(self, path):
        """Obtiene una referencia a un nodo específico en la base de datos."""
        return db.reference(path)
