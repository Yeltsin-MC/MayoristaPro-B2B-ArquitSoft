import { OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { TIERS_JSON } from './price-tiers-sql';
import { CatalogFilters, CatalogOptions, ProductReader, PublishedProduct } from '../application/list-products';

export class PostgresProducts implements ProductReader, OnModuleDestroy {
  private readonly pool: Pool;
  /** Solo cierra el pool si lo creó esta clase (uso fuera de Nest, p. ej. pruebas y scripts). */
  private readonly ownsPool: boolean;

  constructor(source: Pool | string) {
    this.ownsPool = typeof source === 'string';
    this.pool =
      typeof source === 'string' ? new Pool({ connectionString: source, connectionTimeoutMillis: 5000 }) : source;
  }

  async revision(): Promise<string> {
    const result = await this.pool.query(`
      SELECT r.revision::text FROM catalog_cache_revision r WHERE r.singleton
      AND (SELECT relnamespace FROM pg_class WHERE oid=r.tableoid) =
          (SELECT relnamespace FROM pg_class WHERE oid='products'::regclass)
    `);
    if (!result.rows[0]) throw new Error('Falta la revisión del catálogo. Aplica db:migrate.');
    return result.rows[0].revision;
  }

  async listPublished(offset: number, limit: number, filters: CatalogFilters = {}): Promise<PublishedProduct[]> {
    const result = await this.pool.query<PublishedProduct>(
      `
      SELECT p.id, p.name, p.category, (p.stock >= p.minimum) AS available,
             s.name AS supplier, s.id AS "supplierId", p.unit,
             EXISTS(SELECT 1 FROM companies c WHERE c.supplier_id=s.id AND c.status='enabled') AS "quoteEnabled",
             p.units_per_pack AS "unitsPerPack", p.minimum, p.multiple,
             p.stock, p.price::text, p.currency, p.includes_tax AS "includesTax",
             ${TIERS_JSON} AS "priceTiers"
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
    `,
      [
        limit,
        offset,
        filters.search || null,
        filters.category || null,
        filters.supplier || null,
        filters.available ?? null,
        filters.sort || null,
      ],
    );
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
      suppliers: [
        ...new Map<string, { id: string; name: string }>(
          result.rows.map(row => [row.id, { id: row.id, name: row.name }]),
        ).values(),
      ],
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }
}
