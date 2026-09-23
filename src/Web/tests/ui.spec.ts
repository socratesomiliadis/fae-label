import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('../Api/wwwroot');
const product={id:'b0fe1200-32de-42b6-9018-a01652639333',kind:'product',key:'1',version:1,updatedAt:'2026-09-23',data:{erpCode:'1-109-1-000',secondaryCode:'A',names:{el:'ΧΟΙΡΙΝΗ ΣΚΕΠΗ, ΚΤΨ',en:'PORK RIND, FROZEN'},recipeCode:'0001',brands:['1'],active:true,daily:true,dailyOrder:1,shelfLife:365,frozen:true}};
const template={id:'12b83fca-59ca-4ed5-8f01-d05003eacbfa',kind:'template',key:'thermal-large',version:1,data:{name:'Μεγάλη δίγλωσση ετικέτα',family:'thermal',profile:'large',widthMm:148,heightMm:100,validated:false}};
test.beforeEach(async({page})=>{
 await page.route('http://faethon.test/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  const values:Record<string,unknown>={'/api/me':{name:'Socrates',role:'admin'},'/api/dashboard':{products:779,recipes:172,queued:0,attention:0,recent:[]},'/api/records/product':[product],'/api/records/recipe':[], '/api/records/template':[template],'/api/records/brand':[{id:'brand',key:'1',data:{name:'ΦΑΕΘΩΝ'}}],'/api/records/language':[{id:'el',key:'el',data:{name:'Ελληνικά'}},{id:'en',key:'en',data:{name:'English'}}],'/api/records/printer':[], '/api/records/customer':[], '/api/records/draft':[],'/api/jobs':[]};
  if(pathname.startsWith('/api/')){return route.fulfill({contentType:'application/json',body:JSON.stringify(values[pathname]??[])});}
  const file=pathname==='/'?path.join(root,'index.html'):path.join(root,pathname);if(!file.startsWith(root))return route.abort();
  return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
 });
 await page.goto('http://faethon.test/');
});
test('Greek workspace, search and print preparation work without a dev server',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.getByRole('heading',{name:'Όλα στη θέση τους.'})).toBeVisible();
 await expect(page.getByText('779',{exact:true})).toBeVisible();
 await page.screenshot({path:'../../artifacts/ui-dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Προϊόντα',exact:true}).click();
 await page.getByPlaceholder('Αναζήτηση με περιγραφή ή κωδικό…').fill('1-109');
 await expect(page.getByText('ΧΟΙΡΙΝΗ ΣΚΕΠΗ, ΚΤΨ',{exact:true})).toBeVisible();
 await page.getByTitle('Έκδοση ετικέτας').click();
 await expect(page.getByRole('heading',{name:'Η επόμενη ετικέτα σας.'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Προϊόν',exact:true})).toHaveValue(product.id);
 await expect(page.getByRole('button',{name:'Αποστολή για εκτύπωση'})).toBeDisabled();
 await page.screenshot({path:'../../artifacts/ui-production.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('template catalog makes shared layouts and validation visible',async({page})=>{
 await page.getByRole('button',{name:'Πρότυπα',exact:true}).click();
 await expect(page.getByText('Μεγάλη δίγλωσση ετικέτα',{exact:true})).toBeVisible();
 await expect(page.getByText('Προς επικύρωση',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Επεξεργασία',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Κλείσιμο',exact:true}).last().click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
});
