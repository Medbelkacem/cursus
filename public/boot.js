// Pré-application du thème et de la langue, avant le premier rendu.
// Fichier externe (et non script inline) pour rester compatible avec une
// politique de sécurité de contenu stricte : script-src 'self', sans
// 'unsafe-inline' ni hash à maintenir.
(function () {
  try {
    var t = localStorage.getItem('cursus.theme') || 'light';
    var l = localStorage.getItem('cursus.lang') || 'fr';
    var d = document.documentElement;
    d.setAttribute('data-theme', t);
    d.setAttribute('lang', l);
    d.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
  } catch (e) { /* navigation privée : on garde les valeurs par défaut */ }
})();
