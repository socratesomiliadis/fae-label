// Explicit compatibility repairs, kept separate from the untouched Access exports.
export function adjustLegacyLayout(report, layout) {
  for (const node of layout.nodes) {
    // Access's format event hides translated captions with their conditional field.
    const target = layout.nodes.find(other =>
      /KOD_ZWOY|SFAGEIO|HMER_KATAPSIXHS/.test(other.binding) &&
      node.type === 'Label' && Math.abs(other.y - node.y) < .6 &&
      node.x < other.x && Math.abs(node.x + node.width - other.x) < 4);
    if (target) node.condition = target.binding.includes('HMER_KATAPSIXHS') ? 'frozen' : 'beef';
    // The Zlaths LOT box was only 17 mm despite an empty 44 mm slot before nutrition.
    if (report.startsWith('MIKRH_ETIKETA_ZLATHS_') && node.binding === 'LOT') node.width = 44;
    if (report.endsWith('_HL') && node.name === 'Ετικέτα31' && node.caption === 'Voorwaarde:') {
      node.x = 50.8; node.width = 15.2;
    }
    if (report === 'MIKRH_ETIKETA_ZLATHS_PL' && node.name === 'Ετικέτα36') node.width = 16;
    if (report === 'MIKRH_ETIKETA_FAETHON_IT') {
      if (node.name === 'Ετικέτα17') { node.y = 72.7; node.height = 4.5; }
      if (['PROIONTA.BAROS', 'Ετικέτα18', 'Ετικέτα20'].includes(node.name)) node.y = 78.2;
    }
  }
}
