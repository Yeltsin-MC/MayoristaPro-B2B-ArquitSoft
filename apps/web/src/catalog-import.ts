import { Component, input, output, signal } from '@angular/core';

interface PreviewRow {
  row: number;
  data: Record<string, string>;
  action: 'create' | 'update';
  errors: { column: string; message: string }[];
  snapshot?: { stock: number } | null;
}
interface Preview {
  id: string;
  status: 'preview' | 'invalid' | 'stale' | 'applied';
  previewHash: string;
  expiresAt: string;
  rows: PreviewRow[];
  summary: { total: number; creates: number; updates: number; invalid: number };
  result?: { created: number; updated: number };
}

@Component({
  selector: 'app-catalog-import',
  template: ` <section aria-label="Carga masiva del catálogo" class="import account-panel">
    <h3>Carga masiva del catálogo</h3>
    <p class="muted">Sube o actualiza muchos productos a la vez con una hoja de Excel, en 4 pasos.</p>
    <ol class="import-steps" aria-label="Pasos de la carga masiva">
      <li [class.done]="!!file() || !!batch()" [class.current]="!file() && !batch()">
        <span class="step-number" aria-hidden="true">1</span>
        <div>
          <strong>Descarga la plantilla</strong>
          <p>
            <a href="/api/v1/products/imports/template?format=xlsx">Plantilla Excel</a> ·
            <a href="/api/v1/products/imports/template">Plantilla CSV</a>
          </p>
          <small>Llénala desde la fila 2. No cambies los nombres de la primera fila.</small>
        </div>
      </li>
      <li [class.done]="!!batch()" [class.current]="!!file() && !batch()">
        <span class="step-number" aria-hidden="true">2</span>
        <div>
          <strong>Sube tu archivo</strong>
          <label
            >Archivo del catálogo
            <input type="file" accept=".csv,.xlsx" [disabled]="busy()" (change)="selectFile($event)"
          /></label>
          <button type="button" [disabled]="!file() || busy()" (click)="preview()">
            {{ busy() ? 'Procesando…' : 'Cargar y revisar lote' }}
          </button>
        </div>
      </li>
      <li [class.done]="batch()?.status === 'applied'" [class.current]="!!batch() && batch()?.status !== 'applied'">
        <span class="step-number" aria-hidden="true">3</span>
        <div>
          <strong>Revisa</strong>
          <small>Te mostramos cuántos productos se crean, cuántos se actualizan y qué filas tienen errores.</small>
        </div>
      </li>
      <li [class.done]="batch()?.status === 'applied'">
        <span class="step-number" aria-hidden="true">4</span>
        <div>
          <strong>Confirma</strong>
          <small>Nada cambia en tu catálogo hasta que confirmes.</small>
        </div>
      </li>
    </ol>
    <details class="import-rules">
      <summary>¿Cómo lleno la plantilla?</summary>
      <ul>
        <li><strong>sku</strong>: tu código interno del producto. Si ya existe, el producto se actualiza.</li>
        <li><strong>presentacion</strong> y <strong>unidades_por_presentacion</strong>: por ejemplo «caja» de 12.</li>
        <li><strong>precio</strong>: precio de una presentación en soles, con punto decimal (48.50).</li>
        <li>
          <strong>minimo</strong> y <strong>multiplo</strong>: cuántas presentaciones como mínimo y de cuánto en cuánto.
        </li>
        <li><strong>incluye_igv</strong> y <strong>publicado</strong>: escribe true (sí) o false (no).</li>
        <li>
          <strong>stock</strong>: solo se usa al crear un producto; al actualizar se conserva el stock que ya tienes.
        </li>
        <li>
          Hasta 500 filas y 5 MB, una sola hoja y sin fórmulas. Las fotos se agregan aparte, no van en la plantilla.
        </li>
      </ul>
    </details>
    <p role="status" aria-live="polite" [class.import-error]="failed()">{{ message() }}</p>
    @if (batch(); as b) {
      <h4>Vista previa</h4>
      <dl class="import-summary">
        <div>
          <dt>Filas</dt>
          <dd>{{ b.summary.total }}</dd>
        </div>
        <div>
          <dt>Nuevos</dt>
          <dd>{{ b.summary.creates }}</dd>
        </div>
        <div>
          <dt>Se actualizan</dt>
          <dd>{{ b.summary.updates }}</dd>
        </div>
        <div [class.has-errors]="b.summary.invalid > 0">
          <dt>Con errores</dt>
          <dd>{{ b.summary.invalid }}</dd>
        </div>
      </dl>
      <p class="muted">
        {{ b.summary.total }} filas · {{ b.summary.creates }} altas · {{ b.summary.updates }} actualizaciones ·
        {{ b.summary.invalid }} filas con errores. Estado: {{ statusLabel(b.status) }}. La vista previa vence:
        {{ formatDate(b.expiresAt) }}.
      </p>
      <button type="button" class="secondary" (click)="downloadReport()">Descargar reporte CSV</button>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Filas de la vista previa">
        <table>
          <thead>
            <tr>
              <th>Fila</th>
              <th>SKU</th>
              <th>Acción</th>
              <th>Producto y categoría</th>
              <th>Presentación</th>
              <th>Precio e IGV</th>
              <th>Mínimo / múltiplo</th>
              <th>Stock</th>
              <th>Publicación</th>
              <th>Errores</th>
            </tr>
          </thead>
          <tbody>
            @for (row of b.rows; track row.row) {
              <tr [class.invalid]="row.errors.length > 0">
                <td>{{ row.row }}</td>
                <td>{{ row.data['sku'] }}</td>
                <td>{{ row.action === 'create' ? 'Alta' : 'Actualizar' }}</td>
                <td>{{ row.data['nombre'] }} · {{ row.data['categoria'] }}</td>
                <td>{{ row.data['presentacion'] }} de {{ row.data['unidades_por_presentacion'] }}</td>
                <td>
                  S/ {{ row.data['precio'] }} ·
                  {{ row.data['incluye_igv'] === 'true' ? 'Incluye IGV' : 'IGV por separado' }}
                </td>
                <td>{{ row.data['minimo'] }} / {{ row.data['multiplo'] }}</td>
                <td>{{ row.snapshot ? row.snapshot.stock + ' (se conserva el vigente)' : row.data['stock'] }}</td>
                <td>{{ row.data['publicado'] === 'true' ? 'Publicar' : 'Borrador' }}</td>
                <td>
                  @for (error of row.errors; track $index) {
                    <p>{{ error.column }}: {{ error.message }}</p>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (b.status === 'invalid') {
        <p role="alert">Corrige las filas indicadas y vuelve a cargar el archivo. Ningún producto se ha modificado.</p>
      }
      @if (b.status === 'stale') {
        <p role="alert">La vista previa cambió o venció. Carga y revisa el lote de nuevo.</p>
      }
      @if (b.status === 'preview') {
        <p>Confirma únicamente después de revisar todas las filas. Se aplicará el lote completo.</p>
        <button type="button" [disabled]="busy() || b.summary.invalid > 0" (click)="confirm()">
          Confirmar lote completo
        </button>
      }
      @if (b.status === 'applied' && b.result) {
        <p role="status">
          Lote aplicado: {{ b.result.created }} altas y {{ b.result.updated }} actualizaciones. El catálogo ya está
          actualizado.
        </p>
      }
    }
  </section>`,
  styles: [
    `
      .table-scroll {
        overflow: auto;
        max-height: 32rem;
        margin: 1rem 0;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        min-width: 60rem;
        font-size: 0.9rem;
      }
      th,
      td {
        border: 1px solid var(--border, #dde3ec);
        padding: 0.6rem;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #edf2f7;
        position: sticky;
        top: 0;
      }
      .invalid {
        background: #fff1f0;
      }
      td p {
        margin: 0 0 0.5rem;
      }
      p {
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class CatalogImportComponent {
  readonly token = input.required<string>();
  readonly applied = output<void>();
  readonly file = signal<File | null>(null);
  readonly batch = signal<Preview | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly failed = signal(false);
  private key = '';

  selectFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.batch.set(null);
    this.message.set('');
    this.failed.set(false);
    this.file.set(null);
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      this.failed.set(true);
      this.message.set('Selecciona un CSV o XLSX de hasta 5 MB.');
      return;
    }
    this.file.set(file);
  }

  private async request(path: string, options: RequestInit): Promise<Preview | null> {
    const response = await fetch('/api/v1/products/imports/' + path, {
      ...options,
      headers: { ...options.headers, Authorization: 'Bearer ' + this.token() },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409) this.batch.update(b => (b ? { ...b, status: 'stale' } : b));
      throw new Error(
        Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? 'No se pudo completar la operación.'),
      );
    }
    return data;
  }

  async preview() {
    const file = this.file();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.batch.set(null);
    this.failed.set(false);
    this.message.set('Validando archivo…');
    try {
      const form = new FormData();
      form.append('file', file);
      this.batch.set(await this.request('preview', { method: 'POST', body: form }));
      this.key = crypto.randomUUID();
      this.message.set('Revisa la vista previa antes de confirmar.');
    } catch (error) {
      this.failed.set(true);
      this.message.set(error instanceof Error ? error.message : 'Error de conexión.');
    } finally {
      this.busy.set(false);
    }
  }

  async confirm() {
    const batch = this.batch();
    if (!batch || this.busy() || batch.status !== 'preview') return;
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('Confirmando lote…');
    try {
      const applied = await this.request(batch.id + '/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': this.key },
        body: JSON.stringify({ previewHash: batch.previewHash }),
      });
      this.batch.set(applied);
      this.message.set('Lote aplicado correctamente.');
      this.applied.emit();
    } catch (error) {
      this.failed.set(true);
      this.message.set(
        error instanceof Error ? error.message : 'Error de conexión. Puedes reintentar la confirmación.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  statusLabel(status: Preview['status']) {
    return { preview: 'Por confirmar', invalid: 'Con errores', stale: 'Requiere revisión', applied: 'Aplicado' }[
      status
    ];
  }
  formatDate(value: string) {
    return new Date(value).toLocaleString('es-PE');
  }
  downloadReport() {
    const batch = this.batch();
    if (!batch) return;
    const quote = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      ['fila', 'sku', 'accion', 'estado', 'errores'],
      ...batch.rows.map(r => [
        r.row,
        r.data['sku'],
        r.action,
        batch.status,
        r.errors.map(e => e.column + ': ' + e.message).join(' | '),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-' + batch.id + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
