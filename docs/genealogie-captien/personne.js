function personLink(id) {
  const p = PEOPLE[id];
  if (!p) return `<span class="person-missing">${id}</span>`;
  return `<a class="person-link" href="personne.html#${id}">${p.name}</a>`;
}

function renderRelationRow(label, ids) {
  if (!ids || !ids.length) return '';
  return `
    <div class="relation-row">
      <span class="relation-label">${label}</span>
      <span class="relation-values">${ids.map(personLink).join(', ')}</span>
    </div>`;
}

function renderPerson(id) {
  const p = PEOPLE[id];
  const root = document.getElementById('person-main');
  const watermark = document.getElementById('person-watermark');
  if (!p) {
    root.innerHTML = `<p class="person-missing">Fiche introuvable.</p><p><a href="index.html">Retour au récit</a></p>`;
    watermark.innerHTML = '';
    return;
  }
  const isLieu = p.type === 'lieu';
  watermark.innerHTML = (p.chapterId && WATERMARKS[p.chapterId]) || '';
  document.title = `${p.name} — CAPTIEN / Kapgen`;
  root.innerHTML = `
    <div class="person-card">
      <div class="person-avatar${isLieu ? ' person-avatar--lieu' : ''}">${isLieu ? '◉' : p.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
      <h1 class="person-name">${p.name}</h1>
      ${isLieu ? '<p class="person-type-badge person-type-badge--lieu">Lieu</p>' : ''}
      <p class="person-dates">${p.dates || ''}</p>
      ${!isLieu ? `
      <div class="person-relations">
        ${renderRelationRow('Parents', p.parents)}
        ${renderRelationRow('Conjoint·e', p.spouses)}
        ${renderRelationRow('Enfants', p.children)}
      </div>` : ''}
      ${p.bio ? `<p class="person-bio">${p.bio}</p>` : ''}
      ${p.recherche ? `<div class="person-recherche">${p.recherche}</div>` : ''}
      ${p.chapterId ? `<a class="person-back" href="index.html#${p.chapterId}">← Retour au récit, au chapitre correspondant</a>` : `<a class="person-back" href="index.html">← Retour au récit</a>`}
    </div>
  `;
}

renderPerson(decodeURIComponent(location.hash.slice(1)));
window.addEventListener('hashchange', () => {
  renderPerson(decodeURIComponent(location.hash.slice(1)));
});
