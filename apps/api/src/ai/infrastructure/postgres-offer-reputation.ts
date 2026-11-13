import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { OfferReputation, SupplierReputation } from '../application/offer-reputation';

@Injectable()
export class PostgresOfferReputation implements OfferReputation, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  async forSuppliers(supplierIds: string[]): Promise<SupplierReputation[]> {
    const result = await this.pool.query(
      `
      SELECT supplier_id AS "supplierId",
             COUNT(*) FILTER (WHERE state = 'paid') AS completed,
             COUNT(*) AS total
      FROM trade_orders
      WHERE supplier_id = ANY($1::uuid[])
      GROUP BY supplier_id
    `,
      [supplierIds],
    );

    return result.rows.map(row => ({
      supplierId: row.supplierId,
      completedOrders: Number(row.completed),
      totalOrders: Number(row.total),
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
