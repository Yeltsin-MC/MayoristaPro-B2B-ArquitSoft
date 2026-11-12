## Verificacion dirigida de las correcciones de integracion

Las correcciones incluyen el prefijo REST unico, autorizacion exclusiva del comprador,
campos camelCase de T4, reputacion mediante DATABASE_URL y conservacion de importes
cuando FastAPI devuelve puntuaciones o no esta disponible. La consulta PostgreSQL
esta en el adaptador de infraestructura. El controlador delega en aplicacion.

Se preparo `tests/ai.integration.cjs` con ocho comprobaciones mas la suite contenedora.
Cubre catalogo HTTP, login mediante el fixture, rutas, contrato, permisos, revocacion,
historial pagado real, ausencia de historial, degradacion y respuestas incompatibles.
La ultima comprobacion usa FastAPI real solo si se configura T6_AI_URL.

Resultado del 12/11/2026 con PostgreSQL y FastAPI real en 5055, nueve resultados aprobados y cero omitidos. Las compilaciones Angular y NestJS completaron correctamente. Se conserva la evidencia previa de Kiro de 11 pruebas Python. Ver [evidencia de demo](../../../../docs/evidencias/demo-mayorista.md).

Desde la raiz del repositorio, con PostgreSQL disponible y FastAPI en 5055

```powershell
npm run build -w @mayoristapro/api
$env:T6_AI_URL = 'http://127.0.0.1:5055'
node --env-file=.env --test --test-concurrency=1 tests/ai.integration.cjs
Remove-Item Env:T6_AI_URL
```

El fixture crea un esquema PostgreSQL temporal, inicia NestJS en un puerto aleatorio
y elimina el esquema al terminar. No usa las cuentas ni los pedidos de la demo.
Se esperan nueve resultados aprobados y cero omitidos cuando FastAPI esta disponible.
Sin T6_AI_URL, la comprobacion real se omite y las otras siete permanecen activas.

---

# Tests de Integración para T6 - IA de Comparación de Proveedores

Este documento describe los tests de integración para validar el módulo de scoring de ofertas.

## T6-01: Endpoint de Scoring Funcional

**Objetivo**: Verificar que el endpoint `/api/v1/quotations/:id/score-offers` funciona correctamente.

**Precondiciones**:
- Usuario autenticado como comprador
- Cotización existente con múltiples ofertas
- Servicio Python FastAPI corriendo en localhost:5000

**Pasos**:
1. Crear cotización con 3 proveedores
2. Recibir 3 ofertas con precios diferentes (1000, 1500, 2000)
3. Llamar a `POST /api/v1/quotations/:id/score-offers` con token de comprador
4. Verificar response con `scored_offers` y `ai_service_available: true`
5. Verificar que cada oferta tiene `score` (0-100) y `breakdown` con 3 componentes

**Resultado esperado**:
```json
{
  "quotation_id": "uuid",
  "scored_offers": [
    {
      "offer_id": "uuid",
      "supplier_id": "uuid",
      "supplier_name": "Proveedor 1",
      "total": 1000,
      "delivery_days": 5,
      "score": 78.5,
      "breakdown": {
        "price_score": 100,
        "delivery_score": 50,
        "reputation_score": 50
      }
    },
    ...
  ],
  "ai_service_available": true
}
```

## T6-02: Autorización por Compañía

**Objetivo**: Verificar que solo el comprador puede puntuar sus propias cotizaciones.

**Pasos**:
1. Usuario A crea cotización
2. Usuario B (proveedor) intenta llamar `POST /api/v1/quotations/:id/score-offers`
3. Verificar error 403 o 409 con código `NOT_AUTHORIZED`

**Resultado esperado**: Error de autorización, no se permite acceso.

## T6-03: Degradación Elegante sin Servicio Python

**Objetivo**: Verificar que el sistema continúa funcionando si FastAPI no está disponible.

**Precondiciones**:
- Servicio Python FastAPI detenido

**Pasos**:
1. Detener servicio FastAPI (puerto 5000)
2. Llamar a `POST /api/v1/quotations/:id/score-offers`
3. Verificar que retorna ofertas con `score: null`
4. Verificar `ai_service_available: false`

**Resultado esperado**:
```json
{
  "quotation_id": "uuid",
  "scored_offers": [
    {
      "offer_id": "uuid",
      "score": null,
      "breakdown": {
        "price_score": null,
        "delivery_score": null,
        "reputation_score": null
      }
    }
  ],
  "ai_service_available": false
}
```

## T6-04: Cálculo de Reputación desde PostgreSQL

**Objetivo**: Verificar que la reputación se calcula correctamente desde órdenes pagadas.

**Pasos**:
1. Proveedor A: 8 órdenes pagadas de 10 totales
2. Proveedor B: 0 órdenes (sin historial)
3. Proveedor C: 10 órdenes pagadas de 10 totales
4. Crear cotización con ofertas de A, B, C
5. Puntuar ofertas
6. Verificar:
   - Proveedor A: `reputation_score ≈ 80`
   - Proveedor B: `reputation_score = 50` (neutral)
   - Proveedor C: `reputation_score = 100`

**Resultado esperado**: Reputación basada en datos reales de la tabla `trade_orders`.

## T6-05: Regresión T1-T5

**Objetivo**: Verificar que T6 no afecta funcionalidades previas.

**Pasos**:
1. Importar catálogo desde Excel/CSV (T1)
2. Verificar productos importados aparecen en `/api/v1/catalog/products`
3. Crear cotización (T2/T3)
4. Responder con oferta (T2/T3)
5. Aceptar oferta y crear pedido (T2/T3)
6. Verificar stock reservado (T3)
7. Iniciar pago con Mercado Pago (T4/T5)
8. Verificar webhook recibido (T5)
9. Verificar orden cambia a `paid` (T5)
10. Verificar stock descontado (T3+T5)

**Resultado esperado**: Todas las funcionalidades de T1-T5 continúan funcionando sin cambios.

## Comandos de Ejecución

### Iniciar servicios
```powershell
# Terminal 1: Backend NestJS
cd apps\api
npm run dev

# Terminal 2: Frontend Angular
cd apps\web
npm start

# Terminal 3: Servicio Python FastAPI
cd apps\ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000
```

### Ejecutar tests Python
```powershell
cd apps\ai-service
pytest test_scoring.py -v
```

### Tests manuales
1. Abrir navegador en `http://localhost:4200`
2. Autenticarse como comprador
3. Crear nueva cotización
4. Esperar ofertas de proveedores
5. Click en "Calcular puntuación IA"
6. Verificar columna de scores y tooltips
7. Marcar checkbox "Ordenar por puntuación"
8. Verificar reordenamiento visual

## Criterios de Aceptación

- ✅ Endpoint funciona con servicio Python disponible
- ✅ Endpoint funciona con servicio Python no disponible (degradación)
- ✅ Solo comprador autorizado puede puntuar
- ✅ Reputación se calcula desde PostgreSQL
- ✅ Frontend muestra scores con breakdown
- ✅ Ordenamiento opcional por score funciona
- ✅ T1-T5 no se ven afectados
- ✅ Tests unitarios Python pasan 100%
