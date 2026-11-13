const { configuration, demoDatabaseUrl, withDemoApi, apiCall, manifest } = require('./load.cjs');

async function comparison(base, config = configuration(), quantity = manifest.comparison.quantity) {
  const login = async email => (await apiCall(base, 'auth/login', 'POST', { email, password: config.demoPassword })).token;
  const buyerToken = await login(manifest.buyer.email);
  const suppliers = [];
  for (const code of manifest.comparison.codes) {
    const provider = manifest.providers.find(p => p.code === code);
    const token = await login(provider.email);
    const me = await apiCall(base, 'auth/me', 'GET', undefined, token);
    const products = await apiCall(base, 'trade/products', 'GET', undefined, token);
    const product = products.find(p => p.sku === 'D150-' + code.toUpperCase() + '-' + manifest.comparison.skuSuffix);
    if (!product) throw new Error('Carga primero el catálogo demo de ' + code + '.');
    suppliers.push({ provider, token, product, id: me.company.supplier_id });
  }
  const request = await apiCall(base, 'quotations', 'POST', {
    proveedorIds: suppliers.map(p => p.id),
    items: [{ descripcion: manifest.comparison.description, presentacion: manifest.comparison.unit,
      unidadesPorPresentacion: manifest.comparison.unitsPerPack, cantidad: quantity }],
  }, buyerToken);
  for (const supplier of suppliers) {
    await apiCall(base, 'quotations/' + request.id + '/responses', 'POST', {
      moneda: 'PEN', precioIncluyeIgv: true, costoEnvio: supplier.provider.shipping,
      diasEntrega: supplier.provider.days, vigenteHasta: new Date(Date.now() + 86400000).toISOString(),
      items: [{ solicitudItemId: request.items[0].id, productoId: supplier.product.id,
        cantidad: quantity, precioUnitario: supplier.product.price }],
    }, supplier.token);
  }
  const detail = await apiCall(base, 'quotations/' + request.id, 'GET', undefined, buyerToken);
  return { detail, buyerToken, suppliers };
}

module.exports = { comparison };
if (require.main === module) {
  const config = configuration();
  withDemoApi(demoDatabaseUrl(config.source, config.schema), async base => {
    const { detail } = await comparison(base, config);
    console.log(JSON.stringify({ id: detail.id, status: detail.status, items: detail.items,
      offers: detail.offers.map(o => ({ supplier: o.supplierName, subtotal: o.subtotal,
        shipping: o.shipping, total: o.total, deliveryDays: o.deliveryDays, expiresAt: o.expiresAt })) }, null, 2));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
