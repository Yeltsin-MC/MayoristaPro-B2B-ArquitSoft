# MayoristaPro B2B

**Plataforma propuesta para la comercialización mayorista en Ayacucho**, que conecta proveedores con compradores empresariales e incorpora recomendación de proveedores.

**Demo en línea:** https://mayoristapro.shop · [Despliegue (Sprint 3)](docs/sprint-3/despliegue.md)

## Información académica

| Campo | Detalle |
|---|---|
| Curso | Arquitectura de Software |
| Docente | Ing. Lizbeth Jaico Quispe |
| Estudiante | Yeltsin Wilber Muñoz Corichahua |
| Universidad | Universidad Nacional de San Cristóbal de Huamanga |
| Escuela | Ingeniería de Sistemas |
| Año | 2026 |
| Entregable actual | Sprint 01: documentación técnica |

## Problema y propuesta

Los negocios compradores de Ayacucho necesitan encontrar proveedores mayoristas, comparar precios por volumen y condiciones de entrega, y dar seguimiento a sus compras. MayoristaPro propone reunir ese proceso en una plataforma web B2B. La magnitud del problema y los supuestos comerciales requieren validación con negocios locales.

| Participante | Qué podrá realizar |
|---|---|
| Proveedor mayorista | Importar el catálogo por bloques, mantener productos y definir mínimos y precios por volumen, responder cotizaciones y gestionar despachos. |
| Comprador empresarial | Buscar y comparar proveedores, solicitar cotizaciones, realizar pedidos y consultar entregas. |
| Administrador | Verificar proveedores, supervisar operaciones y dar seguimiento a incidencias. |

**Ejemplo:** una librería de Ayacucho solicita cotizaciones de útiles, compara las ofertas y realiza un pedido a un proveedor. El sistema conserva las condiciones aceptadas y evita reservar más unidades que las disponibles.

## Alcance del proyecto

| Dentro del alcance documentado | Fuera del alcance |
|---|---|
| Catálogo, cotizaciones y pedidos entre empresas. | Compras grupales entre consumidores, cupos y organizadores. |
| Recomendación de proveedores y comparación manual. | Compras decididas automáticamente por IA. |
| Pagos externos y facturación mediante PSE, primero en pruebas. | Custodia de fondos y almacenamiento de datos completos de tarjetas. |
| Registro de despacho y recepción. | Transporte y almacenes propios de MayoristaPro. |

El proyecto surgió como AyniCompra y fue reformulado a **MayoristaPro B2B**. El diseño vigente corresponde a comercialización entre empresas.

El [diagnóstico y plan del Sprint 2](docs/sprint-2/00-preparacion-sprint-2.md) registra la rúbrica y las decisiones pendientes. Véanse el [flujo comercial](docs/sprint-1/03-diseno-de-software/flujo-comercial-sprint-2.md) y el [despliegue académico](docs/sprint-1/02-arquitectura-software/despliegue-academico.md).

Las [especificaciones SDD por módulo](docs/sprint-2/sdd/README.md) (requisitos, diseño y tareas) describen cada funcionalidad implementada.

## Alcance de la primera versión — MVP

La carga masiva CSV/Excel es obligatoria para el MVP; la edición individual sirve para mantenimiento. Al ingresar, el catálogo mostrará tarjetas de ofertas con proveedor, precio por presentación y condiciones mayoristas. [Detalle de catálogo, precios y referencias B2B](docs/sprint-1/03-diseno-de-software/reglas-comerciales-mayoristas.md).

La primera versión de MayoristaPro se plantea como un producto mínimo viable (MVP), centrado en catálogo, cotizaciones y pedidos con control de stock. Este alcance permitirá completar el proceso desde la búsqueda de productos hasta la atención del pedido. Las demás funcionalidades se incorporarán en entregas posteriores, según el tiempo disponible y los requisitos del curso.

| Núcleo propuesto para el MVP | Evolución posterior o alcance por confirmar |
|---|---|
| Registro, inicio de sesión y permisos por empresa. | Administración avanzada de cuentas y reputación. |
| Perfil y verificación manual; catálogo por carga masiva CSV/Excel, mínimos y stock. | Consulta automática de RUC, mapas y ampliación de importaciones. |
| Primera prueba con un proveedor; varias respuestas a una solicitud para la demo de IA. | Negociación avanzada y comparación entre catálogos independientes. |
| Pedido desde oferta aceptada, reserva transaccional y estados básicos de atención. | Seguimiento logístico avanzado, reclamos y reportes completos. |
| Consulta del pedido por comprador y proveedor autorizados. | IA, facturación PSE y notificaciones externas, según exigencia académica. |

