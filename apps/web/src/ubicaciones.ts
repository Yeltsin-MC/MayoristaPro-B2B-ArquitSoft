import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Ubicaciones para el caso de MayoristaPro: compradores de Ayacucho y proveedores de Lima o
 * Ayacucho. Las listas solo sugieren (datalist); se puede escribir otro lugar.
 */
export const DEPARTAMENTOS = ['Ayacucho', 'Lima', 'Callao', 'Junín', 'Ica', 'Huancavelica', 'Apurímac', 'Cusco'];
export const PROVINCIAS: Record<string, string[]> = {
  Ayacucho: [
    'Huamanga',
    'Huanta',
    'La Mar',
    'Cangallo',
    'Vilcas Huamán',
    'Víctor Fajardo',
    'Huanca Sancos',
    'Lucanas',
    'Parinacochas',
    'Páucar del Sara Sara',
    'Sucre',
  ],
  Lima: ['Lima', 'Cañete', 'Huaral', 'Huaura', 'Barranca', 'Huarochirí'],
  Callao: ['Callao'],
};
export const DISTRITOS: Record<string, string[]> = {
  Huamanga: [
    'Ayacucho',
    'Andrés Avelino Cáceres Dorregaray',
    'Carmen Alto',
    'Jesús Nazareno',
    'San Juan Bautista',
    'Acocro',
    'Acos Vinchos',
    'Chiara',
    'Ocros',
    'Pacaycasa',
    'Quinua',
    'San José de Ticllas',
    'Santiago de Pischa',
    'Socos',
    'Tambillo',
    'Vinchos',
  ],
  Huanta: ['Huanta', 'Luricocha', 'Sivia', 'Llochegua'],
  Lima: [
    'Cercado de Lima',
    'La Victoria',
    'Ate',
    'Santa Anita',
    'San Juan de Lurigancho',
    'San Martín de Porres',
    'Los Olivos',
    'Comas',
    'Independencia',
    'Breña',
    'Rímac',
    'El Agustino',
    'Lurín',
    'Villa El Salvador',
    'Chorrillos',
    'Surquillo',
  ],
};

/** Dirección con los nombres de campo que usa la API (cotización y «Mi empresa»). */
export interface Direccion {
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  referencia?: string;
  contacto?: string;
  telefono?: string;
}

/** Ubicación en una línea: «Jr. Lima 123, San Juan Bautista, Huamanga (Ayacucho)». */
export function lugar(d: any): string {
  if (!d) return '';
  const city = [d.distrito, d.provincia].filter(Boolean).join(', ');
  return [d.direccion, city].filter(Boolean).join(', ') + (d.departamento ? ' (' + d.departamento + ')' : '');
}

const normal = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** El envío es interprovincial si el almacén del proveedor está en otra provincia (p. ej. Lima → Huamanga). */
export function interprovincial(origin: any, delivery: any): boolean {
  if (!origin?.province || !delivery?.provincia || delivery.modalidad === 'recojo') return false;
  return normal(origin.province) !== normal(delivery.provincia);
}

/** Campos de dirección reutilizables; edita el objeto recibido. */
@Component({
  selector: 'app-direccion',
  imports: [FormsModule],
  template: `<div class="address-fields">
    <label class="address-wide"
      >Dirección{{ requireStreet() ? '' : ' (opcional)' }}
      <input
        [name]="prefix() + '-direccion'"
        [(ngModel)]="value().direccion"
        [required]="requireStreet()"
        maxlength="200"
        placeholder="Ej.: Jr. 28 de Julio 345"
        autocomplete="street-address"
    /></label>
    <label
      >Departamento
      <select [name]="prefix() + '-departamento'" [(ngModel)]="value().departamento" required>
        <option value="" disabled>Elegir</option>
        @for (d of departamentos; track d) {
          <option [value]="d">{{ d }}</option>
        }
      </select></label
    >
    <label
      >Provincia
      <input
        [name]="prefix() + '-provincia'"
        [(ngModel)]="value().provincia"
        required
        maxlength="60"
        [attr.list]="prefix() + '-provincias'"
        placeholder="Ej.: Huamanga" />
      <datalist [id]="prefix() + '-provincias'">
        @for (p of provinciasDe(value().departamento); track p) {
          <option [value]="p"></option>
        }</datalist
    ></label>
    <label
      >Distrito
      <input
        [name]="prefix() + '-distrito'"
        [(ngModel)]="value().distrito"
        required
        maxlength="60"
        [attr.list]="prefix() + '-distritos'"
        placeholder="Ej.: San Juan Bautista" />
      <datalist [id]="prefix() + '-distritos'">
        @for (d of distritosDe(value().provincia); track d) {
          <option [value]="d"></option>
        }</datalist
    ></label>
    @if (showContact()) {
      <label class="address-wide"
        >Referencia (opcional)
        <input
          [name]="prefix() + '-referencia'"
          [(ngModel)]="value().referencia"
          maxlength="200"
          placeholder="Ej.: frente al mercado Magdalena"
      /></label>
      <label
        >Contacto para la entrega (opcional)
        <input [name]="prefix() + '-contacto'" [(ngModel)]="value().contacto" maxlength="100"
      /></label>
      <label
        >Teléfono (opcional)
        <input
          [name]="prefix() + '-telefono'"
          [(ngModel)]="value().telefono"
          inputmode="tel"
          maxlength="15"
          pattern="\\+?[0-9 ]{6,15}"
          placeholder="Ej.: 966 123 456"
      /></label>
    }
  </div>`,
})
export class DireccionComponent {
  readonly value = input.required<Direccion>();
  readonly prefix = input('dir');
  readonly requireStreet = input(true);
  readonly showContact = input(true);
  readonly departamentos = DEPARTAMENTOS;
  provinciasDe(departamento?: string): string[] {
    return PROVINCIAS[departamento ?? ''] ?? [];
  }
  distritosDe(provincia?: string): string[] {
    return DISTRITOS[provincia ?? ''] ?? [];
  }
}
