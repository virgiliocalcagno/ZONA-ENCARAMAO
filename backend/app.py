from core.transport import Transporte
from core.requests import Solicitud
from core.admin import PlazaColonialAdmin
from simulation.mock_generator import MockGenerator, esta_en_perimetro
import time
import random

def iniciar_sistema():
    print("🌟 [ZONA ENCARAMAO] Iniciando Backend de Movilidad Inteligente...")
    
    # 1. Inicializar componentes
    admin = PlazaColonialAdmin()
    trencito = Transporte("tren_01", "Trencito El Conde")
    simulador = MockGenerator()
    
    print("🚦 [ZONA ENCARAMAO] Sistema en marcha. Simulando movimiento cada 5 segundos...")
    
    try:
        ciclo = 0
        while True:
            # 2. Simular movimiento del trencito
            lat, lng = simulador.siguiente_movimiento()
            
            # 3. Validar Geofencing
            if esta_en_perimetro(lat, lng):
                trencito.actualizar_ubicacion(lat, lng)
            
            # 4. Simular solicitudes aleatorias cada 4 ciclos
            if ciclo % 4 == 0 and ciclo > 0:
                user_id = f"user_{random.randint(100, 999)}"
                # Una ubicación aleatoria cercana a El Conde
                sol_lat = 18.4730 + random.uniform(-0.001, 0.001)
                sol_lng = -69.8860 + random.uniform(-0.001, 0.001)
                
                nueva_sol = Solicitud(f"REQ_{int(time.time())}", user_id, sol_lat, sol_lng)
                
                # Simular validación de ticket para el usuario
                admin.validar_ticket(f"TCKT-{random.randint(1000, 9999)}")
            
            ciclo += 1
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n🛑 [ZONA ENCARAMAO] Sistema detenido por el usuario.")

if __name__ == "__main__":
    iniciar_sistema()
