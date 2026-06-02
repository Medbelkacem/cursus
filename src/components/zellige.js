// ─────────────────────────────────────────────────────────────────────────────
//  Zellige — motif géométrique islamique stylisé, élément de marque récurrent.
//  Rôle décoratif uniquement (aria-hidden). Pris en très faible opacité dans
//  les coins des cartes héros et des écrans de connexion.
// ─────────────────────────────────────────────────────────────────────────────

export function Zellige(opts = {}) {
  const {
    size = 320,
    opacity = 0.06,
    color = 'var(--c-gauloise)',
    style = 'star8', // 'star8' | 'star12' | 'rosette'
  } = opts;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('zellige');
  svg.style.opacity = opacity;
  svg.style.color = color;

  let pathData = '';
  if (style === 'star8') {
    // Étoile à 8 branches + cercle inscrit
    const cx = 100, cy = 100, R = 84, r = 36;
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI / 8) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? R : r;
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    pathData = `<polygon points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1"/>`;
    // anneau intérieur
    pathData += `<circle cx="100" cy="100" r="22" fill="none" stroke="currentColor" stroke-width="1"/>`;
    pathData += `<circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 3"/>`;
  } else if (style === 'star12') {
    const cx = 100, cy = 100, R = 86, r = 42;
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI / 12) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? R : r;
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    pathData = `<polygon points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1"/>`;
    pathData += `<circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" stroke-width="0.5"/>`;
  } else if (style === 'rosette') {
    // Pétales en rotation
    let petals = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      const x = 100 + 50 * Math.cos(a);
      const y = 100 + 50 * Math.sin(a);
      petals += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="30" fill="none" stroke="currentColor" stroke-width="0.7"/>`;
    }
    pathData = petals + `<circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" stroke-width="1"/>`;
  }

  svg.innerHTML = pathData;
  return svg;
}

// Version HTML statique pour les usages template (pas d'événements / pas de DOM API).
export function zelligeHTML(opts = {}) {
  const { size = 320, opacity = 0.06, color = 'var(--c-gauloise)' } = opts;
  const cx = 100, cy = 100, R = 84, r = 36;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? R : r;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return `
    <svg viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true" class="zellige" style="opacity:${opacity};color:${color}">
      <polygon points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="100" cy="100" r="22" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 3"/>
    </svg>
  `;
}
