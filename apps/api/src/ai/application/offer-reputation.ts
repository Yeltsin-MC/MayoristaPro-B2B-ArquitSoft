export interface SupplierReputation {
  supplierId: string;
  completedOrders: number;
  totalOrders: number;
}

export interface OfferReputation {
  forSuppliers(supplierIds: string[]): Promise<SupplierReputation[]>;
}

export const OFFER_REPUTATION = Symbol('OfferReputation');
