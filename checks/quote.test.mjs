import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/quote.ts'
const body = { customerName:'Test', phone:'7175550100', email:'', zip:'17601', address:'', squareFeet:'', notes:'', selectedSolid:'Grey', selectedFlake:'Orbit', sheen:'gloss', chipSize:1, imageDataUrl:'data:image/jpeg;base64,YQ==' }
async function call(method='POST', data=body) {
 const res = {code:0, setHeader(){}, status(n){this.code=n;return this}, json(value){this.value=value;return this}}
 await handler({method, body:data, headers:{'idempotency-key':'12345678-1234-1234-1234-123456789abc'}},res)
 return res
}
test('estimate sending fails closed and validates provider acceptance', async () => {
 const originalFetch=globalThis.fetch
 try {
  delete process.env.RESEND_API_KEY;delete process.env.UNUSED_TEST_TOKEN
  assert.equal((await call()).code,503)
  assert.equal((await call('GET')).value.enabled,false)
  process.env.RESEND_API_KEY='test-key';process.env.UNUSED_TEST_TOKEN='test'
  assert.equal((await call('GET')).value.enabled,true)
  assert.equal((await call('POST',{...body,zip:'bad'})).code,400)
  globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true})})
  assert.equal((await call()).code,502)
  globalThis.fetch=async()=>{throw new Error('timeout')}
  assert.equal((await call()).code,502)
  globalThis.fetch=async(_url,opts)=>{assert.equal(opts.headers['Idempotency-Key'],'12345678-1234-1234-1234-123456789abc');return {ok:true,json:async()=>({id:'test-123'})}}
  assert.equal((await call()).value.emailId,'test-123')
 } finally {globalThis.fetch=originalFetch;delete process.env.RESEND_API_KEY;delete process.env.UNUSED_TEST_TOKEN}
})