**Pagos:** Mercado Pago Checkout Pro en modo de prueba para la entrega académica. El retorno del navegador sirve para mostrar el estado y la confirmación depende de una verificación del backend. El perfil exacto de la API se comprobará con las credenciales de prueba.

La base del núcleo es **Angular + NestJS + PostgreSQL**. Redis se incorpora para demostrar caché del catálogo público. El despliegue académico se prevé en AWS con Cloudflare para DNS/CDN, sujeto a elegibilidad de servicios y presupuesto. La meta de al menos 2.000 usuarios virtuales concurrentes se comprobará con k6.

El MVP puede abarcar varios sprints; **Sprint 01 entrega el diseño y Sprint 02 inicia la implementación**. El tiempo y costo aún deben estimarse con las semanas, horas disponibles y servicios seleccionados. El detalle está en la [priorización de módulos del MVP](docs/sprint-1/02-arquitectura-software/componentes-arquitectonicos.md#primera-versión-mvp).

## Arquitectura propuesta

Las siguientes decisiones describen la arquitectura general prevista. Su incorporación a la primera implementación se ajustará al MVP validado; los [diagramas C4](docs/sprint-1/04-modelo-c4/Nivel1-Diagrama-de-Contexto.md) muestran esa visión general, no una lista de componentes obligatorios desde la primera entrega.

| Decisión | Aplicación |
|---|---|
| Monolito modular | Módulos comerciales dentro de un backend NestJS; proceso Python y workers auxiliares. |
| Clean Architecture | Presentación, Aplicación, Dominio e Infraestructura dentro de cada módulo. |
| API-First | Contratos REST para la comunicación con Angular. |
| Persistencia | PostgreSQL para información transaccional y Redis para caché y estado temporal. |
| Acceso por empresa | Datos privados protegidos y operaciones compartidas accesibles a las partes autorizadas. |
| Consistencia | Pedido y reserva en una transacción local; pago externo con idempotencia, confirmación y reconciliación. |

## Tecnologías e integraciones previstas

| Área | Propuesta |
|---|---|
| Frontend | Angular y TypeScript. |
| Backend | NestJS, Node.js y TypeScript. |
| Datos | PostgreSQL y Redis; MongoDB y Elasticsearch solo como evolución si se justifican. |
| Recomendación | Asistencia para comparar cotizaciones mediante un puerto de aplicación. El proveedor del modelo queda pendiente de una prueba técnica y verificación de costo. |
| Cloud | AWS: EC2, RDS, S3, SQS y CloudWatch; ALB para evaluar escalamiento y Cloudflare según disponibilidad del plan. |
| Pagos y comprobantes | Mercado Pago Checkout Pro en modo de prueba. La entrega de facturación PSE y su proveedor se confirman por separado. |
| Otros servicios | Consulta de RUC, notificaciones y mapas con OpenStreetMap/MapLibre según integración seleccionada. |
| Pruebas | Pruebas unitarias, de integración y de carga con k6 previstas para la implementación. |

El backend conserva los cálculos de costo, unidades y elegibilidad. El modelo interpreta preferencias y explica diferencias a partir de datos autorizados. El orden determinista mantiene la comparación disponible ante fallos del modelo.

## Metas de calidad

| Meta propuesta | Cómo se validará |
|---|---|
| Al menos 2.000 usuarios virtuales concurrentes como requisito académico. | Pruebas de carga con operaciones, duración, datos e infraestructura documentados. |
| p95 de 500 ms o menos en los endpoints locales definidos. | Medición por operación; dependencias externas evaluadas por separado. |
| Sin sobreventa ni stock negativo. | Confirmaciones simultáneas sobre inventario limitado. |
| Disponibilidad mensual objetivo de 99.5%. | Monitoreo y pruebas de recuperación. |
| Operación comercial disponible ante falla de recomendación. | Simulación de errores y uso de comparación manual o alternativa por precio. |

**Estas son metas de diseño pendientes de validación, no resultados demostrados.** Las condiciones completas se encuentran en los [escenarios de calidad](docs/sprint-1/01-analisis-de-sistema/08-escenarios-atributos-calidad.md).

## Documentación del Sprint 01

El recorrido comienza con el problema y los usuarios, continúa con las decisiones y termina en las vistas C4 y el diseño del módulo Pedidos.

| Bloque | Documentos |
|---|---|
| Usuarios y requisitos | [Actores](docs/sprint-1/01-analisis-de-sistema/01-actores.md) · [Historias](docs/sprint-1/01-analisis-de-sistema/02-historias-del-usuario.md) · [Requisitos y trazabilidad](docs/sprint-1/01-analisis-de-sistema/03-requisitos-funcionales.md) |
| Calidad y límites | [Atributos de calidad](docs/sprint-1/01-analisis-de-sistema/04-atributos-de-calidad.md) · [Restricciones](docs/sprint-1/01-analisis-de-sistema/05-restricciones.md) · [Escenarios de evaluación](docs/sprint-1/01-analisis-de-sistema/08-escenarios-atributos-calidad.md) · [Plan de medición y herramientas](docs/sprint-1/01-analisis-de-sistema/09-plan-de-medicion-calidad.md) |
| Decisiones | [Drivers](docs/sprint-1/01-analisis-de-sistema/06-driver-arquitectonicos.md) · [Decisiones arquitectónicas](docs/sprint-1/01-analisis-de-sistema/07-decisiones-arquitectonicas.md) |
| Arquitectura | [Vista inicial](docs/sprint-1/02-arquitectura-software/arquitectura-inicial.md) · [Componentes](docs/sprint-1/02-arquitectura-software/componentes-arquitectonicos.md) · [Estilo](docs/sprint-1/02-arquitectura-software/estilo-arquitectonico.md) · [Enfoque Clean Architecture](docs/sprint-1/02-arquitectura-software/enfoque-arquitectonico.md) · [Recomendación](docs/sprint-1/02-arquitectura-software/modulo-ia-decision.md) |
| Diseño de software | [Diseño interno](docs/sprint-1/03-diseno-de-software/diseno-interno/diseno-interno-de-modulos.md) · [Patrones](docs/sprint-1/03-diseno-de-software/diseno-interno/patrones-de-diseno.md) · [Principios](docs/sprint-1/03-diseno-de-software/diseno-interno/principios-de-diseno.md) |
| Contratos y datos | [API REST](docs/sprint-1/03-diseno-de-software/contratos-api-rest.md) · [Modelo de datos](docs/sprint-1/03-diseno-de-software/esquema-base-de-datos.md) |
| Modelo C4 | [1. Contexto](docs/sprint-1/04-modelo-c4/Nivel1-Diagrama-de-Contexto.md) · [2. Contenedores](docs/sprint-1/04-modelo-c4/Nivel2-Diagrama-de-Contenedores.md) · [3. Componentes](docs/sprint-1/04-modelo-c4/Nivel3-Diagrama-de-Componentes.md) · [4. Código](docs/sprint-1/04-modelo-c4/Nivel4-Diagrama-de-Codigo.md) |

## Entregables por sprint

| Sprint | Qué se entrega | Dónde está |
|---|---|---|
| Sprint 1: análisis y diseño | Requisitos, atributos de calidad, decisiones, arquitectura, diseño y modelo C4 | [`docs/sprint-1/`](docs/sprint-1/) · diagramas en [`img/`](img/) · exposición en [`presentaciones/`](presentaciones/) |
| Sprint 2: implementación y validación | Código según Clean Architecture, especificaciones SDD por módulo, Swagger, Jest con cobertura, k6 y evidencias | Código en [`apps/`](apps/) y [`database/`](database/) · documentos en [`docs/sprint-2/`](docs/sprint-2/) · [evidencias de calidad](docs/sprint-2/evidencias-calidad.md) · Swagger en `/api-docs` · Postman en [`postman/`](postman/) · pruebas en [`tests/`](tests/) |
| Sprint 3: integración y despliegue | URL pública, plataforma, procedimiento de despliegue y C4 actualizado | https://mayoristapro.shop · [`docs/sprint-3/`](docs/sprint-3/) · CI/CD en [`.github/workflows/`](.github/workflows/) |

## Estructura del repositorio

```text
MayoristaPro-B2B-ArquitSoft/
├── apps/
│   ├── api/                 Backend NestJS (Clean Architecture por módulos)
│   ├── web/                 Frontend Angular
│   └── ai-service/          Servicio de IA en Python (FastAPI)
├── database/                Migraciones SQL y datos de demostración
├── deployment/              Dockerfiles, nginx y arranque de contenedores
├── docs/
│   ├── sprint-1/            Análisis, arquitectura, diseño y modelo C4
│   ├── sprint-2/            Especificaciones SDD, pruebas y evidencias
│   ├── sprint-3/            Despliegue en AWS
│   └── guias/               Puertos, contexto del proyecto e historial de revisiones
├── img/                     Diagramas usados por la documentación
├── postman/                 Colección de Postman
├── presentaciones/          Presentaciones de los sprints
├── scripts/                 Utilidades (puertos)
├── tests/                   Pruebas Jest, navegador (Playwright) y k6
├── .github/workflows/       CI (pruebas) y CD (despliegue)
├── compose*.yaml            Docker Compose local, demo y AWS
└── package.json             Scripts npm del proyecto
```

### Equivalencia con el repositorio de referencia del curso (ayaPet)

| ayaPet | MayoristaPro | Contenido |
|---|---|---|
| `backend/` | [`apps/api/`](apps/api/) | API REST (NestJS) con Clean Architecture por módulo: `domain`, `application`, `infrastructure`, `presentation` |
| `frontend/` | [`apps/web/`](apps/web/) | Interfaz web (Angular) |
| `backend/database/` | [`database/`](database/) | Migraciones SQL y datos de demostración |
| `backend/test/` | [`tests/`](tests/) | Pruebas Jest, navegador y k6 |
| `docs/` | [`docs/`](docs/) | Documentación, organizada por sprint |
| `.github/`, `compose.yaml`, `README.md` | igual | CI/CD, Docker Compose y presentación del proyecto |
| — | [`apps/ai-service/`](apps/ai-service/) | Servicio de IA (Python/FastAPI) para puntuar ofertas |

Los archivos sueltos de la raíz (`package.json`, `compose.yaml`, `.gitignore`, `eslint.config.mjs`, `jest.config.cjs`, etc.) son configuración que las herramientas buscan en la raíz; no se deben mover.

El incremento inicial del Sprint 2 está en `apps/api`, `apps/web` y `database`. Consulta la [guía para ejecutar el catálogo de prueba](docs/sprint-2/base-catalogo.md).

T2 incorpora [identidad y vinculación empresarial](docs/sprint-2/identidad.md): alta aprobada manualmente, invitaciones, revocación y verificación independiente del proveedor. D1 está aprobada; SUNAT externa queda pendiente de confirmación posterior.

T3 incorpora [carga masiva CSV/XLSX](docs/sprint-2/carga-masiva.md): plantilla, vista previa con errores por fila y confirmación completa del lote por proveedor verificado. Actualiza SKU propios sin reemplazar stock y exige revisar de nuevo ante cambios concurrentes.

T4 incorpora [cotizaciones, pedidos y reserva de stock](docs/sprint-2/cotizaciones-pedidos.md): ofertas privadas de varios proveedores, aceptación única y creación idempotente de pedido pendiente con reserva atómica. La demo suma precios con IGV incluido y envío final fijo/cero con aritmética exacta; no integra pago ni liberación automática.

## Estado y siguiente paso

| Etapa | Estado |
|---|---|
| Sprint 01: documentación técnica | Documentación elaborada y revisada para sustentación; evaluación docente pendiente. |
| Sprint 02: implementación | Completo: identidad empresarial, catálogo con carga masiva y caché Redis, cotizaciones, pedidos con reserva de stock, pago (Mercado Pago en modo simulado), despacho y puntuación de ofertas con IA. Swagger, Jest con cobertura y k6. |
| Sprint 03: integración y despliegue | Publicado en https://mayoristapro.shop (AWS EC2 + Docker Compose, Cloudflare DNS/HTTPS/CDN con Tunnel). Ver [despliegue](docs/sprint-3/despliegue.md). Mercado Pago real y modelo externo de IA siguen pendientes. |
| Pruebas de capacidad | k6 con 2,000 usuarios virtuales aprobado en entorno local/cloud; ver [evidencias de calidad](docs/sprint-2/evidencias-calidad.md). |

El repositorio contiene la aplicación funcional, su documentación por sprint y las pruebas que la validan.
