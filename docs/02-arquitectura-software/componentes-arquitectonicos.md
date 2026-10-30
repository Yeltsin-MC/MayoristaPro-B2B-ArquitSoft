# Componentes arquitectónicos

Esta vista identifica responsabilidades del backend. Los módulos son divisiones lógicas del monolito; no representan un microservicio por funcionalidad.

## Módulos del sistema

| Módulo | Responsabilidad | Ejemplo de operación |
|---|---|---|
| Usuarios | Cuentas, pertenencia a empresas y permisos. | Iniciar sesión y comprobar acceso a un pedido. |
| Proveedores | Perfil, verificación y reputación comercial. | Aprobar un proveedor y consultar sus evaluaciones. |
| Productos | Catálogo, precios por volumen, mínimos de compra y stock. | Publicar una oferta o reservar existencias. |
| Cotizaciones | Solicitudes, respuestas por proveedor y aceptación. | Comparar precios por ítem y condiciones. |
| Pedidos | Pedido de un comprador y un proveedor, condiciones aceptadas y estados. | Crear un pedido pendiente de pago. |
| Pagos | Intentos, referencias y estados de la pasarela externa. | Procesar una confirmación sin duplicar sus efectos. |
| Entregas | Despacho y confirmación de recepción. | Registrar guía y fecha estimada. |
| Incidencias | Reclamos vinculados a operaciones. | Registrar un problema con una entrega. |
| Reportes | Consultas e indicadores autorizados. | Mostrar ventas por período. |
| IA | Coordinar recomendaciones y su alternativa ante fallas. | Consultar el proceso Python mediante un puerto. |
| Administración | Coordinar funciones de supervisión. | Revisar usuarios e incidencias mediante las APIs de sus módulos. |

Facturación y notificaciones son capacidades de integración consumidas mediante puertos y adaptadores. Su ejecución asíncrona se encarga a workers; no agrega once servicios independientes al despliegue.

## Primera versión: MVP

El **Producto Mínimo Viable (MVP)** es una primera versión funcional que permite completar y evaluar el flujo principal de compra mayorista. La tabla anterior representa el alcance general del proyecto; no implica implementar todas las capacidades de cada módulo en la primera entrega de software.

**Estado:** propuesta de priorización pendiente de validación con la docente. No modifica los identificadores ni elimina los requisitos documentados. MVP y Sprint 02 no son equivalentes: su implementación puede distribuirse en varios sprints.

**Objetivo del núcleo inicial:** que un comprador encuentre productos, solicite una cotización a un proveedor, acepte su oferta y genere un pedido con stock reservado; el proveedor podrá consultar y atender ese pedido. Se propone este límite para reducir el trabajo de integraciones y operación, conservando el proceso que aporta valor al negocio. No constituye todavía una estimación de tiempo ni costo aprobada.

| Módulo o capacidad | Alcance propuesto para el MVP | Ampliación posterior |
|---|---|---|
| Usuarios | Registro, autenticación, empresa y permisos básicos. | Administración avanzada de cuentas. |
| Proveedores y Administración | Perfil comercial, revisión y aprobación básica del proveedor. | Supervisión integral y gestión avanzada de reputación. |
| Productos | Publicación manual, consulta, precios por volumen, mínimos y stock. | Carga masiva y búsqueda avanzada. |
| Cotizaciones | Solicitud a un proveedor, respuesta y aceptación de una oferta vigente. | Comparación automática entre múltiples proveedores y negociación avanzada. |
| Pedidos | Creación desde oferta aceptada, reserva transaccional y consulta de estados. | Flujos comerciales adicionales. |
| Pagos | Modalidad pendiente de acuerdo: una pasarela sandbox si la rúbrica la exige; registro manual autorizado si la docente lo permite. No se considera una integración implementada por registrar un pago manual. | Cobros reales, más medios de pago y reembolsos automatizados. |
| Entregas | Registro básico de despacho y confirmación de recepción. | Integraciones logísticas y seguimiento avanzado. |
| IA | Fuera del núcleo mínimo propuesto; su inclusión y método se confirmarán frente a la exigencia académica. La búsqueda y selección manual siguen disponibles. | Recomendación por reglas, modelo entrenado o API externa según requisito, datos y evaluación. |
| Reportes e Incidencias | Se mantienen como alcance documentado, fuera del núcleo inicial propuesto. | Dashboards, reportes y seguimiento completo de reclamos. |
| Facturación y notificaciones | Fuera del núcleo mínimo propuesto; etapa de entrega por acordar según la rúbrica. | Automatización mediante PSE y canales externos. |

### Condiciones académicas y criterio de aceptación

