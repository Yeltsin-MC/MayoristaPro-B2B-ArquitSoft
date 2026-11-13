import { IdentityController } from '../identity/identity.controller';
import { IdentityService } from '../identity/identity.service';
import { CatalogImports } from './application/catalog-imports';
import { ImportsController } from './presentation/imports.controller';
import { Module } from '@nestjs/common';
import { TradeModule } from '../trade/trade.module';
import { PaymentsModule } from '../payments/payments.module';
import { AiModule } from '../ai/ai.module';
import { ListProducts, PRODUCT_READER, ProductReader } from './application/list-products';
import { PostgresProducts } from './infrastructure/postgres-products';
import { CachedProducts, catalogNamespace } from './infrastructure/cached-products';
import { RedisCatalogCache, cacheInteger } from './infrastructure/redis-catalog-cache';
import { ProductsController } from './presentation/products.controller';

@Module({
  imports: [TradeModule, PaymentsModule, AiModule],
  controllers: [ProductsController, IdentityController, ImportsController],
  providers: [
    IdentityService,
    CatalogImports,
    {
      provide: PostgresProducts,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) throw new Error('Configura DATABASE_URL antes de arrancar la API.');
        return new PostgresProducts(databaseUrl);
      },
    },
    { provide: RedisCatalogCache, useFactory: () => new RedisCatalogCache() },
    {
      provide: CachedProducts,
      inject: [PostgresProducts, RedisCatalogCache],
      useFactory: (reader: PostgresProducts, cache: RedisCatalogCache) =>
        new CachedProducts(
          reader,
          cache,
          catalogNamespace(process.env.DATABASE_URL!),
          cacheInteger('CATALOG_CACHE_TTL_SECONDS', 30, 1, 86400),
        ),
    },
    { provide: PRODUCT_READER, useExisting: CachedProducts },
    {
      provide: ListProducts,
      inject: [PRODUCT_READER],
      useFactory: (reader: ProductReader) => new ListProducts(reader),
    },
  ],
})
export class CatalogModule {}
