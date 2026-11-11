import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog/catalog.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(CatalogModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
