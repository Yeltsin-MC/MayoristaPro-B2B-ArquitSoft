# Enfoque arquitectónico

MayoristaPro B2B se diseña bajo el enfoque de **Clean Architecture**, propuesto por Robert C. Martin, que organiza el sistema en capas concéntricas con dependencias dirigidas hacia el dominio.

---

## Principios de Clean Architecture

| Principio | Aplicación en MayoristaPro |
|---|---|
| Independencia de frameworks | El dominio no depende de NestJS, Angular ni PostgreSQL. |
| Testabilidad | Las reglas de negocio se testean sin BD ni UI. |
| Independencia de la UI | El frontend puede cambiar sin afectar el dominio. |
| Independencia de la BD | PostgreSQL puede reemplazarse sin tocar el dominio. |
| Independencia de agentes externos | Los adaptadores de PSE, pasarela y IA son sustituibles. |

---

## Capas de Clean Architecture

```mermaid
graph TB
    subgraph Capa_Presentacion["Capa de Presentacion"]
        UI[Frontend Angular]
        CTRL[Controladores HTTP]
    end

    subgraph Capa_Aplicacion["Capa de Aplicacion"]
        UC[Casos de uso]
        DTO[DTOs]
        SERV[Servicios de aplicacion]
    end

    subgraph Capa_Dominio["Capa de Dominio"]
        ENT[Entidades]
        VO[Value Objects]
        REG[Reglas de negocio]
        REPO_INT[Interfaces de repositorio]
    end

    subgraph Capa_Infraestructura["Capa de Infraestructura"]
        REPO_IMPL[Repositorios concretos]
        ADAPT[Adaptadores externos]
        DB[(PostgreSQL)]
        CACHE[(Redis)]
        QUEUE[Amazon SQS]
        EXT[Servicios externos]
    end

    UI --> CTRL
    CTRL --> UC
    UC --> DTO
    UC --> SERV
    UC --> ENT
    UC --> REG
    UC --> REPO_INT
    REPO_INT --> REPO_IMPL
    REPO_IMPL --> DB
    REPO_IMPL --> CACHE
    UC --> QUEUE
    ADAPT --> EXT
```

---

## Regla de dependencias

Las dependencias siempre apuntan **hacia el dominio**. Las capas externas conocen a las internas, pero las internas no conocen a las externas.

```mermaid
graph LR
    P[Capa de Presentacion] --> A[Capa de Aplicacion]
    A --> D[Capa de Dominio]
    I[Capa de Infraestructura] --> D
    I --> A
    style D fill:#f9f,stroke:#333,stroke-width:2px
```

| Capa | Conoce a | No conoce a |
|---|---|---|
| Presentación | Aplicación | Infraestructura, Dominio directo |
| Aplicación | Dominio | Infraestructura, Presentación |
| Dominio | Nada | Aplicación, Infraestructura, Presentación |
| Infraestructura | Dominio, Aplicación | Presentación |

---

## Estructura de carpetas propuesta

```mermaid
graph TB
    subgraph src
        subgraph domain["domain/"]
            D1[entities/]
            D2[value-objects/]
            D3[repositories/ - interfaces]
            D4[services/]
        end

        subgraph application["application/"]
            A1[use-cases/]
            A2[dtos/]
            A3[services/]
        end

        subgraph infrastructure["infrastructure/"]
            I1[persistence/ - PostgreSQL]
            I2[cache/ - Redis]
            I3[queue/ - SQS]
            I4[external/ - PSE, pagos, IA]
        end

        subgraph presentation["presentation/"]
            P1[controllers/]
            P2[routes/]
            P3[middlewares/]
        end
    end

    P1 --> A1
    A1 --> D1
    A1 --> D3
    I1 --> D3
    I4 --> D3
```

---

## Ejemplo: caso de uso de confirmación de pedido

```mermaid
sequenceDiagram
    participant C as Comprador
    participant CTRL as Controlador
    participant UC as Caso de uso ConfirmarPedido
    participant DOM as Dominio
    participant REPO as Repositorio
    participant DB as PostgreSQL
    participant SQS as Amazon SQS

    C->>CTRL: POST /orders
    CTRL->>UC: ejecutar(dto)
    UC->>DOM: validar stock disponible
    DOM-->>UC: OK
    UC->>REPO: guardar pedido
    REPO->>DB: BEGIN TRANSACTION
    REPO->>DB: UPDATE stock
    REPO->>DB: INSERT pedido
    REPO->>DB: COMMIT
    DB-->>REPO: OK
    REPO-->>UC: Pedido guardado
    UC->>SQS: Encolar notificacion
    UC-->>CTRL: PedidoConfirmado
    CTRL-->>C: 201 Created
```

---

## Beneficios aplicados a MayoristaPro

| Beneficio | Impacto en MayoristaPro |
|---|---|
| Testabilidad | Se testean reglas de cotización y pedido sin BD. |
| Mantenibilidad | Cambios en pasarela de pago no afectan el dominio. |
| Independencia tecnológica | Cambiar de PostgreSQL a otro motor no requiere reescribir casos de uso. |
| Escalabilidad | Los adaptadores se pueden reemplazar por versiones distribuidas en el futuro. |
| Evolución | La IA puede evolucionar de motor de reglas a modelo ML sin tocar el dominio. |

---

## Relación con otros estilos

| Estilo | Relación con Clean Architecture |
|---|---|
| Hexagonal | Compatible. Clean Architecture puede implementarse con puertos y adaptadores. |
| Onion Architecture | Prácticamente equivalente. Misma idea de capas concéntricas. |
| DDD | Complementario. Clean Architecture organiza la estructura; DDD define el modelo. |
| Monolito Modular | Clean Architecture organiza cada módulo internamente. |