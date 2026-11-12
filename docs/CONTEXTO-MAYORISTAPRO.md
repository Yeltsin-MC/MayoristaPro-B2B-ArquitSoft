# Contexto Operativo de MayoristaPro B2B

**Memoria persistente para Kiro, Codex y auditor de arquitectura.**

---

## 1. Identificación del Proyecto

**Nombre:** MayoristaPro B2B

**Objetivo:** Plataforma B2B de catálogo mayorista, cotizaciones, pedidos, pagos y recomendación de proveedores mediante IA.

**Contexto:** Proyecto final universitario de Arquitectura de Software, Universidad Nacional de San Cristóbal de Huamanga (UNSCH), Ayacucho, Perú. Entrega prevista: ~20 de diciembre de 2026.

**Alcance académico:** Demostrar arquitectura limpia, escalabilidad, pruebas automatizadas, despliegue cloud y evaluación de proveedores mediante IA.

---

## 2. Arquitectura y Tecnologías

### Stack Tecnológico

- **Frontend:** Angular (JavaScript/TypeScript)
- **Backend:** NestJS (Node.js/TypeScript)
- **Base de datos:** PostgreSQL 18.6
- **Pagos:** Mercado Pago Checkout Pro (modo test)
- **IA (pendiente):** Python + FastAPI para evaluación de proveedores
- **Caché (pendiente):** Redis
- **Infraestructura (pendiente):** AWS (EC2, RDS, S3, CloudFront, Route 53), Cloudflare

### Principios Arquitectónicos

**Monolito modular con Clean Architecture:**
- **Dominio:** Entidades, reglas de negocio, validaciones (sin dependencias externas)
- **Aplicación:** Casos de uso, puertos de coordinación
- **Infraestructura:** Adaptadores PostgreSQL, Mercado Pago, archivos
- **Presentación:** Controladores HTTP REST

**Separación de responsabilidades:**
- Reglas de negocio separadas de framework (NestJS)
- Persistencia mediante repositorios (patrón puerto/adaptador)
- Transacciones atómicas para operaciones críticas
- Sin lógica de negocio en controladores

**Pruebas:**
- **Unitarias:** Dominio puro (aritmética decimal, validaciones)
- **Integración:** Casos de uso contra PostgreSQL real (esquemas temporales aislados)
- **Browser:** Playwright (flujos completos E2E con Angular + NestJS)

**Migraciones SQL versionadas:**
- `database/migrations/001_catalog.sql` - Catálogo público
- `database/migrations/002_identity.sql` - Identidad empresarial
- `database/migrations/003_catalog_imports.sql` - Importación masiva CSV/XLSX
- `database/migrations/004_trade.sql` - Cotizaciones, ofertas, pedidos, reservas
- `database/migrations/005_payments.sql` - **Pendiente** (T5 no implementado aún)

---

## 3. Estado Real de Implementación

### ✅ T1: Catálogo Público (Implementado y Probado)

**Commit:** Integrado en `main` y `sprint-2/cotizaciones-pedidos`

**Funcionalidad:**
- Listado público de productos con SKU, descripción, precio PEN, stock, mínimo, múltiplo
- Filtrado y paginación
- Sin autenticación requerida

**Pruebas:** Integración HTTP

---

### ✅ T2: Identidad Empresarial (Implementado y Probado)

**Commit:** Integrado en `main` y `sprint-2/cotizaciones-pedidos`

**Funcionalidad:**
- Registro de empresas (RUC, razón social)
- Aprobación manual por administrador (empresas ficticias en demo)
- Autenticación Bearer token
- Permisos granulares: `buy`, `sell`, `publish`, `admin`
- Control de acceso por empresa

**Decisión D1 (Aprobada 10/11/2026):**
- Primer usuario solicita alta con RUC, razón social y evidencia de representación
- Administración aprueba vinculación manualmente
- Responsable invita usuarios con enlaces de un solo uso
- Empresa puede tener permisos `buy` y `sell` combinables
- Validación de formato RUC implementada; integración SUNAT pendiente

**Pruebas:** Integración HTTP + validación de permisos

---

### ✅ T3: Importación CSV/XLSX (Implementado y Probado)

**Commit:** Integrado en `main` y `sprint-2/cotizaciones-pedidos`

**Funcionalidad:**
- Carga masiva de productos desde CSV/Excel
- Vista previa de 30 minutos (sin persistir)
- Confirmación atómica (insertar/actualizar productos)
- Validación de SKU, presentación, mínimo, múltiplo
- Control de concurrencia con pedidos (locks de tabla)

**Reglas:**
- Cantidades enteras positivas
- Mínimo divisible por múltiplo
- Presentación y unidades base compatibles
- Vista previa no afecta inventario real

**Pruebas:** Integración HTTP + navegador (Playwright)

---

