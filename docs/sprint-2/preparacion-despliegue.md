# T7 — Preparación del despliegue público

Rama `sprint-2/preparacion-despliegue`, desde `main` actualizado en `9c9f463`. El PR #5 de Redis, cabeza revisada `851dd10`, se fusionó con autorización en `eb0796f`. Esta rama incorporó ese main sin conflictos. El perfil cache continúa siendo opcional para el operador.

## Arranque preparado

Se reutiliza `compose.yaml` para PostgreSQL y se añade `compose.demo.yaml` como overlay. El proyecto Compose `mayoristapro-demo` utiliza su volumen persistente de datos. El arranque establece este orden

1. PostgreSQL recibe sus variables de entorno y alcanza el healthcheck.
2. El servicio `migrate` ejecuta el migrador versionado existente, que usa una transacción y su registro de migraciones. Con `DEMO_SEED=true` ejecuta el seed sintético idempotente.
3. FastAPI arranca con host y puerto configurables y supera su healthcheck.
4. NestJS arranca después del migrador y FastAPI. Comprueba el catálogo PostgreSQL antes de anunciar disponibilidad.
5. Nginx sirve Angular compilado y enruta `/api/` al puerto interno de NestJS conservando ruta y parámetros.
6. El worker ejecuta de forma secuencial los scripts existentes de expiración y recuperación de webhooks cada 120 segundos por defecto.

Las imágenes se construyen con Node 24, Python 3.11 y Nginx 1.28. El runtime API contiene las dependencias de producción, el código compilado, las migraciones y los workers. Las variables privadas y los entornos locales quedan excluidos del contexto de construcción y de Git.

## Variables y puertos

El ejemplo `.env.demo.example` se copia a `.env.demo`, que el operador completa y conserva localmente. PostgreSQL requiere una contraseña definida por el operador. `deployment/start.cjs` construye DATABASE_URL escapando usuario, contraseña y base, o reutiliza una DATABASE_URL ya proporcionada en el arranque nativo.

| Variable | Uso |
|---|---|
| POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | Inicialización de la base y conexión desde API, migrador y worker. |
| WEB_BIND, WEB_PORT | Dirección y puerto publicados por Nginx. Por defecto 127.0.0.1 y 8080. |
| PUBLIC_BASE_URL | Origen que verá el navegador y URL de retorno/notificación usada por las variables existentes FRONTEND_URL y API_URL. Ajustarlo al cambiar el enlace público. |
| API_PORT | Puerto interno de NestJS, por defecto 3000. HOST se fija a 0.0.0.0 dentro del contenedor. |
| AI_PORT, AI_SERVICE_URL | Puerto FastAPI, por defecto 5000, y URL interna configurable para NestJS. FastAPI usa AI_HOST dentro del contenedor. |
| DEMO_SEED | true habilita los tres productos sintéticos iniciales mediante el seed existente. |
| WORKER_INTERVAL_SECONDS | Intervalo entre ejecuciones secuenciales de los workers existentes. |
| REDIS_URL | Opcional. Preparada para activar la caché una vez integrado el PR #5. |
| MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET | Variables existentes reservadas para credenciales de sandbox gestionadas por el operador. La demo funciona en modo mock al faltar MP_ACCESS_TOKEN. |

Angular utiliza rutas relativas `/api/v1` en el mismo origen. Los secretos permanecen en los servicios backend y en las variables del operador.

## Red y acceso público posterior

Solo `web` publica un puerto. PostgreSQL, FastAPI y Redis están únicamente en `backend`, una red Docker interna. NestJS y el worker pertenecen a backend y edge para comunicarse con los servicios internos y permitir las integraciones salientes existentes. El overlay elimina la publicación de 5432 del Compose local base con `ports: !reset []`. Se utiliza Docker Compose 2.24.4 o posterior como versión mínima conservadora para el overlay.

Nginx aplica fallback SPA a las rutas del frontend. Las rutas `/api/` conservan respuestas JSON y códigos de NestJS, con timeout de conexión y lectura. La carga máxima de Nginx contempla el multipart del límite actual de 5 MiB de la API. `index.html` y `/api/` envían no-store; los archivos actuales de Angular se revalidan con no-cache. El acceso a archivos ocultos queda bloqueado.

