export interface ScoredOffer {
  offer_id: string;
  supplier_id: string;
  supplier_name: string;
  total: number;
  delivery_days: number;
  score: number | null;
  breakdown: {
    price_score: number | null;
    delivery_score: number | null;
    reputation_score: number | null;
  };
}

export interface ScoreOffersRequest {
  offers: Array<{
    offer_id: string;
    supplier_id: string;
    supplier_name: string;
    total: number;
    delivery_days: number;
    completed_orders: number;
    total_orders: number;
  }>;
}

export interface ScoreOffersResponse {
  scored_offers: ScoredOffer[];
}
