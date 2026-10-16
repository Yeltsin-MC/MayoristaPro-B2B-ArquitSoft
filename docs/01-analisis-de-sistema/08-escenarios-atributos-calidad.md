# Escenarios de atributos de calidad del Marketplace

## EQ-01. Rendimiento: búsqueda y confirmación de pedidos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Rendimiento |
| **Fuente** | Comprador empresarial |
| **Estímulo** | El comprador busca productos, solicita cotizaciones o confirma un pedido. |
| **Condición** | El sistema opera con datos representativos y alta concurrencia (campaña escolar o navideña). |
| **Respuesta esperada** | El sistema muestra resultados de búsqueda, cotizaciones o confirmación de pedido sin errores inesperados. |
| **Medida** | **Propuesta por validar:** el 95 % de las consultas responde en 500 ms o menos, con menos del 1 % de errores técnicos, durante una prueba con 2,000 usuarios simultáneos. |
| **Verificación** | Ejecutar pruebas de carga con k6 y registrar tiempos de respuesta, errores y usuarios concurrentes. |
| **Estado** | Pendiente de aprobación de las medidas y definición del entorno de prueba. |

## EQ-02. Disponibilidad: continuidad durante campañas comerciales

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Disponibilidad |
| **Fuente** | Proveedor mayorista / Comprador empresarial |
| **Estímulo** | El usuario intenta operar durante una campaña comercial (escolar, navideña, cierre de mes) o cuando falla un componente. |
| **Condición** | El sistema está desplegado en AWS con monitoreo activo (CloudWatch). |
| **Respuesta esperada** | El sistema mantiene disponibles las operaciones críticas y comunica errores de forma controlada cuando un servicio externo no responde. |
| **Medida** | **Propuesta por validar:** disponibilidad mensual de 99.5 % para operaciones críticas; RTO de 4 horas y RPO de 1 hora. |
| **Verificación** | Revisar los registros de Amazon CloudWatch y calcular los períodos de disponibilidad e interrupción. |
| **Estado** | Pendiente de aprobar la meta, definir operaciones críticas y condiciones de mantenimiento. |

## EQ-03. Escalabilidad: aumento de usuarios concurrentes

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Escalabilidad |
| **Fuente** | Incremento de solicitudes de compradores y proveedores |
| **Estímulo** | Aumenta la cantidad de usuarios que utilizan MayoristaPro simultáneamente. |
| **Condición** | Se realiza una prueba con datos, configuración y solicitudes documentadas. |
| **Respuesta esperada** | El sistema soporta el aumento de usuarios sin superar los límites acordados de tiempo de respuesta y errores. |
| **Medida** | **Propuesta por validar:** soportar hasta 2,000 usuarios simultáneos, con el 95 % de las respuestas por debajo de 500 ms y menos del 1 % de errores técnicos. |
| **Verificación** | Aumentar progresivamente la carga con k6 y comparar tiempos de respuesta, errores y uso de recursos. |
| **Estado** | Pendiente de confirmar la cantidad esperada de usuarios y la infraestructura de prueba. |

## EQ-04. Seguridad: acceso a operaciones protegidas

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Seguridad |
| **Fuente** | Usuario sin sesión, con credenciales inválidas o sin permisos suficientes |
| **Estímulo** | El usuario intenta acceder a una función protegida o realizar una operación no autorizada. |
| **Condición** | Se realizan pruebas sobre las funciones protegidas de MayoristaPro. |
| **Respuesta esperada** | El sistema rechaza la operación, no ejecuta el cambio solicitado y no expone información sensible. |
| **Medida** | Rechazar el 100 % de los intentos no autorizados incluidos en las pruebas definidas, sin exposición de datos sensibles en las respuestas revisadas. |
| **Verificación** | Ejecutar pruebas de acceso autorizado y no autorizado, revisar respuestas y comprobar que no se expongan datos sensibles. |
| **Estado** | Pendiente de definir los permisos por tipo de usuario y las operaciones protegidas. |

