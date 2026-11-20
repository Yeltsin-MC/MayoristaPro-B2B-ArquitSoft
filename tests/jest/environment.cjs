const { TestEnvironment } = require('jest-environment-node');

/**
 * Entorno Node de Jest con `fetch` cuyo `response.json()` crea los objetos dentro
 * del contexto de la prueba. Sin esto, los arreglos que llegan por HTTP vienen de
 * otro "realm" y `assert.deepStrictEqual` los considera distintos aunque sean iguales.
 */
class MayoristaEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    const sandbox = this.global;
    const nativeFetch = globalThis.fetch;
    sandbox.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      response.json = async () => sandbox.JSON.parse(await response.text());
      return response;
    };
  }
}

module.exports = MayoristaEnvironment;
