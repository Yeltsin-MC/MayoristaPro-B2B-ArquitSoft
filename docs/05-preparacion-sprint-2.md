# Preparación del Sprint 2

La revisión se basa en `cb203a9`, versión de main consultada el 10 de noviembre de 2026. El repositorio contiene diseño del Sprint 1. La entrega académica se prevé alrededor del 20 de diciembre. Las evidencias de implementación se producirán durante el Sprint 2 y las entregas siguientes.

## Diagnóstico y prioridades

| ID | Prioridad y tipo | Evidencia en la base revisada | Corrección |
|---|---|---|---|
| H1 | Crítico, decisión faltante | [Esquema](03-diseno-de-software/esquema-base-de-datos.md#tablas-y-campos-principales) y [registro](03-diseno-de-software/contratos-api-rest.md#auth) no cierran asociación por RUC. | Prohibir asociación automática y registrar D1. |
| H2 | Alto, inconsistencia | [Convenciones REST](03-diseno-de-software/contratos-api-rest.md#convenciones) usaba identidad y el esquema usaba empresa compradora para creación. | Alinear alcance y huella en el flujo comercial. |
| H3 | Crítico, diseño incompleto | [Esquema](03-diseno-de-software/esquema-base-de-datos.md#relaciones-del-flujo-comercial) permite varias respuestas y la unicidad por destinatario no protege la aceptación por solicitud. El pedido v1 declaraba la oferta opcional. | Bloquear solicitud al aceptar y exigir oferta en el pedido v1. |
| H4 | Crítico, inconsistencia | [API de pago](03-diseno-de-software/contratos-api-rest.md#inicio-y-confirmación-del-pago) y [UML](04-modelo-c4/Nivel4-Diagrama-de-Codigo.md#secuencia-principal) diferían sobre cuándo persistir el estado definitivo del intento. | Transacción local conjunta, verificación externa y D3 para casos comerciales. |
| H5 | Alto, riesgo | [Reglas de catálogo](03-diseno-de-software/reglas-comerciales-mayoristas.md) no fijaban concurrencia entre vista previa, cambios de SKU y confirmación. | Revalidar lote y coordinar inventario y reservas. |
| H6 | Alto, alcance | [Restricciones](01-analisis-de-sistema/05-restricciones.md) y README mezclaban alcance final con la primera entrega y dejaban pago manual como alternativa. | Identificar Checkout Pro de prueba, despliegue académico y entregas pendientes. |
| H7 | Alto, riesgo | [IA](02-arquitectura-software/modulo-ia-decision.md) dependía de comparar productos de catálogo sin identificación transversal cerrada. | Comparar respuestas de la misma solicitud; conservar D6 sobre proveedor y evaluación. |
| H8 | Medio, incoherencia | [Plan de calidad](01-analisis-de-sistema/09-plan-de-medicion-calidad.md) alternaba cajas y unidades. | Alinear unidades de EQ-06 y distinguirlo de carga general. |
| H9 | Medio, falta de trazabilidad | [README](../README.md) y diseño no trazaban los 16 criterios hasta sus evidencias. | Matriz, especificaciones y secuencia de trabajo. |
| H10 | Bajo, documentación | [Presentaciones](../presentaciones/README.md) incluye versiones anteriores. | Usar la versión vigente como evidencia del Sprint 1 y preparar la exposición final desde los resultados. |

## Matriz de criterios

| Nº | Criterio | Base existente | Pendiente y evidencia de entrega |
|---|---|---|---|
| 1 | Problema y requerimientos | README, actores, HU, RF | Validar alcance y matriz HU/RF con la docente. |
| 2 | Análisis y diseño | Casos, API y esquema lógico | Cerrar decisiones comerciales, OpenAPI y migraciones. Entregar revisión de trazabilidad. |
| 3 | Arquitectura alta y baja | C4, UML y ADR | Vincular vistas al despliegue y mostrar dependencias y transacciones implementadas. |
| 4 | Desarrollo SDD | Especificaciones parciales del Sprint 1 | Versionar especificación, plan, tareas y aceptación por incremento. Evidencia en revisiones de cambios. |
| 5 | Unitarias e integración | Plan de calidad | Implementar y ejecutar pruebas de dominio, permisos, PostgreSQL y adaptadores. Adjuntar resultados de CI. |
| 6 | E2E | Recorrido documentado | Automatizar catálogo, cotización, pedido y pago de prueba. Adjuntar informe del recorrido. |
| 7 | Interfaz y UX | Reglas de catálogo y AC09 | Implementar Angular responsive y documentar tareas de usuarios, errores y resultados. |
| 8 | Escalabilidad frontend/backend | C4 y perfil k6 | Medir CDN y comparar réplicas bajo el mismo perfil. Adjuntar latencia, errores y recursos. |
| 9 | Escalabilidad de BD | PostgreSQL e índices propuestos | Medir consultas, conexiones y bloqueos. Adjuntar planes y comparación antes/después. |
| 10 | Dominio/subdominio, DNS y CDN | Vista académica | Configurar dominio aceptado, HTTPS y CDN. Adjuntar resolución DNS y evidencia de caché de activos. |
| 11 | Caché | ADR-003 y vista académica | Implementar Redis para catálogo. Mostrar hit, miss, invalidación y resultado ante caída. |
| 12 | CI/CD | GitHub Actions previsto | Crear flujos y demostrar revisión, pruebas y despliegue reproducible. |
| 13 | Carga k6 | EQ-01, EQ-03 y EQ-06 | Ejecutar perfil hasta al menos 2.000 VU y prueba separada de sobreventa. Adjuntar scripts, versión, entorno y métricas. |
| 14 | Código y BD en GitHub | Documentación versionada | Versionar aplicación, migraciones y datos sintéticos reproducibles. Verificar instalación limpia. |
| 15 | Informe final | Evidencia documental Sprint 1 | Consolidar decisiones, ejecución y limitaciones con referencias a resultados. |
| 16 | Presentación y dominio | Presentación Sprint 1 | Preparar demo pública y videos de los flujos y pruebas que se ejecuten. |

La IA y la concurrencia se incorporan según lo informado en clase. Esta matriz refleja estado documental y evidencia prevista.

## Decisiones pendientes de aprobación

| ID | Propuesta | Afecta |
|---|---|---|
| D1 | Alta inicial mediante revisión autorizada y usuarios posteriores mediante invitación. Confirmar evidencia, roles combinables y alcance de validación de RUC. | Registro, permisos y migraciones. |
| D2 | Ante oferta aceptada vencida o inviable, solicitar una nueva cotización. Confirmar si se permite reapertura o cambio de oferta. | Estados y API de cotizaciones. |
| D3 | Permitir nuevo intento tras rechazo definitivo mientras siga activa la reserva. Confirmar duración, conciliación al vencer, cancelación y quién autoriza reembolso de cobro tardío. | Máquina de estados, tareas durables y UX. |
| D4 | Confirmar si la oferta separa transporte, impuestos y redondeo y cómo se tratan rangos sin precio. | Oferta, pedido y comparación. |
| D5 | Publicar con enlace del proveedor y conectar dominio propio o compartido si lo requiere la evaluación. Confirmar también PSE, avisos y validación externa de RUC por entrega. | Despliegue, presupuesto y cronograma. |
| D6 | Evaluar un modelo económico en Bedrock y confirmar cobertura y criterios de aceptación docente. | Adaptador, privacidad, costo y pruebas. |

## Plan SDD y primeras tareas para Codex

Para cada incremento versionar especificación de comportamiento, plan de implementación, tareas y pruebas de aceptación. Las decisiones abiertas se resuelven antes de fijar el comportamiento correspondiente.

| Tarea | Dependencia | Criterio de aceptación |
|---|---|---|
| T1 Base reproducible | Stack acordado | Angular, NestJS y PostgreSQL arrancan desde una instalación limpia; CI compila y ejecuta pruebas iniciales. |
| T2 Identidad y permisos | T1, D1 | Vinculación autorizada, pruebas de aislamiento y operaciones de proveedor verificado. |
| T3 Catálogo público e importación | T2, decisiones de inventario y D4 donde aplique | Lote aplicado una vez, errores por fila, sin cambios parciales, stock preservado y caché invalidada. |
| T4 Cotización y pedido | T2, T3, D2, D4 | Exclusividad de aceptación y reserva atómica probadas con PostgreSQL. |
| T5 Pago y reconciliación | T4, D3, credenciales de prueba | Aprobación, rechazo, timeout, duplicado y cobro tardío con evidencia de estados consistentes. |
| T6 Comparación asistida | T4, D4, D6 | Solo ofertas autorizadas, cálculo verificable y comparación disponible si falla el modelo. |
| T7 Despliegue, k6 y entrega | T1 para la demo; T3–T6 según el recorrido final; D5 | Enlace HTTPS y versión reproducible. Evidencias de CI, k6, seguridad, videos e informe. |

Referencias de implementación: [flujo comercial](03-diseno-de-software/flujo-comercial-sprint-2.md) · [despliegue académico](02-arquitectura-software/despliegue-academico.md) · [plan de calidad](01-analisis-de-sistema/09-plan-de-medicion-calidad.md).
