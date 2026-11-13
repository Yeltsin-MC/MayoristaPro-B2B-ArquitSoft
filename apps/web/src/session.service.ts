import { Injectable, signal } from '@angular/core';
import { CatalogProduct } from './catalog-product';

export interface PendingQuote {
  product: CatalogProduct;
  quantity: number;
}

/**
 * Sesión empresarial compartida por todas las páginas. El token vive solo en
 * memoria; al recargar se recupera desde la cookie HttpOnly con /auth/restore.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly token = signal('');
  readonly admin = signal(false);
  readonly company = signal<any>(null);
  readonly permissions = signal<string[]>([]);
  readonly restoring = signal(true);
  /** Producto elegido en el catálogo que se cotiza al ingresar. */
  readonly pendingQuote = signal<PendingQuote | null>(null);
  /** Aviso para la página de cuenta (errores de sesión, selección pendiente…). */
  readonly message = signal('');
  readonly failed = signal(false);
  private authVersion = 0;

  constructor() {
    void this.restore();
  }

  /** Invalida respuestas de restauración en curso (p. ej. al ingresar o salir). */
  nextAuthVersion(): number {
    return ++this.authVersion;
  }

  clear(clearSelection = true): void {
    this.token.set('');
    this.company.set(null);
    this.admin.set(false);
    this.permissions.set([]);
    if (clearSelection) this.pendingQuote.set(null);
  }

  private async restore(): Promise<void> {
    const version = this.nextAuthVersion();
    try {
      const response = await fetch('/api/v1/auth/restore', { credentials: 'same-origin', cache: 'no-store' });
      if (version !== this.authVersion) return;
      if (!response.ok) {
        this.clear(false);
        if (response.status !== 401 && response.status !== 403)
          this.message.set('No pudimos comprobar tu sesión. Ingresa de nuevo.');
        return;
      }
      const session = await response.json();
      if (version !== this.authVersion) return;
      this.admin.set(session.platformAdmin === true);
      this.company.set(session.company ?? null);
      this.permissions.set(session.permissions ?? []);
      this.token.set(session.token);
    } catch {
      if (version === this.authVersion) {
        this.clear(false);
        this.message.set('No pudimos comprobar tu sesión. Ingresa de nuevo.');
      }
    } finally {
      if (version === this.authVersion) this.restoring.set(false);
    }
  }
}
