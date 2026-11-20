/**
 * Adaptador para ejecutar con Jest las pruebas de integración escritas con la
 * API de `node:test` (`test(nombre, opciones?, fn)` y subpruebas `t.test`).
 *
 * Cada `test` de primer nivel se registra como prueba de Jest. Sus subpruebas
 * comparten la preparación del padre (esquema PostgreSQL aislado, API Nest), por
 * eso se ejecutan en orden dentro de la misma prueba; si una falla, el error de
 * Jest indica qué subprueba fue. Se configura en jest.config.cjs (moduleNameMapper).
 */
const SUBTEST_PASSED = [];

function parse(args) {
  const [name, second, third] = args;
  return typeof second === 'function' ? { name, options: {}, fn: second } : { name, options: second ?? {}, fn: third };
}

function context(parent) {
  return {
    name: parent,
    async test(...args) {
      const { name, options, fn } = parse(args);
      const full = parent + ' › ' + name;
      if (options.skip) return;
      try {
        await fn(context(full));
        SUBTEST_PASSED.push(full);
      } catch (error) {
        if (error instanceof Error) error.message = '[' + name + '] ' + error.message;
        throw error;
      }
    },
  };
}

function test(...args) {
  const { name, options, fn } = parse(args);
  const register = options.skip ? global.test.skip : global.test;
  register(name, () => fn(context(name)), options.timeout ?? 60000);
}
test.skip = (...args) => {
  const { name, fn } = parse(args);
  global.test.skip(name, fn);
};

module.exports = { test, describe: global.describe };
module.exports.default = module.exports;
