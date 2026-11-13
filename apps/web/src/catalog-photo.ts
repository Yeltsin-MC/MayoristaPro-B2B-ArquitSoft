import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-catalog-photo',
  host: { role: 'img', '[attr.aria-label]': 'description()' },
  template: `<span class="photo-canvas">
    @if (icon()) {
      <span class="photo-category-icon" aria-hidden="true">{{ icon() }}</span>
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
  readonly icon = computed(() => (this.kind() === 'bakery' ? '♨' : this.kind() === 'construction' ? '▦' : ''));
  readonly source = computed(() =>
    this.kind() === 'supplies' ? '/images/abastecimiento-demo.png' : '/images/familias-demo.png',
  );
}
