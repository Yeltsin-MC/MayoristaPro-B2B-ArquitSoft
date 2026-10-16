# MayoristaPro — Plataforma B2B Multitenant para la Comercialización Mayorista

Plataforma B2B que conecta **proveedores mayoristas** (Lima, Ayacucho y otras regiones) con **compradores empresariales** de Ayacucho (bodegas, librerías, minimarkets, restaurantes), incorporando **recomendación con IA** y soporte para **alta concurrencia**.

---

## 📚 Información académica

| Campo | Detalle |
|---|---|
| **Curso** | Arquitectura de Software |
| **Docente** | Ing. Lizbeth Jaico Quispe |
| **Estudiante** | Yeltsin Wilber Muñoz Corichahua |
| **Universidad** | Universidad Nacional de San Cristóbal de Huamanga |
| **Escuela** | Ingeniería de Sistemas |
| **Año** | 2026 |

---

## 🎯 Descripción del proyecto

MayoristaPro es un **marketplace B2B** que digitaliza la comercialización mayorista en Ayacucho, permitiendo que proveedores mayoristas publiquen sus productos con precios por volumen y que compradores empresariales busquen, soliciten cotizaciones, comparen ofertas y confirmen pedidos en línea.

La plataforma incorpora un **módulo de recomendación con IA** que sugiere proveedores según precio, disponibilidad, ubicación e historial de cumplimiento. Está diseñada para soportar **2,000 usuarios concurrentes** en picos estacionales (campaña escolar, navideña, cierre de mes).

---

## 🏗️ Estilo arquitectónico

- **Monolito Modular** con **Clean Architecture**
- **Multi-tenancy** con aislamiento de datos por empresa
- **API-First** para futuras integraciones
- **Alta concurrencia** con transacciones ACID, caché Redis y balanceo de carga

---
## 📂 Estructura del repositorio

```text
MayoristaPro-B2B-ArquitSoft/
├── README.md
├── docs/
│   ├── 01-analisis-de-sistema/
│   │   ├── 01-actores.md
│   │   ├── 02-historias-del-usuario.md
│   │   ├── 03-requisitos-funcionales.md
│   │   ├── 04-atributos-de-calidad.md
│   │   ├── 05-restricciones.md
│   │   ├── 06-driver-arquitectonicos.md
│   │   ├── 07-decisiones-arquitectonicas.md
│   │   └── 08-escenarios-atributos-calidad.md
│   ├── 02-arquitectura-software/
│   │   ├── arquitectura-inicial.md
│   │   ├── componentes-arquitectonicos.md
│   │   ├── enfoque-arquitectonico.md
│   │   └── estilo-arquitectonico.md
│   ├── 03-diseno-de-software/
│   │   └── diseno-interno/
│   │       ├── diseno-interno-de-modulos.md
│   │       ├── patrones-de-diseno.md
│   │       └── principios-de-diseno.md
│   └── 04-modelo-c4/
│       ├── Nivel1-Diagrama-de-Contexto.md
│       ├── Nivel2-Diagrama-de-Contenedores.md
│       ├── Nivel3-Diagrama-de-Componentes.md
│       └── Nivel4-Diagrama-de-Codigo.md
├── img/
├── tecnologia/
│   └── boilerplate-clean-architecture/
└── .git/
```

- **README.md** — Documentación principal del proyecto.
- **docs/** — Documentación académica y técnica del sistema.
- **docs/01-analisis-de-sistema/** — Actores, historias de usuario, requisitos, calidad y restricciones.
- **docs/02-arquitectura-software/** — Arquitectura inicial, componentes, enfoque y estilo arquitectónico.
- **docs/03-diseno-de-software/** — Principios, patrones y diseño interno del sistema.
- **docs/04-modelo-c4/** — Diagramas C4 del contexto, contenedores, componentes y código.
- **img/** — Recursos visuales y diagramas del proyecto.
- **tecnologia/** — Base tecnológica y boilerplate de arquitectura limpia.

---

## 🔗 Integraciones externas

| Integración | Proveedor | Fase |
|---|---|---|
| Facturación electrónica (SUNAT) | PSE (NubeFacT / Alanube) | v1 (sandbox) |
| Pasarela de pagos | Niubiz / Mercado Pago | v1 (sandbox) |
| Validación RUC | SUNAT / Apify | v1 |
| Mapas y geolocalización | OpenStreetMap + MapLibre | v1 |
| Recomendación con IA | Scikit-learn (v1) / API IA (v2) | v1 / v2 |
| Notificaciones | Turbo Cloud / Awaitra | v1 (sandbox) |
| Almacenamiento | AWS S3 | v1 |
| Cloud | AWS (EC2, RDS, SQS, CloudWatch) | v1 |

---

## 💰 Modelo de negocio

- **Comisión por transacción:** 3% sobre el valor del pedido.
- **Suscripción premium:** planes Profesional (S/ 99/mes) y Empresarial (S/ 299/mes).
- **Publicidad interna:** destacados en búsquedas y recomendaciones.
- **Break-even:** 63 pedidos/mes.
- **Proyección año 1:** S/ 18,040/mes ingresos · S/ 1,510/mes costos.

---

## 📝 Cambio de enfoque

Este proyecto migró de un modelo B2C de compras grupales a un modelo B2B de marketplace mayorista, siguiendo las indicaciones de la docente para alinearlo con problemáticas reales de Ayacucho, integración de IA y alta concurrencia.

---

## 📌 Estado del proyecto

| Sprint | Estado |
|---|---|
| Sprint 01 — Documentación técnica | 🟡 En progreso |
| Sprint 02 — Arquitectura y diseño | ⚪ Pendiente |
| Sprint 03 — Implementación | ⚪ Pendiente |