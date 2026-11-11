import { Component, input, output, signal } from '@angular/core';

interface PreviewRow {
  row: number;
  data: Record<string,string>;
  action: 'create'|'update';
  errors: { column:string; message:string }[];
  snapshot?: { stock:number } | null;
}
interface Preview {
  id:string;
  status:'preview'|'invalid'|'stale'|'applied';
  previewHash:string;
  expiresAt:string;
  rows:PreviewRow[];
  summary:{ total:number; creates:number; updates:number; invalid:number };
  result?:{ created:number; updated:number };
}

@Component({
  selector:'app-catalog-import',
  template:`
    <section aria-label="Carga masiva del catálogo" class="import">
      <h3>Carga masiva del catálogo</h3>
      <p>Descarga la plantilla, completa tus productos y revisa el lote antes de confirmar.</p>
      <p><a href="/api/v1/products/imports/template">Plantilla CSV</a> ·
        <a href="/api/v1/products/imports/template?format=xlsx">Plantilla Excel</a></p>
      <p>Hasta 500 filas y 5 MB. CSV UTF-8 separado por comas o Excel XLSX con una sola hoja, sin fórmulas.
        Precio por presentación en PEN, decimal con punto. Publicado e incluye IGV: true o false.</p>
      <p><strong>Las actualizaciones conservan el stock existente.</strong> La columna stock solo establece existencias de productos nuevos.
        No cambies la presentación ni su equivalencia en un SKU existente.</p>
      <label>Archivo del catálogo <input type="file" accept=".csv,.xlsx" [disabled]="busy()" (change)="selectFile($event)"></label>
      <button type="button" [disabled]="!file() || busy()" (click)="preview()">{{busy()?'Procesando…':'Cargar y revisar lote'}}</button>
      <p role="status" aria-live="polite">{{message()}}</p>
      @if(batch(); as b) {
        <h4>Vista previa</h4>
        <p>Lote {{b.id}} · Estado: {{statusLabel(b.status)}}</p>
        <p>{{b.summary.total}} filas · {{b.summary.creates}} altas · {{b.summary.updates}} actualizaciones · {{b.summary.invalid}} filas con errores.</p>
        <p>Vence: {{formatDate(b.expiresAt)}}. Ante un cambio posterior, vuelve a cargar el archivo para revisar una nueva vista previa.</p>
        <button type="button" (click)="downloadReport()">Descargar reporte CSV</button>
        <div class="table-scroll" tabindex="0" role="region" aria-label="Filas de la vista previa">
          <table>
            <thead><tr><th>Fila</th><th>SKU</th><th>Acción</th><th>Producto y categoría</th><th>Presentación</th><th>Precio e IGV</th><th>Mínimo / múltiplo</th><th>Stock</th><th>Publicación</th><th>Errores</th></tr></thead>
            <tbody>
              @for(row of b.rows;track row.row) {
                <tr [class.invalid]="row.errors.length>0">
                  <td>{{row.row}}</td><td>{{row.data['sku']}}</td><td>{{row.action==='create'?'Alta':'Actualizar'}}</td>
                  <td>{{row.data['nombre']}} · {{row.data['categoria']}}</td>
                  <td>{{row.data['presentacion']}} de {{row.data['unidades_por_presentacion']}}</td>
                  <td>S/ {{row.data['precio']}} · {{row.data['incluye_igv']==='true'?'Incluye IGV':'IGV por separado'}}</td>
                  <td>{{row.data['minimo']}} / {{row.data['multiplo']}}</td>
                  <td>{{row.snapshot ? row.snapshot.stock+' (se conserva el vigente)' : row.data['stock']}}</td>
                  <td>{{row.data['publicado']==='true'?'Publicar':'Borrador'}}</td>
                  <td>@for(error of row.errors;track $index) { <p>{{error.column}}: {{error.message}}</p> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if(b.status==='invalid') { <p role="alert">Corrige las filas indicadas y vuelve a cargar el archivo. Ningún producto se ha modificado.</p> }
        @if(b.status==='stale') { <p role="alert">La vista previa cambió o venció. Carga y revisa el lote de nuevo.</p> }
        @if(b.status==='preview') {
          <p>Confirma únicamente después de revisar todas las filas. Se aplicará el lote completo.</p>
          <button type="button" [disabled]="busy() || b.summary.invalid>0" (click)="confirm()">Confirmar lote completo</button>
        }
        @if(b.status==='applied' && b.result) { <p role="status">Lote aplicado: {{b.result.created}} altas y {{b.result.updated}} actualizaciones. El catálogo ya está actualizado.</p> }
      }
    </section>`,
  styles:[`
    .import {margin-top:1.5rem;border-top:1px solid #ccc;padding-top:1rem}
    label {display:block;margin:1rem 0} button,input {font:inherit;padding:.5rem}
    button {margin:.25rem} .table-scroll {overflow:auto;max-height:32rem;margin:1rem 0}
    table {border-collapse:collapse;width:100%;min-width:60rem;font-size:.9rem}
    th,td {border:1px solid #ccc;padding:.6rem;text-align:left;vertical-align:top}
    th {background:#edf2f7;position:sticky;top:0} .invalid {background:#fff1f0}
    td p {margin:0 0 .5rem} p {overflow-wrap:anywhere}
  `],
})
export class CatalogImportComponent {
  readonly token = input.required<string>();
  readonly applied = output<void>();
  readonly file = signal<File|null>(null);
  readonly batch = signal<Preview|null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  private key = '';

