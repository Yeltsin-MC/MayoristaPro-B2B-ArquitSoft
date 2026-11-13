"""
MayoristaPro B2B - AI Service
Servicio de scoring de ofertas basado en precio, plazo y reputación
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn
import os

app = FastAPI(title="MayoristaPro AI Service", version="1.0.0")


class Offer(BaseModel):
    """Oferta para evaluar"""
    offer_id: str
    supplier_id: str
    supplier_name: Optional[str] = None
    total: float = Field(gt=0, description="Precio total en PEN")
    delivery_days: int = Field(gt=0, description="Días de entrega")
    supplier_completed_orders: int = Field(ge=0, default=0, description="Pedidos completados del proveedor")
    supplier_total_orders: int = Field(ge=0, default=0, description="Total pedidos del proveedor")


class ScoreBreakdown(BaseModel):
    """Desglose de puntuación por criterio"""
    price_score: float = Field(ge=0, le=100)
    delivery_score: float = Field(ge=0, le=100)
    reputation_score: float = Field(ge=0, le=100)
    price_weight: float = 0.5
    delivery_weight: float = 0.3
    reputation_weight: float = 0.2


class ScoredOffer(BaseModel):
    """Oferta con puntuación"""
    offer_id: str
    supplier_id: str
    supplier_name: Optional[str] = None
    score: float = Field(ge=0, le=100, description="Puntuación total 0-100")
    breakdown: ScoreBreakdown
    rank: int = Field(ge=1, description="Posición en ranking (1 = mejor)")


class ScoreRequest(BaseModel):
    """Solicitud de scoring de múltiples ofertas"""
    request_id: Optional[str] = None
    offers: List[Offer]


class ScoreResponse(BaseModel):
    """Respuesta con ofertas rankeadas"""
    request_id: Optional[str] = None
    scored_offers: List[ScoredOffer]
    algorithm: str = "deterministic_v1"
    explanation: str = "Scoring basado en: 50% precio, 30% plazo entrega, 20% reputación proveedor"


def normalize_inversed(value: float, min_val: float, max_val: float) -> float:
    """
    Normaliza un valor a escala 0-100 de forma invertida (menor es mejor).
    Maneja casos edge: único valor, todos iguales, valores faltantes.
    """
    if min_val == max_val:
        return 50.0  # Todos iguales: score neutro
    
    if value < min_val or value > max_val:
        # Protección contra valores fuera de rango
        value = max(min_val, min(max_val, value))
    
    # Invertir: el menor valor obtiene 100, el mayor obtiene 0
    normalized = 100 * (1 - (value - min_val) / (max_val - min_val))
    return round(normalized, 2)


def calculate_reputation_score(completed: int, total: int) -> float:
    """
    Calcula score de reputación basado en pedidos completados.
    
    Casos:
    - Sin historial (total=0): 50 (neutro, no penalizar ni premiar)
    - Con historial: % completados normalizado a 0-100
    """
    if total == 0:
        return 50.0  # Proveedor nuevo: score neutro
    
    completion_rate = completed / total
    return round(completion_rate * 100, 2)


def score_offers(offers: List[Offer]) -> List[ScoredOffer]:
    """
    Rankea ofertas usando algoritmo determinista.
    
    Pesos:
    - Precio: 50% (menor es mejor)
    - Plazo: 30% (menor es mejor)
    - Reputación: 20% (mayor % completados es mejor)
    """
    if not offers:
        return []
    
    if len(offers) == 1:
        # Oferta única: scores neutros pero total ponderado
        single = offers[0]
        rep_score = calculate_reputation_score(
            single.supplier_completed_orders,
            single.supplier_total_orders
        )
        breakdown = ScoreBreakdown(
            price_score=50.0,
            delivery_score=50.0,
            reputation_score=rep_score
        )
        total_score = (
            breakdown.price_score * breakdown.price_weight +
            breakdown.delivery_score * breakdown.delivery_weight +
            breakdown.reputation_score * breakdown.reputation_weight
        )
        
        return [ScoredOffer(
            offer_id=single.offer_id,
            supplier_id=single.supplier_id,
            supplier_name=single.supplier_name,
            score=round(total_score, 2),
            breakdown=breakdown,
            rank=1
        )]
    
    # Múltiples ofertas: normalizar precios y plazos
    prices = [o.total for o in offers]
    deliveries = [o.delivery_days for o in offers]
    
    min_price, max_price = min(prices), max(prices)
    min_delivery, max_delivery = min(deliveries), max(deliveries)
    
    # Calcular scores pero sin crear objetos aún (para evitar validación de rank)
    results = []
    for offer in offers:
        price_score = normalize_inversed(offer.total, min_price, max_price)
        delivery_score = normalize_inversed(offer.delivery_days, min_delivery, max_delivery)
        reputation_score = calculate_reputation_score(
            offer.supplier_completed_orders,
            offer.supplier_total_orders
        )
        
        breakdown = ScoreBreakdown(
            price_score=price_score,
            delivery_score=delivery_score,
            reputation_score=reputation_score
        )
        
        # Score total ponderado
        total_score = (
            price_score * breakdown.price_weight +
            delivery_score * breakdown.delivery_weight +
            reputation_score * breakdown.reputation_weight
        )
        
        results.append({
            'offer_id': offer.offer_id,
            'supplier_id': offer.supplier_id,
            'supplier_name': offer.supplier_name,
            'score': round(total_score, 2),
            'breakdown': breakdown
        })
    
    # Ordenar por score descendente (mayor score = mejor oferta)
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # Crear objetos ScoredOffer con ranks asignados
    scored = []
    for idx, result in enumerate(results, start=1):
        scored.append(ScoredOffer(
            offer_id=result['offer_id'],
            supplier_id=result['supplier_id'],
            supplier_name=result['supplier_name'],
            score=result['score'],
            breakdown=result['breakdown'],
            rank=idx
        ))
    
    return scored


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "mayoristapro-ai"}


@app.post("/api/v1/score-offers", response_model=ScoreResponse)
def score_offers_endpoint(request: ScoreRequest):
    """
    Rankea ofertas de una cotización.
    
    Algoritmo determinista basado en:
    - 50% Precio (menor es mejor)
    - 30% Plazo de entrega (menor es mejor)
    - 20% Reputación proveedor (% pedidos completados)
    """
    if not request.offers:
        raise HTTPException(status_code=400, detail="Se requiere al menos una oferta")
    
    scored = score_offers(request.offers)
    
    return ScoreResponse(
        request_id=request.request_id,
        scored_offers=scored
    )


if __name__ == "__main__":
    # Para desarrollo local: python apps/ai-service/main.py
    uvicorn.run(app, host=os.environ.get("AI_HOST", "127.0.0.1"), port=int(os.environ.get("AI_PORT", "5000")), log_level="info")
