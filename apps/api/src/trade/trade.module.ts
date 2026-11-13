import { Module } from '@nestjs/common';
import { IdentityService } from '../identity/identity.service';
import { Trade, TRADE_STORE, TradeStore } from './application/trade';
import { PostgresTrade } from './infrastructure/postgres-trade';
import { TradeController } from './presentation/trade.controller';
@Module({
  controllers: [TradeController],
  providers: [
    IdentityService,
    { provide: TRADE_STORE, useClass: PostgresTrade },
    { provide: Trade, inject: [TRADE_STORE], useFactory: (store: TradeStore) => new Trade(store) },
  ],
  exports: [Trade],
})
export class TradeModule {}