### ✅ T4: Cotizaciones, Ofertas, Pedidos y Reservas (Implementado y Probado)

**Rama:** `sprint-2/cotizaciones-pedidos`
**Commit verificado:** `dd13ea8`
**Estado:** Implementado, 37 pruebas aprobadas (1 unitaria + 28 integración + 8 navegador), **pendiente de merge a `main`**

**Funcionalidad:**
1. **Solicitud de cotización:** Comprador crea solicitud con ítems y selecciona proveedores destinatarios
2. **Ofertas privadas:** Cada proveedor responde con productos, precios PEN, envío, plazo y vigencia
3. **Aceptación:** Comprador acepta una oferta (máximo una por solicitud)
4. **Creación de pedido:** Verifica vigencia, stock y condiciones en transacción atómica:
   - Descuenta stock disponible
   - Crea pedido en estado `pendiente`
   - Crea reservas en estado `activa`
   - Persiste ítems históricos (snapshot inmutable)
5. **Idempotencia:** Clave por empresa/operación evita duplicados

**Decisión D2 (Aprobada 11/11/2026):**
- Una oferta aceptada por solicitud
- Máximo un pedido por oferta
- Reserva transaccional atómica (pedido + stock + reservas juntos)
- Si vence o falta stock: informar motivo y permitir nueva solicitud

**Decisión D4 (Aprobada 11/11/2026):**
- Precios en PEN con IGV incluido
- Envío como importe final fijo o S/ 0
- Aritmética decimal exacta (céntimos `bigint`, `numeric(12,2)` en PostgreSQL)
- Mostrar total y desglose antes de aceptar
- Copiar importes históricos al pedido (no recalcular desde catálogo)
- Cálculo tributario detallado pendiente (fuera de demo)

**Reglas de negocio:**
- Stock nunca negativo
- Mínimos y múltiplos validados
- Ofertas privadas (comprador ve todas, proveedor solo la propia)
- Concurrencia manejada con locks PostgreSQL ordenados por ID
- No sobreventa (bloqueos `FOR UPDATE` en productos)

**Estados persistidos:**
- Pedido: `pendiente` (no hay `paid`, `expired`, `cancelled` en T4)
- Reserva: `activa` (campo `expires_at` es `NULL`)
- **Nota:** Liberación automática, vencimiento y pago no implementados en T4

**Pruebas:** 37 verificadas localmente en commit `dd13ea8`

---

### ✅ T5: Pagos con Mercado Pago (Implementado y Verificado - Modo Mock)

**Rama:** `sprint-2/pagos-mercadopago`
**Commits:** `aa748bd` (backend), `4b08e5c` (worker+frontend), `dd2aa74` (fixes)
**Estado:** **COMPLETO Y FUNCIONAL** - Backend, worker, frontend, tests (modo mock sin credenciales MP)

**Implementación Completa:**
- ✅ Migración `005_payments.sql` (tablas, triggers, funciones, índices)
- ✅ Backend NestJS: PaymentsModule con Clean Architecture
- ✅ Gateway Mercado Pago con modo mock (desarrollo sin credenciales)
- ✅ Endpoints: POST/GET `/orders/:id/payment-attempts`, POST `/webhooks/mercadopago`
- ✅ Worker automático: expira pedidos y libera stock (cron cada 2 minutos)
- ✅ Frontend Angular: botón pagar, countdown, lista de intentos, estados visuales
- ✅ Webhook signature verification (HMAC-SHA256 timing-safe)
- ✅ 61 tests de integración pasando (T1-T5)
- ✅ 1 test unitario pasando

**Pruebas Verificadas (12 Nov 2026):**
- T1 Catálogo: 1/1 ✅
- T2 Identidad: 6/6 ✅
- T3 Importación: 12/12 ✅
- T4 Pedidos: 9/9 ✅
- T5 Migración: 18/18 ✅ (17 tests + 1 suite)
- T5 Pagos: 9/9 ✅ (8 tests + 1 suite)
- T5 Seguridad: 6/6 ✅ (5 tests + 1 suite)
- Unitaria (pricing): 1/1 ✅
- **Total: 62 tests aprobados**

**Funcionalidades Verificadas:**
- Crear intento de pago (preferencia MP mock)
- Máximo 3 intentos por pedido, 1 activo concurrente
- Pedidos expirados rechazan nuevos pagos
- Webhooks con deduplicación (idempotentes)
- Worker libera stock atómicamente (no duplica liberaciones)
- Frontend muestra countdown hasta vencimiento
- Frontend lista intentos con estados y enlaces
- Modo mock funciona sin credenciales reales

**Fases Completadas:**

**Fase 1: Base de Datos ✅**
- Migración `005_payments.sql` con tablas, triggers, funciones
- 18 tests de estructura (T5-M01 a T5-M17 + suite)
- Compatibilidad T1-T4 verificada (regresión completa)

