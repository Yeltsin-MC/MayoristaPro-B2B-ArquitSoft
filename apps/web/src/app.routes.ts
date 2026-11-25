import { Routes } from '@angular/router';
import { CatalogComponent } from './catalog';
import { IdentityComponent } from './identity';
import { OrderListComponent } from './order-list';
import { PagoPruebaComponent } from './pago-prueba';
import { OrdenCompraComponent } from './orden-compra';

/**
 * Las vistas de la cuenta son rutas hijas sin componente: IdentityComponent se
 * conserva al pasar entre cotizaciones y pedidos, y lee la ruta para abrir la
 * vista o el documento indicado.
 */
const accountViews: Routes = [
  { path: '', children: [] },
  { path: 'cotizaciones', children: [] },
  { path: 'cotizaciones/:id', children: [] },
  { path: 'pedidos', children: [] },
  { path: 'pedidos/:id', children: [] },
];

export const routes: Routes = [
  { path: '', component: CatalogComponent, title: 'Catálogo | MayoristaPro B2B' },
  { path: 'lista', component: OrderListComponent, title: 'Lista de pedido | MayoristaPro B2B' },
  { path: 'cuenta', component: IdentityComponent, title: 'Mi cuenta | MayoristaPro B2B', children: accountViews },
  // Enlace que genera la API para aceptar invitaciones (/accept-invitation#token=…).
  { path: 'accept-invitation', component: IdentityComponent, title: 'Aceptar invitación | MayoristaPro B2B' },
  // Pago simulado (sin credenciales de Mercado Pago) y orden de compra imprimible.
  { path: 'pago-de-prueba/:id', component: PagoPruebaComponent, title: 'Pago de prueba | MayoristaPro B2B' },
  { path: 'orden-de-compra/:id', component: OrdenCompraComponent, title: 'Orden de compra | MayoristaPro B2B' },
  // Retorno de Mercado Pago (back_urls /payments/success|failure|pending).
  { path: 'payments/:result', redirectTo: 'cuenta/pedidos' },
  { path: '**', redirectTo: '' },
];
