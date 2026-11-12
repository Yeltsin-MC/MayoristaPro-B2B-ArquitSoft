import { IdentityComponent } from './identity';
import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogProduct } from './catalog-product';

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, FormsModule, IdentityComponent],
  templateUrl: './catalog.html',
})
export class CatalogComponent {
  private readonly http = inject(HttpClient);
  private requestVersion = 0;
  readonly products = signal<CatalogProduct[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly page = signal(1);
  readonly options = signal<{ categories: string[]; suppliers: { id: string; name: string }[] }>({ categories: [], suppliers: [] });
  search = '';
  category = '';
  supplier = '';
  available = false;
  sort = '';

  constructor() {
    this.load();
    this.loadOptions();
  }

  loadOptions(): void {
    this.http.get<{ categories: string[]; suppliers: { id: string; name: string }[] }>('/api/v1/products/options')
      .subscribe({ next: options => this.options.set(options), error: () => this.options.set({ categories: [], suppliers: [] }) });
  }

  reload(): void {
    this.loadOptions();
    this.load();
  }

  reset(): void {
    this.search = ''; this.category = ''; this.supplier = ''; this.available = false; this.sort = '';
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
      error: () => { if (version === this.requestVersion) this.status.set('error'); },
    });
  }
}
