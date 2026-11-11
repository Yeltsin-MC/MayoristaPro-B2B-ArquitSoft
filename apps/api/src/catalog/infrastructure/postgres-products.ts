import { OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ProductReader, PublishedProduct } from '../application/list-products';

export class PostgresProducts implements ProductReader, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async listPublished(offset: number, limit: number): Promise<PublishedProduct[]> {
    const result = await this.pool.query<PublishedProduct>(`
      SELECT p.id, p.name, s.name AS supplier, p.unit,
             p.units_per_pack AS "unitsPerPack", p.minimum, p.multiple,
             p.stock, p.price::text, p.currency, p.includes_tax AS "includesTax"
      FROM products p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.published AND s.verified
      ORDER BY p.id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
