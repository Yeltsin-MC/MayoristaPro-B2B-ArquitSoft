import { IdentityComponent } from './identity';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';

interface Product {
  id: string;
  name: string;
  category: string;
  available: boolean;
  supplier: string;
  unit: string;
  unitsPerPack: number;
  minimum: number;
  multiple: number;
  stock: number;
  price: string;
  currency: 'PEN';
  includesTax: boolean;
}

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, IdentityComponent],
  templateUrl: './catalog.html',
})
export class CatalogComponent {
  private readonly http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly page = signal(1);

  constructor() {
    this.load();
  }

  load(page = 1): void {
    this.status.set('loading');
    this.http.get<{ items: Product[] }>('/api/v1/products?page='+page).subscribe({
      next: response => {
        this.products.set(response.items);
        this.page.set(page);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
