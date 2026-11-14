# SDD — Catálogo mayorista demo de 150 productos

## Alcance y dependencia

Rama `sprint-2/catalogo-demo-150`, basada en `sprint-2/experiencia-catalogo-b2b` del PR #7, commit `45b9678`. El PR #7 sigue abierto: este incremento depende de su portada, filtros y continuidad de sesión/cotización. Se entrega como PR apilado sobre esa rama; después de incorporar #7, debe revisarse contra `main`. Ninguna fusión ni recurso AWS están autorizados en esta entrega.

Se reutilizan T2 (alta revisada manualmente, aprobación y verificación separada del proveedor), T3 (CSV, vista previa y confirmación atómica por SKU/proveedor) y T4 (solicitud, respuestas privadas y pedido). No se insertan directamente empresas/productos para saltar sus reglas. El administrador se crea con el script de bootstrap existente. Las consultas SQL del cargador son de comprobación y creación del esquema aislado.

## Datos y reglas

Todas las empresas son ficticias (15 proveedores, 30 productos cada uno: 450 productos). Desde noviembre 2026 los nombres ya no llevan `(demo)`; el pie de página indica que las empresas y productos son ficticios. Precios ilustrativos en PEN por presentación, con IGV incluido; no representan precios de mercado, descuentos ni relaciones comerciales reales.

| Proveedor ficticio | Rubro | CSV | Productos |
|---|---|---|---|
| Demo Lirio Papelería | Librería y papelería | `lirio.csv` | 30 |
| Demo Cobre Oficina | Suministros de oficina | `cobre.csv` | 30 |
| Demo Quilla Tecnología | Tecnología y periféricos | `quilla.csv` | 30 |
| Demo Miga Insumos | Insumos secos de panadería | `miga.csv` | 30 |
| Demo Trazo Acabados | Acabados para construcción | `trazo.csv` | 30 |

Los archivos y el manifiesto están en `database/demo/catalogo150/`. SKU estable `D150-<CÓDIGO>-001` a `030`, único dentro del proveedor. Cada fila fija categoría, presentación, contenido, precio de dos decimales, mínimo, múltiplo, stock en presentaciones y publicación. Ejemplos: cuaderno por caja de 12; bolígrafos en paquetes de 24; harina por saco cerrado de 25 kg.

El modelo vigente cuenta presentaciones enteras, no kilos fraccionarios: un saco cerrado contiene una unidad comercial, `unidades_por_presentacion=1`, y su peso queda en el nombre. Las cajas de bolsas indican cuántas bolsas cerradas contienen. No se habilita venta por peso ni conversión de precios por kg. Esa ampliación requeriría otra decisión comercial/contrato.

La compradora **Demo Mostrador Compras (ficticia)** es una sexta empresa habilitada para comprar, con su proveedor interno pendiente de verificación, conforme a T2. Por eso hay **cinco proveedores verificados visibles**, no cinco registros internos totales de proveedor.

No se amplían tablas, permisos ni transacciones. Se reutilizan fotos referenciales actuales para oficina/tecnología y un icono de categoría para panadería/construcción; no se atribuye a un producto una foto propia inexistente.

## Carga reproducible y aislamiento

Requisitos: PostgreSQL existente accesible mediante `DATABASE_URL` en `.env`, dependencias instaladas y Node compatible con el proyecto. El usuario PostgreSQL necesita crear esquemas. La configuración privada y las contraseñas nunca se agregan a Git.

Desde la raíz, en PowerShell:

```powershell
$env:ADMIN_EMAIL = 'admin-demo150@example.test'
$env:ADMIN_PASSWORD = Read-Host 'Contraseña del administrador demo (12 a 128 caracteres)'
$env:DEMO_PASSWORD = Read-Host 'Contraseña de cuentas demo (12 a 128 caracteres)'
npm run build
npm run demo:catalog:load
npm run demo:catalog:quote
npm run demo:catalog:api
```

Se espera: compilación correcta; resumen `suppliers: 15`, `products: 450`, `categories: 15`, `quotable: 450`; solicitud con dos ofertas; servidor en **http://localhost:3300**. La carga abre una API local transitoria en un puerto libre y la cierra al terminar. No requiere detener la API/Web anterior ni ejecutar `db:seed`.

Opcionalmente, guarda estas variables en **`.env.demo-catalog150`**, ignorado por Git, para reutilizarlas en nuevas terminales. Los scripts lo leen después de `.env`. En esta laptop ya se generó ese archivo privado; no se transcriben sus valores en documentación, capturas ni salida de comandos. Conserva las mismas contraseñas al repetir la carga: no se restablecen cuentas existentes.

El cargador crea `demo_mayoristapro150` y aplica las migraciones existentes con `search_path` aislado. Los datos anteriores de `public` se conservan; el puerto 4200 sigue mostrando su base anterior. Abre **3300** para esta demo. `DEMO_CATALOG_SCHEMA` admite únicamente el prefijo controlado `demo_mayoristapro150`; `DEMO_PORT` cambia 3300 y `DEMO_PUBLIC_URL` el origen autorizado. `DATABASE_URL` conserva la conexión PostgreSQL configurada; no publiques sus valores.

