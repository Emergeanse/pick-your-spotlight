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

  // === Bambiderstroff / Mondorf — souche KAPGEN → CAPTIEN ===
  // Actes à intégrer (quand disponibles) : baptême Christian 1718 ; mariage propre Nicolas × Angélique.
  // Acte consulté : mariage Christian × Lucie THÖMES 22.06.1743 Mondorff (filiation Nicolas × Angélique confirmée indirectement).
  'nicolas-captien-1695': {
    name: 'Nicolas KAPGEN (Captien)',
    dates: 'vers 1690–1695 — décédé (date inconnue)',
    chapterId: 'bambiderstroff',
    spouses: ['angelique-schneider-1695'],
    children: ['christian-captien-1718'],
    bio: "Ancêtre direct (génération 9 au-dessus de Christian, 1718). Né vers 1690–1695 (lieu non renseigné) — la naissance de son fils Christian le 19 janvier 1718 à Mondorf implique un père d'environ 23–28 ans à cette date. Union avec Angélique SCHNEIDER (née le 29 avril 1695 à Bambiderstroff) — confirmée indirectement par l'acte de mariage de Christian le 22 juin 1743 à Mondorff, qui le nomme explicitement comme père (Nicolai Kapgen) aux côtés d'Angelicæ Schneider. Patronyme d'époque : KAPGEN — graphie confirmée sur l'acte de mariage de Christian (1743) ; Captien est la forme latine/modernisée adoptée ensuite par la descendance. Variantes à rechercher dans les archives : Kapgen, Kapgien, Kaptien, Captien, Captié… — acte de mariage propre (Nicolas × Angélique) et baptême de Christian restent à trouver. Parents de Nicolas : inconnus (non nommés sur l'acte de 1743). Décédé (date inconnue). Source : MyHeritage (filiation) ; acte paroissial Mondorff 22.06.1743 (filiation fils) ; tradition familiale (Kapgen).",
    source: 'MyHeritage · acte paroissial Mondorff 22.06.1743 · tradition familiale (Kapgen)',
    recherche: `
<h2>Fiche de recherche</h2>
<p class="recherche-objectif">Identifier et prouver Nicolas KAPGEN, époux d'Angélique SCHNEIDER, père de Christian (1718). Filiation confirmée indirectement par l'acte de mariage de Christian (22.06.1743 Mondorff) ; parents de Nicolas et mariage propre Nicolas × Angélique restent à trouver.</p>

<div class="recherche-section">
  <h3>Contexte paroissial — Mondorff</h3>
  <p>Démographie, registres paroissiaux (Matricula KB-01/KB-02), dénombrements et guerres du XVIIe — voir la <a href="index.html#mondorf-archives">fiche archives Mondorff</a> (chapitre Mondorf).</p>
</div>

<div class="recherche-section">
  <h3>Personne recherchée</h3>
  <ul class="recherche-list">
    <li><strong>Prénom :</strong> Nicolas (Nicolaus · Nickel · Nickels)</li>
    <li><strong>Patronyme prioritaire :</strong> <span class="recherche-variants">KAPGEN</span></li>
    <li><strong>Variantes :</strong> Kapgen, Kapgien, Kaptien, Captien, Captié</li>
    <li><strong>Naissance estimée :</strong> vers 1690–1695 (fourchette déduite, non actée)</li>
    <li><strong>Lieu de naissance :</strong> inconnu — Moselle nord-est (canton Boulay / Faulquemont) ou Luxembourg voisin (canton Remich)</li>
    <li><strong>Décès :</strong> date et lieu inconnus</li>
    <li><strong>Source filiation :</strong> MyHeritage · <strong>acte mariage fils 22.06.1743 Mondorff</strong> (Nicolai Kapgen nommé père) · graphie Kapgen confirmée sur cet acte</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Contexte familial</h3>
  <ul class="recherche-list">
    <li><strong>Épouse :</strong> <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique SCHNEIDER</a> — née le 29 avril 1695 à Bambiderstroff (MyHeritage, baptême à confirmer)</li>
    <li><strong>Fils :</strong> <a class="person-link" href="personne.html#christian-captien-1718">Christian KAPGEN (Captien)</a> — 19 janvier 1718, Mondorf-les-Bains (MyHeritage, baptême à confirmer)</li>
    <li><strong>Mariage Nicolas × Angélique :</strong> date et lieu inconnus — <strong>union confirmée indirectement</strong> par l'acte de mariage de Christian (22 juin 1743, Mondorff) qui nomme Nicolai Kapgen et Angelicæ Schneider comme parents du marié</li>
    <li><strong>Beaux-parents :</strong> <a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a> (1667 – † 13 déc. 1727, Bambiderstroff) × <a class="person-link" href="personne.html#marie-jungers">Marie JUNGERS</a> (m. 28 nov. 1684 — † 7 sept. 1720, Bambiderstroff)</li>
    <li><strong>Parents de Nicolas :</strong> inconnus — non nommés sur l'acte de mariage de Christian (1743)</li>
  </ul>
  <p>Bambiderstroff = dernier village mosellan de la souche SCHNEIDER ; après Angélique, la lignée KAPGEN/CAPTIEN se fixe à Mondorf.</p>
</div>

<div class="recherche-section">
  <h3>Fenêtres chronologiques</h3>
  <ul class="recherche-list">
    <li><strong>Baptême Nicolas :</strong> 1690–1697 — père de 23–28 ans au baptême de Christian (1718)</li>
    <li><strong>Mariage Nicolas × Angélique :</strong> 1705–1718 — Angélique née 1695 ; Christian né janv. 1718</li>
    <li><strong>Baptême Christian :</strong> 19 janvier 1718 (MyHeritage) — borne haute du mariage</li>
    <li><strong>Baptême Angélique :</strong> 29 avril 1695 (MyHeritage) — ancrage côté SCHNEIDER</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Registres et sources</h3>
  <ul class="recherche-list">
    <li><strong>AD57 — Bambiderstroff</strong> · cote <strong>9NUM/47ED/GG2</strong> (BMS 1657–1779) · <a href="https://archives57.com" target="_blank" rel="noopener">archives57.com</a> · archives@moselle.fr</li>
    <li><strong>Matricula — Mondorf</strong> · <strong>KB-01</strong> (BMS 1678–1737) · <strong>KB-02</strong> (Taufen 1700–1725) · <a href="https://data.matricula-online.eu/fr/LU/luxemburg/mondorf/" target="_blank" rel="noopener">data.matricula-online.eu</a> · archives.diocesaines@cathol.lu</li>
    <li><strong>FamilySearch</strong> · <a href="https://www.familysearch.org/en/search/collection/5000012" target="_blank" rel="noopener">Luxembourg, Church and Civil Registration, 1601–1923</a></li>
    <li><strong>Paroisses voisines (baptême Nicolas) :</strong> Bambiderstroff, Mondorf, Bidestroff, Bistroff, Freistroff, Boulay, Faulquemont, Teting-sur-Nied, Folschweiler, Dalheim (LU), Remich (LU), Altwies (LU)</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Actes prioritaires</h3>
  <div class="recherche-act recherche-act--found">
    <span class="recherche-status">Confirmé (indirect)</span><strong>Filiation Nicolas × Angélique — père de Christian</strong>
    <span>22 juin 1743 · Mondorff · acte mariage fils consulté — Nicolai Kapgen et Angelicæ Schneider nommés parents du marié ; graphie Kapgen confirmée. <strong>L'acte ne nomme pas les parents de Nicolas lui-même.</strong></span>
  </div>
  <div class="recherche-act recherche-act--p0">
    <span class="recherche-priority">P0</span><strong>Baptême Christian KAPGEN</strong>
    <span>19 janv. 1718 · Mondorf · Matricula KB-01 — nom exact du père, filiation, graphie Kapgen</span>
  </div>
  <div class="recherche-act recherche-act--p0">
    <span class="recherche-priority">P0</span><strong>Mariage Nicolas KAPGEN × Angélique SCHNEIDER</strong>
    <span>1705–1717 (estimé) · Bambiderstroff 9NUM/47ED/GG2 ou Mondorf KB-01 (Heiraten 1717–1735) — acte propre à trouver (union confirmée indirectement par acte fils 1743)</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Baptême Angélique SCHNEIDER</strong>
    <span>29 avr. 1695 · Bambiderstroff 9NUM/47ED/GG2 — confirmer filiation Jean × Marie</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Mariage Jean SCHNEIDER × Marie JUNGERS</strong>
    <span>28 nov. 1684 · Bambiderstroff 9NUM/47ED/GG2 — confirmer lignée maternelle</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Baptême Nicolas KAPGEN</strong>
    <span>1690–1697 · paroisses Moselle nord-est et Luxembourg voisin — parents, lieu d'origine</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P2</span><strong>Sépultures</strong>
    <span>Nicolas (date ?) · Marie JUNGERS (7 sept. 1720) · Jean SCHNEIDER (13 déc. 1727) — contexte familial</span>
  </div>
</div>

<div class="recherche-section">
  <h3>Critères d'identification</h3>
  <p>Un acte correspond au bon Nicolas si <strong>au moins 3</strong> critères concordent : patronyme Kapgen (confirmé sur acte fils 1743) · épouse Angélique SCHNEIDER (confirmée sur acte fils 1743) · fils Christian baptisé janvier 1718 à Mondorf · chronologie cohérente (né ≈1690–1695, marié ≈1708–1717, père en 1718) · géographie Moselle nord-est ou Mondorf/Remich.</p>
</div>

<div class="recherche-section">
  <h3>Inconnus</h3>
  <ul class="recherche-list recherche-unknown">
    <li>Lieu et date exacts de naissance/baptême de Nicolas</li>
    <li>Date et lieu du mariage propre Nicolas × Angélique (union confirmée indirectement par l'acte de 1743)</li>
    <li>Parents, métier et domicile de Nicolas avant mariage</li>
    <li>Date et lieu de décès de Nicolas et d'Angélique</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Ordre de travail recommandé</h3>
  <ol class="recherche-list">
    <li>Matricula Mondorf KB-01 → baptême Christian 19.01.1718</li>
    <li>Même registre KB-01 → mariages 1717–1735 (+ KB-02 si besoin) — mariage propre Nicolas × Angélique</li>
    <li>AD57 Bambiderstroff 9NUM/47ED/GG2 → baptême Angélique 29.04.1695 + mariages 1705–1717</li>
    <li>Balayage paroissial → baptême Nicolas 1690–1697 (parents)</li>
    <li>✓ Recoupement filiation Christian — acte mariage 22.06.1743 Mondorff consulté (Nicolai Kapgen × Angelicæ Schneider confirmés comme parents)</li>
  </ol>
</div>

<div class="recherche-section">
  <h3>Modèles email</h3>
  <details class="recherche-email">
    <summary>AD57 — Bambiderstroff (9NUM/47ED/GG2)</summary>
    <pre>Objet : Recherche actes paroissiaux — Bambiderstroff (9NUM/47ED/GG2) — KAPGEN/SCHNEIDER ~1695–1720

Madame, Monsieur,

Je recherche les actes paroissiaux suivants dans les registres de Bambiderstroff
(cote 9NUM/47ED/GG2, baptêmes/mariages/sépultures 1657–1779) :

1. Baptême d'Angélique SCHNEIDER, 29 avril 1695 — fille de Jean SCHNEIDER
   (ou Jean Haman/Hans) et Marie JUNGERS
2. Mariage de Nicolas KAPGEN (variantes : Kapgen, Kaptien, Captien)
   et Angélique SCHNEIDER — période estimée 1705–1717
3. Mariage de Jean SCHNEIDER et Marie JUNGERS, 28 novembre 1684 (contrôle)

Pourriez-vous m'indiquer si ces actes sont consultables en ligne sur archives57.com
ou m'adresser des copies/extraits le cas échéant ?

Je vous remercie par avance.
[Votre nom — adresse]</pre>
  </details>
  <details class="recherche-email">
    <summary>Diözesanarchiv Luxembourg — Mondorf KB-01</summary>
    <pre>Objet : Extrait registre paroissial Mondorf KB-01 — baptême 19.01.1718 KAPGEN

Madame, Monsieur,

Je recherche dans les registres paroissiaux de Mondorf (Matricula KB-01, 1678–1737) :

1. Baptême de Christian KAPGEN (ou Kapgen/Kaptien), 19 janvier 1718 —
   fils de Nicolas KAPGEN et Angélique SCHNEIDER
2. Mariage de Nicolas KAPGEN et Angélique SCHNEIDER, période 1705–1717
   (registre KB-01, section Heiraten 1717–1735)

Les registres sont-ils intégralement en ligne sur Matricula,
ou puis-je commander un extrait certifié via votre formulaire de reproduction ?

Cordialement,
[Votre nom — adresse]</pre>
  </details>
</div>
`
  },
  'angelique-schneider-1695': {
    name: 'Angélique SCHNEIDER (CAPTIEN)',
    dates: '29 avril 1695, Bambiderstroff (Moselle) — (date de décès inconnue)',
    chapterId: 'bambiderstroff',
    parents: ['jean-schneider-1667', 'marie-jungers'],
    spouses: ['nicolas-captien-1695'],
    children: ['christian-captien-1718'],
    bio: "Ancêtre directe. Née le 29 avril 1695 à Bambiderstroff (Moselle). Fille de Jean (Haman) SCHNEIDER (1667–1727), laboureur à Bambiderstroff, et de Marie JUNGERS († 1720). Union avec Nicolas KAPGEN (Captien) (vers 1690–1695) — confirmée indirectement par l'acte de mariage de leur fils Christian le 22 juin 1743 à Mondorff, qui la nomme explicitement comme mère (Angelicæ Schneider). Sur l'acte, le patronyme du marié est Kapgen. Mère de Christian (1718). Source : MyHeritage ; acte paroissial Mondorff 22.06.1743.",
    source: 'MyHeritage · acte paroissial Mondorff 22.06.1743',
  },
  'georges-schneider-1583': {
    name: 'Georges SCHNEIDER',
    dates: 'né avant 1583 — décès (date inconnue)',
    chapterId: 'laudrefang',
    spouses: ['christine-nn-schneider'],
    children: ['valentin-schneider-1603', 'quirin-virich-schneider-1615'],
    bio: "Ancêtre direct (génération 12 au-dessus de Valentin SCHNEIDER, vers 1603). Né avant 1583. Marié vers 1600 à Christine (nom de jeune fille inconnu). Père de Valentin SCHNEIDER (vers 1603, Laudrefang) et de Quirin Virich SCHNEIDER (vers 1615). Source : MyHeritage.",
    source: 'MyHeritage',
    recherche: `
<h2>Fiche de recherche</h2>
<p class="recherche-objectif">Documenter Georges SCHNEIDER et Christine (NN) par actes paroissiaux à Laudrefang ; remonter au-delà de Georges si les registres le permettent.</p>

<div class="recherche-section">
  <h3>Personne recherchée</h3>
  <ul class="recherche-list">
    <li><strong>Prénom :</strong> Georges (Georg · Jörg · Jürgen)</li>
    <li><strong>Patronyme prioritaire :</strong> <span class="recherche-variants">SCHNEIDER</span></li>
    <li><strong>Variantes :</strong> Schneider, Schneyder, Schneiders, Schneiter</li>
    <li><strong>Naissance estimée :</strong> avant 1583 (fourchette déduite, non actée)</li>
    <li><strong>Lieu de naissance :</strong> inconnu — pays de Nied, canton Bouzonville / Faulquemont (Moselle)</li>
    <li><strong>Mariage :</strong> vers 1600 avec <a class="person-link" href="personne.html#christine-nn-schneider">Christine (NN)</a> — date et lieu à confirmer</li>
    <li><strong>Décès :</strong> date et lieu inconnus</li>
    <li><strong>Source filiation :</strong> MyHeritage (à confirmer)</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Contexte familial</h3>
  <ul class="recherche-list">
    <li><strong>Épouse :</strong> <a class="person-link" href="personne.html#christine-nn-schneider">Christine (NN) SCHNEIDER</a> — nom de jeune fille inconnu (MyHeritage, mariage vers 1600 à confirmer)</li>
    <li><strong>Fils :</strong> <a class="person-link" href="personne.html#valentin-schneider-1603">Valentin SCHNEIDER</a> — vers 1603, Laudrefang (MyHeritage, baptême à confirmer) · † 27 août 1693, Laudrefang (MyHeritage, sépulture à confirmer)</li>
    <li><strong>Fils :</strong> <a class="person-link" href="personne.html#quirin-virich-schneider-1615">Quirin Virich SCHNEIDER</a> — vers 1615 (MyHeritage, baptême à confirmer)</li>
    <li><strong>Petit-fils (lignée directe) :</strong> <a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a> — 1667 – † 13 déc. 1727, Bambiderstroff (MyHeritage, actes à confirmer)</li>
    <li><strong>Arrière-petite-fille (lignée directe) :</strong> <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique SCHNEIDER</a> — 29 avril 1695, Bambiderstroff (MyHeritage, baptême à confirmer)</li>
    <li><strong>Parents de Georges :</strong> inconnus</li>
  </ul>
  <p>Laudrefang = village d'origine de la souche SCHNEIDER ; la lignée se déplace vers Bambiderstroff avec Jean (Haman), puis vers Mondorf via Angélique × Nicolas KAPGEN.</p>
</div>

<div class="recherche-section">
  <h3>Fenêtres chronologiques</h3>
  <ul class="recherche-list">
    <li><strong>Baptême Georges :</strong> avant 1583 — père d'environ 20–25 ans à la naissance de Valentin (≈1603)</li>
    <li><strong>Mariage Georges × Christine :</strong> 1595–1605 — Valentin ≈1603, Quirin Virich ≈1615</li>
    <li><strong>Baptême Valentin :</strong> 1600–1608 (MyHeritage : vers 1603) — ancrage principal de la filiation</li>
    <li><strong>Baptême Quirin Virich :</strong> 1610–1620 (MyHeritage : vers 1615) — contrôle fratrie</li>
    <li><strong>Baptême Jean (Haman) :</strong> ≈1667 — filiation Valentin × conjointe inconnue (MyHeritage)</li>
    <li><strong>Sépulture Valentin :</strong> 27 août 1693 (MyHeritage) — contexte familial tardif</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Registres et sources</h3>
  <ul class="recherche-list">
    <li><strong>AD57 — Laudrefang</strong> · registres paroissiaux (cote à identifier sur <a href="https://archives57.com" target="_blank" rel="noopener">archives57.com</a>) · archives@moselle.fr · Laudrefang relevait peut-être de la paroisse mère de <strong>Tritteling</strong> — vérifier les deux communes</li>
    <li><strong>AD57 — Bambiderstroff</strong> · cote <strong>9NUM/47ED/GG2</strong> (BMS 1657–1779) — pour la descendance Jean / Angélique</li>
    <li><strong>Catalogue microfilms AD57</strong> · 4oG1124/1 (registres paroissiaux antérieurs à 1792, Moselle) — disponible en salle de lecture Saint-Julien-lès-Metz</li>
    <li><strong>FamilySearch</strong> · <a href="https://www.familysearch.org/en/search/catalog/results?place=Laudrefang" target="_blank" rel="noopener">Catalogue — Laudrefang (Moselle)</a> · microfilms paroissiaux Moselle / Lorraine</li>
    <li><strong>Paroisses voisines (baptême Georges, parents) :</strong> Laudrefang, Tritteling, Bouzonville, Faulquemont, Creutzwald, Stiring-Wendel, Morsbach, Gros-Réderching, Diffembach-lès-Hellimer, Bambiderstroff</li>
  </ul>
  <p>Laudrefang était en duché de Lorraine (annexion française 1766) : les registres antérieurs au XVIIe peuvent être lacunaires, en latin ou en allemand, et parfois centralisés au niveau paroissial (Tritteling).</p>
</div>

<div class="recherche-section">
  <h3>Actes prioritaires</h3>
  <div class="recherche-act recherche-act--p0">
    <span class="recherche-priority">P0</span><strong>Baptême Valentin SCHNEIDER</strong>
    <span>≈1603 · Laudrefang (ou Tritteling) — filiation Georges × Christine, graphie patronyme</span>
  </div>
  <div class="recherche-act recherche-act--p0">
    <span class="recherche-priority">P0</span><strong>Mariage Georges SCHNEIDER × Christine (NN)</strong>
    <span>1595–1605 (estimé) · Laudrefang / Tritteling — parents des époux, domicile, témoins</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Baptême Quirin Virich SCHNEIDER</strong>
    <span>≈1615 · Laudrefang — confirmer même filiation Georges × Christine</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Baptême Jean (Haman) SCHNEIDER</strong>
    <span>≈1667 · Laudrefang ou Bambiderstroff — filiation Valentin × conjointe inconnue</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Sépulture Valentin SCHNEIDER</strong>
    <span>27 août 1693 · Laudrefang — âge, veuvage, héritiers éventuels</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P2</span><strong>Baptême Georges SCHNEIDER</strong>
    <span>avant 1583 · paroisses du pays de Nied — parents, remontée au-delà de Georges</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P2</span><strong>Sépultures Georges / Christine</strong>
    <span>dates inconnues · Laudrefang — contexte familial</span>
  </div>
</div>

<div class="recherche-section">
  <h3>Critères d'identification</h3>
  <p>Un acte correspond au bon Georges si <strong>au moins 3</strong> critères concordent : patronyme Schneider (ou variante) · épouse Christine · fils Valentin (≈1603, Laudrefang) et/ou Quirin Virich (≈1615) · chronologie cohérente (né avant 1583, marié ≈1600, père de Valentin ≈1603) · géographie pays de Nied / canton Bouzonville.</p>
</div>

<div class="recherche-section">
  <h3>Inconnus</h3>
  <ul class="recherche-list recherche-unknown">
    <li>Date et lieu exacts de naissance/baptême de Georges</li>
    <li>Date et lieu du mariage Georges × Christine ; nom de jeune fille de Christine</li>
    <li>Parents, métier et domicile de Georges et Christine</li>
    <li>Date et lieu de décès de Georges et Christine</li>
    <li>Identité de la conjointe de Valentin (placeholder « Xx SCHNEIDER »)</li>
    <li>Filiation Valentin → Jean (Haman) — entièrement MyHeritage, non vérifiée sur acte</li>
    <li>Cote exacte des registres paroissiaux Laudrefang aux AD57</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Ordre de travail recommandé</h3>
  <ol class="recherche-list">
    <li>archives57.com → repérer cote Laudrefang et/ou Tritteling (BMS XVIe–XVIIe)</li>
    <li>Baptême Valentin ≈1603 → filiation Georges × Christine (P0)</li>
    <li>Mariage Georges × Christine 1595–1605 (P0)</li>
    <li>Baptême Quirin Virich ≈1615 → contrôle fratrie (P1)</li>
    <li>Baptême Jean (Haman) ≈1667 + sépulture Valentin 27.08.1693 (P1)</li>
    <li>AD57 Bambiderstroff 9NUM/47ED/GG2 → descendance Jean / Angélique (recoupement)</li>
    <li>Balayage paroissial → baptême Georges avant 1583, parents (P2)</li>
  </ol>
</div>

<div class="recherche-section">
  <h3>Modèles email</h3>
  <details class="recherche-email">
    <summary>AD57 — Laudrefang / Tritteling (registres paroissiaux)</summary>
    <pre>Objet : Recherche actes paroissiaux — Laudrefang / Tritteling — SCHNEIDER ~1580–1620

Madame, Monsieur,

Je recherche les actes paroissiaux suivants pour la commune de Laudrefang
(57385, canton de Bouzonville), ou le cas échéant la paroisse mère de Tritteling,
pour la période fin XVIe — début XVIIe siècle :

1. Baptême de Valentin SCHNEIDER (variantes : Schneyder, Schneiders),
   vers 1603 — fils de Georges SCHNEIDER et Christine
2. Mariage de Georges SCHNEIDER et Christine — période estimée 1595–1605
3. Baptême de Quirin Virich SCHNEIDER, vers 1615 — fils des mêmes parents
4. Baptême de Georges SCHNEIDER, avant 1583 — remontée généalogique

Pourriez-vous m'indiquer la cote des registres concernés (Laudrefang ou Tritteling),
s'ils sont consultables en ligne sur archives57.com, ou m'adresser des copies/extraits ?

Je vous remercie par avance.
[Votre nom — adresse]</pre>
  </details>
  <details class="recherche-email">
    <summary>AD57 — Bambiderstroff (9NUM/47ED/GG2) — descendance</summary>
    <pre>Objet : Recherche actes paroissiaux — Bambiderstroff (9NUM/47ED/GG2) — SCHNEIDER ~1667–1695

Madame, Monsieur,

Je recherche dans les registres de Bambiderstroff (cote 9NUM/47ED/GG2,
baptêmes/mariages/sépultures 1657–1779) les actes suivants pour recouper
la descendance de la souche SCHNEIDER de Laudrefang :

1. Baptême de Jean SCHNEIDER (ou Jean Haman/Hans), vers 1667 —
   fils de Valentin SCHNEIDER
2. Mariage de Jean SCHNEIDER et Marie JUNGERS, 28 novembre 1684 (contrôle)
3. Baptême d'Angélique SCHNEIDER, 29 avril 1695 — fille de Jean et Marie JUNGERS

Les actes sont-ils intégralement consultables en ligne sur archives57.com ?

Cordialement,
[Votre nom — adresse]</pre>
  </details>
</div>
`
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
    name: 'Christian KAPGEN (Captien)',
    dates: '19 janvier 1718, Mondorf-les-Bains (Luxembourg) — 2 février 1788, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    parents: ['nicolas-captien-1695', 'angelique-schneider-1695'],
    spouses: ['lucie-thomas'],
    children: ['francois-captien-1748'],
    bio: "Ancêtre direct (génération 8 au-dessus de François CAPTIEN, 1748). Né le 19 janvier 1718 à Mondorf-les-Bains (Luxembourg) — graphie Kapgen confirmée sur l'acte de mariage du 22 juin 1743 ; la lignée stabilise ensuite Captien. Filiation confirmée par le même acte : fils légitime de Nicolai Kapgen et d'Angelicæ Schneider, de Mondorff. Décédé le 2 février 1788 à Mondorf-les-Bains (Luxembourg). Marié le 22 juin 1743 à Mondorff à Lucie THÖMES (acte paroissial consulté). Source : MyHeritage ; acte paroissial Mondorff 22.06.1743.",
    source: 'MyHeritage · acte paroissial Mondorff 22.06.1743',
    recherche: `
<h2>Fiche de recherche</h2>
<p class="recherche-objectif">Confirmer le baptême du 19 janvier 1718 à Mondorf ; filiation Nicolas × Angélique confirmée par l'acte de mariage de 1743 ; graphie Kapgen ancrée sur cet acte.</p>

<div class="recherche-section">
  <h3>Contexte paroissial — Mondorff</h3>
  <p>Population (~1700–1720), paroisse unifiée, registres Matricula, dénombrements et reprise démographique après les guerres du XVIIe — voir la <a href="index.html#mondorf-archives">fiche archives Mondorff</a> (chapitre Mondorf).</p>
</div>

<div class="recherche-section">
  <h3>Personne recherchée</h3>
  <ul class="recherche-list">
    <li><strong>Prénom :</strong> Christian (Christianus · Christophorus · Christoffel)</li>
    <li><strong>Patronyme prioritaire :</strong> <span class="recherche-variants">KAPGEN</span> — confirmé sur l'acte de mariage 1743</li>
    <li><strong>Variantes :</strong> Kapgen, Kapgien, Kaptien, Captien, Captié</li>
    <li><strong>Naissance / baptême :</strong> 19 janvier 1718, Mondorf-les-Bains (MyHeritage, à confirmer)</li>
    <li><strong>Décès :</strong> 2 février 1788, Mondorf-les-Bains (MyHeritage, sépulture à confirmer)</li>
    <li><strong>Source filiation :</strong> <strong>acte mariage 22.06.1743 Mondorff</strong> (Nicolai Kapgen × Angelicæ Schneider) · MyHeritage</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Contexte familial</h3>
  <ul class="recherche-list">
    <li><strong>Père :</strong> <a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas KAPGEN (Captien)</a> — confirmé sur l'acte de mariage 1743 (Nicolai Kapgen, de Mondorff)</li>
    <li><strong>Mère :</strong> <a class="person-link" href="personne.html#angelique-schneider-1695">Angélique SCHNEIDER</a> — confirmée sur l'acte de mariage 1743 (Angelicæ Schneider) · née le 29 avril 1695 à Bambiderstroff (MyHeritage, baptême à confirmer)</li>
    <li><strong>Épouse :</strong> <a class="person-link" href="personne.html#lucie-thomas">Lucie THÖMES</a> — mariage le 22 juin 1743 à Mondorff (<strong>acte consulté</strong>) · † 22 janvier 1772, Mondorf-les-Bains (MyHeritage, à confirmer)</li>
    <li><strong>Fils :</strong> <a class="person-link" href="personne.html#francois-captien-1748">François CAPTIEN</a> — 25 décembre 1748, Mondorf-les-Bains (MyHeritage, baptême à confirmer)</li>
    <li><strong>Beaux-parents (côté SCHNEIDER) :</strong> <a class="person-link" href="personne.html#jean-schneider-1667">Jean (Haman) SCHNEIDER</a> × <a class="person-link" href="personne.html#marie-jungers">Marie JUNGERS</a></li>
    <li><strong>Beaux-parents (côté THÖMES) :</strong> <a class="person-link" href="personne.html#henric-adam-thomes">Henric Adam THÖMES</a> († avant 1743) × <a class="person-link" href="personne.html#eva-klein">Eva KLEIN</a> († avant 1743) — de Dondorfferhoff</li>
  </ul>
  <p>Mondorff = lieu d'ancrage de la lignée KAPGEN/CAPTIEN ; l'acte de mariage de 1743 est le premier acte paroissial consulté pour cette branche.</p>
</div>

<div class="recherche-section">
  <h3>Acte consulté — mariage 22 juin 1743</h3>
  <img class="recherche-acte-img" src="acte-mariage-christian-kapgen-1743.png" alt="Acte paroissial — mariage Christianus Kapgen × Lucia Thömes, 22 juin 1743, Mondorff">
  <details class="recherche-email">
    <summary>Transcription (latin du registre)</summary>
    <pre>vigesima secunda Junii 1743 post sacrum servatis servandis matrimonium inierunt
christianus Kapgen, filius legitimus Nicolai Kapgen et angelicæ schneider,
ex mondorff, et lucia thomes, filia legitima henrici adami thomes et evæ klein,
conjugum defunctorum, ex dondorfferhoff.

Sponsus et sponsa subsignaverunt scribendi ignari.
Testes fuerunt peter thomes ex ellingen et franciscus bricher ex dondorfferhoff
— scribendi ignari.

Signa : Christiani Kapgen Sponsi · Luciæ Thomes Sponsæ · Petri Thomes Testis ·
Francisci Bricher Testis.

Officiant : Ph: Simon pastor in mondorff.</pre>
  </details>
</div>

<div class="recherche-section">
  <h3>Fenêtres chronologiques</h3>
  <ul class="recherche-list">
    <li><strong>Baptême Christian :</strong> 19 janvier 1718 (MyHeritage) — acte P0</li>
    <li><strong>Mariage Christian × Lucie :</strong> 22 juin 1743 — <strong>confirmé</strong> (acte consulté) · Christian âgé de 25 ans</li>
    <li><strong>Baptême François :</strong> 25 décembre 1748 (MyHeritage) — contrôle filiation</li>
    <li><strong>Sépulture Lucie :</strong> 22 janvier 1772 (MyHeritage) — contexte conjugal</li>
    <li><strong>Sépulture Christian :</strong> 2 février 1788 (MyHeritage) — âge ≈ 70 ans</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Registres et sources</h3>
  <ul class="recherche-list">
    <li><strong>Matricula — Mondorf</strong> · <strong>KB-01</strong> (BMS 1678–1737) · <strong>KB-02</strong> (Taufen 1700–1725) · <a href="https://data.matricula-online.eu/fr/LU/luxemburg/mondorf/" target="_blank" rel="noopener">data.matricula-online.eu</a> · archives.diocesaines@cathol.lu</li>
    <li><strong>FamilySearch</strong> · <a href="https://www.familysearch.org/en/search/collection/5000012" target="_blank" rel="noopener">Luxembourg, Church and Civil Registration, 1601–1923</a></li>
    <li><strong>luxroots</strong> · <a href="https://www.luxroots.org" target="_blank" rel="noopener">luxroots.org</a> — transcriptions paroissiales et civiles Luxembourg (baptêmes avant 1800, mariages, décès)</li>
    <li><strong>Paroisses voisines (contrôle) :</strong> Remich, Altwies, Dalheim, Bous, Schengen — en cas d'absence à Mondorf</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Actes prioritaires</h3>
  <div class="recherche-act recherche-act--found">
    <span class="recherche-status">Confirmé</span><strong>Mariage Christian KAPGEN × Lucie THÖMES</strong>
    <span>22 juin 1743 · Mondorff · acte paroissial consulté — filiation Nicolas × Angélique, graphie Kapgen, parents de Lucie, témoins</span>
  </div>
  <div class="recherche-act recherche-act--p0">
    <span class="recherche-priority">P0</span><strong>Baptême Christian KAPGEN</strong>
    <span>19 janv. 1718 · Mondorf · Matricula KB-01 / KB-02 — filiation Nicolas × Angélique, graphie Kapgen sur l'acte</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Sépulture Christian KAPGEN</strong>
    <span>2 févr. 1788 · Mondorf — âge, veuf (Lucie † 1772), mention des enfants</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P1</span><strong>Baptême François CAPTIEN (KAPGEN ?)</strong>
    <span>25 déc. 1748 · Mondorf — fils de Christian et Lucie THÖMES, graphie patronyme</span>
  </div>
  <div class="recherche-act">
    <span class="recherche-priority">P2</span><strong>Sépulture Lucie THÖMES</strong>
    <span>22 janv. 1772 · Mondorf — épouse de Christian, contexte familial</span>
  </div>
</div>

<div class="recherche-section">
  <h3>Critères d'identification</h3>
  <p>Un acte correspond au bon Christian si <strong>au moins 3</strong> critères concordent : patronyme Kapgen (confirmé 1743) · parents Nicolas KAPGEN et Angélique SCHNEIDER (confirmés 1743) · date 19 janvier 1718 · lieu Mondorf-les-Bains · mariage 1743 avec Lucie THÖMES (confirmé) · fils François baptisé 1748 · chronologie cohérente (né 1718, marié 1743, décédé 1788).</p>
</div>

<div class="recherche-section">
  <h3>Inconnus</h3>
  <ul class="recherche-list recherche-unknown">
    <li>Baptême du 19 janvier 1718 (filiation déjà confirmée par le mariage 1743)</li>
    <li>Métier et domicile de Christian</li>
    <li>Autres enfants éventuels (seul François est renseigné dans la base)</li>
    <li>Cote Matricula exacte pour sépultures 1772 / 1788</li>
    <li>Date et lieu du mariage propre Nicolas × Angélique (union confirmée indirectement)</li>
    <li>Parents de Nicolas (non nommés sur l'acte de 1743)</li>
  </ul>
</div>

<div class="recherche-section">
  <h3>Ordre de travail recommandé</h3>
  <ol class="recherche-list">
    <li>✓ Acte mariage Christian × Lucie THÖMES 22.06.1743 Mondorff — consulté</li>
    <li>Matricula Mondorf KB-01 / KB-02 → baptême Christian 19.01.1718</li>
    <li>luxroots + FamilySearch → même baptême (transcription / image)</li>
    <li>Même source → baptême François 25.12.1748 (contrôle filiation)</li>
    <li>Matricula Mondorf → sépultures Lucie 22.01.1772 et Christian 02.02.1788</li>
    <li>Recoupement avec fiche <a class="person-link" href="personne.html#nicolas-captien-1695">Nicolas KAPGEN</a> (mariage propre Nicolas × Angélique, parents de Nicolas)</li>
  </ol>
</div>

<div class="recherche-section">
  <h3>Modèles email</h3>
  <details class="recherche-email">
    <summary>Diözesanarchiv Luxembourg — Mondorf (baptême, sépulture)</summary>
    <pre>Objet : Extrait registres paroissiaux Mondorf — KAPGEN/THÖMES 1718–1788

Madame, Monsieur,

Je recherche dans les registres paroissiaux de Mondorf-les-Bains :

1. Baptême de Christian KAPGEN (variantes : Kapgen, Kaptien, Captien),
   19 janvier 1718 — fils de Nicolas KAPGEN et Angélique SCHNEIDER
   (registres Matricula KB-01 / KB-02)
   — la filiation est déjà confirmée par le mariage du 22 juin 1743

2. Baptême de François, fils de Christian KAPGEN et Lucie THÖMES,
   25 décembre 1748

3. Sépulture de Lucie THÖMES, épouse de Christian KAPGEN, 22 janvier 1772

4. Sépulture de Christian KAPGEN, 2 février 1788

Les registres sont-ils intégralement consultables sur Matricula,
ou puis-je commander des extraits certifiés via votre formulaire de reproduction ?

Cordialement,
[Votre nom — adresse]</pre>
  </details>
</div>
`
  },
  'henric-adam-thomes': {
    name: 'Henric Adam THÖMES',
    dates: 'décédé avant le 22 juin 1743 — ex Dondorfferhoff',
    chapterId: 'mondorf',
    spouses: ['eva-klein'],
    children: ['lucie-thomas'],
    bio: "Père de Lucie THÖMES (CAPTIEN). Nommé sur l'acte de mariage de sa fille le 22 juin 1743 à Mondorff (Henrici Adami Thömes) ; décédé avant cette date (conjugum defunctorum). Originaire de Dondorfferhoff. Source : acte paroissial Mondorff 22.06.1743.",
    source: 'acte paroissial Mondorff 22.06.1743'
  },
  'eva-klein': {
    name: 'Eva KLEIN (THÖMES)',
    dates: 'décédée avant le 22 juin 1743 — ex Dondorfferhoff',
    chapterId: 'mondorf',
    spouses: ['henric-adam-thomes'],
    children: ['lucie-thomas'],
    bio: "Mère de Lucie THÖMES (CAPTIEN). Nommée Evæ Klein sur l'acte de mariage de sa fille le 22 juin 1743 à Mondorff ; décédée avant cette date (conjugum defunctorum). Originaire de Dondorfferhoff. Source : acte paroissial Mondorff 22.06.1743.",
    source: 'acte paroissial Mondorff 22.06.1743'
  },
  'lucie-thomas': {
    name: 'Lucie THÖMES (CAPTIEN)',
    dates: 'originaire de Dondorfferhoff — mariage le 22 juin 1743, Mondorff (Luxembourg) — décédée le 22 janvier 1772, Mondorf-les-Bains (Luxembourg)',
    chapterId: 'mondorf',
    parents: ['henric-adam-thomes', 'eva-klein'],
    spouses: ['christian-captien-1718'],
    children: ['francois-captien-1748'],
    bio: "Épouse de Christian KAPGEN (Captien) (1718–1788). Fille légitime des défunts Henric Adam THÖMES et Eva Klein, de Dondorfferhoff — confirmé par l'acte de mariage du 22 juin 1743 à Mondorff. Témoins : Peter Thomes d'Ellingen et Franciscus Bricher de Dondorfferhoff (illettrés, signent par marque). Décédée le 22 janvier 1772 à Mondorf-les-Bains (Luxembourg). Source : MyHeritage ; acte paroissial Mondorff 22.06.1743.",
    source: 'MyHeritage · acte paroissial Mondorff 22.06.1743'
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
    bio: "Grand-père maternel. Aiguilleur à la SNCF puis cafetier. Marié à Odile Alexandrine Pierre le 22 novembre 1945 à Manom ; divorce le 20 octobre 1964. Reste légalement marié à Odile jusqu'à cette date, tout en vivant déjà avec Anne Knobloch à Saint-Avold — séparation de fait avant le divorce officiel. Les cinq enfants (Chantal, Jean Marie, Michel, Jean Claude, Dominique) sont tous nés du mariage avec Odile. Source : MyHeritage · souvenir familial.",
    source: 'MyHeritage'
  },

  // === Branche collatérale : sœur de François Armand ===
  'emilie-captien-1919': {
    name: 'Émilie CAPTIEN (PARMENTIER)',
    dates: '1 janvier 1919, Manom (Moselle) — 28 octobre 2009, Joué-lès-Tours (Indre-et-Loire) (90 ans) — inhumée à Esvres',
    chapterId: 'captien',
    parents: ['francois-captien-1885', 'catherine-hippert'],
    spouses: ['jean-leon-parmentier'],
    bio: "Grand-tante maternelle. Née le 1er janvier 1919 à Manom (Moselle). Mariée à Jean Léon PARMENTIER le 23 février 1946 à Manom — lui décédé le 30 octobre 1971 à Rambouillet (Yvelines). Longtemps parisienne, banquière de profession ; maison de campagne à Fréteval (Loir-et-Cher, vallée du Loir), puis de longues années dans un chalet à Vendôme (Loir-et-Cher), entourée de ses chiens. Le dimanche midi, de temps en temps, elle cuisinait le rosbif. Décédée le 28 octobre 2009 à Joué-lès-Tours ; inhumée à Esvres. Sources : MyHeritage ; témoignage familial (mode de vie, à compléter).",
    source: 'MyHeritage ; témoignage familial'
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
    dates: 'Saint-Avold (Moselle)',
    chapterId: 'captien',
    spouses: ['francois-armand-captien-1922'],
    bio: "Compagne de François Armand Captien à Saint-Avold, avant même le divorce officiel de celui-ci d'avec Odile Alexandrine Pierre en 1964 — d'où la mention « mariage » relevée dans la source, qui décrit en réalité une vie commune plutôt qu'une union légale distincte. Anne avait elle-même quatre enfants (d'une union antérieure, non documentée ici). Source : MyHeritage · souvenir familial.",
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
    bio: "Fille de François Armand Captien et d’Odile Alexandrine Pierre. Née à Amboise — un premier pied en Touraine, qu'elle retrouvera plus tard. Aide comptable à Tours (Établissements MEUNIER). Rencontre Charles Marc Billeux à Bar-le-Duc (Meuse), dans la sidérurgie — témoignage familial — avant l'installation du couple en Touraine (Monts, Luynes…), peut-être parce qu'Amboise n'était qu'à quelques kilomètres de là. Mariée en premières noces à Claude Louis Pinazo (1963), puis à Charles Marc Billeux (1976). Crémation le 30 octobre 2013 ; cendres au Jardin du souvenir de Monts. Sources : MyHeritage ; témoignage familial.",
    source: 'MyHeritage ; témoignage familial'
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
    bio: "Frère de Chantal Captien. Cuisinier de métier — chef de brigade, puis maître d'hôtel (intitulé exact des postes à confirmer) — toute une carrière faite en cuisine et en salle, dans la tradition des grandes maisons. Mariage (1) avec Patricia Arivé le 14 juin 1975 à Tours ; divorce le 10 mai 1981. Mariage (2) avec Evelyne Courtin le 31 mars 2018 à Gohory. Témoignage de Michel sur ses débuts : « Non, pas tout de suite : d'abord la boucherie, ça ne m'intéressait pas. Alors apprentissage au Terminus, à Saint-Avold, avec l'école d'apprentissage en plus du travail — mais malheureusement j'ai mis une beigne au prof, donc viré, et du coup le patron du Terminus m'a viré aussi. Apprentissage au Mirador, à Saint-Avold, puis Amboise au Duc de Choiseul, puis le buffet de la gare de Tours quand mes parents ont déménagé à Joué-lès-Tours. Et après ça, ça devient sérieux. » Source : MyHeritage · souvenir familial.",
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
    bio: "Compagnon puis époux de Chantal Captien. Mise en ménage à Basse-Yutz en 1963 (Chantal, 17 ans). Les deux se rencontrent à Thionville (Moselle) — témoignage familial — avant de s'installer en Touraine ; mariage le 4 décembre 1976 à Monts. Source : MyHeritage ; témoignage familial.",
    source: 'MyHeritage ; témoignage familial'
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

