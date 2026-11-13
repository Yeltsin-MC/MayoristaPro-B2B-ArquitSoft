const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { tradeFixture } = require('./trade-fixture.cjs');

test('Lista de pedido: varios productos de un proveedor en una sola solicitud', { timeout: 120000 }, async () => {
  const f = await tradeFixture();
  let browser;
  try {
    // Segundo producto del mismo proveedor, con precio por volumen.
    const second = (
      await f.db.query(
        `INSERT INTO products(supplier_id,sku,name,unit,units_per_pack,minimum,multiple,stock,price,includes_tax,published)
         VALUES($1,'RESMA','Resma lista vendor','caja',5,1,1,30,90,true,true) RETURNING id`,
        [f.accounts.vendor.supplier],
      )
    ).rows[0];
    await f.call('trade/products/' + second.id + '/price-tiers', 'PUT', { escalas: [{ desde: 3, precioUnitario: '85.00' }] }, 'vendor');
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(f.base.replace('/api/v1/', '/'));
    await page.getByRole('button', { name: 'Agregar a la lista: Cuaderno vendor', exact: true }).click();
    const resma = page.locator('.product-card').filter({ hasText: 'Resma lista vendor' });
    await expect(resma.locator('.badge-volume')).toHaveText('Precio por volumen');
    await resma.getByLabel('Cantidad para Resma lista vendor').fill('3');
    await page.getByRole('button', { name: 'Agregar a la lista: Resma lista vendor', exact: true }).click();
    await expect(page.locator('.order-list-link .badge')).toHaveText('2');
    await page.locator('.order-list-link').click();
    const group = page.getByRole('article', { name: 'Productos de vendor' });
    await expect(group).toContainText('Cuaderno vendor');
    // 2 × 48.00 + 3 × 85.00 (escala desde 3) = 351.00
    await expect(group).toContainText('S/ 351.00');
    await group.getByRole('button', { name: /Solicitar cotización a vendor/ }).click();
    await expect(page.getByText(/Ingresa con tu cuenta compradora/)).toBeVisible();
    await expect(page.locator('.quote-selection')).toContainText('1 producto más');
    await page.getByLabel('Correo', { exact: true }).fill(f.accounts.buyer.email);
    await page.getByLabel(/^Contraseña/).fill(f.password);
    await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.locator('.quotation-product')).toContainText('2 productos');
    const sent = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/quotations');
    await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
    const response = await sent;
    assert.equal(response.status(), 201);
    const quotation = await response.json();
    assert.deepEqual(quotation.items.map(i => [i.description, i.quantity]).sort(), [['Cuaderno vendor', 2], ['Resma lista vendor', 3]]);
    assert.deepEqual(quotation.suppliers.map(s => s.id), [f.accounts.vendor.supplier]);
    // Lo cotizado sale de la lista.
    await expect(page.locator('.order-list-link .badge')).toHaveText('0');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await f.close();
  }
});
