import { CatalogImports } from './application/catalog-imports';
import { ImportsController } from './presentation/imports.controller';
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { ListProducts, PRODUCT_READER, ProductReader } from './application/list-products';
import { PostgresProducts } from './infrastructure/postgres-products';
import { CachedProducts, catalogNamespace } from './infrastructure/cached-products';
import { RedisCatalogCache, cacheInteger } from './infrastructure/redis-catalog-cache';
import { ProductsController } from './presentation/products.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ProductsController, ImportsController],
  providers: [
    CatalogImports,
    {
      provide: PostgresProducts,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => new PostgresProducts(pool),
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
