export interface PriceTier {
  desde: number;
  precioUnitario: string;
}
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  available: boolean;
  quoteEnabled: boolean;
  supplier: string;
  supplierId: string;
  unit: string;
  unitsPerPack: number;
  minimum: number;
  multiple: number;
  stock: number;
  price: string;
  currency: 'PEN';
  includesTax: boolean;
  /** Precios por volumen: desde N presentaciones, precio por presentación. */
  priceTiers?: PriceTier[];
}
