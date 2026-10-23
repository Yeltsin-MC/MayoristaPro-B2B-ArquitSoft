# Principios de diseño

Guían la implementación del monolito modular. Cada principio se explica mediante una responsabilidad concreta de MayoristaPro.

## SOLID

| ID | Principio | Aplicación |
|---|---|---|
| PR-01 | Responsabilidad única (SRP) | Pedido valida sus estados; el controlador recibe HTTP; el repositorio persiste. |
| PR-02 | Abierto/cerrado (OCP) | Un nuevo proveedor de pagos implementa el puerto existente; si cambia el contrato, se revisan sus consumidores. |
| PR-03 | Sustitución de Liskov (LSP) | Los adaptadores respetan los mismos resultados, errores y condiciones del contrato. |
| PR-04 | Segregación de interfaces (ISP) | Separar reserva de stock, consulta de cotización y pago en contratos específicos. |
| PR-05 | Inversión de dependencias (DIP) | Los casos de uso dependen de puertos, no de PostgreSQL ni de un SDK de pagos. |

## Principios complementarios

| ID | Principio | Aplicación |
|---|---|---|
| PR-06 | DRY | Mantener la regla del mínimo de compra en una responsabilidad definida, sin copiarla entre controladores. |
| PR-07 | KISS | Preferir módulos y reglas comprensibles antes de agregar infraestructura compleja. |
| PR-08 | YAGNI | Posponer MongoDB y Elasticsearch hasta que exista una necesidad medida. |
| PR-09 | Fallar temprano | Rechazar cantidades inválidas antes de reservar stock o iniciar pagos. |
| PR-10 | Ley de Demeter | Pedidos solicita una operación pública a Productos; no recorre sus objetos internos. |
| PR-11 | Separación de responsabilidades | Dominio, Aplicación, Presentación e Infraestructura tienen tareas distintas. |
| PR-12 | Alta cohesión y bajo acoplamiento | Cada módulo concentra su negocio y expone una API pequeña. |

## Cómo comprobarlos

| Situación | Comprobación propuesta |
|---|---|
| Cambiar la pasarela. | Pruebas del contrato del adaptador y regresión de Pedidos y Pagos. |
| Modificar una regla comercial. | Pruebas unitarias del dominio y de los casos de uso afectados. |
| Revisar Clean Architecture. | Dominio sin imports de NestJS, ORM, SDK ni Infraestructura. |
| Probar una reserva simultánea. | Prueba de integración con PostgreSQL; un repositorio simulado no demuestra control de concurrencia. |

**Ejemplo:** si cambia el mínimo de compra, la regla comercial se ajusta en el módulo responsable. El controlador puede validar el formato, pero no decide por sí solo si la compra es válida.
