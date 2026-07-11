// Contenu du site — pour ajouter un chapitre ou une carte (anecdote / histoire / lieu),
// il suffit d'ajouter un objet dans CHAPTERS ou dans le tableau "cards" d'un chapitre.
// Aucune autre modification n'est nécessaire : app.js se charge du rendu.

const CHAPTERS = [
  {
    id: 'alle',
    map: 'img/carte-alle.png',
    years: '1598 – 1728',
    place: 'Alle, Ajoie, Jura — 1598–1728',
    illustration: `<svg viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2b3a55"/><stop offset="55%" stop-color="#8a7391"/><stop offset="100%" stop-color="#eab873"/>
      </linearGradient></defs>
      <rect width="900" height="400" fill="url(#sky1)"/>
      <circle cx="740" cy="95" r="30" fill="#f6dca0"/>
      <path d="M0,232 L105,170 L210,212 L316,148 L422,200 L528,158 L634,222 L740,168 L846,212 L900,190 L900,400 L0,400 Z" fill="#5c5570"/>
      <path d="M0,274 L132,222 L264,264 L396,212 L528,254 L660,206 L792,248 L900,226 L900,400 L0,400 Z" fill="#453f57"/>
      <path d="M0,318 L158,284 L344,306 L528,280 L714,312 L900,290 L900,400 L0,400 Z" fill="#2f2a3d"/>
      <path d="M0,360 Q225,336 450,363 T900,350 L900,400 L0,400 Z" fill="#20344a"/>
      <path d="M0,373 Q225,350 450,373 T900,362" fill="none" stroke="#3a557a" stroke-width="2" opacity="0.6"/>
      <rect x="326" y="272" width="30" height="24" fill="#1c1826"/>
      <polygon points="323,272 341,250 359,272" fill="#1c1826"/>
      <rect x="376" y="280" width="24" height="18" fill="#1c1826"/>
      <polygon points="373,280 388,262 403,280" fill="#1c1826"/>
      <rect x="416" y="286" width="22" height="16" fill="#1c1826"/>
      <polygon points="413,286 427,270 441,286" fill="#1c1826"/>
      <rect x="462" y="238" width="20" height="62" fill="#161320"/>
      <polygon points="459,238 472,204 485,238" fill="#161320"/>
      <rect x="470" y="212" width="5" height="14" fill="#161320"/>
    </svg>`,
    narrative: [
      "Personne ne se souvient du premier Billieux. On ne se souvient jamais du premier de rien — seulement du dernier, celui qui porte encore le nom quand on ferme le registre. Et pourtant il y eut un homme, vers mille cinq cent cinquante, dans un siècle qu'on nommera plus tard celui des guerres de Religion, sans qu'il l'ait su jamais. <a class=\"person-link\" href=\"personne.html#jean-perrin-billeux-pere\">Jean Perrin Billeux</a> — Perrin comme on perce la nuit, Billeux comme on blesse le silence d'une syllabe qu'on ne comprend plus. Il vivait à Alle, village de trois ou quatre cents âmes où les prénoms tenaient dans deux mains et où l'on inventait des sobriquets pour ne pas confondre le cousin du voisin avec le voisin du cousin.",
      "De lui il ne reste qu'un nom recopié deux fois : le sien, et celui de son fils. On lui connaît deux fils : <a class=\"person-link\" href=\"personne.html#jean-perrin-billieux-1598\">l'un marié en 1597</a> porte son nom entier ; l'autre, <a class=\"person-link\" href=\"personne.html#francois-billieux-1598\">François</a>, témoigne au mariage de son frère l'année suivante — comme on témoigne devant les vivants de ce que les morts ne diront jamais tout à fait : qu'ils étaient de la même maison, du même sang, du même mot.",
      "L'un de ces deux-là, dit-on, s'appelait <a class=\"person-link\" href=\"personne.html#pequegnot-billieux\">Pequegnot</a> — le petit. Et de Pequegnot naquit <a class=\"person-link\" href=\"personne.html#pierre-bileux\">Pierre</a>, comme les prénoms reviennent dans les familles, pareils à des chemins qui se répètent sans jamais être tout à fait les mêmes. Perrin devenu Pierre. Ainsi commence ce qu'on appellera une lignée, mot trop sec pour ce qui n'était encore qu'une respiration dans le brouillard du Doubs.",
      "<a class=\"person-link\" href=\"personne.html#pierre-bileux\">Pierre</a> épousa <a class=\"person-link\" href=\"personne.html#clemence-magnin\">Clémence Magnin</a> le huit novembre mille six cent vingt-six. Les Baboz étaient là, les Rossez, les Caillet — les mêmes familles qui reviennent d'acte en acte comme reviennent les saisons dans un pays où l'hiver dure six mois et où l'on ne sait pas encore qu'on est suisse, ni français, ni rien d'autre qu'habitant du creux d'une vallée.",
      "En 1634 la guerre franchit les collines. Alle brûla. Fontenais brûla. Courtedoux brûla. Pierre et Clémence eurent-ils le temps de mettre leur fils <a class=\"person-link\" href=\"personne.html#nicolas-billieux-aine\">Nicolas</a> à l'abri ? Rien ne le dit. Rien ne dit rien, en généalogie — seulement ce qu'un curé écrivit en latin parce que le latin est la langue des naissances et des sépultures, celle qu'on prête aux morts quand on ne sait plus quoi leur dire en français.",
      "<a class=\"person-link\" href=\"personne.html#nicolas-billieux-aine\">Nicolas</a> grandit dans un village qui se relevait de ses cendres. Il épousa <a class=\"person-link\" href=\"personne.html#anne-gevaudin\">Anne Gevaudin</a> le vingt-huit juillet mille six cent soixante-neuf. La paix de Westphalie avait cessé de gronder vingt et un ans plus tôt, mais on ne regardait plus les collines de la même façon.",
      "Il y avait Alle. Il y avait ce nom qu'on dirait inventé pour une halte, une halle aux grains, un mot court pour un lieu où le Doubs se retourne dans son lit de pierre. Il y avait un évêché sans évêque à Bâle — car Bâle était passée à la Réforme — et un prince qui gouvernait depuis Porrentruy, à quinze kilomètres, comme on gouverne un rêve qu'on n'habite plus.",
      "<a class=\"person-link\" href=\"personne.html#jean-francois-billieux\">Jean-François</a> épousa <a class=\"person-link\" href=\"personne.html#marguerite-bregnard\">Marguerite Bregnard</a> en mille six cent quatre-vingt-treize. Deux noms accrochés au bord d'un registre effacé, deux mains qui se tiennent dans l'encre d'un autre siècle.",
      "De ces deux-là naquit <a class=\"person-link\" href=\"personne.html#nicolas-billieux\">Nicolas</a>, le cinq juillet mille sept cent trois. Parrain : un tailleur. Marraine : la fille d'un appariteur déjà mort. Ainsi naissent les enfants dans les villages — entourés de métiers qui ne sont pas les leurs, de morts qui veillent, de curés qui écrivent Nicolaus filius Joannis Francisci comme on grave une date sur une pierre qu'on ne relira plus.",
      "Vingt et un ans. Le temps qu'il faut pour qu'un enfant devienne un homme. Le trente mai mille sept cent vingt-quatre, <a class=\"person-link\" href=\"personne.html#nicolas-billieux\">Nicolas</a> épousa <a class=\"person-link\" href=\"personne.html#suzanne-rossel\">Suzanne Rossel</a> — Rosel, Rossel, peu importe l'orthographe quand l'amour ne se conjugue pas encore à l'école. Témoin : <a class=\"person-link\" href=\"personne.html#thomas-billieux\">Thomas</a>, qui portait le même nom. Frère, oncle, cousin — la parenté ne se précise pas, elle se devine, comme on devine la source d'un ruisseau en remontant la pente.",
      "Alle grondait. Le prince-évêque avait réformé l'administration ; les paysans réclamaient le rôle de 1517 ; on chassa les troupeaux du prince du pâturage d'Alle comme on chasse un maître qui a trop tiré sur la corde. C'est dans ce village en colère que naquit <a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a>, en mille sept cent vingt-huit — quatre ans avant les Troubles de mille sept cent trente, un enfant venu au monde sous le signe du refus, sans le savoir, comme tous les enfants."
    ],
    cards: [
      {
        type: 'histoire',
        title: "L'incendie de 1634",
        text: "Pendant la guerre de Trente Ans (1618-1648), l'Ajoie subit les violences des troupes de passage — françaises, puis surtout suédoises. En 1634, celles-ci incendient Alle, Fontenais et Courtedoux ; le village est pillé à plusieurs reprises jusqu'en 1639. Les guerres de cette ampleur provoquaient partout un recul des naissances, catastrophique quand une épidémie de peste s'y ajoutait.",
        source: 'https://hls-dhs-dss.ch/fr/articles/007623/2010-10-07/'
      },
      {
        type: 'anecdote',
        title: 'Pequegnot, le petit',
        text: "« Pequegnot », le nom donné au père de <a class=\"person-link\" href=\"personne.html#pierre-bileux\">Pierre Billeux</a> en 1626, n'est sans doute pas un prénom mais un sobriquet dialectal signifiant « le petit ». Deux frères, très probablement — l'un témoin au mariage de l'autre —, se marient à Alle 27 et 28 ans plus tôt : <a class=\"person-link\" href=\"personne.html#francois-billieux-1598\">François Billieux</a> (1598) et <a class=\"person-link\" href=\"personne.html#jean-perrin-billieux-1598\">Jean Perrin Billieux</a> (1597), lui-même fils d'un père portant déjà le même prénom. Lequel des deux frères est ce « Pequegnot » ? Deux indices s'opposent sans trancher : François reviendra dans la lignée chez Jean-François (1693) ; mais « Perrin », qui se transmet déjà sur deux générations chez les Jean Perrin, est une forme ancienne de Pierre — le prénom même du fils né en 1626."
      },
      {
        type: 'histoire',
        title: 'Les Troubles de 1730',
        text: "En 1726, le prince-évêque de Bâle réforme l'administration de son évêché. Les villages d'Ajoie, dont Alle, y voient une atteinte à leurs franchises séculaires. La contestation grandit jusqu'aux grands Troubles de 1730 : les paysans réclament le rétablissement du « rôle de 1517 » et chassent les troupeaux épiscopaux du pâturage d'Alle.",
        source: 'https://www.chronologie-jurassienne.ch/fr/001-ANNEES/1700-1799/1730.html'
      },
      {
        type: 'lieu',
        title: 'Alle au XVIIIe siècle',
        text: "Chef-lieu d'une des quatre grandes mairies de l'Ajoie, Alle est un village agricole de quelques centaines d'habitants, niché dans la vallée du Doubs. Le territoire appartient à l'ancien Évêché de Bâle, principauté ecclésiastique dont le prince-évêque réside en réalité à Porrentruy, la ville de Bâle étant passée à la Réforme dès 1529.",
        source: 'https://hls-dhs-dss.ch/fr/articles/006440/2020-05-14/'
      },
      {
        type: 'anecdote',
        title: 'Le témoin qui portait le même nom',
        text: "Au mariage de <a class=\"person-link\" href=\"personne.html#nicolas-billieux\">Nicolas</a> et <a class=\"person-link\" href=\"personne.html#suzanne-rossel\">Suzanne</a>, en mai 1724, l'acte cite un témoin : <a class=\"person-link\" href=\"personne.html#thomas-billieux\">Thomas Billieux</a>. Frère ? Oncle ? Le lien n'est pas encore établi — c'est la piste qu'il reste à suivre pour remonter au-delà de Jean-François."
      }
    ]
  },
  {
    id: 'lorraine',
    map: 'img/carte-lorraine.png',
    years: '1728 – 1856',
    place: 'Zommange, Guébling, Bouillonville — 1728–1856',
    illustration: `<svg viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7fa7c9"/><stop offset="60%" stop-color="#cfe0c4"/><stop offset="100%" stop-color="#e8d79a"/>
      </linearGradient></defs>
      <rect width="900" height="400" fill="url(#sky2)"/>
      <ellipse cx="150" cy="90" rx="60" ry="20" fill="#f5f2e8" opacity="0.8"/>
      <ellipse cx="210" cy="80" rx="50" ry="18" fill="#f5f2e8" opacity="0.7"/>
      <ellipse cx="700" cy="110" rx="70" ry="22" fill="#f5f2e8" opacity="0.7"/>
      <path d="M0,250 Q225,210 450,240 T900,225 L900,400 L0,400 Z" fill="#8fae62"/>
      <path d="M0,300 Q225,270 450,296 T900,282 L900,400 L0,400 Z" fill="#dcbb5a"/>
      <path d="M40,300 L60,296 L64,300 L64,320 L40,320 Z" fill="#c9a13f"/>
      <path d="M100,296 L120,292 L124,296 L124,318 L100,318 Z" fill="#c9a13f"/>
      <path d="M160,300 L180,296 L184,300 L184,320 L160,320 Z" fill="#c9a13f"/>
      <path d="M300,296 Q450,286 600,296" fill="none" stroke="#a9895a" stroke-width="10" opacity="0.5"/>
      <rect x="560" y="256" width="26" height="42" fill="#7a6a52"/>
      <polygon points="557,256 573,232 589,256" fill="#7a6a52"/>
      <rect x="568" y="236" width="10" height="16" fill="#7a6a52"/>
      <rect x="572" y="222" width="2" height="16" fill="#7a6a52"/>
      <rect x="620" y="270" width="20" height="28" fill="#8a7a5e"/>
      <polygon points="617,270 630,252 643,270" fill="#8a7a5e"/>
    </svg>`,
    narrative: [
      "<a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a> apprit le métier de tailleur — manœuvrier, disait-on, bien au-dessous du laboureur qui possède charrue et terres. Coudre les habits des autres quand on n'a ni les dix hectares ni l'espoir d'en posséder un jour : un métier qui ne retient pas les hommes. On le pratique où qu'on soit, du moment qu'il y a des épaules à vêtir.",
      "Et puis <a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a> partit.",
      "On ne sait pas pourquoi les hommes partent. On sait seulement qu'ils partent — qu'ils marchent trois cents kilomètres, par la Franche-Comté, par l'Alsace, avec pour tout bagage un nom, une aiguille, et un certificat de non-opposition scellé par le curé d'Alle, comme on scelle une lettre qu'on n'est pas sûr de revoir.",
      "Zommange. <a class=\"person-link\" href=\"personne.html#elisabeth-claudin\">Élisabeth Claudin</a>. Dixième jour de février mille sept cent soixante-six. Une fille, <a class=\"person-link\" href=\"personne.html#barbe-billieux\">Barbe</a>. Un fils qui ne vécut pas. Élisabeth qui suivit l'enfant dans la mort, début mille sept cent soixante-huit. Sept mois de veuvage — le temps qu'il faut pour qu'un homme recommence. <a class=\"person-link\" href=\"personne.html#marie-anne-francoise-colchienne\">Marie Anne Françoise Colchienne</a>, à Guébling, deux août. <a class=\"person-link\" href=\"personne.html#therese-billieux\">Thérèse</a>. <a class=\"person-link\" href=\"personne.html#hubert-billieux-1772\">Hubert</a>. <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a>. <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Un autre Hubert</a>. Les prénoms reviennent comme les saisons, comme si les familles n'avaient qu'un nombre limité de mots pour dire l'amour et la continuité.",
      "La famille glissa : Bouillonville, village troglodyte au confluent de deux rivières, dont une charte de l'an 875 atteste déjà l'existence ; Ménil-la-Tour ; Prauthoy, en Haute-Marne. Toujours vers l'ouest. Toujours cette dérive lente des hommes qui suivent la terre — jusqu'au jour où la terre se déroba, et qu'il fallut chercher plus loin, de l'autre côté de la mer."
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Laboureurs et manœuvriers',
        text: "Dans la Lorraine du XVIIIe siècle, la société paysanne est strictement hiérarchisée : au sommet les laboureurs, seuls à posséder charrue et grandes terres (8 à 12 hectares pour nourrir une famille de cinq) ; en dessous les manœuvriers, souvent tailleurs, meuniers ou maçons ; enfin les manants, sans terre ni métier stable.",
        source: 'https://www.persee.fr/doc/rgest_0035-3213_1996_num_36_1_2312'
      },
      {
        type: 'lieu',
        title: 'Bouillonville, village troglodytique',
        text: "Niché en fer à cheval au confluent du Rupt de Mad et de la Madine, Bouillonville est un village dont l'existence est attestée dès une charte de l'an 875. Une partie de ses maisons anciennes est creusée à même la roche.",
        source: 'https://fr.m.wikipedia.org/wiki/Bouillonville'
      },
      {
        type: 'anecdote',
        title: 'Deux mariages en deux ans',
        text: "<a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a> épouse <a class=\"person-link\" href=\"personne.html#elisabeth-claudin\">Élisabeth Claudin</a> le 10 février 1766 à Zommange. Leur fille <a class=\"person-link\" href=\"personne.html#barbe-billieux\">Barbe</a> naît la même année ; un fils meurt-né en février 1768, et Élisabeth s'éteint peu après. Sept mois plus tard, le 2 août 1768, Germain se remarie à Guébling avec <a class=\"person-link\" href=\"personne.html#marie-anne-francoise-colchienne\">Marie Anne Françoise Colchienne</a> — c'est d'elle que descend toute la suite de la lignée."
      }
    ]
  },
  {
    id: 'traversee',
    map: 'img/carte-traversee.png',
    years: '1856',
    place: 'De Marseille à Mouzaïaville — 1856',
    illustration: `<svg viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a4a6b"/><stop offset="45%" stop-color="#c97b4a"/><stop offset="100%" stop-color="#f2c26b"/></linearGradient>
        <linearGradient id="sea3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2b4a5a"/><stop offset="100%" stop-color="#16303c"/></linearGradient>
      </defs>
      <rect width="900" height="400" fill="url(#sky3)"/>
      <circle cx="720" cy="120" r="34" fill="#f6d99a" opacity="0.9"/>
      <rect x="0" y="230" width="900" height="170" fill="url(#sea3)"/>
      <path d="M0,235 Q225,225 450,235 T900,230" fill="none" stroke="#5a7a86" stroke-width="2" opacity="0.6"/>
      <path d="M0,255 Q225,245 450,255 T900,250" fill="none" stroke="#5a7a86" stroke-width="2" opacity="0.4"/>
      <path d="M0,275 Q225,265 450,275 T900,270" fill="none" stroke="#5a7a86" stroke-width="2" opacity="0.3"/>
      <path d="M0,210 L60,180 L130,215 L190,175 L250,215 L900,215 L900,232 L0,232 Z" fill="#1d2a3a" opacity="0.55"/>
      <path d="M900,205 L840,185 L780,210 L720,178 L660,210 L0,210 L0,230 L900,230 Z" fill="#2a1a12" opacity="0.5"/>
      <ellipse cx="640" cy="205" rx="8" ry="14" fill="#2a1a12" opacity="0.6"/>
      <ellipse cx="660" cy="200" rx="8" ry="16" fill="#2a1a12" opacity="0.6"/>
      <ellipse cx="680" cy="206" rx="8" ry="13" fill="#2a1a12" opacity="0.6"/>
      <path d="M420,260 L455,260 L445,280 L410,280 Z" fill="#241a12"/>
      <rect x="432" y="200" width="3" height="62" fill="#241a12"/>
      <polygon points="435,205 435,235 470,222" fill="#5a3a26"/>
      <polygon points="432,205 432,238 402,225" fill="#5a3a26"/>
      <path d="M500,265 Q510,258 520,265" fill="none" stroke="#f2e2c0" stroke-width="2"/>
      <path d="M520,270 Q530,262 540,270" fill="none" stroke="#f2e2c0" stroke-width="2"/>
    </svg>`,
    narrative: [
      "Ils partirent par Marseille.",
      "<a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a>, cinquante-huit ans, vigneron toute sa vie. <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a>, dix-huit ans, ouvrier du ciment. Et avec eux leurs filles, leurs enfants, tout un monde qu'on charge sur un bateau comme on charge une vie entière dans une malle trop petite.",
      "L'Algérie les attendait — blanche, chaude, si loin de la Haute-Marne, si loin du Jura, si loin d'Alle dont plus personne dans le bateau ne se souvenait avoir jamais entendu parler. <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a> mourut à Blida l'année suivante. La terre nouvelle exigeait déjà son tribut. <a class=\"person-link\" href=\"personne.html#marguerite-billieux-1834\">Marguerite</a>, sa fille, s'y maria quelques mois plus tôt — signe que la famille s'était installée avant que le patriarche ne rende son souffle.",
      "Mouzaïaville — baptisée en 1846 — n'était encore, dix ans plus tôt, qu'un carré de marécages entre le Sahel et l'Atlas blidéen. Trois cent cinquante âmes ; puis cinq cent soixante-dix-huit ; huit cents hectares arrachés aux joncs et aux fièvres. Les années de la quinine : des colons entiers y laissèrent leur santé, jusqu'à ce qu'un médecin découvrît que le sulfate repoussait la fièvre. <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a> et <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a> arrivèrent au bout de ce chemin, dans des maisons de pisé coiffées de chaume, derrière un fossé qu'on creusait encore contre les raids."
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Les années de la quinine',
        text: "De 1842 à 1856, le grand défrichement de la Mitidja décime colons et ouvriers : le paludisme, endémique dans les marais, fait des ravages. Le médecin militaire François Maillot met au point dès 1834 les premiers traitements au sulfate de quinine en Algérie — d'où le nom donné à cette période.",
        source: 'https://encyclopedie.cerclealgerianiste.fr/histoire/histoire-economique/histoire-agricole/306-assechement-et-assainissement-de-la-mitidja.html'
      },
      {
        type: 'lieu',
        title: 'Mouzaïaville en 1856',
        text: "Fondée en 1846, Mouzaïaville compte 350 habitants en 1849 et 578 en 1855. Les terres cultivées passent de 150 à 800 hectares en six ans. Les premières maisons, en pisé coiffées de chaume, sont protégées par un fossé contre les raids des tribus Hadjoutes.",
        source: 'https://fr.geneawiki.com/wiki/Alg%C3%A9rie_-_Mouza%C3%AFaville'
      },
      {
        type: 'anecdote',
        title: 'Vigneron et cimentier, père et fils',
        text: "<a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a>, 58 ans, était vigneron en Haute-Marne. Son fils <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a>, 18 ans, savait déjà travailler le ciment — un métier tout neuf, pensé pour bâtir un pays neuf. Les fiches d'émigration de 1856 (archives départementales, AD52, 85 M 3-4) les décrivent l'un et l'autre, partis ensemble avec toute la famille."
      },
      {
        type: 'anecdote',
        title: 'Marguerite, mariée avant le deuil',
        text: "<a class=\"person-link\" href=\"personne.html#marguerite-billieux-1834\">Marguerite Billieux</a>, fille de Louis, épouse Alexandre François Lami le 21 avril 1857 à Blida — six mois avant la mort de son père le 31 octobre 1857. La famille était donc déjà bien installée en Algérie avant que le patriarche ne s'éteigne."
      }
    ]
  },
  {
    id: 'algerie-est',
    years: '1874 – 1937',
    place: 'Oued el Alleug, Mouzaïa, Alger — 1874–1937',
    illustration: `<svg viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sky5" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e8c691"/><stop offset="45%" stop-color="#e6a869"/><stop offset="100%" stop-color="#c97a52"/>
      </linearGradient></defs>
      <rect width="900" height="400" fill="url(#sky5)"/>
      <circle cx="180" cy="90" r="32" fill="#fbe6b8"/>
      <path d="M0,190 L90,110 L170,170 L260,90 L350,160 L440,100 L530,175 L620,120 L710,165 L900,140 L900,400 L0,400 Z" fill="#8c5c46"/>
      <path d="M0,230 L120,180 L240,220 L360,170 L480,215 L600,175 L720,220 L900,200 L900,400 L0,400 Z" fill="#a9714f"/>
      <path d="M0,280 Q225,250 450,275 T900,262 L900,400 L0,400 Z" fill="#d3a869"/>
      <path d="M0,330 Q225,310 450,328 T900,318 L900,400 L0,400 Z" fill="#e6c58c"/>
      <rect x="80" y="300" width="3" height="34" fill="#5c3a26"/>
      <ellipse cx="81" cy="296" rx="16" ry="20" fill="#6b7a3c"/>
      <rect x="130" y="308" width="3" height="26" fill="#5c3a26"/>
      <ellipse cx="131" cy="304" rx="13" ry="16" fill="#6b7a3c"/>
      <rect x="640" y="270" width="60" height="46" fill="#f2e3c4"/>
      <polygon points="634,270 670,236 706,270" fill="#b5573c"/>
      <rect x="660" y="288" width="16" height="28" fill="#8c5c46"/>
      <rect x="760" y="290" width="30" height="26" fill="#e9d6ae"/>
      <ellipse cx="775" cy="288" rx="16" ry="10" fill="#e9d6ae"/>
      <rect x="772" y="266" width="6" height="24" fill="#e9d6ae"/>
      <path d="M300,318 L330,318 L318,338 L288,338 Z" fill="#5c3a26"/>
      <path d="M300,318 Q310,300 330,300" fill="none" stroke="#5c3a26" stroke-width="4"/>
    </svg>`,
    narrative: [
      "<a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a>, fils de <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a>, épousa <a class=\"person-link\" href=\"personne.html#elisabeth-sutterer\">Élisabeth Sutterer</a>. Leur fils <a class=\"person-link\" href=\"personne.html#georges-billeux\">Georges</a> naquit le vingt-sept juillet mille huit cent soixante-quatorze, à Oued el Alleug — non pas à Mouzaïa, mais au pied de l'Atlas tellien, dans cette plaine où les vignes et les blés côtoient les figuiers et où l'on se lève tôt parce que la terre décide de presque tout.",
      "<a class=\"person-link\" href=\"personne.html#georges-billeux\">Georges</a> devint cultivateur. Le même mot, transmis de <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a> à <a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a> peut-être, de Germain à tous ceux qui vinrent après — mot de paysan, mot de colon, mot de celui qui met les mains dans la terre et ne demande rien d'autre au ciel.",
      "Le neuf décembre mille huit cent quatre-vingt-dix-neuf, à Mouzaïa, il épousa <a class=\"person-link\" href=\"personne.html#celeste-parisot\">Céleste Eugénie Parisot</a>. Moins d'un an plus tard naquit <a class=\"person-link\" href=\"personne.html#hubert-georges-billeux\">Hubert Georges</a> — prénom composé, nœud dans une corde qui lie le fils au père et au grand-père. <a class=\"person-link\" href=\"personne.html#yvonne-billeux\">Yvonne</a>, vers mille neuf cent sept. <a class=\"person-link\" href=\"personne.html#fernand-billeux\">Fernand</a>, le quinze juin mille neuf cent neuf, à Oued-Amizour, du côté de Béjaïa — loin de Mouzaïa, vers l'est, vers la mer, vers cette Kabylie où la famille glissait lentement comme glissent les ombres sur une colline au coucher du soleil.",
      "En mille neuf cent vingt et un, <a class=\"person-link\" href=\"personne.html#hubert-georges-billeux\">Hubert Georges</a> se maria à Troyes avec <a class=\"person-link\" href=\"personne.html#mariette-pettinelli\">Mariette Pettinelli</a> — preuve que la famille, même enracinée en Algérie, n'avait jamais coupé le cordon avec la métropole. Une fille en 1935. Divorce en 1936. D'autres femmes, d'autres lieux — car on n'a qu'une vie et plusieurs pays dans le cœur.",
      "<a class=\"person-link\" href=\"personne.html#georges-billeux\">Georges</a> mourut le premier janvier mille neuf cent trente-sept, à Alger. Soixante-deux ans. Loin d'Oued el Alleug où il était né, loin de Mouzaïa où il s'était marié. Capitale coloniale, ville blanche, fin d'un monde qu'il ne verrait pas achever."
    ],
    cards: [
      {
        type: 'lieu',
        title: 'Oued el Alleug',
        text: "Commune agricole de la wilaya de Tipasa, au pied de l'Atlas tellien, à une trentaine de kilomètres au sud-ouest de Mouzaïa. Vignes, blé et figuiers s'y partagent une plaine irriguée par les oueds descendant de la montagne."
      },
      {
        type: 'anecdote',
        title: 'Vers l\'est, vers la Kabylie',
        text: "<a class=\"person-link\" href=\"personne.html#fernand-billeux\">Fernand Billeux</a>, benjamin de Georges et Céleste, naît en 1909 à Oued-Amizour, près de Béjaïa — à plus de 200 kilomètres à l'est de Mouzaïa. Entre la naissance d'Hubert Georges (1900) et celle de Fernand (1909), la famille a donc parcouru toute la Kabylie, avant que la génération suivante ne revienne vers l'ouest, à Bordj Menaïel."
      }
    ]
  },
  {
    id: 'retour',
    map: 'img/carte-retour.png',
    years: '1900 – 2026',
    place: 'Bordj Menaïel, Chaumont, Tours — 1900–2026',
    illustration: `<svg viewBox="0 0 900 400" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sky4" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6b4a3a"/><stop offset="45%" stop-color="#c9895a"/><stop offset="100%" stop-color="#e9c07a"/>
      </linearGradient></defs>
      <rect width="900" height="400" fill="url(#sky4)"/>
      <circle cx="200" cy="110" r="28" fill="#f2d19a"/>
      <path d="M0,260 Q225,220 450,250 T900,235 L900,400 L0,400 Z" fill="#4a3324"/>
      <path d="M0,300 Q225,270 450,296 T900,282 L900,400 L0,400 Z" fill="#6b4a30"/>
      <ellipse cx="470" cy="280" rx="46" ry="30" fill="#3a2818"/>
      <ellipse cx="540" cy="290" rx="34" ry="22" fill="#3a2818"/>
      <ellipse cx="400" cy="292" rx="30" ry="20" fill="#3a2818"/>
      <rect x="600" y="266" width="46" height="36" fill="#241a12"/>
      <polygon points="596,266 623,240 650,266" fill="#241a12"/>
      <rect x="614" y="278" width="14" height="24" fill="#12100c"/>
      <rect x="700" y="278" width="30" height="24" fill="#2e2118"/>
      <polygon points="697,278 715,258 733,278" fill="#2e2118"/>
      <path d="M120,340 C160,320 180,300 210,310" fill="none" stroke="#3a2818" stroke-width="4"/>
      <path d="M170,312 C185,300 200,292 210,296" fill="none" stroke="#5a7a4a" stroke-width="3"/>
      <path d="M175,320 C190,312 200,300 205,298" fill="none" stroke="#5a7a4a" stroke-width="3"/>
      <ellipse cx="200" cy="292" rx="7" ry="4" fill="#6f8f56"/>
      <ellipse cx="208" cy="297" rx="6" ry="4" fill="#6f8f56"/>
    </svg>`,
    narrative: [
      "Et pourtant les noms reviennent.",
      "<a class=\"person-link\" href=\"personne.html#hubert-georges-billeux\">Hubert Georges</a> — né à Mouzaïa, mort à Chaumont, en Haute-Marne, le vingt mars mille neuf cent soixante-dix-neuf. Il y eut trois femmes dans sa vie. Il les aima comme on aime trois pays qu'on ne possède jamais tout à fait. La boucle se referme sans qu'on l'ait voulu — comme se referment toujours les histoires de famille, qui ne sont jamais que des cercles qu'on croit être des lignes droites.",
      "Chaumont, ville de gantiers. Pershing y établit son quartier général en 1917 ; <a class=\"person-link\" href=\"personne.html#hubert-georges-billeux\">Hubert Georges</a> avait dix-sept ans et vit passer des soldats venus d'un continent que ses ancêtres avaient quitté en sens inverse un siècle plus tôt. Plus tard, le viaduc se brisa sous les bombes de 1944 ; on le relève pierre après pierre — comme on relève toujours ce qui refuse de rester tombé.",
      "Après la mort de <a class=\"person-link\" href=\"personne.html#georges-billeux\">Georges</a> à Alger, la descendance poursuit vers l'est. <a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles Marc Billeux</a> naît à Bordj Menaïel, sur la côte de Boumerdès — cinquante kilomètres à l'est d'Alger, pays d'orangers et de collines. Il y vit jusqu'à ses seize ans. Son père est réparateur de machines agricoles sur une exploitation : de la charrue du vigneron <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a> au moteur diesel, la main reste la même, seule la machine change.",
      "À seize ans, <a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles</a> part pour la France. Tours devient sa ville. <a class=\"person-link\" href=\"personne.html#chantal-captien\">Chantal Captien</a> devient son épouse.",
      "<a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles Marc</a> écrivit un jour, seul devant son ordinateur, une lettre pour ne pas oublier — mon arrière-grand-père, mon arrière-arrière-grand-père — comme on écrit sur les tombes pour que les pierres se souviennent à notre place.",
      "Et il y a toi, <a class=\"person-link\" href=\"personne.html#christophe-olivier-billeux\">Christophe Olivier</a>, qui reprends le fil là où il l'a laissé. Tu remontes le courant du Doubs jusqu'à Alle. Tu remontes jusqu'à <a class=\"person-link\" href=\"personne.html#jean-francois-billieux\">Jean-François</a> et <a class=\"person-link\" href=\"personne.html#marguerite-bregnard\">Marguerite</a> dont on ne sait presque rien sinon qu'ils ont existé — et que de leur existence, à travers treize générations, la mer traversée deux fois, les églises de Zommange et de Guébling, les vignes de Bouillonville, les collines d'Alger, Bordj Menaïel, les rues de Tours — de tout cela, tu es la suite. Tu es ce que les morts ont rêvé sans le savoir en donnant un nom à un enfant."
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Pershing à Chaumont',
        text: "En septembre 1917, le général John J. Pershing établit à Chaumont le grand quartier général du corps expéditionnaire américain — la ville devient, pour la durée de la guerre, un centre nerveux de l'effort allié.",
        source: 'https://fr.wikipedia.org/wiki/Chaumont_(Haute-Marne)'
      },
      {
        type: 'histoire',
        title: 'Le viaduc détruit et reconstruit',
        text: "Le viaduc de Chaumont, monument emblématique de la ville, est partiellement détruit par les bombardements de 1944 avant d'être restauré dans l'après-guerre.",
        source: 'https://fr.wikipedia.org/wiki/Chaumont_(Haute-Marne)'
      },
      {
        type: 'lieu',
        title: 'Chaumont, ville de gantiers',
        text: "Jusqu'au milieu du XXe siècle, Chaumont vit largement de la ganterie — la maison Tréfousse y est l'une des plus réputées, exportant ses gants jusqu'à Paris."
      },
      {
        type: 'anecdote',
        title: 'La lettre de Charles Marc',
        text: "Le 12 avril 2020, <a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles Marc Billeux</a> s'envoie à lui-même un e-mail intitulé « Généalogie », annotant les fiches d'émigration de 1856 : « MON. AR. GP » pour <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a>, « MON. AR. AR. GP » pour <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a>. C'est ce document qui a permis de relier la branche d'Algérie à celle de Lorraine."
      },
      {
        type: 'histoire',
        title: "L'effondrement du pont Wilson",
        text: "<a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles Marc Billeux</a> et <a class=\"person-link\" href=\"personne.html#chantal-captien\">Chantal Captien</a> s'installent à Monts, près de Tours. Le dimanche 9 avril 1978, à 9h27, une pile et deux arches du pont Wilson s'effondrent en plein cœur de Tours, coupant l'alimentation en eau de plus de 100 000 habitants — un événement marquant pour toute l'agglomération tourangelle où grandit alors le jeune Christophe Olivier, âgé de six ans.",
        source: 'https://memoire.ciclic.fr/magazine/autour-des-archives/tours-1978-la-chute-du-pont-wilson'
      }
    ]
  }
];

