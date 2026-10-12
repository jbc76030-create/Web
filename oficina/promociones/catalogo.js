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
  const dialog = document.querySelector('#promo-dialog');
  const close = document.querySelector('#modal-close');
  let opener = null;
  const fields = {
    image: document.querySelector('#modal-image'),
    category: document.querySelector('#modal-category'),
    title: document.querySelector('#promo-title'),
    body: document.querySelector('#modal-body'),
    benefit: document.querySelector('#modal-benefit'),
    wa: document.querySelector('#modal-wa'),
    mail: document.querySelector('#modal-mail'),
    download: document.querySelector('#modal-download'),
    request: document.querySelector('#modal-request'),
    hotspotWa: document.querySelector('#modal-hotspot-wa'),
    hotspotMail: document.querySelector('#modal-hotspot-mail')
  };
  grid.addEventListener('click', event => {
    const link = event.target.closest('.card-image-link');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const card = link.closest('.promo-card');
    opener = link;
    fields.image.src = card.dataset.image;
    fields.image.alt = card.dataset.label + '. ' + card.dataset.title + ' ' + card.dataset.body;
    fields.category.textContent = 'PROMOCIÓN ' + card.dataset.number + ' / ' + card.dataset.category;
    fields.title.textContent = card.dataset.title;
    fields.body.textContent = card.dataset.body;
    fields.benefit.textContent = card.dataset.benefit;
    fields.wa.href = fields.request.href = fields.hotspotWa.href = card.dataset.wa;
    fields.mail.href = fields.hotspotMail.href = card.dataset.mail;
    fields.download.href = card.dataset.download;
    fields.download.download = card.dataset.download.split('/').pop();
    dialog.showModal();
    close.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  update();
})();
