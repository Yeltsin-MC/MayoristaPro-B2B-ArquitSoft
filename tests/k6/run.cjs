// Ejecuta k6 con las credenciales locales de la demo (.env.demo-catalog150) sin escribirlas en la consola.
// Uso: npm run test:carga -- smoke|load|stress|spike|completo   (también humo y local, perfiles anteriores)
// Guarda las evidencias en docs/sprint-2/evidencias/k6/<campaña>/: resumen JSON de k6, CPU/RAM y una tabla por nivel.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PRUEBAS = {
  smoke: {
    titulo: 'Smoke test',
    objetivo: 'Validar autenticación, los 4 endpoints y las respuestas antes de generar carga.',
    usuarios: '1',
    duracion: '5 iteraciones (máximo 30 s)',
  },
  load: {
    titulo: 'Load test',
    objetivo: 'Comprobar el comportamiento con la carga esperada.',
    usuarios: '10, 25 y 50 (1 min cada uno) y 100 (10 min)',
    duracion: 'unos 13,5 minutos',
  },
  stress: {
    titulo: 'Stress test',
    objetivo: 'Subir de 100 en 100 hasta hallar la degradación y el máximo nivel aprobado.',
    usuarios: () => `100 a ${process.env.STRESS_MAX || 2000}, de ${process.env.STRESS_PASO || 100} en ${process.env.STRESS_PASO || 100}`,
    duracion: () => {
      const niveles = Math.floor(Number(process.env.STRESS_MAX || 2000) / Number(process.env.STRESS_PASO || 100));
      return `${niveles} niveles de ${process.env.NIVEL_SEG || 60} s con 10 s de transición (unos ${Math.ceil((niveles * (Number(process.env.NIVEL_SEG || 60) + 10)) / 60)} minutos)`;
    },
  },
  spike: {
    titulo: 'Spike test',
    objetivo: 'Medir un salto repentino de usuarios y la recuperación posterior.',
    usuarios: () => `10 → ${process.env.PICO || 1000} en 5 s → 10`,
    duracion: 'unos 2 minutos y 10 segundos (30 s base, 40 s pico, 60 s recuperación)',
  },
  completo: {
    titulo: 'Prueba completa del plan',
    objetivo: 'Mesetas de 500, 1000 y 2000 usuarios (meta académica).',
    usuarios: '500, 1000 y 2000',
    duracion: '23 minutos',
  },
  humo: { titulo: 'Humo (perfil anterior)', objetivo: 'Comprobación rápida.', usuarios: '5', duracion: '1 minuto' },
  local: { titulo: 'Local (perfil anterior)', objetivo: 'Carga reducida para laptop.', usuarios: '50 y 200', duracion: '6,5 minutos' },
};
const valor = v => (typeof v === 'function' ? v() : v);

const perfil = process.argv[2] || 'smoke';
const prueba = PRUEBAS[perfil];
if (!prueba) {
  console.error('Prueba desconocida: ' + perfil + '. Usa: ' + Object.keys(PRUEBAS).join(', '));
  process.exit(1);
}

const env = { ...process.env, PERFIL: perfil };
env.COMPRADOR_EMAIL ||= 'demo-comprador150@example.test';
const campana = process.env.CAMPANA || new Date().toISOString().slice(0, 10);
const carpeta = path.join('docs', 'sprint-2', 'evidencias', 'k6', campana);
fs.mkdirSync(carpeta, { recursive: true });
const resumen = path.join(carpeta, perfil + '.json');

console.log('');
console.log('══════════════════════════════════════════════════════════════');
console.log(' ' + prueba.titulo.toUpperCase() + ' · MayoristaPro');
console.log('══════════════════════════════════════════════════════════════');
console.log(' Objetivo : ' + prueba.objetivo);
console.log(' Usuarios : ' + valor(prueba.usuarios));
console.log(' Duración : ' + valor(prueba.duracion));
console.log(' Umbrales : p95 < 500 ms y errores < 1 % (por endpoint o por nivel); checks > 99 %');
console.log(' Destino  : ' + (process.env.BASE_URL || 'http://localhost:3300'));
console.log(' Evidencia: ' + carpeta);
console.log(' Detener  : Ctrl + C una vez (k6 termina ordenado y muestra el resumen)');
console.log('══════════════════════════════════════════════════════════════');
console.log('');

// CPU y RAM de esta máquina cada 5 s (aquí corren k6 y, en local, también la API y PostgreSQL).
const recursos = path.join(carpeta, perfil + '-recursos.csv');
fs.writeFileSync(recursos, 'segundo,cpu_porcentaje,ram_usada_gb,ram_total_gb,ram_porcentaje\n');
const inicio = Date.now();
const tiempos = () => os.cpus().reduce((t, c) => ({ ocupado: t.ocupado + c.times.user + c.times.sys + c.times.irq + c.times.nice, total: t.total + Object.values(c.times).reduce((a, b) => a + b, 0) }), { ocupado: 0, total: 0 });
let previo = tiempos();
let maxCpu = 0;
let maxRam = 0;
let abortado = false;

