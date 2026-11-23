import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from './session.service';

interface Notice {
  id: string;
  kind: string;
  title: string;
  link: string;
  createdAt: string;
  read: boolean;
}

/** Campana de avisos del encabezado: nuevas solicitudes, ofertas, pedidos y despachos. */
@Component({
  selector: 'app-notifications',
  imports: [DatePipe],
  template: `<div class="notifications">
    <button
      type="button"
      class="account-link notifications-toggle"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'Avisos, ' + unread() + ' sin leer'"
      (click)="toggle()"
    >
      <span class="action-icon" aria-hidden="true"
        >🔔<span class="badge" [class.zero]="unread() === 0">{{ unread() }}</span></span
      ><span class="action-text"
        ><small>{{ unread() ? unread() + ' nuevos' : 'Al día' }}</small
        >Avisos</span
      >
    </button>
    @if (open()) {
      <section class="notifications-panel" aria-label="Avisos">
        <h2>Avisos</h2>
        @for (notice of items(); track notice.id) {
          <button type="button" class="notice-item" [class.unread]="!notice.read" (click)="go(notice)">
            <span>{{ notice.title }}</span>
            <small>{{ notice.createdAt | date: 'd/M HH:mm' }}</small>
          </button>
        } @empty {
          <p class="muted">Aún no tienes avisos. Aquí verás nuevas ofertas, pedidos y despachos.</p>
        }
      </section>
    }
  </div>`,
})
export class NotificationsComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly unread = signal(0);
  readonly items = signal<Notice[]>([]);
  readonly open = signal(false);
  /** Solo empresas habilitadas (con permisos); el admin y las altas pendientes no tienen avisos. */
  readonly canReceive = computed(
    () => !!this.session.token() && !this.session.admin() && this.session.permissions().length > 0,
  );

  constructor() {
    effect(() => {
      if (this.canReceive()) void this.load();
      else {
        this.unread.set(0);
        this.items.set([]);
      }
    });
    // Revisa cada 30 s mientras haya sesión (sin WebSockets: suficiente para la demo).
    const timer = setInterval(() => {
      if (this.canReceive() && document.visibilityState === 'visible') void this.load();
    }, 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  @HostListener('document:click', ['$event'])
  closeOutside(event: Event) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  close() {
    this.open.set(false);
  }

  async load() {
    try {
      const response = await fetch('/api/v1/notifications', {
        headers: { Authorization: 'Bearer ' + this.session.token() },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const result = await response.json();
      this.unread.set(result.unread ?? 0);
      this.items.set(result.items ?? []);
    } catch {
      /* Sin conexión: se reintenta en el siguiente ciclo. */
    }
  }

  async toggle() {
    const opening = !this.open();
    this.open.set(opening);
    if (!opening) return;
    await this.load();
    if (this.unread() > 0) {
      // Al abrir la lista se dan por leídos; el resaltado se mantiene hasta cerrarla.
      this.unread.set(0);
      void fetch('/api/v1/notifications/read', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + this.session.token() },
      }).catch(() => undefined);
    }
  }

  go(notice: Notice) {
    this.open.set(false);
    void this.router.navigateByUrl(notice.link);
  }
}
