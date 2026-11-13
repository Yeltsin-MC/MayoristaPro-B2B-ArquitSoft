import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogProduct } from './catalog-product';
import { CatalogPhotoComponent } from './catalog-photo';
import { CatalogSearchService } from './catalog-search.service';
import { SessionService } from './session.service';
import { OrderListService } from './order-list.service';
import {
  minimumQuantity,
  packDescription,
  presentations,
  quantityError,
  quantityEquivalence,
  unitName,
} from './wholesale-quantity';

@Component({
  selector: 'app-catalog-page',
  imports: [CurrencyPipe, FormsModule, CatalogPhotoComponent],
  templateUrl: './catalog.html',
})
export class CatalogComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly searchService = inject(CatalogSearchService);
  readonly orderList = inject(OrderListService);
  readonly slides = [
    {
      eyebrow: 'COMPRAS MAYORISTAS, NEGOCIOS QUE CRECEN',
      title: 'Abastece tu negocio.',
      text: 'De la oficina a tu próxima venta. Encuentra productos por volumen y cotiza con sus proveedores.',
      cta: 'Explorar catálogo',
      href: '#catalogo',
      image: '/images/abastecimiento-demo.png',
    },
    {
      eyebrow: 'MÁS CANTIDAD, MEJOR PRECIO',
      title: 'Precios por volumen.',
      text: 'Los proveedores publican escalas: mientras más presentaciones pides, menos pagas por cada una.',
      cta: 'Ver productos',
      href: '#catalogo',
      image: '/images/familias-demo.png',
    },
    {
      eyebrow: 'UNA LISTA, VARIAS OFERTAS',
      title: 'Cotiza todo junto.',
      text: 'Arma tu lista de pedido y envía una sola solicitud por proveedor. Compara ofertas y paga en línea.',
      cta: 'Cómo comprar',
      href: '#como-comprar',
      image: '/images/abastecimiento-demo.png',
    },
  ];
  readonly slide_ = signal(0);
  readonly benefits = [
    { icon: '▦', title: 'Precios por volumen', text: 'Escalas publicadas por cada proveedor' },
    { icon: '✓', title: 'Proveedores verificados', text: 'Empresas revisadas con RUC' },
    { icon: '◈', title: 'Pago seguro', text: 'Mercado Pago, en soles con IGV' },
    { icon: '➜', title: 'Seguimiento de despacho', text: 'De la preparación a la entrega' },
  ];
  /** Texto del buscador del encabezado. */
  readonly searchTerm = this.searchService.term;
  private requestVersion = 0;
  readonly products = signal<CatalogProduct[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly page = signal(1);
  readonly options = signal<{ categories: string[]; suppliers: { id: string; name: string }[] }>({
    categories: [],
    suppliers: [],
  });
  readonly selectedProduct = signal<CatalogProduct | null>(null);
  readonly categories = computed(() =>
    [...this.options().categories].sort(
      (a, b) => this.categoryPriority(a) - this.categoryPriority(b) || a.localeCompare(b, 'es'),
    ),
  );
  readonly quantities = signal<Record<string, number | null>>({});
  readonly presentations = presentations;
  readonly packDescription = packDescription;
  readonly unitName = unitName;
  readonly minimumQuantity = minimumQuantity;
  readonly quantityError = quantityError;
  readonly quantityEquivalence = quantityEquivalence;
  category = '';
  supplier = '';
  available = false;
  sort = '';

  constructor() {
    this.loadOptions();
    // Carrusel: avanza solo si el usuario no pidió reducir el movimiento.
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const timer = setInterval(() => this.goSlide(this.slide_() + 1), 7000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
    let first = true;
    // Carga inicial y cada búsqueda enviada desde el encabezado.
    effect(() => {
      this.searchService.submitted();
      untracked(() => (first ? this.load() : this.searchCatalog()));
      first = false;
    });
    // Categoría elegida en el menú del encabezado.
    effect(() => {
      const request = this.searchService.categoryRequest();
      if (!request) return;
      untracked(() => {
        this.searchService.categoryRequest.set(null);
        this.selectCategory(request.name);
      });
    });
  }

  /** Guarda la selección y lleva a la cuenta, donde se completa la solicitud (o se ingresa). */
  requestQuote(product: CatalogProduct, quantity: number | null): void {
    if (quantity === null || quantityError(product, quantity)) return;
    this.session.message.set('');
    this.session.failed.set(false);
    this.session.pendingQuote.set({ product, quantity });
    void this.router.navigate(['/cuenta']);
  }

  goSlide(n: number): void {
    this.slide_.set((n + this.slides.length) % this.slides.length);
  }

  addToList(product: CatalogProduct): void {
    const quantity = this.quantityFor(product);
    if (quantityError(product, quantity)) return;
    this.orderList.add(product, quantity);
  }

  selectSupplier(id: string): void {
    this.category = '';
    this.searchTerm.set('');
    this.supplier = id;
    this.available = false;
    this.sort = '';
    this.searchCatalog();
  }

  initials(name: string): string {
    return name
      .replace(/\(.*?\)/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('');
  }

  imageKind(name: string): string {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (/panader|harina|levadura/.test(normalized)) return 'bakery';
    if (/constru|acabados/.test(normalized)) return 'construction';
    if (/redes|router|ethernet|cable|network/.test(normalized)) return 'network';
    if (/perifer|teclado|mouse|comput|tecnolog/.test(normalized)) return 'technology';
    if (/papel|impres|resma/.test(normalized)) return 'paper';
    if (/cuaderno|librer|oficina|papeler|boligrafo/.test(normalized)) return 'office';
    return 'supplies';
  }

  productImage(product: CatalogProduct): string {
    const category = this.imageKind(product.category);
    if (category === 'bakery' || category === 'construction') return category;
    const kind = this.imageKind(product.name);
    return kind === 'supplies' ? this.imageKind(product.category) : kind;
  }

  quantityFor(product: CatalogProduct): number | null {
    const quantity = this.quantities()[product.id];
    return quantity === undefined ? minimumQuantity(product) : quantity;
  }

  setQuantity(product: CatalogProduct, quantity: number | null): void {
    this.quantities.update(values => ({ ...values, [product.id]: quantity }));
  }

  private categoryPriority(category: string): number {
    const kind = this.imageKind(category);
    return ['office', 'paper', 'technology', 'network', 'bakery', 'construction', 'supplies'].indexOf(kind);
  }

  searchCatalog(): void {
    this.load();
    document.getElementById('catalogo')?.scrollIntoView({ block: 'start' });
  }

  selectCategory(category: string): void {
    this.category = category;
    this.searchTerm.set('');
    this.supplier = '';
    this.available = false;
    this.sort = '';
    this.searchCatalog();
  }

  showProduct(product: CatalogProduct, dialog: HTMLDialogElement): void {
    this.selectedProduct.set(product);
    if (!dialog.open) dialog.showModal();
  }

  quoteAlternative(): CatalogProduct | undefined {
    return this.products().find(product => product.quoteEnabled && product.available);
  }

  showAlternative(dialog: HTMLDialogElement): void {
    const alternative = this.quoteAlternative();
    if (!alternative) return;
    if (quantityError(alternative, this.quantityFor(alternative)))
      this.setQuantity(alternative, minimumQuantity(alternative));
    this.showProduct(alternative, dialog);
  }

  loadOptions(): void {
    this.http
      .get<{ categories: string[]; suppliers: { id: string; name: string }[] }>('/api/v1/products/options')
      .subscribe({
        next: options => this.options.set(options),
        error: () => this.options.set({ categories: [], suppliers: [] }),
      });
  }

  reload(): void {
    this.loadOptions();
    this.load();
  }

  reset(): void {
    this.searchTerm.set('');
    this.category = '';
    this.supplier = '';
    this.available = false;
    this.sort = '';
    this.load();
  }

  load(page = 1): void {
    const version = ++this.requestVersion;
    this.status.set('loading');
    let params = new HttpParams().set('page', page).set('limit', 12);
    const term = this.searchTerm().trim();
    if (term) params = params.set('q', term);
    if (this.category) params = params.set('category', this.category);
    if (this.supplier) params = params.set('supplier', this.supplier);
    if (this.available) params = params.set('available', 'true');
    if (this.sort) params = params.set('sort', this.sort);
    this.http.get<{ items: CatalogProduct[] }>('/api/v1/products', { params }).subscribe({
      next: response => {
        if (version !== this.requestVersion) return;
        this.products.set(response.items);
        this.page.set(page);
        this.status.set('ready');
      },
      error: () => {
        if (version === this.requestVersion) this.status.set('error');
      },
    });
  }
}
