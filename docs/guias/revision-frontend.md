# Revisión del frontend

Criterios para revisar `apps/web` después de cada cambio visual. Sirven para el agente de Claude Code (`.claude/agents/revisor-frontend.md`) y para Codex o Kiro: pásales este archivo y pídeles que lo sigan.

## Cómo correr la revisión

1. Levanta la demo (ver [puertos.md](puertos.md)):
   - Terminal 1: inicia PostgreSQL con `pg_ctl` y déjala abierta.
   - Terminal 2: `npm run build` y luego `npm run demo:catalog:api`.
2. En otra terminal: `npm run revisar:front` (solo mediciones) o `npm run revisar:front -- --capturas` (también guarda capturas).
3. Resultado en `revision-frontend/informe.json` (no se sube a Git).

Con Claude Code: escribe *"usa el agente revisor-frontend"*.

## Qué mide el script

| Revisión | Regla |
|---|---|
| Scroll horizontal | La página no debe ser más ancha que la pantalla (320 a 1366 px). |
| Elementos que se salen | Nada se sale por el costado, salvo dentro de filas con scroll propio. |
| Controles táctiles | Botones, enlaces del encabezado, selects e inputs de al menos 44 px de alto. |
| Emojis y símbolos | Dentro de botones, enlaces y títulos van con `aria-hidden="true"`. |
| Imágenes | Con `alt` y cargadas. |
| Texto | Nada visible por debajo de 10 px. |
| Consola | Sin errores de JavaScript (se ignora el 401 de la sesión sin iniciar). |

## Criterios de diseño acordados

- **Paleta:** variables en `:root` de `styles.css`: `--brand` (azul de acciones), `--brand-dark`, `--brand-soft`, `--navy` (pie y bandas oscuras), `--sale` (solo descuentos), `--ink`, `--muted`, `--border`, `--page`. No usar colores sueltos.
- **Minimalista:** poco texto, un botón principal por bloque; los secundarios son blancos con borde del color de marca.
- **Tarjetas:** imágenes del mismo tamaño; sin franjas laterales de color; el estado va en píldora gris con punto de color.
- **Portada:** sin franja superior; carrusel que se desliza solo con imágenes del mismo marco.
- **Catálogo:** filtros fijos a la izquierda en PC; en celular, 2 productos por fila.
- **Celular:** categorías centradas (4 por fila), menú de categorías con botón, proveedores 2 por fila con «Ver todos».
- **Pruebas de navegador:** encabezado con controles de al menos 44 px y categorías a menos de 650 px del inicio en celular.
