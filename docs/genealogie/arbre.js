// Construit un arbre de descendance à partir d'un id racine, en regroupant les
// enfants sous le bon couple (calculé par intersection des listes "children" des
// deux parents) plutôt que sous chaque parent séparément.

const TRUNK_TAIL = 'christophe-olivier-billeux';
// Pequegnot Billeux ouvre la lignée 100% avérée (13 générations) ; au-delà,
// Jean Perrin Billeux n'est qu'une hypothèse fondatrice, non comptée dans les 13.
const TRUNK_HEAD = 'pequegnot-billieux';

function unionsFor(personId) {
  const p = PEOPLE[personId];
  const spouses = p.spouses || [];
  const children = p.children || [];
  const attributed = new Set();
  const unions = [];

  spouses.forEach(spouseId => {
    const spouse = PEOPLE[spouseId];
    const kids = children.filter(cid => (spouse.children || []).includes(cid));
    kids.forEach(k => attributed.add(k));
    unions.push({ spouseId, children: kids });
  });

  const orphanKids = children.filter(cid => !attributed.has(cid));
  if (orphanKids.length || unions.length === 0) {
    unions.push({ spouseId: null, children: orphanKids });
  }

  return unions.filter(u => u.spouseId || u.children.length);
}

// Remonte la lignée de sang (toujours le 1er parent listé = le parent Billieux)
// depuis une personne jusqu'à la racine, pour savoir quels nœuds mettre en valeur.
function computeTrunk(tailId) {
  const trunk = new Set();
  let cur = tailId;
  while (cur) {
    trunk.add(cur);
    const parents = PEOPLE[cur] && PEOPLE[cur].parents;
    cur = parents && parents.length ? parents[0] : null;
  }
  return trunk;
}

// Remonte du dernier maillon (tailId) jusqu'au premier (headId inclus), en
// suivant toujours parents[0] — puis renvoie la chaîne dans l'ordre chronologique.
function getTrunkChain(tailId, headId) {
  const chain = [];
  let cur = tailId;
  while (cur) {
    chain.unshift(cur);
    if (cur === headId) break;
    const parents = PEOPLE[cur] && PEOPLE[cur].parents;
    cur = parents && parents.length ? parents[0] : null;
  }
  return chain;
}

function renderTrunkChain(tailId, headId, mountId) {
  const chain = getTrunkChain(tailId, headId);
  const html = chain.map((id, i) => {
    const p = PEOPLE[id];
    const era = p.chapterId ? `node--era-${p.chapterId}` : '';
    const next = chain[i + 1];
    const spouseId = next && PEOPLE[next].parents && PEOPLE[next].parents[1];
    let label = personLabel(id);
    if (spouseId && PEOPLE[spouseId]) label += ` <span class="node-sep">⚭</span> ${personLabel(spouseId)}`;
    const dates = shortDates(p.dates);
    return `
      <div class="trunk-node">
        <span class="trunk-node-n">${i + 1}</span>
        <div class="trunk-node-card ${era}">
          <span class="trunk-node-label">${label}</span>
          ${dates ? `<span class="trunk-node-dates">${dates}</span>` : ''}
        </div>
      </div>`;
  }).join('');
  document.getElementById(mountId).innerHTML = html;
}

function shortDates(str) {
  if (!str) return '';
  const years = str.match(/\b1[5-9]\d{2}\b|\b20[0-2]\d\b/g) || [];
  if (!years.length) return '';
  const uniq = [...new Set(years)];
  return uniq.length === 1 ? uniq[0] : `${uniq[0]}–${uniq[uniq.length - 1]}`;
}

function personLabel(id) {
  const p = PEOPLE[id];
  if (!p) return `<span class="person-missing">${id}</span>`;
  return `<a class="person-link" href="personne.html#${id}">${p.name}</a>`;
}

