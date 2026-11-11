import { BadRequestException, Controller, DefaultValuePipe, Get, Header, ParseIntPipe, Query } from '@nestjs/common';
import { ListProducts } from '../application/list-products';

@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProducts) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!Number.isSafeInteger(page) || page < 1 || limit < 1 || limit > 100 ||
        !Number.isSafeInteger((page - 1) * limit)) {
      throw new BadRequestException('Página o límite inválidos.');
    }
    return { items: await this.listProducts.execute(page, limit), page, limit };
  }
}
