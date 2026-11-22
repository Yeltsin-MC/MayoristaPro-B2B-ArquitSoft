import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ViewportScroller } from '@angular/common';
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
  host: { '(window:scroll)': 'onScroll()' },
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly search = inject(CatalogSearchService);
  readonly session = inject(SessionService);
  readonly orderList = inject(OrderListService);
  /** Categorías del catálogo publicado para el menú del encabezado. */
  readonly categories = signal<string[]>([]);
  /** Al bajar, el encabezado fijo se compacta (oculta lema y categorías) para dejar espacio. */
  readonly scrolled = signal(false);
  /** En celular, el menú de categorías se abre con el botón «Categorías». */
  readonly menuOpen = signal(false);
  onScroll() {
    const y = window.scrollY;
    // Solo se compacta si la página es bastante más alta que la pantalla: en una
    // página corta, el cambio de alto del encabezado haría saltar el scroll y
    // alternaría entre compacto y normal sin parar.
    const room = document.documentElement.scrollHeight - window.innerHeight;
    // Al compactarse, el navegador sube el scroll lo mismo que encoge el
    // encabezado (~120 px en celular): por eso se compacta pasados 180 px y
    // solo se expande de nuevo cerca del inicio (menos de 24 px).
    if (!this.scrolled() && y > 180 && room > 400) this.scrolled.set(true);
    else if (this.scrolled() && y < 24) this.scrolled.set(false);
  }

  constructor() {
    // Al cambiar de página (catálogo ↔ cuenta) se empieza arriba; dentro de la
    // cuenta, cada vista hace su propio desplazamiento hasta el contenido abierto.
    let page = this.page(this.router.url);
    const events = this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return;
      const next = this.page(event.urlAfterRedirects);
      if (next !== page && !event.urlAfterRedirects.includes('#')) window.scrollTo(0, 0);
      page = next;
      const fragment = event.urlAfterRedirects.split('#')[1];
      if (fragment) this.alignAnchor(decodeURIComponent(fragment));
    });
    // Los saltos a #catalogo, #categorias… descuentan el encabezado fijo para que
    // la sección empiece justo debajo de él y no quede tapada.
    const scroller = inject(ViewportScroller);
    scroller.setOffset(() => [0, this.headerOffset()]);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => events.unsubscribe());
    // Publica la altura real del encabezado fijo (--header-height) para que los
    // filtros del catálogo se queden pegados justo debajo de él.
    afterNextRender(() => {
      const header = document.querySelector<HTMLElement>('.site-header');
      if (!header || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() =>
        document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px'),
      );
      observer.observe(header);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    inject(HttpClient)
      .get<{ categories: string[] }>('/api/v1/products/options')
      .subscribe({ next: options => this.categories.set(options.categories.slice(0, 7)), error: () => {} });
  }

  private headerOffset(): number {
    return (document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) + 8;
  }

  /** Al bajar, el encabezado se compacta y cambia de alto: se corrige el salto una vez estabilizado. */
  private alignAnchor(id: string): void {
    const align = () => {
      const target = document.getElementById(id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - this.headerOffset();
      if (Math.abs(target.getBoundingClientRect().top - this.headerOffset()) > 2) window.scrollTo(0, top);
    };
    setTimeout(align, 60);
    setTimeout(align, 320);
  }

  private page(url: string): string {
    return url.split(/[/?#]/)[1] ?? '';
  }

  openCategory(category: string): void {
    this.menuOpen.set(false);
    this.search.requestCategory(category);
    void this.router.navigate(['/'], { fragment: 'catalogo' });
  }

  searchCatalog(): void {
    this.search.submit();
    void this.router.navigate(['/'], { fragment: 'catalogo' });
  }
}
