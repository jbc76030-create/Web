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
  if (navigator.share) document.body.classList.add('can-share');
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
    share: document.querySelector('#modal-share'),
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
    fields.share.dataset.share = card.dataset.download;
    fields.share.dataset.title = card.dataset.label;
    dialog.showModal();
    close.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  async function shareImage(button) {
    const url = new URL(button.dataset.share, location.href).href;
    const title = button.dataset.title + ' · JB Gestión Empresarial';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo preparar la imagen');
      const image = new File([await response.blob()], url.split('/').pop(), {type:'image/jpeg'});
      if (navigator.canShare?.({files:[image]})) await navigator.share({title, files:[image]});
      else await navigator.share({title, url});
    } catch (error) {
      if (error.name !== 'AbortError') window.location.href = url;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('.button-share');
    if (button) shareImage(button);
  });
  update();
})();