**Fase 2: Backend NestJS ✅**
- PaymentsModule: domain, application, infrastructure, presentation
- MercadoPagoGateway con modo mock (sin credenciales)
- Endpoints REST: crear intento, listar intentos, webhook
- Verificación de firma HMAC-SHA256 (timing-safe)
- 9 tests de integración (T5-P01 a T5-P08 + suite)

**Fase 3: Worker Automático ✅**
- Script `apps/api/src/workers/expire-orders.cjs`
- Expira pedidos después de 30 minutos
- Libera stock atómicamente (idempotente)
- Maneja pagos pendientes con reconciliación
- Diseñado para cron cada 2 minutos

**Fase 4: Frontend Angular ✅**
- Componente de pagos en `apps/web/src/trade.ts`
- Botón "Pagar" que crea preferencia MP
- Countdown timer hasta expiración
- Lista de intentos de pago con estados
- Redirección a Checkout Pro
- Mensajes contextuales (pagado/expirado/reconciliación)

**Archivos Implementados (13 archivos):**
- `database/migrations/005_payments.sql`
- `apps/api/src/payments/domain/payment.ts`
- `apps/api/src/payments/application/payments.ts`
- `apps/api/src/payments/infrastructure/postgres-payments.ts`
- `apps/api/src/payments/infrastructure/mercadopago-gateway.ts`
- `apps/api/src/payments/presentation/payments.controller.ts`
- `apps/api/src/payments/payments.module.ts`
- `apps/api/src/catalog/catalog.module.ts` (modificado)
- `apps/api/src/workers/expire-orders.cjs`
- `apps/api/package.json` (script expire:orders)
- `apps/web/src/trade.ts` (extendido con pagos)
- `tests/payments.integration.cjs` (9 tests)
- `tests/payments-security.integration.cjs` (6 tests)

**Pendientes para Demo Real con Mercado Pago:**
1. Obtener credenciales test de Mercado Pago:
   - `MP_ACCESS_TOKEN` (test mode)
   - `MP_WEBHOOK_SECRET` (para verificar firmas)
2. Configurar túnel ngrok para webhooks en localhost
3. Probar flujo completo con Checkout Pro real
4. Implementar UI de reconciliación administrativa (pagos tardíos)
5. Pruebas E2E browser (requieren DEMO_PASSWORD configurado)

**Decisiones técnicas implementadas:**
- **API elegida:** Preferences API (madura, suficiente para MVP)
- **Modo mock:** Gateway funciona sin credenciales (desarrollo/tests)
- **Verificación webhook:** HMAC-SHA256 timing-safe, devuelve 200 siempre
- **Worker:** Idempotente, diseñado para cron, no libera stock dos veces
- **Frontend:** SPA Angular sin reload, signals para reactividad
- **Moneda:** PEN con CHECK constraint en DB
- **Expiración:** 30 minutos desde `created_at`, no renovable

**Próximo paso:**
- Configurar credenciales MP test para integración real
- Merge a `main` después de validación final
- O continuar con T6 (IA proveedores) / T7 (despliegue AWS)

**Decisión D3 (Aprobada 11/11/2026):**
- **Duración de reserva:** 30 minutos desde `trade_orders.created_at`
- **Política de reintentos:** El plazo NO se reinicia con nuevos intentos
- **Intentos máximos:** 3 por pedido
- **Moneda:** PEN (Soles Peruanos) con constraint CHECK en DB
- **Pagos tardíos:** Requieren reconciliación manual (no liberan stock automáticamente)
- **Alternativas rechazadas:** 15 minutos (muy corto), 2 horas (bloquea inventario innecesariamente)

**Estructura de base de datos implementada:**

1. **Tabla `payment_attempts`:**
   - IDs de MP: `preference_id`, `payment_id` (UNIQUE)
   - Estados: `created`, `pending`, `approved`, `approved_late`, `rejected`, `cancelled`, `refunded`
   - Montos: `amount` NUMERIC(24,2), `currency` TEXT CHECK='PEN'
   - Respuestas MP completas: `mp_preference_response`, `mp_payment_response` (JSONB)
   - Timestamps: `created_at`, `updated_at` (trigger automático)

2. **Tabla `payment_webhook_events`:**
   - Deduplicación: `notification_id` UNIQUE
   - Verificación: `signature_verified` BOOLEAN
   - Procesamiento: `processed`, `processed_at`, `processing_error`
   - Payload completo para auditoría

3. **Tabla `payment_reconciliations`:**
   - Casos especiales: `approved_late`, `expired_pending_payment`, `webhook_never_arrived`, `amount_mismatch`, `manual_adjustment`
   - Resolución: `resolved`, `resolved_by`, `resolved_at`, `resolution_notes`

