import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TradeModule } from '../trade/trade.module';
import { AiService } from './application/ai.service';
import { AiController } from './presentation/ai.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
    TradeModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
