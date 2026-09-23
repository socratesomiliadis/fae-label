// Run against an authenticated Playwright APIRequestContext. No credentials are saved.
// Creates visibly fictional fixtures, exports PDFs, then archives only those fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function runCertificateQa(api, playwright, directory) {
  await fs.mkdir(directory,{recursive:true});
  const created=[], results=[];
  const stamp=Date.now().toString();
  async function post(url,data) { const response=await api.post(url,{data}); if(!response.ok())throw Error(`${url}: ${response.status()} ${await response.text()}`); return response.json(); }
  async function record(kind,key,data) {const row=await post(`/api/records/${kind}`,{key:`QA-${stamp}-${key}`,data});created.push(row);return row;}
  async function preview(name,url,request) {
    const response=await post(url,request);
    for(const [suffix,link] of [['pdf',response.pdfUrl],['png',response.imageUrl]]) {const file=await api.get(link);if(!file.ok())throw Error(link);await fs.writeFile(path.join(directory,`${name}.${suffix}`),await file.body());}
    results.push({name,request,...response});
  }
  const browser=await playwright.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const customerData={name:'QA DEMO Northstar Foods',tradeName:'NORTHSTAR QA',address:'10 Fictional Avenue',city:'Sofia',country:'Bulgaria',postalCode:'00000',vat:'QA-NOT-A-VALID-VAT',phone:'+000 000 000',email:'qa@example.invalid',complete:true};
    const customer=await record('certificate-customer','certificate-customer',customerData);
    const labelCustomer=await record('customer','customer',customerData);
    const products=await(await api.get('/api/records/product')).json();
    const fresh=products.find(p=>p.key==='100'), frozen=products.find(p=>p.data.erpCode==='3-106-1-002')??products.find(p=>p.data.frozen);
    const line=(product,index=0)=>({productId:product.id,weight:50+index,cartons:10,lot:`QA-${product.key}-${index+1}`,productionDate:'2026-09-23',expiryDate:product.data.frozen?'2027-09-23':'2026-09-26',freezeDate:product.data.frozen?'2026-09-23':null});
    const certificate={name:'QA SAMPLE - NOT FOR SHIPMENT',customerId:customer.id,vehicle:'QA-TRUCK',trailer:'QA-TRAILER',shipmentDate:'2026-09-23',notes:'FICTIONAL QA SAMPLE - NOT FOR SHIPMENT'};
    await preview('certificate-conformance','/api/certificates/preview',{...certificate,templateKey:'certificate-conformance',languages:['en'],lines:[line(fresh),line(frozen)]});
    await preview('certificate-conformance-30-lines','/api/certificates/preview',{...certificate,templateKey:'certificate-conformance',languages:['en'],lines:Array.from({length:30},(_,i)=>line(i%2?fresh:frozen,i))});
    await preview('certificate-bg-fresh-and-frozen','/api/certificates/preview',{...certificate,templateKey:'certificate-bg',languages:['bg'],lines:[line(fresh),line(frozen)]});
    const page=await browser.newPage({viewport:{width:600,height:200},deviceScaleFactor:1});
    for(const [index,name,color] of [[1,'NORTHSTAR QA','#164e63'],[2,'HELIOS QA','#9a3412']]) {
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:white;font-family:Arial}.logo{height:200px;display:flex;align-items:center;padding:24px;gap:24px;color:${color}}.mark{width:110px;height:110px;background:${color};border-radius:${index===1?'50%':'16px'};color:white;text-align:center;line-height:110px;font-size:40px;font-weight:bold}b{font-size:38px}small{display:block;font-size:20px;margin-top:8px}</style><div class="logo"><div class="mark">${index===1?'N':'H'}</div><div><b>${name}</b><small>FICTIONAL TEST BRAND</small></div></div>`);
      const logo=await page.screenshot();await fs.writeFile(path.join(directory,`logo-${index}.png`),logo);
      const upload=await api.post('/api/assets',{multipart:{file:{name:`qa-logo-${index}.png`,mimeType:'image/png',buffer:logo}}});if(!upload.ok())throw Error(await upload.text());
      const {hash}=await upload.json();
      const brand=await record('brand',`brand-${index}`,{name,logoAsset:hash,complete:true,texts:{el:`${name} · ΔΟΚΙΜΑΣΤΙΚΑ ΣΤΟΙΧΕΙΑ`,en:`${name} · 10 Fictional Avenue · qa@example.invalid`},manufacturer:{el:'ΠΑΡΑΓΕΤΑΙ ΓΙΑ QA DEMO',en:'Produced for QA DEMO'},origins:{el:'ΕΕ - ΔΟΚΙΜΗ',en:'EU - QA ONLY'}});
      const product=await record('product',`product-${index}`,{...fresh.data,brands:[brand.key],daily:false,active:true});
      const production={productId:product.id,brandKey:brand.key,customerId:labelCustomer.id,productionDate:'2026-09-23',shelfLife:3,weight:5,cartonWeight:10,pieces:2,palletWeight:500,mode:'product'};
      await preview(`private-label-${index}-large`,'/api/preview',{...production,templateKey:'thermal-large',languages:['el','en']});
      await preview(`private-label-${index}-small`,'/api/preview',{...production,templateKey:'thermal-small',languages:['el']});
      await preview(`private-label-${index}-custom`,'/api/preview',{...production,templateKey:'custom-large',languages:['el'],freeText:`${name}\nQA DEMO Northstar Foods\n10 Fictional Avenue, Sofia\nFICTIONAL QA SAMPLE`});
    }
    await preview('private-label-customer-address','/api/preview',{templateKey:'address-small',customerId:labelCustomer.id,brandKey:'1',languages:['el'],mode:'product'});
  } finally {
    await browser.close();
    const cleanup=[];
    for(const row of created.reverse()){const response=await api.delete(`/api/records/${row.id}?version=${row.version}`);cleanup.push({kind:row.kind,key:row.key,archived:response.ok()});}
    await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify({fictional:true,results,cleanup},null,2));
  }
  return results.map(r=>({name:r.name,pages:r.pageCount,issues:r.issues}));
}
