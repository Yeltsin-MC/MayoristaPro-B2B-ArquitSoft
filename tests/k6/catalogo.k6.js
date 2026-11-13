// Prueba de carga k6 de MayoristaPro (criterio AC01/AC03, docs/01-analisis-de-sistema/09-plan-de-medicion-calidad.md).
// Uso: k6 run -e PERFIL=humo tests/k6/catalogo.k6.js   (perfiles: humo, local, completo)
// Variables: BASE_URL (por defecto http://localhost:3300), COMPRADOR_EMAIL y DEMO_PASSWORD para las lecturas autenticadas.
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3300').replace(/\/+$/, '') + '/api/v1';
const PERFIL = __ENV.PERFIL || 'humo';
const PAUSA = Number(__ENV.PAUSA || 2); // segundos entre operaciones, según el plan

const perfiles = {
  // Comprobación inicial: valida datos y credenciales antes de generar carga.
  humo: [{ duration: '1m', target: 5 }],
  // Perfil reducido para una laptop: sube a 200 usuarios virtuales en unos 6 minutos.
  local: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  // Perfil del plan de medición: mesetas de 500, 1000 y 2000 usuarios (23 minutos).
  completo: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '5m', target: 2000 },
    { duration: '2m', target: 0 },
  ],
};
if (!perfiles[PERFIL]) throw new Error('PERFIL desconocido: ' + PERFIL);

const umbralesPorEndpoint = {};
for (const endpoint of ['catalogo', 'opciones', 'cotizaciones', 'pedidos']) {
  umbralesPorEndpoint['http_req_duration{endpoint:' + endpoint + '}'] = ['p(95)<500'];
  umbralesPorEndpoint['http_req_failed{endpoint:' + endpoint + '}'] = ['rate<0.01'];
}

export const options = {
  scenarios: { mezcla: { executor: 'ramping-vus', startVUs: 0, stages: perfiles[PERFIL], gracefulRampDown: '30s' } },
  thresholds: { ...umbralesPorEndpoint, checks: ['rate>0.99'] },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const inesperadas = new Counter('respuestas_inesperadas');
const busquedas = ['papel', 'cuaderno', 'detergente', 'arroz', 'cable', 'guantes', 'vaso', 'silla', 'harina', 'cinta'];

function json(res) {
  try { return res.json(); } catch { return undefined; }
}

export function setup() {
  const opciones = json(http.get(BASE + '/products/options', { tags: { endpoint: 'preparacion' } }));
  if (!opciones || !Array.isArray(opciones.categories) || opciones.categories.length === 0) {
    fail('El catálogo está vacío o la API no responde en ' + BASE + '. Carga la demo con npm run demo:catalog:load.');
  }
  let token;
  if (__ENV.COMPRADOR_EMAIL && __ENV.DEMO_PASSWORD) {
    const login = http.post(BASE + '/auth/login', JSON.stringify({ email: __ENV.COMPRADOR_EMAIL, password: __ENV.DEMO_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'preparacion' } });
    token = (json(login) || {}).token;
    // Una credencial inválida invalida la preparación: no se descarta en silencio.
    if (!token) fail('No se pudo iniciar sesión como comprador (HTTP ' + login.status + ').');
  }
  return { categorias: opciones.categories, token };
}

function catalogo(data) {
  const r = Math.random();
  let query;
  if (r < 0.5) query = 'page=' + (1 + Math.floor(Math.random() * 5)) + '&limit=20';
  else if (r < 0.8) query = 'category=' + encodeURIComponent(data.categorias[Math.floor(Math.random() * data.categorias.length)]) + '&limit=12';
  else query = 'q=' + busquedas[Math.floor(Math.random() * busquedas.length)] + '&limit=20';
  const res = http.get(BASE + '/products?' + query, { tags: { endpoint: 'catalogo' } });
  const body = json(res);
  if (!check(res, { 'catálogo 200 con items': () => res.status === 200 && body && Array.isArray(body.items) })) inesperadas.add(1);
}

function opciones() {
  const res = http.get(BASE + '/products/options', { tags: { endpoint: 'opciones' } });
  const body = json(res);
  if (!check(res, { 'opciones 200 con proveedores': () => res.status === 200 && body && Array.isArray(body.suppliers) })) inesperadas.add(1);
}

function privado(data, ruta, endpoint) {
  const res = http.get(BASE + ruta, { headers: { Authorization: 'Bearer ' + data.token }, tags: { endpoint } });
  if (!check(res, { [endpoint + ' 200']: () => res.status === 200 && json(res) !== undefined })) inesperadas.add(1);
}

// Mezcla del plan sin la creación de pedidos, que se mide aparte (EQ-06):
// 55% catálogo, 20% proveedores/opciones, 15% cotizaciones, 10% pedidos.
export default function (data) {
  const r = Math.random();
  if (r < 0.55) catalogo(data);
  else if (r < 0.75) opciones();
  else if (!data.token) catalogo(data); // sin credenciales, solo lecturas públicas
  else if (r < 0.9) privado(data, '/quotations', 'cotizaciones');
  else privado(data, '/orders', 'pedidos');
  sleep(PAUSA);
}
