/** Escalas vigentes de `p` (solo las que mejoran el precio base), como [{desde, precioUnitario}]. */
export const TIERS_JSON = `COALESCE((SELECT json_agg(json_build_object('desde',t.min_quantity,'precioUnitario',t.unit_price::text) ORDER BY t.min_quantity)
   FROM product_price_tiers t WHERE t.product_id=p.id AND t.unit_price<p.price),'[]'::json)`;
