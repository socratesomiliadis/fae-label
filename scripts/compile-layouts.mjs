import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'legacy/definitions');
const coverage=JSON.parse(fs.readFileSync(path.join(root,'legacy/coverage.json'),'utf8').replace(/^\uFEFF/,''));
const langMap={GR:'el',EN:'en',GE:'de',BG:'bg',RO:'ro',FR:'fr',IT:'it',ES:'es',PL:'pl',HL:'nl',PO:'pt',CH:'cs',SW:'sv',HU:'hu',CR:'hr',AL:'sq'};
function parse(name){
 const bytes=fs.readFileSync(path.join(dir,name+'.txt'));const text=bytes.toString(bytes[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,'');
 const root={type:'Root',props:{},children:[]};const stack=[root];let lastProp='';
 for(const line of text.split(/\r?\n/)){
  const s=line.trim();const parent=()=>stack.at(-1);
  if(/^Begin(?: |$)/.test(s)){const n={type:s.slice(6)||'Group',props:{},children:[]};parent().children.push(n);stack.push(n);lastProp='';}
  else if(/^\w+ = Begin$/.test(s)){const n={type:'Binary',props:{key:s.split(' ')[0]},children:[]};parent().children.push(n);stack.push(n);lastProp='';}
  else if(s==='End'){if(stack.length>1)stack.pop();lastProp='';}
  else if(parent().type!=='Binary'){
   const m=s.match(/^(\w+) =(.+)$/);if(m){lastProp=m[1];parent().props[lastProp]=m[2].startsWith('"')?m[2].slice(1,-1).replace(/""/g,'"'):isNaN(Number(m[2]))?m[2]:Number(m[2]);}
   else if(s.startsWith('"')&&lastProp){parent().props[lastProp]+=s.slice(1,-1).replace(/""/g,'"');}
  }
 }
 const report=root.children.find(n=>n.type==='Report');if(!report)throw Error(name);
 const defaults={};const controls=[];const sections=[];
 function walk(node,inSection=false){if(['PageHeader','PageFooter','Section','GroupHeader','GroupFooter'].includes(node.type)){inSection=true;sections.push(node.props)}if(['TextBox','Label','Line','Rectangle','OptionGroup','Image','BoundObjectFrame','UnboundObjectFrame','Subform'].includes(node.type)){if(inSection&&node.props.Name){controls.push({...defaults[node.type],...node.props,type:node.type})}else if(!inSection)defaults[node.type]=node.props;}for(const child of node.children)walk(child,inSection);}
 walk(report);
 return {name,widthMm:(report.props.Width||0)*25.4/1440,heightMm:Math.max(...sections.map(s=>s.Height||0))*25.4/1440,controls};
}
const all=coverage.map(c=>({...c,layout:parse(c.report)}));
const baseReports={
 'thermal-large':'MEGALH_ETIKETA_FAETHON_GR_EN',
 'thermal-large:carton':'MEGALH_ETIKETA_FAETHON_GR_EN_KIBOTIO',
 'thermal-small':'MIKRH_ETIKETA_FAETHON_GR',
 'pallet-a4':'ETIKETA_PALETA_A4_FAETHON_GR_EN',
 'sample-small':'DEIGMA_ETIKETA_GR',
 'custom-small':'CUSTOM_ETIKETA_MIKRH_LOGO',
 'custom-large':'CUSTOM_MEGALH_ETIKETA_LOGO',
 'address-small':'ETIKETES_PELATES',
 'production-small':'ETIKETES_KENES_PROS_PARAGOGH',
 'butcher-small':'TABELAKIA_EIDON_KREOPOLEIOY',
 'certificate-bg':'PISTOPOIHTIKA_BG',
 'certificate-conformance':'CERTIFICATE_OF_CONFORMANCE_FULL'
};
const assets=fs.readdirSync(path.join(root,'legacy/assets')).map(file=>{const bytes=fs.readFileSync(path.join(root,'legacy/assets',file));return{file,name:file.replace(/^\d+_/,'').replace(/\.[^.]+$/,''),hash:crypto.createHash('sha256').update(bytes).digest('hex')}});
const resources={};const layouts={};
for(const [key,report] of Object.entries(baseReports)){
 const entry=all.find(r=>r.report===report);const controls=entry.layout.controls;
 const sourceLangs=entry.languages;
 layouts[key]={source:report,widthMm:entry.layout.widthMm,heightMm:entry.layout.heightMm,nodes:controls.map((c,index)=>{
  let binding=c.ControlSource||'';let slot=0;const suffix=binding.match(/_(GR|EN|GE|BG|RO|FR|IT|ES|PL|HL|PO|CH|SW|HU|CR|AL)$/)?.[1];if(suffix){slot=Math.max(0,sourceLangs.indexOf(langMap[suffix]));binding=binding.replace(/_[A-Z]{2}$/,'_{lang}');}
  const captionKey=`${key}:${index}`;if(c.Caption!==undefined){for(const lang of sourceLangs){resources[lang]??={};resources[lang][captionKey]=c.Caption;}}
  const picture=assets.find(a=>a.name===c.Picture)||assets.find(a=>a.name.toLowerCase()===String(c.Picture||'').toLowerCase());
  return {type:c.type,name:c.Name,x:(c.Left||0)*25.4/1440,y:(c.Top||0)*25.4/1440,width:(c.Width||0)*25.4/1440,height:(c.Height||0)*25.4/1440,font:c.FontName||'Calibri',fontSize:c.FontSize||6,bold:(c.FontWeight||400)>=700,italic:c.FontItalic==='NotDefault',align:c.TextAlign||1,binding,slot,captionKey:c.Caption!==undefined?captionKey:'',image:picture?.hash||'',imageName:c.Picture||'',visible:c.Visible!=='NotDefault'&&c.Visible!==0,background:c.BackStyle===1?(c.BackColor??16777215):null,foreground:c.ForeColor??0,border:c.BorderStyle!==0&&c.BorderStyle!==undefined,rich:c.TextFormat===1};
 })};
 // Small-label translations use the same source control identity, not copied layouts.
 if(key==='thermal-small')for(const lang of Object.keys(langMap)){
  const variant=all.find(r=>r.report===`MIKRH_ETIKETA_FAETHON_${lang}`);if(!variant)continue;resources[langMap[lang]]??={};
  controls.forEach((c,index)=>{if(c.Caption===undefined)return;const match=variant.layout.controls.find(n=>n.Name===c.Name&&n.type===c.type);if(match?.Caption!==undefined)resources[langMap[lang]][`${key}:${index}`]=match.Caption;});
 }
}
fs.mkdirSync(path.join(root,'src/Api/Templates'),{recursive:true});
fs.writeFileSync(path.join(root,'src/Api/Templates/layouts.json'),JSON.stringify(layouts,null,2));
fs.writeFileSync(path.join(root,'src/Api/Templates/captions.json'),JSON.stringify(resources,null,2));
fs.writeFileSync(path.join(root,'legacy/asset-manifest.json'),JSON.stringify(assets,null,2));
fs.writeFileSync(path.join(root,'legacy/control-inventory.json'),JSON.stringify(all.map(e=>({report:e.report,widthMm:e.layout.widthMm,heightMm:e.layout.heightMm,controls:e.layout.controls.length,sources:e.layout.controls.filter(c=>c.ControlSource).map(c=>c.ControlSource)})),null,2));
console.log(`Compiled ${Object.keys(layouts).length} shared geometry profiles from ${all.length} fresh reports; ${assets.length} fresh assets.`);
