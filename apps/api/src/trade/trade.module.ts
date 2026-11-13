import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { Trade, TRADE_STORE, TradeStore } from './application/trade';
import { PostgresTrade } from './infrastructure/postgres-trade';
import { TradeController } from './presentation/trade.controller';
@Module({
  imports: [IdentityModule],
  controllers: [TradeController],
  providers: [
    { provide: TRADE_STORE, useClass: PostgresTrade },
    { provide: Trade, inject: [TRADE_STORE], useFactory: (store: TradeStore) => new Trade(store) },
  ],
  exports: [Trade],
})
export class TradeModule {}