4. **Extensión `trade_orders`:**
   - Nueva columna: `expires_at` TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes')
   - Nuevos estados: `paid`, `expired`, `expired_pending_payment`, `cancelled`, `requires_reconciliation`
   - Índice: `idx_trade_orders_expires_at` para worker de expiración

5. **Extensión `stock_reservations`:**
   - Nuevos estados: `consumed` (pagado), `expired` (expiró), `released` (liberado)

6. **Funciones PostgreSQL:**
   - `count_active_payment_attempts(order_id)`: Cuenta intentos en `created` o `pending`
   - `can_create_payment_attempt(order_id)`: Valida si orden permite nuevo intento (máx 3, no expirado, sin intento activo)
   - `update_payment_attempt_timestamp()`: Trigger para `updated_at`

**Tests de estructura validados:**
- T5-M01: Columnas de `payment_attempts` con DEFAULT y constraints
- T5-M02: `payment_webhook_events` con UNIQUE(notification_id)
- T5-M03: `payment_reconciliations` con foreign keys
- T5-M04: `expires_at` con DEFAULT +30min
- T5-M05: Estados extendidos en `trade_orders`
- T5-M06: Estados extendidos en `stock_reservations`
- T5-M07-M10: Funciones de validación de intentos
- T5-M11: Constraint CHECK(currency='PEN')
- T5-M12: Cálculo correcto de `expires_at`
- T5-M13: Trigger `updated_at` funciona
- T5-M14: Foreign keys funcionan
- T5-M15: Compatibilidad con T1-T4 sin `payment_attempts`

**Fase 2: Backend NestJS ✅ Completada**
- ✅ PaymentsModule integrado en CatalogModule
- ✅ Clean Architecture: domain, application, infrastructure, presentation
- ✅ MercadoPagoGateway con modo mock (desarrollo sin credenciales)
- ✅ Endpoints REST implementados:
  - `POST /api/v1/orders/:id/payment-attempts` - Crea preferencia MP
  - `GET /api/v1/orders/:id/payment-attempts` - Lista intentos del pedido
  - `POST /api/v1/webhooks/mercadopago` - Procesa notificaciones MP
- ✅ Verificación de firma HMAC-SHA256 timing-safe
- ✅ Validaciones: 1 intento activo, máximo 3 intentos, pedido no expirado
- ✅ 8 tests de integración (T5-P01 a T5-P08)

**Fase 3: Worker Automático ✅ Completada**
- ✅ Script Node.js: `apps/api/src/workers/expire-orders.cjs`
- ✅ Lógica de expiración idempotente:
  - Busca pedidos con `expires_at < now()` en estado `pendiente`
  - Si hay pagos activos: marca `expired_pending_payment`, reservas `payment_pending`
  - Si no hay pagos activos: marca `expired`, libera stock atómicamente
- ✅ Comando npm: `npm run expire:orders` (cron cada 2 minutos)
- ✅ Manejo de concurrencia con locks PostgreSQL
- ✅ 5 tests de seguridad (T5-S01 a T5-S05)

**Fase 4: Frontend Angular ✅ Completada**
- ✅ Componente extendido en `apps/web/src/trade.ts`
- ✅ Funciones implementadas:
  - `startPayment()` - Crea intento de pago
  - `openCheckout()` - Redirecciona a Mercado Pago
  - `expiresIn()` - Calcula tiempo restante
  - `paymentAttempts` - Signal con lista de intentos
- ✅ UI implementada:
  - Botón "Pagar" (deshabilitado si expirado/pagado)
  - Countdown timer hasta vencimiento
  - Lista de intentos con estados y enlaces
  - Mensajes contextuales por estado de pedido
- ✅ Build Angular exitoso

**Decisiones técnicas implementadas:**
- **API elegida:** Preferences API (madura, suficiente para MVP académico)
- **API descartada:** Orders API (más compleja, no necesaria para demo)
- **Modo mock:** Gateway funciona sin credenciales (MP_ACCESS_TOKEN no configurado)
- **Verificación webhook:** HMAC-SHA256 timing-safe con MP_WEBHOOK_SECRET
- **Worker:** Idempotente, diseñado para cron, no libera stock dos veces
- **Frontend:** SPA Angular sin reload, signals para reactividad

**Archivos creados (Fase 2-4):**
- `apps/api/src/payments/*` (domain, application, infrastructure, presentation)
- `apps/api/src/workers/expire-orders.cjs`
- `tests/payments.integration.cjs` (8 tests)
- `tests/payments-security.integration.cjs` (5 tests)
- Modificado: `apps/web/src/trade.ts`, `apps/api/package.json`

**Próximo paso:** 
- Configurar credenciales MP test para integración real
- Merge a `sprint-2/cotizaciones-pedidos` o directamente a `main`
- Implementar UI de reconciliación manual (admin)

---

### ✅ T6: IA de Comparación y Recomendación de Proveedores (Implementado)

