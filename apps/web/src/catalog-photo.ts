import { Component, computed, input, signal } from '@angular/core';

const ILLUSTRATED = [
  'bakery',
  'construction',
  'cleaning',
  'groceries',
  'packaging',
  'hardware',
  'electric',
  'safety',
  'cafeteria',
  'textile',
  'firstaid',
  'furniture',
];

@Component({
  selector: 'app-catalog-photo',
  host: { role: 'img', '[attr.aria-label]': 'description()' },
  template: `<span class="photo-canvas">
    @if (illustration()) {
      <img class="category-illustration" [src]="illustration()" alt="" loading="lazy" />
    } @else {
      <img
        [src]="source()"
        alt=""
        [class]="'photo-sprite sprite-' + kind()"
        [hidden]="failedSource() === source()"
        (error)="failedSource.set(source())"
      />
      @if (failedSource() === source()) {
        <span class="photo-fallback"><span aria-hidden="true">m+</span><small>Imagen referencial</small></span>
      }
    }
  </span>`,
})
export class CatalogPhotoComponent {
  readonly kind = input('supplies');
  readonly description = input('Imagen referencial');
  readonly failedSource = signal('');
  /** Rubros sin foto propia: ilustración por categoría (íconos Lucide, licencia ISC). */
  readonly illustration = computed(() =>
    ILLUSTRATED.includes(this.kind()) ? '/images/categorias/' + this.kind() + '.svg' : '',
  );
  readonly source = computed(() =>
    this.kind() === 'supplies' ? '/images/abastecimiento-demo.png' : '/images/familias-demo.png',
  );
}
