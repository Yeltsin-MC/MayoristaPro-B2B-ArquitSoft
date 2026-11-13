// Reglas base para el backend NestJS y el frontend Angular.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.angular/**', 'tests/**', 'database/**', 'deployment/**', 'img/**', 'presentaciones/**', '**/*.cjs', '**/*.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.ts'],
    rules: {
      // El código existente valida entradas a mano; se migra a DTOs de forma gradual.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
