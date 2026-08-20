// ─────────────────────────────────────────────────────────────────────────────
//  Bibliothèque d'icônes SVG — trait fin, 1.5px, géométrie sobre.
//  Usage :  Icon('chevron-right', { size: 16, class: 'mute' })
// ─────────────────────────────────────────────────────────────────────────────

const PATHS = {
  // Navigation
  'chevron-left':  '<path d="M14 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M10 6l6 6-6 6"/>',
  'chevron-down':  '<path d="M6 10l6 6 6-6"/>',
  'chevron-up':    '<path d="M6 14l6-6 6 6"/>',
  'arrow-right':   '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left':    '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  // Système
  'menu':          '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'close':         '<path d="M6 6l12 12M18 6L6 18"/>',
  'check':         '<path d="M5 12l4 4 10-10"/>',
  'plus':          '<path d="M12 5v14M5 12h14"/>',
  'minus':         '<path d="M5 12h14"/>',
  'search':        '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  'sun':           '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  'moon':          '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  'globe':         '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  // Données / éducation
  'book':          '<path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2zM4 5v15"/>',
  'graduation':    '<path d="m2 9 10-4 10 4-10 4z"/><path d="M6 11v4a6 6 0 0 0 12 0v-4"/>',
  'file':          '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/>',
  'file-text':     '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h6"/>',
  'download':      '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  'upload':        '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  'clock':         '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'calendar':      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'check-circle':  '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'alert':         '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  // Personnes & sécurité
  'user':          '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'users':         '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="3"/><path d="M22 19a6 6 0 0 0-5-5.9"/>',
  'logout':        '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>',
  'login':         '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 17l5-5-5-5M19 12H9"/>',
  'shield':        '<path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z"/>',
  'lock':          '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  // Tableau de bord
  'dashboard':     '<rect x="3" y="3" width="8" height="10" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="15" width="8" height="6" rx="1"/>',
  'chart':         '<path d="M3 21h18M6 17V9M11 17V5M16 17v-7M21 17v-3"/>',
  'building':      '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-4h4v4"/>',
  'edit':          '<path d="M4 20h4l11-11-4-4L4 16zM14 6l4 4"/>',
  'trash':         '<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6"/>',
  'send':          '<path d="m22 2-7 20-4-9-9-4z"/>',
  'mail':          '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  'phone':         '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'settings':      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  'eye':           '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':       '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.06-5M9.9 4.24A10 10 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19M14.12 9.88a3 3 0 1 0-4.24 4.24M1 1l22 22"/>',
  // Ajouts — structure nationale, contrats, notifications
  'bell':          '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  'user-plus':     '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M18 8v6M15 11h6"/>',
  'map-pin':       '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  'flag':          '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  'briefcase':     '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
  'layers':        '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  'award':         '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  'list':          '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  'filter':        '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  'refresh':       '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 4v4h-4M3 20v-4h4"/>',
  'folder':        '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'save':          '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  'external':      '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  'trending':      '<path d="M3 17 9.5 10.5l4 4L21 7"/><path d="M15 7h6v6"/>',
};

export function Icon(name, opts = {}) {
  const size = opts.size || 16;
  const stroke = opts.stroke || 1.5;
  const cls = opts.class ? ` ${opts.class}` : '';
  const path = PATHS[name];
  if (!path) {
    console.warn(`[icon] unknown name: ${name}`);
    return document.createTextNode('');
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  if (cls) svg.classList.add(...cls.trim().split(/\s+/));
  svg.innerHTML = path;
  return svg;
}

// Pour les usages innerHTML (templates string), version texte SVG :
export function iconHTML(name, opts = {}) {
  const size = opts.size || 16;
  const stroke = opts.stroke || 1.5;
  const cls = opts.class ? ` ${opts.class}` : '';
  const path = PATHS[name];
  if (!path) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon${cls}">${path}</svg>`;
}
