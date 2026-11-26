import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from './session.service';
import { lugar } from './ubicaciones';
import { textoError } from './errores';

const IGV = 0.18;

/** Céntimos enteros para que la suma y el IGV no arrastren errores de decimales. */
function cents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}
function soles(value: number): string {
  return (value / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Orden de compra de un pedido pagado, con el IGV desglosado. Se descarga en PDF con
 * «Guardar como PDF» del navegador: la hoja de impresión oculta la cabecera y el pie.
 */
@Component({
  selector: 'app-orden-compra',
  imports: [RouterLink],
  template: `<section class="purchase-order-page">
    <div class="po-actions no-print">
      <a class="button secondary" [routerLink]="'/cuenta/pedidos/' + orderId">← Volver al pedido</a>
      @if (order()) {
        <button type="button" (click)="print()"><span aria-hidden="true">📄</span> Descargar PDF</button>
      }
    </div>
    @if (order(); as o) {
      <article class="purchase-order" aria-labelledby="po-title">
        <header class="po-head">
          <div>
            <p class="po-brand">Mayorista<span>Pro</span></p>
            <p class="muted">Plataforma B2B para mayoristas</p>
          </div>
          <div class="po-number">
            <h2 id="po-title">ORDEN DE COMPRA</h2>
            <p>N.° OC-{{ o.id.slice(0, 8).toUpperCase() }}</p>
            <p>Fecha: {{ date(o.createdAt) }}</p>
          </div>
        </header>
        <div class="po-parties">
          <section>
            <h3>Comprador</h3>
            <p>
              <strong>{{ o.buyer.legalName }}</strong>
            </p>
            <p>RUC {{ o.buyer.ruc }}</p>
          </section>
          <section>
            <h3>Proveedor</h3>
            <p>
              <strong>{{ o.supplier.legalName }}</strong>
            </p>
            <p>RUC {{ o.supplier.ruc }}</p>
          </section>
          <section>
            <h3>Condiciones</h3>
            <p>Moneda: soles (PEN)</p>
            <p>Entrega: {{ o.deliveryDays }} {{ o.deliveryDays === 1 ? 'día' : 'días' }} desde el pago</p>
            <p>Estado: {{ stateLabel(o.state) }}</p>
          </section>
        </div>
        <section class="po-delivery">
          <h3>Lugar de entrega</h3>
          @if (o.delivery; as d) {
            @if (d.modalidad === 'recojo') {
              <p><strong>Recojo en almacén del proveedor</strong>{{ o.pickup ? ': ' + place(o.pickup) : '' }}</p>
            } @else {
              <p>
                <strong>{{
                  d.modalidad === 'agencia' ? 'Agencia ' + d.agencia : 'Envío al negocio del comprador'
                }}</strong>
              </p>
              <p>{{ lugar(d) }}</p>
              @if (d.referencia || d.contacto || d.telefono) {
                <p>
                  {{ contactLine(d) }}
                </p>
              }
            }
            @if (o.origin?.province) {
              <p class="muted">Despacha desde {{ o.origin.province }} ({{ o.origin.department }})</p>
            }
          } @else {
            <p>Por coordinar entre comprador y proveedor.</p>
          }
        </section>
        <table class="po-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Descripción</th>
              <th scope="col">Cant.</th>
              <th scope="col">P. unit.</th>
              <th scope="col">Importe</th>
            </tr>
          </thead>
          <tbody>
            @for (i of o.items; track i.productId; let n = $index) {
              <tr>
                <td>{{ n + 1 }}</td>
                <td>
                  {{ i.snapshot.name }}<br /><small
                    >{{ i.snapshot.unit }} de {{ i.snapshot.unitsPerPack }} · SKU {{ i.snapshot.sku }}</small
                  >
                </td>
                <td>{{ i.quantity }}</td>
                <td>{{ money(i.unitPrice) }}</td>
                <td>{{ money(i.subtotal) }}</td>
              </tr>
            }
          </tbody>
        </table>
        <dl class="po-totals">
          <div>
            <dt>Productos (IGV incluido)</dt>
            <dd>S/ {{ money(o.subtotal) }}</dd>
          </div>
          <div>
            <dt>Envío (IGV incluido)</dt>
            <dd>S/ {{ money(o.shipping) }}</dd>
          </div>
          <div>
            <dt>Op. gravada (sin IGV)</dt>
            <dd>S/ {{ taxes().base }}</dd>
          </div>
          <div>
            <dt>IGV (18 %)</dt>
            <dd>S/ {{ taxes().igv }}</dd>
          </div>
          <div class="po-grand-total">
            <dt>Importe total</dt>
            <dd>S/ {{ taxes().total }}</dd>
          </div>
        </dl>
        <p class="po-note">
          Precios en soles con IGV incluido. Documento generado por MayoristaPro con empresas ficticias para fines
          académicos; no es un comprobante de pago electrónico SUNAT.
        </p>
      </article>
    } @else if (error()) {
      <p class="notice error" role="alert">{{ error() }}</p>
    } @else {
      <p role="status" class="notice">Cargando la orden de compra…</p>
    }
  </section>`,
})
export class OrdenCompraComponent {
  readonly orderId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly order = signal<any>(null);
  readonly error = signal('');
  /** Base imponible e IGV del total (los precios del pedido ya incluyen IGV). */
  readonly taxes = computed(() => {
    const total = cents(this.order()?.total);
    const base = Math.round(total / (1 + IGV));
    return { total: soles(total), base: soles(base), igv: soles(total - base) };
  });

  constructor() {
    effect(() => {
      if (this.session.restoring()) return;
      untracked(() => {
        if (!this.session.token()) {
          this.session.message.set('Ingresa con tu cuenta para ver la orden de compra.');
          void this.router.navigateByUrl('/cuenta');
          return;
        }
        void this.load();
      });
    });
  }

  async load() {
    try {
      const response = await fetch('/api/v1/orders/' + encodeURIComponent(this.orderId), {
        headers: { Authorization: 'Bearer ' + this.session.token() },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'No encontramos el pedido.');
      this.order.set(result);
    } catch (error) {
      this.error.set(textoError(error, 'No se pudo cargar la orden de compra.'));
    }
  }

  readonly lugar = lugar;
  contactLine(d: any): string {
    return [d.referencia ? 'Ref.: ' + d.referencia : '', d.contacto, d.telefono].filter(Boolean).join(' · ');
  }
  place(p: any): string {
    return lugar({ direccion: p.address, distrito: p.district, provincia: p.province, departamento: p.department });
  }
  money(value: unknown): string {
    return soles(cents(value));
  }
  date(value: string): string {
    return new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  stateLabel(state: string): string {
    return (
      {
        pendiente: 'pendiente de pago',
        paid: 'pagado',
        preparing: 'en preparación',
        dispatched: 'despachado',
        delivered: 'entregado',
      }[state] ?? state
    );
  }
  print() {
    window.print();
  }
}
