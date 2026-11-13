import { Router } from '@angular/router';
import { Component, effect, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogProduct } from './catalog-product';
import { OrderListService } from './order-list.service';
import {
  minimumQuantity,
  packDescription,
  presentations,
  quantityError,
  quantityEquivalence,
  tierTotal,
  tierUnitPrice,
} from './wholesale-quantity';
interface RequestItem {
  descripcion: string;
  presentacion: string;
  unidadesPorPresentacion: number;
  cantidad: number | null;
}
@Component({
  selector: 'app-trade',
  imports: [FormsModule],
  template: ` <section id="cotizaciones" class="trade" aria-label="Cotizaciones y pedidos">
    <div class="workspace-heading">
      <div>
        <p class="eyebrow">COMPRAS CON MEJOR INFORMACIÓN</p>
        <h3>Cotizaciones y pedidos</h3>
        <p>
          Solicita ofertas privadas y compara sus condiciones antes de aceptar. El stock se reserva al crear el pedido.
        </p>
      </div>
      <div class="actions">
        <button class="secondary" type="button" (click)="showQuotes()">Mis cotizaciones</button
        ><button class="secondary" type="button" (click)="showOrders()">Mis pedidos</button
        ><button class="secondary" type="button" (click)="refresh()" [disabled]="busy()">
          Actualizar cotizaciones
        </button>
        @if (canBuy()) {
          <button class="secondary" type="button" (click)="newRequest()">Nueva solicitud</button>
        }
      </div>
    </div>
    @if (message()) {
      <p class="notice" role="status" aria-live="polite">{{ message() }}</p>
    }
    @if (sent()) {
      <div class="request-success" role="status">
        <h4>Solicitud enviada</h4>
        <p>Los proveedores seleccionados podrán responderte con sus ofertas.</p>
        <button class="secondary" type="button" (click)="showQuotes()">Ir a Mis cotizaciones</button>
      </div>
    }
    @if (canBuy() && creating()) {
      <form class="quotation-form" [class.compact-quotation]="!!sourceProduct(items[0])" (ngSubmit)="create()">
        <h4>{{ sourceProduct(items[0]) ? 'Solicitar cotización' : 'Nueva solicitud de cotización' }}</h4>
        @if (sourceProduct(items[0]); as product) {
          <div class="quotation-product">
            <p class="eyebrow">{{ items.length > 1 ? 'PRODUCTOS DE TU LISTA DE PEDIDO' : 'PRODUCTO SELECCIONADO' }}</p>
            @if (items.length === 1) {
              <h5>{{ product.name }}</h5>
            } @else {
              <h5>{{ items.length }} productos</h5>
            }
            <p>{{ product.supplier }} · {{ items.length === 1 ? packDescription(product) : 'una sola solicitud' }}</p>
          </div>
        }
        @if (!sourceProduct(items[0]) || addingSuppliers()) {
          <fieldset>
            <legend>Proveedores destinatarios</legend>
            @for (p of providers(); track p.id) {
              <label class="check"
                ><input
                  type="checkbox"
                  [name]="'supplier-' + p.id"
                  [checked]="supplierIds.includes(p.id)"
                  [disabled]="p.id === sourceProduct(items[0])?.supplierId"
                  (change)="toggle(p.id)"
                />{{ p.name }}</label
              >
            }
          </fieldset>
        }
        @for (i of items; track $index; let n = $index) {
          <fieldset class="request-item">
            <legend>
              {{
                sourceProduct(i)
                  ? items.length > 1
                    ? sourceProduct(i)!.name
                    : 'Cantidad a cotizar'
                  : 'Ítem ' + (n + 1)
              }}
            </legend>
            @if (!sourceProduct(i)) {
              <label
                >Descripción
                <input [name]="'description-' + n" required [(ngModel)]="i.descripcion" [readOnly]="!!sourceProduct(i)"
              /></label>
              <label
                >Presentación
                <select [name]="'unit-' + n" [(ngModel)]="i.presentacion" [disabled]="!!sourceProduct(i)">
                  <option>unidad</option>
                  <option>paquete</option>
                  <option>docena</option>
                  <option>caja</option>
                  <option>saco</option>
                </select></label
              >
              <label
                >Unidades por presentación
                <input
                  type="number"
                  min="1"
                  [name]="'pack-' + n"
                  required
                  [(ngModel)]="i.unidadesPorPresentacion"
                  [readOnly]="!!sourceProduct(i)"
              /></label>
            }
            <label
              >{{ sourceProduct(i) ? 'Cantidad' : 'Cantidad de presentaciones' }}
              <input
                type="number"
                aria-label="Cantidad de presentaciones"
                inputmode="numeric"
                [min]="requestMinimum(i)"
                [step]="requestMultiple(i)"
                [attr.max]="sourceProduct(i)?.stock ?? null"
                [name]="'quantity-' + n"
                required
                [(ngModel)]="i.cantidad"
                [attr.aria-invalid]="!!quantityIssue(i)"
                [attr.aria-describedby]="'request-quantity-' + n"
            /></label>
            <div class="quantity-info" [id]="'request-quantity-' + n" aria-live="polite">
              @if (sourceProduct(i); as product) {
                <p>
                  Mínimo {{ presentations(product.minimum, product.unit) }} · Múltiplo
                  {{ presentations(product.multiple, product.unit) }}
                </p>
                <p class="quantity-equivalence">{{ quantityEquivalence(product, i.cantidad) }}</p>
                @if (!quantityIssue(i)) {
                  <p class="price-reference">
                    Precio publicado para esta cantidad: S/ {{ tierUnitPrice(product, i.cantidad) }} por presentación ·
                    S/ {{ tierTotal(product, i.cantidad) }} sin envío. El proveedor confirma el precio en su oferta.
                  </p>
                }
              }
              @if (quantityIssue(i); as issue) {
                <p class="quantity-error">{{ issue }}</p>
              }
            </div>
            @if (items.length > 1) {
              <button type="button" (click)="items.splice(n, 1)">Quitar ítem {{ n + 1 }}</button>
            }
          </fieldset>
        }
        <button [disabled]="busy() || supplierIds.length === 0 || invalidQuantities()">Enviar solicitud</button>
        @if (sourceProduct(items[0])) {
          <button
            class="secondary"
            type="button"
            [attr.aria-expanded]="addingSuppliers()"
            (click)="addingSuppliers.set(!addingSuppliers())"
          >
            {{ addingSuppliers() ? 'Ocultar proveedores' : 'Añadir otro proveedor' }}
          </button>
          <p class="selected-suppliers">
            {{ supplierIds.length }}
            {{ supplierIds.length === 1 ? 'proveedor seleccionado' : 'proveedores seleccionados' }} · Una sola solicitud
            para comparar ofertas.
          </p>
        } @else {
          <button class="secondary" type="button" (click)="addItem()" [disabled]="items.length >= 50">
            Añadir ítem
          </button>
        }
      </form>
    }
    @if (!creating() && canSell() && products().length > 0) {
      <details class="tier-editor">
        <summary>Precios por volumen de mis productos</summary>
        <p>
          Define hasta 5 escalas: desde cierta cantidad de presentaciones, un precio menor por presentación. Se muestran
          en el catálogo público y como referencia al responder cotizaciones.
        </p>
        <label
          >Producto
          <select name="tier-product" [ngModel]="tierProductId" (ngModelChange)="selectTierProduct($event)">
            <option value="">Seleccionar</option>
            @for (p of products(); track p.id) {
              <option [value]="p.id">
                {{ p.sku }} · {{ p.name }} · S/ {{ p.price }} · mínimo {{ p.minimum }} · múltiplo {{ p.multiple }}
              </option>
            }
          </select></label
        >
        @if (ownProduct(tierProductId); as p) {
          @for (tier of tierDraft; track $index; let n = $index) {
            <div class="tier-row">
              <label
                >Desde (presentaciones)
                <input
                  type="number"
                  [name]="'tier-from-' + n"
                  [min]="p.minimum + 1"
                  [step]="p.multiple"
                  [(ngModel)]="tier.desde"
              /></label>
              <label
                >Precio por presentación PEN
                <input [name]="'tier-price-' + n" inputmode="decimal" [(ngModel)]="tier.precioUnitario"
              /></label>
              <button type="button" class="secondary" (click)="tierDraft.splice(n, 1)">Quitar</button>
            </div>
          }
          <button type="button" class="secondary" [disabled]="tierDraft.length >= 5" (click)="addTier()">
            Añadir escala
          </button>
          <button type="button" [disabled]="busy()" (click)="saveTiers(p.id)">Guardar precios por volumen</button>
        }
      </details>
    }
    @if (!creating()) {
      <h4 id="mis-cotizaciones" tabindex="-1">Mis cotizaciones</h4>
      <div class="request-list">
        @for (q of requests(); track q.id) {
          <div class="request-row" [attr.data-request-id]="q.id">
            <p>
              <strong>{{ q.primaryProduct || 'Solicitud de productos' }}</strong>
            </p>
            <p class="status-pill">{{ requestStatus(q) }}</p>
            <button class="secondary" type="button" (click)="open(q.id)">Ver cotización</button>
          </div>
        } @empty {
          <p>No tienes solicitudes todavía.</p>
        }
      </div>
      @if (selected(); as q) {
        <div class="selected-request" tabindex="-1">
          <h4>{{ q.items[0]?.description || 'Detalle de cotización' }}</h4>
          <p>Comprador {{ q.buyerName }} · {{ requestStatus(q) }}</p>
          @for (i of q.items; track i.id) {
            <p>{{ i.description }} · {{ i.unit }} de {{ i.unitsPerPack }} · cantidad {{ i.quantity }}</p>
          }
        </div>
        @if (!q.isBuyer && q.status === 'abierta' && q.offers.length === 0 && canSell()) {
          <form (ngSubmit)="respond()">
            <h4>Responder con productos propios</h4>
            @for (line of responseItems; track line.solicitudItemId; let n = $index) {
              <fieldset>
                <legend>{{ q.items[n].description }} ({{ line.cantidad }} presentaciones)</legend>
                <label
                  >Producto propio
                  <select
                    [name]="'product-' + n"
                    required
                    [(ngModel)]="line.productoId"
                    (ngModelChange)="suggestPrice(line)"
                  >
                    <option value="">Seleccionar</option>
                    @for (p of products(); track p.id) {
                      <option [value]="p.id">
                        {{ p.sku }} · {{ p.name }} · {{ p.unit }} de {{ p.unitsPerPack }} · mínimo {{ p.minimum }} ·
                        múltiplo {{ p.multiple }} · stock {{ p.stock }}
                      </option>
                    }
                  </select></label
                >
                <label
                  >Precio por presentación PEN (IGV incluido)
                  <input [name]="'price-' + n" required [(ngModel)]="line.precioUnitario"
                /></label>
                @if (ownProduct(line.productoId); as p) {
                  <p class="price-reference">
                    Precio publicado para {{ line.cantidad }}: S/ {{ tierUnitPrice(p, line.cantidad) }} por
                    presentación{{ p.priceTiers?.length ? ' (con precios por volumen)' : '' }}.
                  </p>
                }
              </fieldset>
            }
            <label>Envío final PEN <input name="shipping" required [(ngModel)]="shipping" /></label>
            <label
              >Plazo de entrega en días
              <input name="deliveryDays" type="number" min="1" required [(ngModel)]="deliveryDays"
            /></label>
            <label
              >Vigente hasta <input name="expiresAt" type="datetime-local" required [(ngModel)]="expiresAt"
            /></label>
            <p>Precios con IGV incluido; envío por importe final. No se calcula desglose fiscal.</p>
            <button [disabled]="busy()">Enviar oferta</button>
          </form>
        }
        <div class="comparison-heading">
          <h4>Ofertas privadas autorizadas</h4>
          <span class="section-caption">{{ q.offers.length }} ofertas · PEN · Precio por presentación</span>
        </div>
        @if (q.isBuyer && q.offers.length > 1) {
          <details class="comparison-details">
            <summary>Ver detalles de comparación e IA</summary>
            <div class="ai-controls">
              <button class="secondary" type="button" [disabled]="busy()" (click)="scoreOffers(q.id)">
                {{ scoredOffers().length > 0 ? 'Actualizar' : 'Calcular' }} puntuación IA
              </button>
              @if (scoredOffers().length > 0) {
                <label class="check"
                  ><input type="checkbox" [(ngModel)]="sortByScore" (change)="sortOffers()" />Ordenar por
                  puntuación</label
                >
              }
            </div>
            <p class="comparison-help">
              La puntuación compara precio, plazo y reputación. Tú eliges la oferta que se convierte en pedido.
            </p>
          </details>
        }
        <div class="offers-grid">
          @for (o of displayedOffers(); track o.id) {
            <article class="offer" [class.best-offer]="isTopScore(o)">
              @if (isTopScore(o)) {
                <span class="best-label">Mayor puntuación de esta comparación</span>
              }
              <p class="eyebrow">PROPUESTA DEL PROVEEDOR</p>
              <h4>Oferta de {{ o.supplierName }}</h4>
              <div class="offer-total">
                <span>Total con envío</span><strong>S/ {{ o.total }}</strong>
              </div>
              <p class="offer-delivery">
                Entrega en <strong>{{ o.deliveryDays }} {{ o.deliveryDays === 1 ? 'día' : 'días' }}</strong>
              </p>
              <details class="offer-details">
                <summary>Ver detalles</summary>
                @for (i of o.items; track i.requestItemId) {
                  <p class="offer-line">
                    <strong>{{ i.snapshot.name }}</strong><br />{{ i.quantity }} {{ i.snapshot.unit }} de
                    {{ i.snapshot.unitsPerPack }} · S/ {{ i.unitPrice }} por presentación<br />{{ i.quantity }} × S/
                    {{ i.unitPrice }} = S/
                    {{ i.subtotal }}
                  </p>
                }
                <dl class="offer-conditions">
                  <div>
                    <dt>Productos</dt>
                    <dd>S/ {{ o.subtotal }}</dd>
                  </div>
                  <div>
                    <dt>Envío final</dt>
                    <dd>S/ {{ o.shipping }}</dd>
                  </div>
                  <div>
                    <dt>Plazo de entrega</dt>
                    <dd>{{ o.deliveryDays }} días</dd>
                  </div>
                  <div>
                    <dt>Vigente hasta</dt>
                    <dd>{{ date(o.expiresAt) }}</dd>
                  </div>
                </dl>
                <p class="offer-tax">PEN · IGV incluido en precios; no se calcula desglose fiscal.</p>
                @if (o.score !== undefined) {
                  <div class="score-info">
                    <span>Puntuación IA</span
                    ><strong>{{ o.score !== null ? o.score.toFixed(1) + ' / 100' : 'Sin puntuación' }}</strong>
                  </div>
                  @if (o.breakdown && o.score !== null) {
                    <dl class="score-breakdown">
                      <div>
                        <dt>Precio · 50%</dt>
                        <dd>{{ o.breakdown.price_score.toFixed(1) }}</dd>
                      </div>
                      <div>
                        <dt>Entrega · 30%</dt>
                        <dd>{{ o.breakdown.delivery_score.toFixed(1) }}</dd>
                      </div>
                      <div>
                        <dt>Reputación · 20%</dt>
                        <dd>{{ o.breakdown.reputation_score.toFixed(1) }}</dd>
                      </div>
                    </dl>
                  }
                }
              </details>
              @if (q.isBuyer) {
                @if (!q.acceptedOfferId) {
                  <button class="offer-action" type="button" [disabled]="busy()" (click)="accept(o.id)">
                    Aceptar oferta
                  </button>
                }
                @if (q.acceptedOfferId === o.id) {
                  <p class="notice">Oferta aceptada. Aceptar no reserva stock.</p>
                  <button class="offer-action" type="button" [disabled]="busy()" (click)="order(o.id)">
                    Crear pedido y reservar stock
                  </button>
                }
              }
            </article>
          } @empty {
            <p class="state-panel">Los proveedores destinatarios todavía no han enviado ofertas.</p>
          }
        </div>
      }
      <h4 id="mis-pedidos" tabindex="-1">Mis pedidos</h4>
      @for (o of orders(); track o.id) {
        <p [attr.data-order-id]="o.id">
          Pedido · {{ stateLabel(o.state) }} · S/ {{ o.total }}
          <button type="button" (click)="openOrder(o.id)">Ver pedido</button>
        </p>
      }
      @if (currentOrder(); as o) {
        <article aria-label="Detalle del pedido">
          <h4>{{ o.state === 'pendiente' ? 'Pedido pendiente' : 'Pedido · ' + stateLabel(o.state) }}</h4>
          @for (i of o.items; track $index) {
            <p>
              {{ i.snapshot.name }} · {{ i.snapshot.unit }} de {{ i.snapshot.unitsPerPack }} · {{ i.quantity }} × S/
              {{ i.unitPrice }} = S/ {{ i.subtotal }}
            </p>
          }
          <p>
            Productos: S/ {{ o.subtotal }} · Envío final: S/ {{ o.shipping }} ·
            <strong>Total: S/ {{ o.total }} PEN</strong>
          </p>
          <p>IGV incluido en precios. Plazo: {{ o.deliveryDays }} días.</p>
          @for (r of o.reservations; track r.productId) {
            <p>Reserva {{ r.state }}: {{ r.quantity }} presentaciones.</p>
          }
          <p>Estado: {{ stateLabel(o.state) }}.</p>
          @if (inFulfillment(o.state)) {
            <ol class="fulfillment-steps" aria-label="Seguimiento del despacho">
              @for (step of fulfillmentSteps; track step.state) {
                <li [class.done]="stepDone(o, step.state)">
                  <strong>{{ step.label }}</strong>
                  @if (stepEvent(o, step.state); as e) {
                    <span>{{ formatDate(e.createdAt) }}{{ e.note ? ' · ' + e.note : '' }}</span>
                  }
                </li>
              }
            </ol>
          }
          @if (o.isSupplier && o.state === 'paid') {
            <button type="button" [disabled]="busy()" (click)="fulfill(o.id, 'preparing')">
              Marcar en preparación
            </button>
          }
          @if (o.isSupplier && o.state === 'preparing') {
            <label
              >Guía de remisión o transportista (opcional)
              <input name="dispatchNote" maxlength="300" [(ngModel)]="dispatchNote"
            /></label>
            <button type="button" [disabled]="busy()" (click)="fulfill(o.id, 'dispatched')">Marcar despachado</button>
          }
          @if (o.isBuyer && o.state === 'dispatched') {
            <button type="button" [disabled]="busy()" (click)="fulfill(o.id, 'delivered')">Confirmar recepción</button>
          }
          @if (o.state === 'pendiente') {
            <p>
              <strong>Pagar antes de: {{ expiresIn(o.expiresAt) }}</strong>
            </p>
            <button type="button" [disabled]="busy()" (click)="startPayment(o.id)">Pagar con Mercado Pago</button>
          }
          @if (o.state === 'paid') {
            <p class="success">✓ Pago confirmado. El proveedor preparará el pedido.</p>
          }
          @if (o.state === 'expired') {
            <p class="error">✗ Pedido vencido sin pago. Stock liberado.</p>
          }
          @if (o.state === 'requires_reconciliation') {
            <p class="warning">⚠ Requiere reconciliación manual (pago tardío).</p>
          }
          @if (paymentAttempts().length > 0) {
            <h5>Intentos de pago</h5>
            @for (a of paymentAttempts(); track a.id) {
              <p>
                {{ formatDate(a.created_at) }} · {{ a.state }} · S/ {{ a.amount }}
                @if (a.state === 'created' && a.preference_id) {
                  <button type="button" (click)="openCheckout(a)">Continuar pago</button>
                }
              </p>
            }
          }
        </article>
      }
    }
  </section>`,
})
export class TradeComponent {
  readonly token = input.required<string>();
  readonly canBuy = input(false);
  readonly canSell = input(false);
  readonly catalogChanged = output<void>();
  providers = signal<any[]>([]);
  products = signal<any[]>([]);
  requests = signal<any[]>([]);
  orders = signal<any[]>([]);
  selected = signal<any>(null);
  currentOrder = signal<any>(null);
  paymentAttempts = signal<any[]>([]);
  busy = signal(false);
  message = signal('');
  creating = signal(false);
  scoredOffers = signal<any[]>([]);
  sortByScore = false;
  addingSuppliers = signal(false);
  sent = signal(false);
  supplierIds: string[] = [];
  items: RequestItem[] = [{ descripcion: '', presentacion: 'caja', unidadesPorPresentacion: 12, cantidad: 2 }];
  /** Ítems que vienen del catálogo o de la lista de pedido, con su producto publicado. */
  private catalogItems = new Map<RequestItem, CatalogProduct>();
  readonly packDescription = packDescription;
  readonly presentations = presentations;
  readonly quantityEquivalence = quantityEquivalence;
  readonly tierUnitPrice = tierUnitPrice;
  readonly tierTotal = tierTotal;
  tierProductId = '';
  tierDraft: { desde: number | null; precioUnitario: string }[] = [];
  responseItems: any[] = [];
  dispatchNote = '';
  readonly fulfillmentSteps = [
    { state: 'paid', label: 'Pagado' },
    { state: 'preparing', label: 'En preparación' },
    { state: 'dispatched', label: 'Despachado' },
    { state: 'delivered', label: 'Entregado' },
  ];
  shipping = '0.00';
  deliveryDays = 3;
  expiresAt = this.future();
  private keys = new Map<string, string>();
  private readonly router = inject(Router);
  private readonly orderList = inject(OrderListService);
  constructor() {
    effect(() => {
      this.token();
      this.canBuy();
      this.canSell();
      void this.refresh();
    });
  }
  future() {
    return new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  date(value: string) {
    return new Date(value).toLocaleString('es-PE');
  }
  formatDate(value: string) {
    return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  }
  expiresIn(expiresAt: string) {
    const now = Date.now();
    const exp = new Date(expiresAt).getTime();
    const diff = exp - now;
    if (diff <= 0) return 'VENCIDO';
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    return `${min}min ${sec}s`;
  }
  private async call(path: string, method = 'GET', body?: unknown, key?: string): Promise<any> {
    this.busy.set(true);
    try {
      const r = await fetch('/api/v1/' + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + this.token(),
          'Content-Type': 'application/json',
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await r.json();
      if (!r.ok) throw new Error((result.code ? result.code + ': ' : '') + (result.message ?? 'Operación rechazada.'));
      if (method !== 'GET') this.message.set('Operación completada.');
      return result;
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Error de conexión.');
      return null;
    } finally {
      this.busy.set(false);
    }
  }
  async refresh() {
    if (this.canBuy()) {
      const p = await this.call('trade/providers');
      if (p) this.providers.set(p);
    }
    if (this.canSell()) {
      const p = await this.call('trade/products');
      if (p) this.products.set(p);
    }
    const r = await this.call('quotations');
    if (r) this.requests.set(r);
    const o = await this.call('orders');
    if (o) this.orders.set(o);
  }
  ownProduct(id: string): any {
    return this.products().find(p => p.id === id) ?? null;
  }
  /** Al elegir un producto propio, propone el precio publicado (con escalas) si aún no hay precio. */
  suggestPrice(line: any) {
    const product = this.ownProduct(line.productoId);
    if (product && !line.precioUnitario) line.precioUnitario = tierUnitPrice(product, line.cantidad);
  }
  selectTierProduct(id: string) {
    this.tierProductId = id;
    const product = this.ownProduct(id);
    this.tierDraft = (product?.priceTiers ?? []).map((t: any) => ({ ...t }));
    if (product && this.tierDraft.length === 0) this.addTier();
  }
  addTier() {
    this.tierDraft.push({ desde: null, precioUnitario: '' });
  }
  async saveTiers(productId: string) {
    const escalas = this.tierDraft
      .filter(t => t.desde !== null || t.precioUnitario.trim())
      .map(t => ({ desde: Number(t.desde), precioUnitario: t.precioUnitario.trim() }));
    const result = await this.call('trade/products/' + productId + '/price-tiers', 'PUT', { escalas });
    if (result) {
      this.products.update(list => list.map(p => (p.id === productId ? { ...p, priceTiers: result.priceTiers } : p)));
      this.tierDraft = result.priceTiers.map((t: any) => ({ ...t }));
      this.message.set('Precios por volumen guardados.');
      this.catalogChanged.emit();
    }
  }
  stateLabel(state: string): string {
    const labels: Record<string, string> = {
      pendiente: 'pendiente de pago',
      paid: 'pagado',
      preparing: 'en preparación',
      dispatched: 'despachado',
      delivered: 'entregado',
      expired: 'vencido',
      expired_pending_payment: 'vencido con pago pendiente',
      cancelled: 'cancelado',
      requires_reconciliation: 'requiere reconciliación',
    };
    return labels[state] ?? state;
  }
  inFulfillment(state: string): boolean {
    return ['paid', 'preparing', 'dispatched', 'delivered'].includes(state);
  }
  stepDone(order: any, state: string): boolean {
    const steps = this.fulfillmentSteps.map(s => s.state);
    return steps.indexOf(order.state) >= steps.indexOf(state);
  }
  stepEvent(order: any, state: string): any {
    return (order.events ?? []).find((e: any) => e.state === state) ?? null;
  }
  async fulfill(orderId: string, estado: string) {
    const body = estado === 'dispatched' && this.dispatchNote.trim() ? { estado, nota: this.dispatchNote } : { estado };
    const o = await this.call('orders/' + orderId + '/fulfillment', 'PATCH', body);
    if (o) {
      this.currentOrder.set(o);
      this.dispatchNote = '';
      const list = await this.call('orders');
      if (list) this.orders.set(list);
    }
  }
  sourceProduct(item: RequestItem): CatalogProduct | null {
    return this.catalogItems.get(item) ?? null;
  }
  requestMinimum(item: RequestItem): number {
    const product = this.sourceProduct(item);
    return product ? minimumQuantity(product) : 1;
  }
  requestMultiple(item: RequestItem): number {
    return this.sourceProduct(item)?.multiple ?? 1;
  }
  quantityIssue(item: RequestItem): string {
    const product = this.sourceProduct(item);
    if (product) return quantityError(product, item.cantidad);
    return item.cantidad !== null && Number.isSafeInteger(item.cantidad) && item.cantidad > 0
      ? ''
      : 'Ingresa una cantidad entera positiva de presentaciones.';
  }
  invalidQuantities(): boolean {
    return this.items.some(item => !!this.quantityIssue(item));
  }
  async beginFromCatalog(
    product: CatalogProduct,
    quantity: number = minimumQuantity(product),
    extra: { product: CatalogProduct; quantity: number }[] = [],
  ) {
    const selection = [{ product, quantity }, ...extra.filter(e => e.product.supplierId === product.supplierId)];
    const issue = selection.map(s => quantityError(s.product, s.quantity)).find(Boolean);
    if (issue) {
      this.message.set(issue);
      return;
    }
    if (!this.canBuy()) return;
    const providers = await this.call('trade/providers');
    if (!providers) return;
    this.providers.set(providers);
    if (!providers.some((provider: any) => provider.id === product.supplierId)) {
      this.message.set('Este proveedor no está disponible para una solicitud de tu empresa.');
      return;
    }
    this.newRequest();
    this.supplierIds = [product.supplierId];
    this.items = selection.map(({ product: p, quantity: q }) => {
      const item: RequestItem = {
        descripcion: p.name,
        presentacion: p.unit.toLowerCase(),
        unidadesPorPresentacion: p.unitsPerPack,
        cantidad: q,
      };
      this.catalogItems.set(item, p);
      return item;
    });
    this.message.set('');
    document.getElementById('cotizaciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  newRequest() {
    this.catalogItems = new Map();
    this.items = [{ descripcion: '', presentacion: 'caja', unidadesPorPresentacion: 12, cantidad: 2 }];
    this.supplierIds = [];
    this.addingSuppliers.set(false);
    this.sent.set(false);
    this.selected.set(null);
    this.currentOrder.set(null);
    this.creating.set(true);
    this.scoredOffers.set([]);
    this.sortByScore = false;
    this.message.set('');
  }
  requestStatus(q: any): string {
    if (q.status === 'aceptada') return 'Oferta aceptada';
    const count = q.offerCount ?? q.offers?.length ?? 0;
    return count === 0 ? 'Esperando ofertas' : count === 1 ? '1 oferta recibida' : count + ' ofertas recibidas';
  }
  /** Refleja en la URL la vista abierta, para poder compartirla, recargarla o volver atrás. */
  private go(url: string) {
    if (this.router.url.split('#')[0] !== url) void this.router.navigateByUrl(url);
  }
  showQuotes() {
    this.go('/cuenta/cotizaciones');
    this.creating.set(false);
    this.sent.set(false);
    requestAnimationFrame(() => {
      const list = document.getElementById('mis-cotizaciones');
      list?.scrollIntoView({ block: 'start' });
      list?.focus({ preventScroll: true });
    });
  }
  showOrders() {
    this.go('/cuenta/pedidos');
    this.creating.set(false);
    this.sent.set(false);
    requestAnimationFrame(() => {
      const list = document.getElementById('mis-pedidos');
      list?.scrollIntoView({ block: 'start' });
      list?.focus({ preventScroll: true });
    });
  }
  toggle(id: string) {
    this.supplierIds = this.supplierIds.includes(id)
      ? this.supplierIds.filter(x => x !== id)
      : [...this.supplierIds, id];
  }
  addItem() {
    this.items.push({ descripcion: '', presentacion: 'caja', unidadesPorPresentacion: 12, cantidad: 2 });
  }
  async create() {
    const issue = this.items.map(item => this.quantityIssue(item)).find(Boolean);
    if (issue) {
      this.message.set(issue);
      return;
    }
    const q = await this.call('quotations', 'POST', { proveedorIds: this.supplierIds, items: this.items });
    if (q) {
      // Lo que se cotizó desde la lista de pedido sale de la lista.
      for (const product of this.catalogItems.values()) this.orderList.remove(product.id);
      this.selected.set(q);
      this.creating.set(false);
      this.sent.set(true);
      this.message.set('');
      const r = await this.call('quotations');
      if (r) this.requests.set(r);
      requestAnimationFrame(() => document.querySelector('.request-success')?.scrollIntoView({ block: 'start' }));
    }
  }
  async open(id: string) {
    const q = await this.call('quotations/' + id);
    if (q) {
      this.sent.set(false);
      this.selected.set(q);
      this.go('/cuenta/cotizaciones/' + id);
      this.currentOrder.set(null);
      this.creating.set(false);
      this.expiresAt = this.future();
      this.scoredOffers.set([]);
      this.sortByScore = false;
      this.responseItems = q.items.map((i: any) => ({
        solicitudItemId: i.id,
        productoId: '',
        cantidad: i.quantity,
        precioUnitario: '',
      }));
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>('.selected-request');
        target?.scrollIntoView({ block: 'start' });
        target?.focus({ preventScroll: true });
      });
    }
  }
  isTopScore(offer: any): boolean {
    if (typeof offer.score !== 'number') return false;
    return offer.score === Math.max(...this.scoredOffers().map(item => item.score ?? -1));
  }
  async scoreOffers(quotationId: string) {
    const result = await this.call('quotations/' + quotationId + '/score-offers', 'POST');
    if (this.selected()?.id !== quotationId) return;
    if (result && result.scored_offers) {
      this.scoredOffers.set(result.scored_offers);
      if (!result.ai_service_available) {
        this.message.set('Servicio de IA no disponible. Ofertas mostradas sin puntuación.');
      } else {
        this.message.set('Puntuación IA calculada exitosamente.');
      }
    }
  }
  displayedOffers() {
    const q = this.selected();
    if (!q || !q.offers) return [];
    const scored = this.scoredOffers();
    if (scored.length === 0) return q.offers;
    const offersWithScores = q.offers.map((o: any) => {
      const s = scored.find((x: any) => x.offer_id === o.id);
      return s ? { ...o, score: s.score, breakdown: s.breakdown } : { ...o, score: undefined };
    });
    return this.sortByScore
      ? offersWithScores.sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1))
      : offersWithScores;
  }
  sortOffers() {
    /* triggers displayedOffers recompute */
  }
  async respond() {
    const q = this.selected();
    if (!q) return;
    const expiry = new Date(this.expiresAt);
    if (!this.expiresAt || !Number.isFinite(expiry.getTime())) {
      this.message.set('Vigencia inválida: indica fecha y hora.');
      return;
    }
    const result = await this.call('quotations/' + q.id + '/responses', 'POST', {
      moneda: 'PEN',
      precioIncluyeIgv: true,
      costoEnvio: this.shipping,
      diasEntrega: this.deliveryDays,
      vigenteHasta: expiry.toISOString(),
      items: this.responseItems,
    });
    if (result) this.selected.set(result);
  }
  async accept(id: string) {
    const q = this.selected();
    const r = await this.call('quotations/' + q.id + '/responses/' + id + '/accept', 'PATCH');
    if (r) {
      this.selected.set(r);
      const list = await this.call('quotations');
      if (list) this.requests.set(list);
    }
  }
  async order(id: string) {
    if (!this.keys.has(id)) this.keys.set(id, crypto.randomUUID());
    const o = await this.call('orders', 'POST', { cotizacionRespuestaId: id }, this.keys.get(id));
    if (o) {
      this.currentOrder.set(o);
      this.catalogChanged.emit();
      const list = await this.call('orders');
      if (list) this.orders.set(list);
    }
  }
  async openOrder(id: string) {
    const o = await this.call('orders/' + id);
    if (o) {
      this.currentOrder.set(o);
      this.go('/cuenta/pedidos/' + id);
      const attempts = await this.call('orders/' + id + '/payment-attempts');
      if (attempts) this.paymentAttempts.set(attempts);
    }
  }
  async startPayment(orderId: string) {
    const attempt = await this.call('orders/' + orderId + '/payment-attempts', 'POST', {});
    if (attempt && attempt.init_point) {
      this.message.set('Redirigiendo a Mercado Pago...');
      window.location.href = attempt.init_point;
    }
  }
  openCheckout(attempt: any) {
    if (attempt.mp_preference_response?.init_point) {
      window.location.href = attempt.mp_preference_response.init_point;
    }
  }
}
