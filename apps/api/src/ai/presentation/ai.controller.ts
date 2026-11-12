import {
  ArgumentsHost, Catch, Controller, ExceptionFilter, Get, Headers,
  Param, Post, UseFilters,
} from '@nestjs/common';
import { AiService } from '../application/ai.service';
import { TradeRule } from '../../trade/domain/trade';

@Catch(TradeRule)
class AiExceptionFilter implements ExceptionFilter {
  catch(error: TradeRule, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(error.code === 'INVALID_INPUT' ? 422 : 409).json({
      code: error.code,
      message: error.message,
    });
  }
}

@Controller()
@UseFilters(AiExceptionFilter)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('ai/health')
  async health() {
    return {
      status: await this.aiService.healthCheck() ? 'ok' : 'unavailable',
      service: 'ai-scoring',
    };
  }

  @Post('quotations/:id/score-offers')
  scoreOffers(@Param('id') quotationId: string, @Headers('authorization') authorization?: string) {
    return this.aiService.scoreQuotation(quotationId, authorization);
  }
}
