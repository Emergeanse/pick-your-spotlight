const CARD_LABELS = {
  histoire: 'Grande Histoire',
  lieu: 'Le lieu, à cette époque',
  anecdote: 'Anecdote familiale',
  documents: 'Documents'
};

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = `
    <div class="nav__chapters">
      ${CHAPTERS.map(ch =>
        `<a href="#${ch.id}">${ch.years.split(' – ')[0]}<span>${ch.place.split(',')[0]}</span></a>`
      ).join('')}
    </div>
    <div class="nav__secondary">
      <a class="nav__tree" href="arbre.html">Arbre synthétique</a>
    </div>
  `;
}

function renderCard(card) {
  return `
    <details class="card card--${card.type}">
      <summary>
        <span class="card-tag">${CARD_LABELS[card.type] || 'Note'}</span>
        <span class="card-title">${card.title}</span>
      </summary>
      <p>${card.text}</p>
      ${card.source ? `<span class="card-source">Source : ${card.source}</span>` : ''}
    </details>`;
}

function renderChapter(ch, index) {
  return `
    <section class="chapter" id="${ch.id}">
      <div class="chapter-watermark" aria-hidden="true">${WATERMARKS[ch.id] || ''}</div>
      <div class="chapter-illustration">${ch.illustration}</div>
      <div class="chapter-head">
        <span class="chapter-years">${ch.years}</span>
        <h2 class="chapter-place">${ch.place}</h2>
      </div>
      <div class="chapter-body">
        <div class="chapter-narrative">
          ${ch.narrative.map(p => `<p>${p}</p>`).join('')}
        </div>
        ${ch.cards && ch.cards.length ? `
          <div class="chapter-cards">
            <h3>Pour aller plus loin</h3>
            ${ch.cards.map(renderCard).join('')}
          </div>` : ''}
      </div>
    </section>
    ${index < CHAPTERS.length - 1 ? '<div class="connector"><span></span></div>' : ''}
  `;
}

function renderEpilogue() {
  const mount = document.getElementById('epilogue');
  if (!mount || typeof EPILOGUE === 'undefined') return;

  const table = EPILOGUE.table;
  if (table && table.headers && table.rows) {
    mount.innerHTML = `
      <h2 class="epilogue-title">${EPILOGUE.title}</h2>
      <div class="epilogue-narrative">
        ${EPILOGUE.narrative.map(p => `<p>${p}</p>`).join('')}
      </div>
      ${EPILOGUE.closing ? `<p class="epilogue-closing">${EPILOGUE.closing}</p>` : ''}
      <h3 class="epilogue-annexe-title">${EPILOGUE.annexeTitle}</h3>
      <table class="epilogue-annexe">
        <thead>
          <tr>${table.headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${table.rows.map(r => `
            <tr>${r.map((cell, idx) => `<td class="${idx === 0 ? 'epilogue-annexe-note' : ''}">${cell}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return;
  }

  mount.innerHTML = `
    <h2 class="epilogue-title">${EPILOGUE.title}</h2>
    <div class="epilogue-narrative">
      ${EPILOGUE.narrative.map(p => `<p>${p}</p>`).join('')}
    </div>
    <p class="epilogue-closing">${EPILOGUE.closing}</p>
    <h3 class="epilogue-annexe-title">${EPILOGUE.annexeTitle}</h3>
    <table class="epilogue-annexe">
      <thead><tr><th>Repère</th><th>Événement</th><th>Source</th></tr></thead>
      <tbody>
        ${EPILOGUE.rows.map(r => `
          <tr>
            <td class="epilogue-annexe-note">${r.when}</td>
            <td>${r.what}</td>
            <td class="epilogue-annexe-note">${r.source || ''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function render() {
  renderNav();
  document.getElementById('chapters').innerHTML =
    CHAPTERS.map((ch, i) => renderChapter(ch, i)).join('');
  renderEpilogue();
}

render();

