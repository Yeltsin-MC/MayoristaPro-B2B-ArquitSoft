import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Trade } from '../../trade/application/trade';
import { ScoreOffersRequest, ScoreOffersResponse, ScoredOffer } from '../domain/scored-offer';
import { OFFER_REPUTATION, OfferReputation } from './offer-reputation';

interface QuotationForScoring {
  isBuyer: boolean;
  offers: Array<{
    id: string;
    supplierId: string;
    supplierName: string;
    total: string;
    deliveryDays: number;
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly serviceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:5000').replace(/\/+$/, '');

  constructor(
    private readonly httpService: HttpService,
    private readonly trade: Trade,
    @Inject(OFFER_REPUTATION) private readonly reputation: OfferReputation,
  ) {}

  async scoreQuotation(id: string, authorization?: string) {
    const quotation = await this.trade.detail(id, authorization) as QuotationForScoring;
    if (!quotation.isBuyer) {
      throw new ForbiddenException('Solo el comprador propietario puede puntuar esta solicitud.');
    }
    if (quotation.offers.length === 0) {
      return { quotation_id: id, scored_offers: [], ai_service_available: false };
    }

    const stats = await this.reputation.forSuppliers(quotation.offers.map(offer => offer.supplierId));
    const request: ScoreOffersRequest = {
      offers: quotation.offers.map(offer => {
        const supplier = stats.find(stat => stat.supplierId === offer.supplierId);
        return {
          offer_id: offer.id,
          supplier_id: offer.supplierId,
          supplier_name: offer.supplierName,
          total: Number(offer.total),
          delivery_days: offer.deliveryDays,
          supplier_completed_orders: supplier?.completedOrders ?? 0,
          supplier_total_orders: supplier?.totalOrders ?? 0,
        };
      }),
    };
    const scoredOffers = await this.scoreOffers(request);
    return {
      quotation_id: id,
      scored_offers: scoredOffers,
      ai_service_available: scoredOffers.length > 0 && scoredOffers.every(offer => offer.score !== null),
    };
  }

  async scoreOffers(request: ScoreOffersRequest): Promise<ScoredOffer[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<ScoreOffersResponse>(`${this.serviceUrl}/api/v1/score-offers`, request),
      );
      const scored = response.data?.scored_offers;
      if (!Array.isArray(scored) || scored.length !== request.offers.length ||
          new Set(scored.map(offer => offer.offer_id)).size !== scored.length) {
        throw new Error('Respuesta de IA incompleta o duplicada.');
      }
      return scored.map(score => {
        const offer = request.offers.find(item => item.offer_id === score.offer_id);
        const breakdown = score.breakdown;
        const values = [score.score, breakdown?.price_score, breakdown?.delivery_score, breakdown?.reputation_score];
        if (!offer || score.supplier_id !== offer.supplier_id ||
            !values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)) {
          throw new Error('Respuesta de IA incompatible con las ofertas autorizadas.');
        }
        return {
          offer_id: offer.offer_id,
          supplier_id: offer.supplier_id,
          supplier_name: offer.supplier_name,
          total: offer.total,
          delivery_days: offer.delivery_days,
          score: score.score,
          breakdown,
        };
      });
    } catch (error: unknown) {
      this.logger.warn(`Servicio de IA no disponible: ${error instanceof Error ? error.message : 'respuesta invalida'}`);
      return request.offers.map(offer => ({
        offer_id: offer.offer_id,
        supplier_id: offer.supplier_id,
        supplier_name: offer.supplier_name,
        total: offer.total,
        delivery_days: offer.delivery_days,
        score: null,
        breakdown: { price_score: null, delivery_score: null, reputation_score: null },
      }));
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.httpService.get(`${this.serviceUrl}/health`));
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}
