// Contenu du site — chronique (CAPTIEN / Kapgen).
// Pour ajouter un chapitre, compléter CHAPTERS ; `app.js` se charge du rendu.

const CHAPTERS = [
  {
    id: 'laudrefang',
    years: 'avant 1583 – 1693',
    place: 'Laudrefang — premières traces',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carte stylisée, Europe et Moselle">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,260 C170,220 250,240 350,210 C440,185 540,200 640,170 C740,140 820,160 900,130 L900,400 L0,400 Z" fill="#3b2f22"/>
        <path d="M0,310 C180,275 310,300 410,268 C520,234 640,250 750,220 C820,200 860,210 900,196 L900,400 L0,400 Z" fill="#2b2218"/>
        <circle cx="565" cy="180" r="9" fill="#2f6f6a"/>
        <path d="M565,180 L610,150" stroke="#2f6f6a" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
        <text x="620" y="154" fill="#ede4cf" font-size="16" font-family="Georgia" opacity="0.82">Laudrefang</text>
      </svg>`,
    narrative: [
      `Bon. Alors voilà, on va y aller… doucement… parce que là-bas, dans les registres, y a rien qui presse. Rien qui crie. Juste des noms qui reviennent, tenaces… comme des mauvaises herbes qu'on n'arrache pas, qu'on laisse repousser, parce qu'au fond on les aime bien, ces mauvaises herbes-là, c'est nous.`,
      `Avant 1583… tenez-vous bien… voilà <a class="person-link" href="personne.html#georges-schneider-1583">Georges SCHNEIDER</a>. On sait presque rien de lui. Pas de métier noté, pas de maison décrite, rien. Juste qu'il a existé, qu'il s'est marié vers 1600 avec une certaine <a class="person-link" href="personne.html#christine-nn-schneider">Christine</a>… dont même le nom de jeune fille s'est perdu en route, quelque part entre deux siècles, dans la poussière d'un curé qui écrivait vite, qui écrivait mal, qui écrivait pour lui et pas pour nous. NN, qu'on note. Nomen nescio. On ne sait pas le nom. Ça, c'est tout ce qui reste d'elle… trois lettres et un vide.`,
      `Deux fils leur viennent. <a class="person-link" href="personne.html#valentin-schneider-1603">Valentin</a>, vers 1603… et son frère <a class="person-link" href="personne.html#quirin-virich-schneider-1615">Quirin Virich</a>, vers 1615, prénom qu'on dirait tombé d'un autre siècle, d'une autre langue presque, allemande ou lorraine, allez savoir. Valentin, lui, il tiendra… quatre-vingt-dix ans, tenez-vous bien, quatre-vingts et des poussières, né vers 1603 et mort le 27 août 1693 à Laudrefang même, sans avoir bougé, ou presque. Une vie entière dans le même village. Ça paraît rien dit comme ça… c'est pourtant une prouesse, à cette époque, où la moitié des gosses n'atteignaient pas leurs dix ans.`,
      `On n'a pas de château, nous, pas de blason. On a Laudrefang, un couloir entre deux frontières qui n'arrêtent pas de bouger, et des noms qui s'accrochent comme ils peuvent au bord des paroisses. C'est peu… et c'est déjà tout.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Aux portes des Temps modernes',
        text: `Fin du XVIe… début du XVIIe… en Lorraine on sort tout juste des guerres de Religion, et déjà s'annonce la Trentenaire, celle qui va saigner le pays jusqu'à l'os, entre 1618 et 1648. Les registres paroissiaux, obligatoires depuis 1539 (ordonnance de Villers-Cotterêts), deviennent alors la seule mémoire fiable des gens sans terre, sans titre, sans rien que leur nom et leur baptême.`
      },
      {
        type: 'lieu',
        title: 'Laudrefang (Moselle)',
        text: `Petit village du pays de Bouzonville, sur la route qui va de Metz vers la Sarre. On y laboure, on y vit de peu, on y meurt jeune. Les frontières politiques changent — duché de Lorraine, influence des Trois-Évêchés — mais le village, lui, ne bouge pas d'un pouce en trois siècles.`
      },
      {
        type: 'anecdote',
        title: 'Kapgen, une orthographe qui dérive',
        text: `Dans les écritures anciennes, les lettres glissent, comme les accents glissent d'une bouche à l'autre. « Kapgen »… c'est une variante attestée dans la tradition orale de la famille, une manière plus ancienne, peut-être plus germanique, de dire ce même nom. On la note, par honnêteté… mais on ne renomme personne. Les gens s'appelaient comme les actes les appelaient, et c'est déjà bien assez compliqué comme ça.`
      }
    ]
  },
  {
    id: 'bambiderstroff',
    years: '1684 – 1727',
    place: 'Bambiderstroff — Jean (Haman) & Marie Jungers',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Village stylisé, Bambiderstroff">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,280 Q250,230 450,260 T900,245 L900,400 L0,400 Z" fill="#3b2f22"/>
        <g fill="#3b2f22">
          <rect x="560" y="215" width="70" height="70"/><polygon points="555,215 595,182 635,215"/>
          <rect x="662" y="230" width="54" height="55"/><polygon points="658,230 689,202 720,230"/>
          <rect x="120" y="235" width="58" height="60"/><polygon points="116,235 149,208 182,235"/>
        </g>
        <path d="M450,110 C450,92 432,86 426,98 C418,116 442,124 450,108" fill="none" stroke="#2f6f6a" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
      </svg>`,
    narrative: [
      `Une génération, ça sert parfois juste à faire le pont. À relier deux rives qui, sans elle, resteraient chacune de leur côté, à jamais séparées. Ici, c'est ce qui se passe… entre la souche SCHNEIDER et ce qui va devenir la lignée CAPTIEN. Un pont d'une seule génération, pas plus, et qui tient bon quand même.`,
      `<a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a>, laboureur — né en 1667, on ne sait pas où au juste, mais mort le 13 décembre 1727 à Bambiderstroff, ça au moins c'est sûr — épouse <a class="person-link" href="personne.html#marie-jungers">Marie JUNGERS</a> le 28 novembre 1684. Il a dix-sept ans. Dix-sept ans, et déjà marié, déjà à labourer sa terre, déjà à construire une famille qui ne saura jamais qu'elle construisait, justement, une famille qui traverserait trois siècles pour arriver jusqu'à nous.`,
      `Marie, elle, s'éteindra le 7 septembre 1720 à Bambiderstroff. Sept ans avant son mari. C'est comme ça, dans ces vies-là… on ne sait jamais qui partira le premier, on fait des enfants sans savoir qui restera pour les élever.`,
      `Et de ce couple naît <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique</a>, le 29 avril 1695. C'est elle, la charnière — la pièce qui tient tout l'édifice, sans qu'elle en ait jamais eu conscience, remarquez, elle a juste vécu sa vie, comme tout le monde. Avec elle entre un autre nom dans la lignée : <a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas CAPTIEN</a>, né la même année qu'elle, 1695, quelque part — on ne sait pas où, la source reste muette là-dessus. Les actes s'enchaînent, une union, un enfant, puis une nouvelle paroisse. C'est ainsi que ça se transmet, un nom : par une seule union, un seul soir de noces, et plus rien n'est jamais pareil après.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Après les guerres : reconstruire',
        text: `Le tournant du XVIIIe siècle, en Lorraine, c'est celui de la reprise démographique après un siècle et demi de guerres, d'épidémies, de disettes. Les campagnes se repeuplent lentement, les mariages se font entre familles voisines — on n'allait pas chercher plus loin qu'il ne fallait, la route coûtait cher et le temps encore plus.`
      },
      {
        type: 'lieu',
        title: 'Bambiderstroff',
        text: `Village mosellan du canton de Boulay, tout près de la frontière avec le Luxembourg et la Sarre. On y vit de la terre, des saisons, des labours. Les registres paroissiaux y parlent surtout de métiers simples — laboureurs, journaliers — et d'un tissu familial serré, qui ne lâche jamais tout à fait prise.`
      },
      {
        type: 'anecdote',
        title: 'Marié à dix-sept ans',
        text: `Jean (Haman) SCHNEIDER se marie le 28 novembre 1684, alors qu'il n'a — si l'on en croit sa date de naissance, 1667 — que dix-sept ans. Un âge qui nous paraît aujourd'hui d'une précocité folle, mais qui n'était pas rare dans les campagnes de l'Ancien Régime, où l'on épousait tôt pour avoir des bras tôt, pour travailler la terre tant qu'il en était encore temps.`
      }
    ]
  },
  {
    id: 'mondorf',
    years: '1718 – 1820',
    place: 'Mondorf-les-Bains — Luxembourg',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rivière et pont stylisés, Luxembourg">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,255 C220,210 310,240 420,210 C530,178 650,190 900,160 L900,400 L0,400 Z" fill="#3b2f22"/>
        <path d="M0,170 C180,210 260,240 360,260 C520,290 650,280 900,250" fill="none" stroke="#2f6f6a" stroke-width="10" opacity="0.55"/>
        <path d="M290,212 Q450,150 610,190" fill="none" stroke="#ede4cf" stroke-width="4" opacity="0.4"/>
        <circle cx="450" cy="150" r="10" fill="#ede4cf" opacity="0.6"/>
      </svg>`,
    narrative: [
      `La lignée CAPTIEN se fixe alors à Mondorf-les-Bains, au Luxembourg. Et elle y reste. Un siècle, et davantage — quatre générations qui naissent, se marient, meurent au même endroit, sur les mêmes registres, sous la même cloche.`,
      `<a class="person-link" href="personne.html#christian-captien-1718">Christian CAPTIEN</a>, né le 19 janvier 1718 — fils de ce Nicolas et de cette Angélique dont on vient de parler — épouse <a class="person-link" href="personne.html#lucie-thomas">Lucie THOMAS</a> le 22 juin 1743. Il a vingt-cinq ans. Lucie mourra la première, le 22 janvier 1772 ; lui la suivra le 2 février 1788, à soixante-dix ans passés, un bel âge pour l'époque, un âge qu'on n'atteignait pas sans un peu de chance et beaucoup d'obstination.`,
      `Leur fils <a class="person-link" href="personne.html#francois-captien-1748">François CAPTIEN</a>, né le jour de Noël 1748 — un enfant de Noël, tiens, ça ne s'invente pas — devient maçon. Il épouse <a class="person-link" href="personne.html#jeanne-wagner">Jeanne WAGNER</a> le 17 septembre 1785. Il a alors trente-sept ans, elle on ne sait pas. Un mariage tardif, pour l'époque, mais qui donnera quatre enfants : Jacques (1786), Jean (1788), <a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth</a> (1790) et Nicolas (1793).`,
      `Jacques, le premier, mourra en 1811, à vingt-cinq ans à peine — on ne sait ni comment ni pourquoi, la source ne le dit pas, elle donne juste les deux dates et nous laisse imaginer le reste, ce qu'on préfère ne pas trop faire. François lui-même s'éteint le 16 janvier 1820 à Mondorf-les-Bains, dans ce canton de Remich qu'il n'aura jamais quitté. C'est Élisabeth qui portera la suite — jusqu'à Manom, jusqu'à nous, jusqu'à cette phrase que vous êtes en train de lire, là, maintenant.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Révolutions, Empire, villages',
        text: `Entre 1748 et 1820, l'Europe change trois fois de régime — Ancien Régime, Révolution, Empire, Restauration — et le Luxembourg lui-même passe de mains en mains, autrichiennes, françaises, puis à nouveau autres. Dans les villages pourtant, la continuité tient à des choses simples : naissances, métiers, mariages, décès. La phrase répétée des registres, encore et encore, quoi qu'il arrive au-dessus.`
      },
      {
        type: 'lieu',
        title: 'Mondorf-les-Bains',
        text: `Aujourd'hui station thermale réputée pour ses eaux, Mondorf-les-Bains n'était alors, au XVIIIe siècle, qu'un village agricole du canton de Remich, dans le Grevenmacher luxembourgeois. On s'y déplaçait à l'échelle des paroisses, des marchés voisins, des alliances entre familles qui se connaissaient depuis toujours.`
      },
      {
        type: 'anecdote',
        title: 'Des métiers qui laissent des traces',
        text: `« Maçon », ça revient d'une génération à l'autre — Christian, François, plus tard Paul et Nicolas porteront tous ce même métier. Ce n'est pas rien, un métier qui se transmet ainsi, presque malgré soi : ça dit une manière de bâtir, de réparer, de tenir debout ce qui menace de tomber. Une famille de maçons… ça construit des maisons, et sans le savoir, ça construit aussi sa propre histoire, pierre après pierre.`
      }
    ]
  },
  {
    id: 'manom-mondorff',
    years: '1821 – 1918',
    place: 'Manom / Mondorff — de Paul à Nicolas',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chantier stylisé, pierre et maçonnerie">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,265 Q210,230 450,252 T900,238 L900,400 L0,400 Z" fill="#3b2f22"/>
        <g fill="none" stroke="#ede4cf" opacity="0.5" stroke-width="3">
          <path d="M140,270 H300"/><path d="M160,246 H320"/><path d="M180,222 H340"/>
        </g>
        <rect x="610" y="210" width="190" height="110" fill="none" stroke="#2f6f6a" stroke-width="5" opacity="0.65"/>
        <path d="M610,210 L705,160 L800,210" fill="none" stroke="#2f6f6a" stroke-width="5" opacity="0.65"/>
      </svg>`,
    narrative: [
      `<a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth CAPTIEN</a>, née le 23 janvier 1790 à Mondorf-les-Bains, meurt le 28 décembre 1862 à Manom. Entre les deux dates, toute une vie qu'on devine plus qu'on ne la connaît — le père de ses enfants reste inconnu, disparu des sources sans laisser de nom, comme tant d'hommes de cette époque-là, qui passent et ne laissent qu'une trace indirecte, celle des enfants qu'ils ont engendrés. Une fille, Barbe, née vers 1815… morte le 13 avril 1820, à cinq ans à peine. Et un fils, <a class="person-link" href="personne.html#paul-captien-1821">Paul</a>, né le 1er février 1821 à Mondorff, qui lui survivra, qui portera la suite.`,
      `Avec Paul, la ligne s'installe à Manom, aux confins du Luxembourg, tout près, tout sensible, une frontière qu'on traverse comme on traverse une rue. Maçon comme son grand-père et son arrière-grand-père avant lui, il épouse <a class="person-link" href="personne.html#marie-ligne">Marie LIGNE</a> le 21 janvier 1845. Et le couple traverse ce que traversent toutes les familles du XIXe siècle : des naissances, beaucoup de naissances — sept enfants en tout — et des décès en bas âge, tout autant.`,
      `Élisabeth (1846), morte à trois ans en 1849. Jacques (1855), mort un mois après sa naissance. Catherine (1857), morte à moins de deux mois. Jean (1861), mort à quatorze jours. Quatre enfants sur sept, fauchés avant d'avoir vécu. C'est ça, le XIXe siècle rural — on en parle peu, on préfère les dates de naissance aux dates de mort, mais les registres, eux, ne trichent pas. Seuls trois survivront : Cécile Lucile, mariée à Jean Gacher en 1881 ; Barbe, mariée à un Bidon en 1864 ; et surtout <a class="person-link" href="personne.html#nicolas-captien-1849">Nicolas</a>, né le 5 juillet 1849, qui portera seul le nom plus loin.`,
      `Nicolas, maçon lui aussi — le quatrième de la lignée à porter cette truelle, tenez-vous bien —, épouse Catherine LENARD le 4 février 1879 à Manom. De leur union naîtront six enfants, dont un seul, encore, portera la suite jusqu'à nous : <a class="person-link" href="personne.html#francois-captien-1885">François</a>, né en 1885. Nicolas meurt le 1er janvier 1918, jour de l'an, dans un pays alors occupé, à quelques mois de la fin d'une guerre qu'il n'aura pas vue se terminer.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Le XIXe siècle : routes, usines, frontières',
        text: `Le siècle, c'est celui des transformations matérielles — chemins de fer, sidérurgie lorraine naissante, frontières redessinées après 1871 quand la Moselle devient allemande. Les villages restent des villages, mais ils se rapprochent des villes, des voies ferrées, des administrations qui, elles, changent de langue tous les cinquante ans.`
      },
      {
        type: 'lieu',
        title: 'Manom / Mondorff',
        text: `Un même territoire peut s'écrire de plusieurs façons — Mondorff avec deux f côté français, Mondorf sans, côté luxembourgeois. Les familles, elles, s'en moquent : elles vivent sur place, une géographie quotidienne au bord des chemins, entre deux pays qui n'en font parfois qu'un.`
      },
      {
        type: 'anecdote',
        title: 'Les enfants perdus',
        text: `Sur les sept enfants de Paul CAPTIEN et Marie LIGNE, quatre meurent avant l'âge de trois ans — Élisabeth, Jacques, Catherine, Jean. Un arbre généalogique, ça n'est pas que de la continuité qui s'écrit en ligne droite : ça porte aussi, et peut-être surtout, les absences. Chaque génération de cette famille, jusqu'ici, en a compté au moins une. C'est le prix qu'on payait, avant, juste pour continuer.`
      }
    ]
  },
  {
    id: 'verdun-saint-avold',
    years: '1885 – 1969',
    place: 'Manom / Verdun / Saint-Avold — François (1885)',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Verdun stylisé, fort et horizon">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,260 Q240,215 450,245 T900,232 L900,400 L0,400 Z" fill="#3b2f22"/>
        <path d="M180,235 H350 L335,285 H195 Z" fill="none" stroke="#ede4cf" stroke-width="4" opacity="0.45"/>
        <path d="M210,250 H320" stroke="#2f6f6a" stroke-width="5" opacity="0.55"/>
        <circle cx="740" cy="135" r="32" fill="none" stroke="#2f6f6a" stroke-width="6" opacity="0.7"/>
      </svg>`,
    narrative: [
      `<a class="person-link" href="personne.html#francois-captien-1885">François CAPTIEN</a>, né le 13 juillet 1885 à Manom, traverse un siècle qui ne lui fera pas de cadeau. Serrurier, puis cheminot — un métier de précision, de rails et d'horaires, bien loin de la truelle des ancêtres, mais tout aussi exigeant à sa manière.`,
      `1916. Il a trente et un ans. Verdun. Le Fort de Vaux. On ne sait pas exactement ce qu'il y a vécu — les archives familiales ne disent que le nom du fort, rien de plus — mais on sait ce que fut Verdun pour ceux qui y ont mis les pieds : un endroit où la terre elle-même semblait vouloir mourir avec les hommes. Il en revient. C'est déjà, en soi, tout un roman qu'on ne lira jamais.`,
      `Marié une première fois à Catherine HIPPERT, le 7 octobre 1912 — avant la guerre, donc, avant que le monde ne bascule —, il en aura six enfants. Catherine meurt le 16 novembre 1931 à Manom. Parmi ces six enfants : <a class="person-link" href="personne.html#marthe-elise-captien-1917">Marthe Élise</a>, née le 13 août 1917 en pleine guerre, morte un mois plus tard, le 17 septembre. <a class="person-link" href="personne.html#emilie-captien-1919">Émilie</a>, née en 1919, l'année de la paix, qui vivra elle quatre-vingt-dix ans, jusqu'en 2009. Et puis <a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand</a>, né en 1922, qui portera la suite.`,
      `Il y a aussi <a class="person-link" href="personne.html#marguerite-adele-captien-1924">Marguerite Adèle</a> (1924) et sa cadette, une autre <a class="person-link" href="personne.html#adele-captien-1925">Adèle</a> (1925, dont la source hésite même sur le sexe — un fils ou une fille, l'acte est resté ambigu) : toutes deux meurent la même année, 1945, à Manom. La même année que la fin de la guerre. On ne sait pas si c'est un hasard ou si l'Histoire, la grande, celle qu'on écrit avec une majuscule, est venue frapper une deuxième fois à la porte de cette famille-là. Les sources ne le disent pas. On note, et on referme la page, parce qu'il y a des silences qu'on ne force pas.`,
      `François se remarie en 1932, avec <a class="person-link" href="personne.html#rose-marie-weber">Rose Marie WEBER</a>, dont naîtra <a class="person-link" href="personne.html#andree-captien-1933">Andrée</a> en 1933. Il meurt le 21 mars 1969 à Manom, dans le même village où il était né quatre-vingt-quatre ans plus tôt — après avoir traversé deux guerres, deux mariages, sept enfants et un siècle entier qui n'aura, décidément, jamais rien épargné à personne.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Verdun (1916) : le choc de la guerre',
        text: `Le Fort de Vaux, pris et repris entre mars et novembre 1916, symbolise à lui seul l'acharnement de la bataille de Verdun — dix mois de feu continu, plus de trois cent mille morts des deux côtés. Pour les familles de l'arrière comme pour les survivants, l'après-guerre se construit avec un mélange d'oubli nécessaire et de souvenirs tenaces, qu'on ne raconte qu'à demi-mot, ou pas du tout.`
      },
      {
        type: 'lieu',
        title: 'Manom, Verdun, Saint-Avold',
        text: `Le parcours de François dessine un triangle de vie : un village d'origine, Manom ; un front, Verdun ; puis, pour son fils, une ville où l'on se réinstalle, Saint-Avold. Cafés, gares, ateliers — une géographie de travail plus que de repos.`
      },
      {
        type: 'anecdote',
        title: '1945 : deux sœurs, une même année',
        text: `Marguerite Adèle (21 ans) et sa cadette Adèle (20 ans) meurent toutes deux en 1945, à Manom. La source ne précise ni cause ni circonstance. On peut y voir une simple coïncidence de registre — ou le dernier écho, tardif et cruel, d'une guerre qui continuait de prendre son dû longtemps après les premiers coups de feu. À vérifier, un jour, si les actes le permettent.`
      }
    ]
  },
  {
    id: 'tours',
    years: '1922 – 2013',
    place: 'Manom / Saint-Avold / Tours — François Armand, Odile, Chantal',
    illustration: `
      <svg viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Route et enseigne stylisées, Saint-Avold et Touraine">
        <rect width="900" height="400" fill="#1a1410"/>
        <path d="M0,255 Q225,215 450,242 T900,230 L900,400 L0,400 Z" fill="#3b2f22"/>
        <path d="M0,300 Q225,275 450,296 T900,285 L900,400 L0,400 Z" fill="#2b2218"/>
        <path d="M480,400 L560,210" stroke="#ede4cf" stroke-width="6" opacity="0.35"/>
        <rect x="580" y="210" width="180" height="90" fill="none" stroke="#2f6f6a" stroke-width="6" opacity="0.7"/>
        <text x="598" y="265" fill="#ede4cf" font-size="16" font-family="Georgia" opacity="0.78">PMU · Bar · Bowling</text>
      </svg>`,
    narrative: [
      `Au XXe siècle, la chronique se rapproche de nous. On entend mieux les pas, presque le souffle. <a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand CAPTIEN</a>, né le 10 décembre 1922 à Manom, sera aiguilleur à la SNCF — encore les rails, décidément, ça se transmet aussi bien qu'un nom — avant de devenir cafetier, ce qui est une autre manière, au fond, d'aiguiller les gens : vers un comptoir, un verre, une conversation.`,
      `Il épouse <a class="person-link" href="personne.html#odile-alexandrine-pierre">Odile Alexandrine PIERRE</a> le 22 novembre 1945 à Manom — l'année d'après la guerre, l'année où tout le monde se remariait, se reconstruisait, refaisait des enfants comme pour compenser tous ceux qu'on avait perdus. Odile est tapissière. Elle recouvre les fauteuils, retend les tissus, répare ce qui s'affaisse — un métier de patience, à l'image, sans doute, de sa vie avec François Armand, qui ne fut pas de tout repos : le couple divorcera le 20 octobre 1964, après dix-neuf ans de mariage et cinq enfants.`,
      `Car il y eut cinq enfants. <a class="person-link" href="personne.html#chantal-captien-1946">Chantal</a>, l'aînée, née le 12 avril 1946 à Amboise. Jean Marie, né en 1952, mort à neuf ans, le 11 août 1962, à Manom — encore un enfant qui s'en va trop tôt, comme il y en a eu tant avant lui dans cette famille, comme s'il fallait, à chaque génération, en payer le prix. <a class="person-link" href="personne.html#michel-captien-1955">Michel</a>, né le 16 novembre 1955 à Manom. Jean Claude, né en 1960 à Tours, mort à vingt-trois ans, le 13 juin 1983, à Montlouis-sur-Loire. Et Dominique, né en 1962 à Tours, le petit dernier.`,
      `Michel, lui, ira vers les cuisines. Cuisinier de métier — chef de brigade, plus tard maître d'hôtel, ou quelque chose d'approchant, les intitulés exacts se perdent un peu d'une maison à l'autre — toute une carrière passée entre le feu des fourneaux et le silence feutré des salles à manger, dans cette tradition très française des grandes maisons où l'on gravit les échelons à force de service, de saisons, de plats envoyés à l'heure. Deux mariages : Patricia Arivé en 1975, dont naît Delphine ; puis, bien plus tard, en 2018, Evelyne Courtin. Une fille encore, Floriane, en 1998. Une vie de brigade, justement — celle du travail en équipe, debout, tôt le matin et tard le soir, qu'on ne raconte jamais assez dans les livres, et qu'on raconte ici.`,
      `Et puis il y a cette histoire, qu'on tient de la mémoire familiale plus que des registres : un jour des années 1960, François Armand gagne au quinté. Un vrai coup, un gros coup. Et avec cet argent — avec Anne, dont on ne sait par ailleurs presque rien, sinon qu'elle apparaît une fois dans les sources, contredisant peut-être le mariage avec Odile, ou lui succédant, allez savoir — il ouvre à Saint-Avold un établissement sur trois étages. Bar au rez-de-chaussée, PMU au premier, bowling tout en haut. Trois étages pour boire, parier, et jouer aux quilles, le tout dans le même bâtiment, comme un résumé complet de ce qu'un homme peut faire de la chance quand elle lui tombe enfin dessus. Le fils, plus tard, tiendra sa propre cuisine — la chance d'un côté, le métier de l'autre, et entre les deux, toute une famille qui apprend à nourrir les autres.`,
      `Chantal, elle, montera vers Tours. Aide-comptable aux Établissements MEUNIER — un emploi discret, de ceux qu'on ne raconte pas dans les livres d'histoire, mais qui font tourner, tous les jours, sans bruit, le monde ordinaire. Mariée une première fois à Claude Louis Pinazo en 1963, à dix-sept ans à peine — une mise en ménage à Basse-Yutz avant même le mariage officiel —, puis à Charles Marc Billeux en 1976. Trois enfants de ces deux unions : Philippe Charles, Thierry Georges, Christophe Olivier.`,
      `Chantal meurt le 25 octobre 2013, à Luynes, d'une tumeur au cerveau. Elle avait soixante-sept ans. Crémation le 30 octobre ; ses cendres reposent au jardin du souvenir de Monts, cette même commune de Touraine où elle avait vécu tant d'années avec Charles Marc. C'est là, avec elle, que se referme cette chronique — provisoirement, comme se referment toujours les chroniques de famille, qui ne sont jamais tout à fait terminées, seulement interrompues, en attendant qu'on les reprenne.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Après-guerre : recomposer',
        text: `L'immédiat après-guerre, en France, c'est celui de la reconstruction des villes, des familles, des métiers — et d'un baby-boom qui voit naître, en quelques années à peine, des générations entières censées faire oublier celles qu'on avait perdues. Les déplacements se multiplient : on suit le travail, la SNCF, les affectations. On suit la vie, tout simplement, là où elle veut bien vous mener.`
      },
      {
        type: 'lieu',
        title: 'Manom → Saint-Avold → Tours',
        text: `La Moselle reste l'aimant d'origine, celui qu'on ne quitte qu'à contrecœur ; la Touraine devient la terre de la génération suivante, celle de Chantal et de ses enfants. Une géographie intime faite de gares, de routes, d'adresses qui changent — et d'un nom de famille qui, lui, continue de voyager avec ceux qui le portent.`
      },
      {
        type: 'anecdote',
        title: 'Le quinté et le bar (nom à retrouver)',
        text: `Années 1960 : François Armand CAPTIEN gagne un quinté, un vrai, de ceux qui changent une vie. Avec cet argent tombé du ciel, il ouvre à Saint-Avold un établissement sur trois niveaux — bar, PMU, bowling. Le nom exact de l'établissement s'est perdu, pour l'instant, entre deux générations qui n'ont pas pensé à le noter avant qu'il ne soit trop tard. Si quelqu'un s'en souvient encore… c'est le moment de le dire.`
      },
      {
        type: 'anecdote',
        title: 'Anne Knobloch, la mention qui ne colle pas',
        text: `Une mention isolée, dans la source consultée, évoque un mariage de François Armand CAPTIEN avec une certaine Anne KNOBLOCH, à Saint-Avold. Le souci, c'est qu'elle semble entrer en contradiction avec le mariage bien documenté de 1945 avec Odile Alexandrine Pierre. Erreur de saisie ? Union parallèle ou postérieure au divorce de 1964 ? On ne tranche pas, on la garde comme hypothèse ouverte — une de ces zones d'ombre que la généalogie ne referme pas toujours, et qu'il faut savoir laisser telles quelles plutôt que d'inventer une réponse qu'on n'a pas.`
      },
      {
        type: 'anecdote',
        title: 'Michel, de la brigade à la salle',
        text: `<a class="person-link" href="personne.html#michel-captien-1955">Michel CAPTIEN</a>, le frère de Chantal, a fait toute sa carrière dans la restauration — cuisinier, chef de brigade, puis maître d'hôtel (les intitulés précis restent à confirmer auprès de la famille). Une vie de métier exigeant, debout du matin au soir, dans cette hiérarchie très codifiée héritée d'Escoffier — la brigade de cuisine, où chacun tient son poste comme un soldat tient sa ligne. Une autre façon, après le rail et le comptoir des générations précédentes, de nourrir les siens.`
      }
    ]
  }
];

