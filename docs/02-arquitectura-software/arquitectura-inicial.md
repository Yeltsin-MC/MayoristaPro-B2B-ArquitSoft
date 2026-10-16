# Arquitectura inicial

Vista general de la arquitectura de MayoristaPro B2B, un marketplace que conecta proveedores mayoristas con compradores empresariales de Ayacucho.

---

## Estilo arquitectónico

MayoristaPro se diseña bajo un estilo de **Monolito Modular con Clean Architecture**, organizado en capas con responsabilidades claramente definidas.

| Capa | Responsabilidad |
|---|---|
| Presentación | Aplicación web responsive (Angular) que interactúa con los usuarios. |
| Aplicación | Casos de uso y coordinación de operaciones comerciales. |
| Dominio | Reglas de negocio (cotizaciones, pedidos, stock, pagos). |
| Infraestructura | Persistencia, caché, colas y servicios externos. |

---

## Vista general del sistema

```mermaid
graph TB
    subgraph Usuarios
        P[Proveedor mayorista]
        C[Comprador empresarial]
        A[Administrador]
    end

    subgraph MayoristaPro
        WEB[Frontend Web\nAngular]
        API[Backend API\nNestJS]
        IA[Módulo IA\nPython + Scikit-learn]
    end

    subgraph Datos
        PG[(PostgreSQL)]
        RD[(Redis)]
    end

    subgraph Servicios externos
        PSE[SUNAT / PSE]
        PAY[Pasarela de pagos]
        NOT[Notificaciones]
        MAP[Mapas]
    end

    P --> WEB
    C --> WEB
    A --> WEB
    WEB --> API
    API --> IA
    API --> PG
    API --> RD
    API --> PSE
    API --> PAY
    API --> NOT
    API --> MAP
```

---

## Módulos del sistema

El backend se organiza en 11 módulos de negocio, cada uno con sus propias capas internas (Dominio, Aplicación, Infraestructura, Presentación):

| Módulo | Responsabilidad principal |
|---|---|
| Usuarios | Registro, autenticación y gestión de cuentas. |
| Proveedores | Verificación y perfil comercial de proveedores. |
| Productos | Publicación, búsqueda y catálogo de productos con precios por volumen. |
| Cotizaciones | Solicitud, respuesta y comparación de cotizaciones entre proveedores. |
| Pedidos | Confirmación, seguimiento y gestión de estados del pedido. |
| Pagos | Integración con pasarela y registro de transacciones. |
| Entregas | Registro de despacho y confirmación de recepción. |
| Incidencias | Registro y seguimiento de reclamos y disputas. |
| Reportes | Dashboards e indicadores para proveedores y administración. |
| IA | Recomendación de proveedores según precio, disponibilidad e historial. |
| Administración | Gestión general de la plataforma y supervisión. |

---

## Decisiones arquitectónicas clave

| Decisión | Justificación |
|---|---|
| Monolito Modular | Consistencia transaccional, equipo pequeño, sin complejidad operativa de microservicios. |
| Clean Architecture | Aislar las reglas de negocio de los detalles tecnológicos (framework, BD, servicios externos). |
| PostgreSQL + Redis | ACID para pedidos/pagos; caché para búsquedas y sesiones en picos de concurrencia. |
| Amazon SQS | Desacoplar tareas secundarias (notificaciones, facturación) del flujo principal. |
| API-First | Frontend Angular y futuras apps móviles consumen los mismos servicios REST. |

---

## Infraestructura de despliegue

```mermaid
graph TB
    CF[Cloudflare CDN + WAF]
    ALB[AWS ALB\nBalanceador de carga]
    EC1[EC2 Instancia 1\nBackend NestJS]
    EC2[EC2 Instancia 2\nBackend NestJS]
    EC3[EC2 Instancia 3\nBackend NestJS]
    RDS[(AWS RDS\nPostgreSQL)]
    ELC[(ElastiCache\nRedis)]
    SQS[Amazon SQS]
    S3[Amazon S3]
    CW[CloudWatch\nMonitoreo]

    CF --> ALB
    ALB --> EC1
    ALB --> EC2
    ALB --> EC3
    EC1 --> RDS
    EC2 --> RDS
    EC3 --> RDS
    EC1 --> ELC
    EC2 --> ELC
    EC3 --> ELC
    EC1 --> SQS
    EC2 --> SQS
    EC3 --> SQS
    EC1 --> S3
    CW --> EC1
    CW --> EC2
    CW --> EC3
    CW --> RDS
```
