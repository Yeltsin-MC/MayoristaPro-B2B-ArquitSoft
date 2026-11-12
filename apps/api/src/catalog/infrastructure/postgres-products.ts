import { OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { CatalogFilters, CatalogOptions, ProductReader, PublishedProduct } from '../application/list-products';

export class PostgresProducts implements ProductReader, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  }

  async listPublished(offset: number, limit: number, filters: CatalogFilters = {}): Promise<PublishedProduct[]> {
    const result = await this.pool.query<PublishedProduct>(`
      SELECT p.id, p.name, p.category, (p.stock >= p.minimum) AS available,
             s.name AS supplier, s.id AS "supplierId", p.unit,
             EXISTS(SELECT 1 FROM companies c WHERE c.supplier_id=s.id AND c.status='enabled') AS "quoteEnabled",
             p.units_per_pack AS "unitsPerPack", p.minimum, p.multiple,
             p.stock, p.price::text, p.currency, p.includes_tax AS "includesTax"
      FROM products p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.published AND s.verified
        AND ($3::text IS NULL OR strpos(lower(p.name || ' ' || s.name || ' ' || p.category), lower($3)) > 0)
        AND ($4::text IS NULL OR p.category = $4)
        AND ($5::uuid IS NULL OR s.id = $5)
        AND ($6::boolean IS NULL OR (p.stock >= p.minimum) = $6)
      ORDER BY CASE WHEN $7 = 'price-asc' THEN p.price END ASC,
               CASE WHEN $7 = 'price-desc' THEN p.price END DESC, p.id
      LIMIT $1 OFFSET $2
    `, [limit, offset, filters.search || null, filters.category || null,
      filters.supplier || null, filters.available ?? null, filters.sort || null]);
    return result.rows;
  }

  async options(): Promise<CatalogOptions> {
    const result = await this.pool.query(`
      SELECT DISTINCT p.category, s.id, s.name
      FROM products p JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.published AND s.verified
      ORDER BY p.category, s.name, s.id
    `);
    return {
      categories: [...new Set<string>(result.rows.map(row => row.category))],
      suppliers: [...new Map<string, { id: string; name: string }>(
        result.rows.map(row => [row.id, { id: row.id, name: row.name }]),
      ).values()],
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
