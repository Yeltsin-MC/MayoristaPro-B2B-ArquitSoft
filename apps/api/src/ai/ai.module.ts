import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TradeModule } from '../trade/trade.module';
import { AiService } from './application/ai.service';
import { AiController } from './presentation/ai.controller';
import { OFFER_REPUTATION } from './application/offer-reputation';
import { PostgresOfferReputation } from './infrastructure/postgres-offer-reputation';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
    TradeModule,
  ],
  controllers: [AiController],
  providers: [AiService, { provide: OFFER_REPUTATION, useClass: PostgresOfferReputation }],
  exports: [AiService],
})
export class AiModule {}
