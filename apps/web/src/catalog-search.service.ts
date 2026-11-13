import { Injectable, signal } from '@angular/core';

/** Texto de búsqueda compartido entre el buscador del encabezado y la página del catálogo. */
@Injectable({ providedIn: 'root' })
export class CatalogSearchService {
  readonly term = signal('');
  /** Aumenta con cada búsqueda enviada desde el encabezado. */
  readonly submitted = signal(0);

  submit(): void {
    this.submitted.update(value => value + 1);
  }
}
