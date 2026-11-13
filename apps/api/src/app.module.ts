import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './identity/identity.module';
import { PaymentsModule } from './payments/payments.module';
import { TradeModule } from './trade/trade.module';

/** Módulo raíz: compone los módulos del monolito modular. */
@Module({
  imports: [DatabaseModule, IdentityModule, CatalogModule, TradeModule, PaymentsModule, AiModule],
})
export class AppModule {}
