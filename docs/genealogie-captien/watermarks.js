// Filigranes (chapitres / périodes).
const WATERMARKS = {
  laudrefang: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,260 C170,220 250,240 350,210 C440,185 540,200 640,170 C740,140 820,160 900,130 L900,400 L0,400 Z" fill="#3b2f22"/>
    <circle cx="565" cy="180" r="10" fill="#2f6f6a" opacity="0.7"/>
  </svg>`,
  bambiderstroff: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,280 Q250,230 450,260 T900,245 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M450,110 C450,92 432,86 426,98 C418,116 442,124 450,108" fill="none" stroke="#2f6f6a" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
  </svg>`,
  mondorf: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,255 C220,210 310,240 420,210 C530,178 650,190 900,160 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,170 C180,210 260,240 360,260 C520,290 650,280 900,250" fill="none" stroke="#2f6f6a" stroke-width="10" opacity="0.45"/>
  </svg>`,
  'manom-mondorff': `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,265 Q210,230 450,252 T900,238 L900,400 L0,400 Z" fill="#3b2f22"/>
    <rect x="610" y="210" width="190" height="110" fill="none" stroke="#2f6f6a" stroke-width="5" opacity="0.55"/>
  </svg>`,
  'verdun-saint-avold': `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,260 Q240,215 450,245 T900,232 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M180,235 H350 L335,285 H195 Z" fill="none" stroke="#ede4cf" stroke-width="4" opacity="0.4"/>
    <circle cx="740" cy="135" r="32" fill="none" stroke="#2f6f6a" stroke-width="6" opacity="0.55"/>
  </svg>`,
  tours: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="400" fill="#1a1410"/>
    <path d="M0,255 Q225,215 450,242 T900,230 L900,400 L0,400 Z" fill="#3b2f22"/>
    <rect x="580" y="210" width="180" height="90" fill="none" stroke="#2f6f6a" stroke-width="6" opacity="0.6"/>
  </svg>`,

  // Alias compat : beaucoup de fiches ont chapterId="captien"
  captien: `<svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,250 Q225,215 450,242 T900,230 L900,400 L0,400 Z" fill="#3b2f22"/>
    <path d="M0,300 Q225,275 450,296 T900,285 L900,400 L0,400 Z" fill="#3b2f22"/>
    <circle cx="210" cy="120" r="30" fill="none" stroke="#2f6f6a" stroke-width="6" opacity="0.7"/>
  </svg>`
};
