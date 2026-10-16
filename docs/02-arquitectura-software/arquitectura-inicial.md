$arq = @'
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
        WEB[Frontend Web<br/>Angular]
        API[Backend API<br/>NestJS]
        IA[Módulo IA<br/>Scikit-learn]
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