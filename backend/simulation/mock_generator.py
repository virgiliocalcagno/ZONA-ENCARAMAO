import random
import time

def esta_en_perimetro(lat, lng):
    """
    Verifica si las coordenadas están dentro del perímetro aproximado de la Zona Colonial.
    Perímetro simple (Bounding Box):
    Norte: 18.4770, Sur: 18.4680
    Oeste: -69.8900, Este: -69.8800
    """
    PERIMETRO = {
        "norte": 18.4770,
        "sur": 18.4680,
        "oeste": -69.8900,
        "este": -69.8800
    }
    
    dentro = (PERIMETRO["sur"] <= lat <= PERIMETRO["norte"]) and \
             (PERIMETRO["oeste"] <= lng <= PERIMETRO["este"])
    
    if not dentro:
        print(f"🚩 [ZONA ENCARAMAO] ALERTA: Fuera de perímetro en {lat}, {lng}")
    
    return dentro

class MockGenerator:
    """
    Simula el movimiento del trencito por calles reales de la Zona Colonial.
    """
    def __init__(self):
        # Puntos de referencia (Calles principales)
        self.rutas = {
            "Calle El Conde": [
                (18.4735, -69.8875), (18.4730, -69.8860), (18.4725, -69.8845)
            ],
            "Calle Las Damas": [
                (18.4740, -69.8820), (18.4720, -69.8825), (18.4700, -69.8830)
            ],
            "Calle Hostos": [
                (18.4750, -69.8855), (18.4730, -69.8858), (18.4710, -69.8861)
            ]
        }
        self.ruta_actual = random.choice(list(self.rutas.keys()))
        self.idx_punto = 0

    def siguiente_movimiento(self):
        """Genera el siguiente punto GPS simulado."""
        puntos = self.rutas[self.ruta_actual]
        punto = puntos[self.idx_punto]
        
        # Añadir un poco de ruido aleatorio para realismo
        lat = punto[0] + random.uniform(-0.0001, 0.0001)
        lng = punto[1] + random.uniform(-0.0001, 0.0001)
        
        # Avanzar en la ruta
        self.idx_punto += 1
        if self.idx_punto >= len(puntos):
            self.idx_punto = 0
            # Cambiar a una ruta conectada (simulado cambiando a cualquier otra)
            self.ruta_actual = random.choice(list(self.rutas.keys()))
            print(f"🛤️ [ZONA ENCARAMAO] El transporte ahora circula por: {self.ruta_actual}")

        return lat, lng
