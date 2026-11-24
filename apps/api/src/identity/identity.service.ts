import {
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new BadRequestException('Contraseña de 12 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await scrypt(password, salt, 64)) as Buffer).toString('hex');
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException('Datos inválidos.');
  return value.trim();
}
function email(value: unknown): string {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new BadRequestException('Correo inválido.');
  return result;
}
export function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new BadRequestException('Identificador inválido.');
  return value;
}
type Actor = {
  id: string;
  platform_admin: boolean;
  membership_id?: string;
  company_id?: string;
  permissions: string[];
};
@Injectable()
export class IdentityService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  private async tx<T>(action: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const result = await action(db);
      await db.query('COMMIT');
      return result;
    } catch (error: any) {
      await db.query('ROLLBACK');
      if (error.code === '23505')
        throw new ConflictException('Correo o RUC ya registrado. La coincidencia no concede acceso.');
      throw error;
    } finally {
      db.release();
    }
  }
  private async authenticated(db: PoolClient, authorization?: string): Promise<Actor> {
    const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new UnauthorizedException();
    const { rows } = await db.query(
      'SELECT a.id, a.platform_admin FROM identity_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() FOR UPDATE OF a',
      [digest(token)],
    );
    const actor = rows[0];
    if (!actor) throw new UnauthorizedException();
    return actor;
  }
  private async actor(db: PoolClient, authorization?: string, admin = false): Promise<Actor> {
    const actor = await this.authenticated(db, authorization);
    if (admin) {
      if (!actor.platform_admin) throw new ForbiddenException();
      return actor;
    }
    const membership = await db.query(
      `SELECT m.id AS membership_id,m.company_id,m.permissions FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.account_id=$1 AND m.active AND c.status='enabled' FOR UPDATE OF m`,
      [actor.id],
    );
    if (!membership.rows[0]) throw new ForbiddenException('Vinculación no habilitada.');
    return { ...actor, ...membership.rows[0] };
  }
  private async audit(db: PoolClient, actor: Actor, action: string, id: string) {
    await db.query('INSERT INTO identity_audit(actor_id,action,resource_id) VALUES($1,$2,$3)', [actor.id, action, id]);
  }
  async requireSupplier(db: PoolClient, auth?: string): Promise<{ accountId: string; supplierId: string }> {
    const actor = await this.actor(db, auth);
    if (!actor.permissions.includes('publish')) throw new ForbiddenException('Requiere permiso de publicación.');
    const result = await db.query(
      `SELECT s.id FROM suppliers s JOIN companies c ON c.supplier_id=s.id
      WHERE c.id=$1 AND c.status='enabled' AND s.verified FOR SHARE OF s,c`,
      [actor.company_id],
    );
    if (!result.rows[0]) throw new ForbiddenException('Requiere proveedor verificado.');
    return { accountId: actor.id, supplierId: result.rows[0].id };
  }
  async tradeIdentity(db: PoolClient, auth?: string) {
    const actor = await this.actor(db, auth);
    const company = (
      await db.query(
        `SELECT c.id,c.supplier_id,s.verified FROM companies c JOIN suppliers s ON s.id=c.supplier_id
      WHERE c.id=$1 AND c.status='enabled' FOR SHARE OF c,s`,
        [actor.company_id],
      )
    ).rows[0];
    if (!company) throw new ForbiddenException('Empresa no habilitada.');
    return {
      accountId: actor.id,
      companyId: company.id as string,
      supplierId: company.supplier_id as string,
      canBuy: actor.permissions.includes('buy'),
      canSell: actor.permissions.includes('publish') && company.verified === true,
    };
  }
  async register(body: any) {
    const mail = email(body.email),
      ruc = text(body.ruc, 11),
      name = text(body.legalName),
      evidence = text(body.evidence, 2000);
    if (!/^\d{11}$/.test(ruc) || name.length < 2)
      throw new BadRequestException('RUC de 11 dígitos y razón social requeridos.');
    const hash = await passwordHash(body.password);
    return this.tx(async db => {
      const supplier = await db.query('INSERT INTO suppliers(code,name) VALUES($1,$2) RETURNING id', [
        'company-' + randomBytes(16).toString('hex'),
        name,
      ]);
      const company = await db.query(
        'INSERT INTO companies(ruc,legal_name,supplier_id) VALUES($1,$2,$3) RETURNING id',
        [ruc, name, supplier.rows[0].id],
      );
      const account = await db.query('INSERT INTO accounts(email,password_hash) VALUES($1,$2) RETURNING id', [
        mail,
        hash,
      ]);
      const request = await db.query(
        'INSERT INTO enrollment_requests(company_id,account_id,evidence) VALUES($1,$2,$3) RETURNING id',
        [company.rows[0].id, account.rows[0].id, evidence],
      );
      return { requestId: request.rows[0].id, status: 'pending' };
    });
  }
  async login(body: any) {
    const mail = email(body.email);
    if (typeof body.password !== 'string' || body.password.length > 128) throw new UnauthorizedException();
    const password = body.password;
    const account = await this.pool.query('SELECT id,password_hash FROM accounts WHERE email=$1', [mail]);
    const row = account.rows[0];
    const [salt, hash] = (row?.password_hash ?? '00000000000000000000000000000000:' + '0'.repeat(128)).split(':');
    const candidate = (await scrypt(password, salt, 64)) as Buffer;
    if (!timingSafeEqual(candidate, Buffer.from(hash, 'hex')) || !row)
      throw new UnauthorizedException('Credenciales inválidas.');
    const suspended = (
      await this.pool.query(
        "SELECT c.suspended_reason FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.account_id=$1 AND m.active AND c.status='suspended'",
        [row.id],
      )
    ).rows[0];
    if (suspended)
      throw new ForbiddenException(
        'Tu empresa está suspendida por el administrador. Motivo: ' +
          (suspended.suspended_reason ?? 'sin detalle') +
          '.',
      );
    const token = randomBytes(32).toString('hex');
    await this.pool.query('INSERT INTO identity_sessions(token_hash,account_id) VALUES($1,$2)', [
      digest(token),
      row.id,
    ]);
    return { token, expiresIn: 28800 };
  }
  async logout(auth?: string) {
    const token = auth?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new UnauthorizedException();
    await this.pool.query('DELETE FROM identity_sessions WHERE token_hash=$1', [digest(token)]);
    return { loggedOut: true };
  }
  async me(auth?: string) {
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      const company = await db.query(
        'SELECT c.id,c.ruc,c.legal_name,c.review_label,c.supplier_id,s.verified AS supplier_verified FROM companies c JOIN suppliers s ON s.id=c.supplier_id WHERE c.id=$1',
        [actor.company_id],
      );
      return {
        accountId: actor.id,
        membershipId: actor.membership_id,
        permissions: actor.permissions,
        company: company.rows[0],
      };
    });
  }
  async session(auth?: string) {
    return this.tx(async db => {
      const account = await this.authenticated(db, auth);
      return { accountId: account.id, platformAdmin: account.platform_admin };
    });
  }
  async requests(auth?: string) {
    return this.tx(async db => {
      await this.actor(db, auth, true);
      return (
        await db.query(
          // Pendientes primero; supplier_verified evita ofrecer «Verificar» a quien ya lo está.
          'SELECT r.id,r.evidence,r.approved_at,c.ruc,c.legal_name,c.supplier_id,a.email,COALESCE(s.verified,false) AS supplier_verified FROM enrollment_requests r JOIN companies c ON c.id=r.company_id JOIN accounts a ON a.id=r.account_id LEFT JOIN suppliers s ON s.id=c.supplier_id ORDER BY r.approved_at IS NOT NULL,r.id',
        )
      ).rows;
    });
  }
  async approve(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const request = (await db.query('SELECT * FROM enrollment_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!request) throw new BadRequestException('Solicitud inexistente.');
      if (!request.approved_at) {
        await db.query("UPDATE companies SET status='enabled',review_label='revisado manualmente' WHERE id=$1", [
          request.company_id,
        ]);
        await db.query(
          "INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,ARRAY['manage','buy','publish'])",
          [request.company_id, request.account_id],
        );
        await db.query('UPDATE enrollment_requests SET approved_at=now(),approved_by=$2 WHERE id=$1', [id, actor.id]);
        await this.audit(db, actor, 'approve-enrollment', id);
      }
      return { companyId: request.company_id, reviewLabel: 'revisado manualmente' };
    });
  }
  async invite(body: any, auth?: string) {
    const mail = email(body.email),
      permissions = body.permissions;
    if (!Array.isArray(permissions) || !permissions.length || permissions.some(p => !['buy', 'publish'].includes(p)))
      throw new BadRequestException('Permisos inválidos.');
    // Vigencia del enlace: 1 día por defecto; el dueño puede elegir 7 o 30 días.
    const days = body.dias === undefined ? 1 : Number(body.dias);
    if (![1, 7, 30].includes(days)) throw new BadRequestException('La vigencia debe ser 1, 7 o 30 días.');
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('manage')) throw new ForbiddenException();
      const token = randomBytes(32).toString('hex');
      const result = await db.query(
        `INSERT INTO invitations(company_id,email,permissions,token_hash,created_by,expires_at)
         VALUES($1,$2,$3,$4,$5,now()+make_interval(days => $6)) RETURNING id,expires_at`,
        [actor.company_id, mail, permissions, digest(token), actor.membership_id, days],
      );
      await this.audit(db, actor, 'invite', result.rows[0].id);
      return { ...result.rows[0], link: '/accept-invitation#token=' + token };
    });
  }
  async accept(body: any) {
    const token = text(body.token, 64),
      mail = email(body.email),
      hash = await passwordHash(body.password);
    return this.tx(async db => {
      const inv = (
        await db.query(
          `SELECT i.* FROM invitations i JOIN memberships m ON m.id=i.created_by WHERE i.token_hash=$1 AND i.email=$2 AND i.used_at IS NULL AND i.expires_at>now() AND m.active AND 'manage'=ANY(m.permissions) FOR UPDATE OF i,m`,
          [digest(token), mail],
        )
      ).rows[0];
      if (!inv) throw new BadRequestException('Invitación inválida, vencida o utilizada.');
      const account = (
        await db.query('INSERT INTO accounts(email,password_hash) VALUES($1,$2) RETURNING id', [mail, hash])
      ).rows[0];
      await db.query('INSERT INTO memberships(company_id,account_id,permissions) VALUES($1,$2,$3)', [
        inv.company_id,
        account.id,
        inv.permissions,
      ]);
      await db.query('UPDATE invitations SET used_at=now() WHERE id=$1', [inv.id]);
      await this.audit(db, { id: account.id } as Actor, 'accept-invitation', inv.id);
      return { accepted: true };
    });
  }
  async members(auth?: string) {
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('manage')) throw new ForbiddenException();
      return (
        await db.query(
          'SELECT m.id,a.email,m.permissions,m.active FROM memberships m JOIN accounts a ON a.id=m.account_id WHERE m.company_id=$1',
          [actor.company_id],
        )
      ).rows;
    });
  }
  async revoke(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('manage')) throw new ForbiddenException();
      const result = await db.query(
        "UPDATE memberships SET active=false WHERE id=$1 AND company_id=$2 AND NOT ('manage'=ANY(permissions)) RETURNING account_id",
        [id, actor.company_id],
      );
      if (!result.rowCount) throw new ForbiddenException('No se puede revocar esta vinculación.');
      await db.query('DELETE FROM identity_sessions WHERE account_id=$1', [result.rows[0].account_id]);
      await this.audit(db, actor, 'revoke-membership', id);
      return { revoked: true };
    });
  }
  async verify(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const result = await db.query(
        "UPDATE suppliers s SET verified=true FROM companies c WHERE c.supplier_id=s.id AND s.id=$1 AND c.status='enabled' RETURNING s.id",
        [id],
      );
      if (!result.rowCount) throw new BadRequestException('Proveedor no habilitado.');
      await this.audit(db, actor, 'verify-provider', id);
      return { verified: true, reviewLabel: 'revisado manualmente' };
    });
  }
  async publish(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('publish')) throw new ForbiddenException();
      const retired = (
        await db.query('SELECT retired_reason FROM products WHERE id=$1 AND retired_at IS NOT NULL', [id])
      ).rows[0];
      if (retired)
        throw new ForbiddenException('El administrador retiró este producto. Motivo: ' + retired.retired_reason + '.');
      const result = await db.query(
        'UPDATE products p SET published=true FROM suppliers s,companies c WHERE p.id=$1 AND p.supplier_id=s.id AND c.supplier_id=s.id AND c.id=$2 AND s.verified AND (p.published OR p.stock>=p.minimum) RETURNING p.id',
        [id, actor.company_id],
      );
      if (!result.rowCount) throw new ForbiddenException('Requiere propiedad y proveedor verificado.');
      await this.audit(db, actor, 'publish-product', id);
      return { published: true };
    });
  }
  /** Todos los productos propios (publicados, ocultos o retirados) para el panel «Mis productos». */
  async ownProducts(auth?: string) {
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('publish')) throw new ForbiddenException();
      return (
        await db.query(
          `SELECT p.id,p.sku,p.name,p.category,p.unit,p.stock,p.minimum,p.price::text,p.published,
             p.retired_reason AS "retiredReason",
             (SELECT i.url FROM product_images i WHERE i.product_id=p.id ORDER BY i.position LIMIT 1) AS photo
           FROM products p JOIN companies c ON c.supplier_id=p.supplier_id
           WHERE c.id=$1 ORDER BY p.name LIMIT 1000`,
          [actor.company_id],
        )
      ).rows;
    });
  }
  async unpublish(id: string, auth?: string) {
    uuid(id);
    return this.tx(async db => {
      const actor = await this.actor(db, auth);
      if (!actor.permissions.includes('publish')) throw new ForbiddenException();
      const result = await db.query(
        'UPDATE products p SET published=false FROM companies c WHERE p.id=$1 AND c.supplier_id=p.supplier_id AND c.id=$2 RETURNING p.id',
        [id, actor.company_id],
      );
      if (!result.rowCount) throw new ForbiddenException('Solo puedes ocultar tus propios productos.');
      await this.audit(db, actor, 'unpublish-product', id);
      return { published: false };
    });
  }
  // ---- Moderación (solo administrador de la plataforma) ----
  /** Rechaza una solicitud pendiente: borra la cuenta y la empresa sin aprobar y deja el motivo en la bitácora. */
  async reject(id: string, body: any, auth?: string) {
    uuid(id);
    const why = this.reason(body?.reason);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const request = (
        await db.query(
          'SELECT r.approved_at,r.company_id,r.account_id,c.legal_name,c.supplier_id FROM enrollment_requests r JOIN companies c ON c.id=r.company_id WHERE r.id=$1 FOR UPDATE OF r,c',
          [id],
        )
      ).rows[0];
      if (!request) throw new BadRequestException('Solicitud inexistente.');
      if (request.approved_at)
        throw new ConflictException('La solicitud ya fue aprobada. Para bloquear la empresa, suspéndela.');
      await db.query('DELETE FROM identity_sessions WHERE account_id=$1', [request.account_id]);
      await db.query('DELETE FROM enrollment_requests WHERE id=$1', [id]);
      await db.query('DELETE FROM accounts WHERE id=$1', [request.account_id]);
      await db.query('DELETE FROM companies WHERE id=$1', [request.company_id]);
      await db.query('DELETE FROM suppliers WHERE id=$1', [request.supplier_id]);
      await this.moderation(db, actor, 'reject-enrollment', id, request.legal_name, why);
      return { status: 'rejected' };
    });
  }
  private reason(value: unknown): string {
    const result = typeof value === 'string' ? value.trim() : '';
    if (result.length < 5 || result.length > 500)
      throw new BadRequestException('Escribe un motivo de 5 a 500 caracteres.');
    return result;
  }
  private async moderation(db: PoolClient, actor: Actor, action: string, id: string, name: string, reason: string) {
    await db.query(
      'INSERT INTO moderation_actions(actor_id,action,resource_id,resource_name,reason) VALUES($1,$2,$3,$4,$5)',
      [actor.id, action, id, name, reason],
    );
  }
  async companies(auth?: string, search?: string) {
    const term = typeof search === 'string' && search.trim() ? search.trim().slice(0, 100) : null;
    return this.tx(async db => {
      await this.actor(db, auth, true);
      return (
        await db.query(
          `SELECT c.id,c.ruc,c.legal_name AS "legalName",c.status,c.suspended_reason AS "suspendedReason",
             COALESCE(s.verified,false) AS "supplierVerified",
             (SELECT count(*)::int FROM products p WHERE p.supplier_id=c.supplier_id AND p.published) AS "publishedProducts"
           FROM companies c LEFT JOIN suppliers s ON s.id=c.supplier_id
           WHERE $1::text IS NULL OR strpos(lower(c.legal_name || ' ' || c.ruc), lower($1)) > 0
           ORDER BY c.status='suspended' DESC, c.legal_name LIMIT 100`,
          [term],
        )
      ).rows;
    });
  }
  async suspendCompany(id: string, body: any, auth?: string) {
    uuid(id);
    const why = this.reason(body?.reason);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const company = (
        await db.query(
          "UPDATE companies SET status='suspended',suspended_reason=$2 WHERE id=$1 AND status='enabled' RETURNING legal_name",
          [id, why],
        )
      ).rows[0];
      if (!company) throw new BadRequestException('Solo se puede suspender una empresa habilitada.');
      // Cierra las sesiones abiertas de sus usuarios: dejan de operar de inmediato.
      await db.query(
        'DELETE FROM identity_sessions WHERE account_id IN (SELECT account_id FROM memberships WHERE company_id=$1)',
        [id],
      );
      await this.moderation(db, actor, 'suspend-company', id, company.legal_name, why);
      return { status: 'suspended' };
    });
  }
  async reactivateCompany(id: string, body: any, auth?: string) {
    uuid(id);
    const why = this.reason(body?.reason);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const company = (
        await db.query(
          "UPDATE companies SET status='enabled',suspended_reason=NULL WHERE id=$1 AND status='suspended' RETURNING legal_name",
          [id],
        )
      ).rows[0];
      if (!company) throw new BadRequestException('La empresa no está suspendida.');
      await this.moderation(db, actor, 'reactivate-company', id, company.legal_name, why);
      return { status: 'enabled' };
    });
  }
  async retireProduct(id: string, body: any, auth?: string) {
    uuid(id);
    const why = this.reason(body?.reason);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const product = (
        await db.query(
          'UPDATE products SET published=false,retired_at=now(),retired_reason=$2 WHERE id=$1 AND retired_at IS NULL RETURNING name',
          [id, why],
        )
      ).rows[0];
      if (!product) throw new BadRequestException('El producto no existe o ya fue retirado.');
      await this.moderation(db, actor, 'retire-product', id, product.name, why);
      return { retired: true };
    });
  }
  async restoreProduct(id: string, body: any, auth?: string) {
    uuid(id);
    const why = this.reason(body?.reason);
    return this.tx(async db => {
      const actor = await this.actor(db, auth, true);
      const product = (
        await db.query(
          'UPDATE products SET retired_at=NULL,retired_reason=NULL,published=(stock>=minimum) WHERE id=$1 AND retired_at IS NOT NULL RETURNING name',
          [id],
        )
      ).rows[0];
      if (!product) throw new BadRequestException('El producto no está retirado.');
      await this.moderation(db, actor, 'restore-product', id, product.name, why);
      return { retired: false };
    });
  }
  async retiredProducts(auth?: string) {
    return this.tx(async db => {
      await this.actor(db, auth, true);
      return (
        await db.query(
          `SELECT p.id,p.name,s.name AS supplier,p.retired_at AS "retiredAt",p.retired_reason AS reason
           FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.retired_at IS NOT NULL
           ORDER BY p.retired_at DESC LIMIT 100`,
        )
      ).rows;
    });
  }
  async moderationLog(auth?: string) {
    return this.tx(async db => {
      await this.actor(db, auth, true);
      return (
        await db.query(
          `SELECT m.id::text,m.action,m.resource_id AS "resourceId",m.resource_name AS "resourceName",m.reason,
             m.created_at AS "createdAt",a.email AS actor
           FROM moderation_actions m JOIN accounts a ON a.id=m.actor_id ORDER BY m.id DESC LIMIT 50`,
        )
      ).rows;
    });
  }
}
