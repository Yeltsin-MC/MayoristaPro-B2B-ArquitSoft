import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import { CatalogImports } from '../application/catalog-imports';
import { COLUMNS, FILE_LIMIT } from '../application/import-file';

const example = ['CUAD-A4', 'Cuaderno A4', 'Papelería', 'caja', 12, '48.00', 'PEN', 'true', 2, 1, 20, 'true'];
@Controller('products/imports')
export class ImportsController {
  constructor(private readonly imports: CatalogImports) {}

  @Get('template')
  async template(@Query('format') format?: string) {
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Catalogo');
      sheet.addRow([...COLUMNS]);
      sheet.addRow(example);
      return new StreamableFile(Buffer.from(await workbook.xlsx.writeBuffer()), {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="catalogo.xlsx"',
      });
    }
    return new StreamableFile(Buffer.from('\uFEFF' + COLUMNS.join(',') + '\r\n' + example.join(',') + '\r\n'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="catalogo.csv"',
    });
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FILE_LIMIT, files: 1, fields: 0, parts: 1 } }))
  preview(@UploadedFile() file: Express.Multer.File | undefined, @Headers('authorization') auth?: string) {
    return this.imports.preview(file, auth);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() body: { previewHash?: string },
    @Headers('idempotency-key') key?: string,
    @Headers('authorization') auth?: string,
  ) {
    return this.imports.confirm(id, body, key, auth);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.imports.get(id, auth);
  }
}
