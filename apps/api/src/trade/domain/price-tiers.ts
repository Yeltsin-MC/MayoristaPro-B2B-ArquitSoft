import { amount, money, positive, rule } from './trade';

/** Escala de precio por volumen: desde `desde` presentaciones, `precioUnitario` por presentación. */
export interface PriceTier {
  desde: number;
  precioUnitario: string;
}

export const MAX_PRICE_TIERS = 5;

/**
 * Valida las escalas que un proveedor define para uno de sus productos.
 * Reglas: hasta 5 escalas; cada `desde` es mayor al mínimo de compra y múltiplo
 * válido (para que se pueda alcanzar); cantidades crecientes y precios
 * estrictamente decrecientes y menores al precio base. Una lista vacía elimina
 * las escalas.
 */
export function priceTiers(body: any, product: { price: string; minimum: number; multiple: number }): PriceTier[] {
  rule(
    Array.isArray(body?.escalas) && body.escalas.length <= MAX_PRICE_TIERS,
    'INVALID_INPUT',
    `Define de 0 a ${MAX_PRICE_TIERS} escalas de precio.`,
  );
  const base = money(product.price);
  const tiers: PriceTier[] = body.escalas.map((tier: any) => ({
    desde: positive(tier?.desde, 'Cantidad desde'),
    precioUnitario: amount(money(tier?.precioUnitario)),
  }));
  tiers.sort((a, b) => a.desde - b.desde);
  let previousQuantity = product.minimum;
  let previousPrice = base;
  for (const tier of tiers) {
    rule(
      tier.desde > previousQuantity,
      'INVALID_INPUT',
      'Cada escala debe empezar en una cantidad mayor al mínimo de compra y a la escala anterior, sin repetir.',
    );
    rule(
      tier.desde % product.multiple === 0,
      'INVALID_INPUT',
      `La cantidad desde debe ser múltiplo de ${product.multiple}.`,
    );
    const price = money(tier.precioUnitario);
    rule(
      price < previousPrice,
      'INVALID_INPUT',
      'Cada escala debe tener un precio menor al precio base y a la escala anterior.',
    );
    previousQuantity = tier.desde;
    previousPrice = price;
  }
  return tiers;
}

/**
 * Precio por presentación que corresponde a una cantidad: el de la escala más
 * alta alcanzada, o el precio base. Nunca devuelve más que el precio base, aunque
 * el proveedor haya cambiado el precio base después de definir las escalas.
 */
export function unitPriceFor(basePrice: string, tiers: PriceTier[], quantity: number): string {
  let price = money(basePrice);
  for (const tier of tiers) {
    const tierPrice = money(tier.precioUnitario);
    if (quantity >= tier.desde && tierPrice < price) price = tierPrice;
  }
  return amount(price);
}