## EQ-05. Mantenibilidad: cambios sin afectar otras funciones

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Mantenibilidad |
| **Fuente** | Equipo de desarrollo |
| **Estímulo** | Se modifica una regla de negocio o se necesita sustituir el proveedor de pagos o el servicio de IA. |
| **Condición** | El sistema está organizado en capas (Clean Architecture) y dispone de pruebas para las funciones afectadas. |
| **Respuesta esperada** | El cambio se concentra en el módulo responsable sin afectar funciones no relacionadas, salvo que exista una dependencia justificada. |
| **Medida** | Las pruebas del módulo modificado y las pruebas de regresión acordadas deben aprobarse. Las dependencias entre módulos deben respetar las reglas de Clean Architecture. |
| **Verificación** | Revisar los cambios de código, ejecutar las pruebas e inspeccionar las dependencias entre módulos. |
| **Estado** | Pendiente de definir las reglas de dependencias y las pruebas obligatorias para los cambios. |

## EQ-06. Concurrencia: integridad del stock ante pedidos simultáneos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Concurrencia |
| **Fuente** | Múltiples compradores empresariales |
| **Estímulo** | Varios compradores confirman pedidos simultáneamente sobre el mismo producto con stock limitado. |
| **Condición** | El sistema opera con datos representativos y procesa las confirmaciones en paralelo. |
| **Respuesta esperada** | El sistema acepta únicamente los pedidos que pueden cubrirse con el stock disponible, rechaza los restantes y no genera sobreventa ni stock negativo. |
| **Medida** | Con 500 compradores intentando adquirir un producto con 100 unidades disponibles, el sistema debe aceptar exactamente 100 pedidos y rechazar los 400 restantes, sin sobreventa ni stock negativo. |
| **Verificación** | Ejecutar pruebas de concurrencia con k6 simulado 500 confirmaciones simultáneas y validar el número de pedidos aceptados y rechazados. |
| **Estado** | Pendiente de definir el entorno de prueba y el producto de prueba con stock limitado. |

## EQ-07. Interoperabilidad: integración con servicios externos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Interoperabilidad |
| **Fuente** | Servicios externos (SUNAT/PSE, pasarela de pagos, IA, notificaciones) |
| **Estímulo** | El sistema debe emitir un comprobante electrónico, procesar un pago o generar una recomendación con IA. |
| **Condición** | Los servicios externos están disponibles en modo sandbox y responden dentro de los tiempos acordados. |
| **Respuesta esperada** | El sistema se comunica correctamente con el servicio externo, procesa la respuesta y actualiza el estado correspondiente en la plataforma. |
| **Medida** | El 100 % de las integraciones críticas (PSE, pasarela, IA, notificaciones) debe responder exitosamente en modo sandbox durante las pruebas definidas. |
| **Verificación** | Ejecutar pruebas de integración con cada servicio externo en sandbox y validar las respuestas, errores y reintentos. |
| **Estado** | Pendiente de definir los contratos de API y los escenarios de prueba por servicio. |

---

## Resumen de escenarios

| Código | Atributo de calidad | Qué se busca comprobar |
|---|---|---|
| EQ-01 | Rendimiento | Que MayoristaPro responda dentro del tiempo establecido en picos de concurrencia. |
| EQ-02 | Disponibilidad | Que las operaciones críticas estén disponibles durante campañas comerciales. |
| EQ-03 | Escalabilidad | Que el sistema soporte un aumento de usuarios dentro de los límites definidos. |
| EQ-04 | Seguridad | Que las operaciones protegidas no puedan ejecutarse sin autorización. |
| EQ-05 | Mantenibilidad | Que los cambios puedan realizarse sin afectar innecesariamente otras funciones. |
| EQ-06 | Concurrencia | Que el stock se mantenga íntegro ante confirmaciones simultáneas de pedidos. |
| EQ-07 | Interoperabilidad | Que las integraciones con servicios externos funcionen correctamente en sandbox. |