Para conectar un enlace público después de autorizar infraestructura

- Elegir un enlace inicial gratuito o subdominio disponible, definir PUBLIC_BASE_URL con su URL HTTPS y registrar el costo y la cobertura de la opción elegida.
- Terminar TLS en el ingreso del proveedor o en un proxy HTTPS con certificado válido, delante de Nginx. Mantener el enlace Nginx local/interno como origen del ingreso.
- Si se utiliza Cloudflare Free, configurar DNS y Full (strict) hacia un origen HTTPS con certificado válido. Excluir `/api/*` y HTML de la caché CDN. Definir la política de activos según su versionado y verificar cabeceras.
- Revisar el alcance de red y los permisos del origen antes de abrir un puerto exterior. La compra del `.com` permanece pendiente de confirmación. El presupuesto informado es US$ 100 de crédito promocional AWS y aproximadamente S/ 65 personales. Verificar cobertura, vigencia y costo antes de autorizar recursos facturables.

La configuración usa las dependencias y condiciones de Compose y su mecanismo de overlay documentados por Docker. [Orden de arranque](https://docs.docker.com/compose/how-tos/startup-order/) · [Combinación de archivos Compose](https://docs.docker.com/reference/compose-file/merge/)

## Reproducir en PowerShell con Docker Compose disponible

Desde la raíz MayoristaPro-Kiro

```powershell
if (!(Test-Path .env.demo)) { Copy-Item .env.demo.example .env.demo }
# Completar POSTGRES_PASSWORD dentro del archivo privado .env.demo.
# Revisar PUBLIC_BASE_URL si se cambia WEB_PORT.
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml config --quiet
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml up -d --build
$env:DEMO_URL = 'http://127.0.0.1:8080'
node tests/deployment.smoke.cjs
```

Abrir <http://localhost:8080>. La base nueva recibe productos sintéticos. Para crear el primer administrador, definir ADMIN_EMAIL y ADMIN_PASSWORD en la terminal del operador y usar el provisionador existente

```powershell
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml exec -e ADMIN_EMAIL -e ADMIN_PASSWORD api node database/create-admin.cjs
```

Las empresas y cuentas se crean y aprueban con el flujo T2. El volumen conserva PostgreSQL entre arranques. Para detener esta demo

```powershell
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml down
```

### Arranque nativo con los servicios locales existentes

Para la demo local compilada, con la DATABASE_URL configurada en `.env`

```powershell
# Terminal 1, desde apps/ai-service, con el entorno Python existente:
$env:AI_HOST = '127.0.0.1'
$env:AI_PORT = '5055'
.\.venv\Scripts\python.exe main.py

# Terminal 2, desde la raíz del repositorio:
npm run build
$env:AI_SERVICE_URL = 'http://127.0.0.1:5055'
$env:HOST = '127.0.0.1'
$env:PORT = '3100'
node --env-file=.env deployment/start.cjs migrate
node --env-file=.env deployment/start.cjs api
```

Cada terminal necesita sus variables correspondientes. El worker nativo puede iniciarse con el mismo archivo de entorno mediante `node --env-file=.env deployment/start.cjs worker`.

## Redis opcional y comprobación posterior al PR #5

Con el PR #5 incorporado, reconstruir las imágenes y aplicar las migraciones, incluida 007. Configurar `REDIS_URL=redis://redis:6379` en `.env.demo` y activar el perfil

```powershell
docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml --profile cache up -d --build
```

La comprobación pendiente de integración conjunta verificará Redis interno listo, dos lecturas repetidas del catálogo, claves del namespace público y la invalidación de existencias. Se ejecutarán los tests focalizados de caché ya existentes en el CI combinado, y se repetirá el smoke del despliegue con el perfil activo y con Redis caído para confirmar fallback. La medición Redis ya registrada y el perfil k6 de 2.000 usuarios corresponden a evidencias separadas.

## Criterios y verificación

| ID | Criterio | Evidencia |
|---|---|---|
| T7-P01 | Configuración y secretos escapados correctamente | tests/deployment-env.test.cjs. |
| T7-P02 | Arranque del entrypoint real, catálogo y conexión a FastAPI | tests/deployment-start.integration.cjs. |
| T7-P03 | Imágenes reproducibles, migraciones y orden de servicios | Job deployment de GitHub Actions con Compose. |
| T7-P04 | Angular, proxy `/api`, fallback SPA y errores JSON conservados | tests/deployment.smoke.cjs contra Nginx. |
| T7-P05 | Solo web publicado; DB, FastAPI y Redis internos | Configuración Compose normalizada comprobada por smoke. |
| T7-P06 | Compatibilidad con T1–T6 | Job verify existente de GitHub Actions. |

## Resultados reales — 12 de noviembre de 2026

- Base revisada: `main` local y remoto en `9c9f463`. PR #5 abierto; Redis no forma parte de esta rama y su integración conjunta continúa pendiente.
- Local: compilación Angular y NestJS completada; 3/3 pruebas focalizadas de configuración y empaquetado; 1/1 prueba de arranque real contra PostgreSQL y FastAPI existentes. No se repitió localmente toda la regresión.
- GitHub Actions [43343548165](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/actions/runs/43343548165), commit probado `825a18dcb6a422ee5eb9f85a19c6ed593ad5d2d5`: jobs `verify` y `deployment` aprobados. Compilación aprobada; Python 11/11, unitarias Node 4/4, integración PostgreSQL 83/83, navegador 8/8 y UX 1/1.
- El job `deployment` construyó las imágenes y arrancó PostgreSQL, migrador, FastAPI, NestJS, worker y Nginx. Probó puertos internos distintos de los predeterminados (API 3010 y FastAPI 5056). Catálogo 200 con datos, bundle Angular y fallback SPA correctos; proxy conserva errores JSON; NestJS comunica con FastAPI; `.env` bloqueado; solo web publica puerto. Evidencia conservada en [arranque.json](evidencias/preparacion-despliegue/arranque.json).
- Docker no está instalado en esta laptop: la comprobación del stack Compose se realizó en el runner de CI, además de la comprobación nativa local. No se ejecutaron k6 ni la medición Redis. No se crearon recursos públicos ni se contrataron servicios.
- Se corrigió el empaquetado de workers copiando los scripts existentes junto a los módulos compilados para mantener sus imports relativos. La prueba focalizada comprueba su contenido y la resolución de dependencias. Las reglas de pedidos y pagos no cambiaron; Mercado Pago con credenciales de prueba sigue pendiente y los pagos de demo permanecen simulados.

Entrega en [PR #6](https://github.com/Yeltsin-MC/MayoristaPro-B2B-ArquitSoft/pull/6), sin fusionar. Tras integrar Redis, completar T7-P05 con el perfil `cache` activo y caído según la sección anterior. El despliegue público, HTTPS y la validación k6 de al menos 2.000 usuarios virtuales concurrentes continúan pendientes de sus autorizaciones y tareas.

## Integración conjunta autorizada de PR #5 y #6

PR #5 confirmado en `851dd10` con CI aprobado y fusionado en `eb0796f`. Rama #6 actualizada con ese main, sin conflictos. El job deployment activa `--profile cache` y `REDIS_URL=redis://redis:6379` y añade `tests/deployment-cache.smoke.cjs`.

La comprobación registra la migración 007, prueba un hit HTTP de la clave exacta con una marca sintética únicamente en Redis del runner, confirma que un commit de stock avanza la revisión y descarta el valor anterior, detiene realmente Redis y exige HTTP 200 con el siguiente stock de PostgreSQL. Finalmente restaura stock y reinicia Redis. No utiliza cuentas reales ni modifica reglas de negocio. El script puede ejecutarse con `node tests/deployment-cache.smoke.cjs` sobre el Compose aislado de prueba; DEMO_ENV_FILE permite indicar `.env.demo` en vez del ejemplo de CI. Nunca ejecutarlo sobre datos de producción.

La medición Redis anterior se conserva como evidencia y se retiró su ejecución automática de esta integración. k6 permanece pendiente. Resultado conjunto: pendiente de finalizar el CI de esta actualización. No fusionar #6 antes de que verify y deployment aprueben el commit actualizado.