function nodeHtml(personId, spouseId) {
  const p = PEOPLE[personId];
  const era = p.chapterId ? `node--era-${p.chapterId}` : '';
  const dates = shortDates(p.dates);
  let spouseDates = '';
  if (spouseId && PEOPLE[spouseId]) spouseDates = shortDates(PEOPLE[spouseId].dates);

  let html = `<div class="node ${era}">`;
  html += `<span>${personLabel(personId)}`;
  if (spouseId) html += ` <span class="node-sep">⚭</span> ${personLabel(spouseId)}`;
  html += `</span>`;
  const dateLine = [dates, spouseDates].filter(Boolean).join(' · ');
  if (dateLine) html += `<span class="node-dates">${dateLine}</span>`;
  html += `</div>`;
  return html;
}

function renderPersonSubtree(personId, seen, trunkSet) {
  if (seen.has(personId)) return `<li>${nodeHtml(personId, null, trunkSet)}</li>`;
  seen.add(personId);

  const unions = unionsFor(personId);
  if (unions.length === 0) return `<li>${nodeHtml(personId, null, trunkSet)}</li>`;

  return unions.map(u => {
    const childOnTrunk = u.children.some(c => trunkSet.has(c));
    const thisIsTrunkNode = trunkSet.has(personId) && (childOnTrunk || personId === TRUNK_TAIL);
    const nodeMarkup = nodeHtml(personId, u.spouseId, trunkSet)
      .replace('class="node ', thisIsTrunkNode ? 'class="node node--trunk ' : 'class="node ');
    const childrenHtml = u.children.length
      ? `<ul>${u.children.map(cid => renderPersonSubtree(cid, seen, trunkSet)).join('')}</ul>`
      : '';
    return `<li>${nodeMarkup}${childrenHtml}</li>`;
  }).join('');
}

function renderTree(rootId, mountId, trunkSet) {
  const seen = new Set();
  const html = `<ul class="famtree">${renderPersonSubtree(rootId, seen, trunkSet || new Set())}</ul>`;
  document.getElementById(mountId).innerHTML = html;
}

const trunkSet = computeTrunk(TRUNK_TAIL);
renderTrunkChain(TRUNK_TAIL, TRUNK_HEAD, 'trunk-chain');
renderTree('pequegnot-billieux', 'tree-main', trunkSet);
renderTree('dominique-joseph-billieux-ehrenfeld', 'tree-ehrenfeld', new Set());

// Occurrences isolées : couples/individus, ou petites branches, sans lien de
// filiation prouvé avec la lignée directe (mais parfois dans la bonne fenêtre
// chronologique pour, un jour, s'y raccorder) — présentées ici comme des
// connexions potentielles (bordure pointillée), pas comme des faits établis.
function isolatedGroup(html) {
  return `<div class="famtree-mini famtree-mini--hypothesis"><ul class="famtree famtree--flat"><li>${html}</li></ul></div>`;
}
function isolatedTree(rootId) {
  const seen = new Set();
  return `<div class="famtree-mini famtree-mini--hypothesis"><ul class="famtree">${renderPersonSubtree(rootId, seen, new Set())}</ul></div>`;
}

document.getElementById('tree-isolated').innerHTML = `
  <div class="famtree-group-wrap">
    ${isolatedTree('jean-perrin-billeux-pere')}
    ${isolatedTree('andre-billieux-1598')}
    ${isolatedTree('jean-pierre-billieux')}
    ${isolatedGroup(nodeHtml('henri-billieux-1677', 'claudine-bregnard'))}
    ${isolatedTree('ursanne-billieux-montfaucon')}
    ${isolatedGroup(nodeHtml('jean-george-billieux-montfaucon'))}
    ${isolatedGroup(nodeHtml('christophe-billeux-1849', 'catherine-ruwell'))}
  </div>
`;

// Recherche : trouve un nom, le fait défiler à l'écran et le surligne
const searchInput = document.getElementById('tree-search');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    document.querySelectorAll('.node--match').forEach(n => n.classList.remove('node--match'));
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return;
    const link = [...document.querySelectorAll('.famtree .person-link')]
      .find(a => a.textContent.toLowerCase().includes(q));
    if (link) {
      const node = link.closest('.node');
      node.classList.add('node--match');
      node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  });
}
