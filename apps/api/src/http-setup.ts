import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

/**
 * Prefijo de la API, archivos de Angular y respaldo de SPA: cualquier GET que no
 * sea de la API ni un archivo (p. ej. /cuenta/pedidos/…) devuelve index.html para
 * que el router de Angular resuelva la ruta al recargar o abrir un enlace.
 */
export function configureHttp(app: NestExpressApplication, webRoot: string): void {
  app.setGlobalPrefix('api/v1');
  app.useStaticAssets(webRoot);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/') || /\.[a-z0-9]+$/i.test(request.path))
      return next();
    response.sendFile(join(webRoot, 'index.html'));
  });
}
