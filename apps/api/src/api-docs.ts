import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** Contrato OpenAPI escrito a mano en apps/api/openapi.yaml (fuente única). */
export const OPENAPI_FILE = resolve(__dirname, '../openapi.yaml');

export function loadOpenApi(file = OPENAPI_FILE): Record<string, unknown> {
  return parse(readFileSync(file, 'utf8'));
}

/**
 * Publica el contrato en /api-docs (Swagger UI) y /api-docs/openapi.json,
 * igual que el proyecto de referencia del curso.
 */
export function configureApiDocs(app: NestExpressApplication, file = OPENAPI_FILE): void {
  const document = loadOpenApi(file);
  app.use('/api-docs/openapi.json', (_request: unknown, response: { json(body: unknown): void }) =>
    response.json(document),
  );
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'MayoristaPro API' }));
}
