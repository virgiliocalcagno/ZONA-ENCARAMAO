import sys
import os
import time
import random

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.core.ride_requests import Solicitud
from backend.database.firebase_service import FirebaseService

def main():
    print("📱 [ZONA ENCARAMAO] Bienvenido a la App del Pasajero")
    
    user_id = f"pasajero_{random.randint(1000, 9999)}"
    print(f"👤 Usuario ID: {user_id}")
    
    # Simular escaneo de QR
    print("\n[Simulación] Escaneando QR en parada...")
    time.sleep(2)
    
    # Ubicación simulada del usuario (Cerca del Parque Colón)
    user_lat, user_lng = 18.4735, -69.8860
    
    print(f"📍 Ubicación detectada: {user_lat}, {user_lng}")
    input("Presiona ENTER para 'Solicitar Recogida' 🛎️...")
    
    solicitud_id = f"REQ_{int(time.time())}"
    nueva_sol = Solicitud(solicitud_id, user_id, user_lat, user_lng)
    
    print("\n⏳ Esperando al conductor...")
    
    # Escuchar cambios en la solicitud (Simulado)
    db = FirebaseService().get_reference(f"solicitudes/{solicitud_id}")
    
    try:
        # En una app real, esto sería un listener asíncrono
        for _ in range(3):
            time.sleep(3)
            print("...")
            
        print("✅ El Trencito está en camino!")
        nueva_sol.cambiar_estado("En camino")
        
    except KeyboardInterrupt:
        print("\n👋 App cerrada.")

if __name__ == "__main__":
    main()
