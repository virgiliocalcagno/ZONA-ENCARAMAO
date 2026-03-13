from ..database.firebase_service import FirebaseService

class PlazaColonialAdmin:
    """
    Lógica administrativa para el parqueo Plaza Colonial.
    Valida tickets y gestiona métricas de movilidad.
    """
    def __init__(self):
        self.db = FirebaseService()
        print("🏛️ [ZONA ENCARAMAO] Admin de Plaza Colonial inicializado.")

    def validar_ticket(self, ticket_id):
        """
        Simula la validación de un ticket de parqueo.
        En el futuro, esto consultará el sistema de Plaza Colonial.
        """
        # Lógica simulada: Si el ID termina en par, es válido.
        if ticket_id.endswith(("0", "2", "4", "6", "8")):
            print(f"✅ [ZONA ENCARAMAO] Ticket {ticket_id} validado correctamente.")
            return True
        else:
            print(f"❌ [ZONA ENCARAMAO] Ticket {ticket_id} no es válido o ha expirado.")
            return False

    def obtener_metricas_hoy(self):
        """Obtiene métricas básicas del día."""
        # Esto sería una consulta a Firebase en una implementación real.
        print("📊 [ZONA ENCARAMAO] Calculando métricas del día para Plaza Colonial...")
        return {
            "total_viajes": 42,
            "tiempo_promedio_espera": "8 min",
            "usuarios_activos": 15
        }
