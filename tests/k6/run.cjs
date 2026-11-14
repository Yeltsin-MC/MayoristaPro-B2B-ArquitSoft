// Ejecuta k6 con las credenciales locales de la demo (.env.demo-catalog150) sin escribirlas en la consola.
// Uso: npm run test:carga -- humo|local|completo
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const perfil = process.argv[2] || 'humo';
const env = { ...process.env, PERFIL: perfil };
env.COMPRADOR_EMAIL ||= 'demo-comprador150@example.test';
const resumen = path.join('docs', 'evidencias', 'k6', 'resumen-' + perfil + '.json');
require('node:fs').mkdirSync(path.dirname(resumen), { recursive: true });
const result = spawnSync('k6', ['run', '--summary-export', resumen, path.join('tests', 'k6', 'catalogo.k6.js')], {
  stdio: 'inherit', env,
});
if (result.error) {
  console.error('No se encontró k6. Instálalo con: winget install k6 --source winget (Windows) o desde https://grafana.com/docs/k6/latest/set-up/install-k6/');
  process.exit(1);
}
process.exit(result.status ?? 1);
