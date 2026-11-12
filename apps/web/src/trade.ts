import {Component,effect,input,output,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
@Component({selector:'app-trade',imports:[FormsModule],template:`
<section class="trade" aria-label="Cotizaciones y pedidos">
 <h3>Cotizaciones y pedidos</h3>
 <p>Solicita ofertas privadas, revisa el desglose y crea un pedido con reserva de stock. El pago aún no está habilitado.</p>
 <button type="button" (click)="refresh()" [disabled]="busy()">Actualizar cotizaciones</button>
 @if(canBuy()) { <button type="button" (click)="newRequest()">Nueva solicitud</button> }
 <p role="status">{{message()}}</p>
 @if(canBuy() && creating()) {
 <form (ngSubmit)="create()">
  <h4>Nueva solicitud de cotización</h4>
  <fieldset><legend>Proveedores destinatarios</legend>
   @for(p of providers();track p.id) { <label class="check"><input type="checkbox" [name]="'supplier-'+p.id" [checked]="supplierIds.includes(p.id)" (change)="toggle(p.id)">{{p.name}}</label> }
  </fieldset>
  @for(i of items;track $index;let n=$index) {
   <fieldset><legend>Ítem {{n+1}}</legend>
    <label>Descripción <input [name]="'description-'+n" required [(ngModel)]="i.descripcion"></label>
    <label>Presentación <select [name]="'unit-'+n" [(ngModel)]="i.presentacion"><option>unidad</option><option>paquete</option><option>docena</option><option>caja</option><option>saco</option></select></label>
    <label>Unidades por presentación <input type="number" min="1" [name]="'pack-'+n" required [(ngModel)]="i.unidadesPorPresentacion"></label>
    <label>Cantidad de presentaciones <input type="number" min="1" [name]="'quantity-'+n" required [(ngModel)]="i.cantidad"></label>
    @if(items.length>1){<button type="button" (click)="items.splice(n,1)">Quitar ítem {{n+1}}</button>}
   </fieldset>
  }
  <button type="button" (click)="addItem()" [disabled]="items.length>=50">Añadir ítem</button>
  <button [disabled]="busy() || supplierIds.length===0">Enviar solicitud</button>
 </form>
 }
 <h4>Solicitudes autorizadas</h4>
 @for(q of requests();track q.id){<p>{{q.buyerName}} · {{q.status}} <button type="button" (click)="open(q.id)">Abrir solicitud {{q.id}}</button></p>}
 @if(selected();as q) {
  <h4>Solicitud {{q.id}}</h4><p>Comprador: {{q.buyerName}} · {{q.status}}</p>
  @for(i of q.items;track i.id){<p>{{i.description}} · {{i.unit}} de {{i.unitsPerPack}} · cantidad {{i.quantity}}</p>}
  @if(!q.isBuyer && q.status==='abierta' && q.offers.length===0 && canSell()) {
   <form (ngSubmit)="respond()"><h4>Responder con productos propios</h4>
    @for(line of responseItems;track line.solicitudItemId;let n=$index) {
     <fieldset><legend>{{q.items[n].description}} ({{line.cantidad}} presentaciones)</legend>
      <label>Producto propio <select [name]="'product-'+n" required [(ngModel)]="line.productoId"><option value="">Seleccionar</option>@for(p of products();track p.id){<option [value]="p.id">{{p.sku}} · {{p.name}} · {{p.unit}} de {{p.unitsPerPack}} · mínimo {{p.minimum}} · múltiplo {{p.multiple}} · stock {{p.stock}}</option>}</select></label>
      <label>Precio por presentación PEN (IGV incluido) <input [name]="'price-'+n" required [(ngModel)]="line.precioUnitario"></label>
     </fieldset>
    }
    <label>Envío final PEN <input name="shipping" required [(ngModel)]="shipping"></label>
    <label>Plazo de entrega en días <input name="deliveryDays" type="number" min="1" required [(ngModel)]="deliveryDays"></label>
    <label>Vigente hasta <input name="expiresAt" type="datetime-local" required [(ngModel)]="expiresAt"></label>
    <p>Precios con IGV incluido; envío por importe final. No se calcula desglose fiscal.</p>
    <button [disabled]="busy()">Enviar oferta</button>
   </form>
  }
  <h4>Ofertas privadas autorizadas</h4>
  @if(q.isBuyer && q.offers.length>1){
   <button type="button" [disabled]="busy()" (click)="scoreOffers(q.id)">{{scoredOffers().length>0?'Actualizar':'Calcular'}} puntuación IA</button>
   @if(scoredOffers().length>0){<label class="check"><input type="checkbox" [(ngModel)]="sortByScore" (change)="sortOffers()">Ordenar por puntuación</label>}
  }
  @for(o of displayedOffers();track o.id){
   <article class="offer"><h4>Oferta de {{o.supplierName}}</h4>
    @if(o.score!==undefined){
     <p class="score-info">
      <strong>Puntuación IA: {{o.score!==null?o.score.toFixed(1):'N/A'}}</strong>
      @if(o.breakdown && o.score!==null){
       <span class="tooltip" title="Precio: {{o.breakdown.price_score.toFixed(1)}} | Entrega: {{o.breakdown.delivery_score.toFixed(1)}} | Reputación: {{o.breakdown.reputation_score.toFixed(1)}}">ℹ️</span>
      }
     </p>
    }
    @for(i of o.items;track i.requestItemId){<p>{{i.snapshot.name}} · {{i.snapshot.unit}} de {{i.snapshot.unitsPerPack}} · {{i.quantity}} × S/ {{i.unitPrice}} = S/ {{i.subtotal}}</p>}
    <p>Productos: S/ {{o.subtotal}} · Envío final: S/ {{o.shipping}}</p>
    <p><strong>Total: S/ {{o.total}} PEN</strong> · IGV incluido en precios; no se calcula desglose fiscal.</p>
    <p>Plazo: {{o.deliveryDays}} días · Vigencia: {{date(o.expiresAt)}}</p>
    @if(q.isBuyer){
     @if(!q.acceptedOfferId){<button type="button" [disabled]="busy()" (click)="accept(o.id)">Aceptar oferta de {{o.supplierName}}</button>}
     @if(q.acceptedOfferId===o.id){<p>Oferta aceptada. Aceptar no reserva stock.</p><button type="button" [disabled]="busy()" (click)="order(o.id)">Crear pedido pendiente</button>}
    }
   </article>
  }
 }
 <h4>Pedidos autorizados</h4>
 @for(o of orders();track o.id){<p>Pedido {{o.id}} · {{o.state}} · S/ {{o.total}} <button type="button" (click)="openOrder(o.id)">Ver pedido {{o.id}}</button></p>}
 @if(currentOrder();as o){
  <article aria-label="Detalle del pedido"><h4>Pedido pendiente {{o.id}}</h4>
   @for(i of o.items;track $index){<p>{{i.snapshot.name}} · {{i.snapshot.unit}} de {{i.snapshot.unitsPerPack}} · {{i.quantity}} × S/ {{i.unitPrice}} = S/ {{i.subtotal}}</p>}
   <p>Productos: S/ {{o.subtotal}} · Envío final: S/ {{o.shipping}} · <strong>Total: S/ {{o.total}} PEN</strong></p>
   <p>IGV incluido en precios. Plazo: {{o.deliveryDays}} días.</p>
   @for(r of o.reservations;track r.productId){<p>Reserva {{r.state}}: {{r.quantity}} presentaciones.</p>}
   <p>Estado: {{o.state}}.</p>
   @if(o.state==='pendiente'){
    <p><strong>Pagar antes de: {{expiresIn(o.expiresAt)}}</strong></p>
    <button type="button" [disabled]="busy()" (click)="startPayment(o.id)">Pagar con Mercado Pago</button>
   }
   @if(o.state==='paid'){<p class="success">✓ Pago confirmado. Pedido procesándose.</p>}
   @if(o.state==='expired'){<p class="error">✗ Pedido vencido sin pago. Stock liberado.</p>}
   @if(o.state==='requires_reconciliation'){<p class="warning">⚠ Requiere reconciliación manual (pago tardío).</p>}
   @if(paymentAttempts().length>0){
    <h5>Intentos de pago</h5>
    @for(a of paymentAttempts();track a.id){
     <p>{{formatDate(a.created_at)}} · {{a.state}} · S/ {{a.amount}}
      @if(a.state==='created' && a.preference_id){<button type="button" (click)="openCheckout(a)">Continuar pago</button>}
     </p>
    }
   }
  </article>
 }
</section>`,styles:[`.trade{border-top:1px solid #ccc;margin-top:2rem;padding-top:1rem} form{display:grid;gap:.75rem;margin:1rem 0;max-width:45rem}label{display:grid;gap:.25rem}.check{display:flex;gap:.5rem}input,select{padding:.5rem;font:inherit;max-width:100%}fieldset{display:grid;gap:.5rem;border:1px solid #ccc}button{margin:.2rem}p{overflow-wrap:anywhere}.offer{margin:1rem 0;padding:1rem;border:1px solid #ddd;border-radius:4px}button:disabled{opacity:.5;cursor:default}.success{color:green;font-weight:bold}.error{color:red;font-weight:bold}.warning{color:orange;font-weight:bold}.score-info{display:flex;align-items:center;gap:.5rem;background:#f0f8ff;padding:.5rem;border-radius:4px;margin-bottom:.5rem}.tooltip{cursor:help;font-size:1.2em}`]})
export class TradeComponent {
 readonly token=input.required<string>();readonly canBuy=input(false);readonly canSell=input(false);readonly catalogChanged=output<void>();
 providers=signal<any[]>([]);products=signal<any[]>([]);requests=signal<any[]>([]);orders=signal<any[]>([]);
 selected=signal<any>(null);currentOrder=signal<any>(null);paymentAttempts=signal<any[]>([]);busy=signal(false);message=signal('');creating=signal(false);
 scoredOffers=signal<any[]>([]);sortByScore=false;
 supplierIds:string[]=[];items=[{descripcion:'',presentacion:'caja',unidadesPorPresentacion:12,cantidad:2}];
 responseItems:any[]=[];shipping='0.00';deliveryDays=3;expiresAt=this.future();private keys=new Map<string,string>();
 constructor(){effect(()=>{this.token();this.canBuy();this.canSell();void this.refresh();});}
 future(){return new Date(Date.now()+86400000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);}
 date(value:string){return new Date(value).toLocaleString('es-PE');}
 formatDate(value:string){return new Date(value).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'});}
 expiresIn(expiresAt:string){
  const now=Date.now();const exp=new Date(expiresAt).getTime();const diff=exp-now;
  if(diff<=0)return 'VENCIDO';
  const min=Math.floor(diff/60000);const sec=Math.floor((diff%60000)/1000);
  return `${min}min ${sec}s`;
 }
 private async call(path:string,method='GET',body?:unknown,key?:string):Promise<any>{
  this.busy.set(true);try{
   const r=await fetch('/api/v1/'+path,{method,headers:{Authorization:'Bearer '+this.token(),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const result=await r.json();if(!r.ok)throw new Error((result.code?result.code+': ':'')+(result.message??'Operación rechazada.'));
   this.message.set('Operación completada.');return result;
  }catch(error){this.message.set(error instanceof Error?error.message:'Error de conexión.');return null;}finally{this.busy.set(false);}
 }
 async refresh(){
  if(this.canBuy()){const p=await this.call('trade/providers');if(p)this.providers.set(p);}
  if(this.canSell()){const p=await this.call('trade/products');if(p)this.products.set(p);}
  const r=await this.call('quotations');if(r)this.requests.set(r);const o=await this.call('orders');if(o)this.orders.set(o);
 }
 newRequest(){this.selected.set(null);this.currentOrder.set(null);this.creating.set(true);this.message.set('Completa una nueva solicitud; la anterior conserva su historial.');}
 toggle(id:string){this.supplierIds=this.supplierIds.includes(id)?this.supplierIds.filter(x=>x!==id):[...this.supplierIds,id];}
 addItem(){this.items.push({descripcion:'',presentacion:'caja',unidadesPorPresentacion:12,cantidad:2});}
 async create(){const q=await this.call('quotations','POST',{proveedorIds:this.supplierIds,items:this.items});if(q){this.selected.set(q);this.creating.set(false);const r=await this.call('quotations');if(r)this.requests.set(r);}}
 async open(id:string){const q=await this.call('quotations/'+id);if(q){this.selected.set(q);this.currentOrder.set(null);this.creating.set(false);this.expiresAt=this.future();
  this.scoredOffers.set([]);this.sortByScore=false;
  this.responseItems=q.items.map((i:any)=>({solicitudItemId:i.id,productoId:'',cantidad:i.quantity,precioUnitario:''}));}}
 async scoreOffers(quotationId:string){
  const result=await this.call('quotations/'+quotationId+'/score-offers','POST');
  if(result && result.scored_offers){
   this.scoredOffers.set(result.scored_offers);
   if(!result.ai_service_available){this.message.set('Servicio de IA no disponible. Ofertas mostradas sin puntuación.');}
   else{this.message.set('Puntuación IA calculada exitosamente.');}
  }
 }
 displayedOffers(){
  const q=this.selected();
  if(!q || !q.offers)return [];
  const scored=this.scoredOffers();
  if(scored.length===0)return q.offers;
  const offersWithScores=q.offers.map((o:any)=>{
   const s=scored.find((x:any)=>x.offer_id===o.id);
   return s?{...o,score:s.score,breakdown:s.breakdown}:{...o,score:undefined};
  });
  return this.sortByScore?offersWithScores.sort((a:any,b:any)=>(b.score??-1)-(a.score??-1)):offersWithScores;
 }
 sortOffers(){/* triggers displayedOffers recompute */}
 async respond(){const q=this.selected();if(!q)return;const expiry=new Date(this.expiresAt);
  if(!this.expiresAt||!Number.isFinite(expiry.getTime())){this.message.set('Vigencia inválida: indica fecha y hora.');return;}
  const result=await this.call('quotations/'+q.id+'/responses','POST',{
  moneda:'PEN',precioIncluyeIgv:true,costoEnvio:this.shipping,diasEntrega:this.deliveryDays,vigenteHasta:expiry.toISOString(),items:this.responseItems});if(result)this.selected.set(result);}
 async accept(id:string){const q=this.selected();const r=await this.call('quotations/'+q.id+'/responses/'+id+'/accept','PATCH');if(r)this.selected.set(r);}
 async order(id:string){if(!this.keys.has(id))this.keys.set(id,crypto.randomUUID());const o=await this.call('orders','POST',{cotizacionRespuestaId:id},this.keys.get(id));
  if(o){this.currentOrder.set(o);this.catalogChanged.emit();const list=await this.call('orders');if(list)this.orders.set(list);}}
 async openOrder(id:string){const o=await this.call('orders/'+id);if(o){this.currentOrder.set(o);const attempts=await this.call('orders/'+id+'/payment-attempts');if(attempts)this.paymentAttempts.set(attempts);}}
 async startPayment(orderId:string){
  const attempt=await this.call('orders/'+orderId+'/payment-attempts','POST',{});
  if(attempt && attempt.init_point){
   this.message.set('Redirigiendo a Mercado Pago...');
   window.location.href=attempt.init_point;
  }
 }
 openCheckout(attempt:any){
  if(attempt.mp_preference_response?.init_point){
   window.location.href=attempt.mp_preference_response.init_point;
  }
 }
}
