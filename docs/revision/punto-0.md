# Punto 0: versión antes de las correcciones de la revisión

Este archivo marca el punto de partida de las correcciones de estructura sugeridas en la revisión del 13/11/2026.

| Dato | Valor |
|---|---|
| Commit base (`main`) | `8218f54` (Merge pull request #9, sprint-2/ux-cotizacion-comprador) |
| Etiqueta | `punto-0` (apunta a `8218f54`, si se pudo publicar) |
| Rama de correcciones | `claude/project-thread-bn6flv` |

Estado verificado en el punto 0:

- `npm run build`: correcto.
- `npm run test:unit`: correcto.
- `npm run test:integration`: 111 pruebas correctas, 0 fallidas.
- `npm run test:browser`: 12 pruebas correctas, 0 fallidas.

## Cómo volver al punto 0

- Ver el código tal como estaba: `git checkout 8218f54` (o `git checkout punto-0`).
- Deshacer una corrección concreta: cada corrección está en un commit separado; usar `git revert <commit>`.
- Si el PR ya se fusionó y se quiere descartar todo: `git revert -m 1 <commit-del-merge>`.

Cada commit posterior a este describe una sola corrección, para poder revisarlas o revertirlas por separado.
