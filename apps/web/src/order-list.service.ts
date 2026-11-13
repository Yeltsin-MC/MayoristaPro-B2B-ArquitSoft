import { computed, Injectable, signal } from '@angular/core';
import { CatalogProduct } from './catalog-product';
import { minimumQuantity, quantityError, tierTotal, tierUnitPrice } from './wholesale-quantity';

export interface OrderListLine {
  product: CatalogProduct;
  quantity: number | null;
}

const STORAGE_KEY = 'mayoristapro:lista-pedido';

/**
 * Lista de pedido (como el carrito de una tienda B2B): el comprador junta
 * productos de varios proveedores y pide una cotización por proveedor. Se guarda
 * solo en este navegador; si el almacenamiento no está disponible, vive en memoria.
 */
@Injectable({ providedIn: 'root' })
export class OrderListService {
  readonly lines = signal<OrderListLine[]>(this.read());
  readonly count = computed(() => this.lines().length);
  /** Líneas agrupadas por proveedor: cada grupo se cotiza en una sola solicitud. */
  readonly groups = computed(() => {
    const groups = new Map<string, { supplierId: string; supplier: string; lines: OrderListLine[] }>();
    for (const line of this.lines()) {
      const key = line.product.supplierId;
      if (!groups.has(key)) groups.set(key, { supplierId: key, supplier: line.product.supplier, lines: [] });
      groups.get(key)!.lines.push(line);
    }
    return [...groups.values()];
  });

  has(productId: string): boolean {
    return this.lines().some(line => line.product.id === productId);
  }

  add(product: CatalogProduct, quantity: number | null = minimumQuantity(product)): void {
    this.lines.update(lines =>
      lines.some(line => line.product.id === product.id)
        ? lines.map(line => (line.product.id === product.id ? { product, quantity } : line))
        : [...lines, { product, quantity }],
    );
    this.save();
  }

  setQuantity(productId: string, quantity: number | null): void {
    this.lines.update(lines => lines.map(line => (line.product.id === productId ? { ...line, quantity } : line)));
    this.save();
  }

  remove(productId: string): void {
    this.lines.update(lines => lines.filter(line => line.product.id !== productId));
    this.save();
  }

  removeSupplier(supplierId: string): void {
    this.lines.update(lines => lines.filter(line => line.product.supplierId !== supplierId));
    this.save();
  }

  issue(line: OrderListLine): string {
    return quantityError(line.product, line.quantity);
  }

  unitPrice(line: OrderListLine): string {
    return tierUnitPrice(line.product, line.quantity);
  }

  lineTotal(line: OrderListLine): string {
    return tierTotal(line.product, line.quantity);
  }

  /** Total referencial (sin envío) de un grupo; vacío si alguna cantidad es inválida. */
  groupTotal(lines: OrderListLine[]): string {
    let cents = 0;
    for (const line of lines) {
      const total = this.lineTotal(line);
      if (!total) return '';
      cents += Math.round(Number(total) * 100);
    }
    return Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0');
  }

  private read(): OrderListLine[] {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(stored) ? stored.filter(line => line?.product?.id && line.product.supplierId) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      // Sin productos no queda nada guardado en el navegador.
      if (this.lines().length) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines()));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Sin almacenamiento: la lista sigue en memoria mientras la página esté abierta. */
    }
  }
}
