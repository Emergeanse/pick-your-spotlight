// Arbre — moteur de rendu (inspiré de genealogie-billeux-b)
// Rendu depuis le parent CAPTIEN commun (placeholder),
// avec mise en évidence de la "colonne vertébrale" jusqu'à Chantal.

const TRUNK_HEAD = 'georges-schneider-1583';
const TRUNK_TAIL = 'chantal-captien-1946';

function unionsFor(personId) {
  const p = PEOPLE[personId];
  const spouses = (p && p.spouses) || [];
  const children = (p && p.children) || [];
  const attributed = new Set();
  const unions = [];

  spouses.forEach(spouseId => {
    const spouse = PEOPLE[spouseId];
    const kids = children.filter(cid => (spouse && spouse.children || []).includes(cid));
    kids.forEach(k => attributed.add(k));
    unions.push({ spouseId, children: kids });
  });

  const orphanKids = children.filter(cid => !attributed.has(cid));
  if (orphanKids.length || unions.length === 0) {
    unions.push({ spouseId: null, children: orphanKids });
  }

  return unions.filter(u => u.spouseId || u.children.length);
}

function computeTrunk(tailId) {
  const trunk = new Set();
  let cur = tailId;
  while (cur) {
    trunk.add(cur);
    const p = PEOPLE[cur];
    const parents = p && p.parents;
    if (parents && parents.length) {
      cur = parents[0];
      continue;
    }
    // Quand une branche manque (ex: union CAPTIEN × SCHNEIDER),
    // on rebascule vers le conjoint si cela permet de remonter.
    const spouses = (p && p.spouses) || [];
    const spouseWithParents = spouses.find(sid => PEOPLE[sid] && PEOPLE[sid].parents && PEOPLE[sid].parents.length);
    cur = spouseWithParents || null;
  }
  return trunk;
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
  const dates = shortDates(p && p.dates);
  let spouseDates = '';
  if (spouseId && PEOPLE[spouseId]) spouseDates = shortDates(PEOPLE[spouseId].dates);

  let html = `<div class="node">`;
  html += `<span>${personLabel(personId)}`;
  if (spouseId) html += ` <span class="node-sep">⚭</span> ${personLabel(spouseId)}`;
  html += `</span>`;
  const dateLine = [dates, spouseDates].filter(Boolean).join(' · ');
  if (dateLine) html += `<span class="node-dates">${dateLine}</span>`;
  html += `</div>`;
  return html;
}

function renderPersonSubtree(personId, seen, trunkSet) {
  if (seen.has(personId)) return `<li>${nodeHtml(personId, null)}</li>`;
  seen.add(personId);

  const unions = unionsFor(personId);
  if (unions.length === 0) return `<li>${nodeHtml(personId, null)}</li>`;

  return unions.map(u => {
    const childOnTrunk = u.children.some(c => trunkSet.has(c));
    const thisIsTrunkNode = trunkSet.has(personId) && (childOnTrunk || personId === TRUNK_TAIL);
    const nodeMarkup = nodeHtml(personId, u.spouseId)
      .replace('class="node"', thisIsTrunkNode ? 'class="node node--trunk"' : 'class="node"');
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
renderTree(TRUNK_HEAD, 'tree-main', trunkSet);

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

