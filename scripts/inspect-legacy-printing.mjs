import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
function block(text,key){const value=text.match(new RegExp('^    '+key+' = Begin\\r?\\n([\\s\\S]*?)^    End','m'));return value?Buffer.from([...value[1].matchAll(/0x([0-9a-f]+)/gi)].map(m=>m[1]).join(''),'hex'):null;}
const reports=fs.readdirSync(path.join(root,'legacy/definitions')).filter(f=>f.endsWith('.txt')).map(file=>{
 const text=fs.readFileSync(path.join(root,'legacy/definitions',file),'utf16le');
 const mode=block(text,'PrtDevModeW'),mip=block(text,'PrtMip');
 const settings=mode&&mode.length>=102?{orientation:mode.readInt16LE(76),paperSizeId:mode.readInt16LE(78),paperLengthTenthsMm:mode.readInt16LE(80),paperWidthTenthsMm:mode.readInt16LE(82),scalePercent:mode.readInt16LE(84),copies:mode.readInt16LE(86),printQuality:mode.readInt16LE(90),yResolution:mode.readInt16LE(96)}:null;
 return {report:file.slice(0,-4),savedDriverSettings:settings,marginsTwips:mip&&mip.length>=16?{left:mip.readInt32LE(0),top:mip.readInt32LE(4),right:mip.readInt32LE(8),bottom:mip.readInt32LE(12)}:null,barcodeFonts:[...new Set([...text.matchAll(/FontName ="(IDAutomation[^"\r\n]+)"/g)].map(m=>m[1]))]};
});
const actions=[];
for(const file of fs.readdirSync(path.join(root,'legacy/forms')).filter(f=>f.endsWith('.txt'))){const text=fs.readFileSync(path.join(root,'legacy/forms',file),'utf16le');for(const match of text.matchAll(/Action ="OpenReport"\s+Argument ="([^"]+)"\s+Argument ="([^"]+)"/g))actions.push({form:file.slice(0,-4),report:match[1],view:Number(match[2])});}
const result={source:JSON.parse(fs.readFileSync(path.join(root,'legacy/provenance.json'),'utf8').replace(/^\uFEFF/,'')),note:'Fresh exported database settings may reflect the last saved driver, not the production queue shown in user screenshots. Paper size 9 is A4. Do not apply saved binary driver blobs to new queues.',reports,openReportActions:actions};
fs.writeFileSync(path.join(root,'legacy/printing-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({reports:reports.length,openReportActions:actions.length,views:[...new Set(actions.map(a=>a.view))],savedPaperIds:[...new Set(reports.map(r=>r.savedDriverSettings?.paperSizeId))]}));
