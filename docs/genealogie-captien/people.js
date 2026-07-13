// Fiches individuelles — lignée maternelle Captien
// Source indiquée (quand connue) : MyHeritage.

// Données — site "généalogie Captien" (branche maternelle)
// Chaque personne est identifiée par une clé stable (utilisée dans les URLs #id).

const PEOPLE = {
  // === Parents (placeholders) — génération de François Armand ===
  // À ce stade, la filiation est conservée comme inconnue : ce couple placeholder
  // sert à rattacher la fratrie (Marthe Élise / Émilie / François Armand).
  'captien-parents-inconnus-fratrie-1917-1922': {
    name: 'CAPTIEN — parent (inconnu)',
    dates: 'Manom (Moselle) — dates inconnues',
    chapterId: 'captien',
    spouses: ['captien-parents-inconnus-fratrie-1917-1922-2'],
    children: ['marthe-elise-captien-1917', 'emilie-captien-1919', 'francois-armand-captien-1922'],
    bio: "Parent non identifié à ce stade. Placeholder utilisé pour relier la fratrie (Marthe Élise, Émilie, François Armand). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'captien-parents-inconnus-fratrie-1917-1922-2': {
    name: 'CAPTIEN — parent (inconnu)',
    dates: 'Manom (Moselle) — dates inconnues',
    chapterId: 'captien',
    spouses: ['captien-parents-inconnus-fratrie-1917-1922'],
    children: ['marthe-elise-captien-1917', 'emilie-captien-1919', 'francois-armand-captien-1922'],
    bio: "Parent non identifié à ce stade. Placeholder utilisé pour relier la fratrie (Marthe Élise, Émilie, François Armand). Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Ascendance (branche Mondorf / Manom) — ajout 2026 ===
  // Elisabeth CAPTIEN (1790–1862) et ses enfants (père non identifié à ce stade).
  'elisabeth-captien-1790': {
    name: 'Elisabeth CAPTIEN',
    dates: '23 janvier 1790, Mondorf-les-Bains (canton de Remich, Grevenmacher, Luxembourg) — 28 décembre 1862, Manom (Moselle), France',
    chapterId: 'mondorf',
    parents: ['francois-captien-1748', 'jeanne-wagner'],
    spouses: ['inconnu-captien-elisabeth-1790'],
    children: ['barbe-captien-1815', 'paul-captien-1821'],
    bio: "Ancêtre directe. Fille de François CAPTIEN (1748–1820) et de Jeanne WAGNER. Née à Mondorf-les-Bains (Luxembourg) le 23 janvier 1790 ; décédée à Manom (Moselle) le 28 décembre 1862. La source consultée ne permet pas, à ce stade, d’identifier le père des enfants (conjoint inconnu conservé en placeholder). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'inconnu-captien-elisabeth-1790': {
    name: 'Xx CAPTIEN (conjoint inconnu)',
    dates: 'identité et dates inconnues',
    chapterId: 'captien',
    spouses: ['elisabeth-captien-1790'],
    children: ['barbe-captien-1815', 'paul-captien-1821'],
    bio: "Conjoint / partenaire non identifié dans la source à ce stade. Placeholder pour représenter la parentalité des enfants d’Elisabeth CAPTIEN. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'barbe-captien-1815': {
    name: 'Barbe CAPTIEN',
    dates: 'vers 1815, Mondorf (Luxembourg) — 13 avril 1820, Mondorf (Luxembourg) (décès en bas âge)',
    chapterId: 'captien',
    parents: ['elisabeth-captien-1790', 'inconnu-captien-elisabeth-1790'],
    bio: "Fille d’Elisabeth CAPTIEN. Décédée en bas âge. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'paul-captien-1821': {
    name: 'Paul CAPTIEN',
    dates: '1 février 1821, Mondorff (Moselle) — 15 juillet 1889, Manom (Moselle)',
    chapterId: 'manom-mondorff',
    parents: ['elisabeth-captien-1790', 'inconnu-captien-elisabeth-1790'],
    spouses: ['marie-ligne'],
    children: [
      'elisabeth-captien-1846',
      'nicolas-captien-1849',
      'cecile-lucile-captien-1852',
      'jacques-captien-1855',
      'catherine-captien-1857',
      'jean-captien-1861',
      'barbe-captien-1864'
    ],
    bio: "Ancêtre direct (5 générations au-dessus de Christophe Olivier Billeux). Né le 1 février 1821 à Mondorff (Moselle). Maçon. Décédé le 15 juillet 1889 à Manom (Moselle). Époux de Marie LIGNE (mariage le 21 janvier 1845 à Manom). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'marie-ligne': {
    name: 'Marie LIGNE (CAPTIEN)',
    dates: 'mariage le 21 janvier 1845, Manom (Moselle) — décédée le 21 juillet 1868, Manom (Moselle)',
    chapterId: 'manom-mondorff',
    spouses: ['paul-captien-1821'],
    children: [
      'elisabeth-captien-1846',
      'nicolas-captien-1849',
      'cecile-lucile-captien-1852',
      'jacques-captien-1855',
      'catherine-captien-1857',
      'jean-captien-1861',
      'barbe-captien-1864'
    ],
    bio: "Épouse de Paul CAPTIEN. Mariage le 21 janvier 1845 à Manom (Moselle). Décédée le 21 juillet 1868 à Manom (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'elisabeth-captien-1846': {
    name: 'Élisabeth CAPTIEN',
    dates: 'vers le 6 juillet 1846, Manom (Moselle) — 13 septembre 1849, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    bio: "Fille de Paul CAPTIEN et de Marie LIGNE. Décédée en bas âge. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'cecile-lucile-captien-1852': {
    name: 'Cécile Lucile CAPTIEN (GACHER)',
    dates: '27 mars 1852, Manom (Moselle) — mariage le 25 janvier 1881, Yutz (Moselle)',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    spouses: ['jean-gacher'],
    bio: "Fille de Paul CAPTIEN et de Marie LIGNE. Mariée à Jean GACHER le 25 janvier 1881 à Yutz (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-gacher': {
    name: 'Jean GACHER',
    dates: 'mariage le 25 janvier 1881, Yutz (Moselle)',
    chapterId: 'captien',
    spouses: ['cecile-lucile-captien-1852'],
    bio: "Époux de Cécile Lucile CAPTIEN. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jacques-captien-1855': {
    name: 'Jacques CAPTIEN',
    dates: '20 juillet 1855, Manom (Moselle) — 18 août 1855, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    bio: "Enfant de Paul CAPTIEN et de Marie LIGNE. Décédé en bas âge. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'catherine-captien-1857': {
    name: 'Catherine CAPTIEN',
    dates: '30 mars 1857 — 25 mai 1857',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    bio: "Enfant de Paul CAPTIEN et de Marie LIGNE. Décédée en bas âge. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-captien-1861': {
    name: 'Jean CAPTIEN',
    dates: '3 mai 1861 — 17 mai 1861',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    bio: "Enfant de Paul CAPTIEN et de Marie LIGNE. Décédé en bas âge. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'barbe-captien-1864': {
    name: 'Barbe CAPTIEN (BIDON)',
    dates: '26 août 1864, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['paul-captien-1821', 'marie-ligne'],
    bio: "Fille de Paul CAPTIEN et de Marie LIGNE. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Ascendance (documentée) — François CAPTIEN (1885–1969) ===
  'francois-captien-1885': {
    name: 'François CAPTIEN',
    dates: '13 juillet 1885, Manom (Moselle) — 21 mars 1969, Manom (Moselle)',
    chapterId: 'verdun-saint-avold',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    spouses: ['catherine-hippert', 'rose-marie-weber'],
    children: [
      'marthe-elise-captien-1917',
      'emilie-captien-1919',
      'francois-armand-captien-1922',
      'marguerite-adele-captien-1924',
      'adele-captien-1925',
      'jacques-adrien-captien-1925',
      'andree-captien-1933'
    ],
    bio: "Arrière-grand-père maternel. Serrurier cheminot. Service militaire : Verdun (Fort de Vaux), 1916. Mariage (1) avec Catherine HIPPERT le 7 octobre 1912 à Manom (décédée le 16 novembre 1931 à Manom). Mariage (2) avec Rose Marie WEBER le 15 avril 1932 à Manom. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Génération au-dessus : Nicolas CAPTIEN (1849–1918) ===
  'nicolas-captien-1849': {
    name: 'Nicolas CAPTIEN',
    dates: '5 juillet 1849, Manom (Moselle) — 1 janvier 1918, Manom (Moselle)',
    chapterId: 'manom-mondorff',
    parents: ['paul-captien-1821', 'marie-ligne'],
    spouses: ['catherine-lenard'],
    children: [
      'catherine-captien-nade-1879',
      'francois-captien-1881',
      'marie-captien-1883',
      'francois-captien-1885',
      'barbe-cecile-captien-1888',
      'barbe-captien-1894'
    ],
    bio: "Arrière-arrière-grand-père maternel. Né le 5 juillet 1849 à Manom (Moselle) ; décédé le 1 janvier 1918 à Manom. Profession : maçon. Marié le 4 février 1879 à Manom à Catherine LENARD. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Luxembourg (Mondorf-les-Bains) — génération au-dessus d’Élisabeth (1790) ===
  'nicolas-captien-1695': {
    name: 'Nicolas CAPTIEN',
    dates: 'vers 1695 — décédé (date inconnue)',
    chapterId: 'bambiderstroff',
    spouses: ['angelique-schneider-1695'],
    children: ['christian-captien-1718'],
    bio: "Ancêtre direct (génération 9 au-dessus de Christian CAPTIEN, 1718). Né vers 1695 (lieu non renseigné dans la source). Union avec Angélique SCHNEIDER (née en 1695 à Bambiderstroff). Décédé (date inconnue). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'angelique-schneider-1695': {
    name: 'Angélique SCHNEIDER (CAPTIEN)',
    dates: '29 avril 1695, Bambiderstroff (Moselle) — (date de décès inconnue)',
    chapterId: 'bambiderstroff',
    parents: ['jean-schneider-1667', 'marie-jungers'],
    spouses: ['nicolas-captien-1695'],
    children: ['christian-captien-1718'],
    bio: "Ancêtre directe. Née le 29 avril 1695 à Bambiderstroff (Moselle). Fille de Jean (Haman) SCHNEIDER (1667–1727), laboureur à Bambiderstroff, et de Marie JUNGERS († 1720). Union avec Nicolas CAPTIEN (vers 1695). Mère de Christian CAPTIEN (1718). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'georges-schneider-1583': {
    name: 'Georges SCHNEIDER',
    dates: 'né avant 1583 — décès (date inconnue)',
    chapterId: 'laudrefang',
    spouses: ['christine-nn-schneider'],
    children: ['valentin-schneider-1603', 'quirin-virich-schneider-1615'],
    bio: "Ancêtre direct (génération 12 au-dessus de Valentin SCHNEIDER, vers 1603). Né avant 1583. Marié vers 1600 à Christine (nom de jeune fille inconnu). Père de Valentin SCHNEIDER (vers 1603, Laudrefang) et de Quirin Virich SCHNEIDER (vers 1615). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'christine-nn-schneider': {
    name: 'Christine (NN) SCHNEIDER',
    dates: 'née (date inconnue) — décès (date inconnue) · mariage vers 1600',
    chapterId: 'laudrefang',
    spouses: ['georges-schneider-1583'],
    children: ['valentin-schneider-1603', 'quirin-virich-schneider-1615'],
    bio: "Ancêtre directe. Épouse de Georges SCHNEIDER, mariage vers 1600. Nom de jeune fille non connu à ce stade (conservé en NN). Mère de Valentin SCHNEIDER (vers 1603, Laudrefang) et de Quirin Virich SCHNEIDER (vers 1615). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'quirin-virich-schneider-1615': {
    name: 'Quirin Virich SCHNEIDER',
    dates: 'vers 1615 — décès (date inconnue)',
    chapterId: 'laudrefang',
    parents: ['georges-schneider-1583', 'christine-nn-schneider'],
    bio: "Enfant de Georges SCHNEIDER (né avant 1583) et de Christine (NN). Frère de Valentin SCHNEIDER (vers 1603, Laudrefang). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'valentin-schneider-1603': {
    name: 'Valentin SCHNEIDER',
    dates: 'vers 1603, Laudrefang (Moselle), France — 27 août 1693, Laudrefang (Moselle), France',
    chapterId: 'laudrefang',
    parents: ['georges-schneider-1583', 'christine-nn-schneider'],
    spouses: ['inconnue-schneider-valentin-1603'],
    children: ['jean-schneider-1667'],
    bio: "Ancêtre direct (génération 11 au-dessus de Jean (Haman) SCHNEIDER, 1667). Né vers 1603 à Laudrefang (Moselle). Décédé le 27 août 1693 à Laudrefang. Parent attesté de Jean (Haman) SCHNEIDER (né en 1667). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'inconnue-schneider-valentin-1603': {
    name: 'Xx SCHNEIDER (conjointe inconnue)',
    dates: 'identité et dates inconnues',
    chapterId: 'captien',
    spouses: ['valentin-schneider-1603'],
    children: ['jean-schneider-1667'],
    bio: "Conjointe non identifiée dans la source à ce stade. Placeholder pour représenter la parentalité de Jean (Haman) SCHNEIDER (1667). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-schneider-1667': {
    name: 'Jean (Haman) SCHNEIDER',
    dates: '1667 — 13 décembre 1727, Bambiderstroff (Moselle), France',
    chapterId: 'bambiderstroff',
    parents: ['valentin-schneider-1603', 'inconnue-schneider-valentin-1603'],
    spouses: ['marie-jungers'],
    children: ['angelique-schneider-1695'],
    bio: "Ancêtre direct (génération 10). Laboureur à Bambiderstroff (Moselle). Né en 1667 ; décédé le 13 décembre 1727 à Bambiderstroff. Époux de Marie JUNGERS (mariage le 28 novembre 1684 à Bambiderstroff). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'marie-jungers': {
    name: 'Marie JUNGERS (SCHNEIDER)',
    dates: 'mariage le 28 novembre 1684, Bambiderstroff (Moselle) — 7 septembre 1720, Bambiderstroff (Moselle)',
    chapterId: 'bambiderstroff',
    spouses: ['jean-schneider-1667'],
    children: ['angelique-schneider-1695'],
    bio: "Ancêtre directe (génération 10). Épouse de Jean (Haman) SCHNEIDER. Mariage le 28 novembre 1684 à Bambiderstroff (Moselle). Décédée le 7 septembre 1720 à Bambiderstroff. Mère, notamment, d’Angélique SCHNEIDER (née en 1695). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'christian-captien-1718': {
    name: 'Christian CAPTIEN',
    dates: '19 janvier 1718, Mondorf-les-Bains (Luxembourg) — 2 février 1788, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    parents: ['nicolas-captien-1695', 'angelique-schneider-1695'],
    spouses: ['lucie-thomas'],
    children: ['francois-captien-1748'],
    bio: "Ancêtre direct (génération 8 au-dessus de François CAPTIEN, 1748). Né le 19 janvier 1718 à Mondorf-les-Bains (Luxembourg). Décédé le 2 février 1788 à Mondorf-les-Bains (Luxembourg). Marié le 22 juin 1743 à Mondorf-les-Bains à Lucie THOMAS. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'lucie-thomas': {
    name: 'Lucie THOMAS (CAPTIEN)',
    dates: 'mariage le 22 juin 1743, Mondorf-les-Bains (Luxembourg) — décédée le 22 janvier 1772, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    spouses: ['christian-captien-1718'],
    children: ['francois-captien-1748'],
    bio: "Épouse de Christian CAPTIEN (1718–1788). Mariée le 22 juin 1743 à Mondorf-les-Bains (Luxembourg). Décédée le 22 janvier 1772 à Mondorf-les-Bains (Luxembourg). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'francois-captien-1748': {
    name: 'François CAPTIEN',
    dates: '25 décembre 1748 — 16 janvier 1820, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    parents: ['christian-captien-1718', 'lucie-thomas'],
    spouses: ['jeanne-wagner'],
    children: [
      'jacques-captien-1786',
      'jean-captien-1788',
      'elisabeth-captien-1790',
      'nicolas-captien-1793'
    ],
    bio: "Ancêtre direct. Maçon. Décès le 16 janvier 1820 à Mondorf-les-Bains (canton de Remich, Grevenmacher, Luxembourg). Marié le 17 septembre 1785 à Mondorf-les-Bains à Jeanne WAGNER. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jeanne-wagner': {
    name: 'Jeanne WAGNER (CAPTIEN)',
    dates: 'mariage le 17 septembre 1785, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    spouses: ['francois-captien-1748'],
    children: [
      'jacques-captien-1786',
      'jean-captien-1788',
      'elisabeth-captien-1790',
      'nicolas-captien-1793'
    ],
    bio: "Épouse de François CAPTIEN (1748–1820). Mariage le 17 septembre 1785 à Mondorf-les-Bains (Luxembourg). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jacques-captien-1786': {
    name: 'Jacques CAPTIEN',
    dates: 'né en 1786 — décédé en 1811 (lieux inconnus)',
    chapterId: 'captien',
    parents: ['francois-captien-1748', 'jeanne-wagner'],
    bio: "Fils de François CAPTIEN et Jeanne WAGNER. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-captien-1788': {
    name: 'Jean CAPTIEN',
    dates: '23 janvier 1788, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'captien',
    parents: ['francois-captien-1748', 'jeanne-wagner'],
    bio: "Fils de François CAPTIEN et Jeanne WAGNER. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'nicolas-captien-1793': {
    name: 'Nicolas CAPTIEN',
    dates: '4 septembre 1793, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'captien',
    parents: ['francois-captien-1748', 'jeanne-wagner'],
    bio: "Fils de François CAPTIEN et Jeanne WAGNER. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'catherine-lenard': {
    name: 'Catherine LENARD (CAPTIEN)',
    dates: 'mariage le 4 février 1879, Manom (Moselle)',
    chapterId: 'captien',
    spouses: ['nicolas-captien-1849'],
    children: [
      'catherine-captien-nade-1879',
      'francois-captien-1881',
      'marie-captien-1883',
      'francois-captien-1885',
      'barbe-cecile-captien-1888',
      'barbe-captien-1894'
    ],
    bio: "Épouse de Nicolas CAPTIEN (1849–1918). Mariage le 4 février 1879 à Manom (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'catherine-captien-nade-1879': {
    name: 'Catherine CAPTIEN (NADE)',
    dates: 'née le 3 novembre 1879, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    bio: "Fille de Nicolas CAPTIEN (1849–1918) et de Catherine LENARD. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'francois-captien-1881': {
    name: 'François CAPTIEN',
    dates: '30 juillet 1881 — 18 septembre 1881 (décès en bas âge) · Manom (Moselle)',
    chapterId: 'captien',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    bio: "Enfant décédé en bas âge. Né le 30 juillet 1881 et décédé le 18 septembre 1881. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'marie-captien-1883': {
    name: 'Marie CAPTIEN',
    dates: 'née le 5 mars 1883, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    bio: "Fille de Nicolas CAPTIEN (1849–1918) et de Catherine LENARD. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'barbe-cecile-captien-1888': {
    name: 'Barbe Cécile CAPTIEN (GACHER)',
    dates: 'née le 27 novembre 1888, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    spouses: ['mathias-gacher'],
    bio: "Fille de Nicolas CAPTIEN (1849–1918) et de Catherine LENARD. Mariée à Mathias GACHER le 27 mai 1907 à Manom (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'mathias-gacher': {
    name: 'Mathias GACHER',
    dates: 'mariage le 27 mai 1907, Manom (Moselle)',
    chapterId: 'captien',
    spouses: ['barbe-cecile-captien-1888'],
    bio: "Époux de Barbe Cécile CAPTIEN. Mariage le 27 mai 1907 à Manom (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'barbe-captien-1894': {
    name: 'Barbe CAPTIEN',
    dates: '18 février 1894 — 4 mars 1895 (décès en bas âge) · Manom (Moselle)',
    chapterId: 'captien',
    parents: ['nicolas-captien-1849', 'catherine-lenard'],
    bio: "Enfant décédé en bas âge. Née le 18 février 1894 et décédée le 4 mars 1895. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'catherine-hippert': {
    name: 'Catherine HIPPERT (CAPTIEN)',
    dates: 'mariage le 7 octobre 1912, Manom (Moselle) — décédée le 16 novembre 1931, Manom (Moselle)',
    chapterId: 'captien',
    spouses: ['francois-captien-1885'],
    children: [
      'marthe-elise-captien-1917',
      'emilie-captien-1919',
      'francois-armand-captien-1922',
      'marguerite-adele-captien-1924',
      'adele-captien-1925',
      'jacques-adrien-captien-1925'
    ],
    bio: "Épouse (1) de François CAPTIEN (1885). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'rose-marie-weber': {
    name: 'Rose Marie WEBER (CAPTIEN)',
    dates: 'mariage le 15 avril 1932, Manom (Moselle)',
    chapterId: 'captien',
    spouses: ['francois-captien-1885'],
    children: ['andree-captien-1933'],
    bio: "Épouse (2) de François CAPTIEN (1885). Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Fratrie de François Armand (1917–1933) ===
  'marguerite-adele-captien-1924': {
    name: 'Marguerite Adele CAPTIEN',
    dates: '23 juin 1924, Manom (Moselle) — 1 mars 1945, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    bio: "Sœur de François Armand CAPTIEN (1922). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'adele-captien-1925': {
    name: 'Adèle CAPTIEN (sexe incertain)',
    dates: 'né·e en 1925, Manom (Moselle) — décédé·e en 1945, Manom (Moselle)',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    bio: "Enfant de François CAPTIEN (1885) et Catherine HIPPERT. La source comporte une incohérence (« fils » mais prénom Adèle) : sexe conservé comme incertain. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jacques-adrien-captien-1925': {
    name: 'Jacques Adrien CAPTIEN',
    dates: '19 novembre 1925 — ? · mariage le 28 mai 1948, Andlau (Bas-Rhin)',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    spouses: ['rosa-richarde-wohleber'],
    bio: "Marié le 28 mai 1948 à Andlau (Bas-Rhin) à Rosa Richarde WOHLEBER. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'rosa-richarde-wohleber': {
    name: 'Rosa Richarde WOHLEBER (CAPTIEN)',
    dates: 'mariage le 28 mai 1948, Andlau (Bas-Rhin)',
    chapterId: 'captien',
    spouses: ['jacques-adrien-captien-1925'],
    bio: "Épouse de Jacques Adrien CAPTIEN. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Parents (documentés) ===
  'francois-armand-captien-1922': {
    name: 'François Armand CAPTIEN',
    dates: '10 décembre 1922, Manom (Moselle) — 8 janvier 1997, Saint-Avold (Moselle) (74 ans) — inhumé à Manom (Moselle)',
    chapterId: 'tours',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    spouses: ['odile-alexandrine-pierre', 'anne-knobloch'],
    children: [
      'chantal-captien-1946',
      'jean-marie-captien-1952',
      'michel-captien-1955',
      'jean-claude-captien-1960',
      'dominique-captien-1962'
    ],
    bio: "Grand-père maternel. Aiguilleur à la SNCF puis cafetier. Marié à Odile Alexandrine Pierre le 22 novembre 1945 à Manom ; divorce le 20 octobre 1964. Une mention de mariage avec Anne Knobloch (à Saint-Avold) apparaît aussi dans la source : à ce stade, ce point est traité comme une union possible (à confirmer). Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Branche collatérale : sœur de François Armand ===
  'emilie-captien-1919': {
    name: 'Émilie CAPTIEN (PARMENTIER)',
    dates: '1 janvier 1919, Manom (Moselle) — 28 octobre 2009, Joué-lès-Tours (Indre-et-Loire) (90 ans) — inhumée à Esvres',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    spouses: ['jean-leon-parmentier'],
    bio: "Grand-tante maternelle. Née le 1 janvier 1919 à Manom (Moselle). Mariée à Jean Léon PARMENTIER le 23 février 1946 à Manom. Décédée le 28 octobre 2009 à Joué-lès-Tours ; inhumée à Esvres. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Branche collatérale : sœur (décès en bas âge) ===
  'marthe-elise-captien-1917': {
    name: 'Marthe Élise CAPTIEN',
    dates: '13 août 1917, Manom (Moselle) — 17 septembre 1917, Manom (Moselle) (moins d’un an)',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    bio: "Grand-tante maternelle. Décédée en bas âge (moins d’un an). Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Branche collatérale : demi-sœur de François Armand ===
  'andree-captien-1933': {
    name: 'Andrée Jeanne Juliette CAPTIEN (GIRARD)',
    dates: '30 novembre 1933, Manom (Moselle) — 17 février 2004, Flavigny-sur-Moselle (Meurthe-et-Moselle)',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'rose-marie-weber'],
    spouses: ['marcel-girard'],
    children: ['francoise-girard-1965', 'adeline-girard-1968'],
    bio: "Demi-sœur de François Armand CAPTIEN (1922) : issue du second mariage de François CAPTIEN (1885) avec Rose Marie WEBER. Standardiste au SAMU de Thionville. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'marcel-girard': {
    name: 'Marcel GIRARD',
    dates: 'mariage (date inconnue) — enfants en 1965 / 1968',
    chapterId: 'captien',
    spouses: ['andree-captien-1933'],
    children: ['francoise-girard-1965', 'adeline-girard-1968'],
    bio: "Époux d’Andrée Jeanne Juliette CAPTIEN. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'francoise-girard-1965': {
    name: 'Françoise GIRARD',
    dates: 'née le 19 juillet 1965 — Thionville (Moselle)',
    chapterId: 'captien',
    parents: ['andree-captien-1933', 'marcel-girard'],
    bio: "Fille d’Andrée Jeanne Juliette CAPTIEN et de Marcel GIRARD. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'adeline-girard-1968': {
    name: 'Adeline GIRARD',
    dates: 'née le 5 juillet 1968 — Thionville (Moselle)',
    chapterId: 'captien',
    parents: ['andree-captien-1933', 'marcel-girard'],
    bio: "Fille d’Andrée Jeanne Juliette CAPTIEN et de Marcel GIRARD. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-leon-parmentier': {
    name: 'Jean Léon PARMENTIER',
    dates: 'mariage le 23 février 1946, Manom (Moselle) — décédé le 30 octobre 1971, Rambouillet (Yvelines)',
    chapterId: 'captien',
    spouses: ['emilie-captien-1919'],
    bio: "Époux d’Émilie CAPTIEN. Mariage le 23 février 1946 à Manom (Moselle). Décès le 30 octobre 1971 à Rambouillet (Yvelines). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'odile-alexandrine-pierre': {
    name: 'Odile Alexandrine PIERRE',
    dates: 'née le 24 septembre 1928 à Saint-Denis-Hors (Indre-et-Loire) — décédée le 22 avril 1999 à Poitiers (Vienne)',
    chapterId: 'captien',
    spouses: ['francois-armand-captien-1922'],
    children: [
      'chantal-captien-1946',
      'jean-marie-captien-1952',
      'michel-captien-1955',
      'jean-claude-captien-1960',
      'dominique-captien-1962'
    ],
    bio: "Grand-mère maternelle. Tapissière. Épouse de François Armand Captien (mariage le 22 novembre 1945 à Manom (Moselle) ; divorce le 20 octobre 1964). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'anne-knobloch': {
    name: 'Anne KNOBLOCH',
    dates: 'Saint-Avold (Moselle) — union mentionnée (incertaine)',
    chapterId: 'captien',
    spouses: ['francois-armand-captien-1922'],
    bio: "Une mention « mariage avec Anne Knobloch (Captien), Saint-Avold » apparaît dans MyHeritage, mais elle semble contradictoire avec le mariage de 1945 avec Odile Alexandrine Pierre. En l’absence de précisions, cette union est conservée comme hypothèse/événement incertain. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Enfants ===
  'chantal-captien-1946': {
    name: 'Chantal Marguerite Edith CAPTIEN (BILLEUX)',
    dates: '12 avril 1946, Amboise (Indre-et-Loire) – 25 octobre 2013, Luynes (Indre-et-Loire) — tumeur au cerveau',
    chapterId: 'tours',
    parents: ['francois-armand-captien-1922', 'odile-alexandrine-pierre'],
    spouses: ['claude-louis-pinazo', 'charles-marc-billeux'],
    children: ['philippe-charles-pinazo-billeux', 'thierry-georges-billeux', 'christophe-olivier-billeux'],
    bio: "Fille de François Armand Captien et d’Odile Alexandrine Pierre. Aide comptable à Tours (Établissements MEUNIER). Mariée en premières noces à Claude Louis Pinazo (1963), puis à Charles Marc Billeux (1976). Crémation le 30 octobre 2013 ; cendres au Jardin du souvenir de Monts. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-marie-captien-1952': {
    name: 'Jean Marie CAPTIEN',
    dates: '28 novembre 1952 — 11 août 1962, Manom (Moselle) (9 ans)',
    chapterId: 'captien',
    parents: ['francois-armand-captien-1922', 'odile-alexandrine-pierre'],
    bio: "Frère de Chantal Captien. Décédé très jeune à 9 ans, le 11 août 1962 à Manom (Moselle). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'michel-captien-1955': {
    name: 'Michel CAPTIEN',
    dates: 'né le 16 novembre 1955, Manom (Moselle)',
    chapterId: 'tours',
    parents: ['francois-armand-captien-1922', 'odile-alexandrine-pierre'],
    spouses: ['patricia-arive', 'evelyne-courtin'],
    children: ['delphine-captien-1976', 'floriane-captien-1998'],
    bio: "Frère de Chantal Captien. Serveur, puis chef de rang. Mariage (1) avec Patricia Arivé le 14 juin 1975 à Tours ; divorce le 10 mai 1981. Mariage (2) avec Evelyne Courtin le 31 mars 2018 à Gohory. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'patricia-arive': {
    name: 'Patricia ARIVÉ (CAPTIEN)',
    dates: 'mariage le 14 juin 1975, Tours — divorce le 10 mai 1981',
    chapterId: 'tours',
    spouses: ['michel-captien-1955'],
    children: ['delphine-captien-1976'],
    bio: "Épouse (1) de Michel Captien. Mariage le 14 juin 1975 à Tours ; divorce le 10 mai 1981. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'evelyne-courtin': {
    name: 'Evelyne COURTIN (CAPTIEN)',
    dates: 'mariage le 31 mars 2018, Gohory',
    chapterId: 'tours',
    spouses: ['michel-captien-1955'],
    bio: "Épouse (2) de Michel Captien. Mariage le 31 mars 2018 à Gohory. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'delphine-captien-1976': {
    name: 'Delphine CAPTIEN (ABREU)',
    dates: 'née le 11 juin 1976',
    chapterId: 'tours',
    parents: ['michel-captien-1955', 'patricia-arive'],
    spouses: ['jose-abreu'],
    bio: "Fille de Michel Captien et de Patricia Arivé. Épouse José Abreu le 10 juin 2000 à Tours. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jose-abreu': {
    name: 'José ABREU',
    dates: 'mariage le 10 juin 2000, Tours',
    chapterId: 'tours',
    spouses: ['delphine-captien-1976'],
    bio: "Époux de Delphine Captien. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'floriane-captien-1998': {
    name: 'Floriane CAPTIEN',
    dates: 'née le 5 août 1998',
    chapterId: 'tours',
    parents: ['michel-captien-1955'],
    bio: "Fille de Michel Captien. La filiation maternelle n'est pas renseignée dans la source à ce stade. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'jean-claude-captien-1960': {
    name: 'Jean Claude CAPTIEN',
    dates: '5 janvier 1960, Tours — 13 juin 1983, Montlouis-sur-Loire (Indre-et-Loire)',
    chapterId: 'captien',
    parents: ['francois-armand-captien-1922', 'odile-alexandrine-pierre'],
    bio: "Frère de Chantal Captien. Décédé le 13 juin 1983 à Montlouis-sur-Loire. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'dominique-captien-1962': {
    name: 'Dominique CAPTIEN',
    dates: 'né·e le 2 septembre 1962, Tours',
    chapterId: 'captien',
    parents: ['francois-armand-captien-1922', 'odile-alexandrine-pierre'],
    bio: "Enfant de François Armand Captien et d’Odile Alexandrine Pierre. Source : MyHeritage.",
    source: 'MyHeritage'
  },

  // === Union(s) et descendance de Chantal (déjà capturées) ===
  'claude-louis-pinazo': {
    name: 'Claude Louis PINAZO',
    dates: '† 2010, Joué-lès-Tours',
    chapterId: 'captien',
    spouses: ['chantal-captien-1946'],
    children: ['philippe-charles-pinazo-billeux'],
    bio: "Premier mari de Chantal Captien (mariage le 8 novembre 1963 à Manom, Moselle). Séparation en mai 1968 (Basse-Yutz). Divorce le 20 novembre 1973. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'charles-marc-billeux': {
    name: 'Charles Marc BILLEUX',
    dates: 'mise en ménage à Basse-Yutz (1963) ; mariage le 4 décembre 1976, Monts (Indre-et-Loire)',
    chapterId: 'captien',
    spouses: ['chantal-captien-1946'],
    children: ['thierry-georges-billeux', 'christophe-olivier-billeux'],
    bio: "Compagnon puis époux de Chantal Captien. Mise en ménage à Basse-Yutz en 1963 (Chantal, 17 ans). Mariage le 4 décembre 1976 à Monts. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'philippe-charles-pinazo-billeux': {
    name: 'Philippe Charles PINAZO BILLEUX',
    dates: 'né le 9 mars 1965 à Thionville (Moselle)',
    chapterId: 'captien',
    parents: ['chantal-captien-1946', 'claude-louis-pinazo'],
    spouses: ['marie-laure-demierre'],
    bio: "Fils de Chantal Captien et de Claude Louis Pinazo. Épouse Marie Laure Jeanne Michelle Demierre le 31 janvier 2004 à Thoiré-sur-Dinan (Sarthe). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'marie-laure-demierre': {
    name: 'Marie Laure Jeanne Michelle DEMIERRE',
    dates: 'mariage le 31 janvier 2004, Thoiré-sur-Dinan (Sarthe)',
    chapterId: 'captien',
    spouses: ['philippe-charles-pinazo-billeux'],
    bio: "Épouse de Philippe Charles Pinazo Billeux. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'thierry-georges-billeux': {
    name: 'Thierry Georges BILLEUX',
    dates: 'né le 7 juin 1969 à Thionville (Moselle)',
    chapterId: 'captien',
    parents: ['chantal-captien-1946', 'charles-marc-billeux'],
    spouses: ['valerie-laumel'],
    bio: "Fils de Chantal Captien. Épouse Valérie Laumel le 18 septembre 1999 à Monts (Indre-et-Loire). Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'valerie-laumel': {
    name: 'Valérie LAUMEL',
    dates: 'mariage le 18 septembre 1999, Monts (Indre-et-Loire)',
    chapterId: 'captien',
    spouses: ['thierry-georges-billeux'],
    bio: "Épouse de Thierry Georges Billeux. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'christophe-olivier-billeux': {
    name: 'Christophe Olivier BILLEUX',
    dates: 'né le 3 janvier 1972 à Tours (Indre-et-Loire)',
    chapterId: 'captien',
    parents: ['chantal-captien-1946', 'charles-marc-billeux'],
    spouses: ['ludivine-vales'],
    bio: "Fils de Chantal Captien. Épouse Ludivine Vales le 7 novembre 1998 à Tours. Source : MyHeritage.",
    source: 'MyHeritage'
  },
  'ludivine-vales': {
    name: 'Ludivine VALES',
    dates: 'mariage le 7 novembre 1998, Tours',
    chapterId: 'captien',
    spouses: ['christophe-olivier-billeux'],
    bio: "Épouse de Christophe Olivier Billeux. Source : MyHeritage.",
    source: 'MyHeritage'
  }
};

