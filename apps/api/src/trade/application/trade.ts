import {identifier,offerDraft,requestDraft,rule,RequestDraft,OfferDraft} from '../domain/trade';
export interface TradeStore {
  providers(auth?:string):Promise<unknown>; products(auth?:string):Promise<unknown>;
  create(input:RequestDraft,auth?:string):Promise<unknown>;
  requests(auth?:string):Promise<unknown>; detail(id:string,auth?:string):Promise<unknown>;
  respond(id:string,input:OfferDraft,auth?:string):Promise<unknown>;
  accept(id:string,offer:string,auth?:string):Promise<unknown>;
  order(offer:string,key:string,auth?:string):Promise<unknown>;
  orders(auth?:string):Promise<unknown>; orderDetail(id:string,auth?:string):Promise<unknown>;
}
export const TRADE_STORE=Symbol('TradeStore');
export class Trade {
 constructor(private readonly store:TradeStore){}
 providers(auth?:string){return this.store.providers(auth);}
 products(auth?:string){return this.store.products(auth);}
 create(body:unknown,auth?:string){return this.store.create(requestDraft(body),auth);}
 requests(auth?:string){return this.store.requests(auth);}
 detail(id:string,auth?:string){return this.store.detail(identifier(id),auth);}
 respond(id:string,body:unknown,auth?:string){return this.store.respond(identifier(id),offerDraft(body),auth);}
 accept(id:string,offer:string,auth?:string){return this.store.accept(identifier(id),identifier(offer),auth);}
 order(body:any,key:unknown,auth?:string){
   rule(typeof key==='string'&&/^[A-Za-z0-9._-]{1,128}$/.test(key),'INVALID_INPUT','Idempotency-Key requerido (1–128 caracteres).');
   return this.store.order(identifier(body?.cotizacionRespuestaId),key,auth);
 }
 orders(auth?:string){return this.store.orders(auth);}
 orderDetail(id:string,auth?:string){return this.store.orderDetail(identifier(id),auth);}
}
