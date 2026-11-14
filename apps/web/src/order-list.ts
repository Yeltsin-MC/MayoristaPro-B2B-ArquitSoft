import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OrderListLine, OrderListService } from './order-list.service';
import { SessionService } from './session.service';
import { minimumQuantity, packDescription, presentations, unitName } from './wholesale-quantity';

/** Página «Lista de pedido»: revisar cantidades y pedir una cotización por proveedor. */
@Component({
  selector: 'app-order-list',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  template: `<section class="order-list-page" aria-labelledby="order-list-title">
    <nav class="breadcrumb" aria-label="Ruta">
      <a routerLink="/">Inicio</a> <span aria-hidden="true">›</span> Lista de pedido
    </nav>
    <div class="section-heading">
      <div>
        <p class="eyebrow">COMPRA POR VOLUMEN</p>
        <h1 id="order-list-title">Lista de pedido</h1>
      </div>
      <a routerLink="/" fragment="catalogo">Seguir agregando productos <span aria-hidden="true">→</span></a>
    </div>
    @if (list.count() === 0) {
      <div class="state-panel">
        <h3>Tu lista de pedido está vacía</h3>
        <p>Agrega productos desde el catálogo. Luego pides una sola cotización a cada proveedor.</p>
        <a class="button" routerLink="/" fragment="catalogo">Ir al catálogo</a>
      </div>
    } @else {
      <p class="order-list-help">
        Los productos se agrupan por proveedor. Cada grupo se envía como
        <strong>una sola solicitud de cotización</strong>; el proveedor confirma precio final, envío y plazo en su
        oferta privada. Los importes son referenciales, con los precios por volumen publicados.
      </p>
      @for (group of list.groups(); track group.supplierId) {
        <article class="order-group" [attr.aria-label]="'Productos de ' + group.supplier">
          <header class="order-group-head">
            <div>
              <p class="eyebrow">PROVEEDOR</p>
              <h2>{{ group.supplier }}</h2>
            </div>
            <button type="button" class="text-button" (click)="list.removeSupplier(group.supplierId)">
              Quitar proveedor
            </button>
          </header>
          <div class="order-lines">
            @for (line of group.lines; track line.product.id) {
              <div class="order-line">
                <div class="order-line-product">
                  <strong>{{ line.product.name }}</strong>
                  <span
                    >{{ packDescription(line.product) }} · mínimo
                    {{ presentations(line.product.minimum, line.product.unit) }}</span
                  >
                </div>
                <label
                  >Cantidad de {{ unitName(line.product.unit, 2) }}
                  <input
                    type="number"
                    inputmode="numeric"
                    [attr.aria-label]="'Cantidad en la lista para ' + line.product.name"
                    [min]="minimumQuantity(line.product)"
                    [step]="line.product.multiple"
                    [max]="line.product.stock"
                    [ngModel]="line.quantity"
                    (ngModelChange)="list.setQuantity(line.product.id, $event)"
                /></label>
                <div class="order-line-price">
                  @if (list.issue(line); as issue) {
                    <p class="quantity-error">{{ issue }}</p>
                  } @else {
                    <span>{{ list.unitPrice(line) | currency: 'PEN' : 'S/ ' : '1.2-2' }} c/u</span>
                    <strong>{{ list.lineTotal(line) | currency: 'PEN' : 'S/ ' : '1.2-2' }}</strong>
                  }
                </div>
                <button type="button" class="secondary" (click)="list.remove(line.product.id)">Quitar</button>
              </div>
            }
          </div>
          <footer class="order-group-foot">
            <p>
              Referencial sin envío:
              <strong>{{
                list.groupTotal(group.lines) ? (list.groupTotal(group.lines) | currency: 'PEN' : 'S/ ' : '1.2-2') : '—'
              }}</strong>
              · IGV incluido
            </p>
            <button type="button" [disabled]="hasIssues(group.lines)" (click)="quote(group.lines)">
              Solicitar cotización a {{ group.supplier }} <span aria-hidden="true">↗</span>
            </button>
          </footer>
        </article>
      }
    }
  </section>`,
})
export class OrderListComponent {
  readonly list = inject(OrderListService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly packDescription = packDescription;
  readonly presentations = presentations;
  readonly unitName = unitName;
  readonly minimumQuantity = minimumQuantity;

  hasIssues(lines: OrderListLine[]): boolean {
    return lines.some(line => !!this.list.issue(line));
  }

  /** Lleva el grupo a la cuenta, donde se envía como una sola solicitud (o se ingresa primero). */
  quote(lines: OrderListLine[]): void {
    if (this.hasIssues(lines)) return;
    const [first, ...rest] = lines.map(line => ({ product: line.product, quantity: line.quantity! }));
    this.session.message.set('');
    this.session.failed.set(false);
    this.session.pendingQuote.set({ ...first, extra: rest });
    void this.router.navigate(['/cuenta']);
  }
}
