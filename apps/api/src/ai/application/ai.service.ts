import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ScoreOffersRequest, ScoreOffersResponse, ScoredOffer } from '../domain/scored-offer';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Llama al servicio Python FastAPI para puntuar ofertas.
   * Si el servicio no está disponible, retorna ofertas sin puntuación.
   */
  async scoreOffers(request: ScoreOffersRequest): Promise<ScoredOffer[]> {
    try {
      const url = `${this.AI_SERVICE_URL}/api/v1/score-offers`;
      this.logger.log(`Calling AI service at ${url} with ${request.offers.length} offers`);

      const response = await firstValueFrom(
        this.httpService.post<ScoreOffersResponse>(url, request)
      );

      this.logger.log(`AI service returned ${response.data.scored_offers.length} scored offers`);
      return response.data.scored_offers;
    } catch (error: any) {
      this.logger.warn(
        `AI service unavailable: ${error?.message || 'Unknown error'}. Returning offers without scores.`
      );
      
      // Degradación elegante: retornar ofertas con score null
      return request.offers.map(offer => ({
        offer_id: offer.offer_id,
        supplier_id: offer.supplier_id,
        supplier_name: offer.supplier_name,
        total: offer.total,
        delivery_days: offer.delivery_days,
        score: null,
        breakdown: {
          price_score: null,
          delivery_score: null,
          reputation_score: null,
        },
      }));
    }
  }

  /**
   * Verifica si el servicio de IA está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.AI_SERVICE_URL}/health`;
      await firstValueFrom(this.httpService.get(url));
      return true;
    } catch {
      return false;
    }
  }
}
