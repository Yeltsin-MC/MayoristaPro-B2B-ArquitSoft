import { DomainError } from '../../common/domain-error';

export class TradeRule extends DomainError {}
export function rule(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new TradeRule(code, message);
}
export function positive(value: unknown, label: string): number {
  rule(
    typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647,
    'INVALID_INPUT',
    label + ' debe ser entero positivo.',
  );
  return value;
}
export function identifier(value: unknown): string {
  rule(
    typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value),
    'INVALID_INPUT',
    'Identificador inválido.',
  );
  return value.toLowerCase();
}
export function money(value: unknown, zero = false): bigint {
  rule(
    typeof value === 'string' && /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value),
    'INVALID_INPUT',
    'Importe decimal inválido; hasta dos decimales, sin redondear entradas.',
  );
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  rule(cents > 0n || (zero && cents === 0n), 'INVALID_INPUT', 'Importe fuera de rango.');
  return cents;
}
export function amount(cents: bigint): string {
  rule(cents >= 0n && cents < 10n ** 24n, 'INVALID_INPUT', 'Total fuera del rango decimal.');
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
export function priceTotal(lines: { quantity: number; unitPrice: string }[], shipping: string) {
  const subtotal = lines.reduce(
    (sum, line) => sum + money(line.unitPrice) * BigInt(positive(line.quantity, 'Cantidad')),
    0n,
  );
  return {
    subtotal: amount(subtotal),
    shipping: amount(money(shipping, true)),
    total: amount(subtotal + money(shipping, true)),
  };
}
export interface RequestDraft {
  proveedorIds: string[];
  items: { descripcion: string; presentacion: string; unidadesPorPresentacion: number; cantidad: number }[];
}
export interface OfferDraft {
  moneda: 'PEN';
  precioIncluyeIgv: true;
  costoEnvio: string;
  diasEntrega: number;
  vigenteHasta: string;
  items: { solicitudItemId: string; productoId: string; cantidad: number; precioUnitario: string }[];
}
export function requestDraft(body: any): RequestDraft {
  rule(
    Array.isArray(body?.proveedorIds) && body.proveedorIds.length > 0 && body.proveedorIds.length <= 20,
    'INVALID_INPUT',
    'Selecciona de 1 a 20 proveedores.',
  );
  const proveedorIds = body.proveedorIds.map(identifier);
  rule(new Set(proveedorIds).size === proveedorIds.length, 'INVALID_INPUT', 'Proveedor repetido.');
  rule(
    Array.isArray(body?.items) && body.items.length > 0 && body.items.length <= 50,
    'INVALID_INPUT',
    'Solicitud de 1 a 50 ítems.',
  );
  const items = body.items.map((item: any) => {
    rule(
      typeof item?.descripcion === 'string' &&
        item.descripcion.trim().length > 0 &&
        item.descripcion.length <= 200 &&
        !item.descripcion.includes('\0'),
      'INVALID_INPUT',
      'Descripción obligatoria, máximo 200 caracteres.',
    );
    rule(
      ['unidad', 'paquete', 'docena', 'caja', 'saco'].includes(item.presentacion),
      'INVALID_INPUT',
      'Presentación contable inválida.',
    );
    const unidadesPorPresentacion = positive(item.unidadesPorPresentacion, 'Equivalencia');
    rule(
      item.presentacion !== 'docena' || unidadesPorPresentacion === 12,
      'INVALID_INPUT',
      'Docena requiere 12 unidades.',
    );
    return {
      descripcion: item.descripcion.trim(),
      presentacion: item.presentacion,
      unidadesPorPresentacion,
      cantidad: positive(item.cantidad, 'Cantidad'),
    };
  });
  return { proveedorIds, items };
}
export function offerDraft(body: any): OfferDraft {
  rule(
    body?.moneda === 'PEN' && body.precioIncluyeIgv === true,
    'INVALID_INPUT',
    'Demo: PEN y precios con IGV incluido.',
  );
  const costoEnvio = amount(money(body.costoEnvio, true)),
    diasEntrega = positive(body.diasEntrega, 'Plazo');
  rule(
    typeof body.vigenteHasta === 'string' &&
      /T.*(?:Z|[+-]\d\d:\d\d)$/.test(body.vigenteHasta) &&
      Number.isFinite(Date.parse(body.vigenteHasta)),
    'INVALID_INPUT',
    'Vigencia ISO con zona horaria requerida.',
  );
  rule(
    Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 50,
    'INVALID_INPUT',
    'Oferta completa de 1 a 50 ítems.',
  );
  const items = body.items.map((i: any) => ({
    solicitudItemId: identifier(i?.solicitudItemId),
    productoId: identifier(i?.productoId),
    cantidad: positive(i?.cantidad, 'Cantidad'),
    precioUnitario: amount(money(i?.precioUnitario)),
  }));
  rule(
    new Set(items.map((i: OfferDraft['items'][number]) => i.solicitudItemId)).size === items.length,
    'INVALID_INPUT',
    'Ítem de solicitud repetido.',
  );
  return { moneda: 'PEN', precioIncluyeIgv: true, costoEnvio, diasEntrega, vigenteHasta: body.vigenteHasta, items };
}
export interface ProductConditions {
  id: string;
  sku: string;
  name: string;
  unit: string;
  units_per_pack: number;
  minimum: number;
  multiple: number;
  published: boolean;
}
export function conditions(product: ProductConditions) {
  return {
    sku: product.sku,
    name: product.name,
    unit: product.unit.toLowerCase(),
    unitsPerPack: product.units_per_pack,
    minimum: product.minimum,
    multiple: product.multiple,
  };
}
export function compatible(product: ProductConditions, snapshot: ReturnType<typeof conditions>, quantity: number) {
  rule(
    product.published &&
      product.sku === snapshot.sku &&
      product.unit.toLowerCase() === snapshot.unit &&
      product.units_per_pack === snapshot.unitsPerPack &&
      product.minimum === snapshot.minimum &&
      product.multiple === snapshot.multiple,
    'CONDITIONS_CHANGED',
    'Cambió SKU, publicación o condiciones de presentación. Inicia una nueva solicitud.',
  );
  rule(
    quantity >= product.minimum && quantity % product.multiple === 0,
    'INVALID_INPUT',
    'La cantidad debe alcanzar el mínimo y ser múltiplo válido.',
  );
}

// ---------------------------------------------------------------------------
// Reglas de respuesta, aceptación y pedido. Son funciones puras: reciben los
// datos ya leídos (y bloqueados) por la infraestructura y deciden; no hacen SQL.
// ---------------------------------------------------------------------------

export interface RequestedItem {
  id: string;
  unit: string;
  units_per_pack: number;
  quantity: number;
}
export interface StockedProduct extends ProductConditions {
  supplier_id: string;
  stock: number;
}
export type OfferLine = OfferDraft['items'][number] & { snapshot: ReturnType<typeof conditions>; subtotal: string };

/** La oferta debe responder exactamente a todos los ítems de la solicitud. */
export function assertCoversRequest(requested: RequestedItem[], items: OfferDraft['items']): void {
  rule(requested.length === items.length, 'INVALID_INPUT', 'La oferta debe cubrir todos los ítems solicitados.');
}

/**
 * Valida cada línea de la oferta contra lo solicitado y contra los productos del
 * proveedor (propios, publicados, misma presentación, mínimo/múltiplo y stock),
 * y devuelve las líneas con su snapshot de condiciones y subtotal exacto.
 */
export function offerLines(
  requested: RequestedItem[],
  items: OfferDraft['items'],
  supplierProducts: StockedProduct[],
): OfferLine[] {
  return items.map(item => {
    const asked = requested.find(r => r.id === item.solicitudItemId);
    rule(asked && asked.quantity === item.cantidad, 'INVALID_INPUT', 'Ítem o cantidad no corresponde a la solicitud.');
    const product = supplierProducts.find(p => p.id === item.productoId);
    rule(product, 'INVALID_INPUT', 'Producto ajeno o inexistente.');
    const snapshot = conditions(product);
    compatible(product, snapshot, item.cantidad);
    rule(
      snapshot.unit === asked.unit && snapshot.unitsPerPack === asked.units_per_pack,
      'INVALID_INPUT',
      'Presentación o equivalencia incompatible con la solicitud.',
    );
    rule(
      product.stock >= item.cantidad,
      'INSUFFICIENT_STOCK',
      'Stock insuficiente para ofrecer esa cantidad. Inicia otra solicitud.',
    );
    return { ...item, snapshot, subtotal: amount(money(item.precioUnitario) * BigInt(item.cantidad)) };
  });
}

/** Una oferta solo se acepta si el proveedor sigue verificado y la oferta está vigente. */
export function assertAcceptable(offer: { verified: boolean; valid: boolean }): void {
  rule(offer.verified, 'CONDITIONS_CHANGED', 'El proveedor dejó de estar verificado. Inicia una nueva solicitud.');
  rule(offer.valid, 'OFFER_EXPIRED', 'La oferta venció. Inicia una nueva solicitud.');
}

/**
 * Calcula cuánto reservar por producto al crear el pedido. Exige que cada
 * producto siga siendo del proveedor, conserve las condiciones del snapshot y
 * tenga stock suficiente para la suma de sus líneas (sin sobreventa).
 */
export function reservationQuantities(
  lines: { product_id: string; quantity: number; snapshot: ReturnType<typeof conditions> }[],
  lockedProducts: StockedProduct[],
  supplierId: string,
): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const product = lockedProducts.find(p => p.id === line.product_id);
    rule(
      product && product.supplier_id === supplierId,
      'CONDITIONS_CHANGED',
      'Producto no disponible. Inicia una nueva solicitud.',
    );
    compatible(product, line.snapshot, line.quantity);
    quantities.set(product.id, (quantities.get(product.id) ?? 0) + line.quantity);
  }
  for (const product of lockedProducts)
    rule(
      product.stock >= (quantities.get(product.id) ?? 0),
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para ${product.sku}. Inicia una nueva solicitud.`,
    );
  return quantities;
}
