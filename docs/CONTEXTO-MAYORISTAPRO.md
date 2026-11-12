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

### ⏸️ T5: Pagos con Mercado Pago (NO Implementado)

**Estado actual:** Diseño (SDD) en revisión, **pendiente de correcciones y aprobación**

**Rama:** Sin rama aún (se creará `sprint-2/pagos-mercadopago`)

**Propuesta de diseño (no aprobada definitivamente):**
- Integrar Mercado Pago Checkout Pro (Preferences API) en modo test
- Moneda: PEN (Soles Peruanos)
- Reservas con vencimiento de 30 minutos desde creación del pedido
- Máximo 3 intentos de pago por pedido
- Webhooks con verificación de firma HMAC-SHA256
- **Nunca llamadas HTTP externas dentro de transacciones PostgreSQL**
- Reconciliación manual de pagos tardíos o pendientes al vencer
- Worker cron para liberar reservas expiradas (cada 2 minutos)

**Decisiones pendientes:**
- Confirmar formato correcto del manifiesto de firma MP
- Resolver idempotencia de creación de preferencias
- Definir política de reintentos y recuperación de fallos
- Verificar inclusión de envío en importe total
- Evitar liberación duplicada de inventario
- Revisar permisos por empresa compradora

**Riesgos identificados:**
- SDD de T5 contiene propuestas, NO implementación real
- No confundir diseño documentado con código ejecutado
- Migración `005_payments.sql` diseñada pero NO aplicada
- Credenciales MP test pendientes de obtención
- Webhooks en localhost requieren ngrok o simulación

**Próximo paso:** Corregir riesgos restantes y aprobar diseño antes de implementar

---

### ⏳ T6: IA de Comparación/Recomendación (Pendiente)

**Estado:** No iniciado

**Propuesta:**
- Proceso Python + FastAPI separado
- Evaluar ofertas de la misma solicitud
- Comparar precios, plazos, reputación
- Ordenar por relevancia para el comprador

**Pendiente:** Definir modelo de datos, scoring, y comunicación backend↔Python

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

**Rama activa:** `sprint-2/cotizaciones-pedidos`

**Último commit:** `dd13ea8` - "wip: respaldar avances de cotizaciones pedidos y pruebas"

**Estado del working tree:** Limpio (sin cambios pendientes)

**Ramas principales:**
- `main` - Integra T1, T2, T3 (estable)
- `sprint-2/cotizaciones-pedidos` - Contiene T4 implementado, **pendiente de merge a `main`**

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
