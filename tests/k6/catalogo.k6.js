// Pruebas de rendimiento k6 de MayoristaPro (criterio AC01/AC03, docs/sprint-1/01-analisis-de-sistema/09-plan-de-medicion-calidad.md).
// Uso recomendado: npm run test:carga -- smoke|load|stress|spike|completo   (ver docs/sprint-2/pruebas-carga-k6.md)
// Uso directo:     k6 run -e PERFIL=smoke tests/k6/catalogo.k6.js
// Variables: BASE_URL (por defecto http://localhost:3300), COMPRADOR_EMAIL y DEMO_PASSWORD para las lecturas autenticadas.
// Ajustes opcionales: STRESS_MAX (2000), STRESS_PASO (100), NIVEL_SEG (60), PICO (1000), PAUSA (2 s).
import http from 'k6/http';
import exec from 'k6/execution';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3300').replace(/\/+$/, '') + '/api/v1';
const PERFIL = __ENV.PERFIL || 'smoke';
const PAUSA = Number(__ENV.PAUSA || 2); // segundos entre operaciones, según el plan
const NIVEL_SEG = Number(__ENV.NIVEL_SEG || 60);
const TRANSICION_SEG = 10;
const ENDPOINTS = ['catalogo', 'opciones', 'cotizaciones', 'pedidos'];
// Umbrales originales del plan de medición: se mantienen en todas las pruebas.
const P95 = 'p(95)<500';
const ERRORES = 'rate<0.01';

/** Umbrales por endpoint (latencia y errores). */
function umbralesPorEndpoint() {
  const umbrales = {};
  for (const endpoint of ENDPOINTS) {
    umbrales['http_req_duration{endpoint:' + endpoint + '}'] = [P95];
    umbrales['http_req_failed{endpoint:' + endpoint + '}'] = [ERRORES];
  }
  return umbrales;
}

/**
 * Niveles escalonados: cada nivel es un escenario de usuarios constantes con su propia etiqueta «nivel»,
 * así k6 mide y evalúa cada nivel por separado. Entre niveles hay una transición de 10 s.
 */
function niveles(lista) {
  const scenarios = {};
  const thresholds = {};
  let inicio = 0;
  for (const { vus, segundos } of lista) {
    const nivel = String(vus);
    scenarios['nivel_' + nivel] = {
      executor: 'constant-vus',
      vus,
      duration: segundos + 's',
      startTime: inicio + 's',
      gracefulStop: '5s',
      tags: { nivel },
    };
    thresholds['http_req_duration{nivel:' + nivel + '}'] = [P95];
    thresholds['http_req_failed{nivel:' + nivel + '}'] = [ERRORES];
    // Sin límite real: solo hace que el resumen exporte las peticiones del nivel (para calcular RPS).
    thresholds['http_reqs{nivel:' + nivel + '}'] = ['count>=0'];
    inicio += segundos + TRANSICION_SEG;
  }
  return { scenarios, thresholds };
}

function rampa(stages) {
  return {
    scenarios: { mezcla: { executor: 'ramping-vus', startVUs: 0, stages, gracefulRampDown: '30s' } },
    thresholds: umbralesPorEndpoint(),
  };
}

function perfil(nombre) {
  switch (nombre) {
    // Smoke: 1 usuario, 5 iteraciones; cada iteración recorre los 4 endpoints con sesión real.
    case 'smoke':
      return {
        scenarios: { smoke: { executor: 'per-vu-iterations', vus: 1, iterations: 5, maxDuration: '30s' } },
        thresholds: umbralesPorEndpoint(),
      };
    // Load: carga esperada, 10, 25 y 50 usuarios durante 1 minuto y 100 usuarios durante 10 minutos.
    case 'load': {
      const { scenarios, thresholds } = niveles([
        { vus: 10, segundos: 60 },
        { vus: 25, segundos: 60 },
        { vus: 50, segundos: 60 },
        { vus: 100, segundos: 600 },
      ]);
      return { scenarios, thresholds: { ...thresholds, ...umbralesPorEndpoint() } };
    }
    // Stress: de 100 en 100 hasta STRESS_MAX (2000 por defecto) para hallar el máximo nivel aprobado.
    case 'stress': {
      const paso = Number(__ENV.STRESS_PASO || 100);
      const maximo = Number(__ENV.STRESS_MAX || 2000);
      const lista = [];
      for (let vus = paso; vus <= maximo; vus += paso) lista.push({ vus, segundos: NIVEL_SEG });
      return niveles(lista);
    }
    // Spike: 10 usuarios, salto a PICO en 5 s, 30 s de pico, regreso a 10 en 5 s y 60 s de recuperación.
    case 'spike': {
      const pico = Number(__ENV.PICO || 1000);
      const thresholds = {};
      for (const fase of ['base', 'pico', 'recuperacion']) {
        thresholds['http_req_duration{fase:' + fase + '}'] = [P95];
        thresholds['http_req_failed{fase:' + fase + '}'] = [ERRORES];
        thresholds['http_reqs{fase:' + fase + '}'] = ['count>=0'];
      }
      return {
        scenarios: {
          // 10 usuarios todo el tiempo; su fase se marca según el momento (ver faseSpike).
          base: { executor: 'constant-vus', vus: 10, duration: '130s', gracefulStop: '5s' },
          pico: {
            executor: 'ramping-vus',
            startTime: '30s',
            startVUs: 0,
            stages: [
              { duration: '5s', target: pico - 10 },
              { duration: '30s', target: pico - 10 },
              { duration: '5s', target: 0 },
            ],
            gracefulRampDown: '5s',
            tags: { fase: 'pico' },
          },
        },
        thresholds,
      };
    }
    // Perfiles anteriores (se mantienen para comparar con las evidencias ya registradas).
    case 'humo':
      return rampa([{ duration: '1m', target: 5 }]);
    case 'local':
      return rampa([
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ]);
    case 'completo':
      return rampa([
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 2000 },
        { duration: '5m', target: 2000 },
        { duration: '2m', target: 0 },
      ]);
    default:
      throw new Error('PERFIL desconocido: ' + nombre + '. Usa smoke, load, stress, spike o completo.');
  }
}

