const {test}=require('node:test');const assert=require('node:assert/strict');
const {priceTotal,money,offerDraft}=require('../apps/api/dist/trade/domain/trade');
test('T4-AC09: aritmética exacta, envío final y validación fiscal de demo',()=>{
 assert.deepEqual(priceTotal([{quantity:3,unitPrice:'0.10'}],'0.00'),{subtotal:'0.30',shipping:'0.00',total:'0.30'});
 assert.deepEqual(priceTotal([{quantity:2,unitPrice:'48.00'}],'8.00'),{subtotal:'96.00',shipping:'8.00',total:'104.00'});
 assert.equal(priceTotal([{quantity:2,unitPrice:'48.00'}],'0.00').total,'96.00');
 for(const value of ['0.105','-1','1e2','NaN',0.1,''])assert.throws(()=>money(value));
 assert.throws(()=>offerDraft({moneda:'PEN',precioIncluyeIgv:false}));
});
