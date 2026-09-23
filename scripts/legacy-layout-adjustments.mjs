// Explicit compatibility repairs, kept separate from the untouched Access exports.
export function adjustLegacyLayout(report, layout) {
  // The printed GR/EN reference has a clear gap between header artwork and legends.
  // Preserve image aspect ratios by reducing the available box, never cropping pixels.
  const legends=layout.nodes.filter(n=>n.type==='Label'&&layout.nodes.some(frame=>
    frame.type==='OptionGroup'&&n.x>=frame.x&&n.x+n.width<=frame.x+frame.width&&
    n.y<frame.y&&n.y+n.height>frame.y));
  if(legends.length) {
    const headerBottom=Math.min(...legends.map(n=>n.y))-.5;
    for(const image of layout.nodes.filter(n=>n.type==='Image'&&n.y<headerBottom&&n.y+n.height>headerBottom))
      if(legends.some(n=>image.x<n.x+n.width&&image.x+image.width>n.x)) image.height=headerBottom-image.y;
  }
  const frames=layout.nodes.filter(n=>n.type==='OptionGroup'&&layout.nodes.some(body=>
    /SYNTAGES\.SYSTATIKA/.test(body.binding)&&Math.abs(body.y-n.y)<2&&body.x>=n.x-.2&&body.x<n.x+n.width));
  for(const frame of frames) {
    const headings=layout.nodes.filter(n=>
      (n.type==='Label'||(/KATHGORIES\.PERIGRAFH/.test(n.binding)&&n.width<frame.width*.8))&&
      n.x>=frame.x-.2&&n.x+n.width<=frame.x+frame.width+.2&&
      n.y<frame.y&&n.y+n.height>frame.y-.5);
    for(const heading of headings) {
      heading.y=frame.y-heading.height/2;
      heading.textCenterY=frame.y;
      heading.background=16777215;
      heading.paintLayer=1;
    }
    const bodyTop=frame.y+Math.max(0,...headings.map(n=>n.height/2))+.15;
    for(const body of layout.nodes.filter(n=>/SYNTAGES\.SYSTATIKA/.test(n.binding)&&
      n.x>=frame.x-.2&&n.x<frame.x+frame.width&&Math.abs(n.y-frame.y)<2)) {
      const shift=Math.max(0,bodyTop-body.y);
      body.y+=shift;body.height-=shift;body.paintLayer=2;
    }
  }
  // Keep the Access footer rule in place. Its stroke needs clearance from the
  // first row of footer text; moving the rule itself creates a duplicate border.
  const instructions=layout.nodes.filter(n=>/ODHGIES_XRHSHS\.OD_XRHSHS/.test(n.binding));
  // A text inset is independent of the source border geometry. Small labels
  // have the same boxed instructions as the large and carton reports.
  for(const panel of instructions) {
    const frame=layout.nodes.find(n=>['OptionGroup','Rectangle'].includes(n.type)&&
      Math.abs(n.x-panel.x)<.2&&Math.abs(n.y-panel.y)<.2&&
      Math.abs(n.width-panel.width)<.5&&Math.abs(n.height-panel.height)<1);
    if(!panel.border&&!frame)continue;
    panel.paddingLeft=.7;panel.paddingRight=.7;
    panel.paddingTop=.4;panel.paddingBottom=.4;
    if(frame) {
      // The sample's text box extends below its separate frame. Keep the content
      // inside that frame and prevent the first footer row touching its rule.
      const bottom=frame.y+frame.height;
      panel.paddingBottom+=Math.max(0,panel.y+panel.height-bottom);
      for(const text of layout.nodes.filter(n=>n!==panel&&['Label','TextBox'].includes(n.type)&&
        n.x<frame.x+frame.width&&n.x+n.width>frame.x&&n.y>=bottom-.5&&n.y<bottom+.21)) {
        const shift=bottom+.21-text.y;text.y+=shift;text.height-=shift;
      }
    }
  }
  const footerRules=layout.nodes.filter(n=>n.type==='Line'&&n.height<.1&&n.borderWidth>.3&&
    instructions.some(p=>Math.abs(n.y-p.y-p.height)<1&&n.width>p.width));
  for(const rule of footerRules) {
    for(const text of layout.nodes.filter(n=>['Label','TextBox'].includes(n.type)&&
      n.y>=rule.y-.01&&n.y<rule.y+rule.borderWidth/2+.15)) {
      const shift=rule.y+rule.borderWidth/2+.15-text.y;
      text.y+=shift;text.height-=shift;
    }
  }
  // The exported column edges differ by a few twips (4215/4221/4222/4223 in
  // the reference). Join those hairline-sized offsets to the ingredient seam.
  const seams=frames.flatMap(left=>frames.filter(right=>right!==left&&
    Math.abs(left.x+left.width-right.x)<.02).map(right=>right.x));
  for(const seam of seams) {
    for(const n of layout.nodes.filter(n=>n.type==='Line'&&n.width===0))
      if(Math.abs(n.x-seam)<.15)n.x=seam;
    for(const panel of instructions) {
      if(Math.abs(panel.x-seam)<.15){panel.width+=panel.x-seam;panel.x=seam;}
      else if(Math.abs(panel.x+panel.width-seam)<.15)panel.width=seam-panel.x;
    }
  }
  // The sample report exports its barcode after LOT. Like the other small
  // reports, its LOT text must paint after the barcode's opaque background.
  for(const barcode of layout.nodes.filter(n=>/BARCODE/.test(n.binding))) {
    for(const lot of layout.nodes.filter(n=>n.binding==='LOT'||n.caption==='LOT:'||
      (n.type==='Label'&&layout.nodes.some(value=>value.binding==='LOT'&&
        Math.abs(value.y-n.y)<.1&&Math.abs(n.x+n.width-value.x)<.5))))
      if(layout.nodes.indexOf(barcode)>layout.nodes.indexOf(lot)&&barcode.x<lot.x+lot.width&&barcode.x+barcode.width>lot.x&&
        barcode.y<lot.y&&barcode.y+barcode.height>lot.y)lot.paintLayer=1;
  }
  for (const node of layout.nodes) {
    // Access's format event hides translated captions with their conditional field.
    const target = layout.nodes.find(other =>
      /KOD_ZWOY|SFAGEIO|HMER_KATAPSIXHS/.test(other.binding) &&
      node.type === 'Label' && Math.abs(other.y - node.y) < .6 &&
      node.x < other.x && Math.abs(node.x + node.width - other.x) < 4);
    if (target && !node.condition) node.condition = target.binding.includes('HMER_KATAPSIXHS') ? 'frozen' : 'beef';
    // The Zlaths LOT box was only 17 mm despite an empty 44 mm slot before nutrition.
    if (report.startsWith('MIKRH_ETIKETA_ZLATHS_') && node.binding === 'LOT') node.width = 44;
    if (report.endsWith('_HL') && node.name === 'Ετικέτα31' && node.caption === 'Voorwaarde:') {
      node.x = 50.8; node.width = 15.2;
    }
    if (report === 'MIKRH_ETIKETA_ZLATHS_PL' && node.name === 'Ετικέτα36') node.width = 16;
    if (report === 'MIKRH_ETIKETA_FAETHON_IT') {
      if (node.name === 'Ετικέτα17') { node.y = 71.5; node.height = 4.5; }
      if (['PROIONTA.BAROS', 'Ετικέτα18', 'Ετικέτα20'].includes(node.name)) node.y = 76.1;
    }
  }
}
