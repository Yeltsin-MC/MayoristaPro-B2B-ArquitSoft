const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { tradeFixture } = require('./trade-fixture.cjs');

test('EC01-07: portada, filtros paginados, detalle y solicitud real en escritorio y movil', { timeout: 120000 }, async () => {
  const f = await tradeFixture();
  let browser;
  const artifact = 'docs/evidencias/experiencia-catalogo';
  const results = [];
  try {
    await f.db.query("UPDATE suppliers SET name='Distribuidora Oficina (demo)' WHERE id=$1", [f.accounts.vendor.supplier]);
    const example = (await readFile('docs/datos-demo/catalogo-exposicion.csv', 'utf8')).trim();
    const rows = Array.from({ length: 14 }, (_, i) =>
      `DEMO-PAG-${i},Cuaderno de oficina ${i + 1} (demo),Cuadernos,caja,12,48.00,PEN,true,2,1,30,true`);
    const form = new FormData();
    form.append('file', new Blob([example + '\n' + rows.join('\n')]), 'exposicion-demo.csv');
    const preview = await fetch(f.base + 'products/imports/preview', {
      method: 'POST', headers: { Authorization: 'Bearer ' + f.accounts.vendor.token }, body: form,
    });
    assert.equal(preview.status, 201);
    const batch = await preview.json();
    assert.equal(batch.status, 'preview', JSON.stringify(batch.errors));
    const confirmed = await f.call('products/imports/' + batch.id + '/confirm', 'POST', { previewHash: batch.previewHash },
      'vendor', { 'Idempotency-Key': 'experiencia-' + batch.id });
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
    const firstPage = await f.call('products?page=1&limit=12', 'GET', undefined, null);
    const firstPageNames = firstPage.body.items.map(product => product.name);
    const secondPage = await f.call('products?page=2&limit=12', 'GET', undefined, null);
    assert.equal(secondPage.body.items.length, 12);
    const outsideFirstPage = secondPage.body.items.find(product => product.name.endsWith('(demo)'));
    assert.ok(outsideFirstPage, 'La segunda pagina incluye una fila demo con nombre unico');
    await mkdir(artifact, { recursive: true });
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    for (const [label, width, height] of [['escritorio', 1440, 1050], ['movil', 390, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(f.base.replace('/api/v1/', '/'));
        await expect(page.locator('.product-card')).toHaveCount(12);
        await expect(page.locator('.hero-photo')).toBeVisible();
        assert.equal(await page.locator('.hero-photo').evaluate(img => img.complete && img.naturalWidth > 0), true);
        await expect(page.locator('.category-access')).toHaveCount(5);
        assert.equal(await page.locator('.category-access').first().textContent(), 'Cuadernos');
        for (const access of await page.locator('.category-access').all()) {
          assert.equal(await access.locator(':scope > app-catalog-photo').count(), 1);
          assert.equal(await access.locator(':scope > span').count(), 1, 'Solo imagen y nombre por acceso');
        }
        const categoryTop = await page.locator('#categorias').evaluate(el => el.getBoundingClientRect().top);
        assert.ok(categoryTop < (label === 'movil' ? 650 : 700), 'Categorias cerca del inicio');
        await page.screenshot({ path: `${artifact}/portada-${label}.png` });
        await page.getByRole('button', { name: 'Siguiente', exact: false }).click();
        await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
        await page.locator('.category-access').filter({ hasText: 'Cuadernos' }).click();
        await expect(page.locator('.active-filters')).toContainText('Cuadernos');
        await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
        await expect(page.locator('.category-access[aria-pressed="true"]')).toHaveText('Cuadernos');
        await expect(page.locator('.product-card')).toHaveCount(12);
        for (const tag of await page.locator('.product-card .category-tag').allTextContents()) assert.equal(tag, 'Cuadernos');
        await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
        await expect(page.locator('.product-card h3')).toHaveText(firstPageNames);
        assert.ok(!(await page.locator('.product-card h3').allTextContents()).includes(outsideFirstPage.name));
        await page.getByLabel('Buscar productos', { exact: true }).fill(outsideFirstPage.name);
        const searched = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/products' &&
          new URL(r.url()).searchParams.get('q') === outsideFirstPage.name);
        await page.getByRole('button', { name: 'Buscar', exact: false }).click();
        assert.equal((await searched).status(), 200);
        await expect(page.locator('.product-card')).toHaveCount(1);
        await expect(page.locator('.product-card h3')).toHaveText(outsideFirstPage.name);
        await page.locator('.category-access').filter({ hasText: 'Periféricos' }).click();
        await expect(page.locator('.product-card')).toHaveCount(2);
        await page.locator('.catalog-results').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${artifact}/tarjetas-${label}.png` });
        await page.locator('.category-access').filter({ hasText: 'Cuadernos' }).click();
        await page.getByLabel('Buscar productos', { exact: true }).fill('Cuaderno A4 espiral (demo)');
        await page.getByRole('button', { name: 'Buscar', exact: false }).click();
        await expect(page.locator('.product-card')).toHaveCount(1);
        await page.getByRole('button', { name: 'Ver producto Cuaderno A4 espiral (demo)', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Caja de 12 unidades', { ignoreCase: true });
        await expect(dialog).toContainText('S/ 48.00');
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await page.getByRole('button', { name: 'Ver producto Cuaderno A4 espiral (demo)', exact: true }).click();
        await dialog.getByRole('button', { name: 'Solicitar cotización', exact: false }).click();
        await expect(page.getByText(/Ingresa con tu cuenta compradora/)).toBeVisible();
        await page.getByLabel('Correo', { exact: true }).fill(f.accounts.buyer.email);
        await page.getByLabel(/^Contraseña/).fill(f.password);
        await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Solicitar cotización', exact: true })).toBeVisible();
        await expect(page.locator('.quotation-product')).toContainText('Cuaderno A4 espiral (demo)');
        await expect(page.getByLabel('Cantidad de presentaciones', { exact: true })).toHaveValue('2');
        await expect(page.locator('.quotation-product')).toContainText('Distribuidora Oficina (demo)');
        const sent = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/quotations');
        await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
        const response = await sent;
        assert.equal(response.status(), 201);
        const quotation = await response.json();
        assert.equal(quotation.items[0].description, 'Cuaderno A4 espiral (demo)');
        assert.equal(quotation.items[0].quantity, 2);
        assert.equal(quotation.suppliers[0].id, f.accounts.vendor.supplier);
        assert.equal((await f.call('quotations/' + quotation.id, 'GET', undefined, 'buyer2')).status, 404);
        await page.locator('.header-nav').getByRole('button', { name: 'Mis cotizaciones', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Mis cotizaciones', exact: true })).toBeInViewport();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        // Cabecera, accesos y búsqueda tienen áreas independientes y al menos 44px.
        await page.evaluate(() => scrollTo(0, 0));
        const controls = await page.locator('.header-content button, .account-link, .header-nav a, .header-nav button').evaluateAll(elements =>
          elements.map(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { height: r.height, clear: el.contains(top) }; }));
        assert.ok(controls.every(control => control.height >= 44 && control.clear));
        if (label === 'movil') {
          await page.setViewportSize({ width: 320, height: 740 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        assert.deepEqual(errors, []);
        results.push({ viewport: `${width}x${height}`, quotationId: quotation.id, outsideFirstPage: outsideFirstPage.name,
          categoriesFromCompleteCatalog: true, stockAndPricingVisible: true, headerOverlap: false, javascriptErrors: errors });
      } finally { await context.close(); }
    }
    await writeFile(artifact + '/resultado.json', JSON.stringify({ generatedAt: new Date().toISOString(),
      browser: await browser.version(), data: 'CSV T3 y 14 filas adicionales en esquema PostgreSQL aislado', results }, null, 2));
  } finally {
    if (browser) await browser.close();
    await f.close();
  }
});