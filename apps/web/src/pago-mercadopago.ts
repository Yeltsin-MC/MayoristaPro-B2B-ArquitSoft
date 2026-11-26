import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from './session.service';

/**
 * Regreso desde Mercado Pago (back_urls). Mercado Pago agrega ?payment_id=…&external_reference=…;
 * la API consulta ese pago a Mercado Pago y confirma el pedido. Funciona también en localhost,
 * donde Mercado Pago no puede enviar el webhook.
 */
@Component({
  selector: 'app-pago-mercadopago',
  imports: [RouterLink],
  template: `<section class="sim-checkout" aria-label="Resultado del pago con Mercado Pago">
    @switch (result()) {
      @case ('approved') {
        <div class="sim-result ok" role="status">
          <span aria-hidden="true">✅</span>
          <h3>¡Pago aprobado por Mercado Pago!</h3>
          <p>Tu pedido ya figura como pagado y el proveedor puede prepararlo.</p>
          <a class="button" [routerLink]="orderLink()">Ver mi pedido</a>
        </div>
      }
      @case ('pending') {
        <div class="sim-result" role="status">
          <span aria-hidden="true">⏳</span>
          <h3>Pago pendiente</h3>
          <p>Mercado Pago todavía está procesando el pago. El pedido se confirmará cuando se acredite.</p>
          <a class="button" [routerLink]="orderLink()">Ver mi pedido</a>
        </div>
      }
      @case ('rejected') {
        <div class="sim-result bad" role="status">
          <span aria-hidden="true">❌</span>
          <h3>Pago rechazado</h3>
          <p>No se cobró nada. Puedes volver al pedido e intentarlo otra vez antes de que venza.</p>
          <a class="button" [routerLink]="orderLink()">Volver al pedido</a>
        </div>
      }
      @case ('sin-pago') {
        <div class="sim-result" role="status">
          <span aria-hidden="true">↩️</span>
          <h3>No se completó el pago</h3>
          <p>Volviste de Mercado Pago sin pagar. Puedes intentarlo de nuevo desde tu pedido.</p>
          <a class="button" [routerLink]="orderLink()">Volver al pedido</a>
        </div>
      }
      @case ('error') {
        <p class="notice error" role="alert">{{ error() }}</p>
        <a class="button secondary" routerLink="/cuenta/pedidos">Ir a mis pedidos</a>
      }
      @default {
        <p role="status" class="notice">Confirmando tu pago con Mercado Pago…</p>
      }
    }
  </section>`,
})
export class PagoMercadoPagoComponent {
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly result = signal<'approved' | 'pending' | 'rejected' | 'sin-pago' | 'error' | null>(null);
  readonly error = signal('');
  readonly orderId = signal('');
  readonly orderLink = () => '/cuenta/pedidos' + (this.orderId() ? '/' + this.orderId() : '');

  constructor() {
    effect(() => {
      if (this.session.restoring()) return;
      untracked(() => {
        if (!this.session.token()) {
          this.session.message.set('Ingresa con tu cuenta para confirmar el pago.');
          void this.router.navigateByUrl('/cuenta');
          return;
        }
        void this.confirm();
      });
    });
  }

  async confirm() {
    const attemptId = this.query.get('external_reference') ?? '';
    // Mercado Pago envía «null» cuando el comprador vuelve sin pagar.
    const paymentId = this.query.get('payment_id') ?? this.query.get('collection_id') ?? '';
    try {
      const response = await fetch('/api/v1/payments/mercadopago/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.session.token() },
        body: JSON.stringify({ attemptId, paymentId }),
      });
      const r = await response.json();
      if (!response.ok) throw new Error(r.message ?? 'No se pudo confirmar el pago.');
      this.orderId.set(r.orderId ?? '');
      if (r.state === 'approved' || r.state === 'approved_late') this.result.set('approved');
      else if (r.state === 'pending') this.result.set('pending');
      else if (r.state === 'rejected' || r.state === 'cancelled') this.result.set('rejected');
      else this.result.set('sin-pago');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo confirmar el pago.');
      this.result.set('error');
    }
  }
}
