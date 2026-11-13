import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { CatalogModule } from './catalog/catalog.module';
import { ListProducts } from './catalog/application/list-products';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(CatalogModule);
  try {
    // Validate the same database query used by the public catalog before
    // advertising a running API. A stopped database must fail at startup.
    await app.get(ListProducts).execute(1, 1);
    app.setGlobalPrefix('api/v1');
    app.useStaticAssets(resolve(__dirname, '../../web/dist/catalog/browser'));
    app.enableShutdownHooks();
    await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '::');
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(error => {
  console.error('No se pudo iniciar la API. Comprueba PostgreSQL, DATABASE_URL y las migraciones.');
  console.error(error);
  process.exitCode = 1;
});
