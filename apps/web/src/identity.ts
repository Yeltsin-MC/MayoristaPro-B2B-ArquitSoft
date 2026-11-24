import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CatalogProduct } from './catalog-product';
import { packDescription, presentations } from './wholesale-quantity';
import { FormsModule } from '@angular/forms';
import { CatalogImportComponent } from './catalog-import';
import { TradeComponent } from './trade';
import { SessionService } from './session.service';

/** Vista de la cuenta indicada por la URL (/cuenta/cotizaciones/:id, /cuenta/pedidos…). */
interface AccountTarget {
  view: 'account' | 'quotes' | 'orders';
  id?: string;
}
function accountTarget(url: string): AccountTarget {
  const [, section, id] = url.split(/[?#]/)[0].match(/^\/cuenta(?:\/(cotizaciones|pedidos))?(?:\/([^/]+))?/) ?? [];
  if (section === 'cotizaciones') return { view: 'quotes', id };
  if (section === 'pedidos' || url.startsWith('/payments/')) return { view: 'orders', id };
  return { view: 'account' };
}
@Component({
  selector: 'app-identity',
  imports: [DatePipe, FormsModule, CatalogImportComponent, TradeComponent],
  template: ` <section aria-label="Cuenta empresarial" class="identity">
    <div class="account-heading">
      <div>
        <h2>{{ token() && admin() ? 'Panel de administración' : 'Cuenta empresarial' }}</h2>
        @if (!token()) {
          <p>Demo con empresas ficticias. El alta se revisa manualmente.</p>
        }
      </div>
      @if (token()) {
        <div class="actions">
          @if (admin()) {
            <button class="secondary" [disabled]="busy()" (click)="loadAdmin()">Actualizar solicitudes</button>
          }
          <button class="secondary" (click)="logout()">Salir</button>
        </div>
      }
    </div>
    @if (restoring()) {
      <p role="status" class="notice">Comprobando tu sesión…</p>
    } @else if (!token()) {
      <div class="auth-layout">
        @if (pendingQuote(); as selection) {
          <aside class="quote-selection" aria-label="Selección para cotizar">
            <p class="eyebrow">TU SELECCIÓN PARA COTIZAR</p>
            <h3>{{ selection.product.name }}</h3>
            <p>{{ selection.product.supplier }}</p>
            <p>{{ packDescription(selection.product) }}</p>
            <strong>{{ presentations(selection.quantity, selection.product.unit) }}</strong>
            @if (selection.extra?.length) {
              <p>
                y {{ selection.extra!.length }}
                {{ selection.extra!.length === 1 ? 'producto más' : 'productos más' }} de tu lista de pedido
              </p>
            }
            <p class="selection-help">Al ingresar volverás a esta solicitud.</p>
          </aside>
        } @else {
          <aside class="auth-aside">
            @if (mode === 'register') {
              <h3>Registra tu empresa.</h3>
              <p>
                Crea la cuenta de tu empresa con su RUC. Tú quedas como responsable y luego puedes invitar a tu equipo.
              </p>
              <ol>
                <li>Completa RUC, razón social y tus datos de acceso.</li>
                <li>Administración revisa la solicitud manualmente.</li>
                <li>Al aprobarse, ya puedes comprar y, si vendes, publicar productos.</li>
              </ol>
            } @else if (mode === 'accept') {
              <h3>Únete a tu empresa.</h3>
              <p>Usa esta opción si el responsable de tu empresa te envió un enlace o código de invitación.</p>
              <ol>
                <li>Abre el enlace que te enviaron o pega el código.</li>
                <li>Escribe tu correo y crea tu contraseña.</li>
                <li>Entras con los permisos que te dio tu empresa.</li>
              </ol>
            } @else {
              <h3>Tu empresa,<br />mejor conectada.</h3>
              <p>Compra y vende con una cuenta empresarial revisada manualmente.</p>
              <ol>
                <li>Registra tu empresa o acepta una invitación.</li>
                <li>Espera la aprobación de administración.</li>
                <li>Solicita ofertas y compara proveedores.</li>
              </ol>
            }
          </aside>
        }
        <div class="auth-content">
          <nav class="auth-tabs" aria-label="Acceso">
            <button type="button" [attr.aria-pressed]="mode === 'login'" (click)="setMode('login')">Ingresar</button
            ><button type="button" [attr.aria-pressed]="mode === 'register'" (click)="setMode('register')">
              Registrar mi empresa</button
            ><button type="button" [attr.aria-pressed]="mode === 'accept'" (click)="setMode('accept')">
              Aceptar invitación
            </button>
          </nav>
          @if (message()) {
            <p class="notice" [class.error]="failed()" [attr.role]="failed() ? 'alert' : 'status'" aria-live="polite">
              {{ message() }}
            </p>
          }
          <form (ngSubmit)="submit()">
            <label
              >Correo<input name="email" type="email" autocomplete="username" required [(ngModel)]="email"
            /></label>
            <div class="password-group">
              <label for="password">Contraseña (12–128 caracteres)</label>
              <div class="password-field">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [attr.autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
                  autocapitalize="off"
                  spellcheck="false"
                  required
                  minlength="12"
                  maxlength="128"
                  [(ngModel)]="password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  aria-controls="password"
                  [attr.aria-pressed]="showPassword()"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [title]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  (click)="showPassword.set(!showPassword())"
                >
                  <span aria-hidden="true">{{ showPassword() ? '🙈' : '👁️' }}</span>
                </button>
              </div>
            </div>
            @if (mode === 'register') {
              <label
                >RUC (11 dígitos)<input name="ruc" pattern="[0-9]{11}" inputmode="numeric" required [(ngModel)]="ruc"
              /></label>
              <label>Razón social<input name="legalName" required [(ngModel)]="legalName" /></label>
              <label
                >Evidencia ficticia de representación<textarea
                  name="evidence"
                  required
                  [(ngModel)]="evidence"
                ></textarea>
              </label>
            }
            @if (mode === 'accept') {
              <label>Código de invitación<input name="invitation" required [(ngModel)]="invitation" /></label>
            }
            <button [disabled]="busy()">
              {{
                busy()
                  ? 'Procesando…'
                  : mode === 'login'
                    ? 'Ingresar'
                    : mode === 'register'
                      ? 'Enviar solicitud'
                      : 'Aceptar invitación'
              }}
            </button>
          </form>
        </div>
      </div>
    } @else {
      @if (company()) {
        <div
          class="company-summary account-panel"
          [class.tone-ok]="company().supplier_verified"
          [class.tone-wait]="!company().supplier_verified"
        >
          <div class="card-head">
            <h3>{{ company().legal_name }}</h3>
            <span class="status-pill">{{
              company().supplier_verified ? '✓ Proveedor verificado' : 'Proveedor por verificar'
            }}</span>
          </div>
          <p>RUC {{ company().ruc }} · {{ company().review_label }}</p>
          <div class="role-tags">
            @for (permission of permissions(); track permission) {
              <span>{{
                permission === 'buy'
                  ? 'Comprar'
                  : permission === 'publish'
                    ? 'Publicar'
                    : permission === 'manage'
                      ? 'Gestionar usuarios'
                      : permission
              }}</span>
            }
          </div>
        </div>
        @if (permissions().includes('buy') || (permissions().includes('publish') && company().supplier_verified)) {
          <app-trade
            [token]="token()"
            [canBuy]="permissions().includes('buy')"
            [canSell]="permissions().includes('publish') && company().supplier_verified"
          />
        }
        @if (permissions().includes('manage')) {
          <details class="management account-panel">
            <summary>Usuarios y accesos de mi empresa</summary>
            <form (ngSubmit)="invite()">
              <h3>Invitar usuario</h3>
              <label>Correo<input name="inviteEmail" type="email" required [(ngModel)]="inviteEmail" /></label
              ><label class="check"><input name="buy" type="checkbox" [(ngModel)]="buy" />Comprar</label
              ><label class="check"><input name="publish" type="checkbox" [(ngModel)]="publish" />Publicar</label
              ><label
                >Vigencia del enlace<select name="inviteDays" [(ngModel)]="inviteDays">
                  <option [ngValue]="1">24 horas</option>
                  <option [ngValue]="7">7 días</option>
                  <option [ngValue]="30">30 días</option>
                </select></label
              ><button [disabled]="busy()">Crear enlace de invitación</button>
            </form>
            @if (link()) {
              <p>
                Comparte este enlace con el destinatario <a [href]="link()">{{ link() }}</a>
              </p>
            }
            <button class="secondary" (click)="loadMembers()">Ver usuarios</button>
            @for (member of members(); track member.id) {
              <p>
                {{ member.email }} · {{ member.active ? 'Activo' : 'Revocado' }}
                @if (member.active && !member.permissions.includes('manage')) {
                  <button class="secondary" (click)="revoke(member.id)">Revocar acceso</button>
                }
              </p>
            }
          </details>
        }
        @if (permissions().includes('publish')) {
          @if (company().supplier_verified) {
            <section class="my-products account-panel" aria-labelledby="my-products-title">
              <div class="my-products-head">
                <h3 id="my-products-title">Mis productos</h3>
                <span class="count-pill">{{ publishedCount() }} publicados de {{ ownProducts().length }}</span>
              </div>
              <p class="muted">
                Oculta un producto cuando no quieras recibir cotizaciones por él y vuelve a publicarlo cuando quieras.
              </p>
              @if (ownProducts().length > 6) {
                <label class="my-products-search"
                  >Buscar en mis productos<input
                    name="productFilter"
                    type="search"
                    [(ngModel)]="productFilter"
                    placeholder="Nombre o SKU"
                /></label>
              }
              <ul class="my-products-list">
                @for (product of visibleProducts(); track product.id) {
                  <li>
                    @if (product.photo) {
                      <img [src]="product.photo" alt="" loading="lazy" />
                    } @else {
                      <span class="my-product-placeholder" aria-hidden="true">📦</span>
                    }
                    <div>
                      <strong>{{ product.name }}</strong>
                      <small
                        >SKU {{ product.sku }} · S/ {{ product.price }} · stock {{ product.stock }}
                        {{ product.unit }}</small
                      >
                      @if (product.retiredReason) {
                        <small class="retired">Retirado por administración: {{ product.retiredReason }}</small>
                      }
                    </div>
                    <span class="status-pill">{{
                      product.retiredReason ? 'Retirado' : product.published ? 'Publicado' : 'Oculto'
                    }}</span>
                    @if (!product.retiredReason) {
                      @if (product.published) {
                        <button
                          type="button"
                          class="secondary"
                          [disabled]="busy()"
                          [attr.aria-label]="'Ocultar ' + product.name"
                          (click)="setPublished(product, false)"
                        >
                          Ocultar
                        </button>
                      } @else {
                        <button
                          type="button"
                          [disabled]="busy()"
                          [attr.aria-label]="'Publicar ' + product.name"
                          (click)="setPublished(product, true)"
                        >
                          Publicar
                        </button>
                      }
                    }
                  </li>
                } @empty {
                  <li class="empty-state">Aún no tienes productos. Súbelos con la carga masiva de abajo.</li>
                }
              </ul>
            </section>
            <app-catalog-import [token]="token()" (applied)="loadOwnProducts()" />
          } @else {
            <p class="notice">La carga masiva y la publicación requieren que administración verifique tu empresa.</p>
          }
        }
      }
      @if (admin()) {
        <dl class="company-stats" aria-label="Resumen de administración">
          <div>
            <dt>Solicitudes pendientes</dt>
            <dd>{{ pendingRequests() }}</dd>
          </div>
          <div>
            <dt>Empresas aprobadas</dt>
            <dd>{{ requests().length - pendingRequests() }}</dd>
          </div>
        </dl>
        <h3 class="admin-section-title">Solicitudes de alta</h3>
      }
      @for (request of requests(); track request.id) {
        <article [class]="request.approved_at ? 'admin-card tone-ok' : 'admin-card tone-wait'">
          <h3>{{ request.legal_name }}</h3>
          <p>{{ request.ruc }} · {{ request.email }}</p>
          <p>Evidencia {{ request.evidence }}</p>
          @if (!request.approved_at) {
            @if (moderating()?.id === request.id) {
              <label
                >Motivo del rechazo<textarea
                  name="rejectReason"
                  rows="2"
                  maxlength="500"
                  placeholder="Ejemplo: el RUC no corresponde a la razón social"
                  [(ngModel)]="moderationReason"
                ></textarea>
              </label>
              <p class="muted">Se borrarán la cuenta y la empresa pendientes. Esta acción no se puede deshacer.</p>
              <div class="moderation-buttons">
                <button
                  class="danger"
                  [disabled]="busy() || moderationReason.trim().length < 5"
                  (click)="reject(request.id)"
                >
                  Confirmar rechazo
                </button>
                <button class="secondary" (click)="moderating.set(null)">Cancelar</button>
              </div>
            } @else {
              <div class="moderation-buttons">
                <button [disabled]="busy()" (click)="approve(request.id)">Aprobar vinculación</button>
                <button class="danger" [disabled]="busy()" (click)="startModeration(request.id)">
                  Rechazar solicitud
                </button>
              </div>
            }
          } @else {
            <p class="status-pill">Revisado manualmente</p>
            @if (request.supplier_verified) {
              <p class="status-pill">✓ Proveedor verificado</p>
            } @else if (request.supplier_id) {
              <button class="secondary" [disabled]="busy()" (click)="verify(request.supplier_id)">
                Verificar proveedor de {{ request.legal_name }}
              </button>
            }
          }
        </article>
      }
      @if (admin()) {
        @if (!requests().length) {
          <p class="empty-state">No hay solicitudes de alta por revisar.</p>
        }
        <form class="management account-panel" (ngSubmit)="verify()">
          <p class="muted">Verificación manual: usa el ID del proveedor si no aparece en la lista de arriba.</p>
          <label>ID del proveedor habilitado<input name="supplierId" required [(ngModel)]="supplierId" /></label
          ><button [disabled]="busy()">Verificar proveedor por separado</button>
        </form>
      }
      @if (admin()) {
        <h3 class="admin-section-title">Empresas registradas</h3>
        <form class="admin-search" role="search" (ngSubmit)="loadCompanies()">
          <label
            >Buscar empresa por nombre o RUC<input
              name="companySearch"
              type="search"
              [(ngModel)]="companySearch"
              placeholder="Ej.: Andina o 20123456789"
          /></label>
          <button class="secondary" [disabled]="busy()">Buscar</button>
        </form>
        @for (company of companies(); track company.id) {
          <article [class]="company.status === 'suspended' ? 'admin-card tone-wait' : 'admin-card tone-ok'">
            <h3>{{ company.legalName }}</h3>
            <p>
              RUC {{ company.ruc }} · {{ company.publishedProducts }} productos publicados
              {{ company.supplierVerified ? '· proveedor verificado' : '' }}
            </p>
            <p class="status-pill">
              {{
                company.status === 'suspended'
                  ? 'Suspendida'
                  : company.status === 'enabled'
                    ? 'Habilitada'
                    : 'Pendiente'
              }}
            </p>
            @if (company.status === 'suspended' && company.suspendedReason) {
              <p class="muted">Motivo: {{ company.suspendedReason }}</p>
            }
            @if (moderating()?.id === company.id) {
              <label
                >{{ company.status === 'suspended' ? 'Motivo de la reactivación' : 'Motivo de la suspensión'
                }}<textarea name="moderationReason" rows="2" maxlength="500" [(ngModel)]="moderationReason"></textarea>
              </label>
              <div class="moderation-buttons">
                <button
                  [class]="company.status === 'suspended' ? '' : 'danger'"
                  [disabled]="busy() || moderationReason.trim().length < 5"
                  (click)="moderateCompany(company)"
                >
                  {{ company.status === 'suspended' ? 'Confirmar reactivación' : 'Confirmar suspensión' }}
                </button>
                <button class="secondary" (click)="moderating.set(null)">Cancelar</button>
              </div>
            } @else if (company.status === 'enabled') {
              <button class="danger" [disabled]="busy()" (click)="startModeration(company.id)">
                Suspender {{ company.legalName }}
              </button>
            } @else if (company.status === 'suspended') {
              <button class="secondary" [disabled]="busy()" (click)="startModeration(company.id)">
                Reactivar {{ company.legalName }}
              </button>
            }
          </article>
        } @empty {
          <p class="empty-state">No encontramos empresas con esa búsqueda.</p>
        }
        <h3 class="admin-section-title">Productos retirados</h3>
        <p class="muted">Para retirar un producto, ábrelo en el Catálogo y usa «Retirar producto».</p>
        @for (product of retired(); track product.id) {
          <article class="admin-card tone-wait">
            <h3>{{ product.name }}</h3>
            <p>{{ product.supplier }} · retirado el {{ product.retiredAt | date: 'd/M/yyyy HH:mm' }}</p>
            <p class="muted">Motivo: {{ product.reason }}</p>
            @if (moderating()?.id === product.id) {
              <label
                >Motivo para volver a publicarlo<textarea
                  name="restoreReason"
                  rows="2"
                  maxlength="500"
                  [(ngModel)]="moderationReason"
                ></textarea>
              </label>
              <div class="moderation-buttons">
                <button [disabled]="busy() || moderationReason.trim().length < 5" (click)="restoreProduct(product.id)">
                  Confirmar restauración
                </button>
                <button class="secondary" (click)="moderating.set(null)">Cancelar</button>
              </div>
            } @else {
              <button class="secondary" [disabled]="busy()" (click)="startModeration(product.id)">
                Restaurar {{ product.name }}
              </button>
            }
          </article>
        } @empty {
          <p class="empty-state">No hay productos retirados.</p>
        }
        <h3 class="admin-section-title">Bitácora de moderación</h3>
        @if (moderationLog().length) {
          <ol class="moderation-log">
            @for (entry of moderationLog(); track entry.id) {
              <li>
                <strong>{{ actionLabel(entry.action) }}</strong> · {{ entry.resourceName }}
                <span class="muted"
                  >{{ entry.createdAt | date: 'd/M/yyyy HH:mm' }} · {{ entry.actor }} · Motivo: {{ entry.reason }}</span
                >
              </li>
            }
          </ol>
        } @else {
          <p class="empty-state">Aún no hay acciones de moderación.</p>
        }
      }
    }
    @if (message() && token()) {
      <p class="notice" [class.error]="failed()" [attr.role]="failed() ? 'alert' : 'status'" aria-live="polite">
        {{ message() }}
      </p>
    }
  </section>`,
})
export class IdentityComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly trade = viewChild(TradeComponent);
  // Estado de sesión compartido con el resto de páginas (SessionService).
  readonly token = this.session.token;
  readonly admin = this.session.admin;
  readonly company = this.session.company;
  readonly permissions = this.session.permissions;
  readonly restoring = this.session.restoring;
  readonly pendingQuote = this.session.pendingQuote;
  readonly message = this.session.message;
  readonly failed = this.session.failed;
  /** Vista pedida por la URL; se aplica cuando el panel de cotizaciones está listo. */
  private readonly target = signal<AccountTarget>(accountTarget(this.router.url));
  readonly packDescription = packDescription;
  readonly presentations = presentations;
  mode = 'login';
  /** El ojito: muestra la contraseña hasta que se vuelve a pulsar, se envía el formulario o se cambia de pestaña. */
  showPassword = signal(false);
  email = '';
  password = '';
  ruc = '';
  legalName = '';
  evidence = '';
  invitation = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  inviteEmail = '';
  inviteDays = 1;
  buy = true;
  publish = false;
  productFilter = '';
  ownProducts = signal<any[]>([]);
  supplierId = '';
  busy = signal(false);
  members = signal<any[]>([]);
  requests = signal<any[]>([]);
  link = signal('');
  companies = signal<any[]>([]);
  retired = signal<any[]>([]);
  moderationLog = signal<any[]>([]);
  /** Tarjeta (empresa o producto) donde el admin está escribiendo el motivo. */
  moderating = signal<{ id: string } | null>(null);
  moderationReason = '';
  companySearch = '';
  constructor() {
    if (this.invitation) this.mode = 'accept';
    const navigation = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) this.target.set(accountTarget(event.urlAfterRedirects));
    });
    inject(DestroyRef).onDestroy(() => navigation.unsubscribe());
    // Panel de administración: las solicitudes se cargan solas al entrar o al recargar la página,
    // y se revisan cada 30 s y al volver a la pestaña para mostrar las altas nuevas.
    effect(() => {
      if (this.restoring() || !this.token() || !this.admin()) return;
      untracked(() => void this.loadAdmin());
    });
    const refresh = () => void this.refreshRequests();
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    });
    // Selección traída desde el catálogo: explica qué falta antes de cotizar.
    effect(() => {
      const selection = this.pendingQuote();
      if (!selection || this.restoring()) return;
      untracked(() => this.explainSelection(selection.product));
    });
    // «Mis productos» también se carga al recuperar la sesión tras recargar la página.
    effect(() => {
      if (this.restoring() || !this.token() || !this.company()?.supplier_verified) return;
      if (!this.permissions().includes('publish')) return;
      untracked(() => {
        if (!this.ownProducts().length) void this.loadOwnProducts();
      });
    });
    // Abre en el panel la vista indicada por la URL.
    effect(() => {
      const target = this.target();
      const trade = this.trade();
      if (this.restoring()) return;
      untracked(() => {
        if (!this.token() && target.view !== 'account') {
          this.mode = 'login';
          this.failed.set(false);
          this.message.set(
            target.view === 'quotes'
              ? 'Ingresa con tu cuenta empresarial para ver tus cotizaciones privadas.'
              : 'Ingresa con tu cuenta empresarial para ver tus pedidos.',
          );
        }
        if (!trade || this.pendingQuote()) return;
        if (target.view === 'quotes') {
          if (target.id) {
            if (trade.selected()?.id !== target.id) void trade.open(target.id);
          } else trade.showQuotes();
        } else if (target.view === 'orders') {
          if (target.id) {
            if (trade.currentOrder()?.id !== target.id) void trade.openOrder(target.id);
          } else trade.showOrders();
        }
      });
    });
    effect(() => {
      const product = this.pendingQuote();
      const trade = this.trade();
      if (product && trade && this.permissions().includes('buy')) {
        untracked(() => {
          this.pendingQuote.set(null);
          void trade.beginFromCatalog(product.product, product.quantity, product.extra ?? []);
        });
      }
    });
  }
  private explainSelection(product: CatalogProduct) {
    if (!this.token()) {
      this.mode = 'login';
      this.failed.set(false);
      this.message.set(
        'Ingresa con tu cuenta compradora para cotizar ' + product.name + '. Conservaremos la selección.',
      );
      requestAnimationFrame(() =>
        document.querySelector('.quote-selection')?.scrollIntoView({ behavior: 'auto', block: 'nearest' }),
      );
    } else if (this.admin() || !this.permissions().includes('buy')) {
      this.pendingQuote.set(null);
      this.failed.set(false);
      this.message.set('Tu cuenta necesita permiso de compra para solicitar cotizaciones.');
    }
  }
  private async call(path: string, method = 'GET', body?: unknown): Promise<any> {
    this.busy.set(true);
    try {
      const response = await fetch('/api/v1/' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token() ? { Authorization: 'Bearer ' + this.token() } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || (response.status === 403 && path === 'auth/me')) this.clearSession();
        throw new Error(result.message ?? 'Operación rechazada');
      }
      this.failed.set(false);
      this.message.set('');
      return result;
    } catch (error) {
      this.failed.set(true);
      this.message.set(error instanceof Error ? error.message : 'No se pudo conectar.');
      return null;
    } finally {
      this.busy.set(false);
    }
  }
  setMode(mode: string) {
    this.mode = mode;
    this.showPassword.set(false);
  }
  async submit() {
    this.showPassword.set(false);
    this.session.nextAuthVersion();
    if (this.mode === 'login') {
      const result = await this.call('auth/login', 'POST', { email: this.email, password: this.password });
      if (result) {
        this.token.set(result.token);
        this.password = '';
        await this.loadSession();
      }
    } else if (this.mode === 'register') {
      const result = await this.call('auth/register', 'POST', {
        email: this.email,
        password: this.password,
        ruc: this.ruc,
        legalName: this.legalName,
        evidence: this.evidence,
      });
      if (result) {
        this.password = '';
        this.message.set('Solicitud enviada. Espera la aprobación de administración.');
      }
    } else {
      const result = await this.call('auth/invitations/accept', 'POST', {
        email: this.email,
        password: this.password,
        token: this.invitation,
      });
      if (result) {
        this.password = '';
        this.invitation = '';
        history.replaceState(null, '', location.pathname);
        this.mode = 'login';
        this.message.set('Invitación aceptada. Ya puedes ingresar.');
      }
    }
  }
  async loadSession() {
    this.admin.set(false);
    this.company.set(null);
    this.permissions.set([]);
    this.requests.set([]);
    this.members.set([]);
    this.link.set('');
    const session = await this.call('auth/session');
    if (!session) {
      this.clearSession();
      return;
    }
    this.admin.set(session.platformAdmin === true);
    // El panel de administración lo carga el efecto del constructor al detectar la sesión de admin.
    if (!this.admin()) await this.loadAccount();
  }
  async loadAccount() {
    const result = await this.call('auth/me');
    this.company.set(result?.company ?? null);
    this.permissions.set(result?.permissions ?? []);
    await this.loadOwnProducts();
  }
  pendingRequests(): number {
    return this.requests().filter(r => !r.approved_at).length;
  }
  async loadAdmin() {
    const result = await this.call('admin/enrollments');
    this.requests.set(result ?? []);
    if (!result) {
      this.admin.set(false);
      return;
    }
    await Promise.all([this.loadCompanies(), this.loadModeration()]);
  }
  async loadModeration() {
    const [retired, log] = await Promise.all([this.call('admin/products/retired'), this.call('admin/moderation')]);
    this.retired.set(retired ?? []);
    this.moderationLog.set(log ?? []);
  }
  async loadCompanies() {
    const query = this.companySearch.trim() ? '?q=' + encodeURIComponent(this.companySearch.trim()) : '';
    const result = await this.call('admin/companies' + query);
    if (result) this.companies.set(result);
  }
  startModeration(id: string) {
    this.moderationReason = '';
    this.moderating.set({ id });
  }
  actionLabel(action: string): string {
    return (
      {
        'retire-product': 'Producto retirado',
        'restore-product': 'Producto restaurado',
        'suspend-company': 'Empresa suspendida',
        'reactivate-company': 'Empresa reactivada',
        'reject-enrollment': 'Solicitud de alta rechazada',
      }[action] ?? action
    );
  }
  async moderateCompany(company: any) {
    const action = company.status === 'suspended' ? 'reactivate' : 'suspend';
    const result = await this.call('admin/companies/' + company.id + '/' + action, 'POST', {
      reason: this.moderationReason,
    });
    if (!result) return;
    this.moderating.set(null);
    await Promise.all([this.loadCompanies(), this.loadModeration()]);
    this.message.set(
      action === 'suspend' ? 'Empresa suspendida. Sus productos ya no se muestran.' : 'Empresa reactivada.',
    );
  }
  async restoreProduct(id: string) {
    const result = await this.call('admin/products/' + id + '/restore', 'POST', { reason: this.moderationReason });
    if (!result) return;
    this.moderating.set(null);
    await this.loadModeration();
    this.message.set('Producto restaurado. Vuelve a mostrarse si tiene stock.');
  }
  async approve(id: string) {
    if (await this.call('admin/enrollments/' + id + '/approve', 'POST')) await this.loadAdmin();
  }
  async reject(id: string) {
    const result = await this.call('admin/enrollments/' + id + '/reject', 'POST', { reason: this.moderationReason });
    if (!result) return;
    this.moderating.set(null);
    await this.loadAdmin();
    this.message.set('Solicitud rechazada. La empresa y su cuenta se borraron.');
  }
  /** Revisa en silencio si llegaron solicitudes nuevas (sin bloquear botones ni borrar mensajes). */
  private async refreshRequests() {
    if (!this.admin() || !this.token() || this.busy() || document.hidden) return;
    try {
      const response = await fetch('/api/v1/admin/enrollments', {
        headers: { Authorization: 'Bearer ' + this.token() },
      });
      if (response.ok) this.requests.set(await response.json());
    } catch {
      // Sin conexión: se vuelve a intentar en la próxima revisión.
    }
  }
  async invite() {
    const result = await this.call('company/invitations', 'POST', {
      email: this.inviteEmail,
      permissions: [...(this.buy ? ['buy'] : []), ...(this.publish ? ['publish'] : [])],
      dias: this.inviteDays,
    });
    if (result) this.link.set(location.origin + result.link);
  }
  async loadMembers() {
    const result = await this.call('company/members');
    if (result) this.members.set(result);
  }
  async revoke(id: string) {
    if (await this.call('company/members/' + id + '/revoke', 'POST')) await this.loadMembers();
  }
  async verify(id = this.supplierId) {
    if (await this.call('providers/' + id + '/verify', 'PATCH')) {
      await this.loadAdmin();
      this.message.set('Proveedor verificado. Revisado manualmente.');
    }
  }
  publishedCount(): number {
    return this.ownProducts().filter(p => p.published).length;
  }
  visibleProducts(): any[] {
    const term = this.productFilter.trim().toLowerCase();
    if (!term) return this.ownProducts();
    return this.ownProducts().filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(term));
  }
  async loadOwnProducts() {
    if (!this.permissions().includes('publish') || !this.company()?.supplier_verified) return;
    // Consulta silenciosa: no toca los avisos del panel ni el estado «ocupado».
    try {
      const response = await fetch('/api/v1/company/products', {
        headers: { Authorization: 'Bearer ' + this.token() },
        cache: 'no-store',
      });
      if (response.ok) this.ownProducts.set(await response.json());
    } catch {
      /* Se reintenta al publicar, ocultar o recargar. */
    }
  }
  async setPublished(product: any, published: boolean) {
    const result = await this.call('products/' + product.id + (published ? '/publish' : '/unpublish'), 'POST');
    if (!result) return;
    await this.loadOwnProducts();
    this.message.set(
      published ? product.name + ' ya aparece en el catálogo.' : product.name + ' quedó oculto del catálogo.',
    );
  }
  private clearSession(clearSelection = true) {
    this.session.clear(clearSelection);
    this.requests.set([]);
    this.ownProducts.set([]);
    this.members.set([]);
    this.link.set('');
    this.password = '';
  }
  async logout() {
    this.session.nextAuthVersion();
    const result = await this.call('auth/logout', 'POST');
    if (result?.loggedOut) {
      this.clearSession();
      this.message.set('Sesión cerrada.');
    }
  }
}
