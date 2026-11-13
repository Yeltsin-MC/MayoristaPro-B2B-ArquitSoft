// Module: Payment integration with Mercado Pago

import { Module } from '@nestjs/common';
import { Payments, PAYMENT_STORE, PAYMENT_GATEWAY } from './application/payments';
import { PostgresPayments } from './infrastructure/postgres-payments';
import { MercadoPagoGateway } from './infrastructure/mercadopago-gateway';
import { PaymentsController } from './presentation/payments.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_STORE,
      useClass: PostgresPayments,
    },
    {
      provide: PAYMENT_GATEWAY,
      useClass: MercadoPagoGateway,
    },
    {
      provide: Payments,
      inject: [PAYMENT_STORE, PAYMENT_GATEWAY],
      useFactory: (store, gateway) => new Payments(store, gateway),
    },
  ],
  exports: [Payments], // Para usar en workers
})
export class PaymentsModule {}
