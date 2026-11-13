import { IdentityComponent } from './identity';
import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogProduct } from './catalog-product';
import { CatalogPhotoComponent } from './catalog-photo';
import {
  minimumQuantity,
  packDescription,
  presentations,
  quantityError,
  quantityEquivalence,
  unitName,
} from './wholesale-quantity';

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, FormsModule, IdentityComponent, CatalogPhotoComponent],
  templateUrl: './catalog.html',
})
export class CatalogComponent {
  private readonly http = inject(HttpClient);
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
  search = '';
  category = '';
  supplier = '';
  available = false;
  sort = '';

  constructor() {
    this.load();
    this.loadOptions();
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
    this.search = '';
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
    this.search = '';
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
    if (this.search.trim()) params = params.set('q', this.search.trim());
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
