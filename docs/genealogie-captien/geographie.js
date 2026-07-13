function renderContextItem(item) {
  return `
    <div class="geo-context-item">
      <span class="geo-context-label">${item.label}</span>
      <p>${item.text}</p>
    </div>`;
}

function renderGeoPeriod(period, index) {
  const watermark = WATERMARKS[period.id] || '';
  return `
    <section class="geo-period" id="geo-${period.id}">
      <div class="geo-period-watermark" aria-hidden="true">${watermark}</div>
      <div class="geo-period-head">
        <span class="geo-period-roman">${period.roman}.</span>
        <h2 class="geo-period-title">${period.title}</h2>
        <span class="geo-period-years">${period.years}</span>
        <p class="geo-period-place">${period.place}</p>
      </div>
      <div class="geo-period-body">
        <div class="geo-period-narrative">
          ${period.narrative.map(p => `<p>${p}</p>`).join('')}
        </div>
        ${period.context && period.context.length ? `
          <aside class="geo-period-context">
            ${period.context.map(renderContextItem).join('')}
          </aside>` : ''}
      </div>
    </section>
    ${index < GEOGRAPHIC_NARRATIVE.periods.length - 1 ? '<div class="connector"><span></span></div>' : ''}
  `;
}

function renderGeographicNarrative() {
  const mount = document.getElementById('geo-main');
  if (!mount || typeof GEOGRAPHIC_NARRATIVE === 'undefined') return;

  const geo = GEOGRAPHIC_NARRATIVE;
  mount.innerHTML = `
    <header class="geo-intro">
      <h1 class="geo-title">${geo.title}</h1>
      <p class="geo-subtitle">${geo.subtitle}</p>
      <div class="geo-intro-narrative">
        ${geo.intro.map(p => `<p>${p}</p>`).join('')}
      </div>
    </header>
    <nav class="geo-toc" aria-label="Sommaire des périodes">
      ${geo.periods.map(p =>
        `<a href="#geo-${p.id}"><span class="geo-toc-roman">${p.roman}</span> ${p.title.split('—')[0].trim()}</a>`
      ).join('')}
    </nav>
    <div class="geo-periods">
      ${geo.periods.map((p, i) => renderGeoPeriod(p, i)).join('')}
    </div>
    ${geo.closing ? `<p class="geo-closing">${geo.closing}</p>` : ''}
  `;
}

renderGeographicNarrative();
