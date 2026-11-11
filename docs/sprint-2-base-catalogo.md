# Sprint 2 · Base y catálogo de prueba

El primer recorrido muestra ofertas publicadas de proveedores verificados. Angular llama a NestJS y el backend lee PostgreSQL. Los registros de ejemplo son sintéticos.

## Ejecutar en VS Code

Requisitos: Node.js 24.15 o posterior dentro de la rama 24, y Docker con Compose. También puedes usar PostgreSQL 17 ya instalado y configurar una base vacía en `DATABASE_URL`.

Desde la raíz del repositorio, en PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
```

Copia `.env.example` solo en la instalación inicial. Las credenciales incluidas son para desarrollo local. Para usar una base existente, configura `.env` y omite Docker.

En una terminal ejecuta `npm run dev:api` y en otra `npm run dev:web`. Abre [el catálogo local](http://localhost:4200) o consulta [la API local](http://localhost:3000/api/v1/products). El servidor de desarrollo de Angular reenvía `/api` a NestJS.

## Verificar

```powershell
npm run build
npm run test:integration
```

La prueba requiere una base de prueba migrada y poblada. GitHub Actions compila ambas aplicaciones y ejecuta la prueba contra PostgreSQL. Para servir la compilación fuera del entorno local, enrutar `/api` al backend desde el mismo origen.

La migración contiene las tablas mínimas para el catálogo de prueba. Las siguientes migraciones incorporarán identidad, atributos y relaciones del [esquema comercial](03-diseno-de-software/esquema-base-de-datos.md) conforme se aprueben las reglas correspondientes.

La migración `002_identity.sql` incorpora [T2 — Identidad y vinculación empresarial](sprint-2-identidad.md), con D1 aprobada. El catálogo público y sus datos sintéticos se conservan. El alta empresarial, las invitaciones y la revisión administrativa se encuentran debajo del catálogo.
