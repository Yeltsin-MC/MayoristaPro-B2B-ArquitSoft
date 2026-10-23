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
| RC10 | Infraestructura cloud | El sistema debe desplegarse sobre infraestructura cloud (AWS) utilizando créditos educativos cuando estén disponibles. |
| RC11 | Tecnologías definidas | El desarrollo debe realizarse con tecnologías alineadas al stack propuesto (Angular, NestJS, PostgreSQL, Redis). |
| RC12 | Arquitectura definida | El sistema debe seguir un estilo de Monolito Modular con Clean Architecture. |
| RC13 | Alta concurrencia | El sistema debe soportar 2,000 usuarios concurrentes como objetivo académico, sujeto a validación con pruebas de carga. |
| RC14 | Presupuesto | El proyecto debe operar dentro de un presupuesto limitado, utilizando créditos educativos y entornos sandbox. |
| RC15 | Plazo académico | El desarrollo debe completarse dentro del ciclo académico vigente. |

## Origen y límites

| Origen | Restricciones | Aclaración |
|---|---|---|
| Exigencia académica | RC07, RC10, RC13, RC15 | IA, despliegue cloud, concurrencia y plazo del curso. |
| Decisiones del proyecto | RC01 a RC06, RC08, RC09, RC11, RC12 | Stack, arquitectura e integraciones seleccionados; no todos son requisitos impuestos por la docente. |
| Recursos | RC14 | Los servicios disponibles y el presupuesto deben verificarse antes del despliegue. |

El alcance es B2B: no incluye grupos de consumidores, custodia de fondos ni logística propia. Las pruebas de servicios externos se realizarán primero en sandbox. Los créditos educativos no garantizan disponibilidad de todos los servicios ni costo cero.
