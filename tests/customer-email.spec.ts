import {test,expect} from '@playwright/test'
async function finish(page: import('@playwright/test').Page) {
 await page.route('**/api/quote',r=>r.request().method()==='GET'?r.fulfill({json:{enabled:true}}):r.abort())
 await page.goto('/')
 await page.getByRole('button',{name:'Try a sample'}).click()
 await page.getByRole('button',{name:'Looks good — choose finish'}).click()
}
test('free downloads and design-only email with labeled before/after and retry',async({page})=>{
 await finish(page)
 const bodies: Record<string,string>[]=[];const keys:string[]=[]
 await page.route('**/api/email-design',r=>{bodies.push(r.request().postDataJSON());keys.push(r.request().headers()['idempotency-key']);return r.fulfill(bodies.length===1?{status:502,json:{error:'Please retry design email'}}:{json:{ok:true,emailId:'design-id'}})})
 await page.getByRole('button',{name:'Save / Share'}).click()
 await expect(page.getByRole('button',{name:'Finished floor',exact:true})).toBeEnabled()
 await expect(page.getByRole('button',{name:'Before & after',exact:true})).toBeEnabled()
 await page.getByLabel('Design email',{exact:true}).fill('design@example.com')
 await page.getByRole('button',{name:'Email my design'}).click()
 await expect(page.getByRole('status')).toContainText('Please retry')
 await page.getByRole('button',{name:'Email my design'}).click()
 await expect(page.getByRole('status')).toContainText('No estimate request was created')
 expect(keys[0]).toBe(keys[1]);expect(bodies[0].customerName).toBeUndefined()
 const dimensions=await page.evaluate(async b=>{
  const a=new Image();a.src=b.imageDataUrl;await a.decode();const c=new Image();c.src=b.comparisonDataUrl;await c.decode();return {aw:a.width,ah:a.height,cw:c.width,ch:c.height}
 },bodies[0])
 expect(dimensions.cw).toBe(dimensions.aw*2);expect(dimensions.ch).toBe(dimensions.ah+40)
 await page.getByRole('button',{name:'Close save options'}).click()
 await expect(page.getByRole('button',{name:'Get estimate',exact:true})).toBeVisible()
})
test('phone estimate optional email and partial confirmation retry preserve request ID',async({page})=>{
 await finish(page)
 let posts=0;const keys:string[]=[]
 await page.route('**/api/quote',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{enabled:true}})
  posts++;keys.push(r.request().headers()['idempotency-key']);const b=r.request().postDataJSON();expect(b.email).toBe('copy@example.com');expect(b.phone).toBe('7175550100');expect(b.comparisonDataUrl).toMatch(/^data:image\/jpeg/)
  return r.fulfill({json:{ok:true,leadId:'reference-test',customerEmailStatus:posts===1?'failed':'queued'}})
 })
 await page.getByRole('button',{name:'Get estimate',exact:true}).click()
 await page.getByLabel('Name',{exact:true}).fill('Test Customer')
 await page.getByLabel('Phone',{exact:true}).fill('7175550100')
 await page.getByLabel('Email for your design (optional)').fill('copy@example.com')
 await page.getByLabel('ZIP code').fill('17601')
 await page.getByRole('button',{name:'Send estimate request'}).click()
 await expect(page.getByRole('status')).toContainText('estimate was submitted')
 await page.getByRole('button',{name:'Retry confirmation email'}).click()
 await expect(page.getByRole('status')).toContainText('confirmation with your floor design is queued')
 expect(keys[0]).toBe(keys[1])
})
