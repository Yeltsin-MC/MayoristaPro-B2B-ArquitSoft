import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';

interface Product {
  id: string;
  name: string;
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
  imports: [CurrencyPipe],
  templateUrl: './catalog.html',
})
export class CatalogComponent {
  private readonly http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  constructor() {
    this.load();
  }

  load(): void {
    this.status.set('loading');
    this.http.get<{ items: Product[] }>('/api/v1/products').subscribe({
      next: response => {
        this.products.set(response.items);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
