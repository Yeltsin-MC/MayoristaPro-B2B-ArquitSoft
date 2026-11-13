const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { mkdir, writeFile } = require('node:fs/promises');
const { tradeFixture } = require('./trade-fixture.cjs');

test('Demo UX: login, catalogo, cotizacion y comparacion FastAPI en escritorio y movil', { timeout: 120000 }, async () => {
  assert.ok(process.env.T6_AI_URL, 'Configura T6_AI_URL con el servicio FastAPI local.');
  const original = process.env.AI_SERVICE_URL;
  process.env.AI_SERVICE_URL = process.env.T6_AI_URL;
  let f, browser;
  const errors = [];
  const artifact = 'docs/evidencias/demo-mayorista';
  try {
    f = await tradeFixture();
    await f.db.query("UPDATE suppliers SET name='Proveedor Demo Uno' WHERE id=$1", [f.accounts.vendor.supplier]);
    await f.db.query("UPDATE suppliers SET name='Proveedor Demo Dos' WHERE id=$1", [f.accounts.vendor2.supplier]);
    await f.db.query("UPDATE companies SET legal_name='Comprador Demo' WHERE id=$1", [f.accounts.buyer.company]);
    await f.db.query("UPDATE products SET category='Papeleria' WHERE id=ANY($1::uuid[])", [[f.products.vendor.id, f.products.vendor2.id]]);
    await mkdir(artifact, { recursive: true });
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.on('pageerror', error => errors.push(error.message));
    const origin = f.base.replace('/api/v1/', '/');
    await page.goto(origin);
    await expect(page.locator('.product-card')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Cotización no habilitada', exact: false })).toHaveCount(3);
    await page.screenshot({ path: artifact + '/catalogo-escritorio.png' });

    await page.getByLabel('Buscar productos', { exact: true }).fill('Cuaderno vendor2');
    await page.getByRole('button', { name: 'Buscar', exact: false }).click();
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.locator('.product-card')).toContainText('Cuaderno vendor2');
    await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Cotización no habilitada', exact: false })).toHaveCount(3);
    await page.getByLabel('Proveedor del catálogo', { exact: true }).selectOption(f.accounts.vendor.supplier);
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Solicitar cotización', exact: false }).click();
    await expect(page.getByText(/Ingresa con tu cuenta compradora/)).toBeVisible();
    await page.getByLabel('Correo', { exact: true }).fill(f.accounts.buyer.email);
    await page.getByLabel(/^Contraseña/).fill(f.password);
    await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Solicitar cotización', exact: true })).toBeVisible();
    await expect(page.locator('.quotation-product')).toContainText('Cuaderno vendor');
    await page.getByRole('button', {name:'Añadir otro proveedor',exact:true}).click();
    await expect(page.getByRole('checkbox', { name: 'Proveedor Demo Uno', exact: true })).toBeChecked();
    await page.getByRole('checkbox', { name: 'Proveedor Demo Dos', exact: true }).check();
    const created = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/quotations');
    await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
    const quotation = await (await created).json();
    assert.ok(quotation.id);
    assert.equal((await f.offer(quotation, 'vendor', { costoEnvio: '0.00' })).status, 201);
    const second = f.draft(quotation, 'vendor2', { costoEnvio: '0.00', diasEntrega: 5 });
    second.items[0].precioUnitario = '52.00';
    assert.equal((await f.call(`quotations/${quotation.id}/responses`, 'POST', second, 'vendor2')).status, 201);
    await page.getByRole('button', { name: 'Actualizar cotizaciones', exact: true }).click();
    await page.locator('[data-request-id="'+quotation.id+'"] ').getByRole('button', {name:'Ver cotización',exact:true}).click();
    await expect(page.locator('.offer')).toHaveCount(2);
    const scoredResponse = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/score-offers'));
    await page.locator('.comparison-details > summary').click();
    await page.getByRole('button', { name: 'Calcular puntuación IA', exact: true }).click();
    const result = await (await scoredResponse).json();
    assert.equal(result.ai_service_available, true, JSON.stringify(result));
    assert.deepEqual(result.scored_offers.map(offer => offer.score), [90, 10]);
    await expect(page.locator('.score-info')).toHaveCount(2);
    await expect(page.locator('.best-offer')).toHaveCount(1);
    await expect(page.locator('.best-offer')).toContainText('Proveedor Demo Uno');
    await expect(page.getByRole('button', { name: 'Solicitudes (administración)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publicar producto', exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Ordenar por puntuación', exact: true }).check();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.offers-grid').screenshot({ path: artifact + '/comparacion-escritorio.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.offers-grid').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: artifact + '/comparacion-movil.png', fullPage: true });
    // The HTTP adapter failure is covered against PostgreSQL in ai.integration.
    // Here the same fallback contract verifies the browser state without
    // stopping the FastAPI service used by the existing demo.
    const unavailable = { ...result, ai_service_available: false,
      scored_offers: result.scored_offers.map(offer => ({ ...offer, score: null,
        breakdown: { price_score: null, delivery_score: null, reputation_score: null } })) };
    await page.route('**/score-offers', route => route.fulfill({ status: 201,
      contentType: 'application/json', body: JSON.stringify(unavailable) }));
    await page.getByRole('button', { name: 'Actualizar puntuación IA', exact: true }).click();
    await expect(page.getByText('Servicio de IA no disponible. Ofertas mostradas sin puntuación.', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin puntuación', { exact: true })).toHaveCount(2);
    await expect(page.locator('.best-offer')).toHaveCount(0);
    await expect(page.locator('.offer').filter({hasText:'Proveedor Demo Uno'}).getByRole('button', { name: 'Aceptar oferta', exact: true })).toBeEnabled();
    await expect(page.locator('.offer-total strong').first()).toHaveText('S/ 96.00');
    await page.locator('.offers-grid').screenshot({ path: artifact + '/comparacion-sin-ia.png' });
    await page.unroute('**/score-offers');
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    // A catalog selection must not leak into the next authenticated account.
    await page.getByLabel('Correo', { exact: true }).fill(f.accounts.buyer2.email);
    await page.getByLabel(/^Contraseña/).fill(f.password);
    await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cotizaciones y pedidos', exact: true })).toBeVisible();
    await expect(page.locator('[data-request-id="'+quotation.id+'"] ').getByRole('button', {name:'Ver cotización',exact:true})).toHaveCount(0);
    const forbidden = await f.call(`quotations/${quotation.id}/score-offers`, 'POST', undefined, 'buyer2');
    assert.equal(forbidden.status, 404);
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await page.locator('.header-nav').getByRole('link', { name: 'Catálogo', exact: true }).click();
    await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Cotización no habilitada', exact: false })).toHaveCount(3);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: artifact + '/catalogo-movil.png', fullPage: true });
    await page.setViewportSize({ width: 360, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName,
      outline: getComputedStyle(document.activeElement).outlineStyle }));
    assert.notEqual(focus.tag, 'BODY');
    assert.notEqual(focus.outline, 'none');
    assert.deepEqual(errors, []);
    await writeFile(artifact + '/resultado.json', JSON.stringify({
      browser: await browser.version(), flow: 'login -> catalogo -> solicitud -> ofertas -> FastAPI',
      quotationId: quotation.id, scores: result.scored_offers.map(offer => offer.score),
      desktop: '1440x1050', mobile: ['390x844', '360x800', '320x740'], horizontalOverflow: false,
      foreignCompanyStatus: forbidden.status, javascriptErrors: errors, offlineUi: 'Respuesta fallback simulada en navegador; HTTP 503 real cubierto por ai.integration.cjs',
      data: 'Fixture sintetico aislado. El esquema PostgreSQL se elimina al terminar.',
    }, null, 2));
  } finally {
    try {
      if (browser) await browser.close();
      if (f) await f.close();
    } finally {
      if (original === undefined) delete process.env.AI_SERVICE_URL;
      else process.env.AI_SERVICE_URL = original;
    }
  }
});
