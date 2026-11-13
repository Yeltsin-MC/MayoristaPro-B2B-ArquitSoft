import { Component, effect, output, signal, untracked, viewChild } from '@angular/core';
import { CatalogProduct } from './catalog-product';
import { minimumQuantity, packDescription, presentations, quantityError } from './wholesale-quantity';
import { FormsModule } from '@angular/forms';
import { CatalogImportComponent } from './catalog-import';
import { TradeComponent } from './trade';
@Component({
 selector:'app-identity', imports:[FormsModule, CatalogImportComponent, TradeComponent],
 template:` <section aria-label="Cuenta empresarial" class="identity">
  <div class="account-heading"><div><p class="eyebrow">TU ESPACIO EMPRESARIAL</p><h2>Cuenta empresarial</h2><p>Demo con empresas y evidencias ficticias. El alta se revisa manualmente; no se consulta SUNAT.</p></div>
   @if(token()){<div class="actions">@if(admin()){<button class="secondary" (click)="loadAdmin()">Solicitudes (administración)</button>}@else{<button class="secondary" (click)="loadAccount()">Mi empresa</button>}<button class="secondary" (click)="logout()">Salir</button></div>}
  </div>
  @if(restoring()){<p role="status" class="notice">Comprobando tu sesión…</p>} @else if(!token()) {
   <div class="auth-layout">
        @if(pendingQuote();as selection){
      <aside class="quote-selection" aria-label="Selección para cotizar"><p class="eyebrow">TU SELECCIÓN PARA COTIZAR</p><h3>{{selection.product.name}}</h3><p>{{selection.product.supplier}}</p><p>{{packDescription(selection.product)}}</p><strong>{{presentations(selection.quantity, selection.product.unit)}}</strong><p class="selection-help">Al ingresar volverás a esta solicitud.</p></aside>
    } @else {
      <aside class="auth-aside"><h3>Tu empresa,<br>mejor conectada.</h3><p>Compra y vende con una cuenta empresarial revisada manualmente.</p><ol><li>Solicita el alta de tu empresa.</li><li>Espera la aprobación de administración.</li><li>Solicita ofertas y compara proveedores.</li></ol></aside>
    }
    <div class="auth-content">
     <nav class="auth-tabs" aria-label="Acceso"><button type="button" [attr.aria-pressed]="mode==='login'" (click)="mode='login'">Ingresar</button><button type="button" [attr.aria-pressed]="mode==='register'" (click)="mode='register'">Solicitar alta</button><button type="button" [attr.aria-pressed]="mode==='accept'" (click)="mode='accept'">Aceptar invitación</button></nav>
     @if(message()){<p class="notice" [class.error]="failed()" [attr.role]="failed()?'alert':'status'" aria-live="polite">{{message()}}</p>}
     <form (ngSubmit)="submit()">
      <label>Correo<input name="email" type="email" autocomplete="username" required [(ngModel)]="email"></label>
      <label>Contraseña (12–128 caracteres)<input name="password" type="password" [attr.autocomplete]="mode==='login'?'current-password':'new-password'" required minlength="12" maxlength="128" [(ngModel)]="password"></label>
      @if(mode==='register'){
       <label>RUC (11 dígitos)<input name="ruc" pattern="[0-9]{11}" inputmode="numeric" required [(ngModel)]="ruc"></label>
       <label>Razón social<input name="legalName" required [(ngModel)]="legalName"></label>
       <label>Evidencia ficticia de representación<textarea name="evidence" required [(ngModel)]="evidence"></textarea></label>
      }
      @if(mode==='accept'){<label>Código de invitación<input name="invitation" required [(ngModel)]="invitation"></label>}
      <button [disabled]="busy()">{{busy()?'Procesando…':mode==='login'?'Ingresar':mode==='register'?'Enviar solicitud':'Aceptar invitación'}}</button>
     </form>
    </div>
   </div>
  } @else {
   @if(company()){
    <div class="company-summary"><h3>{{company().legal_name}}</h3><p>RUC {{company().ruc}} · {{company().review_label}}</p><p>Proveedor {{company().supplier_verified?'verificado · revisado manualmente':'pendiente de verificación'}}. La compra sigue habilitada con permiso de compra.</p><div class="role-tags">@for(permission of permissions();track permission){<span>{{permission==='buy'?'Comprar':permission==='publish'?'Publicar':permission==='manage'?'Gestionar usuarios':permission}}</span>}</div></div>
    @if(permissions().includes('buy') || (permissions().includes('publish') && company().supplier_verified)){
     <app-trade [token]="token()" [canBuy]="permissions().includes('buy')" [canSell]="permissions().includes('publish') && company().supplier_verified" (catalogChanged)="catalogChanged.emit()" />
    }
    @if(permissions().includes('manage')){
     <details class="management"><summary>Usuarios y accesos de mi empresa</summary>
      <form (ngSubmit)="invite()"><h3>Invitar usuario</h3><label>Correo<input name="inviteEmail" type="email" required [(ngModel)]="inviteEmail"></label><label class="check"><input name="buy" type="checkbox" [(ngModel)]="buy">Comprar</label><label class="check"><input name="publish" type="checkbox" [(ngModel)]="publish">Publicar</label><button [disabled]="busy()">Crear enlace por 24 horas</button></form>
      @if(link()){<p>Comparte este enlace con el destinatario <a [href]="link()">{{link()}}</a></p>}
      <button class="secondary" (click)="loadMembers()">Ver usuarios</button>
      @for(member of members();track member.id){<p>{{member.email}} · {{member.active?'Activo':'Revocado'}} @if(member.active && !member.permissions.includes('manage')){<button class="secondary" (click)="revoke(member.id)">Revocar acceso</button>}</p>}
     </details>
    }
    @if(permissions().includes('publish')){
     @if(company().supplier_verified){
      <app-catalog-import [token]="token()" (applied)="catalogChanged.emit()" />
      <form class="management" (ngSubmit)="publishProduct()"><h3>Publicación individual</h3><label>ID del producto propio<input name="productId" required [(ngModel)]="productId"></label><button [disabled]="busy()">Publicar producto</button></form>
     } @else {<p class="notice">La carga masiva y la publicación requieren que administración verifique primero al proveedor.</p>}
    }
   }
   @for(request of requests();track request.id){
    <article><h3>{{request.legal_name}}</h3><p>{{request.ruc}} · {{request.email}}</p><p>Evidencia {{request.evidence}}</p>
     @if(!request.approved_at){<button [disabled]="busy()" (click)="approve(request.id)">Aprobar vinculación</button>}@else{<p class="status-pill">Revisado manualmente</p><button class="secondary" [disabled]="busy()" (click)="verify(request.supplier_id)">Verificar proveedor de {{request.legal_name}}</button>}
    </article>
   }
   @if(admin()){
    <form class="management" (ngSubmit)="verify()"><label>ID del proveedor habilitado<input name="supplierId" required [(ngModel)]="supplierId"></label><button [disabled]="busy()">Verificar proveedor por separado</button></form>
   }
  }
  @if(message() && token()){<p class="notice" [class.error]="failed()" [attr.role]="failed()?'alert':'status'" aria-live="polite">{{message()}}</p>}
 </section>`
})
export class IdentityComponent {
 readonly catalogChanged = output<void>();
 private readonly trade = viewChild(TradeComponent);
 readonly pendingQuote = signal<{ product: CatalogProduct; quantity: number } | null>(null);
 readonly restoring = signal(true);
 readonly packDescription = packDescription;
 readonly presentations = presentations;
 private authVersion = 0;
 failed = signal(false);
 mode='login'; email=''; password=''; ruc=''; legalName=''; evidence=''; invitation=new URLSearchParams(location.hash.slice(1)).get('token')??'';
 inviteEmail=''; buy=true; publish=false; productId=''; supplierId='';
 token=signal(''); busy=signal(false); message=signal(''); company=signal<any>(null); permissions=signal<string[]>([]); members=signal<any[]>([]); requests=signal<any[]>([]); admin=signal(false); link=signal('');
 constructor(){
  if(this.invitation)this.mode='accept';
  void this.restoreSession();
  effect(()=>{
   const product=this.pendingQuote();
   const trade=this.trade();
   if(product && trade && this.permissions().includes('buy')){
    untracked(()=>{this.pendingQuote.set(null);void trade.beginFromCatalog(product.product, product.quantity);});
   }
  });
 }
 openQuotes(){
   if(this.trade()){this.trade()!.showQuotes();return;}
  this.failed.set(false);
  if(!this.token()){
   this.mode='login';
   this.message.set('Ingresa con tu cuenta empresarial para ver tus cotizaciones privadas.');
  }
  const target=document.getElementById('cotizaciones')??document.getElementById('cuenta');
  target?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 beginQuote(product:CatalogProduct, quantity:number|null=minimumQuantity(product)){
  const issue=quantityError(product,quantity);
  if(quantity===null || issue){this.failed.set(true);this.message.set(issue);return;}
  this.failed.set(false);
  if(this.token() && (this.admin() || !this.permissions().includes('buy'))){
   this.message.set('Tu cuenta necesita permiso de compra para solicitar cotizaciones.');
  }else{
   this.pendingQuote.set({product,quantity});
   if(!this.token()){
    this.mode='login';
    this.message.set('Ingresa con tu cuenta compradora para cotizar '+product.name+'. Conservaremos la selección.');
   }
  }
  if(!this.token())requestAnimationFrame(()=>document.querySelector('.quote-selection')?.scrollIntoView({behavior:'auto',block:'start'}));
  else if(!this.permissions().includes('buy'))document.getElementById('cuenta')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 private async call(path:string, method='GET',body?:unknown):Promise<any>{
 this.busy.set(true);
 try {
 const response=await fetch('/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(this.token()?{Authorization:'Bearer '+this.token()}: {})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok){
 if(response.status===401 || (response.status===403 && path==='auth/me'))this.clearSession();
 throw new Error(result.message??'Operación rechazada');
 }
 this.failed.set(false); this.message.set(''); return result;
 }catch(error){this.failed.set(true);this.message.set(error instanceof Error?error.message:'No se pudo conectar.');return null;}finally{this.busy.set(false);}
 }
 async submit(){
 ++this.authVersion;
 if(this.mode==='login'){const result=await this.call('auth/login','POST',{email:this.email,password:this.password});if(result){this.token.set(result.token);this.password='';await this.loadSession();}}
 else if(this.mode==='register'){const result=await this.call('auth/register','POST',{email:this.email,password:this.password,ruc:this.ruc,legalName:this.legalName,evidence:this.evidence});if(result){this.password='';this.message.set('Solicitud enviada. Espera la aprobación de administración.');}}
 else {const result=await this.call('auth/invitations/accept','POST',{email:this.email,password:this.password,token:this.invitation});if(result){this.password='';this.invitation='';history.replaceState(null,'',location.pathname);this.mode='login';this.message.set('Invitación aceptada. Ya puedes ingresar.');}}
 }
 async loadSession(){
 this.admin.set(false);this.company.set(null);this.permissions.set([]);this.requests.set([]);this.members.set([]);this.link.set('');
 const session=await this.call('auth/session');
 if(!session){this.clearSession();return;}
 this.admin.set(session.platformAdmin===true);
 if(!this.admin())await this.loadAccount();
 }
 async loadAccount(){const result=await this.call('auth/me');this.company.set(result?.company??null);this.permissions.set(result?.permissions??[]);}
 async loadAdmin(){const result=await this.call('admin/enrollments');this.requests.set(result??[]);if(!result)this.admin.set(false);}
 async approve(id:string){if(await this.call('admin/enrollments/'+id+'/approve','POST'))await this.loadAdmin();}
 async invite(){const result=await this.call('company/invitations','POST',{email:this.inviteEmail,permissions:[...(this.buy?['buy']:[]),...(this.publish?['publish']:[])]});if(result)this.link.set(location.origin+result.link);}
 async loadMembers(){const result=await this.call('company/members');if(result)this.members.set(result);}
 async revoke(id:string){if(await this.call('company/members/'+id+'/revoke','POST'))await this.loadMembers();}
 async verify(id=this.supplierId){if(await this.call('providers/'+id+'/verify','PATCH'))this.message.set('Proveedor verificado. Revisado manualmente.');}
 async publishProduct(){if(await this.call('products/'+this.productId+'/publish','POST'))this.catalogChanged.emit();}
 private clearSession(clearSelection=true){
 this.token.set('');this.company.set(null);this.requests.set([]);this.members.set([]);this.admin.set(false);this.link.set('');this.permissions.set([]);this.password='';
 if(clearSelection)this.pendingQuote.set(null);
 }
 private async restoreSession(){
  const version=++this.authVersion;
  try{
   const response=await fetch('/api/v1/auth/restore',{credentials:'same-origin',cache:'no-store'});
   if(version!==this.authVersion)return;
   if(!response.ok){
    this.clearSession(false);
    if(response.status!==401 && response.status!==403)this.message.set('No pudimos comprobar tu sesión. Ingresa de nuevo.');
    return;
   }
   const session=await response.json();
   if(version!==this.authVersion)return;
   this.admin.set(session.platformAdmin===true);
   this.company.set(session.company??null);
   this.permissions.set(session.permissions??[]);
   this.token.set(session.token);
   if(location.hash==='#cuenta' || location.hash==='#cotizaciones')requestAnimationFrame(()=>document.querySelector(location.hash)?.scrollIntoView({block:'start'}));
  }catch{
   if(version===this.authVersion){this.clearSession(false);this.message.set('No pudimos comprobar tu sesión. Ingresa de nuevo.');}
  }finally{if(version===this.authVersion)this.restoring.set(false);}
 }
 async logout(){
  ++this.authVersion;
  const result=await this.call('auth/logout','POST');
  if(result?.loggedOut){this.clearSession();this.message.set('Sesión cerrada.');}
 }
}
