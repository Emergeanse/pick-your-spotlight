// Fiches individuelles — pour ajouter une personne, ajouter une entrée ici avec un id
// unique (utilisé dans les liens "personne.html?id=..."), puis créer les liens dans
// content.js avec `<a class="person-link" href="personne.html?id=VOTRE-ID">Nom</a>`.

const PEOPLE = {
  'jean-francois-billieux': {
    name: 'Jean-François Billieux',
    dates: "originaire d'Alle — mariage le 27 mai 1693, Alle",
    chapterId: 'alle',
    parents: ['nicolas-billieux-aine'],
    spouses: ['marguerite-bregnard'],
    children: ['nicolas-billieux'],
    bio: "Épouse Marguerite Bregnard le 27 mai 1693 à Alle — tous deux originaires d'Alle. Fils de Nicolas Billieux, qui fut aussi l'un des témoins du mariage. C'est ce Nicolas, son père, dont le prénom sera transmis au fils de Jean-François, né en 1703."
  },
  'nicolas-billieux-aine': {
    name: 'Nicolas Billieux (Bileux)',
    dates: "mariage le 28 juillet 1669, Alle",
    chapterId: 'alle',
    parents: ['pierre-bileux'],
    spouses: ['anne-gevaudin'],
    children: ['jean-francois-billieux'],
    bio: "Père de Jean-François Billieux, dont il est le témoin au mariage le 27 mai 1693 à Alle. Épouse Anne Gevaudin le 28 juillet 1669 à Alle, fils de Pierre Bileux (acte le mentionnant explicitement). L'identification entre ce Nicolas et celui cité comme père de Jean-François en 1693 repose sur la concordance du patronyme, du village et d'un écart d'âge cohérent (24 ans) — aucun acte unique ne cite les deux événements ensemble, mais c'est le niveau de certitude habituel en généalogie d'Ancien Régime pour ce genre de recoupement."
  },
  'anne-gevaudin': {
    name: 'Anne Gevaudin',
    dates: 'mariage le 28 juillet 1669, Alle',
    chapterId: 'alle',
    parents: ['servais-gevaudin'],
    spouses: ['nicolas-billieux-aine'],
    children: ['jean-francois-billieux'],
    bio: "Épouse Nicolas Bileux le 28 juillet 1669 à Alle. Fille de Servais Gevaudin (d'Undervelier, patronyme à confirmer)."
  },
  'servais-gevaudin': {
    name: 'Servais Gevaudin',
    dates: "Undervelier (patronyme à confirmer)",
    chapterId: 'alle',
    children: ['anne-gevaudin'],
    bio: "Père d'Anne Gevaudin. Témoins au mariage de sa fille en 1669 : Jean Coman et Maurice Rossel, tous deux d'Alle."
  },
  'pierre-bileux': {
    name: 'Pierre Billeux (Bileux)',
    dates: "mariage le 8 novembre 1626, Alle",
    chapterId: 'alle',
    parents: ['pequegnot-billieux'],
    spouses: ['clemence-magnin'],
    children: ['nicolas-billieux-aine'],
    bio: "Épouse Clémence Magnin le 8 novembre 1626 à Alle, fils de Pequegnot Billieux (acte le mentionnant explicitement). Vraisemblablement le même Pierre dont le fils, Nicolas, se marie en 1669 : même patronyme rare, même village, écart de 43 ans cohérent avec une filiation père-fils — identification par recoupement plutôt que par un acte unique citant les deux générations ensemble."
  },
  'clemence-magnin': {
    name: 'Clémence Magnin',
    dates: 'mariage le 8 novembre 1626, Alle',
    chapterId: 'alle',
    parents: ['humbert-magnin'],
    spouses: ['pierre-bileux'],
    children: ['nicolas-billieux-aine'],
    bio: "Épouse Pierre Billeux le 8 novembre 1626 à Alle. Fille d'Humbert Magnin, d'Alle."
  },
  'humbert-magnin': {
    name: 'Humbert Magnin',
    dates: "Alle",
    chapterId: 'alle',
    children: ['clemence-magnin'],
    bio: "Père de Clémence Magnin. Témoins au mariage de sa fille en 1626 : Jean Perrin Baboz, Frédéric Baboz, Pequegnot Billieux (le père du marié) et Albert Rossez, avec Jean Perrin Rossez également cité."
  },
  'pequegnot-billieux': {
    name: 'Pequegnot Billieux',
    dates: "Alle — avant 1626",
    chapterId: 'alle',
    parents: ['jean-perrin-billeux-pere'],
    children: ['pierre-bileux'],
    bio: "Père de Pierre Billeux : l'acte de mariage de celui-ci, le 8 novembre 1626 à Alle, le dit explicitement — une filiation directe, du même ordre que Pierre père de Nicolas (1669) ou Nicolas père de Jean-François (1693), chacune citée noir sur blanc dans l'acte correspondant et recoupée avec le mariage du père. Seule son identité précise reste ouverte : « Pequegnot » n'est sans doute pas un prénom mais un sobriquet local (« le petit »). Deux candidats se marient à Alle 27 et 28 ans plus tôt, en 1597 et 1598 — Jean Perrin Billieux et François Billieux, très probablement frères (l'un témoin au mariage de l'autre) — et l'un des deux est vraisemblablement ce « Pequegnot ». Si leur père commun, Jean Perrin Billeux (voir sa fiche), est bien celui qu'on suppose, il serait alors le grand-père de Pierre. Une supposition bien étayée, mais qui reste, à ce stade, une supposition. Deux indices onomastiques s'opposent d'ailleurs sans trancher : le prénom François reviendra chez Jean-François (1693), en faveur de François ; mais Jean Perrin (le père) porte déjà le même prénom que son propre fils marié en 1597, et Perrin est une forme ancienne de Pierre — ce qui, tout autant, pourrait mener à Jean Perrin."
  },
  'marguerite-bregnard': {
    name: 'Marguerite Bregnard',
    dates: 'Alle, Ajoie, Jura suisse',
    chapterId: 'alle',
    parents: ['jacques-bregnard', 'claudine-bregnard'],
    spouses: ['jean-francois-billieux'],
    children: ['nicolas-billieux'],
    bio: "Épouse de Jean-François Billieux, mère de Nicolas. Fille de Jacques Bregnard, déjà décédé en 1693, et vraisemblablement de Claudine Bregnard (hypothèse : voir sa fiche). Son frère Blaise Bregnard est témoin à son mariage, célébré le 27 mai 1693 à Alle."
  },
  'jacques-bregnard': {
    name: 'Jacques Bregnard',
    dates: 'Alle — décédé avant 1693',
    chapterId: 'alle',
    spouses: ['claudine-bregnard'],
    children: ['marguerite-bregnard', 'blaise-bregnard'],
    bio: "Père de Marguerite et de Blaise Bregnard, déjà décédé lors du mariage de sa fille en 1693. Un « Jacques Bregnard » exactement homonyme est mentionné comme premier mari, déjà décédé, de Claudine Bregnard lors du remariage de celle-ci en 1677 — probablement le même homme, ce qui ferait de Claudine la mère de Marguerite (hypothèse non confirmée par acte direct)."
  },
  'claudine-bregnard': {
    name: 'Claudine Bregnard',
    dates: 'Alle — remariée le 20 septembre 1677',
    chapterId: 'alle',
    spouses: ['henri-billieux-1677'],
    bio: "Veuve d'un Jacques Bregnard (†), elle se remarie le 20 septembre 1677 à Alle avec Henri Billieux. <strong>Hypothèse non confirmée</strong> : ce Jacques Bregnard pourrait être le même que le père de Marguerite Bregnard (mariée en 1693), ce qui ferait de Claudine sa mère, et d'Henri Billieux son beau-père — sans lien de sang toutefois avec Jean-François Billieux, dont le père est Nicolas Billieux."
  },
  'blaise-bregnard': {
    name: 'Blaise Bregnard',
    dates: 'Alle, 1693',
    chapterId: 'alle',
    parents: ['jacques-bregnard'],
    bio: "Frère de Marguerite Bregnard, témoin à son mariage avec Jean-François Billieux le 27 mai 1693 à Alle."
  },
  'jean-nappez': {
    name: 'Jean Nappez',
    dates: 'notaire à Alle, 1693',
    chapterId: 'alle',
    bio: "Notaire d'Alle, témoin au mariage de Jean-François Billieux et Marguerite Bregnard le 27 mai 1693."
  },
  'henri-billieux-1677': {
    name: 'Henri Billieux',
    dates: 'mariage le 20 septembre 1677, Alle',
    chapterId: 'alle',
    spouses: ['claudine-bregnard'],
    bio: "Épouse le 20 septembre 1677 à Alle la veuve Claudine Bregnard. Témoins : François Goisard (maître d'école à Alle) et Blaise Bregnard. Un lien de parenté avec Nicolas Billieux (père de Jean-François) est plausible vu la même génération et le même village, mais n'est pas prouvé."
  },
  'nicolas-billieux': {
    name: 'Nicolas Billieux',
    dates: 'né le 5 juillet 1703 à Alle, Ajoie, Jura suisse',
    chapterId: 'alle',
    parents: ['jean-francois-billieux', 'marguerite-bregnard'],
    spouses: ['suzanne-rossel'],
    children: ['germain-billieux'],
    bio: "Baptisé le 5 juillet 1703 à Alle. Ses parrain et marraine furent Nicolas Petignat, fils d'un tailleur d'Alle, et Marie Jeanne Bailly, fille d'un appariteur de la paroisse. Il épousa Suzanne Rossel le 20 mai 1724, en présence du témoin Thomas Billieux — sans doute un frère ou un oncle, dont le lien reste à établir."
  },
  'suzanne-rossel': {
    name: 'Suzanne Rossel',
    dates: 'Alle, Ajoie, Jura suisse',
    chapterId: 'alle',
    spouses: ['nicolas-billieux'],
    children: ['germain-billieux'],
    bio: "Épouse de Nicolas Billieux, qu'elle épousa le 20 mai 1724 à Alle. Mère de Germain, né en 1728."
  },
  'thomas-billieux': {
    name: 'Thomas Billieux',
    dates: 'Alle, Ajoie, Jura suisse — vers 1724-1754',
    chapterId: 'alle',
    spouses: ['marguerite-caillet'],
    children: ['anne-marie-billieux'],
    bio: "Témoin au mariage de Nicolas Billieux et Suzanne Rossel en 1724. Son lien exact avec Nicolas — frère, oncle, cousin — n'est pas encore établi. Un « Thomas Billieux d'Alle » épouse Marguerite Caillet et a une fille, Anne Marie, baptisée le 28 janvier 1754 à Alle — sans certitude qu'il s'agisse du même homme (ce pourrait être un fils portant le même prénom). L'acte de mariage de Thomas Billieux × Marguerite Caillet, s'il est retrouvé, devrait trancher la question et pourrait permettre de remonter au-delà de Jean-François Billieux."
  },
  'marguerite-caillet': {
    name: 'Marguerite Caillet',
    dates: 'Alle, Ajoie, Jura suisse',
    chapterId: 'alle',
    spouses: ['thomas-billieux'],
    children: ['anne-marie-billieux'],
    bio: "Épouse de Thomas Billieux d'Alle."
  },
  'anne-marie-billieux': {
    name: 'Anne Marie Billieux',
    dates: 'baptisée le 28 janvier 1754 à Alle',
    chapterId: 'alle',
    parents: ['thomas-billieux', 'marguerite-caillet'],
    bio: "Fille de Thomas Billieux et Marguerite Caillet, tous deux d'Alle. Parrain et marraine : François Raval et Marie Billieux, également d'Alle — cette dernière, une autre Billieux, pourrait être une sœur ou parente proche de Thomas."
  },
  'germain-billieux': {
    name: 'Germain Billieux',
    dates: 'né en 1728 à Alle, Ajoie, Jura suisse',
    chapterId: 'lorraine',
    parents: ['nicolas-billieux', 'suzanne-rossel'],
    spouses: ['elisabeth-claudin', 'marie-anne-francoise-colchienne'],
    children: ['barbe-billieux', 'therese-billieux', 'hubert-billieux-1772'],
    bio: "Tailleur d'habits, né à Alle en 1728, quatre ans avant les Troubles de 1730. Il quitte la Suisse pour la Lorraine et épouse Élisabeth Claudin à Zommange en 1766. Veuf en 1768, il se remarie la même année à Guébling avec Marie Anne Françoise Colchienne, dont descend toute la suite de la lignée. Date et lieu de décès non encore retrouvés."
  },
  'elisabeth-claudin': {
    name: 'Élisabeth Claudin',
    dates: '? – 1768, Bidestroff, Moselle',
    chapterId: 'lorraine',
    parents: ['francois-claudin', 'vinckler-mere'],
    spouses: ['germain-billieux'],
    children: ['barbe-billieux'],
    bio: "Native de Bidestroff, en Moselle, fille de François Claudin. Elle épouse Germain Billieux le 10 février 1766 à Zommange. Leur fille Barbe naît la même année ; un fils meurt-né en février 1768, et Élisabeth s'éteint peu après, probablement des suites de couches."
  },
  'barbe-billieux': {
    name: 'Barbe Billieux',
    dates: 'née le 21 novembre 1766 à Bidestroff, Moselle',
    chapterId: 'lorraine',
    parents: ['germain-billieux', 'elisabeth-claudin'],
    bio: "Fille de Germain Billieux et d'Élisabeth Claudin, née à Bidestroff quelques mois avant la mort de sa mère."
  },
  'marie-anne-francoise-colchienne': {
    name: 'Marie Anne Françoise Colchienne',
    dates: '1739 – 1784',
    chapterId: 'lorraine',
    spouses: ['germain-billieux'],
    children: ['therese-billieux', 'hubert-billieux-1772'],
    bio: "Seconde épouse de Germain Billieux, qu'elle épouse le 2 août 1768 à Guébling (parfois orthographiée « Marie Calsienne » dans les sources), sept mois après la mort d'Élisabeth Claudin. C'est par elle que descend toute la suite de la lignée, jusqu'à Christophe Olivier Billeux aujourd'hui."
  },
  'therese-billieux': {
    name: 'Thérèse Billieux',
    dates: 'née le 15 avril 1770',
    chapterId: 'lorraine',
    parents: ['germain-billieux', 'marie-anne-francoise-colchienne'],
    bio: "Fille de Germain Billieux et de Marie Anne Françoise Colchienne, née entre le mariage de ses parents (1768) et la naissance de son frère Hubert (1772)."
  },
  'hubert-billieux-1772': {
    name: 'Hubert Billieux',
    dates: '3 octobre 1772, Bidestroff, Moselle – 7 février 1850, Chalaines, Meuse (à 77 ans)',
    chapterId: 'traversee',
    parents: ['germain-billieux', 'marie-anne-francoise-colchienne'],
    spouses: ['rose-cesar'],
    children: ['louis-billieux', 'anne-catherine-billieux', 'jean-baptiste-billieux'],
    bio: "Fils de Germain Billieux et de Marie Anne Françoise Colchienne. Meunier. Il épouse Rose César ; leur fils Louis naît en 1797. Mort à Chalaines (Meuse) le 7 février 1850, son décès est déclaré par son gendre Pierre Lallement et par François Pierre, instituteur."
  },
  'rose-cesar': {
    name: 'Rose César',
    dates: '1768 – ?',
    chapterId: 'lorraine',
    parents: ['joseph-cesar-fils', 'anne-henry'],
    spouses: ['hubert-billieux-1772'],
    children: ['louis-billieux', 'anne-catherine-billieux', 'jean-baptiste-billieux'],
    bio: "Fille de Joseph César et Anne Henry, petite-fille de Joseph César (1700-1755) et Gabrielle Françoise Jespérier. Épouse de Hubert Billieux."
  },
  'anne-catherine-billieux': {
    name: 'Anne Catherine Billieux',
    dates: 'née en 1800',
    chapterId: 'lorraine',
    parents: ['hubert-billieux-1772', 'rose-cesar'],
    spouses: ['pierre-lallement'],
    bio: "Fille de Hubert Billieux et Rose César, sœur de Louis. Épouse Pierre Lallement le 2 septembre 1818 à Villey-Saint-Étienne. C'est son mari qui déclarera le décès de son père en 1850."
  },
  'pierre-lallement': {
    name: 'Pierre Lallement',
    dates: 'mariage le 2 septembre 1818, Villey-Saint-Étienne',
    chapterId: 'lorraine',
    spouses: ['anne-catherine-billieux'],
    bio: "Époux d'Anne Catherine Billieux. Gendre de Hubert Billieux, dont il déclare le décès en 1850 à Chalaines, aux côtés de François Pierre, instituteur."
  },
  'jean-baptiste-billieux': {
    name: 'Jean Baptiste Billieux',
    dates: 'né en 1803 à Corniéville (Geville), Meuse',
    chapterId: 'lorraine',
    parents: ['hubert-billieux-1772', 'rose-cesar'],
    spouses: ['marie-virginie-andre'],
    bio: "Fils de Hubert Billieux et Rose César, frère de Louis. Épouse Marie Virginie André le 28 décembre 1840 à Rupt-devant-Saint-Mihiel (Meuse), après une annonce matrimoniale publiée le 6 décembre 1840."
  },
  'marie-virginie-andre': {
    name: 'Marie Virginie André',
    dates: 'mariage le 28 décembre 1840, Rupt-devant-Saint-Mihiel, Meuse',
    chapterId: 'lorraine',
    spouses: ['jean-baptiste-billieux'],
    bio: "Épouse de Jean Baptiste Billieux."
  },
  'louis-billieux': {
    name: 'Louis Billieux',
    dates: '23 janvier 1797, Bouillonville (Meurthe-et-Moselle) – 31 octobre 1857, Wilaya de Blida, Algérie (à 60 ans)',
    chapterId: 'traversee',
    parents: ['hubert-billieux-1772', 'rose-cesar'],
    spouses: ['marie-michel'],
    children: ['joseph-billieux', 'claude-louis-billeux', 'appoline-billieux', 'marguerite-billieux-1834', 'hubert-billieux-1838'],
    bio: "Né à Bouillonville, village troglodytique attesté dès l'an 875. Cultivateur (les fiches d'émigration de 1856 le disent aussi « viticulteur »), établi à Prauthoy (Haute-Marne), il épouse Marie Michel le 6 octobre 1824 à Ménil-la-Tour. Il émigre en Algérie en 1856 avec son fils Hubert et toute sa famille, et meurt le 31 octobre 1857 dans la Wilaya de Blida — il n'aura donc vécu qu'un peu plus d'un an sur cette terre nouvelle."
  },
  'marie-michel': {
    name: 'Marie Michel',
    dates: '1801 – 1866',
    chapterId: 'lorraine',
    parents: ['pierre-michel', 'jeanne-moserel'],
    spouses: ['louis-billieux'],
    children: ['joseph-billieux', 'claude-louis-billeux', 'appoline-billieux', 'marguerite-billieux-1834', 'hubert-billieux-1838'],
    bio: "Fille de Pierre Michel et Jeanne Moserel. Épouse Louis Billieux le 6 octobre 1824 à Ménil-la-Tour."
  },
  'joseph-billieux': {
    name: 'Joseph Billieux',
    dates: 'né le 5 septembre 1825 à Ménil-la-Tour, Meurthe-et-Moselle',
    chapterId: 'lorraine',
    parents: ['louis-billieux', 'marie-michel'],
    bio: "Fils aîné de Louis Billieux et Marie Michel. Son parcours après 1825 n'est pas encore documenté — a-t-il suivi la famille en Algérie en 1856 ? La question reste ouverte."
  },
  'claude-louis-billeux': {
    name: 'Claude Louis Billeux',
    dates: 'né le 10 février 1828 à Ménil-la-Tour, Meurthe-et-Moselle',
    chapterId: 'lorraine',
    parents: ['louis-billieux', 'marie-michel'],
    bio: "Fils de Louis Billieux et Marie Michel — son nom est ici orthographié « Billeux », sans le second « i ». Son parcours après 1828 n'est pas encore documenté."
  },
  'appoline-billieux': {
    name: 'Appoline Billieux',
    dates: 'née le 19 août 1831 à Royaumeix, Meurthe-et-Moselle',
    chapterId: 'traversee',
    parents: ['louis-billieux', 'marie-michel'],
    bio: "Fille de Louis Billieux et Marie Michel. C'est elle qu'évoquait l'e-mail de généalogie de Charles Marc Billeux comme étant, elle aussi, partie de Prauthoy — une des cinq fiches d'émigration de 1856. Nom marital : Gaucheret."
  },
  'marguerite-billieux-1834': {
    name: 'Marguerite Billieux',
    dates: 'née le 26 mai 1834 à Ménil-la-Tour, Meurthe-et-Moselle',
    chapterId: 'traversee',
    parents: ['louis-billieux', 'marie-michel'],
    spouses: ['alexandre-francois-lami'],
    bio: "Fille de Louis Billieux et Marie Michel. Épouse Alexandre François Lami le 21 avril 1857 à Blida, en Algérie — six mois avant la mort de son père."
  },
  'alexandre-francois-lami': {
    name: 'Alexandre François Lami',
    dates: 'mariage le 21 avril 1857, Blida, Algérie',
    chapterId: 'traversee',
    spouses: ['marguerite-billieux-1834'],
    bio: "Époux de Marguerite Billieux."
  },
  'hubert-billieux-1838': {
    name: 'Hubert Billieux',
    dates: '2 mai 1838, Ménil-la-Tour (Meurthe-et-Moselle) – 11 février 1898, Mouzaïa, Wilaya de Tipaza, Algérie (à 59 ans)',
    chapterId: 'traversee',
    parents: ['louis-billieux', 'marie-michel'],
    spouses: ['sylvestre-clotilde-aupetit', 'elisabeth-sutterer'],
    children: ['sylvain-billieux', 'josephine-billieux', 'georges-billeux', 'edouard-billieux', 'sans-vie-billieux-1882'],
    bio: "Marnier, puis ouvrier du ciment, puis cultivateur. Il émigre en Algérie en 1856 avec son père Louis, à l'âge de 18 ans, via Marseille. Il épouse en premières noces Sylvestre Clotilde Aupetit le 23 janvier 1865 à Oued el Alleug (Tipasa) ; elle meurt en 1871. Il se remarie le 16 décembre 1871 à Boufarik avec Elisabeth Sutterer. Il meurt le 11 février 1898 à Mouzaïa."
  },
  'sylvestre-clotilde-aupetit': {
    name: 'Sylvestre Clotilde Aupetit',
    dates: '? – 18 août 1871, Oued el Alleug, Algérie',
    chapterId: 'traversee',
    spouses: ['hubert-billieux-1838'],
    children: ['sylvain-billieux'],
    bio: "Première épouse de Hubert Billieux, épousée le 23 janvier 1865 à Oued el Alleug (Tipasa, Algérie). Morte le 18 août 1871 au même lieu."
  },
  'sylvain-billieux': {
    name: 'Sylvain Billieux',
    dates: '1869 – 1869',
    chapterId: 'traversee',
    parents: ['hubert-billieux-1838', 'sylvestre-clotilde-aupetit'],
    bio: "Fils de Hubert Billieux et Sylvestre Clotilde Aupetit, mort en bas âge la même année que sa naissance."
  },
  'elisabeth-sutterer': {
    name: 'Elisabeth Sutterer',
    dates: '1850 – 1928',
    chapterId: 'algerie-est',
    parents: ['alois-sutterer'],
    spouses: ['hubert-billieux-1838'],
    children: ['josephine-billieux', 'georges-billeux', 'edouard-billieux', 'sans-vie-billieux-1882'],
    bio: "Fille d'Alois Sutterer, petite-fille de Balthasar Sutterer. Seconde épouse de Hubert Billieux, épousée le 16 décembre 1871 à Boufarik (Wilaya de Blida, Algérie)."
  },
  'josephine-billieux': {
    name: 'Joséphine Billieux',
    dates: 'née le 15 janvier 1873 à Oued el Alleug, Tipasa, Algérie',
    chapterId: 'retour',
    parents: ['hubert-billieux-1838', 'elisabeth-sutterer'],
    spouses: ['etienne-mieux'],
    bio: "Fille de Hubert Billieux et Elisabeth Sutterer. Épouse Étienne Mieux le 14 octobre 1893 à Oued el Alleug."
  },
  'etienne-mieux': {
    name: 'Étienne Mieux',
    dates: 'mariage le 14 octobre 1893, Oued el Alleug, Algérie',
    chapterId: 'retour',
    spouses: ['josephine-billieux'],
    bio: "Époux de Joséphine Billieux."
  },
  'georges-billeux': {
    name: 'Georges Billeux',
    dates: 'né le 27 juillet 1874 à Oued el Alleug, Tipasa – mort le 1er janvier 1937 à Alger (à 62 ans)',
    chapterId: 'algerie-est',
    parents: ['hubert-billieux-1838', 'elisabeth-sutterer'],
    spouses: ['celeste-parisot'],
    children: ['hubert-georges-billeux', 'yvonne-billeux', 'fernand-billeux'],
    bio: "Fils de Hubert Billieux et d'Elisabeth Sutterer. Cultivateur. Épouse Céleste Eugénie Parisot le 9 décembre 1899 à Mouzaïa. Mort à Alger, loin d'Oued el Alleug où il était né et de Mouzaïa où il s'était marié."
  },
  'edouard-billieux': {
    name: 'Edouard Billieux',
    dates: '1875 – 1878',
    chapterId: 'retour',
    parents: ['hubert-billieux-1838', 'elisabeth-sutterer'],
    bio: "Fils de Hubert Billieux et Elisabeth Sutterer, mort à environ 3 ans."
  },
  'sans-vie-billieux-1882': {
    name: 'Enfant sans vie Billieux',
    dates: '1882',
    chapterId: 'retour',
    parents: ['hubert-billieux-1838', 'elisabeth-sutterer'],
    bio: "Enfant de Hubert Billieux et Elisabeth Sutterer, mort-né en 1882."
  },
  'celeste-parisot': {
    name: 'Céleste Eugénie Parisot',
    dates: 'mariage le 9 décembre 1899, Mouzaïa',
    chapterId: 'algerie-est',
    spouses: ['georges-billeux'],
    children: ['hubert-georges-billeux', 'yvonne-billeux', 'fernand-billeux'],
    bio: "Épouse Georges Billeux le 9 décembre 1899 à Mouzaïa. Mère d'Hubert Georges, Yvonne et Fernand."
  },
  'yvonne-billeux': {
    name: 'Yvonne Billeux',
    dates: 'née vers 1907',
    chapterId: 'algerie-est',
    parents: ['georges-billeux', 'celeste-parisot'],
    bio: "Fille de Georges Billeux et Céleste Parisot, sœur d'Hubert Georges."
  },
  'fernand-billeux': {
    name: 'Fernand Billeux',
    dates: 'né le 15 juin 1909 à Oued-Amizour, près de Béjaïa',
    chapterId: 'algerie-est',
    parents: ['georges-billeux', 'celeste-parisot'],
    bio: "Fils de Georges Billeux et Céleste Parisot, frère d'Hubert Georges. Né à Oued-Amizour, en Kabylie — la famille avait alors glissé loin à l'est de Mouzaïa, vers Béjaïa."
  },
  'hubert-georges-billeux': {
    name: 'Hubert Georges Billeux',
    dates: '29 septembre 1900, Mouzaïa (Wilaya de Tipaza, Algérie) – 20 mars 1979, Chaumont, Haute-Marne (à 78 ans)',
    chapterId: 'retour',
    parents: ['georges-billeux', 'celeste-parisot'],
    spouses: ['mariette-pettinelli', 'suzanne-bertholle', 'marguerite-roze'],
    children: ['yolande-billeux', 'eliane-billeux', 'huberte-roze', 'georges-roze', 'charles-marc-billeux', 'marguerite-billeux-fille', 'christianne-billeux'],
    bio: "Réparateur de machines agricoles sur une exploitation, en Algérie. Deux mariages et une union libre : épouse Mariette Pettinelli le 8 octobre 1921 à Troyes (divorce le 13 novembre 1936), puis Suzanne Marguerite Bertholle le 1er février 1938 à Saint-Eugène (Algérie). À partir de 1942, il se met en ménage avec Marguerite Eugénie Roze, sans l'épouser — elle est désignée comme sa « conjointe » à son décès en 1977 à Bar-sur-Aube. Sept enfants au total, nés à Maison Carrée et Bordj Menaïel (Algérie). Il vécut à Chaumont ses dernières années, dans la ville où le général Pershing avait établi son quartier général en 1917, et où il vit le viaduc s'effondrer sous les bombes de 1944. Enterré à Bar-sur-Aube."
  },
  'charles-marc-billeux': {
    name: 'Charles Marc Billeux',
    dates: 'né le 15 décembre 1946 à Bordj Menaïel, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'suzanne-bertholle'],
    spouses: ['chantal-captien'],
    children: ['thierry-georges-billeux', 'christophe-olivier-billeux'],
    bio: "Vécut à Bordj Menaïel jusqu'à ses 16 ans — son père Hubert Georges y réparait les machines agricoles. Part ensuite pour la France, où Tours devient sa ville. Se met en ménage avec Chantal Captien à Basse-Yutz (Moselle) alors qu'elle est encore mariée à Claude Louis Pinazo, puis l'épouse le 4 décembre 1976 à Monts (Indre-et-Loire), après son divorce. Le couple s'installe à Monts, en Touraine — sans doute parce que Chantal était née à Amboise, à quelques kilomètres de là. Le 12 avril 2020, il s'envoie à lui-même un e-mail intitulé « Généalogie », annotant les fiches d'émigration de 1856 : « MON. AR. GP » pour son arrière-grand-père Hubert, « MON. AR. AR. GP » pour son arrière-arrière-grand-père Louis. C'est ce document, transmis à son fils, qui a permis de relier la branche d'Algérie à celle de Lorraine et de Suisse."
  },
  'chantal-captien': {
    name: 'Chantal Marguerite Edith Captien',
    dates: '12 avril 1946, Amboise, Indre-et-Loire – 25 octobre 2013, Luynes, Indre-et-Loire (à 67 ans, tumeur au cerveau)',
    chapterId: 'retour',
    spouses: ['claude-louis-pinazo', 'charles-marc-billeux'],
    children: ['philippe-charles-pinazo-billeux', 'thierry-georges-billeux', 'christophe-olivier-billeux'],
    bio: "Née à Amboise, en Touraine. Aide comptable aux Établissements Meunier, à Tours. Épouse en premières noces Claude Louis Pinazo le 8 novembre 1963 à Manom (Moselle), à 17 ans ; ils se séparent en mai 1968 à Basse-Yutz et divorcent le 20 novembre 1973. Elle se met en ménage avec Charles Marc Billeux dès 1968-1969 à Basse-Yutz, puis l'épouse le 4 décembre 1976 à Monts, où le couple s'installe — sans doute un retour vers sa Touraine natale. Incinérée ; ses cendres reposent au jardin du souvenir de Monts (Indre-et-Loire)."
  },
  'claude-louis-pinazo': {
    name: 'Claude Louis Pinazo',
    dates: '? – 2010, Joué-lès-Tours',
    chapterId: 'retour',
    spouses: ['chantal-captien'],
    children: ['philippe-charles-pinazo-billeux'],
    bio: "Premier mari de Chantal Captien, épousée le 8 novembre 1963 à Manom (Moselle). Séparés en 1968, divorcés le 20 novembre 1973."
  },
  'philippe-charles-pinazo-billeux': {
    name: 'Philippe Charles Pinazo Billeux',
    dates: 'né le 9 mars 1965 à Thionville, Moselle',
    chapterId: 'retour',
    parents: ['chantal-captien', 'claude-louis-pinazo'],
    spouses: ['marie-laure-demierre'],
    bio: "Fils de Chantal Captien et de Claude Louis Pinazo, né durant leur mariage. Épouse Marie Laure Jeanne Michelle Demierre le 31 janvier 2004 à Thoiré-sur-Dinan (Sarthe)."
  },
  'marie-laure-demierre': {
    name: 'Marie Laure Jeanne Michelle Demierre',
    dates: 'mariage le 31 janvier 2004, Thoiré-sur-Dinan, Sarthe',
    chapterId: 'retour',
    spouses: ['philippe-charles-pinazo-billeux'],
    bio: "Épouse de Philippe Charles Pinazo Billeux."
  },
  'thierry-georges-billeux': {
    name: 'Thierry Georges Billeux',
    dates: 'né le 7 juin 1969 à Thionville, Moselle',
    chapterId: 'retour',
    parents: ['chantal-captien', 'charles-marc-billeux'],
    spouses: ['valerie-laumel'],
    bio: "Né à Thionville en 1969, après la séparation de sa mère et de Claude Louis Pinazo — il porte le nom de Billeux, non celui de Pinazo, ce qui suggère qu'il est le fils de Charles Marc Billeux plutôt que de Pinazo, sans qu'un acte ne le confirme explicitement. Épouse Valérie Laumel le 18 septembre 1999 à Monts."
  },
  'valerie-laumel': {
    name: 'Valérie Laumel',
    dates: 'mariage le 18 septembre 1999, Monts, Indre-et-Loire',
    chapterId: 'retour',
    spouses: ['thierry-georges-billeux'],
    bio: "Épouse de Thierry Georges Billeux."
  },
  'christophe-olivier-billeux': {
    name: 'Christophe Olivier Billeux',
    dates: 'né le 3 janvier 1972 à Tours, Indre-et-Loire',
    chapterId: 'retour',
    parents: ['charles-marc-billeux', 'chantal-captien'],
    spouses: ['ludivine-vales', 'clarisse-noel'],
    bio: "Fils de Charles Marc Billeux et de Chantal Captien, né à Tours. Épouse Ludivine Vales le 7 novembre 1998 à Tours ; divorcés depuis 2005. En couple avec Clarisse Noël depuis 2008. Il reprend le fil de la recherche généalogique là où son père l'avait laissé, et remonte le courant du Doubs jusqu'à Alle — jusqu'à Jean-François et Marguerite dont on ne sait presque rien, sinon qu'ils ont existé. Curateur du « BILLEUX Family Tree » et auteur, avec Claude, de cette chronique."
  },
  'ludivine-vales': {
    name: 'Ludivine Vales',
    dates: 'mariage le 7 novembre 1998, Tours ; divorce en 2005',
    chapterId: 'retour',
    spouses: ['christophe-olivier-billeux'],
    bio: "Épouse de Christophe Olivier Billeux de 1998 à 2005."
  },
  'clarisse-noel': {
    name: 'Clarisse Noël',
    dates: 'en couple depuis 2008',
    chapterId: 'retour',
    spouses: ['christophe-olivier-billeux'],
    bio: "Compagne de Christophe Olivier Billeux depuis 2008."
  },

  // --- Épouses/compagne et enfants d'Hubert Georges Billeux ---
  'mariette-pettinelli': {
    name: 'Mariette Pettinelli',
    dates: 'mariage le 8 octobre 1921 à Troyes (Aube) ; divorce le 13 novembre 1936',
    chapterId: 'retour',
    spouses: ['hubert-georges-billeux'],
    children: ['yolande-billeux'],
    bio: "Première épouse d'Hubert Georges Billeux."
  },
  'suzanne-bertholle': {
    name: 'Suzanne Marguerite Bertholle',
    dates: 'mariage le 1er février 1938 à Saint-Eugène, Algérie',
    chapterId: 'retour',
    spouses: ['hubert-georges-billeux'],
    children: ['eliane-billeux', 'charles-marc-billeux', 'marguerite-billeux-fille', 'christianne-billeux'],
    bio: "Seconde épouse d'Hubert Georges Billeux, épousée à Saint-Eugène, en Algérie."
  },
  'marguerite-roze': {
    name: 'Marguerite Eugénie Roze',
    dates: '? – 22 avril 1977, Bar-sur-Aube',
    chapterId: 'retour',
    spouses: ['hubert-georges-billeux'],
    children: ['huberte-roze', 'georges-roze'],
    bio: "Compagne d'Hubert Georges Billeux à partir de leur mise en ménage en 1942 — non mariés, elle est désignée comme sa « conjointe » à son décès en 1977 à Bar-sur-Aube. Leurs enfants portent son nom, Roze."
  },
  'yolande-billeux': {
    name: 'Yolande Gisèle Billeux',
    dates: 'née le 3 juin 1935 à Maison Carrée, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'mariette-pettinelli'],
    bio: "Fille d'Hubert Georges Billeux et de Mariette Pettinelli. Nom marital : Salort."
  },
  'eliane-billeux': {
    name: 'Eliane Billeux',
    dates: 'née le 1er juillet 1941 à Maison Carrée, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'suzanne-bertholle'],
    spouses: ['william-gomez'],
    bio: "Fille d'Hubert Georges Billeux et de Suzanne Bertholle. Épouse William Gomez le 11 juin 1960 à Maison Carrée."
  },
  'huberte-roze': {
    name: 'Huberte Roze',
    dates: 'née le 7 juillet 1942 à Ménerville, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'marguerite-roze'],
    spouses: ['jean-claude-masanet'],
    bio: "Fille d'Hubert Georges Billeux et de Marguerite Eugénie Roze. Épouse Jean Claude Masanet le 14 novembre 1964 aux Pennes-Mirabeau."
  },
  'georges-roze': {
    name: 'Georges Roze',
    dates: 'né le 5 décembre 1943 à Bordj Menaïel, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'marguerite-roze'],
    spouses: ['monique-boibessot'],
    bio: "Fils d'Hubert Georges Billeux et de Marguerite Eugénie Roze. Épouse Monique Boibessot le 17 septembre 1965 à Eygalières."
  },
  'marguerite-billeux-fille': {
    name: 'Marguerite Billeux',
    dates: 'née le 8 mai 1948 à Bordj Menaïel, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'suzanne-bertholle'],
    spouses: ['claude-souvais'],
    bio: "Fille d'Hubert Georges Billeux et de Suzanne Bertholle. Épouse Claude Souvais le 9 juin 1969 à Bar-sur-Aube."
  },
  'christianne-billeux': {
    name: 'Christianne Billeux',
    dates: 'née le 5 juillet 1950 à Bordj Menaïel, Algérie',
    chapterId: 'retour',
    parents: ['hubert-georges-billeux', 'suzanne-bertholle'],
    bio: "Fille d'Hubert Georges Billeux et de Suzanne Bertholle. Nom marital : Gérard."
  },
  'william-gomez': {
    name: 'William Gomez',
    dates: 'mariage le 11 juin 1960, Maison Carrée, Algérie',
    chapterId: 'retour',
    spouses: ['eliane-billeux'],
    bio: "Époux d'Eliane Billeux."
  },
  'jean-claude-masanet': {
    name: 'Jean Claude Masanet',
    dates: 'mariage le 14 novembre 1964, Les Pennes-Mirabeau',
    chapterId: 'retour',
    spouses: ['huberte-roze'],
    bio: "Époux de Huberte Roze."
  },
  'monique-boibessot': {
    name: 'Monique Boibessot',
    dates: 'mariage le 17 septembre 1965, Eygalières',
    chapterId: 'retour',
    spouses: ['georges-roze'],
    bio: "Épouse de Georges Roze."
  },
  'claude-souvais': {
    name: 'Claude Souvais',
    dates: 'mariage le 9 juin 1969, Bar-sur-Aube',
    chapterId: 'retour',
    spouses: ['marguerite-billeux-fille'],
    bio: "Époux de Marguerite Billeux."
  },

  // --- Parents d'Élisabeth Claudin ---
  'francois-claudin': {
    name: 'François Claudin',
    dates: 'Bidestroff, Moselle',
    chapterId: 'lorraine',
    spouses: ['vinckler-mere'],
    children: ['elisabeth-claudin'],
    bio: "Père d'Élisabeth Claudin, de Bidestroff, en Moselle."
  },
  'vinckler-mere': {
    name: '(Barbe ou Anne) Vinckler',
    dates: 'Bidestroff, Moselle',
    chapterId: 'lorraine',
    spouses: ['francois-claudin'],
    children: ['elisabeth-claudin'],
    bio: "Mère d'Élisabeth Claudin. Son prénom diverge selon les sources : l'acte de mariage de 1766 indique Barbe, l'arbre en ligne consulté indique Anne — point non encore tranché."
  },

  // --- Ascendance de Rose César ---
  'joseph-cesar-1755': {
    name: 'Joseph César',
    dates: '1700 – 1755',
    chapterId: 'lorraine',
    spouses: ['gabrielle-francoise-jesperier'],
    children: ['joseph-cesar-fils'],
    bio: "Arrière-grand-père de Louis Billieux du côté maternel."
  },
  'gabrielle-francoise-jesperier': {
    name: 'Gabrielle Françoise Jespérier',
    dates: 'née en 1705',
    chapterId: 'lorraine',
    spouses: ['joseph-cesar-1755'],
    children: ['joseph-cesar-fils']
  },
  'joseph-cesar-fils': {
    name: 'Joseph César',
    chapterId: 'lorraine',
    parents: ['joseph-cesar-1755', 'gabrielle-francoise-jesperier'],
    spouses: ['anne-henry'],
    children: ['rose-cesar']
  },
  'henry-pere': {
    name: 'N. Henry',
    chapterId: 'lorraine',
    spouses: ['gagnot-mere'],
    children: ['anne-henry'],
    bio: "Prénom non renseigné dans les sources consultées."
  },
  'gagnot-mere': {
    name: 'N. Gagnot',
    chapterId: 'lorraine',
    spouses: ['henry-pere'],
    children: ['anne-henry'],
    bio: "Prénom non renseigné dans les sources consultées."
  },
  'anne-henry': {
    name: 'Anne Henry',
    chapterId: 'lorraine',
    parents: ['henry-pere', 'gagnot-mere'],
    spouses: ['joseph-cesar-fils'],
    children: ['rose-cesar']
  },

  // --- Ascendance de Marie Michel ---
  'pierre-fayon': {
    name: 'Pierre Fayon',
    dates: '1702 – 1752',
    chapterId: 'lorraine',
    spouses: ['jeanne-barbe-pasquis'],
    children: ['francoise-fayon']
  },
  'jeanne-barbe-pasquis': {
    name: 'Jeanne Barbe Pasquis',
    dates: '1703 – 1765',
    chapterId: 'lorraine',
    spouses: ['pierre-fayon'],
    children: ['francoise-fayon']
  },
  'francoise-fayon': {
    name: 'Françoise Fayon',
    dates: 'née en 1732',
    chapterId: 'lorraine',
    parents: ['pierre-fayon', 'jeanne-barbe-pasquis'],
    spouses: ['jean-michel'],
    children: ['pierre-michel']
  },
  'jean-michel': {
    name: 'Jean Michel',
    dates: 'né en 1736',
    chapterId: 'lorraine',
    spouses: ['francoise-fayon'],
    children: ['pierre-michel']
  },
  'pierre-michel': {
    name: 'Pierre Michel',
    chapterId: 'lorraine',
    parents: ['jean-michel', 'francoise-fayon'],
    spouses: ['jeanne-moserel'],
    children: ['marie-michel']
  },
  'jeanne-moserel': {
    name: 'Jeanne Moserel',
    chapterId: 'lorraine',
    spouses: ['pierre-michel'],
    children: ['marie-michel']
  },

  // --- Ascendance d'Elisabeth Sutterer ---
  'balthasar-sutterer': {
    name: 'Balthasar Sutterer',
    dates: 'né en 1747',
    chapterId: 'retour',
    children: ['alois-sutterer'],
    bio: "Grand-père d'Elisabeth Sutterer. Le nom de son épouse n'a pas été relevé."
  },
  'alois-sutterer': {
    name: 'Alois Sutterer',
    dates: 'né en 1781',
    chapterId: 'retour',
    parents: ['balthasar-sutterer'],
    children: ['elisabeth-sutterer'],
    bio: "Père d'Elisabeth Sutterer."
  },

  // --- Témoins et officiants de l'acte de mariage de 1766 (Zommange) ---
  'francois-lebegue': {
    name: 'François Lébègue',
    dates: 'Zommange, 1766',
    chapterId: 'lorraine',
    bio: "Maître d'école à Zommange, témoin au mariage de Germain Billieux et Élisabeth Claudin, le 10 février 1766."
  },
  'nicolas-marquard': {
    name: 'Nicolas Marquard',
    dates: 'Zommange, 1766',
    chapterId: 'lorraine',
    bio: "Laboureur à Zommange, témoin au mariage de Germain Billieux et Élisabeth Claudin, le 10 février 1766."
  },
  'henry-vautrin': {
    name: 'Henry Vautrin',
    dates: 'Zommange, 1766',
    chapterId: 'lorraine',
    bio: "Témoin au mariage de Germain Billieux et Élisabeth Claudin, le 10 février 1766, à Zommange."
  },
  'cure-duvernoy': {
    name: 'M. Duvernoy',
    dates: 'curé, paroisse d’Alle, 1766',
    chapterId: 'alle',
    bio: "Curé de la paroisse d'Alle ; a délivré le certificat de non-opposition ayant permis le mariage de Germain Billieux à Zommange en 1766."
  },
  'vicaire-schmitt': {
    name: 'Schmitt',
    dates: 'vicaire, Zommange, 1766',
    chapterId: 'lorraine',
    bio: "Vicaire ayant célébré le mariage de Germain Billieux et Élisabeth Claudin, le 10 février 1766, à Zommange."
  },

  // --- Branche noble « de Billieux d'Ehrenfeld », Porrentruy (non rattachée à la lignée directe) ---
  'dominique-joseph-billieux-ehrenfeld': {
    name: 'Dominique Joseph de Billieux d’Ehrenfeld',
    dates: 'Porrentruy',
    children: ['andre-francois-xavier-billieux-ehrenfeld', 'ignace-billieux-ehrenfeld', 'joseph-bernard-billieux-ehrenfeld', 'ursanne-conrad-joseph-billieux-ehrenfeld', 'aloyse-billieux-ehrenfeld'],
    bio: "Père de cinq fils qui ont marqué l'histoire de l'ancien Évêché de Bâle, dont le baron Ursanne Conrad Joseph et le prévôt Aloyse. Aucun lien de filiation prouvé avec la branche paysanne d'Alle (Nicolas et Germain Billieux) — seulement une proximité géographique et patronymique dans le même territoire."
  },
  'andre-francois-xavier-billieux-ehrenfeld': {
    name: 'André François Xavier de Billieux d’Ehrenfeld',
    parents: ['dominique-joseph-billieux-ehrenfeld'],
    bio: "Fils de Dominique Joseph de Billieux d'Ehrenfeld."
  },
  'ignace-billieux-ehrenfeld': {
    name: 'Ignace de Billieux d’Ehrenfeld',
    parents: ['dominique-joseph-billieux-ehrenfeld'],
    bio: "Fils de Dominique Joseph de Billieux d'Ehrenfeld."
  },
  'joseph-bernard-billieux-ehrenfeld': {
    name: 'Joseph Bernard de Billieux d’Ehrenfeld',
    parents: ['dominique-joseph-billieux-ehrenfeld'],
    bio: "Fils de Dominique Joseph de Billieux d'Ehrenfeld, chanoine à Zurzach."
  },
  'ursanne-conrad-joseph-billieux-ehrenfeld': {
    name: 'Ursanne Conrad Joseph de Billieux d’Ehrenfeld',
    parents: ['dominique-joseph-billieux-ehrenfeld'],
    bio: "Baron, commissaire du gouvernement général pour l'ancien Évêché de Bâle (1814-1815), aux côtés du baron d'Andlau puis du commissaire fédéral Jean Conrad d'Escher, lors de la réunion de l'ancien Évêché de Bâle au canton de Berne."
  },
  'aloyse-billieux-ehrenfeld': {
    name: 'Aloyse Joseph Melchior de Billieux d’Ehrenfeld',
    dates: '10 décembre 1758, Porrentruy – 27 juin 1830, Porrentruy',
    parents: ['dominique-joseph-billieux-ehrenfeld'],
    bio: "Docteur en théologie (Rome), entré au chapitre collégial de Saint-Ursanne en 1779, où il succède comme prévôt à son oncle et parrain Melchior Joseph Tardy. Provicaire général du Jura (1818), vicaire général du diocèse de Bâle (1829)."
  },

  // --- Autres occurrences du patronyme, non rattachées ---
  'henri-billieux-1667': {
    name: 'Henri Billieux',
    dates: 'Saint-Ursanne, 1667',
    parents: ['ursanne-billieux-montfaucon'],
    bio: "Maître Bourgeois de Saint-Ursanne, commanditaire présumé (initiales « MB ») de la fontaine de la Rue Basse, sculptée par Jean Quillerat en 1667. Aucun lien de filiation prouvé avec le reste de la lignée — simple proximité géographique et patronymique. <strong>Hypothèse</strong> : pourrait être le même homme qu'un « Jean Henry Billieux, fils de feu Ursanne Billieux, de Saint-Ursanne », qui vend en 1648 la moitié d'une rente de 900 livres — l'âge concorderait (né vers 1620-1630, il aurait 37 à 47 ans en 1667, tout à fait l'âge d'un Maître Bourgeois). Jean Henry et Henri sont, à cette époque, des variantes courantes d'un même prénom."
  },
  'ursanne-billieux-montfaucon': {
    name: 'Ursanne Billieux (Beilleulx)',
    dates: 'bourgeois de Saint-Ursanne — décédé avant 1648',
    children: ['henri-billieux-1667'],
    bio: "Bourgeois de Saint-Ursanne. Avec son frère aîné Jean George, il amodie une pâture aux Montbovats auprès de la communauté de Montfaucon, en deux baux (1630, puis 1636), pour un total de 915 livres bâloises versées malgré les « troubles de guerre » qui les empêchent d'en jouir pleinement — un nouvel accord est trouvé en 1641. Le même acte l'orthographie tantôt « Beilleulx », tantôt (dans une note postérieure de 1648) « Billieux » : une belle illustration de l'instabilité orthographique du patronyme à cette époque. Décédé avant 1648, date à laquelle son fils Jean Henry vend une partie de son héritage."
  },
  'jean-george-billieux-montfaucon': {
    name: 'Jean George Billieux (Beilleulx)',
    dates: "bourgeois — 1630-1648",
    bio: "Frère aîné d'Ursanne Billieux, avec qui il amodie en 1630 et 1636 une pâture aux Montbovats auprès de la communauté de Montfaucon. Le 19 février 1648, il vend la moitié de son « droit » à George Carrel, ancien maire de Diesse, pour 457 livres."
  },
  'christophe-billeux-1849': {
    name: 'Christophe Billeux',
    dates: 'mariage le 9 octobre 1849, Besançon',
    spouses: ['catherine-ruwell'],
    bio: "Épouse Catherine Ruwell à Besançon en 1849. Simple coïncidence patronymique relevée en passant — aucun lien avec la lignée directe n'est établi ni recherché."
  },
  'catherine-ruwell': {
    name: 'Catherine Ruwell',
    dates: 'mariage le 9 octobre 1849, Besançon',
    spouses: ['christophe-billeux-1849']
  },

  // --- Actes anciens d'Alle (1598-1753), non rattachés à ce jour — mais dans la
  // bonne fenêtre chronologique pour, un jour, prolonger la lignée au-delà de
  // Jean-François Billieux (né avant 1703).
  'francois-billieux-1598': {
    name: 'François Billieux',
    dates: 'mariage le 21 juillet 1598, Alle',
    parents: ['jean-perrin-billeux-pere'],
    spouses: ['nn-viatte'],
    bio: "Épouse à Alle, le 21 juillet 1598, une veuve désignée « NN Viatte » (prénom non renseigné dans l'acte), veuve de Jean Perrin Babot. Témoins : Jean Perrin Billieux et André Billieux. Jean Perrin, marié l'année précédente et témoin à ce mariage, est vraisemblablement son frère. François est l'un des deux candidats sérieux (avec Jean Perrin) pour être le « Pequegnot Billieux » père de Pierre Billeux en 1626 : leurs mariages respectifs, en 1597 et 1598, tombent 27 et 28 ans avant celui de Pierre — un écart cohérent avec une filiation père-fils dans les deux cas."
  },
  'nn-viatte': {
    name: '(prénom inconnu) Viatte',
    dates: 'mariage le 21 juillet 1598, Alle',
    spouses: ['francois-billieux-1598'],
    bio: "Veuve de Jean Perrin Babot, remariée à François Billieux en 1598 à Alle. Son prénom n'est pas renseigné dans l'acte (« NN »)."
  },
  'jean-perrin-billieux-1598': {
    name: 'Jean Perrin Billieux',
    dates: 'mariage le 23 novembre 1597, Alle',
    parents: ['jean-perrin-billeux-pere'],
    spouses: ['francoise-guillot'],
    bio: "Épouse Françoise Guillot dit Pin le 23 novembre 1597 à Alle, fils de feu Jean Perrin Billeux (le père) — une filiation citée noir sur blanc dans l'acte. L'année suivante, en 1598, il est témoin au mariage de François Billieux et NN Viatte — vraisemblablement son frère, actes consécutifs dans le même registre (ArCJ Bob 14 item 2, actes 13 et 15). Il est l'un des deux candidats sérieux (avec François) pour être le « Pequegnot Billieux » père de Pierre Billeux en 1626 : son mariage tombe 29 ans avant celui de Pierre, un écart cohérent avec une filiation père-fils."
  },
  'jean-perrin-billeux-pere': {
    name: 'Jean Perrin Billeux',
    dates: "né vers 1550, Alle — décédé avant 1597",
    children: ['jean-perrin-billieux-1598', 'francois-billieux-1598'],
    bio: "Naissance vers 1550 estimée par calcul (pour avoir un fils en âge de se marier en 1597, en comptant environ 25-30 ans par génération) — aucun acte ne donne sa date de naissance. Père de Jean Perrin Billieux, marié en 1597, déjà décédé à cette date — l'acte le dit explicitement. Il est très probablement aussi le père de François Billieux, marié l'année suivante (1598) : les deux hommes se marient à un an d'écart dans le même village, et Jean Perrin est témoin au mariage de François — l'indice classique d'une fratrie. Aucun acte ne cite directement le père de François, mais la coïncidence est forte. L'un de ces deux frères est vraisemblablement le « Pequegnot Billeux » père de Pierre Billeux (1626, voir sa fiche) — les deux mariages, en 1597 et 1598, tombent à 27 et 28 ans de celui de Pierre, un écart père-fils tout à fait cohérent des deux côtés. Si c'est le cas, Jean Perrin Billeux serait le grand-père de Pierre — Perrin, forme ancienne de Pierre, allant dans ce sens."
  },
  'francoise-guillot': {
    name: 'Françoise Guillot dit Pin',
    dates: 'mariage le 23 novembre 1597, Alle',
    spouses: ['jean-perrin-billieux-1598'],
    bio: "Épouse Jean Perrin Billieux le 23 novembre 1597 à Alle, fille de Jean Perrin Guillot dit Pin."
  },
  'andre-billieux-1598': {
    name: 'André Billieux',
    dates: 'Alle, 1598-1625',
    children: ['viatte-billieux-1625'],
    bio: "Témoin au mariage de François Billieux et NN Viatte en 1598 à Alle. Vraisemblablement le même André Billieux d'Alle dont la fille, Viatte, se marie en 1625."
  },
  'viatte-billieux-1625': {
    name: 'Viatte Billieux',
    dates: 'mariage le 28 janvier 1625, Alle',
    parents: ['andre-billieux-1598'],
    spouses: ['francois-symon'],
    bio: "Fille d'André Billieux, d'Alle. Épouse le 28 janvier 1625 François Symon, d'Urtière."
  },
  'francois-symon': {
    name: 'François Symon',
    dates: "mariage le 28 janvier 1625, Alle — originaire d'Urtière",
    spouses: ['viatte-billieux-1625'],
    bio: "Originaire d'Urtière, épouse Viatte Billieux, fille d'André Billieux d'Alle, le 28 janvier 1625."
  },
  'jean-pierre-billieux': {
    name: 'Jean Pierre Billieux',
    dates: "Alle, vers 1753",
    spouses: ['barbe-ophmaier'],
    children: ['barbe-billieux-1753'],
    bio: "D'Alle. Épouse Barbe Ophmaier ; leur fille Barbe est baptisée le 14 septembre 1753 à Alle. Aucun lien de filiation prouvé avec le reste de la lignée à ce jour."
  },
  'barbe-ophmaier': {
    name: 'Barbe Ophmaier',
    dates: 'Alle, vers 1753',
    spouses: ['jean-pierre-billieux'],
    children: ['barbe-billieux-1753'],
    bio: "Épouse de Jean Pierre Billieux, d'Alle."
  },
  'barbe-billieux-1753': {
    name: 'Barbe Billieux',
    dates: 'baptisée le 14 septembre 1753 à Alle',
    parents: ['jean-pierre-billieux', 'barbe-ophmaier'],
    bio: "Fille de Jean Pierre Billieux et Barbe Ophmaier, tous deux d'Alle. Parrain et marraine : Henri Paul et Barbe Raval, également d'Alle — une famille Raval qui revient aussi comme témoin dans l'acte de baptême d'Anne Marie Billieux (1754), fille de Thomas Billieux."
  }
};
