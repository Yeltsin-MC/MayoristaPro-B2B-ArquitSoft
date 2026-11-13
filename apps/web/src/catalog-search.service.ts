import { Injectable, signal } from '@angular/core';

/** Texto de búsqueda compartido entre el buscador del encabezado y la página del catálogo. */
@Injectable({ providedIn: 'root' })
export class CatalogSearchService {
  readonly term = signal('');
  /** Aumenta con cada búsqueda enviada desde el encabezado. */
  readonly submitted = signal(0);

  /** Categoría pedida desde el menú del encabezado (el contador permite repetirla). */
  readonly categoryRequest = signal<{ name: string; n: number } | null>(null);

  requestCategory(name: string): void {
    this.categoryRequest.update(previous => ({ name, n: (previous?.n ?? 0) + 1 }));
  }

  submit(): void {
    this.submitted.update(value => value + 1);
  }
}
