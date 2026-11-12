import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  UseFilters,
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { AiService } from '../application/ai.service';
import { Trade } from '../../trade/application/trade';
import { TradeRule } from '../../trade/domain/trade';
import { ScoreOffersRequest } from '../domain/scored-offer';

@Catch(TradeRule)
class AiExceptionFilter implements ExceptionFilter {
  catch(error: TradeRule, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(error.code === 'INVALID_INPUT' ? 422 : 409).json({
      code: error.code,
      message: error.message,
    });
  }
}

@Controller('api/v1')
@UseFilters(AiExceptionFilter)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly trade: Trade
  ) {}

  @Get('ai/health')
  async health() {
    const available = await this.aiService.healthCheck();
    return {
      status: available ? 'ok' : 'unavailable',
      service: 'ai-scoring',
    };
  }

  /**
   * Puntúa las ofertas de una cotización específica.
   * Requiere autorización y que el usuario sea el comprador de la cotización.
   */
  @Post('quotations/:id/score-offers')
  async scoreOffers(
    @Param('id') quotationId: string,
    @Headers('authorization') authorization?: string
  ) {
    if (!authorization) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Obtener detalle de la cotización y verificar autorización
    const quotation: any = await this.trade.detail(quotationId, authorization);
    
    if (!quotation || !quotation.offers || quotation.offers.length === 0) {
      return {
        quotation_id: quotationId,
        scored_offers: [],
        message: 'No offers to score',
      };
    }

    // Construir request para el servicio de IA con datos de reputación
    const offersWithReputation = await this.enrichOffersWithReputation(
      quotation.offers
    );

    const request: ScoreOffersRequest = {
      offers: offersWithReputation,
    };

    // Llamar al servicio de IA
    const scoredOffers = await this.aiService.scoreOffers(request);

    return {
      quotation_id: quotationId,
      scored_offers: scoredOffers,
      ai_service_available: scoredOffers[0]?.score !== null,
    };
  }

  /**
   * Enriquece las ofertas con datos de reputación desde PostgreSQL
   */
  private async enrichOffersWithReputation(offers: any[]) {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });

    try {
      const enrichedOffers = await Promise.all(
        offers.map(async (offer) => {
          // Consultar órdenes completadas del proveedor
          const result = await pool.query(
            `
            SELECT 
              COUNT(*) FILTER (WHERE state = 'paid') as completed_orders,
              COUNT(*) as total_orders
            FROM trade_orders
            WHERE supplier_id = $1
            `,
            [offer.supplier_id]
          );

          const stats = result.rows[0];

          return {
            offer_id: offer.id,
            supplier_id: offer.supplier_id,
            supplier_name: offer.supplier_name,
            total: parseFloat(offer.total),
            delivery_days: offer.delivery_days,
            completed_orders: parseInt(stats.completed_orders) || 0,
            total_orders: parseInt(stats.total_orders) || 0,
          };
        })
      );

      return enrichedOffers;
    } finally {
      await pool.end();
    }
  }
}
