// Paysages en filigrane, un par chapitre (repris de app.js via chapter.id, et de
// personne.js via chapterId). Une seule teinte encre, aucune couleur — chacun porte
// un motif distinctif de son époque, en plus du paysage. La subtilité vient de
// l'opacité appliquée en CSS (.chapter-watermark, .chapter-watermark--fixed).

const WATERMARKS = {
  // Alle : montagnes du Jura, village, et la crosse épiscopale de l'Évêché de Bâle
  alle: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,232 L105,170 L210,212 L316,148 L422,200 L528,158 L634,222 L740,168 L846,212 L900,190 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,274 L132,222 L264,264 L396,212 L528,254 L660,206 L792,248 L900,226 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,318 L158,284 L344,306 L528,280 L714,312 L900,290 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,360 Q225,336 450,363 T900,350 L900,400 L0,400 Z" fill="#3b2f22"/>
    <rect x="326" y="272" width="30" height="24" fill="#3b2f22"/>
    <polygon points="323,272 341,250 359,272" fill="#3b2f22"/>
    <rect x="376" y="280" width="24" height="18" fill="#3b2f22"/>
    <polygon points="373,280 388,262 403,280" fill="#3b2f22"/>
    <rect x="462" y="238" width="20" height="62" fill="#3b2f22"/>
    <polygon points="459,238 472,204 485,238" fill="#3b2f22"/>
    <path d="M150,230 L150,90 C150,68 128,64 126,80 C124,94 142,97 150,86" fill="none" stroke="#3b2f22" stroke-width="6" stroke-linecap="round"/>
  </svg>`,

  // Lorraine : champs, clocher, ciseaux de tailleur (Germain) et meule de moulin (Hubert)
  lorraine: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,250 Q225,210 450,240 T900,225 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,300 Q225,270 450,296 T900,282 L900,400 L0,400 Z" fill="#3b2f22"/>
    <rect x="560" y="256" width="26" height="42" fill="#3b2f22"/>
    <polygon points="557,256 573,232 589,256" fill="#3b2f22"/>
    <rect x="620" y="270" width="20" height="28" fill="#3b2f22"/>
    <polygon points="617,270 630,252 643,270" fill="#3b2f22"/>
    <circle cx="200" cy="120" r="38" fill="none" stroke="#3b2f22" stroke-width="6"/>
    <path d="M200,84 L200,156 M164,120 L236,120 M176,96 L224,144 M224,96 L176,144" stroke="#3b2f22" stroke-width="4"/>
    <g stroke="#3b2f22" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M700,70 L740,120"/>
      <path d="M740,70 L700,120"/>
      <circle cx="696" cy="128" r="9"/>
      <circle cx="744" cy="128" r="9"/>
    </g>
  </svg>`,

  // Traversée : mer, navire à vapeur avec fumée, et roseaux de la Mitidja
  traversee: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,210 L60,180 L130,215 L190,175 L250,215 L900,215 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M420,260 L455,260 L445,280 L410,280 Z" fill="#3b2f22"/>
    <rect x="432" y="200" width="3" height="62" fill="#3b2f22"/>
    <polygon points="435,205 435,235 470,222" fill="#3b2f22"/>
    <polygon points="432,205 432,238 402,225" fill="#3b2f22"/>
    <rect x="404" y="248" width="10" height="18" fill="#3b2f22"/>
    <path d="M409,246 Q400,225 415,210 Q404,195 418,178" fill="none" stroke="#3b2f22" stroke-width="4" stroke-linecap="round"/>
    <g stroke="#3b2f22" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M60,400 Q52,330 66,290"/>
      <path d="M80,400 Q76,320 88,270"/>
      <path d="M100,400 Q108,335 96,300"/>
    </g>
    <ellipse cx="66" cy="284" rx="7" ry="10" fill="#3b2f22"/>
    <ellipse cx="88" cy="264" rx="7" ry="10" fill="#3b2f22"/>
    <ellipse cx="96" cy="294" rx="6" ry="9" fill="#3b2f22"/>
  </svg>`,

  // Algérie-est : chaîne de l'Atlas, araire de cultivateur, et minaret d'Alger
  'algerie-est': `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,190 L90,110 L170,170 L260,90 L350,160 L440,100 L530,175 L620,120 L710,165 L900,140 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,230 L120,180 L240,220 L360,170 L480,215 L600,175 L720,220 L900,200 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M300,318 L330,318 L318,338 L288,338 Z" fill="#3b2f22"/>
    <path d="M300,318 Q310,300 330,300" fill="none" stroke="#3b2f22" stroke-width="4"/>
    <rect x="772" y="266" width="6" height="30" fill="#3b2f22"/>
    <ellipse cx="775" cy="264" rx="14" ry="9" fill="#3b2f22"/>
    <path d="M775,254 L775,236" stroke="#3b2f22" stroke-width="3"/>
    <circle cx="775" cy="232" r="4" fill="#3b2f22"/>
  </svg>`,

  // Retour : collines, maison, et le viaduc de Chaumont
  retour: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,260 Q225,220 450,250 T900,235 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,300 Q225,270 450,296 T900,282 L900,400 L0,400 Z" fill="#3b2f22"/>
    <rect x="600" y="266" width="46" height="36" fill="#3b2f22"/>
    <polygon points="596,266 623,240 650,266" fill="#3b2f22"/>
    <rect x="700" y="278" width="30" height="24" fill="#3b2f22"/>
    <polygon points="697,278 715,258 733,278" fill="#3b2f22"/>
    <rect x="90" y="248" width="380" height="9" fill="#3b2f22"/>
    <rect x="100" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="150" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="200" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="250" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="300" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="350" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="400" y="257" width="8" height="70" fill="#3b2f22"/>
    <rect x="450" y="257" width="8" height="70" fill="#3b2f22"/>
  </svg>`
};
