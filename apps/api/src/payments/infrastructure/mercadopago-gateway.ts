// Infrastructure: Mercado Pago Checkout Pro gateway

import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../application/payments';

@Injectable()
export class MercadoPagoGateway implements PaymentGateway {
  private readonly accessToken: string | undefined;
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly useMock: boolean;

  constructor() {
    this.accessToken = process.env.MP_ACCESS_TOKEN;
    this.useMock = !this.accessToken || process.env.NODE_ENV === 'test';

    if (this.useMock) {
      console.warn('[MercadoPago] Using MOCK mode (no real MP calls). Set MP_ACCESS_TOKEN for production.');
    }
  }

  async createPreference(params: {
    external_reference: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
    shipment_cost: number;
    expires_at: Date;
    back_urls?: { success: string; failure: string; pending: string };
  }): Promise<{ preference_id: string; init_point: string; response: any }> {
    if (this.useMock) {
      return this.mockCreatePreference(params);
    }

    const body = {
      external_reference: params.external_reference,
      items: params.items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: 'PEN',
      })),
      shipments: {
        cost: params.shipment_cost,
        mode: 'not_specified',
      },
      expiration_date_to: params.expires_at.toISOString(),
      back_urls: params.back_urls || {
        success: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments/success`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments/failure`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments/pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.API_URL || 'http://localhost:3000'}/api/v1/webhooks/mercadopago`,
    };

    const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MP API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      preference_id: data.id,
      init_point: data.init_point,
      response: data,
    };
  }

  async getPaymentInfo(paymentId: string): Promise<{
    id: string;
    status: string;
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    external_reference: string | null;
  }> {
    if (this.useMock) {
      return this.mockGetPaymentInfo(paymentId);
    }

    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Payment not found');
      }
      const error = await response.text();
      throw new Error(`MP API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      transaction_amount: data.transaction_amount,
      currency_id: data.currency_id,
      external_reference: data.external_reference,
    };
  }

  // Mock implementations for testing without real credentials
  private mockCreatePreference(params: any): Promise<{ preference_id: string; init_point: string; response: any }> {
    const mockId = `MOCK_PREF_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return Promise.resolve({
      preference_id: mockId,
      init_point: `https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=${mockId}`,
      response: {
        id: mockId,
        external_reference: params.external_reference,
        items: params.items,
        date_created: new Date().toISOString(),
        init_point: `https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=${mockId}`,
      },
    });
  }

  private mockGetPaymentInfo(paymentId: string): Promise<{
    id: string;
    status: string;
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    external_reference: string | null;
  }> {
    // En mock, simular un pago aprobado si el ID contiene "APPROVED"
    // o pendiente si contiene "PENDING", rechazado si contiene "REJECTED"
    let status = 'approved';
    if (paymentId.includes('PENDING')) status = 'pending';
    if (paymentId.includes('REJECTED')) status = 'rejected';

    // Extraer external_reference del paymentId si tiene formato especial
    // Formato: MOCK_PAYMENT_{status}_{external_ref}
    let externalRef: string | null = null;
    const match = paymentId.match(/MOCK_PAYMENT_\w+_(.+)/);
    if (match) {
      externalRef = match[1];
    }

    return Promise.resolve({
      id: paymentId,
      status,
      status_detail: 'accredited',
      transaction_amount: 100.00,
      currency_id: 'PEN',
      external_reference: externalRef,
    });
  }
}
