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
}
