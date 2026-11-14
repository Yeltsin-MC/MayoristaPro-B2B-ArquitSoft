import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CatalogSearchService } from './catalog-search.service';
import { SessionService } from './session.service';
import { OrderListService } from './order-list.service';

/** Marco común: encabezado con búsqueda y navegación, contenido por ruta y pie. */
@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly search = inject(CatalogSearchService);
  readonly session = inject(SessionService);
  readonly orderList = inject(OrderListService);
  /** Categorías del catálogo publicado para el menú del encabezado. */
  readonly categories = signal<string[]>([]);

  constructor() {
    // Al cambiar de página (catálogo ↔ cuenta) se empieza arriba; dentro de la
    // cuenta, cada vista hace su propio desplazamiento hasta el contenido abierto.
    let page = this.page(this.router.url);
    const events = this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return;
      const next = this.page(event.urlAfterRedirects);
      if (next !== page && !event.urlAfterRedirects.includes('#')) window.scrollTo(0, 0);
      page = next;
    });
    inject(DestroyRef).onDestroy(() => events.unsubscribe());
    inject(HttpClient)
      .get<{ categories: string[] }>('/api/v1/products/options')
      .subscribe({ next: options => this.categories.set(options.categories.slice(0, 7)), error: () => {} });
  }

  private page(url: string): string {
    return url.split(/[/?#]/)[1] ?? '';
  }

  openCategory(category: string): void {
    this.search.requestCategory(category);
    void this.router.navigate(['/'], { fragment: 'catalogo' });
  }

  searchCatalog(): void {
    this.search.submit();
    void this.router.navigate(['/'], { fragment: 'catalogo' });
  }
}