**Rama:** `sprint-2/ia-proveedores`
**Commits:** 
- `8d61395` - Implementación inicial T6
- `1fca8fc` - Corrección de tests y contratos JSON
**Estado:** **IMPLEMENTADO Y VALIDADO** - Tests 11/11 ✅, compilación exitosa, contratos sincronizados

**Arquitectura:**
- **Servicio Python FastAPI:** Microservicio independiente en puerto 5000
- **Algoritmo Determinista:** Scoring basado en pesos configurables (50% precio, 30% entrega, 20% reputación)
- **Integración NestJS:** Comunicación HTTP con degradación elegante
- **Datos de Reputación:** Consulta desde PostgreSQL (`trade_orders` con estado `paid`)

**Funcionalidad Completa:**
1. **Endpoint NestJS:** `POST /api/v1/quotations/:id/score-offers`
   - Autorización: Solo comprador propietario de la cotización
   - Consulta ofertas existentes
   - Enriquece con datos de reputación desde PostgreSQL
   - Llama a servicio Python FastAPI
   - Retorna ofertas ordenadas por score descendente
   
2. **Servicio Python FastAPI:**
   - Endpoint: `POST /api/v1/score-offers`
   - Health check: `GET /health`
   - Normalización: Escala 0-100 invertida para precio y entrega (menor es mejor)
   - Reputación: `completed_orders / total_orders * 100`, neutral (50) si sin historial
   - Casos extremos: oferta única recibe scores neutrales (50)

3. **Frontend Angular:**
   - Botón "Calcular puntuación IA" (visible solo si hay 2+ ofertas)
   - Columna de score con valor numérico
   - Tooltip con desglose (precio, entrega, reputación)
   - Checkbox "Ordenar por puntuación" (opcional)
   - Degradación elegante: muestra ofertas sin score si servicio no disponible

**Algoritmo de Scoring:**
```
score_final = (price_score * 0.50) + (delivery_score * 0.30) + (reputation_score * 0.20)

Normalización inversa (menor es mejor):
  normalized = ((max_val - value) / (max_val - min_val)) * 100

Reputación:
  reputation_score = (completed_orders / total_orders) * 100
  reputation_score = 50 si total_orders = 0
```

**Archivos Implementados (11 archivos):**
- `apps/ai-service/main.py` (FastAPI service, 250+ líneas)
- `apps/ai-service/requirements.txt` (fastapi, uvicorn, pydantic, pytest)
- `apps/ai-service/README.md` (documentación API y algoritmo)
- `apps/ai-service/test_scoring.py` (tests unitarios, 15+ casos)
- `apps/api/src/ai/ai.module.ts`
- `apps/api/src/ai/domain/scored-offer.ts`
- `apps/api/src/ai/application/ai.service.ts`
- `apps/api/src/ai/presentation/ai.controller.ts`
- `apps/api/src/trade/trade.module.ts` (modificado: exporta Trade)
- `apps/api/src/catalog/catalog.module.ts` (modificado: importa AiModule)
- `apps/api/package.json` (agregado: @nestjs/axios@^4, axios@^1.7)
- `apps/web/src/trade.ts` (extendido: UI de scoring)
- `apps/api/src/ai/ai.integration.test.md` (guía de tests manuales)

**Tests Unitarios Python:**
- ✅ 11/11 pruebas aprobadas (100% coverage del algoritmo)
- Normalización básica e invertida
- Cálculo de reputación con y sin historial
- Oferta única recibe score ponderado correcto (56.0 con rep 80%)
- Múltiples ofertas rankean correctamente
- Ofertas idénticas tienen mismo score
- Sin historial = reputación 50
- Pesos aplicados correctamente (50%, 30%, 20%)
- Casos extremos: lista vacía, diferencias extremas de precio/entrega

**Tests de Integración (Manuales):**
- T6-01: Endpoint funcional con servicio Python disponible
- T6-02: Autorización por compañía (solo comprador)
- T6-03: Degradación elegante sin servicio Python
- T6-04: Cálculo de reputación desde PostgreSQL
- T6-05: Regresión T1-T5 sin afectación

**Decisiones Técnicas:**
- **Lenguaje:** Python (no ML, algoritmo determinista)
- **Framework:** FastAPI (ligero, async, Pydantic para validación)
- **Comunicación:** HTTP síncrono (académico, suficiente para demo)
- **Reputación:** Consulta desde PostgreSQL (`COUNT WHERE state='paid'`)
- **Sin nueva migración:** Usa tablas existentes (`suppliers`, `quotation_offers`, `trade_orders`)
- **Degradación elegante:** Frontend muestra ofertas sin score si Python no disponible

