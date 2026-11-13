const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { tradeFixture } = require('./trade-fixture.cjs');

test('EC09-11: imagenes y cantidad mayorista conservada hasta solicitud privada', { timeout: 120000 }, async () => {
  const f = await tradeFixture();
  let browser;
  const folder = 'docs/evidencias/cantidad-mayorista';
  const results = [];
  try {
    const csv = (await readFile('docs/datos-demo/catalogo-exposicion.csv', 'utf8')).trim().split('\n');
    const row = csv.find(line => line.startsWith('DEMO-CUA-01,'));
    const form = new FormData();
    form.append('file', new Blob([csv[0] + '\n' + row.replace(',2,1,40,true', ',2,2,10,true')]), 'cantidad-demo.csv');
    const response = await fetch(f.base + 'products/imports/preview', {
      method: 'POST', headers: { Authorization: 'Bearer ' + f.accounts.vendor.token }, body: form,
    });
    assert.equal(response.status, 201);
    const batch = await response.json();
    assert.equal(batch.status, 'preview');
    assert.equal((await f.call('products/imports/' + batch.id + '/confirm', 'POST', { previewHash: batch.previewHash },
      'vendor', { 'Idempotency-Key': 'cantidad-' + batch.id })).status, 201);
    await f.db.query('UPDATE products SET stock=1 WHERE id=$1', [f.products.vendor2.id]);
    await mkdir(folder, { recursive: true });
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    for (const [label, width, height] of [['escritorio', 1440, 1050], ['movil', 390, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const images = [];
      const errors = [];
      let sentCount = 0;
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {
        if (r.url().includes('/images/')) images.push({ url: new URL(r.url()).pathname, status: r.status(), type: r.headers()['content-type'] });
        if (r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/quotations') sentCount++;
      });
      try {
        await page.goto(f.base.replace('/api/v1/', '/'));
        const card = page.locator('.product-card').filter({ has: page.getByRole('heading', { name: 'Cuaderno A4 espiral (demo)', exact: true }) });
        await expect(card).toBeVisible();
        for (const selector of ['.hero-photo', '.category-photo img', '.product-visual img']) {
          const pictures = page.locator(selector);
          assert.ok(await pictures.count() > 0, selector);
          await expect.poll(() => pictures.evaluateAll(list => list.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
        }
        assert.ok(images.every(image => image.status === 200 && image.type.startsWith('image/')));
        await expect(card).toContainText('por caja de 12 unidades');
        await expect(card).toContainText('S/ 48.00');
        await expect(card.locator('dl')).toContainText('2 cajas');
        const quantity = card.getByRole('spinbutton');
        const quote = card.getByRole('button', { name: 'Solicitar cotización', exact: false });
        await expect(quantity).toHaveValue('2');
        await quantity.fill('1');
        await expect(card.locator('.quantity-error')).toContainText('mínimo');
        await expect(quote).toBeDisabled();
        await quantity.fill('3');
        await expect(card.locator('.quantity-error')).toContainText('múltiplo');
        await expect(quote).toBeDisabled();
        await card.screenshot({ path: `${folder}/cantidad-invalida-${label}.png` });
        await quantity.fill('4');
        await expect(card.locator('.quantity-equivalence')).toHaveText('4 cajas = 48 unidades');
        await expect(quote).toBeEnabled();
        await card.screenshot({ path: `${folder}/cantidad-valida-${label}.png` });
        const unavailable = page.locator('.product-card').filter({ has: page.getByRole('heading', { name: 'Cuaderno vendor2', exact: true }) });
        await expect(unavailable.locator('.quantity-error')).toContainText('No alcanza el mínimo');
        await expect(unavailable.getByRole('button', { name: 'Solicitar cotización', exact: false })).toBeDisabled();
        await quote.click();
        await expect(page.getByText(/Ingresa con tu cuenta compradora/)).toBeVisible();
        await page.getByLabel('Correo', { exact: true }).fill(f.accounts.buyer.email);
        await page.getByLabel(/^Contraseña/).fill(f.password);
        await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
        const request = page.locator('.trade form').filter({ has: page.getByRole('heading', { name: 'Solicitar cotización', exact: true }) });
        const requested = request.getByLabel('Cantidad de presentaciones', { exact: true });
        await expect(requested).toHaveValue('4');
        await expect(request.locator('.quotation-product')).toContainText('Cuaderno A4 espiral (demo)');
        await expect(request.locator('.quotation-product')).toContainText('vendor');
        const send = request.getByRole('button', { name: 'Enviar solicitud', exact: true });
        await requested.fill('3');
        await expect(request.locator('.quantity-error')).toContainText('múltiplo');
        await expect(send).toBeDisabled();
        assert.equal(sentCount, 0);
        await requested.fill('4');
        await expect(request.locator('.quantity-equivalence')).toHaveText('4 cajas = 48 unidades');
        await expect(send).toBeEnabled();
        await request.screenshot({ path: `${folder}/solicitud-${label}.png` });
        const sent = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/quotations');
        await send.click();
        const created = await sent;
        assert.equal(created.status(), 201);
        const quotation = await created.json();
        assert.equal(quotation.items[0].quantity, 4);
        assert.equal(quotation.items[0].unitsPerPack, 12);
        assert.equal(quotation.suppliers[0].id, f.accounts.vendor.supplier);
        const stored = await f.call('quotations/' + quotation.id);
        assert.equal(stored.body.items[0].quantity, 4);
        assert.equal((await f.call('quotations/' + quotation.id, 'GET', undefined, 'buyer2')).status, 404);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.route('**/images/familias-demo.png', route => route.fulfill({ status: 404, body: 'foto no disponible' }));
        await page.reload();
        await expect(card.locator('.photo-fallback')).toBeVisible();
        await card.screenshot({ path: `${folder}/respaldo-${label}.png` });
        await page.unroute('**/images/familias-demo.png');
        await page.reload();
        await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
        assert.deepEqual(errors, []);
        results.push({ viewport: `${width}x${height}`, images: images.filter(image => image.status === 200),
          invalidMinimum: 1, invalidMultiple: 3, validQuantity: 4, units: 48, quotationId: quotation.id,
          supplierPreserved: true, quantityPreservedAfterLogin: true, insufficientStockBlocked: true, photoFallback: '404 simulado en navegador', errors });
      } finally { await context.close(); }
    }
    await writeFile(folder + '/resultado.json', JSON.stringify({ generatedAt: new Date().toISOString(),
      browser: await browser.version(), results }, null, 2));
  } finally {
    if (browser) await browser.close();
    await f.close();
  }
});