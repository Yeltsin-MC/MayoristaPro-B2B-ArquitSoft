# Puertos del proyecto

Cada servicio tiene un puerto fijo. No los cambies: si un puerto está ocupado, libéralo con `npm run puertos:liberar` (Windows/PowerShell).

| Puerto | Servicio | Cómo se inicia |
|---|---|---|
| 5432 | PostgreSQL (base de datos) | Servicio de Windows o `docker compose up -d db` |
| 6379 | Redis (caché opcional) | Opcional |
| 3000 | API de desarrollo (NestJS) | `npm run dev:api` |
| 4200 | Web de desarrollo (Angular), usa la API 3000 | `npm run dev:web` |
| 3300 | Demo con 15 empresas y 450 productos (API + web) | `npm run build`, `npm run demo:catalog:load`, `npm run demo:catalog:api` |
| 5000 | Servicio de IA (FastAPI) para la API de desarrollo | `python -m uvicorn main:app --app-dir apps/ai-service --port 5000` |
| 5055 | Servicio de IA para la demo 3300 y las pruebas | `python -m uvicorn main:app --app-dir apps/ai-service --port 5055` |
| 8080 | Web de la demo en Docker | `docker compose -f compose.demo.yaml --env-file .env.demo up --build` |

## Liberar puertos

`npm run puertos:liberar` cierra los programas `node` y `python` que ocupan 3000, 3300, 4200, 5000, 5055 y 8080. Nunca cierra PostgreSQL ni Redis.

Para ver quién ocupa un puerto: `npm run puertos:ver`.

## Reglas para asistentes de IA (Codex, Kiro, Claude)

- Usa solo los puertos de esta tabla. No cambies `PORT`, `DEMO_PORT`, `proxy.conf.cjs` ni los compose para esquivar un puerto ocupado.
- Si aparece `EADDRINUSE`, el puerto lo tiene un servidor anterior: ejecuta `npm run puertos:liberar` y vuelve a iniciar.
- No cierres 5432 (PostgreSQL) ni 6379 (Redis).
