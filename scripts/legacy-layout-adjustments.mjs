// Explicit compatibility repairs, kept separate from the untouched Access exports.
export function adjustLegacyLayout(report, layout) {
  // The printed GR/EN reference has a clear gap between header artwork and legends.
  // Preserve image aspect ratios by reducing the available box, never cropping pixels.
  const legends=layout.nodes.filter(n=>n.type==='Label'&&/^(Συστατικά:|Ingredients:)$/.test(n.caption));
  if(legends.length) {
    const headerBottom=Math.min(...legends.map(n=>n.y))-.5;
    for(const image of layout.nodes.filter(n=>n.type==='Image'&&n.y<headerBottom&&n.y+n.height>headerBottom))
      if(legends.some(n=>image.x<n.x+n.width&&image.x+image.width>n.x)) image.height=headerBottom-image.y;
  }
  for (const node of layout.nodes) {
    // Access's format event hides translated captions with their conditional field.
    const target = layout.nodes.find(other =>
      /KOD_ZWOY|SFAGEIO|HMER_KATAPSIXHS/.test(other.binding) &&
      node.type === 'Label' && Math.abs(other.y - node.y) < .6 &&
      node.x < other.x && Math.abs(node.x + node.width - other.x) < 4);
    if (target && !node.condition) node.condition = target.binding.includes('HMER_KATAPSIXHS') ? 'frozen' : 'beef';
    // A thick divider at the same top coordinate as footer text touches its ink.
    if(node.type==='Line'&&node.height<.1&&node.borderWidth>.3&&layout.nodes.some(other=>
      ['TextBox','Label'].includes(other.type)&&Math.abs(other.y-node.y)<.15))
      node.y-=node.borderWidth/2+.15;
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
