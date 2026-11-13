import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { createHash } from 'node:crypto';
import { IdentityService } from '../../identity/identity.service';
import { TradeStore } from '../application/trade';
import {
  amount,
  compatible,
  conditions,
  money,
  OfferDraft,
  priceTotal,
  RequestDraft,
  rule,
  TradeRule,
} from '../domain/trade';
type Actor = Awaited<ReturnType<IdentityService['tradeIdentity']>>;
@Injectable()
export class PostgresTrade implements TradeStore {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly identity: IdentityService,
  ) {}
  private async tx<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const db = await this.pool.connect();
      try {
        await db.query('BEGIN');
        await db.query("SET LOCAL lock_timeout='5s'");
        const result = await work(db);
        await db.query('COMMIT');
        return result;
      } catch (e: any) {
        await db.query('ROLLBACK');
        if (['40P01', '40001'].includes(e.code) && attempt < 1) continue;
        if (['22007', '22008'].includes(e.code)) throw new TradeRule('INVALID_INPUT', 'Fecha de vigencia inválida.');
        if (['23505', '55P03', '40P01', '40001'].includes(e.code))
          throw new TradeRule('CONCURRENT_CHANGE', 'Conflicto concurrente. Actualiza y reintenta.');
        throw e;
      } finally {
        db.release();
      }
    }
  }
  private access(actor: Actor, kind: 'buy' | 'sell') {
    if (!(kind === 'buy' ? actor.canBuy : actor.canSell))
      throw new ForbiddenException('Permiso comercial insuficiente o proveedor no verificado.');
  }
  private async audit(db: PoolClient, actor: Actor, action: string, id: string) {
    await db.query('INSERT INTO identity_audit(actor_id,action,resource_id) VALUES($1,$2,$3)', [
      actor.accountId,
      action,
      id,
    ]);
  }
  private async request(db: PoolClient, id: string, actor: Actor, lock = false) {
    const q = (
      await db.query(
        `SELECT q.*,c.legal_name AS buyer_name FROM quotation_requests q JOIN companies c ON c.id=q.buyer_company_id WHERE q.id=$1 ${lock ? 'FOR UPDATE OF q' : ''}`,
        [id],
      )
    ).rows[0];
    if (!q) throw new NotFoundException();
    const buyer = actor.canBuy && q.buyer_company_id === actor.companyId;
    const recipient =
      actor.canSell &&
      (
        await db.query('SELECT 1 FROM quotation_recipients WHERE request_id=$1 AND supplier_id=$2', [
          id,
          actor.supplierId,
        ])
      ).rowCount;
    if (!buyer && !recipient) throw new NotFoundException();
    return { ...q, isBuyer: buyer };
  }
  private async details(db: PoolClient, id: string, actor: Actor) {
    const q = await this.request(db, id, actor);
    const items = (
      await db.query(
        `SELECT id,description,unit,units_per_pack AS "unitsPerPack",quantity FROM quotation_items WHERE request_id=$1 ORDER BY id`,
        [id],
      )
    ).rows;
    const suppliers = (
      await db.query(
        `SELECT s.id,s.name FROM quotation_recipients r JOIN suppliers s ON s.id=r.supplier_id WHERE r.request_id=$1 AND ($2 OR s.id=$3) ORDER BY s.name`,
        [id, q.isBuyer, actor.supplierId],
      )
    ).rows;
    const offers = (
      await db.query(
        `SELECT o.*,s.name AS supplier_name FROM quotation_offers o JOIN suppliers s ON s.id=o.supplier_id WHERE o.request_id=$1 AND ($2 OR o.supplier_id=$3) ORDER BY o.created_at`,
        [id, q.isBuyer, actor.supplierId],
      )
    ).rows;
    const mapped = [];
    for (const o of offers) {
      const lines = (
        await db.query(
          `SELECT request_item_id AS "requestItemId",product_id AS "productId",quantity,unit_price AS "unitPrice",subtotal,snapshot FROM quotation_offer_items WHERE offer_id=$1 ORDER BY request_item_id`,
          [o.id],
        )
      ).rows;
      mapped.push({
        id: o.id,
        supplierId: o.supplier_id,
        supplierName: o.supplier_name,
        currency: o.currency,
        includesTax: o.includes_tax,
        shipping: o.shipping,
        subtotal: o.subtotal,
        total: o.total,
        deliveryDays: o.delivery_days,
        expiresAt: o.expires_at,
        items: lines,
      });
    }
    // A supplier must not learn the competitor's accepted offer ID either.
    const acceptedOfferId = q.isBuyer
      ? q.accepted_offer_id
      : (mapped.find(o => o.id === q.accepted_offer_id)?.id ?? null);
    return {
      id: q.id,
      buyerName: q.buyer_name,
      isBuyer: q.isBuyer,
      status: q.accepted_offer_id ? 'aceptada' : 'abierta',
      acceptedOfferId,
      items,
      suppliers,
      offers: mapped,
    };
  }
  async providers(auth?: string) {
    return this.tx(async db => {
      const actor = await this.identity.tradeIdentity(db, auth);
      this.access(actor, 'buy');
      return (
        await db.query(
          `SELECT s.id,s.name FROM suppliers s JOIN companies c ON c.supplier_id=s.id WHERE s.verified AND c.status='enabled' AND c.id<>$1 ORDER BY s.name`,
          [actor.companyId],
        )
      ).rows;
    });
  }
  async products(auth?: string) {
    return this.tx(async db => {
      const actor = await this.identity.tradeIdentity(db, auth);
      this.access(actor, 'sell');
      return (
        await db.query(
          `SELECT id,sku,name,unit,units_per_pack AS "unitsPerPack",minimum,multiple,stock,price FROM products WHERE supplier_id=$1 AND published ORDER BY name`,
          [actor.supplierId],
        )
      ).rows;
    });
  }
  async create(input: RequestDraft, auth?: string) {
    return this.tx(async db => {
      const actor = await this.identity.tradeIdentity(db, auth);
      this.access(actor, 'buy');
      const eligible = await db.query(
        `SELECT s.id FROM suppliers s JOIN companies c ON c.supplier_id=s.id WHERE s.id=ANY($1::uuid[]) AND s.verified AND c.status='enabled' AND c.id<>$2 FOR SHARE OF s,c`,
        [input.proveedorIds, actor.companyId],
      );
      rule(
        eligible.rowCount === input.proveedorIds.length,
        'INVALID_INPUT',
        'Selecciona proveedores verificados de otras empresas.',
      );
      const id = (
        await db.query('INSERT INTO quotation_requests(buyer_company_id,actor_id) VALUES($1,$2) RETURNING id', [
          actor.companyId,
          actor.accountId,
        ])
      ).rows[0].id;
      for (const i of input.items)
        await db.query(
          'INSERT INTO quotation_items(request_id,description,unit,units_per_pack,quantity) VALUES($1,$2,$3,$4,$5)',
          [id, i.descripcion, i.presentacion, i.unidadesPorPresentacion, i.cantidad],
        );
      for (const supplier of input.proveedorIds)
        await db.query('INSERT INTO quotation_recipients VALUES($1,$2)', [id, supplier]);
      await this.audit(db, actor, 'create-quotation', id);
      return this.details(db, id, actor);
    });
  }
  async requests(auth?: string) {
    return this.tx(async db => {
      const a = await this.identity.tradeIdentity(db, auth);
      return (
        await db.query(
          `SELECT q.id,c.legal_name AS "buyerName",
   (SELECT i.description FROM quotation_items i WHERE i.request_id=q.id ORDER BY i.id LIMIT 1) AS "primaryProduct",
   (SELECT count(*)::int FROM quotation_offers o WHERE o.request_id=q.id AND (($1 AND q.buyer_company_id=$2) OR ($3 AND o.supplier_id=$4))) AS "offerCount",
   CASE WHEN q.accepted_offer_id IS NULL THEN 'abierta' ELSE 'aceptada' END AS status
   FROM quotation_requests q JOIN companies c ON c.id=q.buyer_company_id
   WHERE ($1 AND q.buyer_company_id=$2) OR ($3 AND EXISTS(SELECT 1 FROM quotation_recipients r WHERE r.request_id=q.id AND r.supplier_id=$4))
   ORDER BY q.created_at DESC LIMIT 100`,
          [a.canBuy, a.companyId, a.canSell, a.supplierId],
        )
      ).rows;
    });
  }
  async detail(id: string, auth?: string) {
    return this.tx(async db => this.details(db, id, await this.identity.tradeIdentity(db, auth)));
  }
  async respond(id: string, input: OfferDraft, auth?: string) {
    return this.tx(async db => {
      const a = await this.identity.tradeIdentity(db, auth);
      this.access(a, 'sell');
      const q = await this.request(db, id, a, true);
      // A buyer-side view does not grant the right to respond as a recipient.
      if (
        !(
          await db.query('SELECT 1 FROM quotation_recipients WHERE request_id=$1 AND supplier_id=$2', [
            id,
            a.supplierId,
          ])
        ).rowCount
      )
        throw new NotFoundException();
      rule(!q.accepted_offer_id, 'ALREADY_ACCEPTED', 'La solicitud ya tiene una oferta aceptada.');
      rule(
        (await db.query('SELECT $1::timestamptz>clock_timestamp() AS valid', [input.vigenteHasta])).rows[0].valid,
        'OFFER_EXPIRED',
        'La oferta venció. Inicia una nueva solicitud.',
      );
      const requested = (await db.query('SELECT * FROM quotation_items WHERE request_id=$1', [id])).rows;
      rule(
        requested.length === input.items.length,
        'INVALID_INPUT',
        'La oferta debe cubrir todos los ítems solicitados.',
      );
      rule(
        !(await db.query('SELECT 1 FROM quotation_offers WHERE request_id=$1 AND supplier_id=$2', [id, a.supplierId]))
          .rowCount,
        'ALREADY_RESPONDED',
        'El proveedor ya respondió esta solicitud.',
      );
      const lines = [];
      for (const i of input.items) {
        const asked = requested.find(r => r.id === i.solicitudItemId);
        rule(asked && asked.quantity === i.cantidad, 'INVALID_INPUT', 'Ítem o cantidad no corresponde a la solicitud.');
        const p = (
          await db.query('SELECT * FROM products WHERE id=$1 AND supplier_id=$2', [i.productoId, a.supplierId])
        ).rows[0];
        rule(p, 'INVALID_INPUT', 'Producto ajeno o inexistente.');
        const snapshot = conditions(p);
        compatible(p, snapshot, i.cantidad);
        rule(
          snapshot.unit === asked.unit && snapshot.unitsPerPack === asked.units_per_pack,
          'INVALID_INPUT',
          'Presentación o equivalencia incompatible con la solicitud.',
        );
        rule(
          p.stock >= i.cantidad,
          'INSUFFICIENT_STOCK',
          'Stock insuficiente para ofrecer esa cantidad. Inicia otra solicitud.',
        );
        lines.push({ ...i, snapshot, subtotal: amount(money(i.precioUnitario) * BigInt(i.cantidad)) });
      }
      const totals = priceTotal(
        lines.map(l => ({ quantity: l.cantidad, unitPrice: l.precioUnitario })),
        input.costoEnvio,
      );
      const offer = (
        await db.query(
          `INSERT INTO quotation_offers(request_id,supplier_id,currency,includes_tax,shipping,subtotal,total,delivery_days,expires_at,actor_id)
   VALUES($1,$2,'PEN',true,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            id,
            a.supplierId,
            totals.shipping,
            totals.subtotal,
            totals.total,
            input.diasEntrega,
            input.vigenteHasta,
            a.accountId,
          ],
        )
      ).rows[0].id;
      for (const l of lines)
        await db.query(
          `INSERT INTO quotation_offer_items(offer_id,request_id,supplier_id,request_item_id,product_id,quantity,unit_price,subtotal,snapshot)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            offer,
            id,
            a.supplierId,
            l.solicitudItemId,
            l.productoId,
            l.cantidad,
            l.precioUnitario,
            l.subtotal,
            JSON.stringify(l.snapshot),
          ],
        );
      await this.audit(db, a, 'respond-quotation', offer);
      return this.details(db, id, a);
    });
  }
  async accept(id: string, offer: string, auth?: string) {
    return this.tx(async db => {
      const a = await this.identity.tradeIdentity(db, auth);
      this.access(a, 'buy');
      const q = await this.request(db, id, a, true);
      if (!q.isBuyer) throw new NotFoundException();
      rule(!q.accepted_offer_id || q.accepted_offer_id === offer, 'ALREADY_ACCEPTED', 'Otra oferta ya fue aceptada.');
      const o = (
        await db.query(
          `SELECT o.*,s.verified,(o.expires_at>clock_timestamp()) AS valid FROM quotation_offers o JOIN suppliers s ON s.id=o.supplier_id WHERE o.id=$1 AND o.request_id=$2`,
          [offer, id],
        )
      ).rows[0];
      if (!o) throw new NotFoundException();
      if (q.accepted_offer_id === offer) return this.details(db, id, a);
      rule(o.verified, 'CONDITIONS_CHANGED', 'El proveedor dejó de estar verificado. Inicia una nueva solicitud.');
      rule(o.valid, 'OFFER_EXPIRED', 'La oferta venció. Inicia una nueva solicitud.');
      await db.query('UPDATE quotation_requests SET accepted_offer_id=$2 WHERE id=$1', [id, offer]);
      await this.audit(db, a, 'accept-offer', offer);
      return this.details(db, id, a);
    });
  }
  private async orderView(db: PoolClient, id: string, a: Actor) {
    const o = (await db.query('SELECT * FROM trade_orders WHERE id=$1', [id])).rows[0];
    if (!o || !((a.canBuy && o.buyer_company_id === a.companyId) || (a.canSell && o.supplier_id === a.supplierId)))
      throw new NotFoundException();
    const items = (
      await db.query(
        `SELECT product_id AS "productId",quantity,unit_price AS "unitPrice",subtotal,snapshot FROM trade_order_items WHERE order_id=$1 ORDER BY id`,
        [id],
      )
    ).rows;
    const reservations = (
      await db.query(
        `SELECT product_id AS "productId",quantity,state,expires_at AS "expiresAt" FROM stock_reservations WHERE order_id=$1 ORDER BY product_id`,
        [id],
      )
    ).rows;
    return {
      id: o.id,
      requestId: o.request_id,
      offerId: o.offer_id,
      state: o.state,
      currency: o.currency,
      includesTax: o.includes_tax,
      shipping: o.shipping,
      subtotal: o.subtotal,
      total: o.total,
      deliveryDays: o.delivery_days,
      items,
      reservations,
    };
  }
  async order(offer: string, key: string, auth?: string) {
    return this.tx(async db => {
      const a = await this.identity.tradeIdentity(db, auth);
      this.access(a, 'buy');
      const hash = createHash('sha256').update(offer).digest('hex');
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [a.companyId + ':create-order:' + key]);
      const prior = (
        await db.query('SELECT * FROM order_keys WHERE buyer_company_id=$1 AND key=$2', [a.companyId, key])
      ).rows[0];
      if (prior) {
        rule(prior.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'La clave ya corresponde a otra oferta.');
        return this.orderView(db, prior.order_id, a);
      }
      const head = (await db.query('SELECT request_id FROM quotation_offers WHERE id=$1', [offer])).rows[0];
      if (!head) throw new NotFoundException();
      const q = await this.request(db, head.request_id, a, true);
      if (!q.isBuyer) throw new NotFoundException();
      rule(q.accepted_offer_id === offer, 'NOT_ACCEPTED', 'Primero acepta esta oferta.');
      const existing = (await db.query('SELECT id FROM trade_orders WHERE offer_id=$1', [offer])).rows[0];
      if (existing) {
        await db.query('INSERT INTO order_keys VALUES($1,$2,$3,$4)', [a.companyId, key, hash, existing.id]);
        return this.orderView(db, existing.id, a);
      }
      const o = (await db.query('SELECT * FROM quotation_offers WHERE id=$1', [offer])).rows[0];
      const eligible = await db.query(
        `SELECT 1 FROM suppliers s JOIN companies c ON c.supplier_id=s.id WHERE s.id=$1 AND s.verified AND c.status='enabled' FOR SHARE OF s,c`,
        [o.supplier_id],
      );
      rule(
        eligible.rowCount,
        'CONDITIONS_CHANGED',
        'Proveedor no habilitado o no verificado. Inicia una nueva solicitud.',
      );
      // Acquire write intention before row locks: compatible with other orders but
      // conflicts with T3 import's table lock, avoiding row/table lock inversion.
      await db.query('LOCK TABLE products IN ROW EXCLUSIVE MODE');
      const lines = (
        await db.query('SELECT * FROM quotation_offer_items WHERE offer_id=$1 ORDER BY product_id,request_item_id', [
          offer,
        ])
      ).rows;
      const ids = [...new Set(lines.map(l => l.product_id))].sort();
      const products = (await db.query('SELECT * FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]))
        .rows;
      rule(
        (await db.query('SELECT expires_at>clock_timestamp() AS valid FROM quotation_offers WHERE id=$1', [offer]))
          .rows[0].valid,
        'OFFER_EXPIRED',
        'La oferta venció. Inicia una nueva solicitud.',
      );
      const quantities = new Map<string, number>();
      for (const l of lines) {
        const p = products.find(p => p.id === l.product_id);
        rule(
          p && p.supplier_id === o.supplier_id,
          'CONDITIONS_CHANGED',
          'Producto no disponible. Inicia una nueva solicitud.',
        );
        compatible(p, l.snapshot, l.quantity);
        quantities.set(p.id, (quantities.get(p.id) ?? 0) + l.quantity);
      }
      for (const p of products)
        rule(
          p.stock >= (quantities.get(p.id) ?? 0),
          'INSUFFICIENT_STOCK',
          `Stock insuficiente para ${p.sku}. Inicia una nueva solicitud.`,
        );
      const id = (
        await db.query(
          `INSERT INTO trade_orders(request_id,offer_id,buyer_company_id,supplier_id,actor_id,currency,includes_tax,shipping,subtotal,total,delivery_days)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            q.id,
            offer,
            a.companyId,
            o.supplier_id,
            a.accountId,
            o.currency,
            o.includes_tax,
            o.shipping,
            o.subtotal,
            o.total,
            o.delivery_days,
          ],
        )
      ).rows[0].id;
      for (const productId of ids) {
        const quantity = quantities.get(productId)!;
        const updated = await db.query('UPDATE products SET stock=stock-$2 WHERE id=$1 AND stock>=$2 RETURNING id', [
          productId,
          quantity,
        ]);
        rule(updated.rowCount === 1, 'INSUFFICIENT_STOCK', 'Stock insuficiente. Inicia una nueva solicitud.');
        await db.query('INSERT INTO stock_reservations(order_id,product_id,quantity) VALUES($1,$2,$3)', [
          id,
          productId,
          quantity,
        ]);
      }
      for (const l of lines)
        await db.query(
          'INSERT INTO trade_order_items(order_id,product_id,request_item_id,quantity,unit_price,subtotal,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [id, l.product_id, l.request_item_id, l.quantity, l.unit_price, l.subtotal, JSON.stringify(l.snapshot)],
        );
      await db.query('INSERT INTO order_keys VALUES($1,$2,$3,$4)', [a.companyId, key, hash, id]);
      await this.audit(db, a, 'create-order', id);
      return this.orderView(db, id, a);
    });
  }
  async orders(auth?: string) {
    return this.tx(async db => {
      const a = await this.identity.tradeIdentity(db, auth);
      return (
        await db.query(
          `SELECT id,state,total,currency,created_at AS "createdAt" FROM trade_orders WHERE ($1 AND buyer_company_id=$2) OR ($3 AND supplier_id=$4) ORDER BY created_at DESC LIMIT 100`,
          [a.canBuy, a.companyId, a.canSell, a.supplierId],
        )
      ).rows;
    });
  }
  async orderDetail(id: string, auth?: string) {
    return this.tx(async db => this.orderView(db, id, await this.identity.tradeIdentity(db, auth)));
  }
}
