import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { OfferReputation, SupplierReputation } from '../application/offer-reputation';

@Injectable()
export class PostgresOfferReputation implements OfferReputation {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async forSuppliers(supplierIds: string[]): Promise<SupplierReputation[]> {
    const result = await this.pool.query(
      `
      SELECT supplier_id AS "supplierId",
             COUNT(*) FILTER (WHERE state IN ('paid', 'preparing', 'dispatched', 'delivered')) AS completed,
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
}
