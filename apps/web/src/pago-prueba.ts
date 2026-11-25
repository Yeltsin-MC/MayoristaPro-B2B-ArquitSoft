import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from './session.service';

type Medio = 'tarjeta' | 'yape' | 'pagoefectivo';

interface Checkout {
  attemptId: string;
  orderId: string;
  state: string;
  orderState: string;
  total: string;
  shipping: string;
  expiresAt: string;
  medio: Medio | null;
  cip: string | null;
}

/**
 * Pasarela simulada para la demo académica: imita los medios de pago usados en Perú
 * (tarjeta, Yape y PagoEfectivo con código CIP). La API solo la permite cuando Mercado
 * Pago no está configurado, y usa los mismos estados que el pago real.
 */
@Component({
  selector: 'app-pago-prueba',
  imports: [FormsModule, RouterLink],
  template: `<section class="sim-checkout" aria-labelledby="sim-title">
    <p class="sim-banner" role="note"><span aria-hidden="true">🧪</span> Modo demostración: no se cobra dinero real.</p>
    @if (checkout(); as c) {
      <div class="sim-head">
        <div>
          <p class="eyebrow">PAGO DEL PEDIDO</p>
          <h2 id="sim-title">Total a pagar</h2>
          <p class="muted">
            Pedido {{ c.orderId.slice(0, 8).toUpperCase() }} · IGV incluido · paga antes de {{ deadline(c.expiresAt) }}
          </p>
        </div>
        <strong class="sim-amount">S/ {{ c.total }}</strong>
      </div>
      @if (result() === 'approved') {
        <div class="sim-result ok" role="status">
          <span aria-hidden="true">✅</span>
          <h3>¡Pago aprobado!</h3>
          <p>Tu pedido ya figura como pagado y el proveedor puede prepararlo.</p>
          <a class="button" [routerLink]="'/cuenta/pedidos/' + c.orderId">Ver mi pedido</a>
        </div>
      } @else if (result() === 'rejected') {
        <div class="sim-result bad" role="status">
          <span aria-hidden="true">❌</span>
          <h3>Pago rechazado</h3>
          <p>No se cobró nada. Puedes volver al pedido e intentarlo otra vez.</p>
          <a class="button" [routerLink]="'/cuenta/pedidos/' + c.orderId">Volver al pedido</a>
        </div>
      } @else {
        <div class="sim-methods" role="radiogroup" aria-label="Medio de pago">
          @for (m of methods; track m.id) {
            <button
              type="button"
              role="radio"
              class="sim-method"
              [attr.aria-checked]="medio() === m.id"
              [disabled]="c.cip && m.id !== 'pagoefectivo'"
              (click)="medio.set(m.id)"
            >
              <span aria-hidden="true">{{ m.icon }}</span>
              <strong>{{ m.label }}</strong>
              <small>{{ m.hint }}</small>
            </button>
          }
        </div>
        @switch (medio()) {
          @case ('tarjeta') {
            <form class="sim-form" (ngSubmit)="pay('aprobar')">
              <label>Número de tarjeta<input name="card" [(ngModel)]="card" inputmode="numeric" /></label>
              <div class="sim-row">
                <label>Vencimiento<input name="exp" [(ngModel)]="cardExpiry" /></label>
                <label>CVV<input name="cvv" [(ngModel)]="cardCvv" inputmode="numeric" maxlength="4" /></label>
              </div>
              <label>Titular<input name="holder" [(ngModel)]="cardHolder" /></label>
              <p class="muted">Tarjeta de prueba: no se valida ni se guarda.</p>
              <button [disabled]="busy()">Pagar S/ {{ c.total }}</button>
            </form>
          }
          @case ('yape') {
            <form class="sim-form" (ngSubmit)="pay('aprobar')">
              <label
                >Celular Yape<input name="phone" [(ngModel)]="yapePhone" inputmode="numeric" maxlength="9"
              /></label>
              <label
                >Código de aprobación (6 dígitos)<input
                  name="otp"
                  [(ngModel)]="yapeCode"
                  inputmode="numeric"
                  maxlength="6"
              /></label>
              <p class="muted">En Yape real lo ves en la app, en «Código de aprobación».</p>
              <button [disabled]="busy()">Yapear S/ {{ c.total }}</button>
            </form>
          }
          @case ('pagoefectivo') {
            <div class="sim-form">
              @if (c.cip) {
                <p class="muted">Paga en agentes, bodegas o en tu banca por internet con este código:</p>
                <p class="sim-cip" aria-label="Código CIP">{{ c.cip }}</p>
                <p class="muted">Vence el {{ deadline(c.expiresAt) }} · Al pagar, el pedido se confirma solo.</p>
                <button type="button" [disabled]="busy()" (click)="pay('aprobar')">Simular pago en agente</button>
              } @else {
                <p class="muted">Genera un código CIP y págalo en efectivo o por banca móvil.</p>
                <button type="button" [disabled]="busy()" (click)="pay('generar-cip')">Generar código CIP</button>
              }
            </div>
          }
        }
        <button type="button" class="text-button sim-reject" [disabled]="busy()" (click)="pay('rechazar')">
          Simular pago rechazado
        </button>
      }
    } @else if (error()) {
      <p class="notice error" role="alert">{{ error() }}</p>
      <a class="button secondary" routerLink="/cuenta/pedidos">Ir a mis pedidos</a>
    } @else {
      <p role="status" class="notice">Cargando el pago…</p>
    }
  </section>`,
})
export class PagoPruebaComponent {
  /** Id del intento de pago (parámetro de la ruta /pago-de-prueba/:id). */
  private readonly attemptId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly id = () => this.attemptId;
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly checkout = signal<Checkout | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly result = signal<'approved' | 'rejected' | null>(null);
  readonly medio = signal<Medio>('tarjeta');
  readonly methods: { id: Medio; icon: string; label: string; hint: string }[] = [
    { id: 'tarjeta', icon: '💳', label: 'Tarjeta', hint: 'Crédito o débito' },
    { id: 'yape', icon: '📱', label: 'Yape', hint: 'Con código de aprobación' },
    { id: 'pagoefectivo', icon: '🏪', label: 'PagoEfectivo', hint: 'Código CIP en agentes' },
  ];
  card = '4009 1753 3280 6176';
  cardExpiry = '11/30';
  cardCvv = '123';
  cardHolder = 'APRO';
  yapePhone = '987654321';
  yapeCode = '123456';