const EPILOGUE = {
  title: 'Ce qui reste',
  narrative: [
    `Voilà. On arrive au bout — au bout provisoire, puisqu'il n'y a jamais vraiment de bout, en généalogie, juste des points où on s'arrête pour reprendre son souffle.`,
    `Treize générations, du premier <a class="person-link" href="personne.html#georges-schneider-1583">Georges SCHNEIDER</a>, quelque part avant 1583, jusqu'à <a class="person-link" href="personne.html#chantal-captien-1946">Chantal CAPTIEN</a>, en 2013. Quatre siècles et demi. Des maçons, des laboureurs, un serrurier devenu cheminot puis cafetier, une tapissière, une aide-comptable, un cuisinier devenu chef de brigade puis maître d'hôtel. Des noms qui glissent — Schneider, Captien, Kapgen — comme glissent toutes les orthographes qu'un curé pressé jette sur un registre.`,
    `Et puis les enfants. Tellement d'enfants morts en chemin, à un mois, à trois ans, à neuf ans, à vingt et un ans — Barbe, Élisabeth, Jacques, Catherine, Jean, Marthe Élise, Marguerite Adèle, Adèle, Jean Marie, Jean Claude. Dix noms, au moins, qu'on pourrait aligner comme une litanie, et qui n'ont eu droit, chacun, qu'à une ligne dans un registre. On ne les oublie pas ici — même sans savoir presque rien d'eux, on les nomme, parce que c'est tout ce qu'on peut encore faire pour eux.`,
    `Il y a eu Verdun aussi, et le Fort de Vaux, et un homme qui en est revenu pour continuer, obstinément, à faire des enfants et à réparer des serrures. Il y a eu un quinté gagné un jour de hasard, et un bar-PMU-bowling sur trois étages dont on a oublié le nom. Il y a eu une mention bizarre, Anne Knobloch, qu'on n'a jamais su expliquer. Et il y a eu Chantal, qui a porté tout ça — sans le savoir, comme on porte les choses, sans en avoir conscience — jusqu'à Tours, jusqu'à ses propres enfants, jusqu'à ce site qu'on écrit là, maintenant, pour elle et à cause d'elle.`,
    `Rien ne s'arrête vraiment. Ça continue, sous d'autres noms, dans d'autres villes. On note ce qu'on sait, on laisse en blanc ce qu'on ignore, et on referme le registre — en attendant la prochaine fois qu'on l'ouvrira.`
  ],
  closing: 'On n\'invente rien. On recoud, avec ce qu\'on a — point par point.',
  annexeTitle: 'Table — repères par génération',
  table: {
    headers: ['Génération', 'Personne', 'Repères'],
    rows: [
      ['1', '<a class="person-link" href="personne.html#georges-schneider-1583">Georges SCHNEIDER</a> (avant 1583–?)', 'Racine (pré-1583)'],
      ['2', '<a class="person-link" href="personne.html#valentin-schneider-1603">Valentin SCHNEIDER</a> (≈1603–1693)', 'Laudrefang'],
      ['3', '<a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a> (1667–1727)', 'Bambiderstroff · laboureur'],
      ['4', '<a class="person-link" href="personne.html#angelique-schneider-1695">Angélique SCHNEIDER</a> (1695–?)', 'Bambiderstroff · charnière vers CAPTIEN'],
      ['5', '<a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas CAPTIEN</a> (≈1695–?)', 'Union avec Angélique SCHNEIDER'],
      ['6', '<a class="person-link" href="personne.html#christian-captien-1718">Christian CAPTIEN</a> (1718–1788)', 'Mondorf-les-Bains · Luxembourg'],
      ['7', '<a class="person-link" href="personne.html#francois-captien-1748">François CAPTIEN</a> (1748–1820)', 'Mondorf-les-Bains · maçon'],
      ['8', '<a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth CAPTIEN</a> (1790–1862)', 'Mondorf-les-Bains → Manom'],
      ['9', '<a class="person-link" href="personne.html#paul-captien-1821">Paul CAPTIEN</a> (1821–1889)', 'Mondorff/Manom · maçon'],
      ['10', '<a class="person-link" href="personne.html#nicolas-captien-1849">Nicolas CAPTIEN</a> (1849–1918)', 'Manom · maçon'],
      ['11', '<a class="person-link" href="personne.html#francois-captien-1885">François CAPTIEN</a> (1885–1969)', 'Verdun (Fort de Vaux), 1916 · chemin de fer'],
      ['12', '<a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand CAPTIEN</a> (1922–1997)', 'Manom · Saint-Avold · SNCF puis cafetier'],
      ['13', '<a class="person-link" href="personne.html#chantal-captien-1946">Chantal CAPTIEN</a> (1946–2013)', 'Amboise · Tours · lignée maternelle']
    ]
  }
};