  selectFile(event:Event) {
    const file=(event.target as HTMLInputElement).files?.[0] ?? null;
    this.batch.set(null); this.message.set(''); this.file.set(null);
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size>5*1024*1024) {
      this.message.set('Selecciona un CSV o XLSX de hasta 5 MB.'); return;
    }
    this.file.set(file);
  }

  private async request(path:string, options:RequestInit):Promise<Preview|null> {
    const response=await fetch('/api/v1/products/imports/'+path,{...options,
      headers:{...options.headers,Authorization:'Bearer '+this.token()}});
    const data=await response.json();
    if (!response.ok) {
      if (response.status===409) this.batch.update(b=>b?{...b,status:'stale'}:b);
      throw new Error(Array.isArray(data.message)?data.message.join(', '):data.message??'No se pudo completar la operación.');
    }
    return data;
  }

  async preview() {
    const file=this.file(); if (!file || this.busy()) return;
    this.busy.set(true);this.batch.set(null);this.message.set('Validando archivo…');
    try {
      const form=new FormData();form.append('file',file);
      this.batch.set(await this.request('preview',{method:'POST',body:form}));
      this.key=crypto.randomUUID();this.message.set('Revisa la vista previa antes de confirmar.');
    } catch(error) {this.message.set(error instanceof Error?error.message:'Error de conexión.');}
    finally {this.busy.set(false);}
  }

  async confirm() {
    const batch=this.batch();if (!batch || this.busy() || batch.status!=='preview') return;
    this.busy.set(true);this.message.set('Confirmando lote…');
    try {
      const applied=await this.request(batch.id+'/confirm',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':this.key},
        body:JSON.stringify({previewHash:batch.previewHash})});
      this.batch.set(applied);this.message.set('Lote aplicado correctamente.');this.applied.emit();
    } catch(error) {this.message.set(error instanceof Error?error.message:'Error de conexión. Puedes reintentar la confirmación.');}
    finally {this.busy.set(false);}
  }

  statusLabel(status:Preview['status']) {return {preview:'Por confirmar',invalid:'Con errores',stale:'Requiere revisión',applied:'Aplicado'}[status];}
  formatDate(value:string) {return new Date(value).toLocaleString('es-PE');}
  downloadReport() {
    const batch=this.batch();if (!batch) return;
    const quote=(value:unknown) => {
      let text=String(value??'');if (/^[=+@\-\t\r]/.test(text)) text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    };
    const rows=[['fila','sku','accion','estado','errores'],...batch.rows.map(r=>[
      r.row,r.data['sku'],r.action,batch.status,r.errors.map(e=>e.column+': '+e.message).join(' | ')])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='reporte-'+batch.id+'.csv';link.click();URL.revokeObjectURL(url);
  }
}