Cada proveedor se registra si falta, el administrador aprueba su solicitud, lo verifica y el propietario importa su CSV. Repetir `demo:catalog:load` actualiza los mismos SKU, **no duplica productos ni repone stock**. T3 conserva las existencias actuales, incluidos los descuentos de pedidos. Se serializan cargas del mismo esquema mediante advisory lock. Un lote inválido falla sin aplicar ese lote; los cinco lotes son operaciones separadas. Ante fallo de un lote, corrige su CSV y repite la carga. No se ofrece una transacción ficticia que abarque las cinco empresas.

No ejecutes `db:seed` con el esquema demo: agregaría productos ajenos al conjunto de 150. No hay borrado ni reinicio automático de datos demo.

## Comparación preparada

`demo:catalog:quote` crea **una nueva solicitud por ejecución**, usando credenciales del entorno en memoria, y deja dos ofertas abiertas durante 24 horas. No acepta ofertas ni crea pedidos automáticamente. Para renovar ofertas vencidas, ejecuta de nuevo ese comando.

| Referencia equivalente | Lirio | Cobre | Cantidad válida común |
|---|---|---|---|
| Papel A4 blanco 75 g, caja de 5 resmas | S/ 89.90; mínimo 1, múltiplo 1 | S/ 84.00; mínimo 2, múltiplo 2 | 2 cajas |
| Bolígrafo azul 1 mm, paquete de 24 | S/ 24.00; mínimo 2, múltiplo 2 | S/ 22.50; mínimo 3, múltiplo 3 | 6 paquetes |

Para las dos cajas de A4: Lirio S/ 179.80 + envío S/ 8.00 = **S/ 187.80**, plazo 2 días; Cobre S/ 168.00 + envío S/ 12.00 = **S/ 180.00**, plazo 5 días. El servidor calcula el total exacto por las reglas T4. Equivalencia curada explícitamente por descripción y empaque, sin deducirla de SKU entre proveedores.

Recorrido manual:

1. Abre 3300, recorre las cinco categorías y busca `Papel A4`. Aparecen las dos ofertas del catálogo.
2. En Cobre, una caja es inválida; dos cajas habilitan cotizar. Pulsa **Solicitar cotización** e ingresa como `demo-comprador150@example.test`, usando `DEMO_PASSWORD` local.
3. La solicitud conserva producto, presentación y dos cajas. Selecciona también **Demo Lirio Papelería (ficticia)** y envíala.
4. Cada proveedor (`demo-lirio@example.test` / `demo-cobre@example.test`, contraseña local `DEMO_PASSWORD`) abre la solicitud y responde con su SKU terminado `001`, precio, envío y plazo de la tabla, y vigencia futura.
5. Regresa al comprador y abre la solicitud: compara cantidades, precio, envío, total, plazo y vigencia. Alternativamente abre la solicitud con dos respuestas creada por `demo:catalog:quote`.
6. Aceptar no reserva; crear el pedido pendiente sí reserva por T4. Repetir la carga conserva esa reducción. No es necesario crear un pedido para exponer la comparación.

## Criterios y evidencia

| Criterio | Comprobación |
|---|---|
| CD01: quince proveedores habilitados/verificados, 30 productos cada uno | `tests/demo-catalog.integration.cjs`, carga por T2/T3 y conteos 15/450/15/450 |
| CD02: búsqueda y categoría sobre todo el conjunto paginado | Misma prueba: búsqueda A4, cinco categorías, páginas 12+12+6 y página vacía |
| CD03: cotización a dos proveedores con ofertas comparables | Misma prueba: dos cajas, totales 187.80/180.00 y plazos 2/5; navegador escritorio/móvil |
| CD04: rechazar cantidad inferior al mínimo | API de respuesta rechaza con HTTP **422**, mensaje de mínimo y cero ofertas guardadas; tarjeta Cobre deshabilitada con una caja |
| CD05: recarga sin duplicados y preservando stock modificado por pedido | Misma prueba: pedido real reduce 24 a 22, reimportación 0 creados/30 actualizados por proveedor, stock sigue 22 y un pedido |
| CD06: visuales y continuidad comprador actuales | Edge escritorio 1440×1000 y móvil 390×844; cinco categorías, icono visible, búsqueda, cantidad, ingreso, solicitud real a dos empresas y comparación privada |

Resultado local real: **7/7 resultados Node aprobados** (seis comprobaciones y su contenedor), PostgreSQL real, aproximadamente 11 segundos. La primera ejecución detectó que la prueba esperaba 400; se ajustó al contrato existente 422 y se repitió correctamente. Compilación Angular y NestJS aprobada. Navegador sin errores JavaScript ni desbordamiento horizontal, en ambas dimensiones. Capturas y resultado estructurado en [evidencias](evidencias/catalogo-demo-150/resultado.json).

La prueba crea y elimina exclusivamente un esquema aleatorio `demo_mayoristapro150_test_*`. CI ya incluye automáticamente el archivo mediante `tests/*.integration.cjs`; la regresión completa se delega a GitHub Actions. Su resultado y enlace se registrarán en el PR. No se repiten Redis/Compose localmente, ni se ejecuta k6, ni se despliega a AWS.
