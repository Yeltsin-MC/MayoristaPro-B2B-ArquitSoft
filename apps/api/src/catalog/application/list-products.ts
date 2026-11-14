export interface PublishedProduct {
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
  priceTiers: Array<{ desde: number; precioUnitario: string }>;
}

export interface CatalogFilters {
  search?: string;
  category?: string;
  supplier?: string;
  available?: boolean;
  sort?: 'price-asc' | 'price-desc';
}

export interface CatalogOptions {
  categories: string[];
  suppliers: Array<{ id: string; name: string }>;
}

export interface ProductReader {
  listPublished(offset: number, limit: number, filters?: CatalogFilters): Promise<PublishedProduct[]>;
  options(): Promise<CatalogOptions>;
}

export const PRODUCT_READER = Symbol('ProductReader');

export class ListProducts {
  constructor(private readonly products: ProductReader) {}

  execute(page: number, limit: number, filters: CatalogFilters = {}): Promise<PublishedProduct[]> {
    return this.products.listPublished((page - 1) * limit, limit, filters);
  }

  options(): Promise<CatalogOptions> {
    return this.products.options();
  }
}