// Récit géographique — six périodes, de Laudrefang à la Touraine.
// Texte inspiré du rythme célinien (oral, syncopé) — sans prétendre à l'auteur.
const GEOGRAPHIC_NARRATIVE = {
  title: 'Récit géographique',
  subtitle: 'De Laudrefang à Tours — frontières, guerres, déplacements',
  intro: [
    `Alors voilà… une autre manière de raconter la même famille. Pas par les prénoms seuls, ni par les dates de baptême — par les lieux. Par la terre qu'on foule, qu'on laboure, qu'on quitte un jour sans toujours savoir pourquoi, ni pour combien de temps.`,
    `Quatre siècles et demi… et une carte qui ne cesse de se redessiner autour de nous. Lorraine, Luxembourg, Moselle, Touraine — des noms d'administration, de guerre, de paix retrouvée. Nous, on vivait là où l'on pouvait. On construisait, on enfantait, on enterrait. Et parfois on partait — dix kilomètres, cent, cinq cents — parce que la frontière avait bougé encore une fois, ou parce qu'un métier, un mariage, un quinté vous emmenait ailleurs.`,
    `Ce récit suit six périodes. Six façons d'habiter l'Europe, petite et grande à la fois.`
  ],
  periods: [
    {
      id: 'laudrefang',
      roman: 'I',
      title: 'Laudrefang et le pays de Nied',
      years: 'avant 1600 – ~1693',
      place: 'Moselle · pays de Bouzonville · couloir franco-germanique',
      narrative: [
        `Laudrefang… vous la cherchez sur une carte d'aujourd'hui, elle est là, discrète, dans le canton de Bouzonville, à une poignée de kilomètres de la Sarre. Mais à l'époque de <a class="person-link" href="personne.html#georges-schneider-1583">Georges SCHNEIDER</a> — avant 1583, on ne sait même pas quand exactement — c'était le bout du monde connu, le pays de Nied, cette plaine lorraine où l'on parle allemand le dimanche et français le lundi, selon qui commande.`,
        `L'Europe, autour, c'est la fin des guerres de Religion — on sort à peine du massacre — et déjà la promesse de la Trentenaire, celle qui va durer trente ans et vider les villages comme on vide un tonneau. Les frontières ? Le duché de Lorraine vacille ; les Trois-Évêchés — Metz, Toul, Verdun — sont un morceau de France planté en plein cœur germanique. Et nous, laboureurs sans terre propre, on regarde passer les armées sans comprendre toujours de quel côté elles viennent.`,
        `<a class="person-link" href="personne.html#valentin-schneider-1603">Valentin SCHNEIDER</a>, né vers 1603, y passera toute sa vie — quatre-vingt-dix ans, tenez-vous bien, du même village à l'autre extrémité, sans avoir bougé. C'est une géographie immobile, celle des paysans du XVIIe siècle : on naît où l'on meurt, à moins qu'une guerre, une famine, un mariage lointain ne vous pousse ailleurs. Valentin, lui, tient bon. Il meurt le 27 août 1693 à Laudrefang même, comme si le monde entier avait tourné autour de lui sans qu'il ait jamais eu besoin d'en sortir.`,
        `Pas de château, pas de blason — juste ce couloir entre deux mondes, et des registres paroissiaux obligatoires depuis Villers-Cotterêts (1539) qui commencent enfin à nous laisser une trace. Avant, c'était le néant. Après, c'est un nom. C'est déjà énorme.`
      ],
      context: [
        { label: 'Grande Histoire', text: `1618–1648 : la guerre de Trente Ans ravage la Lorraine. Pillages, famines, épidémies. Les villages du pays de Nied subissent le passage des armées suédoises, impériales, françaises. La démographie s'effondre ; la reprise ne commence qu'au tournant du siècle suivant.` },
        { label: 'Frontière', text: `Laudrefang se situe dans une zone tampon permanente : duché de Lorraine, influence française (Trois-Évêchés), proximité du Saint-Empire. Les habitants vivent avec des frontières mouvantes qu'ils ne choisissent pas — et dont ils ne voient parfois que les conséquences : impôts, langue des actes, curé d'une nationalité ou d'une autre.` }
      ]
    },
    {
      id: 'bambiderstroff',
      roman: 'II',
      title: 'Bambiderstroff — paroisse et frontière',
      years: '1684 – 1727',
      place: 'Canton de Boulay · Moselle · Luxembourg voisin',
      narrative: [
        `On se déplace. Pas loin — une vingtaine de kilomètres à vol d'oiseau, une journée de charrette — mais assez pour changer de paroisse, de curé, de registre. Bambiderstroff, village du canton de Boulay, accueille <a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a>, laboureur, qui s'y marie le 28 novembre 1684 avec <a class="person-link" href="personne.html#marie-jungers">Marie JUNGERS</a>. Il a dix-sept ans. La terre, ici, c'est la frontière : le Luxembourg est à portée de cloche, la Sarre aussi, et les familles se marient entre voisins parce qu'on n'a ni le temps ni l'argent d'aller plus loin.`,
        `C'est l'Europe de la reprise, après un siècle et demi de guerres. Louis XIV règne ; la Lorraine est française depuis 1766 seulement — mais avant cela, elle a déjà connu l'occupation, la restitution, le duc exilé. Pour Jean et Marie, tout ça c'est du bruit lointain. Eux, ils labourent. Marie meurt le 7 septembre 1720 ; Jean la suit sept ans plus tard, le 13 décembre 1727. Même village, même cimetière, même terre.`,
        `Et de ce couple naît <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique</a>, le 29 avril 1695 — la charnière. Elle épousera <a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas CAPTIEN</a>, né la même année, quelque part qu'on n'a pas encore localisé. Avec cette union, un autre nom entre dans la lignée, et la géographie va basculer : plus vers l'est, vers le Luxembourg, vers Mondorf-les-Bains, où la famille CAPTIEN s'installera pour un siècle entier.`,
        `Bambiderstroff, c'est le dernier village mosellan de la souche SCHNEIDER. Après Angélique, ce sera Mondorf. La frontière qu'on franchit, ce n'est pas celle des cartes — c'est celle d'un mariage, d'un acte, d'un prêtre qui inscrit deux noms côte à côte.`
      ],
      context: [
        { label: 'Grande Histoire', text: `Fin du XVIIe – début du XVIIIe : reprise démographique en Lorraine après les guerres franco-allemandes et la peste. Les mariages precoces (seize, dix-sept ans) reconstituent les familles ; les unions se font dans un rayon de quelques paroisses.` },
        { label: 'Frontière', text: `Bambiderstroff se trouve à la lisière du Luxembourg et de la Sarre — zone où les déplacements quotidiens ignorent les frontières politiques. Les laboureurs vont au marché de Boulay, parfois au-delà ; la langue, les coutumes et les alliances familiales créent un espace transfrontalier bien avant l'Europe des nations.` }
      ]
    },
    {
      id: 'mondorf',
      roman: 'III',
      title: 'Mondorf-les-Bains — le Luxembourg d\'Ancien Régime',
      years: '1718 – 1820',
      place: 'Canton de Remich · Grevenmacher · Grand-Duché naissant',
      narrative: [
        `Mondorf-les-Bains. Aujourd'hui station thermale, casinos, eaux minérales — à l'époque de <a class="person-link" href="personne.html#christian-captien-1718">Christian CAPTIEN</a>, né le 19 janvier 1718, c'était un village agricole du canton de Remich, dans le Grevenmacher luxembourgeois. Quatre générations CAPTIEN y naîtront, s'y marieront, y mourront — <a class="person-link" href="personne.html#francois-captien-1748">François</a> (1748–1820), maçon, y achèvera sa vie le 16 janvier 1820, sans jamais avoir quitté le canton.`,
        `L'Europe, pendant ce siècle-là, change de peau trois fois. Ancien Régime… Révolution… Empire… Restauration. Le Luxembourg passe de l'Autriche des Habsbourg à la France révolutionnaire (1795), puis à l'Empire napoléonien, et redevient grand-duché en 1815 — indépendant en apparence, lié en réalité aux Pays-Bas puis, après 1830, à sa propre destinée. Pour Christian, François, <a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth</a> (1790), tout ça se traduit par des registres qui changent de langue — latin, français, allemand — et par des curés qui inscrivent les naissances comme si rien n'avait bougé.`,
        `Le métier de maçon apparaît : François CAPTIEN en est un, comme le seront plus tard Paul et Nicolas à Manom. Bâtir des murs, des toits, des fours — c'est une géographie de la pierre, du mortier, de la main. On ne voyage pas ; on construit ce qui tient debout autour de soi. Mondorf, c'est cent ans de stabilité rare dans une Europe en mouvement perpétuel.`,
        `Et puis <a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth</a>, née le 23 janvier 1790 à Mondorf, finira ses jours le 28 décembre 1862 à Manom — en Moselle, en France. La frontière qu'elle franchit, c'est celle d'une vie entière : du Luxembourg à la France, du village thermal au village de brique mosellan. On ne sait pas exactement quand ni pourquoi. On sait seulement qu'elle est morte là-bas, et que son fils <a class="person-link" href="personne.html#paul-captien-1821">Paul</a>, né à Mondorff en 1821, portera la suite en Moselle.`
      ],
      context: [
        { label: 'Grande Histoire', text: `1748–1820 : Révolution française, guerres napoléoniennes, Congrès de Vienne (1815). Le Luxembourg est annexé à la France (1795–1814), puis devient grand-duché sous la maison de Nassau-Weilbourg. Les registres paroissiaux continuent — seule mémoire des familles ordinaires.` },
        { label: 'Frontière', text: `Mondorf-les-Bains se situe à quelques kilomètres de la frontière franco-luxembourgeoise actuelle. Le passage d'Élisabeth vers Manom (~1820–1862) marque le retour de la lignée en territoire français — Moselle, pays de Thionville — dans une région qui, après 1871, redeviendra allemande.` }
      ]
    },
    {
      id: 'manom-mondorff',
      roman: 'IV',
      title: 'Mondorff et Manom — maçons en Moselle',
      years: '1821 – 1918',
      place: 'Manom · Mondorff · Thionville · frontière luxembourgeoise',
      narrative: [
        `Manom. Mondorff. Deux orthographes pour un même paysage — Mondorf côté luxembourgeois, Mondorff avec deux f côté français. Les CAPTIEN s'en moquent : ils vivent à la lisière, entre deux administrations, deux langues d'actes, deux curés parfois. <a class="person-link" href="personne.html#paul-captien-1821">Paul</a>, né le 1er février 1821 à Mondorff, s'installe à Manom, maçon comme son grand-père François avant lui. Quatrième génération de la truelle — on bâtit ce qui résiste, pierre après pierre.`,
        `Le XIXe siècle, c'est celui des transformations : chemins de fer (Metz–Thionville, 1850), sidérurgie lorraine, mines de fer. Manom, village de brique et de grès, se rapproche de Thionville, de l'industrie, du monde ouvrier naissant. Et puis 1871 : la guerre franco-prussienne, la défaite, l'annexion. La Moselle devient allemande — Reichsland Elsaß-Lothringen. Les noms restent français dans les foyers ; les actes officiels passent en allemand. On apprend à vivre avec deux identités administratives, comme on avait appris à vivre avec deux paroisses.`,
        `<a class="person-link" href="personne.html#nicolas-captien-1849">Nicolas</a>, né le 5 juillet 1849 à Manom, maçon lui aussi, épouse Catherine LENARD en 1879. Six enfants — dont <a class="person-link" href="personne.html#francois-captien-1885">François</a>, né en 1885, qui quittera la truelle pour les rails et les serrures. Nicolas meurt le 1er janvier 1918, jour de l'an, dans une Moselle occupée par l'Allemagne depuis quarante-sept ans, à quelques mois de l'armistice qu'il ne verra pas.`,
        `Quatre enfants sur sept de Paul mourront en bas âge — Élisabeth, Jacques, Catherine, Jean. La géographie du deuil, ici, c'est le même cimetière, le même village, les mêmes tombes qui s'accumulent trop vite. Manom tient bon malgré tout : c'est l'ancrage, le lieu d'où on ne part pas — ou pas encore.`
      ],
      context: [
        { label: 'Grande Histoire', text: `1870–1871 : guerre franco-prussienne, annexion de l'Alsace-Moselle. 1914–1918 : Première Guerre mondiale ; la Moselle est allemande ; Verdun (1916) est à une cinquantaine de kilomètres. Nicolas CAPTIEN meurt en 1918, avant l'armistice du 11 novembre.` },
        { label: 'Frontière', text: `Manom et Mondorff/Mondorf forment un espace transfrontalier quotidien : même dialecte, mêmes marchés, familles qui se marient des deux côtés. Après 1871, la frontière politique durcit ; les déplacements restent possibles, mais les identités administratives se bifurquent.` }
      ]
    },
    {
      id: 'verdun-saint-avold',
      roman: 'V',
      title: 'Verdun, Saint-Avold — guerre et reconstruction',
      years: '1885 – 1969',
      place: 'Manom · Verdun · Saint-Avold · Fort de Vaux',
      narrative: [
        `<a class="person-link" href="personne.html#francois-captien-1885">François CAPTIEN</a>, né le 13 juillet 1885 à Manom, dessine un triangle de vie qui dit tout de la Moselle du XXe siècle : village d'origine, front de guerre, ville de reconstruction. Serrurier, puis cheminot — les rails, encore, comme fil conducteur — il épouse Catherine HIPPERT en 1912, avant que le monde ne bascule.`,
        `1916. Verdun. Le Fort de Vaux. Il a trente et un ans. On ne sait pas exactement ce qu'il y a vécu — les archives familiales ne disent que le nom du fort — mais on sait ce que fut Verdun : dix mois de feu, plus de trois cent mille morts, une terre retournée comme un champ de betteraves. Il en revient. C'est déjà une géographie du survivant : le même Manom, mais plus jamais le même homme.`,
        `Après la guerre, la Moselle redevient française (1918–1940), puis allemande (1940–1944), puis française encore. Deux guerres mondiales en vingt-cinq ans. <a class="person-link" href="personne.html#marguerite-adele-captien-1924">Marguerite Adèle</a> et <a class="person-link" href="personne.html#adele-captien-1925">Adèle</a> meurent toutes deux en 1945, à Manom — la même année que la libération. Coïncidence ou écho tardif de l'Histoire ? On ne sait pas. On note.`,
        `Son fils <a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand</a>, né en 1922 à Manom, aiguilleur SNCF puis cafetier, s'installe à Saint-Avold — ville charbonnière, gare, ateliers. Et là, un jour des années 1960, le quinté. Un bar au rez-de-chaussée, PMU au premier, bowling tout en haut — trois étages pour boire, parier, jouer aux quilles. Saint-Avold devient le lieu de la chance retrouvée, après tant de malchance collective. François père meurt le 21 mars 1969 à Manom, dans le village où il était né quatre-vingt-quatre ans plus tôt.`
      ],
      context: [
        { label: 'Grande Histoire', text: `1914–1918 : Première Guerre mondiale ; bataille de Verdun (1916), Fort de Vaux. 1939–1945 : Seconde Guerre mondiale ; annexation de facto, déportations, libération 1944–1945. Reconstruction et baby-boom dans les années 1950–1960.` },
        { label: 'Frontière', text: `Saint-Avold, sous-préfecture mosellane, carrefour ferroviaire et minier — ville de passage entre Lorraine et Sarre. Le bar-PMU-bowling des années 1960 incarne une géographie du loisir et de la reconstruction, loin des tranchées de Verdun.` }
      ]
    },
    {
      id: 'tours',
      roman: 'VI',
      title: 'De la Moselle à la Touraine',
      years: '1922 – 2013',
      place: 'Manom · Saint-Avold · Amboise · Tours · Monts · Luynes',
      narrative: [
        `La dernière migration. La plus lointaine de toute la lignée — près de cinq cents kilomètres à vol d'oiseau depuis Manom ou Saint-Avold, six cents par la route — et la plus décisive : quitter la Moselle pour la Touraine, le charbon pour la Loire, les rails lorrains pour les bureaux tourangeaux.`,
        `<a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand CAPTIEN</a> naît à Manom en 1922 ; il épouse <a class="person-link" href="personne.html#odile-alexandrine-pierre">Odile Alexandrine PIERRE</a>, tapissière, en 1945 — l'année d'après la guerre, quand tout le monde refait des enfants pour compenser ceux qu'on a perdus. Le couple divorcera en 1964, après dix-neuf ans et cinq enfants. Saint-Avold, Manom, les gares — la géographie du travail SNCF et du café.`,
        `<a class="person-link" href="personne.html#chantal-captien-1946">Chantal</a>, l'aînée, naît le 12 avril 1946 à Amboise — déjà un pied en Touraine, pendant que le père est encore ancré en Moselle. Aide-comptable aux Établissements MEUNIER à Tours, elle montera vers le val de Loire : Monts, Luynes, ces communes paisibles où l'on vit de l'ombre des châteaux et du bruit des usines légères. Mariée à Charles Marc Billeux en 1976 ; trois fils — Philippe, Thierry, Christophe Olivier.`,
        `La Moselle reste l'aimant d'origine — Manom où l'on enterre encore François Armand, Thionville où naît Philippe — mais la Touraine devient la terre d'adoption. <a class="person-link" href="personne.html#emilie-captien-1919">Émilie</a>, tante de Chantal, finira même ses jours à Joué-lès-Tours en 2009 : la famille se disperse, lentement, le long de la Loire. Chantal meurt le 25 octobre 2013 à Luynes ; ses cendres reposent au jardin du souvenir de Monts. C'est là que se referme ce récit géographique — provisoirement, comme toujours — entre la Moselle qu'on a quittée et la Touraine qu'on a choisie.`
      ],
      context: [
        { label: 'Grande Histoire', text: `1945–1975 : trente Glorieuses, baby-boom, exode rural et migrations internes. Les Mosellans partent vers l'Île-de-France, la Touraine, le Sud — suivre l'emploi, fuir les mines en déclin, recomposer une famille après la guerre.` },
        { label: 'Frontière', text: `Amboise, Tours, Monts, Luynes : axe de la Loire, Indre-et-Loire. Géographie tourangelle — châteaux, vignes, industries légères — opposée à la Lorraine charbonnière et sidérurgique. Chantal incarne ce passage Est→Ouest, Moselle→Touraine, sans renier l'origine.` }
      ]
    }
  ],
  closing: 'Les lieux changent… les prénoms restent. Entre les deux, on recoud l\'histoire — carte après carte, frontière après frontière.'
};
