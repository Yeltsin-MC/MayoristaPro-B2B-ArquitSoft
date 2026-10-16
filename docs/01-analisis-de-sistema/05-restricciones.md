# Restricciones

Identificar las restricciones que condicionan las decisiones de diseño y arquitectura del sistema.

| ID | Restricción | Descripción |
|---|---|---|
| RC01 | Aplicación web | El sistema debe desarrollarse como una aplicación accesible mediante un navegador web. |
| RC02 | Control de versiones | El código fuente debe gestionarse utilizando Git y mantenerse en un repositorio compartido. |
| RC03 | API REST | La comunicación entre el frontend y los servicios del sistema debe realizarse mediante una API REST. |
| RC04 | Pasarela de pago | El sistema debe integrarse con una pasarela de pago externa para procesar las operaciones de pago. |
| RC05 | Servicio de facturación | El sistema debe integrarse con un PSE externo para emitir comprobantes electrónicos ante SUNAT. |
| RC06 | Validación de RUC | El sistema debe validar el RUC de proveedores y compradores contra el padrón de SUNAT. |
| RC07 | Servicio de IA | El sistema debe integrar un módulo de recomendación de proveedores basado en inteligencia artificial. |
| RC08 | Servicio de notificaciones | El sistema debe integrarse con un servicio externo de notificaciones (email y WhatsApp). |
| RC09 | Almacenamiento de archivos | Las imágenes de productos y documentos deben almacenarse en un servicio de almacenamiento externo (AWS S3). |
| RC10 | Infraestructura cloud | El sistema debe desplegarse sobre infraestructura cloud (AWS) con créditos educativos durante el desarrollo. |
| RC11 | Tecnologías definidas | El desarrollo debe realizarse con tecnologías alineadas al stack propuesto (Angular, NestJS, PostgreSQL, Redis). |
| RC12 | Arquitectura definida | El sistema debe seguir un estilo de Monolito Modular con Clean Architecture. |
| RC13 | Alta concurrencia | El sistema debe soportar 2,000 usuarios concurrentes según las proyecciones del dominio. |
| RC14 | Presupuesto | El proyecto debe operar dentro de un presupuesto limitado, utilizando créditos educativos y entornos sandbox. |
| RC15 | Plazo académico | El desarrollo debe completarse dentro del ciclo académico vigente. |

---

## Clasificación de restricciones

Las restricciones se agrupan en cuatro categorías según su origen:

| Categoría | Restricciones | Descripción |
|---|---|---|
| Técnicas | RC01, RC03, RC09, RC11, RC12 | Definen el stack y la arquitectura del sistema |
| De integración | RC04, RC05, RC06, RC07, RC08 | Definen dependencias con servicios externos |
| De proceso | RC02, RC15 | Definen cómo se gestiona y entrega el proyecto |
| De negocio y recursos | RC10, RC13, RC14 | Definen las condiciones operativas y de recursos |

---

## Impacto en las decisiones de arquitectura

### Restricciones técnicas
La aplicación debe ser **web** (RC01), comunicarse mediante **API REST** (RC03) y seguir un estilo de **Monolito Modular con Clean Architecture** (RC12). El stack tecnológico está definido: Angular, NestJS, PostgreSQL, Redis (RC11). Esto condiciona el diseño de capas y la organización del código.

### Restricciones de integración
El sistema no puede implementar funcionalidades que son responsabilidad de terceros:
- Los pagos se procesan en una **pasarela externa** (RC04); la plataforma no almacena fondos ni datos de tarjetas.
- La facturación electrónica se delega a un **PSE externo** (RC05).
- La validación de RUC se consulta a **SUNAT** (RC06).
- La **IA** se implementa como módulo interno con posibilidad de evolucionar a API externa (RC07).
- Las notificaciones se envían por un **servicio externo** (RC08).

### Restricciones de proceso
El proyecto se gestiona con **Git** (RC02) y debe completarse dentro del **ciclo académico** (RC15), lo que limita el alcance de la primera versión.

### Restricciones de negocio y recursos
El despliegue se realiza en **AWS con créditos educativos** (RC10), lo que limita la capacidad de cómputo durante el desarrollo. El sistema debe soportar **2,000 usuarios concurrentes** (RC13) sin exceder el **presupuesto disponible** (RC14).
