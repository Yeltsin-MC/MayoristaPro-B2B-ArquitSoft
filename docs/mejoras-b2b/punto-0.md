# Punto 0: versión antes de las mejoras B2B

Este archivo marca el punto de partida de las mejoras B2B (precios por volumen y estados de despacho).

| Dato | Valor |
|---|---|
| Commit base (`main`) | `78af421` (Merge pull request #10, correcciones de la revisión) |
| Rama de mejoras | `claude/project-thread-lar0x1` |

## Cómo volver al punto 0

- Ver el código tal como estaba: `git checkout 78af421`.
- Deshacer una mejora concreta: cada mejora está en commits separados; usar `git revert <commit>`.
- Si el PR ya se fusionó y se quiere descartar todo: `git revert -m 1 <commit-del-merge>`.
- Base de datos: las mejoras solo agregan migraciones nuevas (`008_…`, `009_…`). Para volver atrás en una base ya migrada, usar una base nueva con `npm run db:migrate` desde el punto 0.

El detalle de cada mejora está en [cambios.md](cambios.md).
