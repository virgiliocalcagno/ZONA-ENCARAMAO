import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.core.admin import PlazaColonialAdmin
from backend.database.firebase_service import FirebaseService

def main():
    print("📊 [ZONA ENCARAMAO] Dashboard de Monitoreo Plaza Colonial")
    
    admin = PlazaColonialAdmin()
    db_service = FirebaseService()
    
    print("\n--- Monitoreo de Flota Activa ---")
    
    try:
        while True:
            # Obtener datos de Firebase
            transportes = db_service.get_reference("transportes").get()
            solicitudes = db_service.get_reference("solicitudes").get()
            
            os.system('cls' if os.name == 'nt' else 'clear')
            print("🚀 MONITOR EN TIEMPO REAL - ZONA ENCARAMAO")
            print("="*40)
            
            print("\n🚐 ESTADO DE TRANSPORTES:")
            if transportes:
                for tid, data in transportes.items():
                    print(f" - {data.get('nombre')}: {data.get('estado')} | 📍 {data.get('lat')}, {data.get('lng')}")
            else:
                print(" No hay transportes activos.")
                
            print("\n📩 SOLICITUDES PENDIENTES:")
            if solicitudes:
                pendientes = [s for s in solicitudes.values() if s.get('estado') == 'Pendiente']
                print(f" Hay {len(pendientes)} solicitudes esperando recogida.")
                for sol in solicitudes.values():
                    if sol.get('estado') == 'Pendiente':
                        print(f" - Usuario {sol.get('usuario_id')} en {sol.get('lat')}, {sol.get('lng')}")
            else:
                print(" Todo despejado. No hay solicitudes.")
            
            print("\n" + "="*40)
            print("Presiona Ctrl+C para salir.")
            
            # Mostrar métricas del día cada 3 refrescos
            metrics = admin.obtener_metricas_hoy()
            print(f"\n📈 Viajes hoy: {metrics['total_viajes']} | Espera: {metrics['tiempo_promedio_espera']}")
            
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n👋 Dashboard cerrado.")
    except Exception as e:
        print(f"⚠️ Error en el monitor: {e}")
        print("¿Configuraste el serviceAccountKey.json?")

if __name__ == "__main__":
    main()