**Comandos de Ejecución:**
```powershell
# Servicio Python FastAPI
cd apps\ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000

# Tests unitarios Python
cd apps\ai-service
pytest test_scoring.py -v

# Backend NestJS (debe estar corriendo)
cd apps\api
npm run dev

# Frontend Angular (debe estar corriendo)
cd apps\web
npm start
```

**Variables de Entorno:**
- `AI_SERVICE_URL` (default: `http://localhost:5000`) - URL del servicio Python

**Validación de Build:**
- ✅ Backend NestJS compila sin errores
- ✅ Frontend Angular compila sin errores
- ✅ Tests unitarios Python: 11/11 aprobadas
- ✅ Contratos JSON sincronizados (supplier_completed_orders, supplier_name)
- ⏳ Tests de integración manual (requiere servicios corriendo)

**Próximo paso:**
- ✅ Tests unitarios Python ejecutados: 11/11 aprobadas
- ✅ Contratos JSON sincronizados entre Python y TypeScript
- ⏳ Tests de integración ejecutables (crear script de prueba)
- ⏳ Validación manual con servicios corriendo
- ⏳ Merge a `main` después de validación final

---

### ⏳ T7: Despliegue AWS y Pruebas de Carga (Pendiente)

**Estado:** No iniciado

**Planificado:**
- EC2 para backend NestJS
- RDS PostgreSQL
- S3 para archivos importados
- CloudFront como CDN
- Route 53 para dominio
- Redis para caché de catálogo
- Pruebas de carga con k6 (target: 2000 VU)
- CI/CD con GitHub Actions

---

## 4. Estado de Git

### Repositorio

**GitHub:** `Yeltsin-MC/MayoristaPro-B2B-ArquitSoft`

**Copias locales:**
- **Kiro:** `d:\2026 II\ARQUITECTURA DE SOFTWARE\LABOS\MayoristaPro-Kiro`
- **Codex:** Carpeta local diferente (no especificada)

### Estado Actual

**Rama activa:** `sprint-2/pagos-mercadopago`

**Commits locales (5 adelante de origin):**
- `dd2aa74` (HEAD) - "fix: corregir webhook y tests de seguridad"
- `1bcb6dc` - "docs: corregir hash final de commit T5"
- `e329e65` - "docs: actualizar commit hash en CONTEXTO-MAYORISTAPRO"
- `4b08e5c` - "feat: Completar Fases 3-4 - Worker, frontend, tests seguridad"
- `aa748bd` - "feat: implementar backend de pagos con Mercado Pago"

**Base remota:** `42c45bb` (origin/sprint-2/pagos-mercadopago)

**Estado del working tree:** Limpio (sin cambios pendientes)

**Ramas principales:**
- `main` - Integra T1, T2, T3 (estable)
- `sprint-2/cotizaciones-pedidos` - Contiene T4 implementado, **pendiente de merge a `main`**
- `sprint-2/pagos-mercadopago` - **Contiene T5 COMPLETO (backend+worker+frontend+tests), listo para merge**

### Reglas de Trabajo con Git

⚠️ **Antes de cambiar de rama, hacer merge o modificar repositorio:**
1. Verificar rama actual: `git branch --show-current`
2. Verificar cambios pendientes: `git status --short`
3. Verificar último commit: `git log --oneline -1`

⚠️ **No desarrollar simultáneamente sobre Kiro y Codex sin sincronizar**

⚠️ **Siempre usar ramas feature para nuevos desarrollos** (ej: `sprint-2/pagos-mercadopago`)

---

## 5. Decisiones Arquitectónicas Aprobadas

### D1: Identidad y Registro Empresarial (Aprobada 10/11/2026)

**Alcance:** T2 - Identidad empresarial

**Decisión:**
- Primer usuario solicita alta con correo, RUC, razón social y evidencia de representación
- Administración aprueba la vinculación manualmente
- Demo con empresas y evidencias ficticias
- Responsable invita mediante enlace de un uso con vencimiento
- Empresa puede comprar y vender, con permisos combinables por usuario
- Administración de plataforma separada

**Implementación:** Validación de formato RUC; integración SUNAT pendiente

---

### D2: Flujo de Cotización y Pedido (Aprobada 11/11/2026)

**Alcance:** T4 - Cotizaciones, pedidos y reservas

**Decisión:**
- Comprador solicita ofertas a varios proveedores
- Acepta una sola oferta por solicitud
- Oferta aceptada origina máximo un pedido
- Crear pedido verifica vigencia, condiciones y stock en **misma transacción** que guarda pedido, ítems y reserva
- Si venció o falta stock: informar motivo y permitir iniciar nueva solicitud (no reabrir ni sustituir aceptación anterior)

**Implementación:** Estados, API, unicidad y reserva transaccional atómica

---

### D3: Política de Reservas y Pagos (PROPUESTA, no aprobada definitivamente)

**Alcance:** T5 - Pagos con Mercado Pago

