/** Escalas vigentes de `p` (solo las que mejoran el precio base), como [{desde, precioUnitario}]. */
export const TIERS_JSON = `COALESCE((SELECT json_agg(json_build_object('desde',t.min_quantity,'precioUnitario',t.unit_price::text) ORDER BY t.min_quantity)
   FROM product_price_tiers t WHERE t.product_id=p.id AND t.unit_price<p.price),'[]'::json)`;

/** Fotos de `p` en orden de galería, como [{url, credito}]; la primera es la principal. */
export const IMAGES_JSON = `COALESCE((SELECT json_agg(json_build_object('url',i.url,'credito',i.credit) ORDER BY i.position)
   FROM product_images i WHERE i.product_id=p.id),'[]'::json)`;
