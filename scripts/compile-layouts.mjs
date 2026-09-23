import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { adjustLegacyLayout } from './legacy-layout-adjustments.mjs';
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
   const m=s.match(/^(\w+) =(.+)$/);if(m){lastProp=m[1];const value=m[2].trim();parent().props[lastProp]=value.startsWith('"')?value.slice(1,-1).replace(/""/g,'"'):isNaN(Number(value))?value:Number(value);}
   else if(s.startsWith('"')&&lastProp){parent().props[lastProp]+=s.slice(1,-1).replace(/""/g,'"');}
  }
 }
 const report=root.children.find(n=>n.type==='Report');if(!report)throw Error(name);
 const defaults={};const controls=[];const sections=[];
 function walk(node,section=''){if(['PageHeader','PageFooter','Section','GroupHeader','GroupFooter','ReportHeader','ReportFooter','FormHeader','FormFooter','BreakHeader','BreakFooter'].includes(node.type)){section=node.type;sections.push({type:section,...node.props})}if(['TextBox','Label','Line','Rectangle','OptionGroup','Image','BoundObjectFrame','UnboundObjectFrame','Subform','PageBreak'].includes(node.type)){if(section&&node.props.Name){controls.push({...defaults[node.type],...node.props,type:node.type,section})}else if(!section)defaults[node.type]=node.props;}for(const child of node.children)walk(child,section);}
 walk(report);
 return {name,conditions: eventConditions(text),widthMm:(report.props.Width||0)*25.4/1440,heightMm:Math.max(...sections.map(s=>s.Height||0))*25.4/1440,controls,sections:sections.map(s=>({type:s.type,heightMm:(s.Height||0)*25.4/1440})),recordSource:report.props.RecordSource};
}
// Access exports VBA identifiers through a legacy code page in some reports.
function eventConditions(text) {
 const result={};
 const decode=name=>/[À-ÿ]/.test(name)?new TextDecoder('windows-1253').decode(Uint8Array.from([...name].map(c=>c.charCodeAt(0)))):name;
 for(const match of text.matchAll(/If Me\.SYNTAGES_OIKOGENEIA\.Value = "(?:20|25|26|27)" Then Me\.([^\s.]+)\.Visible = True/gi)) result[decode(match[1])]='beef';
 for(const match of text.matchAll(/If Me\.PROIONTA_NOPO_KTPS\.Value = "[^"]+" Then Me\.([^\s.]+)\.Visible = False Else Me\.\1\.Visible = True/gi)) result[decode(match[1])]='frozen';
 return result;
}
function presentation(c, entry) {
 const values={fontWeight:c.FontWeight||400,underline:c.FontUnderline==='NotDefault',
  border:(c.OldBorderStyle??c.BorderStyle??0)===1, borderColor:c.BorderColor??0,
  borderWidth:c.BorderWidth?c.BorderWidth*25.4/72:0.12,
  sizeMode:c.SizeMode??3,pictureAlignment:c.PictureAlignment??2,
  canGrow:c.CanGrow==='NotDefault',canShrink:c.CanShrink==='NotDefault',
  format:c.Format||'',decimalPlaces:c.DecimalPlaces??255,
  condition:entry.layout.conditions[c.Name]||entry.layout.conditions[c.Name.replaceAll('.','_')]||''};
 const defaults={fontWeight:400,underline:false,borderColor:0,borderWidth:.12,sizeMode:3,pictureAlignment:2,canGrow:false,canShrink:false,format:'',decimalPlaces:255,condition:''};
 if(values.fontWeight===700)delete values.fontWeight; // represented by bold already
 return Object.fromEntries(Object.entries(values).filter(([key,value])=>key==='border'||value!==defaults[key]));
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
function imageResolution(file) {
 const bytes=fs.readFileSync(path.join(root,'legacy/assets',file));
 if(bytes.subarray(1,4).toString()==='PNG')for(let i=8;i+12<=bytes.length;){
  const size=bytes.readUInt32BE(i);
  if(bytes.toString('ascii',i+4,i+8)==='pHYs'&&size===9&&bytes[i+16]===1)
   return {imageDpiX:bytes.readUInt32BE(i+8)*.0254,imageDpiY:bytes.readUInt32BE(i+12)*.0254};
  i+=size+12;
 }
 return {};
}
const assets=fs.readdirSync(path.join(root,'legacy/assets')).map(file=>{const bytes=fs.readFileSync(path.join(root,'legacy/assets',file));return{file,name:file.replace(/^\d+_/,'').replace(/\.[^.]+$/,''),hash:crypto.createHash('sha256').update(bytes).digest('hex')}});
const resources={};const layouts={};
// Keep each source report's captions, images, control identities and sections.
// A shared family is a selection convenience, not permission to discard variants.
const variants={};
for(const entry of all){
 variants[entry.report]={source:entry.report,widthMm:entry.layout.widthMm,heightMm:entry.layout.heightMm,sections:entry.layout.sections,nodes:entry.layout.controls.map(c=>{
  const suffix=String(c.ControlSource||'').match(/_(GR|EN|GE|BG|RO|FR|IT|ES|PL|HL|PO|CH|SW|HU|CR|AL)$/)?.[1];
  const picture=assets.find(a=>a.name===c.Picture)||assets.find(a=>a.name.toLowerCase()===String(c.Picture||'').replace(/^\d+_/,'').toLowerCase());
  return {type:c.type,name:c.Name,section:c.section,x:(c.Left||0)*25.4/1440,y:(c.Top||0)*25.4/1440,width:(c.Width||0)*25.4/1440,height:(c.Height||0)*25.4/1440,font:c.FontName||'Calibri',fontSize:c.FontSize||6,bold:(c.FontWeight||400)>=700,italic:c.FontItalic==='NotDefault',align:c.TextAlign||1,binding:c.ControlSource||'',slot:suffix?Math.max(0,entry.languages.indexOf(langMap[suffix])):0,caption:String(c.Caption??'').replace(/\\"/g,'"'),captionKey:'',image:picture?.hash||'',imageName:c.Picture||'',visible:c.Visible!=='NotDefault'&&c.Visible!==0,background:c.BackStyle===1?(c.BackColor??16777215):null,foreground:c.ForeColor??0,border:c.BorderStyle!==0&&c.BorderStyle!==undefined,rich:c.TextFormat===1,...presentation(c,entry),...(c.SizeMode===0&&picture?imageResolution(picture.file):{})};
 })};
 adjustLegacyLayout(entry.report,variants[entry.report]);
}
for(const [key,report] of Object.entries(baseReports)){
 const entry=all.find(r=>r.report===report);const controls=entry.layout.controls;
 const sourceLangs=entry.languages;
 layouts[key]={source:report,widthMm:entry.layout.widthMm,heightMm:entry.layout.heightMm,nodes:controls.map((c,index)=>{
  let binding=c.ControlSource||'';let slot=0;const suffix=binding.match(/_(GR|EN|GE|BG|RO|FR|IT|ES|PL|HL|PO|CH|SW|HU|CR|AL)$/)?.[1];if(suffix){slot=Math.max(0,sourceLangs.indexOf(langMap[suffix]));binding=binding.replace(/_[A-Z]{2}$/,'_{lang}');}
  const captionKey=`${key}:${index}`;if(c.Caption!==undefined){for(const lang of sourceLangs){resources[lang]??={};resources[lang][captionKey]=c.Caption;}}
  const picture=assets.find(a=>a.name===c.Picture)||assets.find(a=>a.name.toLowerCase()===String(c.Picture||'').toLowerCase());
  return {type:c.type,name:c.Name,x:(c.Left||0)*25.4/1440,y:(c.Top||0)*25.4/1440,width:(c.Width||0)*25.4/1440,height:(c.Height||0)*25.4/1440,font:c.FontName||'Calibri',fontSize:c.FontSize||6,bold:(c.FontWeight||400)>=700,italic:c.FontItalic==='NotDefault',align:c.TextAlign||1,binding,slot,captionKey:c.Caption!==undefined?captionKey:'',image:picture?.hash||'',imageName:c.Picture||'',visible:c.Visible!=='NotDefault'&&c.Visible!==0,background:c.BackStyle===1?(c.BackColor??16777215):null,foreground:c.ForeColor??0,border:c.BorderStyle!==0&&c.BorderStyle!==undefined,rich:c.TextFormat===1,...presentation(c,entry),...(c.SizeMode===0&&picture?imageResolution(picture.file):{})};
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
fs.writeFileSync(path.join(root,'src/Api/Templates/legacy-layouts.json'),JSON.stringify(variants,null,2));
fs.writeFileSync(path.join(root,'src/Api/Templates/legacy-catalog.json'),JSON.stringify(coverage,null,2));
fs.writeFileSync(path.join(root,'legacy/asset-manifest.json'),JSON.stringify(assets,null,2));
fs.writeFileSync(path.join(root,'legacy/control-inventory.json'),JSON.stringify(all.map(e=>({report:e.report,widthMm:e.layout.widthMm,heightMm:e.layout.heightMm,controls:e.layout.controls.length,sources:e.layout.controls.filter(c=>c.ControlSource).map(c=>c.ControlSource)})),null,2));
console.log(`Compiled ${Object.keys(layouts).length} shared geometry profiles from ${all.length} fresh reports; ${assets.length} fresh assets.`);
