import sys
import os
import time
import random

# Añadir el path base para importar el backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.core.transport import Transporte
from backend.simulation.mock_generator import MockGenerator, esta_en_perimetro

def main():
    print("🚖 [ZONA ENCARAMAO] Iniciando App del Conductor (Tablet)...")
    
    # En una implementación real, el conductor elegiría su ID al iniciar sesión
    driver_id = "tren_01"
    transporte = Transporte(driver_id, "Trencito Colonial Principal")
    simulador = MockGenerator()
    
    print(f"✅ Conectado como: {driver_id}")
    print("📡 Enviando coordenadas GPS cada 5 segundos...")
    
    try:
        while True:
            # Simular lectura de GPS de la Tablet
            lat, lng = simulador.siguiente_movimiento()
            
            # Validar que no se salga de la Zona Colonial
            if esta_en_perimetro(lat, lng):
                transporte.actualizar_ubicacion(lat, lng)
            else:
                print("⚠️ Fuera de rango. Reportando incidencia...")
                transporte.cambiar_estado("Fuera de Perímetro")
                
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n👋 App del Conductor cerrada.")

if __name__ == "__main__":
    main()
