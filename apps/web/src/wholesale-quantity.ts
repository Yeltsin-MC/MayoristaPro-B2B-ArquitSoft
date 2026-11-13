import { CatalogProduct } from './catalog-product';

export function unitName(unit: string, quantity: number): string {
  const name = unit.toLowerCase();
  return quantity === 1 ? name : name === 'unidad' ? 'unidades' : name + 's';
}

export function presentations(quantity: number, unit: string): string {
  return quantity + ' ' + unitName(unit, quantity);
}

export function minimumQuantity(product: CatalogProduct): number {
  return Math.ceil(product.minimum / product.multiple) * product.multiple;
}

export function quantityError(product: CatalogProduct, quantity: number | null): string {
  if (product.stock < minimumQuantity(product)) {
    return 'Stock disponible: ' + presentations(product.stock, product.unit) +
      '. No alcanza el mínimo de ' + presentations(minimumQuantity(product), product.unit) + '.';
  }
  if (quantity === null || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return 'Ingresa una cantidad entera de presentaciones.';
  }
  if (quantity < product.minimum) return 'El mínimo de compra es ' + presentations(product.minimum, product.unit) + '.';
  if (quantity % product.multiple !== 0) return 'Elige un múltiplo de ' + presentations(product.multiple, product.unit) + '.';
  if (quantity > product.stock) return 'Solo hay ' + presentations(product.stock, product.unit) + ' disponibles.';
  return '';
}

export function quantityEquivalence(product: CatalogProduct, quantity: number | null): string {
  if (quantity === null || !Number.isSafeInteger(quantity) || quantity <= 0 || product.unitsPerPack <= 1) return '';
  const units = quantity * product.unitsPerPack;
  return Number.isSafeInteger(units) ? presentations(quantity, product.unit) + ' = ' + units + ' unidades' : '';
}
export function packDescription(product: CatalogProduct): string {
  const unit = product.unit.toLowerCase();
  if (unit === 'unidad' && product.unitsPerPack === 1) return unit;
  return unit + ' de ' + product.unitsPerPack + ' ' + unitName('unidad', product.unitsPerPack);
}