- El MVP contempla despliegue real en **AWS** y evaluación progresiva con **k6 hasta 2,000 usuarios concurrentes**. Son objetivos por comprobar, no capacidad demostrada.
- La puntuación por reglas es un punto de partida; si el requisito de IA exige un modelo entrenado u otra técnica, deberá incorporarse al alcance acordado antes de darlo por cumplido.
- No se posponen requisitos obligatorios de la rúbrica sin acordarlo con la docente. La prioridad del MVP no elimina el alcance general documentado.
- Recorrido del núcleo a demostrar: una empresa compradora se registra, consulta productos de un proveedor verificado manualmente, solicita y acepta una cotización, crea un pedido sin sobreventa y consulta su atención, despacho y recepción básicos.
- La demostración incluye accesos autorizados, rechazo por stock insuficiente y rollback ante fallas de creación. Si se acuerda pago sandbox, se añadirá su confirmación, idempotencia y reconciliación; si se admite registro manual, solo un responsable autorizado podrá verificarlo y quedará auditado. La confirmación y el avance del pedido respetarán esa modalidad y requerirán ajustar los contratos antes de implementar.
- Las pruebas de recuperación de recomendación, PSE y otras integraciones se ejecutarán cuando esas capacidades entren en una entrega. Los escenarios y el plan de calidad conservan las metas generales; cada informe identificará qué alcance está realmente desplegado y qué pruebas siguen pendientes.

La primera funcionalidad del Sprint 02 será la base de ese recorrido: identidad empresarial, catálogo y pedido con reserva. Las siguientes entregas completarán el MVP acordado.

### Infraestructura inicial y viabilidad

La base del núcleo propuesto es Angular, NestJS y PostgreSQL. El monolito modular y las capas internas se mantienen aunque no se desplieguen todos los componentes auxiliares desde el inicio. Los C4 y contratos actuales representan la visión general; al validar el MVP se actualizará la vista de implementación y, si cambia la modalidad de pago, sus contratos y estados.

| Decisión de alcance | Criterio propuesto |
|---|---|
| Redis, SQS y workers | Incorporarlos cuando exista una necesidad de caché o tareas asíncronas del alcance acordado, o evidencia de las pruebas. |
| Python / recomendación | Incorporarlo si se incluye recomendación y se valida el método exigido por el curso. |
| Servicios externos | Limitar el número de integraciones iniciales; acordar primero cuáles son obligatorias. |
| Despliegue y escalamiento | Mantener AWS y evaluar progresivamente la carga; aumentar recursos según mediciones y presupuesto. No prometer capacidad antes de probar. |
| Tiempo y costo | Estimar tareas, horas disponibles, recursos cloud y servicios externos antes de comprometer la fecha y el alcance final. Los créditos educativos no sustituyen la estimación. |

## Componentes dentro de cada módulo

| Capa | Contenido | Ejemplo en Pedidos |
|---|---|---|
| Presentación | Controladores HTTP, validación de entrada y traducción de respuestas. | Controlador que recibe la solicitud de creación. |
| Aplicación | Casos de uso, autorización de la operación y coordinación de puertos. | Crear pedido y coordinar la reserva. |
| Dominio | Entidades, reglas y contratos del negocio. | Pedido, ítems, estados y repositorio. |
| Infraestructura | Persistencia y adaptadores de proveedores. | Repositorio PostgreSQL y coordinación de la transacción. |

Angular es un cliente separado. Los controladores HTTP de NestJS también pertenecen a la presentación del backend.

## Colaboración principal

```mermaid
flowchart LR
    API["Controladores HTTP"] --> COT["Cotizaciones"]
    API --> PED["Pedidos"]
    API --> PAG["Pagos"]
    PED -->|Oferta aceptada| COT
    PED -->|Reserva de stock| PROD["Productos"]
    PED -->|Iniciar o consultar pago| PAG
    PAG -->|Adaptador| PAS["Pasarela externa"]
    PAG -->|Resultado verificado| PED
```

Las flechas muestran colaboración en ejecución. Pedidos y Pagos intercambian resultados mediante contratos; el diagrama no autoriza imports circulares ni acceso directo a clases internas de otros módulos.

## Creación de pedido y reserva de stock

```mermaid
sequenceDiagram
    participant C as Comprador
    participant API as Controlador
    participant UC as Caso de uso
    participant TX as Puertos y adaptadores transaccionales
    participant PG as PostgreSQL
    C->>API: Crear pedido desde oferta aceptada
    API->>UC: Ejecutar con identidad autenticada
    UC->>UC: Verificar permisos y condiciones
    UC->>TX: Crear pedido y reservar stock
    TX->>PG: BEGIN y lectura con bloqueo
    alt Oferta vigente y stock suficiente
        TX->>PG: Guardar pedido, ítems y reserva
        TX->>PG: COMMIT
        TX-->>UC: Pedido pendiente persistido
        UC-->>API: Identificador y estado pendiente
        API-->>C: 201 Created
    else Condiciones inválidas o stock insuficiente
        TX->>PG: ROLLBACK
        TX-->>UC: Rechazo de negocio
        API-->>C: Respuesta controlada
    end
```

La transacción comparte la misma conexión entre las operaciones participantes. La autorización no sustituye la comprobación de precio, oferta y stock dentro de la operación crítica.

## Coordinación posterior

- El pago se realiza fuera de la transacción de PostgreSQL, vinculado al pedido y a un intento persistido e idempotente.
- La confirmación verificada del pago actualiza el estado del pedido. Un timeout deja el resultado pendiente de consulta; no equivale automáticamente a pago rechazado.
- Las reservas requieren vencimiento y liberación controlada. Antes de liberar por un pago incierto, se debe reconciliar su estado.
- Las tareas de notificación y facturación se registran de forma durable antes de publicarlas en SQS. El worker reconoce duplicados para evitar efectos repetidos.
