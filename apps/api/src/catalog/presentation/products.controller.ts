import { BadRequestException, Controller, DefaultValuePipe, Get, Header, ParseIntPipe, Query } from '@nestjs/common';
import { ListProducts, CatalogFilters } from '../application/list-products';

@Controller('products')
export class ProductsController {
  constructor(private readonly listProducts: ListProducts) {}

  @Get('options')
  @Header('Cache-Control', 'no-store')
  options() {
    return this.listProducts.options();
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('q') search?: string,
    @Query('category') category?: string,
    @Query('supplier') supplier?: string,
    @Query('available') available?: string,
    @Query('sort') sort?: string,
  ) {
    if (!Number.isSafeInteger(page) || page < 1 || limit < 1 || limit > 100 ||
        !Number.isSafeInteger((page - 1) * limit)) {
      throw new BadRequestException('Pagina o limite invalidos.');
    }
    if ((search !== undefined && (typeof search !== 'string' || search.length > 120)) ||
        (category !== undefined && (typeof category !== 'string' || category.length > 100)) ||
        (supplier !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplier)) ||
        (available !== undefined && available !== 'true' && available !== 'false') ||
        (sort !== undefined && sort !== 'price-asc' && sort !== 'price-desc')) {
      throw new BadRequestException('Filtros de catalogo invalidos.');
    }
    const filters: CatalogFilters = {
      search: search?.trim(), category, supplier,
      available: available === undefined ? undefined : available === 'true',
      sort: sort as CatalogFilters['sort'],
    };
    return { items: await this.listProducts.execute(page, limit, filters), page, limit };
  }
}
