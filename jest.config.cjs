/**
 * Jest: pruebas unitarias (tests/*.test.cjs) y de integración con PostgreSQL y
 * Redis reales (tests/*.integration.cjs). Las pruebas de navegador siguen con
 * Playwright (npm run test:browser).
 *
 * Las pruebas cargan el código compilado de apps/api/dist; tsc genera source maps
 * y la cobertura (proveedor v8) se informa sobre los archivos .ts originales.
 */
const shared = {
  testEnvironment: '<rootDir>/tests/jest/environment.cjs',
  transform: {},
  moduleNameMapper: { '^node:test$': '<rootDir>/tests/jest/node-test-adapter.cjs' },
};

module.exports = {
  coverageProvider: 'v8',
  collectCoverageFrom: ['apps/api/dist/**/*.js', '!apps/api/dist/workers/**', '!apps/api/dist/main.js'],
  coverageDirectory: 'coverage',
  // Umbral mínimo que CI exige al ejecutar npm run test:coverage.
  coverageThreshold: { global: { statements: 80, branches: 75, functions: 80, lines: 80 } },
  coverageReporters: ['text-summary', 'text', 'html', 'lcov', 'json-summary'],
  projects: [
    { ...shared, displayName: 'unitarias', testMatch: ['<rootDir>/tests/*.test.cjs'] },
    { ...shared, displayName: 'integracion', testMatch: ['<rootDir>/tests/*.integration.cjs'] },
  ],
};