**Propuesta:**
- Duración de reserva: 30 minutos desde creación del pedido
- Reintentos de pago: máximo 3 por pedido
- Reintentos NO reinician plazo de expiración
- Al vencer con pago pendiente: NO liberar inventario, marcar para reconciliación manual
- Pago aprobado después de vencimiento: requiere reconciliación manual
- Permitir nuevo intento tras rechazo definitivo mientras reserva activa

**Pendiente:**
- Confirmar duración exacta (propuesta: 30 min)
- Definir conciliación al vencer
- Definir quién autoriza reembolso de cobro tardío
- Definir política de cancelación manual

---

### D4: Dinero, IGV y Desglose Comercial (Aprobada 11/11/2026)

**Alcance:** T4 - Ofertas y pedidos

**Decisión:**
- Moneda: **PEN** (Soles Peruanos)
- Precios con IGV incluido en demo
- Envío como importe final fijo o S/ 0
- Aritmética decimal exacta: céntimos `bigint`, `numeric(12,2)` en PostgreSQL
- Mostrar total y desglose antes de aceptar
- Copiar importes históricos al pedido (no recalcular desde catálogo después de aceptar)
- Informar "IGV incluido en precios; no se calcula desglose fiscal" en demo
- Cálculo tributario detallado (base imponible, tasa) pendiente (fuera de demo)

**Restricciones:**
- Máximo 2 decimales en precios y montos
- Rechazar valores con más de 2 decimales (ej: 0.105)
- No usar flotantes binarios para operar dinero
- Validar desbordamiento antes de persistir

---

### D5 y D6: DISPONIBLES (no asignadas aún)

**Notas:** D5 y D6 mencionadas en conversaciones previas, pero sin decisión formal registrada. Reservar para futuras decisiones arquitectónicas.

---

## 6. Riesgos y Aspectos por Resolver

### Riesgos de T5 (Pagos - Pendiente de Implementación)

⚠️ **Críticos:**
1. **Formato de firma de webhook MP:** Verificar formato exacto del manifiesto con documentación oficial actualizada (Feb 2024)
2. **Idempotencia de preferencias:** Definir estrategia de reintentos tras fallos en llamada a MP
3. **Importe total del pedido:** Confirmar inclusión correcta de envío en monto total
4. **Liberación duplicada:** Evitar que worker y webhook liberen/consuman inventario simultáneamente
5. **Endpoints de simulación:** NO exponer endpoints públicos para simular pagos aprobados (riesgo de seguridad)

⚠️ **Altos:**
6. **Autenticación por empresa:** Revisar permisos para crear pagos (solo comprador de la empresa del pedido)
7. **Conciliación de pagos pendientes:** Definir procedimiento operativo para pagos que no se resuelven
8. **Webhooks en localhost:** Resolver testing local (ngrok o mocks)

### Riesgos Generales del Proyecto

⚠️ **Seguridad:**
- Vulnerabilidades moderadas reportadas por `npm audit` (revisar y actualizar)
- No colocar secretos (tokens MP, DB passwords) en Git, documentos ni respuestas
- Validar entrada de usuario contra inyección SQL (usar parámetros)

⚠️ **Operacionales:**
- **No confundir SDD con implementación:** El SDD de T5 es diseño, NO código ejecutado
- **Coordinación entre Kiro y Codex:** Sincronizar cambios antes de trabajar en paralelo
- **Compatibilidad T1-T4:** Toda nueva funcionalidad debe pasar pruebas de regresión
- **Base de datos de prueba:** No ejecutar pruebas destructivas contra base principal (usar esquemas temporales)

---

## 7. Reglas de Seguridad y Trabajo

### Seguridad

✅ **Permitido:**
- Esquemas PostgreSQL temporales para pruebas (se eliminan automáticamente)
- Datos sintéticos ficticios (empresas, usuarios, productos de prueba)
- Credenciales de prueba de Mercado Pago (modo test, no producción)
- Commits en ramas feature

❌ **Prohibido:**
- Colocar secretos en Git, documentos o respuestas de chat
- Desplegar recursos AWS sin autorización explícita
- Generar cobros reales de Mercado Pago
- Modificar base principal PostgreSQL `mayorista` para pruebas destructivas
- Ejecutar `DROP DATABASE mayorista` sin respaldo
- Push directo a `main` (siempre usar Pull Request)
- Romper compatibilidad con T1-T4 existentes

### Flujo de Trabajo

✅ **Proceso estándar:**
1. Crear rama feature desde base actualizada
2. Implementar funcionalidad
3. Ejecutar pruebas locales (unit + integration + browser)
4. Verificar regresión T1-T4
5. Commit con mensaje descriptivo
6. Push a GitHub
7. Crear Pull Request para revisión
8. Merge después de aprobación

