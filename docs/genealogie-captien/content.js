// Contenu du site — récit unifié chronologie + géographie (CAPTIEN / Kapgen).
// Pour ajouter un chapitre, compléter CHAPTERS ; `app.js` se charge du rendu.

const SITE_INTRO = {
  narrative: [
    `Alors voilà… on va raconter cette famille-là autrement que par les dates seules. Par les lieux aussi. Par la terre qu'on foule, qu'on laboure, qu'on quitte un jour sans toujours savoir pourquoi, ni pour combien de temps.`,
    `Quatre siècles et demi… et une carte qui ne cesse de se redessiner autour de nous. Lorraine, Luxembourg, Moselle, Touraine — des noms d'administration, de guerre, de paix retrouvée. Nous, on vivait là où l'on pouvait. On construisait, on enfantait, on enterrait. Et parfois on partait — dix kilomètres, cent, cinq cents — parce que la frontière avait bougé encore une fois, ou parce qu'un métier, un mariage, un quinté vous emmenait ailleurs.`,
    `Six étapes, de Laudrefang à Tours. Chaque chapitre suit le fil des générations et celui des cartes — parce que chez nous, les deux ne se séparent jamais vraiment.`
  ]
};

const CHAPTERS = [
  {
    id: 'laudrefang',
    years: 'avant 1583 – 1693',
    place: 'Laudrefang — pays de Nied, couloir franco-germanique',
    illustration: `<img src="illustration-laudrefang.png" alt="Laudrefang, village mosellan aux origines de la lignée">`,
    narrative: [
      `Bon. Alors voilà, on va y aller… doucement… parce que là-bas, dans les registres, y a rien qui presse. Rien qui crie. Juste des noms qui reviennent, tenaces… comme des mauvaises herbes qu'on n'arrache pas, qu'on laisse repousser, parce qu'au fond on les aime bien, ces mauvaises herbes-là, c'est nous.`,
      `Laudrefang… vous la cherchez sur une carte d'aujourd'hui, elle est là, discrète, dans le canton de Bouzonville, à une poignée de kilomètres de la Sarre. Mais à l'époque de <a class="person-link" href="personne.html#georges-schneider-1583">Georges SCHNEIDER</a> — avant 1583, on ne sait même pas quand exactement — c'était le bout du monde connu, le pays de Nied, cette plaine lorraine où l'on parle allemand le dimanche et français le lundi, selon qui commande. L'Europe, autour, sort à peine des guerres de Religion — on sort du massacre — et déjà s'annonce la Trentenaire, celle qui va durer trente ans et vider les villages comme on vide un tonneau.`,
      `Avant 1583… tenez-vous bien… voilà Georges. On sait presque rien de lui. Pas de métier noté, pas de maison décrite, rien. Juste qu'il a existé, qu'il s'est marié vers 1600 avec une certaine <a class="person-link" href="personne.html#christine-nn-schneider">Christine</a>… dont même le nom de jeune fille s'est perdu en route, quelque part entre deux siècles, dans la poussière d'un curé qui écrivait vite, qui écrivait mal, qui écrivait pour lui et pas pour nous. NN, qu'on note. Nomen nescio. On ne sait pas le nom. Ça, c'est tout ce qui reste d'elle… trois lettres et un vide.`,
      `Deux fils leur viennent. <a class="person-link" href="personne.html#valentin-schneider-1603">Valentin</a>, vers 1603… et son frère <a class="person-link" href="personne.html#quirin-virich-schneider-1615">Quirin Virich</a>, vers 1615, prénom qu'on dirait tombé d'un autre siècle, d'une autre langue presque, allemande ou lorraine, allez savoir. Valentin, lui, il tiendra… quatre-vingt-dix ans, tenez-vous bien, né vers 1603 et mort le 27 août 1693 à Laudrefang même, sans avoir bougé, ou presque. Une géographie immobile, celle des paysans du XVIIe siècle : on naît où l'on meurt, à moins qu'une guerre, une famine, un mariage lointain ne vous pousse ailleurs. Valentin, lui, tient bon — comme si le monde entier avait tourné autour de lui sans qu'il ait jamais eu besoin d'en sortir.`,
      `On n'a pas de château, nous, pas de blason. On a ce couloir entre deux mondes — duché de Lorraine, influence des Trois-Évêchés, proximité du Saint-Empire — et des registres paroissiaux obligatoires depuis Villers-Cotterêts (1539) qui commencent enfin à nous laisser une trace. Avant, c'était le néant. Après, c'est un nom. C'est déjà énorme.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'La guerre de Trente Ans (1618–1648)',
        text: `La guerre de Trente Ans ravage la Lorraine : pillages, famines, épidémies. Les villages du pays de Nied subissent le passage des armées suédoises, impériales, françaises. La démographie s'effondre ; la reprise ne commence qu'au tournant du siècle suivant. Les registres paroissiaux, obligatoires depuis 1539, deviennent alors la seule mémoire fiable des gens sans terre, sans titre, sans rien que leur nom et leur baptême.`
      },
      {
        type: 'lieu',
        title: 'Laudrefang — zone tampon',
        text: `Petit village du pays de Bouzonville, sur la route qui va de Metz vers la Sarre. Laudrefang se situe dans une zone tampon permanente : duché de Lorraine, influence française (Trois-Évêchés), proximité du Saint-Empire. Les habitants vivent avec des frontières mouvantes qu'ils ne choisissent pas — et dont ils ne voient parfois que les conséquences : impôts, langue des actes, curé d'une nationalité ou d'une autre. Le village, lui, ne bouge pas d'un pouce en trois siècles.`
      },
      {
        type: 'anecdote',
        title: `Kapgen, graphie d'époque`,
        text: `Avant que la lignée ne se fixe en CAPTIEN, le patronyme s'écrivait KAPGEN — forme plus germanique, attestée par la tradition familiale pour le XVIIe–début XVIIIe siècle. C'est la graphie que le curé aurait inscrite sur les registres de Bambiderstroff et de Mondorf. Ensuite, latinisation et modernisation : Captien. Deux écritures, un même nom — Kapgen sur l'acte, Captien chez les descendants.`
      }
    ]
  },
  {
    id: 'bambiderstroff',
    years: '1684 – 1727',
    place: 'Bambiderstroff — paroisse et frontière luxembourgeoise',
    illustration: `<img src="illustration-bambiderstroff.png" alt="Bambiderstroff, village mosellan au lever du soleil">`,
    narrative: [
      `Une génération, ça sert parfois juste à faire le pont. À relier deux rives qui, sans elle, resteraient chacune de leur côté, à jamais séparées. Ici, c'est ce qui se passe… entre la souche SCHNEIDER et ce qui va devenir la lignée CAPTIEN. Un pont d'une seule génération, pas plus, et qui tient bon quand même.`,
      `On se déplace. Pas loin — une vingtaine de kilomètres à vol d'oiseau, une journée de charrette — mais assez pour changer de paroisse, de curé, de registre. Bambiderstroff, village du canton de Boulay, accueille <a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a>, laboureur — né en 1667, on ne sait pas où au juste, mais mort le 13 décembre 1727 à Bambiderstroff, ça au moins c'est sûr — qui s'y marie le 28 novembre 1684 avec <a class="person-link" href="personne.html#marie-jungers">Marie JUNGERS</a>. Il a dix-sept ans. La terre, ici, c'est la frontière : le Luxembourg est à portée de cloche, la Sarre aussi, et les familles se marient entre voisins parce qu'on n'a ni le temps ni l'argent d'aller plus loin. (Étrangeté de l'histoire, tiens : Bambiderstroff n'est qu'à quelques kilomètres de Bidestroff, cet autre village mosellan où vivait, à la même époque, la lignée BILLIEUX. Deux familles qui se croisent sans le savoir, dans le même coin de Moselle, sans qu'un seul acte ne les rapproche encore. Il faudra attendre presque deux cent cinquante ans et cinq générations de plus, pour que Charles Marc BILLEUX et Chantal CAPTIEN se rencontrent enfin — du côté de Bar-le-Duc, dans les années 1960. Chantal, elle, quitte la Moselle ; Charles Marc, lui, revient d'Algérie — deux trajectoires inverses qui se croisent au même endroit, avant de repartir ensemble vers la Touraine. La géographie, parfois, prend son temps pour boucler ses propres boucles.)`,
      `C'est l'Europe de la reprise, après un siècle et demi de guerres. Pour Jean et Marie, tout ça c'est du bruit lointain. Eux, ils labourent. Marie s'éteindra le 7 septembre 1720 à Bambiderstroff. Sept ans avant son mari. C'est comme ça, dans ces vies-là… on ne sait jamais qui partira le premier, on fait des enfants sans savoir qui restera pour les élever.`,
      `Et de ce couple naît <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique</a>, le 29 avril 1695 — la charnière. Elle épousera <a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas KAPGEN</a> (Captien), né vers 1690–1695 (lieu inconnu) — la naissance de leur fils Christian en janvier 1718 à Mondorf fixe cette fourchette : un père d'environ vingt-trois à vingt-huit ans. Sur l'acte de mariage, le curé n'écrira pas « Captien » : il inscrira Kapgen — graphie d'époque, plus germanique, celle que la tradition familiale a conservée. Bambiderstroff, c'est le dernier village mosellan de la souche SCHNEIDER. Après Angélique, ce sera Mondorf. La frontière qu'on franchit, ce n'est pas celle des cartes — c'est celle d'un mariage, d'un acte, d'un prêtre qui inscrit deux noms côte à côte.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Reprise démographique (fin XVIIe – début XVIIIe)',
        text: `Après les guerres franco-allemandes et la peste, la Lorraine se repeuple lentement. Les mariages precoces (seize, dix-sept ans) reconstituent les familles ; les unions se font dans un rayon de quelques paroisses — on n'allait pas chercher plus loin qu'il ne fallait, la route coûtait cher et le temps encore plus.`
      },
      {
        type: 'lieu',
        title: 'Bambiderstroff — espace transfrontalier',
        text: `Village mosellan du canton de Boulay, à la lisière du Luxembourg et de la Sarre. Les laboureurs vont au marché de Boulay, parfois au-delà ; la langue, les coutumes et les alliances familiales créent un espace transfrontalier bien avant l'Europe des nations — zone où les déplacements quotidiens ignorent les frontières politiques.`
      },
      {
        type: 'anecdote',
        title: 'Marié à dix-sept ans',
        text: `Jean (Haman) SCHNEIDER se marie le 28 novembre 1684, alors qu'il n'a — si l'on en croit sa date de naissance, 1667 — que dix-sept ans. Un âge qui nous paraît aujourd'hui d'une précocité folle, mais qui n'était pas rare dans les campagnes de l'Ancien Régime, où l'on épousait tôt pour avoir des bras tôt, pour travailler la terre tant qu'il en était encore temps.`
      },
      {
        type: 'anecdote',
        title: 'Kapgen sur le registre',
        text: `Quand Angélique SCHNEIDER épouse Nicolas, le curé de Bambiderstroff — ou celui de Mondorf, selon le lieu du mariage — inscrit Kapgen, pas Captien. C'est la graphie germanique du patronyme à cette époque ; Captien ne viendra qu'ensuite, latinisé puis modernisé par la descendance. Les actes de mariage et de baptême de Christian (1718) sont la priorité pour confirmer cette écriture dans les registres.`
      }
    ]
  },
  {
    id: 'mondorf',
    years: '1718 – 1820',
    place: 'Mondorf-les-Bains — Luxembourg d\'Ancien Régime',
    illustration: `<img src="illustration-mondorf.png" alt="Mondorf-les-Bains, village luxembourgeois et sa source">`,
    narrative: [
      `Mondorf-les-Bains. Aujourd'hui station thermale, casinos, eaux minérales — à l'époque de <a class="person-link" href="personne.html#christian-captien-1718">Christian KAPGEN</a> (Captien), né le 19 janvier 1718, c'était un village agricole du canton de Remich, dans le Grevenmacher luxembourgeois. Sur son acte de baptême, le curé a sans doute écrit Kapgen ; c'est ensuite que la lignée CAPTIEN s'y fixe — et y reste. Un siècle, et davantage — quatre générations qui naissent, se marient, meurent au même endroit, sur les mêmes registres, sous la même cloche.`,
      `L'Europe, pendant ce siècle-là, change de peau trois fois. Ancien Régime… Révolution… Empire… Restauration. Le Luxembourg passe de l'Autriche des Habsbourg à la France révolutionnaire (1795), puis à l'Empire napoléonien, et redevient grand-duché en 1815. Pour Christian, <a class="person-link" href="personne.html#francois-captien-1748">François</a>, <a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth</a>, tout ça se traduit par des registres qui changent de langue — latin, français, allemand — et par des curés qui inscrivent les naissances comme si rien n'avait bougé.`,
      `Christian épouse <a class="person-link" href="personne.html#lucie-thomas">Lucie THOMAS</a> le 22 juin 1743. Lucie mourra la première, le 22 janvier 1772 ; lui la suivra le 2 février 1788, à soixante-dix ans passés. Leur fils François, né le jour de Noël 1748, devient maçon — bâtir des murs, des toits, des fours, c'est une géographie de la pierre, du mortier, de la main. On ne voyage pas ; on construit ce qui tient debout autour de soi. Il épouse <a class="person-link" href="personne.html#jeanne-wagner">Jeanne WAGNER</a> le 17 septembre 1785 et donnera quatre enfants, dont Élisabeth (1790).`,
      `Jacques, le premier, mourra en 1811, à vingt-cinq ans à peine. François s'éteint le 16 janvier 1820 à Mondorf-les-Bains, sans jamais avoir quitté le canton. Cent ans de stabilité rare dans une Europe en mouvement perpétuel. Et puis <a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth</a>, née à Mondorf, finira ses jours le 28 décembre 1862 à Manom — en Moselle, en France. La frontière qu'elle franchit, c'est celle d'une vie entière : du Luxembourg à la France, du village thermal au village de brique mosellan. On ne sait pas exactement quand ni pourquoi. On sait seulement qu'elle est morte là-bas, et que son fils <a class="person-link" href="personne.html#paul-captien-1821">Paul</a>, né à Mondorff en 1821, portera la suite en Moselle.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Révolutions, Empire, Congrès de Vienne',
        text: `1748–1820 : Révolution française, guerres napoléoniennes, Congrès de Vienne (1815). Le Luxembourg est annexé à la France (1795–1814), puis devient grand-duché sous la maison de Nassau-Weilbourg. Les registres paroissiaux continuent — seule mémoire des familles ordinaires, quelle que soit la langue du curé.`
      },
      {
        type: 'lieu',
        title: 'Mondorf-les-Bains — frontière franco-luxembourgeoise',
        text: `Aujourd'hui station thermale réputée, Mondorf-les-Bains n'était alors qu'un village agricole du canton de Remich. Il se situe à quelques kilomètres de la frontière franco-luxembourgeoise actuelle. Le passage d'Élisabeth vers Manom (~1820–1862) marque le retour de la lignée en territoire français — Moselle, pays de Thionville — dans une région qui, après 1871, redeviendra allemande.`
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
    place: 'Manom / Mondorff — maçons en Moselle annexée',
    illustration: `<img src="illustration-manom-mondorff.png" alt="Manom, village mosellan au bord de la Moselle">`,
    narrative: [
      `Manom. Mondorff. Deux orthographes pour un même paysage — Mondorf côté luxembourgeois, Mondorff avec deux f côté français. Les CAPTIEN s'en moquent : ils vivent à la lisière, entre deux administrations, deux langues d'actes, deux curés parfois.`,
      `<a class="person-link" href="personne.html#elisabeth-captien-1790">Élisabeth CAPTIEN</a>, née le 23 janvier 1790 à Mondorf-les-Bains, meurt le 28 décembre 1862 à Manom. Entre les deux dates, toute une vie qu'on devine plus qu'on ne la connaît — le père de ses enfants reste inconnu, disparu des sources sans laisser de nom. Une fille, Barbe, morte à cinq ans en 1820. Et un fils, <a class="person-link" href="personne.html#paul-captien-1821">Paul</a>, né le 1er février 1821 à Mondorff, qui lui survivra, qui portera la suite.`,
      `<a class="person-link" href="personne.html#paul-captien-1821">Paul</a> s'installe à Manom, maçon comme son grand-père François avant lui — quatrième génération de la truelle, on bâtit ce qui résiste, pierre après pierre. Il épouse <a class="person-link" href="personne.html#marie-ligne">Marie LIGNE</a> le 21 janvier 1845. Le XIXe siècle, c'est celui des transformations : chemins de fer (Metz–Thionville, 1850), sidérurgie lorraine, mines de fer. Manom, village de brique et de grès, se rapproche de Thionville, de l'industrie, du monde ouvrier naissant.`,
      `Et puis 1871 : la guerre franco-prussienne, la défaite, l'annexion. La Moselle devient allemande — Reichsland Elsaß-Lothringen. Les noms restent français dans les foyers ; les actes officiels passent en allemand. On apprend à vivre avec deux identités administratives, comme on avait appris à vivre avec deux paroisses. Quatre enfants sur sept de Paul mourront en bas âge — Élisabeth, Jacques, Catherine, Jean. La géographie du deuil, ici, c'est le même cimetière, le même village, les mêmes tombes qui s'accumulent trop vite.`,
      `<a class="person-link" href="personne.html#nicolas-captien-1849">Nicolas</a>, né le 5 juillet 1849 à Manom, maçon lui aussi, épouse Catherine LENARD en 1879. De leur union naîtra <a class="person-link" href="personne.html#francois-captien-1885">François</a>, né en 1885, qui quittera la truelle pour les rails et les serrures. Nicolas meurt le 1er janvier 1918, jour de l'an, dans une Moselle occupée par l'Allemagne depuis quarante-sept ans, à quelques mois de l'armistice qu'il ne verra pas. Manom tient bon malgré tout : c'est l'ancrage, le lieu d'où on ne part pas — ou pas encore.`
    ],
    cards: [
      {
        type: 'histoire',
        title: '1871 et la Première Guerre mondiale',
        text: `1870–1871 : guerre franco-prussienne, annexion de l'Alsace-Moselle. 1914–1918 : Première Guerre mondiale ; la Moselle est allemande ; Verdun (1916) est à une cinquantaine de kilomètres. Nicolas CAPTIEN meurt en 1918, avant l'armistice du 11 novembre — dans un pays dont la frontière a changé de langue sans que le village ait bougé d'un pouce.`
      },
      {
        type: 'lieu',
        title: 'Manom / Mondorff — espace transfrontalier',
        text: `Manom et Mondorff/Mondorf forment un espace transfrontalier quotidien : même dialecte, mêmes marchés, familles qui se marient des deux côtés. Après 1871, la frontière politique durcit ; les déplacements restent possibles, mais les identités administratives se bifurquent. Village de brique aux confins du Luxembourg, tout près de Thionville.`
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
    place: 'Verdun, Saint-Avold — guerre et reconstruction',
    illustration: `<img src="illustration-verdun-saint-avold.png" alt="Le Fort de Vaux, Verdun, après la bataille de 1916">`,
    narrative: [
      `<a class="person-link" href="personne.html#francois-captien-1885">François CAPTIEN</a>, né le 13 juillet 1885 à Manom, dessine un triangle de vie qui dit tout de la Moselle du XXe siècle : village d'origine, front de guerre, ville de reconstruction. Serrurier, puis cheminot — les rails, encore, comme fil conducteur — il épouse Catherine HIPPERT en 1912, avant que le monde ne bascule.`,
      `1916. Verdun. Le Fort de Vaux. Il a trente et un ans. On ne sait pas exactement ce qu'il y a vécu — les archives familiales ne disent que le nom du fort — mais on sait ce que fut Verdun : dix mois de feu, plus de trois cent mille morts, une terre retournée comme un champ de betteraves. Il en revient. C'est déjà une géographie du survivant : le même Manom, mais plus jamais le même homme.`,
      `Après la guerre, la Moselle redevient française (1918–1940), puis allemande (1940–1944), puis française encore. Deux guerres mondiales en vingt-cinq ans. Six enfants de François et Catherine : <a class="person-link" href="personne.html#marthe-elise-captien-1917">Marthe Élise</a>, morte à un mois en 1917 ; <a class="person-link" href="personne.html#emilie-captien-1919">Émilie</a>, née en 1919, qui vivra quatre-vingt-dix ans ; <a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand</a>, né en 1922, qui portera la suite vers Saint-Avold.`,
      `<a class="person-link" href="personne.html#marguerite-adele-captien-1924">Marguerite Adèle</a> (1924) et sa cadette <a class="person-link" href="personne.html#adele-captien-1925">Adèle</a> (1925) meurent toutes deux en 1945, à Manom — la même année que la libération. Coïncidence ou écho tardif de l'Histoire ? On ne sait pas. On note, et on referme la page, parce qu'il y a des silences qu'on ne force pas.`,
      `François se remarie en 1932 avec <a class="person-link" href="personne.html#rose-marie-weber">Rose Marie WEBER</a>, dont naîtra <a class="person-link" href="personne.html#andree-captien-1933">Andrée</a> en 1933. Son fils François Armand, aiguilleur SNCF puis cafetier, s'installera à Saint-Avold — sous-préfecture mosellane, carrefour ferroviaire et minier, ville de passage entre Lorraine et Sarre. François père meurt le 21 mars 1969 à Manom, dans le village où il était né quatre-vingt-quatre ans plus tôt — après deux guerres, deux mariages, sept enfants et un siècle entier qui n'aura, décidément, jamais rien épargné à personne.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Verdun (1916) et les deux guerres mondiales',
        text: `Le Fort de Vaux, pris et repris entre mars et novembre 1916, symbolise l'acharnement de la bataille de Verdun. 1939–1945 : Seconde Guerre mondiale ; annexation de facto, déportations, libération 1944–1945. Reconstruction et baby-boom dans les années 1950–1960 — une Moselle qui change de langue officielle trois fois en un demi-siècle.`
      },
      {
        type: 'lieu',
        title: 'Manom · Verdun · Saint-Avold',
        text: `Le parcours de François et de son fils dessine un triangle : village d'origine (Manom), front (Verdun, ~50 km), ville de reconstruction (Saint-Avold). Cafés, gares, ateliers — une géographie de travail plus que de repos. Saint-Avold, carrefour ferroviaire et minier, deviendra le lieu où la chance retrouvée — le quinté de 1963 ou des mois qui suivent — rencontrera le comptoir.`
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
    place: 'De la Moselle à la Touraine',
    illustration: `<img src="illustration-tours.png" alt="Château de la Touraine, au bout du chemin">`,
    narrative: [
      `La dernière migration. La plus lointaine de toute la lignée — près de cinq cents kilomètres à vol d'oiseau depuis Manom ou Saint-Avold, six cents par la route — et la plus décisive : quitter la Moselle pour la Touraine, le charbon pour la Loire, les rails lorrains pour les bureaux tourangeaux. Mais entre les deux, une étape : Bar-le-Duc.`,
      `Au XXe siècle, la chronique se rapproche de nous. On entend mieux les pas, presque le souffle. <a class="person-link" href="personne.html#francois-armand-captien-1922">François Armand CAPTIEN</a>, né le 10 décembre 1922 à Manom, aiguilleur à la SNCF puis cafetier — encore les rails, décidément, ça se transmet aussi bien qu'un nom. Il épouse <a class="person-link" href="personne.html#odile-alexandrine-pierre">Odile Alexandrine PIERRE</a>, tapissière, le 22 novembre 1945 à Manom — l'année d'après la guerre, quand tout le monde refait des enfants pour compenser ceux qu'on a perdus. Le couple divorcera en 1964, après dix-neuf ans et cinq enfants. Saint-Avold, Manom, les gares — la géographie du travail SNCF et, plus tard, du café.`,
      `Car il y eut cinq enfants. <a class="person-link" href="personne.html#chantal-captien-1946">Chantal</a>, l'aînée, née le 12 avril 1946 à Amboise — déjà un pied en Touraine, pendant que le père est encore ancré en Moselle. Jean Marie, mort à neuf ans en 1962. <a class="person-link" href="personne.html#michel-captien-1955">Michel</a>, né en 1955 à Manom, fera toute sa carrière dans la restauration — cuisinier, chef de brigade, puis maître d'hôtel, debout du matin au soir dans cette hiérarchie très codifiée héritée d'Escoffier.`,
      `Un jour de 1963, ou dans les mois qui suivent, François Armand gagne au quinté — un vrai coup, de ceux qui changent une vie. Il reste alors marié, sur le papier, à Odile — le divorce n'arrivera qu'en 1964 — mais il vit déjà, dans les faits, avec <a class="person-link" href="personne.html#anne-knobloch">Anne KNOBLOCH</a>, qui a elle-même quatre enfants d'une union antérieure. Avec cet argent tombé du quinté, il ouvre à Saint-Avold la Brasserie de la Moselle, un établissement sur trois étages : bar au rez-de-chaussée, PMU au premier, bowling tout en haut. Trois étages pour boire, parier, jouer aux quilles — une géographie du loisir et de la reconstruction, loin des tranchées de Verdun. Le nom, au moins, on le connaît maintenant : la Moselle, encore et toujours, jusque dans l'enseigne.`,
      `Bar-le-Duc, Meuse. La sidérurgie. Témoignage familial : c'est là que <a class="person-link" href="personne.html#charles-marc-billeux">Charles Marc Billeux</a> et Chantal se rencontrent — une escale entre l'Est lorraine et la Touraine, à mi-chemin de la Moselle qu'elle quitte et d'Amboise où elle est née. L'acier d'abord ; le val de Loire ensuite. Chantal montera vers Tours, aide-comptable aux Établissements MEUNIER — un emploi discret, de ceux qu'on ne raconte pas dans les livres d'histoire. Mariée à Charles Marc en 1976 ; trois fils : Philippe Charles, Thierry Georges, Christophe Olivier.`,
      `<a class="person-link" href="personne.html#emilie-captien-1919">Émilie</a>, tante de Chantal, trace un autre chemin le long de la Loire : longtemps parisienne, banquière, maison de campagne à Fréteval (Loir-et-Cher), puis chalet à Vendôme — de longues années entourée de ses chiens, avant de finir ses jours à Joué-lès-Tours en 2009. La famille se disperse, lentement, le long de la Loire et de ses affluents, bien avant que Chantal n'y installe toute sa lignée.`,
      `Chantal meurt le 25 octobre 2013, à Luynes, d'une tumeur au cerveau. Ses cendres reposent au jardin du souvenir de Monts. C'est là, entre la Moselle qu'on a quittée et la Touraine qu'on a choisie, que se referme ce récit — provisoirement, comme se referment toujours les chroniques de famille, qui ne sont jamais tout à fait terminées, seulement interrompues, en attendant qu'on les reprenne.`
    ],
    cards: [
      {
        type: 'histoire',
        title: 'Trente Glorieuses et migrations internes',
        text: `1945–1975 : trente Glorieuses, baby-boom, exode rural et migrations internes. Les Mosellans partent vers l'Île-de-France, la Touraine, le Sud — suivre l'emploi, fuir les mines en déclin, recomposer une famille après la guerre. L'immédiat après-guerre, c'est aussi celui de la reconstruction des villes, des familles, des métiers.`
      },
      {
        type: 'lieu',
        title: 'Amboise · Bar-le-Duc · Tours · Monts · Luynes',
        text: `La Moselle reste l'aimant d'origine ; Bar-le-Duc (Meuse, sidérurgie) marque la rencontre de Charles Marc et Chantal ; la Touraine devient la terre d'adoption — Amboise, Tours, Monts, Luynes, axe de la Loire opposé à la Lorraine charbonnière. Géographie tourangelle — châteaux, vignes, industries légères — sans renier l'origine mosellane.`
      },
      {
        type: 'anecdote',
        title: 'Le quinté et la Brasserie de la Moselle',
        text: `En 1963, ou dans les mois qui suivent : François Armand CAPTIEN gagne un quinté, un vrai, de ceux qui changent une vie. Avec cet argent tombé du ciel, il ouvre à Saint-Avold la Brasserie de la Moselle, un établissement sur trois niveaux — bar, PMU, bowling. Le nom du fleuve mosellan jusque sur l'enseigne, comme un dernier clin d'œil au pays d'origine, à quelques dizaines de kilomètres de là.`
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
    `Il y a eu Verdun aussi, et le Fort de Vaux, et un homme qui en est revenu pour continuer, obstinément, à faire des enfants et à réparer des serrures. Il y a eu un quinté gagné en 1963, et la Brasserie de la Moselle, bar-PMU-bowling sur trois étages, à Saint-Avold. Il y a eu Anne Knobloch aussi, une vie commune avant l'heure du divorce, et ses quatre enfants à elle qu'on n'a jamais comptés parmi les nôtres, mais qu'on n'oublie pas non plus. Et il y a eu Chantal, qui a porté tout ça — sans le savoir, comme on porte les choses, sans en avoir conscience — jusqu'à Tours, jusqu'à ses propres enfants, jusqu'à ce site qu'on écrit là, maintenant, pour elle et à cause d'elle.`,
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
      ['5', '<a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas KAPGEN</a> (Captien) (≈1690–1695–?)', 'Union avec Angélique SCHNEIDER · graphie d\'époque Kapgen'],
      ['6', '<a class="person-link" href="personne.html#christian-captien-1718">Christian KAPGEN</a> (Captien) (1718–1788)', 'Mondorf-les-Bains · baptême Kapgen → Captien'],
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
