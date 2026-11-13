import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { IdentityService, uuid } from '../../identity/identity.service';
import { ImportRow, readImportFile } from './import-file';

interface ProductSnapshot {
  id: string;
  sku: string;
  revision: string;
  unit: string;
  units_per_pack: number;
  stock: number;
  minimum: number;
  published: boolean;
}
interface Batch {
  id: string;
  supplier_id: string;
  status: 'preview' | 'invalid' | 'stale' | 'applied';
  rows: ImportRow[];
  preview_hash: string;
  expires_at: Date;
  result: unknown;
}

@Injectable()
export class CatalogImports implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });
  constructor(private readonly identity: IdentityService) {}
  async onModuleDestroy() {
    await this.pool.end();
  }

  private async tx<T>(action: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL lock_timeout='5s'");
      const result = await action(db);
      await db.query('COMMIT');
      return result;
    } catch (error: any) {
      await db.query('ROLLBACK');
      if (['55P03', '40P01', '23505'].includes(error.code))
        throw new ConflictException('Cambios concurrentes: vuelve a revisar el lote.');
      throw error;
    } finally {
      db.release();
    }
  }

  private async products(db: PoolClient, supplierId: string, rows: ImportRow[]): Promise<Map<string, ProductSnapshot>> {
    const result = await db.query<ProductSnapshot>(
      `SELECT id,sku,revision::text,unit,units_per_pack,stock,minimum,published
      FROM products WHERE supplier_id=$1 AND sku=ANY($2::text[]) ORDER BY sku`,
      [supplierId, rows.map(r => r.data.sku)],
    );
    return new Map(result.rows.map(p => [p.sku, p]));
  }

  private report(batch: Batch) {
    return {
      id: batch.id,
      status: batch.status,
      previewHash: batch.preview_hash,
      expiresAt: batch.expires_at,
      rows: batch.rows,
      summary: {
        total: batch.rows.length,
        creates: batch.rows.filter(r => r.action === 'create').length,
        updates: batch.rows.filter(r => r.action === 'update').length,
        invalid: batch.rows.filter(r => r.errors.length).length,
      },
      result: batch.result,
    };
  }

  private async audit(db: PoolClient, actor: string, action: string, id: string) {
    await db.query('INSERT INTO identity_audit(actor_id,action,resource_id) VALUES($1,$2,$3)', [actor, action, id]);
  }

  private stockErrors(row: ImportRow, product?: ProductSnapshot): void {
    const d = row.data;
    if (
      product &&
      (product.unit.toLowerCase() !== d.presentacion || product.units_per_pack !== Number(d.unidades_por_presentacion))
    ) {
      row.errors.push({
        column: 'presentacion',
        message:
          'No se puede cambiar la equivalencia del stock existente por importación. Requiere ajuste de inventario por definir.',
      });
    }
    // Already-published offers may run out of stock; retain them as unavailable.
    if (d.publicado === 'true' && !product?.published && (product?.stock ?? Number(d.stock)) < Number(d.minimo)) {
      row.errors.push({ column: 'stock', message: 'Para publicar por primera vez el stock debe alcanzar el mínimo.' });
    }
  }

  async preview(file: { originalname: string; buffer: Buffer } | undefined, auth?: string) {
    // Authorize before parsing a potentially costly workbook.
    await this.tx(db => this.identity.requireSupplier(db, auth));
    if (!file) throw new BadRequestException('Adjunta un archivo en el campo file.');
    const rows = await readImportFile(file);
    return this.tx(async db => {
      const actor = await this.identity.requireSupplier(db, auth);
      const products = await this.products(db, actor.supplierId, rows);
      for (const row of rows) {
        const product = products.get(row.data.sku);
        row.action = product ? 'update' : 'create';
        row.snapshot = product
          ? {
              id: product.id,
              revision: product.revision,
              unit: product.unit,
              unitsPerPack: product.units_per_pack,
              stock: product.stock,
            }
          : null;
        this.stockErrors(row, product);
      }
      const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      const result = await db.query<Batch>(
        `INSERT INTO catalog_imports(supplier_id,actor_id,status,rows,preview_hash)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [
          actor.supplierId,
          actor.accountId,
          rows.some(r => r.errors.length) ? 'invalid' : 'preview',
          JSON.stringify(rows),
          hash,
        ],
      );
      await this.audit(db, actor.accountId, 'preview-import', result.rows[0].id);
      return this.report(result.rows[0]);
    });
  }

  async get(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.identity.requireSupplier(db, auth);
      const result = await db.query<Batch>('SELECT * FROM catalog_imports WHERE id=$1 AND supplier_id=$2', [
        id,
        actor.supplierId,
      ]);
      if (!result.rows[0]) throw new NotFoundException('Lote no disponible.');
      return this.report(result.rows[0]);
    });
  }

  async confirm(id: string, body: { previewHash?: string }, key: string | undefined, auth?: string) {
    uuid(id);
    if (!key || !/^[A-Za-z0-9._-]{1,128}$/.test(key))
      throw new BadRequestException('Idempotency-Key requerido (1–128 letras, números, punto o guion).');
    const outcome = await this.tx(async db => {
      const actor = await this.identity.requireSupplier(db, auth);
      const result = await db.query<Batch>('SELECT * FROM catalog_imports WHERE id=$1 AND supplier_id=$2 FOR UPDATE', [
        id,
        actor.supplierId,
      ]);
      const batch = result.rows[0];
      if (!batch) throw new NotFoundException('Lote no disponible.');
      if (body?.previewHash !== batch.preview_hash)
        throw new ConflictException('La huella de la vista previa no coincide.');
      if (batch.status === 'applied') return { report: this.report(batch) };
      if (batch.status === 'invalid' || batch.rows.some(r => r.errors.length))
        throw new UnprocessableEntityException('El lote tiene errores: corrige el archivo y vuelve a cargarlo.');
      if (batch.status === 'stale' || new Date(batch.expires_at).getTime() <= Date.now()) {
        await db.query("UPDATE catalog_imports SET status='stale' WHERE id=$1", [id]);
        return { conflict: 'La vista previa venció o está desactualizada. Vuelve a cargar y revisar el archivo.' };
      }
      // Bounded, global writer lock: also protects absent SKUs from concurrent
      // inserts/renames by any writer, including maintenance SQL. Public reads continue.
      await db.query('LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE');
      const products = await this.products(db, actor.supplierId, batch.rows);
      for (const row of batch.rows) {
        const current = products.get(row.data.sku);
        if (
          (row.snapshot &&
            (!current || current.id !== row.snapshot.id || current.revision !== row.snapshot.revision)) ||
          (!row.snapshot && current)
        ) {
          await db.query("UPDATE catalog_imports SET status='stale' WHERE id=$1", [id]);
          return {
            conflict: `El SKU ${row.data.sku} cambió después de la vista previa. Vuelve a cargar y revisar el archivo.`,
          };
        }
        this.stockErrors(row, current);
        if (row.errors.length) {
          await db.query("UPDATE catalog_imports SET status='stale' WHERE id=$1", [id]);
          return { conflict: 'Cambió la disponibilidad necesaria para publicar. Vuelve a revisar el lote.' };
        }
      }
      const ids: string[] = [];
      for (const row of batch.rows) {
        const d = row.data;
        const values = [
          actor.supplierId,
          d.sku,
          d.nombre,
          d.categoria,
          d.presentacion,
          Number(d.unidades_por_presentacion),
          Number(d.minimo),
          Number(d.multiplo),
          d.precio,
          d.moneda,
          d.incluye_igv === 'true',
          d.publicado === 'true',
        ];
        if (row.snapshot) {
          const updated = await db.query(
            `UPDATE products SET name=$3,category=$4,unit=$5,units_per_pack=$6,
            minimum=$7,multiple=$8,price=$9,currency=$10,includes_tax=$11,published=$12
            WHERE supplier_id=$1 AND sku=$2 RETURNING id`,
            values,
          );
          ids.push(updated.rows[0].id);
        } else {
          const inserted = await db.query(
            `INSERT INTO products(supplier_id,sku,name,category,unit,units_per_pack,
            minimum,multiple,price,currency,includes_tax,published,stock)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            [...values, Number(d.stock)],
          );
          ids.push(inserted.rows[0].id);
        }
      }
      const summary = {
        created: batch.rows.filter(r => r.action === 'create').length,
        updated: batch.rows.filter(r => r.action === 'update').length,
        productIds: ids,
      };
      const applied = await db.query<Batch>(
        `UPDATE catalog_imports SET status='applied',confirmation_key=$2,
        result=$3,applied_at=now() WHERE id=$1 RETURNING *`,
        [id, key, JSON.stringify(summary)],
      );
      await this.audit(db, actor.accountId, 'confirm-import', id);
      return { report: this.report(applied.rows[0]) };
    });
    if (outcome.conflict) throw new ConflictException(outcome.conflict);
    return outcome.report;
  }
}
