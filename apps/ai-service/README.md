# MayoristaPro AI Service

Servicio de scoring de ofertas basado en criterios deterministas.

## Instalación

```bash
cd apps/ai-service
pip install -r requirements.txt
```

## Ejecución

```bash
# Desarrollo
python main.py

# Producción
uvicorn main:app --host 0.0.0.0 --port 5000
```

## API

### POST /api/v1/score-offers

Rankea ofertas de una cotización.

**Request:**
```json
{
  "request_id": "uuid",
  "offers": [
    {
      "offer_id": "uuid",
      "supplier_id": "uuid",
      "total": 1000.50,
      "delivery_days": 5,
      "supplier_completed_orders": 10,
      "supplier_total_orders": 12
    }
  ]
}
```

**Response:**
```json
{
  "request_id": "uuid",
  "scored_offers": [
    {
      "offer_id": "uuid",
      "supplier_id": "uuid",
      "score": 85.5,
      "breakdown": {
        "price_score": 90.0,
        "delivery_score": 85.0,
        "reputation_score": 83.33,
        "price_weight": 0.5,
        "delivery_weight": 0.3,
        "reputation_weight": 0.2
      },
      "rank": 1
    }
  ],
  "algorithm": "deterministic_v1",
  "explanation": "Scoring basado en: 50% precio, 30% plazo entrega, 20% reputación proveedor"
}
```

## Algoritmo

### Normalización
- **Precio y plazo:** Escala 0-100 invertida (menor = mejor)
- **Reputación:** % pedidos completados (0-100)

### Casos especiales
- **Oferta única:** Scores neutros (50) excepto reputación
- **Valores iguales:** Score neutro (50)
- **Sin historial:** Reputación = 50 (neutro)

### Score final
```
score = 0.5×precio + 0.3×plazo + 0.2×reputación
```