const k6 = spawn('k6', ['run', '--summary-export', resumen, path.join('tests', 'k6', 'catalogo.k6.js')], { stdio: 'inherit', env });
k6.on('error', () => {
  console.error('No se encontró k6. Instálalo con: winget install k6 --source winget (Windows) o desde https://grafana.com/docs/k6/latest/set-up/install-k6/');
  process.exit(1);
});

const muestreo = setInterval(() => {
  const actual = tiempos();
  const cpu = (100 * (actual.ocupado - previo.ocupado)) / Math.max(1, actual.total - previo.total);
  previo = actual;
  const total = os.totalmem();
  const usada = total - os.freemem();
  const ram = (100 * usada) / total;
  maxCpu = Math.max(maxCpu, cpu);
  maxRam = Math.max(maxRam, ram);
  const gb = n => (n / 1024 ** 3).toFixed(2);
  fs.appendFileSync(recursos, `${Math.round((Date.now() - inicio) / 1000)},${cpu.toFixed(1)},${gb(usada)},${gb(total)},${ram.toFixed(1)}\n`);
  // Aborto solo por presión crítica: si la RAM pasa de 97 %, los resultados dejan de ser confiables.
  if (ram > 97 && !abortado) {
    abortado = true;
    console.error(`\n⚠ RAM al ${ram.toFixed(0)} %: se detiene k6 para no colgar la máquina. La prueba no cuenta como aprobada.`);
    k6.kill('SIGINT');
  }
}, 5000);

process.on('SIGINT', () => {}); // Ctrl + C llega también a k6, que cierra ordenado y deja su resumen.

k6.on('exit', code => {
  clearInterval(muestreo);
  console.log(`\nCPU máxima ${maxCpu.toFixed(0)} % · RAM máxima ${maxRam.toFixed(0)} % (detalle en ${recursos})`);
  try {
    const tabla = tablaPorNivel(JSON.parse(fs.readFileSync(resumen, 'utf8')));
    if (tabla) {
      fs.writeFileSync(path.join(carpeta, perfil + '-niveles.md'), tabla + '\n');
      console.log('\n' + tabla);
    }
  } catch {
    // Sin resumen (k6 cortado de golpe): no se inventan resultados.
  }
  process.exit(abortado ? 1 : (code ?? 1));
});

/** Tabla por nivel (stress, load) o por fase (spike) a partir del resumen de k6, sin estimar nada. */
function tablaPorNivel(datos) {
  const m = datos.metrics || {};
  const grupos = [];
  for (const clave of Object.keys(m)) {
    const g = /^http_req_duration\{(nivel|fase):(.+)\}$/.exec(clave);
    if (g) grupos.push({ tipo: g[1], nombre: g[2] });
  }
  if (!grupos.length) return '';
  const orden = { base: 0, pico: 1, recuperacion: 2 };
  grupos.sort((a, b) => (a.tipo === 'nivel' ? Number(a.nombre) - Number(b.nombre) : orden[a.nombre] - orden[b.nombre]));
  const ms = v => (v === undefined ? '-' : v >= 1000 ? (v / 1000).toFixed(2) + ' s' : v.toFixed(1) + ' ms');
  const filas = [];
  let maximoAprobado = null;
  let cortado = false;
  for (const { tipo, nombre } of grupos) {
    const d = m[`http_req_duration{${tipo}:${nombre}}`] || {};
    const f = m[`http_req_failed{${tipo}:${nombre}}`] || {};
    const r = m[`http_reqs{${tipo}:${nombre}}`] || {};
    const errores = typeof f.value === 'number' ? f.value : undefined;
    const ok = d['p(95)'] < 500 && errores !== undefined && errores < 0.01;
    const segundos =
      tipo === 'fase'
        ? { base: 30, pico: 40, recuperacion: 60 }[nombre]
        : perfil === 'load'
          ? { 10: 60, 25: 60, 50: 60, 100: 600 }[nombre]
          : Number(process.env.NIVEL_SEG || 60);
    if (tipo === 'nivel') {
      if (ok && !cortado) maximoAprobado = nombre;
      if (!ok) cortado = true;
    }
    filas.push(
      `| ${tipo === 'nivel' ? nombre + ' VU' : nombre} | ${r.count ?? '-'} | ${segundos && r.count ? (r.count / segundos).toFixed(1) : '-'} | ${ms(d.avg)} | ${ms(d.med)} | ${ms(d['p(95)'])} | ${ms(d['p(99)'])} | ${errores === undefined ? '-' : (errores * 100).toFixed(2) + ' %'} | ${ok ? '✓' : '✗'} |`,
    );
  }
  const encabezado = [
    `### ${PRUEBAS[perfil].titulo}, campaña ${campana}`,
    '',
    `| ${grupos[0].tipo === 'nivel' ? 'Nivel' : 'Fase'} | Peticiones | RPS | Promedio | p50 | p95 | p99 | Errores | Resultado |`,
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const pie = grupos[0].tipo === 'nivel' ? ['', `Máximo nivel aprobado (todos los anteriores también aprobados): ${maximoAprobado ? maximoAprobado + ' VU' : 'ninguno'}.`] : [];
  return [...encabezado, ...filas, ...pie].join('\n');
}
