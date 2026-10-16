# Componentes arquitectónicos

Descripción de los componentes que conforman la arquitectura de MayoristaPro B2B, organizados por capa según Clean Architecture.

---

## Vista general de componentes

```mermaid
graph TB
    subgraph Presentacion
        FE[Frontend Angular]
    end

    subgraph Aplicacion
        AUTH[Servicio de autenticacion]
        USR[Servicio de usuarios]
        PROV[Servicio de proveedores]
        PROD[Servicio de productos]
        COT[Servicio de cotizaciones]
        PED[Servicio de pedidos]
        PAG[Servicio de pagos]
        ENT[Servicio de entregas]
        INC[Servicio de incidencias]
        REP[Servicio de reportes]
        ADM[Servicio de administracion]
    end

    subgraph Dominio
        ENT_DOM[Entidades de dominio]
        REGLAS[Reglas de negocio]
    end

    subgraph Infraestructura
        REPO[Repositorios]
        CACHE[Adaptador Redis]
        DB[Adaptador PostgreSQL]
        QUEUE[Adaptador SQS]
        EXT[Adaptadores externos]
    end

    FE --> AUTH
    FE --> USR
    FE --> PROV
    FE --> PROD
    FE --> COT
    FE --> PED
    FE --> PAG
    FE --> ENT
    FE --> INC
    FE --> REP
    FE --> ADM

    AUTH --> ENT_DOM
    USR --> ENT_DOM
    PROV --> ENT_DOM
    PROD --> ENT_DOM
    COT --> ENT_DOM
    PED --> ENT_DOM
    PAG --> ENT_DOM
    ENT --> ENT_DOM
    INC --> ENT_DOM
    REP --> ENT_DOM
    ADM --> ENT_DOM

    ENT_DOM --> REGLAS
    USR --> REPO
    PROD --> REPO
    COT --> REPO
    PED --> REPO
    REPO --> DB
    REPO --> CACHE
    PED --> QUEUE
    PAG --> EXT
```

---

## Componentes por capa

### Capa de presentación

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Frontend Web | Angular + TypeScript | Interfaz de usuario para proveedores, compradores y administradores. |

---

### Capa de aplicación

| Componente | Responsabilidad |
|---|---|
| Servicio de autenticación | Registro, login, generación y validación de tokens JWT. |
| Servicio de usuarios | Gestión de cuentas, roles y permisos. |
| Servicio de proveedores | Verificación de proveedores y gestión de perfil comercial. |
| Servicio de productos | Publicación, actualización y carga masiva de productos. |
| Servicio de cotizaciones | Solicitud, respuesta y comparación de cotizaciones. |
| Servicio de pedidos | Confirmación, seguimiento y gestión de estados. |
| Servicio de pagos | Integración con pasarela y registro de transacciones. |
| Servicio de entregas | Registro de despacho y confirmación de recepción. |
| Servicio de incidencias | Registro y seguimiento de reclamos. |
| Servicio de reportes | Generación de dashboards e indicadores. |
| Servicio de administración | Gestión general de la plataforma. |

---

### Capa de dominio

| Componente | Responsabilidad |
|---|---|
| Entidades de dominio | Modelos de negocio: Usuario, Proveedor, Producto, Cotización, Pedido, Pago, Evaluación. |
| Reglas de negocio | Validaciones: stock disponible, precios por volumen, estados de pedido, control de concurrencia. |

---

### Capa de infraestructura

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Adaptador PostgreSQL | PostgreSQL | Persistencia transaccional con ACID. |
| Adaptador Redis | Redis | Caché y sesiones. |
| Adaptador SQS | Amazon SQS | Procesamiento asíncrono de tareas. |
| Adaptador PSE | NubeFacT / Alanube | Emisión de comprobantes electrónicos. |
| Adaptador de pagos | Niubiz / Mercado Pago | Procesamiento de pagos. |
| Adaptador de IA | Scikit-learn / API externa | Recomendación de proveedores. |
| Adaptador de notificaciones | Turbo Cloud / Awaitra | Envío de emails y WhatsApp. |
| Adaptador de mapas | OpenStreetMap + MapLibre | Geolocalización de proveedores. |
| Adaptador S3 | Amazon S3 | Almacenamiento de archivos. |

---

## Componentes del módulo de IA

| Componente | Responsabilidad |
|---|---|
| Analizador de necesidades | Procesa la solicitud del comprador (producto, cantidad, ubicación). |
| Evaluador de proveedores | Puntúa proveedores según precio, stock, ubicación e historial. |
| Generador de recomendaciones | Devuelve lista ordenada con justificación. |
| Fallback | Si el servicio de IA no está disponible, el comprador puede seguir buscando y comparando manualmente. |

---

## Interacciones entre componentes

```mermaid
sequenceDiagram
    participant C as Comprador
    participant FE as Frontend
    participant API as Backend
    participant IA as Modulo IA
    participant PG as PostgreSQL
    participant RD as Redis

    C->>FE: Busca productos
    FE->>API: GET /products
    API->>RD: Consulta cache
    alt Cache hit
        RD-->>API: Resultados
    else Cache miss
        API->>PG: Consulta BD
        PG-->>API: Resultados
        API->>RD: Guarda en cache
    end
    API-->>FE: Lista de productos

    C->>FE: Solicita recomendacion
    FE->>API: GET /ai/recommendations
    API->>IA: Solicita recomendacion
    IA-->>API: Proveedores ordenados
    API-->>FE: Recomendaciones con justificacion
```

---

## Flujo de confirmación de pedido (concurrencia)

```mermaid
sequenceDiagram
    participant C as Comprador
    participant API as Backend
    participant PG as PostgreSQL
    participant SQS as Amazon SQS

    C->>API: POST /orders
    API->>PG: BEGIN TRANSACTION
    API->>PG: SELECT stock FOR UPDATE
    alt Stock disponible
        PG->>PG: UPDATE stock
        PG->>API: COMMIT
        API->>SQS: Encola notificacion
        API-->>C: Pedido confirmado
    else Stock insuficiente
        PG->>API: ROLLBACK
        API-->>C: Error 409 sin stock
    end
```

---

## Resumen de componentes

| Capa | Cantidad | Componentes clave |
|---|---|---|
| Presentación | 1 | Frontend Angular |
| Aplicación | 11 | Servicios de negocio |
| Dominio | 2 | Entidades y reglas |
| Infraestructura | 9 | Adaptadores de persistencia, caché, colas y servicios externos |

---

## Principios aplicados

- **Separación de responsabilidades:** cada componente tiene una función clara.
- **Inversión de dependencias:** el dominio no depende de la infraestructura.
- **Desacoplamiento:** los adaptadores externos se pueden sustituir sin afectar el dominio.
- **Modularidad:** los servicios de aplicación están organizados por módulo de negocio.