const elegido = perfil(PERFIL);
export const options = {
  scenarios: elegido.scenarios,
  thresholds: { ...elegido.thresholds, checks: ['rate>0.99'] },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const inesperadas = new Counter('respuestas_inesperadas');
const busquedas = ['papel', 'cuaderno', 'detergente', 'arroz', 'cable', 'guantes', 'vaso', 'silla', 'harina', 'cinta'];

function json(res) {
  try {
    return res.json();
  } catch {
    return undefined;
  }
}

// La sesión del comprador se prepara una sola vez, antes de empezar a medir.
export function setup() {
  const opciones = json(http.get(BASE + '/products/options', { tags: { endpoint: 'preparacion' } }));
  if (!opciones || !Array.isArray(opciones.categories) || opciones.categories.length === 0) {
    fail('El catálogo está vacío o la API no responde en ' + BASE + '. Carga la demo con npm run demo:catalog:load.');
  }
  let token;
  if (__ENV.COMPRADOR_EMAIL && __ENV.DEMO_PASSWORD) {
    const login = http.post(
      BASE + '/auth/login',
      JSON.stringify({ email: __ENV.COMPRADOR_EMAIL, password: __ENV.DEMO_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'preparacion' } },
    );
    token = (json(login) || {}).token;
    // Una credencial inválida invalida la preparación: no se descarta en silencio.
    if (!token) fail('No se pudo iniciar sesión como comprador (HTTP ' + login.status + ').');
  }
  if (PERFIL === 'smoke' && !token) fail('El smoke test necesita DEMO_PASSWORD para validar la autenticación.');
  return { categorias: opciones.categories, token };
}

function catalogo(data) {
  const r = Math.random();
  let query;
  if (r < 0.5) query = 'page=' + (1 + Math.floor(Math.random() * 5)) + '&limit=20';
  else if (r < 0.8)
    query = 'category=' + encodeURIComponent(data.categorias[Math.floor(Math.random() * data.categorias.length)]) + '&limit=12';
  else query = 'q=' + busquedas[Math.floor(Math.random() * busquedas.length)] + '&limit=20';
  const res = http.get(BASE + '/products?' + query, { tags: { endpoint: 'catalogo' } });
  const body = json(res);
  if (!check(res, { 'catálogo 200 con items': () => res.status === 200 && body && Array.isArray(body.items) })) inesperadas.add(1);
}

function opciones() {
  const res = http.get(BASE + '/products/options', { tags: { endpoint: 'opciones' } });
  const body = json(res);
  if (!check(res, { 'opciones 200 con proveedores': () => res.status === 200 && body && Array.isArray(body.suppliers) }))
    inesperadas.add(1);
}

function privado(data, ruta, endpoint) {
  const res = http.get(BASE + ruta, { headers: { Authorization: 'Bearer ' + data.token }, tags: { endpoint } });
  if (!check(res, { [endpoint + ' 200']: () => res.status === 200 && json(res) !== undefined })) inesperadas.add(1);
}

/** En el spike, los 10 usuarios de base cambian de fase según el segundo de la prueba. */
function faseSpike() {
  if (exec.scenario.name !== 'base') return;
  const segundo = (Date.now() - exec.scenario.startTime) / 1000;
  exec.vu.metrics.tags.fase = segundo < 30 ? 'base' : segundo < 70 ? 'pico' : 'recuperacion';
}

// Mezcla del plan, solo lecturas (la creación de pedidos y la concurrencia de escrituras se miden aparte, EQ-06):
// 55% catálogo, 20% proveedores/opciones, 15% cotizaciones, 10% pedidos.
export default function (data) {
  if (PERFIL === 'smoke') {
    // Recorre los 4 endpoints en cada iteración para validar respuestas y sesión.
    catalogo(data);
    opciones();
    privado(data, '/quotations', 'cotizaciones');
    privado(data, '/orders', 'pedidos');
    sleep(1);
    return;
  }
  // Al entrar a un nivel, cada usuario espera un tiempo al azar para no disparar todos a la vez.
  if (exec.vu.iterationInScenario === 0) sleep(Math.random() * PAUSA);
  if (PERFIL === 'spike') faseSpike();
  const r = Math.random();
  if (r < 0.55) catalogo(data);
  else if (r < 0.75) opciones();
  else if (!data.token) catalogo(data); // sin credenciales, solo lecturas públicas
  else if (r < 0.9) privado(data, '/quotations', 'cotizaciones');
  else privado(data, '/orders', 'pedidos');
  sleep(PAUSA);
}