  constructor() {
    effect(() => {
      const id = this.id();
      if (this.session.restoring()) return;
      untracked(() => {
        if (!this.session.token()) {
          this.session.message.set('Ingresa con tu cuenta para pagar el pedido.');
          void this.router.navigateByUrl('/cuenta');
          return;
        }
        void this.load(id);
      });
    });
  }

  deadline(value: string): string {
    return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  }

  private async request(method: string, body?: unknown): Promise<any> {
    const response = await fetch('/api/v1/payments/simulated/' + encodeURIComponent(this.id()), {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.session.token() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'No se pudo procesar el pago.');
    return result;
  }

  async load(id: string) {
    try {
      const c: Checkout = await this.request('GET');
      if (c.attemptId !== id) return;
      this.checkout.set(c);
      if (c.medio) this.medio.set(c.medio);
      if (c.state === 'approved' || c.state === 'approved_late') this.result.set('approved');
      if (c.state === 'rejected') this.result.set('rejected');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el pago.');
    }
  }

  async pay(accion: 'aprobar' | 'rechazar' | 'generar-cip') {
    const medio = this.medio();
    this.busy.set(true);
    try {
      const r = await this.request('POST', { accion, medio });
      this.checkout.update(c => (c ? { ...c, state: r.state, cip: r.cip ?? c.cip, medio } : c));
      if (r.state === 'approved' || r.state === 'approved_late') this.result.set('approved');
      if (r.state === 'rejected') this.result.set('rejected');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo procesar el pago.');
      this.checkout.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}
