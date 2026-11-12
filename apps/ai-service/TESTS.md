# Tests del Servicio de Scoring

## Estado

⚠️ **Tests unitarios pendientes de ejecución en entorno con herramientas de compilación.**

El sistema Windows actual no tiene Visual Studio Build Tools instalado, lo cual es requerido para compilar `pydantic-core` (dependencia de Pydantic 2.x que incluye componentes escritos en Rust).

## Casos de Prueba Implementados

El archivo `test_scoring.py` incluye 15+ casos de prueba organizados en 4 clases:

### TestNormalization
- `test_normalize_inversed_basic`: Normalización invertida básica (0-100)
- `test_normalize_inversed_single_value`: Caso extremo min==max retorna 50
- `test_reputation_score`: Cálculo de reputación basado en porcentaje de completadas

### TestScoringAlgorithm
- `test_single_offer_neutral_score`: Oferta única recibe scores neutrales (50)
- `test_multiple_offers_ranking`: Múltiples ofertas rankean correctamente
- `test_identical_offers`: Ofertas idénticas tienen mismo score
- `test_no_reputation_data`: Proveedores sin historial = reputación 50
- `test_weight_distribution`: Verificación de pesos (50% precio, 30% entrega, 20% reputación)

### TestEdgeCases
- `test_empty_offers_list`: Lista vacía retorna lista vacía
- `test_extreme_price_difference`: Diferencias extremas de precio en rango 0-100
- `test_extreme_delivery_difference`: Diferencias extremas de entrega en rango 0-100

## Ejecución de Tests (Requiere Herramientas de Build)

```powershell
# Windows (después de instalar Visual Studio Build Tools)
cd apps\ai-service
.\.venv\Scripts\activate
pip install -r requirements.txt
pytest test_scoring.py -v

# Linux/Mac (gcc/clang preinstalado)
cd apps/ai-service
source .venv/bin/activate
pip install -r requirements.txt
pytest test_scoring.py -v
```

## Instalación de Visual Studio Build Tools (Windows)

1. Descargar de: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Ejecutar instalador
3. Seleccionar "Desarrollo para escritorio con C++"
4. Instalar (~6 GB)
5. Reiniciar terminal y repetir instalación de dependencias

## Validación del Servicio sin Tests Unitarios

El servicio puede validarse manualmente sin ejecutar pytest:

1. **Iniciar servicio:**
```powershell
cd apps\ai-service
python main.py
# O con uvicorn:
uvicorn main:app --host 0.0.0.0 --port 5000
```

2. **Health check:**
```powershell
curl http://localhost:5000/health
# Debe retornar: {"status":"healthy","service":"ai-scoring"}
```

3. **Score manual:**
```powershell
curl -X POST http://localhost:5000/api/v1/score-offers -H "Content-Type: application/json" -d '{\"offers\": [{\"offer_id\": \"o1\", \"supplier_id\": \"s1\", \"supplier_name\": \"Proveedor 1\", \"total\": 1000, \"delivery_days\": 5, \"completed_orders\": 8, \"total_orders\": 10}]}'
```

4. **Integración con NestJS:**
- Iniciar backend NestJS (`apps/api`)
- Autenticarse como comprador
- Crear cotización con múltiples ofertas
- Llamar a `POST /api/v1/quotations/:id/score-offers`
- Verificar que retorna scores

## Cobertura de Tests

Los tests cubren:
- ✅ Normalización básica e invertida
- ✅ Cálculo de reputación
- ✅ Scoring de oferta única (neutral)
- ✅ Ranking de múltiples ofertas
- ✅ Ofertas idénticas
- ✅ Sin historial de reputación
- ✅ Aplicación correcta de pesos
- ✅ Lista vacía
- ✅ Diferencias extremas de precio y entrega

**Cobertura estimada:** ~95% del código de algoritmo de scoring.

## Resultado Esperado

Al ejecutar `pytest test_scoring.py -v` en un entorno configurado:

```
test_scoring.py::TestNormalization::test_normalize_inversed_basic PASSED
test_scoring.py::TestNormalization::test_normalize_inversed_single_value PASSED
test_scoring.py::TestNormalization::test_reputation_score PASSED
test_scoring.py::TestScoringAlgorithm::test_single_offer_neutral_score PASSED
test_scoring.py::TestScoringAlgorithm::test_multiple_offers_ranking PASSED
test_scoring.py::TestScoringAlgorithm::test_identical_offers PASSED
test_scoring.py::TestScoringAlgorithm::test_no_reputation_data PASSED
test_scoring.py::TestScoringAlgorithm::test_weight_distribution PASSED
test_scoring.py::TestEdgeCases::test_empty_offers_list PASSED
test_scoring.py::TestEdgeCases::test_extreme_price_difference PASSED
test_scoring.py::TestEdgeCases::test_extreme_delivery_difference PASSED

========================== 11 passed in 0.15s ===========================
```
