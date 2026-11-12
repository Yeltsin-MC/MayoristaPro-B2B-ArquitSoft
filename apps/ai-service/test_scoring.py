"""
Tests unitarios para el algoritmo de scoring de ofertas.
Verifica normalización, casos extremos y lógica determinista.
"""
import pytest
from main import normalize_inversed, calculate_reputation_score, score_offers, Offer


class TestNormalization:
    """Tests para funciones de normalización"""
    
    def test_normalize_inversed_basic(self):
        # Valor mínimo debe dar 100
        assert normalize_inversed(10, 10, 100) == 100.0
        # Valor máximo debe dar 0
        assert normalize_inversed(100, 10, 100) == 0.0
        # Valor medio debe dar ~50
        assert normalize_inversed(55, 10, 100) == 50.0
    
    def test_normalize_inversed_single_value(self):
        # Si min == max, retorna 50 (neutral)
        assert normalize_inversed(50, 50, 50) == 50.0
    
    def test_reputation_score(self):
        # 100% completadas = 100
        assert calculate_reputation_score(10, 10) == 100.0
        # 50% completadas = 50
        assert calculate_reputation_score(5, 10) == 50.0
        # 0% completadas = 0
        assert calculate_reputation_score(0, 10) == 0.0
        # Sin historial = 50 (neutral)
        assert calculate_reputation_score(0, 0) == 50.0


class TestScoringAlgorithm:
    """Tests para el algoritmo completo de scoring"""
    
    def test_single_offer_neutral_score(self):
        """Una sola oferta debe recibir scores neutrales (50) en precio/entrega, pero reputación real"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=1000,
                delivery_days=5,
                supplier_completed_orders=8,
                supplier_total_orders=10
            )
        ]
        result = score_offers(offers)
        assert len(result) == 1
        # Score ponderado: 50*0.5 + 50*0.3 + 80*0.2 = 25 + 15 + 16 = 56
        assert result[0].score == 56.0
        assert result[0].breakdown.price_score == 50.0
        assert result[0].breakdown.delivery_score == 50.0
        assert result[0].breakdown.reputation_score == 80.0  # 8/10 * 100
    
    def test_multiple_offers_ranking(self):
        """Múltiples ofertas deben rankearse correctamente"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=2000,
                delivery_days=10,
                supplier_completed_orders=5,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=1000,
                delivery_days=3,
                supplier_completed_orders=9,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o3",
                supplier_id="s3",
                total=1500,
                delivery_days=5,
                supplier_completed_orders=7,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        # Debe estar ordenado por score descendente
        assert len(result) == 3
        assert result[0].score >= result[1].score >= result[2].score
        
        # "Barato y rápido" debe ser el mejor
        assert result[0].offer_id == "o2"
        # "Caro y lento" debe ser el peor
        assert result[2].offer_id == "o1"
    
    def test_identical_offers(self):
        """Ofertas idénticas deben tener el mismo score"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=1500,
                delivery_days=5,
                supplier_completed_orders=7,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=1500,
                delivery_days=5,
                supplier_completed_orders=7,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        assert len(result) == 2
        # Scores deben ser exactamente iguales
        assert result[0].score == result[1].score
        # Precio y entrega deben ser 50 (neutral en empate)
        assert result[0].breakdown.price_score == 50.0
        assert result[0].breakdown.delivery_score == 50.0
    
    def test_no_reputation_data(self):
        """Proveedores sin historial deben recibir score neutral de reputación"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=1000,
                delivery_days=3,
                supplier_completed_orders=0,
                supplier_total_orders=0
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=1100,
                delivery_days=3,
                supplier_completed_orders=10,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        # El nuevo proveedor debe tener reputación 50
        new_provider = next(r for r in result if r.offer_id == "o1")
        assert new_provider.breakdown.reputation_score == 50.0
        
        # El proveedor con historial debe tener 100
        established = next(r for r in result if r.offer_id == "o2")
        assert established.breakdown.reputation_score == 100.0
    
    def test_weight_distribution(self):
        """Verificar que los pesos se aplican correctamente (50% precio, 30% entrega, 20% reputación)"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=1000,
                delivery_days=10,
                supplier_completed_orders=0,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=2000,
                delivery_days=1,
                supplier_completed_orders=0,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        # El precio debe influir más (50%) que la entrega (30%)
        best_price = next(r for r in result if r.offer_id == "o1")
        best_delivery = next(r for r in result if r.offer_id == "o2")
        
        # "Mejor precio" debe ganar por el mayor peso del precio
        assert best_price.score > best_delivery.score


class TestEdgeCases:
    """Tests para casos extremos"""
    
    def test_empty_offers_list(self):
        """Lista vacía debe retornar lista vacía"""
        result = score_offers([])
        assert result == []
    
    def test_extreme_price_difference(self):
        """Diferencias extremas de precio deben manejarse correctamente"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=10,
                delivery_days=5,
                supplier_completed_orders=5,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=10000,
                delivery_days=5,
                supplier_completed_orders=5,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        # Scores deben estar en rango 0-100
        assert all(0 <= r.score <= 100 for r in result)
        assert all(0 <= r.breakdown.price_score <= 100 for r in result)
    
    def test_extreme_delivery_difference(self):
        """Diferencias extremas de entrega deben manejarse correctamente"""
        offers = [
            Offer(
                offer_id="o1",
                supplier_id="s1",
                total=1000,
                delivery_days=1,
                supplier_completed_orders=5,
                supplier_total_orders=10
            ),
            Offer(
                offer_id="o2",
                supplier_id="s2",
                total=1000,
                delivery_days=365,
                supplier_completed_orders=5,
                supplier_total_orders=10
            ),
        ]
        result = score_offers(offers)
        
        # Scores deben estar en rango 0-100
        assert all(0 <= r.score <= 100 for r in result)
        assert all(0 <= r.breakdown.delivery_score <= 100 for r in result)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
