INSERT INTO suppliers (code, name, verified)
VALUES ('demo-huamanga', 'Distribuidora Huamanga (demo)', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (supplier_id, sku, name, unit, units_per_pack, minimum, multiple, stock, price, includes_tax, published)
SELECT s.id, p.sku, p.name, p.unit, p.pack, p.minimum, p.multiple, p.stock, p.price, true, true
FROM suppliers s
CROSS JOIN (VALUES
    ('CUA-A4', 'Cuaderno A4', 'Caja', 12, 2, 1, 20, 48.00),
    ('BOL-AZ', 'Bolígrafo azul', 'Paquete', 24, 2, 2, 48, 24.00),
    ('PAP-A4', 'Resma de papel A4', 'Caja', 5, 1, 1, 15, 89.90)
) AS p(sku, name, unit, pack, minimum, multiple, stock, price)
WHERE s.code = 'demo-huamanga'
ON CONFLICT (supplier_id, sku) DO NOTHING;
