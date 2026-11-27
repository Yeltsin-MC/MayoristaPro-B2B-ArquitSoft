# Colección Postman de MayoristaPro

Pruebas funcionales y de contrato de la API (guía de laboratorio 05, Sprint 2).
Son 31 solicitudes con 65 comprobaciones, que cubren casos válidos e inválidos del
flujo B2B completo: catálogo → login → cotización → oferta → aceptación → pedido.

| Carpeta | Qué comprueba |
|---|---|
| 1. Catálogo | Lista paginada con el esquema `Product` del contrato, búsqueda y orden por precio, filtros; 400 si el límite, el orden o el proveedor son inválidos; tiempo < 500 ms (EQ-01). |
| 2. Identidad | 401 con contraseña incorrecta y sin token; login de comprador y proveedor (guarda los tokens); 400 con un RUC inválido. |
| 3. Cotizaciones | 422 si la solicitud no tiene ítems o la docena no tiene 12 unidades; crear y consultar; 404 con un id inexistente; 422 si la vigencia no tiene zona horaria; el proveedor oferta; 403 si el proveedor intenta aceptar; el comprador acepta. |
| 4. Pedidos | 422 sin `Idempotency-Key`; crear un pedido (total = subtotal + envío); repetir la misma clave devuelve el mismo pedido; consultar y listar; 409 al despachar un pedido no pagado. |
| 5. Documentación e IA | `/api-docs/openapi.json` responde y el servicio de IA informa su estado. |

Todos los errores se validan contra el formato único `{ statusCode, code, message }`.

## Cómo ejecutarla en tu PC (demo 3300)

1. Inicia PostgreSQL en **su propia terminal** y déjala abierta:

   ```powershell
   $pg = "D:\mayorista-pg"   # carpeta de tu PostgreSQL portátil
   & "$pg\package\native\bin\pg_ctl.exe" -D "$pg\package\test-data" -l "$pg\postgres.log" -o "-p 5432" start
   ```

   Si dice *another server might be running* y luego *Permission denied* en el log, ya estaba iniciado: sigue.
2. En otra terminal, dentro del proyecto, levanta la demo de 15 empresas:

   ```powershell
   npm run puertos:liberar
   npm run build
   npm run demo:catalog:load
   npm run demo:catalog:api
   ```

   Comprueba que http://localhost:3300 abre la tienda.
3. En Postman: **Import** → arrastra los tres archivos de esta carpeta
   (`MayoristaPro.postman_collection.json` y los dos `*.postman_environment.json`).
4. Arriba a la derecha elige el entorno **MayoristaPro demo 3300** → pestaña *Environments* →
   en `password` escribe tu `DEMO_PASSWORD` local (columna *Current value*; no se guarda en el repositorio).
5. Clic derecho en la colección → **Run collection** → **Run MayoristaPro API**. No cambies el orden:
   cada carpeta guarda variables (tokens, ids) que usa la siguiente. Debe terminar con 65 aprobadas y 0 fallos.

Si falla *El proveedor del entorno (proveedorNombre) está en la lista*, el nombre de la empresa en el
entorno no coincide con la demo cargada: corrige `proveedorNombre` (debe ser la empresa de `proveedorEmail`).
Si fallan los logins (401), la contraseña no es la de la demo: `npm run demo:catalog:passwords` la restablece
con la de `.env.demo-catalog150`.

## Contra el sitio público (mayoristapro.shop)

Elige el entorno **MayoristaPro producción (mayoristapro.shop)** y escribe en `password` la contraseña
de las cuentas demo del servidor. Ejecuta la colección **una sola vez** (no es una prueba de carga).
Cada corrida deja en el sitio público una solicitud de cotización con una oferta aceptada y un pedido
pendiente de prueba del Minimarket San Juan Bautista a la Librería y Distribuidora Huamanga; el pedido
vence solo si no se paga. Evita correrla justo antes de la demo en vivo.

Desde la terminal, con [Newman](https://www.npmjs.com/package/newman):

```powershell
npx newman run postman/MayoristaPro.postman_collection.json `
  -e postman/demo-3300.postman_environment.json --env-var password=$env:DEMO_PASSWORD
```

Cada ejecución crea una solicitud de cotización y un pedido pendiente nuevos en la demo,
igual que un comprador real. El pedido vence solo si no se paga.

Evidencias:

- [ejecucion-demo-3300-2026-11-27.txt](../docs/sprint-2/evidencias/postman/ejecucion-demo-3300-2026-11-27.txt): 31 solicitudes, 65 comprobaciones aprobadas, 0 fallos, contra la demo de 15 empresas.
- [ejecucion-local-2026-11-20.txt](../docs/sprint-2/evidencias/postman/ejecucion-local-2026-11-20.txt): primera versión (64 comprobaciones) en la API de desarrollo.

Swagger UI con el mismo contrato: http://localhost:3300/api-docs/ (o http://localhost:3000/api-docs/ en desarrollo).