// Épilogue — clôt le récit après le dernier chapitre. "generations" liste la lignée
// directe, 100% avérée, telle que présentée dans la chronique (13 générations,
// de Pequegnot Billeux à Christophe Olivier Billeux).
const EPILOGUE = {
  title: 'VI · Ce qui reste',
  narrative: [
    "Il n'y a pas d'amour heureux — disait le poète, et il avait raison, car l'amour des morts est celui qu'on ne peut pas leur rendre, seulement le deviner dans les registres qu'ils ne reliront jamais.",
    "Il n'y a peut-être pas non plus de généalogie tout à fait achevée. Seulement des noms qui appellent d'autres noms. Des actes qu'un curé écrivit en latin. Des certificats de non-opposition scellés à Alle. Des bateaux partis de Marseille. Des cultivateurs morts à Alger. Des réparateurs de machines à Bordj Menaïel. Des lettres qu'un homme s'écrit à lui-même pour ne pas oublier.",
    "<a class=\"person-link\" href=\"personne.html#pequegnot-billieux\">Pequegnot</a>. <a class=\"person-link\" href=\"personne.html#pierre-bileux\">Pierre</a>. <a class=\"person-link\" href=\"personne.html#nicolas-billieux-aine\">Nicolas</a> et <a class=\"person-link\" href=\"personne.html#anne-gevaudin\">Anne</a>. <a class=\"person-link\" href=\"personne.html#jean-francois-billieux\">Jean-François</a> et <a class=\"person-link\" href=\"personne.html#marguerite-bregnard\">Marguerite</a>. <a class=\"person-link\" href=\"personne.html#nicolas-billieux\">Nicolas</a> et <a class=\"person-link\" href=\"personne.html#suzanne-rossel\">Suzanne</a>. <a class=\"person-link\" href=\"personne.html#germain-billieux\">Germain</a>. <a class=\"person-link\" href=\"personne.html#hubert-billieux-1772\">Hubert</a> et <a class=\"person-link\" href=\"personne.html#rose-cesar\">Rose</a>. <a class=\"person-link\" href=\"personne.html#louis-billieux\">Louis</a> et <a class=\"person-link\" href=\"personne.html#marie-michel\">Marie</a>. <a class=\"person-link\" href=\"personne.html#hubert-billieux-1838\">Hubert</a> et <a class=\"person-link\" href=\"personne.html#elisabeth-sutterer\">Elisabeth</a>. <a class=\"person-link\" href=\"personne.html#georges-billeux\">Georges</a> et <a class=\"person-link\" href=\"personne.html#celeste-parisot\">Céleste</a>. <a class=\"person-link\" href=\"personne.html#hubert-georges-billeux\">Hubert Georges</a>. <a class=\"person-link\" href=\"personne.html#charles-marc-billeux\">Charles</a> et <a class=\"person-link\" href=\"personne.html#chantal-captien\">Chantal</a>. <a class=\"person-link\" href=\"personne.html#christophe-olivier-billeux\">Christophe Olivier</a>.",
    "Treize générations. Deux pays. Une mer traversée deux fois.",
    "Il y eut Alle. Il y eut l'Algérie. Il y eut le retour — non pas un retour au village d'origine, jamais Alle retrouvée, seulement une autre France, une autre rive, une autre manière de dire je suis de quelque part quand on ne l'est plus tout à fait nulle part."
  ],
  closing: "Rien ne subsiste que ce qui fut écrit — et ce que tu écris encore.",
  generations: [
    { n: 1, html: '<a class="person-link" href="personne.html#pequegnot-billieux">Pequegnot Billieux</a>', note: '1626, Alle' },
    { n: 2, html: '<a class="person-link" href="personne.html#pierre-bileux">Pierre Billeux</a> × <a class="person-link" href="personne.html#clemence-magnin">Clémence Magnin</a>', note: '1626' },
    { n: 3, html: '<a class="person-link" href="personne.html#nicolas-billieux-aine">Nicolas Billieux</a> × <a class="person-link" href="personne.html#anne-gevaudin">Anne Gevaudin</a>', note: '1669' },
    { n: 4, html: '<a class="person-link" href="personne.html#jean-francois-billieux">Jean-François Billieux</a> × <a class="person-link" href="personne.html#marguerite-bregnard">Marguerite Bregnard</a>', note: 'm. 1693' },
    { n: 5, html: '<a class="person-link" href="personne.html#nicolas-billieux">Nicolas Billieux</a> × <a class="person-link" href="personne.html#suzanne-rossel">Suzanne Rossel</a>', note: '° 1703, m. 1724' },
    { n: 6, html: '<a class="person-link" href="personne.html#germain-billieux">Germain Billieux</a>', note: '° 1728' },
    { n: 7, html: '<a class="person-link" href="personne.html#hubert-billieux-1772">Hubert Billieux</a> × <a class="person-link" href="personne.html#rose-cesar">Rose César</a>', note: '1772–1850' },
    { n: 8, html: '<a class="person-link" href="personne.html#louis-billieux">Louis Billieux</a> × <a class="person-link" href="personne.html#marie-michel">Marie Michel</a>', note: '1797–1857' },
    { n: 9, html: '<a class="person-link" href="personne.html#hubert-billieux-1838">Hubert Billieux</a> × <a class="person-link" href="personne.html#elisabeth-sutterer">Elisabeth Sutterer</a>', note: '1838–1898' },
    { n: 10, html: '<a class="person-link" href="personne.html#georges-billeux">Georges Billeux</a> × <a class="person-link" href="personne.html#celeste-parisot">Céleste Parisot</a>', note: '1874–1937' },
    { n: 11, html: '<a class="person-link" href="personne.html#hubert-georges-billeux">Hubert Georges Billeux</a>', note: '1900–1979' },
    { n: 12, html: '<a class="person-link" href="personne.html#charles-marc-billeux">Charles Marc Billeux</a> × <a class="person-link" href="personne.html#chantal-captien">Chantal Captien</a>', note: 'Bordj Menaïel → Tours' },
    { n: 13, html: '<a class="person-link" href="personne.html#christophe-olivier-billeux">Christophe Olivier Billeux</a>', note: '' }
  ]
};
