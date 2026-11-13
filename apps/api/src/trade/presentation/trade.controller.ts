import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Trade } from '../application/trade';
import { TradeRule } from '../domain/trade';
@Catch(TradeRule)
class TradeFilter implements ExceptionFilter {
  catch(error: TradeRule, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse()
      .status(error.code === 'INVALID_INPUT' ? 422 : 409)
      .json({ code: error.code, message: error.message });
  }
}
@Controller()
@UseFilters(TradeFilter)
export class TradeController {
  constructor(private readonly trade: Trade) {}
  @Get('trade/providers') providers(@Headers('authorization') a?: string) {
    return this.trade.providers(a);
  }
  @Get('trade/products') products(@Headers('authorization') a?: string) {
    return this.trade.products(a);
  }
  @Post('quotations') create(@Body() b: unknown, @Headers('authorization') a?: string) {
    return this.trade.create(b, a);
  }
  @Get('quotations') @Header('Cache-Control', 'no-store') list(@Headers('authorization') a?: string) {
    return this.trade.requests(a);
  }
  @Get('quotations/:id') @Header('Cache-Control', 'no-store') detail(
    @Param('id') id: string,
    @Headers('authorization') a?: string,
  ) {
    return this.trade.detail(id, a);
  }
  @Post('quotations/:id/responses') respond(
    @Param('id') id: string,
    @Body() b: unknown,
    @Headers('authorization') a?: string,
  ) {
    return this.trade.respond(id, b, a);
  }
  @Patch('quotations/:id/responses/:offer/accept') accept(
    @Param('id') id: string,
    @Param('offer') o: string,
    @Headers('authorization') a?: string,
  ) {
    return this.trade.accept(id, o, a);
  }
  @Post('orders') order(
    @Body() b: unknown,
    @Headers('idempotency-key') k?: string,
    @Headers('authorization') a?: string,
  ) {
    return this.trade.order(b, k, a);
  }
  @Get('orders') @Header('Cache-Control', 'no-store') orders(@Headers('authorization') a?: string) {
    return this.trade.orders(a);
  }
  @Get('orders/:id') @Header('Cache-Control', 'no-store') orderDetail(
    @Param('id') id: string,
    @Headers('authorization') a?: string,
  ) {
    return this.trade.orderDetail(id, a);
  }
}
