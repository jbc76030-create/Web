(() => {
  const grid = document.querySelector('#catalogo'); if (!grid) return;
  const cards = [...grid.querySelectorAll('.promo-card')];
  const search = document.querySelector('#buscar');
  const chips = [...document.querySelectorAll('.chip')];
  const count = document.querySelector('#resultado');
  const empty = document.querySelector('#sin-resultados');
  let category = 'Todas';
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function update() {
    const query = norm(search.value.trim());
    let visible = 0;
    for (const card of cards) {
      const shown = (category === 'Todas' || card.dataset.category === category) && norm(card.dataset.search).includes(query);
      card.hidden = !shown;
      if (shown) visible++;
    }
    count.textContent = visible + ' de 41 promociones';
    empty.hidden = visible !== 0;
  }
  search.addEventListener('input', update);
  chips.forEach(chip => chip.addEventListener('click', () => {
    category = chip.dataset.category;
    chips.forEach(other => other.setAttribute('aria-pressed', String(other === chip)));
    update();
  }));
  update();
})();
