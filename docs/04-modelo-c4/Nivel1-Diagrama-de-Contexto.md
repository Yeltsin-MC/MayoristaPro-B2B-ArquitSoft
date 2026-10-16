# Nivel 1 — Diagrama de Contexto del Sistema

> **Proyecto:** MayoristaPro B2B
> **Nivel C4:** 1 — Contexto
> **Versión:** 1.0

---

## 1. Propósito

Este diagrama muestra **MayoristaPro como una caja negra** y sus relaciones con los actores humanos y sistemas externos que interactúan con él. Está dirigido a audiencias no técnicas: stakeholders, docentes, usuarios finales.

---

## 2. Diagrama de contexto

```mermaid
graph TB
    P[🏭 Proveedor mayorista<br/>Publica productos y<br/>responde cotizaciones]
    C[🏪 Comprador empresarial<br/>Busca, cotiza<br/>y compra al por mayor]
    A[👤 Administrador<br/>Supervisa y gestiona<br/>la plataforma]

    MP[🛒 MayoristaPro<br/>Plataforma B2B multitenant<br/>para comercialización mayorista]

    SUNAT[📄 SUNAT / PSE<br/>Validación de RUC y<br/>comprobantes electrónicos]
    PAY[💳 Pasarela de pagos<br/>Procesamiento de<br/>transacciones]
    IA[🧠 Servicio de IA<br/>Recomendación de<br/>proveedores]
    NOT[📧 Servicio de notificaciones<br/>Email y WhatsApp]
    MAP[🗺️ Servicio de mapas<br/>Geolocalización y<br/>cálculo de distancias]

    P -->|Publica productos,<br/>responde cotizaciones,<br/>gestiona pedidos| MP
    C -->|Busca productos,<br/>solicita cotizaciones,<br/>confirma pedidos| MP
    A -->|Verifica proveedores,<br/>gestiona incidencias,<br/>consulta reportes| MP

    MP -->|Valida RUC,<br/>emite comprobantes| SUNAT
    MP -->|Procesa pagos| PAY
    MP -->|Solicita recomendaciones| IA
    MP -->|Envía alertas| NOT
    MP -->|Consulta ubicación<br/>y distancias| MAP
```

---

## 3. Actores y sistemas externos

### Actores humanos

| Actor | Descripción | Interacción principal con MayoristaPro |
|---|---|---|
| Proveedor mayorista | Empresa que vende al por mayor (distribuidora, importador, fabricante) | Publica productos, responde cotizaciones, gestiona pedidos y despachos |
| Comprador empresarial | Negocio que compra al por mayor (bodega, librería, minimarket, restaurante) | Busca, solicita cotizaciones, compara, confirma pedidos y paga |
| Administrador | Responsable de la operación de la plataforma | Verifica proveedores, gestiona incidencias, supervisa reportes |

### Sistemas externos

| Sistema | Descripción | Tipo de integración |
|---|---|---|
| SUNAT / PSE | Validación de RUC y emisión de comprobantes electrónicos | API REST |
| Pasarela de pagos | Procesamiento de pagos (Niubiz, Mercado Pago) | API REST + webhooks |
| Servicio de IA | Recomendación de proveedores según criterios comerciales | API REST o módulo interno |
| Servicio de notificaciones | Envío de alertas por email y WhatsApp | API REST |
| Servicio de mapas | Geolocalización y cálculo de distancias | API REST |

---

## 4. Descripción del sistema

**MayoristaPro** es una plataforma B2B multitenant que conecta proveedores mayoristas (de Lima, Ayacucho u otras regiones) con compradores empresariales de Ayacucho. Su propósito es digitalizar la comercialización mayorista, permitiendo que los compradores encuentren proveedores, comparen precios, soliciten cotizaciones y confirmen pedidos en línea.

**Características clave:**
- Comercialización mayorista entre empresas.
- Precios diferenciados por volumen.
- Recomendación de proveedores con IA.
- Multi-tenancy con aislamiento de datos.
- Soporte para 2,000 usuarios concurrentes.

---

## 5. Flujos principales

### Flujo 1: Comprador busca y compra

```mermaid
sequenceDiagram
    participant C as Comprador
    participant MP as MayoristaPro
    participant IA as Servicio IA
    participant P as Proveedor
    participant PAY as Pasarela

    C->>MP: Busca producto
    MP->>IA: Solicita recomendación
    IA-->>MP: Proveedores ordenados
    MP-->>C: Resultados + recomendaciones
    C->>MP: Solicita cotización
    MP->>P: Notifica solicitud
    P->>MP: Responde cotización
    MP-->>C: Cotización disponible
    C->>MP: Acepta cotización
    C->>PAY: Procesa pago
    PAY-->>MP: Pago confirmado
    MP-->>P: Notifica pedido
```

### Flujo 2: Proveedor publica y vende

```mermaid
sequenceDiagram
    participant P as Proveedor
    participant MP as MayoristaPro
    participant SUNAT as SUNAT/PSE
    participant C as Comprador
    participant SQS as Amazon SQS

    P->>MP: Registro con RUC
    MP->>SUNAT: Valida RUC
    SUNAT-->>MP: RUC válido
    P->>MP: Publica producto
    C->>MP: Solicita cotización
    MP->>P: Notifica solicitud
    P->>MP: Responde cotización
    C->>MP: Confirma pedido
    MP->>SQS: Encola facturación
    SQS->>SUNAT: Emite comprobante
```

---

## 6. Fuera de alcance (Nivel 1)

| No se muestra en este nivel | Se detalla en |
|---|---|
| Componentes internos del sistema | Nivel 2 — Contenedores |
| Módulos de la aplicación | Nivel 3 — Componentes |
| Clases y estructuras de código | Nivel 4 — Código |
| Detalles de implementación | Documentos de diseño interno |

---

## 7. Notas y consideraciones

- **Multi-tenancy:** varios proveedores y compradores comparten la plataforma con aislamiento de datos.
- **Integración con SUNAT:** la validación de RUC y la emisión de comprobantes se delegan a un PSE autorizado.
- **Pagos:** MayoristaPro no almacena fondos ni datos de tarjetas.
- **IA:** en v1 es un módulo interno con motor de reglas; en v2 se prevé integración con API externa.
- **Escalabilidad:** el sistema está diseñado para 2,000 usuarios concurrentes en picos estacionales.

---

## 8. Leyenda de notación

| Elemento | Significado |
|---|---|
| Rectángulo con borde | Persona (actor humano) |
| Rectángulo con nombre y descripción | Sistema de software |
| Flecha con etiqueta | Relación y dirección de la interacción |
| Texto entre corchetes | Tecnología o tipo de integración |