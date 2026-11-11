export interface PublishedProduct {
  id: string;
  name: string;
  category: string;
  available: boolean;
  supplier: string;
  unit: string;
  unitsPerPack: number;
  minimum: number;
  multiple: number;
  stock: number;
  price: string;
  currency: 'PEN';
  includesTax: boolean;
}

export interface ProductReader {
  listPublished(offset: number, limit: number): Promise<PublishedProduct[]>;
}

export const PRODUCT_READER = Symbol('ProductReader');

export class ListProducts {
  constructor(private readonly products: ProductReader) {}

  execute(page: number, limit: number): Promise<PublishedProduct[]> {
    return this.products.listPublished((page - 1) * limit, limit);
  }
}
