#!/usr/bin/env node
/**
 * Revisión automática del frontend (sin capturas por defecto, para gastar pocos tokens).
 *
 * Uso:
 *   npm run revisar:front                      -> revisa http://localhost:3300 (demo)
 *   npm run revisar:front -- --url http://localhost:4200
 *   npm run revisar:front -- --capturas        -> además guarda capturas en revision-frontend/
 *
 * Requiere la app levantada (ver docs/guias/puertos.md). Escribe revision-frontend/informe.json
 * y muestra un resumen corto. Termina con código 1 si encuentra problemas.
 */
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const base = (args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:3300').replace(/\/$/, '');
const capturas = args.includes('--capturas');
const salida = join(__dirname, '..', 'revision-frontend');
const tamanos = [
  ['celular-chico', 320, 640],
  ['celular', 390, 844],
  ['tablet', 768, 1024],
  ['pc', 1366, 900],
];
const rutas = [
  ['portada', '/'],
  ['lista', '/lista'],
  ['cuenta', '/cuenta'],
];

/** Mediciones dentro de la página: desbordes, controles chicos, emojis visibles para lectores y colores sueltos. */
function medir(conEncabezado) {
  const problemas = [];
  const ancho = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > ancho + 1)
    problemas.push({ tipo: 'scroll-horizontal', detalle: `página de ${document.documentElement.scrollWidth}px en ${ancho}px` });
  const visible = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nombre = el => (el.getAttribute('aria-label') || el.innerText || el.className || el.tagName).trim().slice(0, 50);
  // Elementos que se salen por el costado (sin estar dentro de un contenedor con scroll propio).
  for (const el of document.querySelectorAll(conEncabezado ? 'main *, header *, footer *' : 'main *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > ancho + 2 || r.left < -2) {
      let p = el.parentElement, scroll = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroll = true; break; } p = p.parentElement; }
      if (!scroll) problemas.push({ tipo: 'se-sale', detalle: nombre(el) });
    }
  }
  // Controles táctiles de al menos 44 px de alto.
  const controles = 'main button, main a.button, main select, main input:not([type=checkbox]):not([type=radio])';
  for (const el of document.querySelectorAll(conEncabezado ? 'header button, header a, ' + controles : controles)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 44 && !el.closest('.hero-controls')) problemas.push({ tipo: 'control-chico', detalle: `${nombre(el)} (${Math.round(r.height)}px)` });
  }
  // Emojis o símbolos dentro de botones/títulos que el lector de pantalla leería (deben ir con aria-hidden).
  const simbolo = /[←-⯿\u{1F300}-\u{1FAFF}]/u;
  for (const el of document.querySelectorAll('button, a, h1, h2, h3, [role=button]')) {
    if (el.hasAttribute('aria-label')) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (simbolo.test(n.textContent) && !n.parentElement.closest('[aria-hidden="true"]')) {
        problemas.push({ tipo: 'emoji-sin-aria-hidden', detalle: nombre(el) });
        break;
      }
    }
  }
  // Imágenes deformadas o sin texto alternativo.
  for (const img of document.querySelectorAll('img')) {
    if (!visible(img)) continue;
    if (!img.hasAttribute('alt')) problemas.push({ tipo: 'imagen-sin-alt', detalle: img.getAttribute('src') });
    if (img.complete && img.naturalWidth === 0) problemas.push({ tipo: 'imagen-rota', detalle: img.getAttribute('src') });
  }
  // Texto demasiado pequeño para leer en celular.
  for (const el of document.querySelectorAll('main p, main span, main small, main li, main label')) {
    if (!visible(el) || !el.innerText?.trim() || el.closest('[aria-hidden="true"]')) continue;
    if (parseFloat(getComputedStyle(el).fontSize) < 10) problemas.push({ tipo: 'texto-muy-chico', detalle: el.innerText.trim().slice(0, 40) });
  }
  return problemas;
}

(async () => {
  await mkdir(salida, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const informe = { base, fecha: new Date().toISOString(), resultados: [] };
  try {
    for (const [tamano, width, height] of tamanos) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      for (const [ruta, path] of rutas) {
        const page = await context.newPage();
        const errores = [];
        page.on('pageerror', e => errores.push(e.message));
        // 401 es normal sin sesión iniciada (la app consulta la sesión al cargar).
        page.on('console', m => m.type() === 'error' && !m.text().includes('401') && errores.push(m.text()));
        await page.goto(base + path, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        // El encabezado y el pie son iguales en todas las rutas: se miden solo en la primera.
        const problemas = await page.evaluate(medir, ruta === rutas[0][0]);
        // Agrupa repetidos (por ejemplo, 12 tarjetas con el mismo problema).
        const unicos = Object.values(problemas.reduce((acc, p) => {
          const k = p.tipo + '|' + p.detalle;
          acc[k] = acc[k] ? { ...acc[k], veces: acc[k].veces + 1 } : { ...p, veces: 1 };
          return acc;
        }, {}));
        for (const e of errores) unicos.push({ tipo: 'error-consola', detalle: e.slice(0, 120), veces: 1 });
        if (capturas) await page.screenshot({ path: join(salida, `${ruta}-${tamano}.png`), fullPage: true });
        informe.resultados.push({ ruta, tamano, problemas: unicos });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(salida, 'informe.json'), JSON.stringify(informe, null, 2));
  let total = 0;
  for (const r of informe.resultados) {
    total += r.problemas.length;
    console.log(`${r.problemas.length ? '✗' : '✓'} ${r.ruta} en ${r.tamano}: ${r.problemas.length} problema(s)`);
    for (const p of r.problemas.slice(0, 8)) console.log(`    - ${p.tipo}: ${p.detalle}${p.veces > 1 ? ` (x${p.veces})` : ''}`);
    if (r.problemas.length > 8) console.log(`    … y ${r.problemas.length - 8} más en revision-frontend/informe.json`);
  }
  console.log(total ? `\n${total} problema(s). Detalle: revision-frontend/informe.json` : '\nSin problemas.');
  process.exitCode = total ? 1 : 0;
})().catch(error => {
  console.error('No se pudo revisar ' + base + ': ' + error.message);
  console.error('¿Está levantada la app? Ver docs/guias/puertos.md');
  process.exitCode = 2;
});
