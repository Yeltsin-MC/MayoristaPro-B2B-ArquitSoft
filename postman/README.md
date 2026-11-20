# Colección Postman de MayoristaPro

Pruebas funcionales y de contrato de la API (guía de laboratorio 05, Sprint 2).
Son 31 solicitudes con 64 comprobaciones, que cubren casos válidos e inválidos del
flujo B2B completo: catálogo → login → cotización → oferta → aceptación → pedido.

| Carpeta | Qué comprueba |
|---|---|
| 1. Catálogo | Lista paginada con el esquema `Product` del contrato, búsqueda y orden por precio, filtros; 400 si el límite, el orden o el proveedor son inválidos; tiempo < 500 ms (EQ-01). |
| 2. Identidad | 401 con contraseña incorrecta y sin token; login de comprador y proveedor (guarda los tokens); 400 con un RUC inválido. |
| 3. Cotizaciones | 422 si la solicitud no tiene ítems o la docena no tiene 12 unidades; crear y consultar; 404 con un id inexistente; 422 si la vigencia no tiene zona horaria; el proveedor oferta; 403 si el proveedor intenta aceptar; el comprador acepta. |
| 4. Pedidos | 422 sin `Idempotency-Key`; crear un pedido (total = subtotal + envío); repetir la misma clave devuelve el mismo pedido; consultar y listar; 409 al despachar un pedido no pagado. |
| 5. Documentación e IA | `/api-docs/openapi.json` responde y el servicio de IA informa su estado. |

Todos los errores se validan contra el formato único `{ statusCode, code, message }`.

## Cómo ejecutarla

1. Levanta la demo de 15 empresas en http://localhost:3300 (ver `docs/sprint-2-catalogo-demo-150.md`).
2. En Postman: **Import** → `MayoristaPro.postman_collection.json` y `demo-3300.postman_environment.json`.
3. Selecciona el entorno **MayoristaPro demo 3300** y escribe en `password` tu `DEMO_PASSWORD` local
   (no se guarda en el repositorio).
4. Clic derecho en la colección → **Run collection** → **Run**. Ejecuta las carpetas en orden:
   cada una guarda variables (tokens, ids) que usa la siguiente.

Desde la terminal, con [Newman](https://www.npmjs.com/package/newman):

```powershell
npx newman run postman/MayoristaPro.postman_collection.json `
  -e postman/demo-3300.postman_environment.json --env-var password=$env:DEMO_PASSWORD
```

Cada ejecución crea una solicitud de cotización y un pedido pendiente nuevos en la demo,
igual que un comprador real. El pedido vence solo si no se paga.

Evidencia: [docs/evidencias/postman/ejecucion-local-2026-11-20.txt](../docs/evidencias/postman/ejecucion-local-2026-11-20.txt)
(31 solicitudes, 64 comprobaciones aprobadas, 0 fallos; corrida en la API local con un comprador y un proveedor de prueba).

Swagger UI con el mismo contrato: http://localhost:3300/api-docs/ (o http://localhost:3000/api-docs/ en desarrollo).
