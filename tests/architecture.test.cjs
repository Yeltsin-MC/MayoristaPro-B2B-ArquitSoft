const assert = require('node:assert/strict');
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

// EQ-05 (mantenibilidad) y Clean Architecture: la capa de dominio no depende de
// frameworks, base de datos ni SDK externos, y la aplicación no conoce HTTP.
const SRC = join(__dirname, '../apps/api/src');
const FORBIDDEN_IN_DOMAIN = /from '(@nestjs\/[^']+|pg|redis|axios|express|exceljs|rxjs|node:http)'/;
const modules = readdirSync(SRC, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

function files(dir) {
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => join(dir, f)) : [];
}

test('el dominio no importa NestJS, PostgreSQL, Redis, HTTP ni SDK externos', () => {
  const domains = modules.flatMap(m => files(join(SRC, m, 'domain')));
  assert.ok(domains.length >= 3, 'se esperaban archivos de dominio');
  const offenders = domains.filter(f => FORBIDDEN_IN_DOMAIN.test(readFileSync(f, 'utf8')));
  assert.equal(offenders.length, 0, 'importaciones prohibidas en: ' + offenders.join(', '));
});

test('el dominio y la aplicación no importan la capa de infraestructura ni de presentación', () => {
  const inner = modules.flatMap(m => [...files(join(SRC, m, 'domain')), ...files(join(SRC, m, 'application'))]);
  const offenders = inner.filter(f => /from '\.\.\/(infrastructure|presentation)\//.test(readFileSync(f, 'utf8')));
  assert.equal(offenders.length, 0, 'importaciones prohibidas en: ' + offenders.join(', '));
});
