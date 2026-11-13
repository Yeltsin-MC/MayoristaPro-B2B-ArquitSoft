import { Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { AiService } from '../application/ai.service';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('ai/health')
  async health() {
    return {
      status: (await this.aiService.healthCheck()) ? 'ok' : 'unavailable',
      service: 'ai-scoring',
    };
  }

  @Post('quotations/:id/score-offers')
  scoreOffers(@Param('id') quotationId: string, @Headers('authorization') authorization?: string) {
    return this.aiService.scoreQuotation(quotationId, authorization);
  }
}
