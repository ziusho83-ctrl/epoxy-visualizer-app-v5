import test from 'node:test'
import assert from 'node:assert/strict'
import quote from '../api/quote.ts'
import design from '../api/email-design.ts'
const image='data:image/jpeg;base64,/9j/AA=='
const body={customerName:'Test',phone:'7175550100',email:'customer@example.com',zip:'17601',address:'',squareFeet:'',notes:'owner-only note',selectedSolid:'Grey',selectedFlake:'Orbit',sheen:'gloss',chipSize:1,imageDataUrl:image,comparisonDataUrl:image}
const key='12345678-1234-1234-1234-123456789abc'
async function call(handler,b=body){const r={code:0,setHeader(){},status(n){this.code=n;return this},json(j){this.value=j;return this}};await handler({method:'POST',body:b,headers:{'idempotency-key':key}},r);return r}
test('customer paths: design only, estimate owner+copy, partial failure and safe retry',async()=>{
 const fetch0=globalThis.fetch;process.env.RESEND_API_KEY='test'
 const calls=[];let failCustomer=false
 globalThis.fetch=async(_url,opts)=>{const b=JSON.parse(opts.body);calls.push({key:opts.headers['Idempotency-Key'],b});if(failCustomer&&b.to[0]==='customer@example.com')throw Error('timeout');return {ok:true,json:async()=>({id:b.to[0]==='customer@example.com'?'customer-id':'owner-id'})}}
 try {
  const d=await call(design);assert.equal(d.code,200);assert.equal(calls.length,1);assert.deepEqual(calls[0].b.to,['customer@example.com']);assert.equal(calls[0].b.attachments.length,2);assert.match(calls[0].b.text,/not an estimate request/);assert.ok(!calls[0].b.text.includes('owner-only note'))
  calls.length=0;let r=await call(quote);assert.equal(r.value.customerEmailStatus,'queued');assert.equal(calls.length,2);assert.notEqual(calls[0].key,calls[1].key)
  calls.length=0;failCustomer=true;r=await call(quote);assert.equal(r.code,200);assert.equal(r.value.ok,true);assert.equal(r.value.customerEmailStatus,'failed');const ownerKey=calls[0].key
  calls.length=0;failCustomer=false;r=await call(quote);assert.equal(r.value.customerEmailStatus,'queued');assert.equal(calls[0].key,ownerKey)
  calls.length=0;r=await call(quote,{...body,email:''});assert.equal(r.value.customerEmailStatus,'not_requested');assert.equal(calls.length,1)
  calls.length=0;assert.equal((await call(design,{...body,email:'bad'})).code,400);assert.equal((await call(design,{...body,comparisonDataUrl:'bad'})).code,400);assert.equal((await call(quote,{...body,email:'bad'})).code,400);assert.equal(calls.length,0)
 }finally{globalThis.fetch=fetch0;delete process.env.RESEND_API_KEY}
})
