import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogImportComponent } from './catalog-import';
@Component({
 selector:'app-identity', imports:[FormsModule, CatalogImportComponent],
 template:`
 <section aria-label="Cuenta empresarial" class="identity">
 <h2>Cuenta empresarial</h2>
 <p>Demo con empresas y evidencias ficticias. El alta se revisa manualmente; no se consulta SUNAT.</p>
 <nav aria-label="Acceso"><button (click)="mode='login'">Ingresar</button> <button (click)="mode='register'">Solicitar alta</button> <button (click)="mode='accept'">Aceptar invitación</button></nav>
 @if (!token()) {
 <form (ngSubmit)="submit()">
 <label>Correo <input name="email" type="email" required [(ngModel)]="email"></label>
 <label>Contraseña (12–128 caracteres) <input name="password" type="password" required minlength="12" maxlength="128" [(ngModel)]="password"></label>
 @if(mode==='register') {
 <label>RUC (11 dígitos) <input name="ruc" pattern="[0-9]{11}" required [(ngModel)]="ruc"></label>
 <label>Razón social <input name="legalName" required [(ngModel)]="legalName"></label>
 <label>Evidencia ficticia de representación <textarea name="evidence" required [(ngModel)]="evidence"></textarea></label>
 }
 @if(mode==='accept') { <label>Código de invitación <input name="invitation" required [(ngModel)]="invitation"></label> }
 <button [disabled]="busy()">{{mode==='login'?'Ingresar':mode==='register'?'Enviar solicitud':'Aceptar invitación'}}</button>
 </form>
 } @else {
 <button (click)="loadAccount()">Mi empresa</button> <button (click)="loadAdmin()">Solicitudes (administración)</button> <button (click)="logout()">Salir</button>
 @if(company()) {
 <h3>{{company().legal_name}}</h3><p>RUC {{company().ruc}} · {{company().review_label}}</p>
 <p>Permisos: {{permissions().join(', ')}}.</p>
 <p>Proveedor: {{company().supplier_verified ? 'verificado · revisado manualmente' : 'pendiente de verificación'}}. La compra sigue habilitada con permiso de compra.</p>
 @if(permissions().includes('manage')) {
 <form (ngSubmit)="invite()"><h3>Invitar usuario</h3>
 <label>Correo <input name="inviteEmail" type="email" required [(ngModel)]="inviteEmail"></label>
 <label><input name="buy" type="checkbox" [(ngModel)]="buy"> Comprar</label>
 <label><input name="publish" type="checkbox" [(ngModel)]="publish"> Publicar</label>
 <button [disabled]="busy()">Crear enlace por 24 horas</button></form>
 @if(link()) { <p>Comparte este enlace con el destinatario: <a [href]="link()">{{link()}}</a></p> }
 <button (click)="loadMembers()">Ver usuarios</button>
 @for(member of members();track member.id) {<p>{{member.email}} · {{member.active?'Activo':'Revocado'}} @if(member.active && !member.permissions.includes('manage')) {<button (click)="revoke(member.id)">Revocar acceso</button>}</p>}
 }
 @if(permissions().includes('publish')) {
 @if(company().supplier_verified) { <app-catalog-import [token]="token()" (applied)="catalogChanged.emit()" /> }
 @else { <p>La carga masiva requiere que administración verifique primero al proveedor.</p> }
 <form (ngSubmit)="publishProduct()"><label>ID del producto propio <input name="productId" required [(ngModel)]="productId"></label><button [disabled]="busy()">Publicar producto</button></form>
 }
 }
 @for(request of requests();track request.id) {
 <article><h3>{{request.legal_name}}</h3><p>{{request.ruc}} · {{request.email}}</p><p>Evidencia: {{request.evidence}}</p><p>ID del proveedor: {{request.supplier_id}}</p>
 @if(!request.approved_at) {<button (click)="approve(request.id)">Aprobar vinculación</button>} @else {<p>Revisado manualmente</p>}
 </article>
 }
 @if(admin()) {
 <form (ngSubmit)="verify()"><label>ID del proveedor habilitado <input name="supplierId" required [(ngModel)]="supplierId"></label><button [disabled]="busy()">Verificar proveedor por separado</button></form>
 }
 }
 <p role="status">{{message()}}</p>
 </section>`,
 styles:[`.identity {margin:2rem 0;padding:1rem;border:1px solid #ccc} form {display:grid;gap:.7rem;max-width:36rem;margin:1rem 0} label {display:grid;gap:.25rem} input,textarea,button {font:inherit;padding:.5rem} nav {display:flex;gap:.5rem;flex-wrap:wrap} p,a {overflow-wrap:anywhere}`]
})
export class IdentityComponent {
 readonly catalogChanged = output<void>();
 mode='login'; email=''; password=''; ruc=''; legalName=''; evidence=''; invitation=new URLSearchParams(location.hash.slice(1)).get('token')??'';
 inviteEmail=''; buy=true; publish=false; productId=''; supplierId='';
 token=signal(''); busy=signal(false); message=signal(''); company=signal<any>(null); permissions=signal<string[]>([]); members=signal<any[]>([]); requests=signal<any[]>([]); admin=signal(false); link=signal('');
 constructor(){if(this.invitation)this.mode='accept';}
 private async call(path:string, method='GET',body?:unknown):Promise<any>{
 this.busy.set(true);
 try {
 const response=await fetch('/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(this.token()?{Authorization:'Bearer '+this.token()}: {})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok) throw new Error(result.message??'Operación rechazada');
 this.message.set('Operación completada.'); return result;
 }catch(error){this.message.set(error instanceof Error?error.message:'No se pudo conectar.');return null;}finally{this.busy.set(false);}
 }
 async submit(){
 if(this.mode==='login'){const result=await this.call('auth/login','POST',{email:this.email,password:this.password});if(result){this.token.set(result.token);this.password='';await this.loadAccount();}}
 else if(this.mode==='register'){const result=await this.call('auth/register','POST',{email:this.email,password:this.password,ruc:this.ruc,legalName:this.legalName,evidence:this.evidence});if(result){this.password='';this.message.set('Solicitud enviada. Espera la aprobación de administración.');}}
 else {const result=await this.call('auth/invitations/accept','POST',{email:this.email,password:this.password,token:this.invitation});if(result){this.password='';this.invitation='';history.replaceState(null,'',location.pathname);this.mode='login';this.message.set('Invitación aceptada. Ya puedes ingresar.');}}
 }
 async loadAccount(){const result=await this.call('auth/me');this.company.set(result?.company??null);this.permissions.set(result?.permissions??[]);}
 async loadAdmin(){const result=await this.call('admin/enrollments');if(result){this.admin.set(true);this.requests.set(result);}}
 async approve(id:string){if(await this.call('admin/enrollments/'+id+'/approve','POST'))await this.loadAdmin();}
 async invite(){const result=await this.call('company/invitations','POST',{email:this.inviteEmail,permissions:[...(this.buy?['buy']:[]),...(this.publish?['publish']:[])]});if(result)this.link.set(location.origin+result.link);}
 async loadMembers(){const result=await this.call('company/members');if(result)this.members.set(result);}
 async revoke(id:string){if(await this.call('company/members/'+id+'/revoke','POST'))await this.loadMembers();}
 async verify(){await this.call('providers/'+this.supplierId+'/verify','PATCH');}
 async publishProduct(){await this.call('products/'+this.productId+'/publish','POST');}
 async logout(){await this.call('auth/logout','POST');this.token.set('');this.company.set(null);this.requests.set([]);this.members.set([]);this.admin.set(false);this.link.set('');}
}
