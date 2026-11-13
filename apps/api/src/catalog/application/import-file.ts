import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { fromBuffer, Entry } from 'yauzl';

export const FILE_LIMIT = 5 * 1024 * 1024;
export const ROW_LIMIT = 500;
export const COLUMNS = [
  'sku',
  'nombre',
  'categoria',
  'presentacion',
  'unidades_por_presentacion',
  'precio',
  'moneda',
  'incluye_igv',
  'minimo',
  'multiplo',
  'stock',
  'publicado',
] as const;
export type Column = (typeof COLUMNS)[number];
export type ImportData = Record<Column, string>;
export interface RowError {
  column: string;
  message: string;
}
export interface ImportRow {
  row: number;
  data: ImportData;
  errors: RowError[];
  action?: 'create' | 'update';
  snapshot?: { id: string; revision: string; unit: string; unitsPerPack: number; stock: number } | null;
}

// Check actual expanded sizes before handing the archive to the workbook reader.
// Never extract files onto disk or resolve workbook hyperlinks.
async function checkArchive(buffer: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) {
        reject(new BadRequestException('XLSX no válido.'));
        return;
      }
      let total = 0,
        entries = 0,
        settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(new BadRequestException('XLSX inválido, con macros o demasiado expandido (máximo 20 MB/100 entradas).'));
      };
      zip.on('error', fail);
      zip.on('end', () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      zip.on('entry', (entry: Entry) => {
        if (
          ++entries > 100 ||
          /vbaProject|macrosheets/i.test(entry.fileName) ||
          entry.uncompressedSize + total > 20 * 1024 * 1024 ||
          entry.isEncrypted()
        ) {
          fail();
          return;
        }
        if (entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) {
            fail();
            return;
          }
          stream.on('error', fail);
          stream.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > 20 * 1024 * 1024) {
              stream.destroy();
              fail();
            }
          });
          stream.on('end', () => {
            if (!settled) zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function readImportFile(file: { originalname: string; buffer: Buffer }): Promise<ImportRow[]> {
  if (file.buffer.length > FILE_LIMIT) throw new PayloadTooLargeException('Máximo 5 MB.');
  const extension = file.originalname.toLowerCase().split('.').pop();
  let records: unknown[][];
  try {
    if (extension === 'csv') {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
      records = parse(content, { bom: true, to: ROW_LIMIT + 2, max_record_size: 16384, relax_column_count: true });
    } else if (extension === 'xlsx') {
      await checkArchive(file.buffer);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
      if (workbook.worksheets.length !== 1) throw new Error('Debe haber una sola hoja.');
      const sheet = workbook.worksheets[0];
      if (sheet.rowCount > ROW_LIMIT + 1 || sheet.columnCount > COLUMNS.length)
        throw new Error('Dimensiones inválidas.');
      records = [];
      for (let n = 1; n <= sheet.rowCount; n++) {
        const cells: unknown[] = [];
        for (let c = 1; c <= COLUMNS.length; c++) cells.push(sheet.getRow(n).getCell(c).value ?? '');
        records.push(cells);
      }
    } else {
      throw new BadRequestException('Solo CSV UTF-8 con comas o XLSX.');
    }
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof PayloadTooLargeException) throw error;
    throw new BadRequestException(
      'Archivo ilegible: usa la plantilla, una sola hoja y hasta 500 filas. No se admiten archivos cifrados.',
    );
  }
  if (records.length < 2 || records.length > ROW_LIMIT + 1)
    throw new BadRequestException('Se requieren entre 1 y 500 filas.');
  const headers = records[0].map(v => (typeof v === 'string' ? v.trim() : ''));
  if (
    headers.length !== COLUMNS.length ||
    new Set(headers).size !== COLUMNS.length ||
    COLUMNS.some(c => !headers.includes(c))
  )
    throw new BadRequestException(
      'Encabezados incorrectos. Usa todas las columnas de la plantilla, sin columnas adicionales.',
    );
  const rows: ImportRow[] = [];
  records.slice(1).forEach((record, index) => {
    if (record.every(value => value === '' || value == null)) return;
    const data = {} as ImportData;
    const errors: RowError[] = [];
    if (record.length !== COLUMNS.length) errors.push({ column: 'fila', message: 'Cantidad de columnas incorrecta.' });
    headers.forEach((header, c) => {
      const value = record[c];
      if (value !== null && typeof value === 'object') {
        errors.push({ column: header, message: 'Solo valores literales; no fórmulas, fechas ni vínculos.' });
        data[header as Column] = '';
      } else data[header as Column] = String(value ?? '').trim();
    });
    rows.push({ row: index + 2, data, errors });
  });
  if (!rows.length) throw new BadRequestException('El archivo no contiene productos.');
  validateRows(rows);
  return rows;
}

export function validateRows(rows: ImportRow[]): void {
  const duplicates = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const d = row.data;
    const invalid = (column: Column, message: string) => row.errors.push({ column, message });
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(d.sku))
      invalid('sku', 'De 1 a 64 caracteres: letras, números, punto, guion o guion bajo; comienza con letra o número.');
    for (const column of ['nombre', 'categoria'] as const) {
      if (
        !d[column] ||
        d[column].includes('\u0000') ||
        d[column].length > (column === 'nombre' ? 200 : 120) ||
        /^[=+@-]/.test(d[column])
      )
        invalid(
          column,
          'Texto obligatorio y literal, sin caracteres nulos; nombre hasta 200 y categoría hasta 120 caracteres.',
        );
    }
    d.presentacion = d.presentacion.toLowerCase();
    if (!['unidad', 'paquete', 'docena', 'caja', 'saco'].includes(d.presentacion))
      invalid('presentacion', 'Usa unidad, paquete, docena, caja o saco (bienes contables).');
    for (const column of ['unidades_por_presentacion', 'minimo', 'multiplo', 'stock'] as const) {
      if (
        !/^\d+$/.test(d[column]) ||
        !Number.isSafeInteger(Number(d[column])) ||
        Number(d[column]) > 2147483647 ||
        Number(d[column]) < (column === 'stock' ? 0 : 1)
      )
        invalid(column, 'Entero válido: positivo; stock puede ser cero.');
    }
    if (d.presentacion === 'docena' && Number(d.unidades_por_presentacion) !== 12)
      invalid('unidades_por_presentacion', 'Una docena contiene 12 unidades.');
    if (Number(d.minimo) % Number(d.multiplo) !== 0) invalid('minimo', 'El mínimo debe ser múltiplo del incremento.');
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(d.precio) || Number(d.precio) <= 0)
      invalid(
        'precio',
        'Precio positivo por presentación, hasta 10 enteros y 2 decimales; usa punto decimal, sin redondeo.',
      );
    else d.precio = Number(d.precio).toFixed(2);
    if (d.moneda !== 'PEN') invalid('moneda', 'Solo PEN.');
    for (const column of ['incluye_igv', 'publicado'] as const) {
      d[column] = d[column].toLowerCase();
      if (!['true', 'false'].includes(d[column])) invalid(column, 'Usa true o false.');
    }
    duplicates.set(d.sku, [...(duplicates.get(d.sku) ?? []), row]);
  }
  for (const repeated of duplicates.values())
    if (repeated.length > 1) {
      for (const row of repeated) row.errors.push({ column: 'sku', message: 'SKU repetido dentro del archivo.' });
    }
}
