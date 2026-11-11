import { IdentityController } from '../identity/identity.controller';
import { IdentityService } from '../identity/identity.service';
import { CatalogImports } from './application/catalog-imports';
import { ImportsController } from './presentation/imports.controller';
import { Module } from '@nestjs/common';
import { ListProducts, PRODUCT_READER, ProductReader } from './application/list-products';
import { PostgresProducts } from './infrastructure/postgres-products';
import { ProductsController } from './presentation/products.controller';

@Module({
  controllers: [ProductsController, IdentityController, ImportsController],
  providers: [
    IdentityService,
    CatalogImports,
    {
      provide: PRODUCT_READER,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) throw new Error('Configura DATABASE_URL antes de arrancar la API.');
        return new PostgresProducts(databaseUrl);
      },
    },
    {
      provide: ListProducts,
      inject: [PRODUCT_READER],
      useFactory: (reader: ProductReader) => new ListProducts(reader),
    },
  ],
})
export class CatalogModule {}