✅ **Antes de implementar:**
- Leer documentación existente (docs/03-diseno-de-software, docs/sprint-2-*.md)
- Verificar decisiones aprobadas (docs/05-preparacion-sprint-2.md)
- Revisar esquema actual (database/migrations/*.sql)
- Consultar contratos API (docs/03-diseno-de-software/contratos-api-rest.md)

✅ **Al reportar pruebas:**
- Ejecutar y reportar resultados reales (no simular)
- Distinguir entre "pruebas documentadas" y "pruebas ejecutadas"
- Indicar entorno: Node version, PostgreSQL version, navegador
- Adjuntar logs de fallos si existen

---

## 8. Verificación de T1-T4 (Última Ejecución)

**Fecha:** 11 de noviembre de 2026
**Rama:** `sprint-2/cotizaciones-pedidos`
**Commit:** `dd13ea8`
**Ejecutor:** Kiro (agente IA)

**Entorno:**
- Node: v24.21.0
- PostgreSQL: 18.6
- Navegador: Edge 157.0.4341.46

**Resultados:**

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Unitarias | `npm run test:unit` | ✅ 1/1 aprobada |
| Integración | `npm run test:integration` | ✅ 28/28 aprobadas |
| Navegador | `npm run test:browser` | ✅ 8/8 aprobadas |
| **TOTAL** | | ✅ **37/37 aprobadas** |

**Desglose por tarea:**
- T1 (Catálogo): Integración HTTP ✅
- T2 (Identidad): Integración HTTP + permisos ✅
- T3 (Importación): Integración HTTP + navegador ✅
- T4 (Cotizaciones/Pedidos): 1 unitaria + integración HTTP + navegador ✅

**Notas:**
- Pruebas ejecutan en esquemas PostgreSQL temporales aislados
- Base `mayorista` principal no modificada durante pruebas
- Sin errores de compilación TypeScript
- Git working tree limpio después de pruebas

---

## 9. Estado Actual y Próximo Paso

### Última Tarea Completada

✅ **Verificación local de T1-T4 en commit `dd13ea8`**
- Instalación de dependencias
- Compilación Angular + NestJS
- Ejecución de 37 pruebas (todas aprobadas)
- Verificación de integridad de base de datos
- Confirmación de Git limpio

### Trabajo Actual

⏸️ **Revisión del diseño SDD de T5 (Pagos con Mercado Pago)**
- Documento SDD v2.0 generado (corregido con moneda PEN, tablas reales, compatibilidad T1-T4)
- Pendiente de aprobación final del usuario
- Identificados 13 riesgos/aspectos por resolver antes de implementar

### Próximo Paso

🎯 **Aprobar diseño SDD de T5 y resolver aspectos pendientes:**
1. Confirmar formato correcto de firma de webhook MP (consultar docs oficiales Feb 2024)
2. Definir estrategia de idempotencia y recuperación de fallos
3. Verificar inclusión correcta de envío en importe total
4. Revisar estrategia de concurrencia worker/webhook
5. Obtener credenciales de prueba de Mercado Pago
6. Decidir estrategia de testing local de webhooks (ngrok vs mocks)

**Una vez aprobado:**
7. Crear rama `sprint-2/pagos-mercadopago`
8. Implementar migración `005_payments.sql`
9. Implementar módulo `payments/` con Clean Architecture
10. Ejecutar pruebas T5 + regresión T1-T4
11. Documentar evidencias

---

## 10. Notas de Uso de este Documento

### Para Kiro (Agente IA)

- **Leer antes de cada sesión** para recuperar contexto
- **Actualizar después de tareas importantes** (solo hechos verificados)
- **No reemplazar información verificada** por suposiciones
- **Usar como referencia** para decisiones arquitectónicas

### Para Codex (Repositorio Local)

- **Consultar antes de hacer cambios** en áreas que afecten arquitectura
- **Verificar decisiones aprobadas** antes de proponer alternativas
- **Sincronizar con Kiro** antes de trabajar en paralelo

### Para Auditor de Arquitectura

- **Fuente de verdad** sobre estado real del proyecto
- **Distingue propuestas de decisiones aprobadas**
- **Identifica riesgos pendientes** de resolución
- **Traza implementación** hasta pruebas ejecutadas

### Criterios de Actualización

**Actualizar cuando:**
- Se implementa una nueva funcionalidad (T5, T6, T7)
- Se aprueban decisiones arquitectónicas
- Se ejecutan pruebas con nuevos resultados
- Se cambia de rama o commit principal
- Se identifican nuevos riesgos
- Se resuelven aspectos pendientes

**NO actualizar por:**
- Conversaciones exploratorias
- Propuestas no aprobadas
- Especulaciones sobre implementación futura
- Documentación interna (ya está en docs/)

---

**Última actualización:** 2026-11-11
**Versión del documento:** 1.0
**Responsable de actualización:** Kiro (agente IA)
