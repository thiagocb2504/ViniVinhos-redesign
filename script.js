const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');


/* =========================================================
   HEADER
========================================================= */

function updateHeader() {
  if (!header || header.classList.contains('solid')) return;

  header.classList.toggle(
    'scrolled',
    window.scrollY > 30
  );
}

window.addEventListener(
  'scroll',
  updateHeader,
  { passive: true }
);

updateHeader();


/* =========================================================
   MENU MOBILE
========================================================= */

if (menuToggle && mainNav) {

  menuToggle.addEventListener('click', () => {

    const open =
      mainNav.classList.toggle('open');

    menuToggle.classList.toggle(
      'open',
      open
    );

    menuToggle.setAttribute(
      'aria-expanded',
      String(open)
    );

    document.body.classList.toggle(
      'menu-open',
      open
    );

  });


  mainNav
    .querySelectorAll('a')
    .forEach(link => {

      link.addEventListener('click', () => {

        mainNav.classList.remove('open');

        menuToggle.classList.remove('open');

        menuToggle.setAttribute(
          'aria-expanded',
          'false'
        );

        document.body.classList.remove(
          'menu-open'
        );

      });

    });

}


/* =========================================================
   SLIDER DO HERO
========================================================= */

const slides = [
  ...document.querySelectorAll('.hero-slide')
];

const reduceMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (slides.length > 1 && !reduceMotion) {

  let currentSlide = 0;

  setInterval(() => {

    slides[currentSlide]
      .classList
      .remove('active');

    currentSlide =
      (currentSlide + 1) %
      slides.length;

    slides[currentSlide]
      .classList
      .add('active');

  }, 5200);

}


/* =========================================================
   REVEAL / ANIMAÇÕES
========================================================= */

const revealItems =
  document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {

  const observer =
    new IntersectionObserver(

      entries => {

        entries.forEach(entry => {

          if (
            entry.isIntersecting
          ) {

            entry.target
              .classList
              .add('visible');

            observer.unobserve(
              entry.target
            );

          }

        });

      },

      {
        threshold: 0.12,
        rootMargin:
          '0px 0px -45px 0px'
      }

    );

  revealItems.forEach(item => {
    observer.observe(item);
  });

} else {

  revealItems.forEach(item => {
    item.classList.add('visible');
  });

}


/* =========================================================
   DADOS DA PLANILHA (home e catálogo)
========================================================= */

const SHEET_URL =
  'https://opensheet.elk.sh/139ZqOOfftdnX3RyN6Q0e3QM1vpwJO-Xnvv1Ym-I4QMY/Página1';

// Mesmo App da Web do painel admin (admin.js); recebe os cliques.
const API_URL =
  'https://script.google.com/macros/s/AKfycbwxQQO02ZEyksJTeez_UAkjDVEnyQS4GPyu1sGZdcMDxxV51T_LoRkziCHmVwGU9usR/exec';

const WHATSAPP =
  '5561981090715';


const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();


const esc = value =>
  String(value).replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]
  );


// Aceita variações no nome da coluna: "Preço", "preco", "PREÇO"...
const field = (wine, names) => {

  for (const name of names) {

    if (
      wine[name] != null &&
      String(wine[name]).trim() !== ''
    ) {
      return String(wine[name]).trim();
    }

  }

  return '';

};


const displayValue = value =>
  String(value || '').trim() || '—';


function wineData(wine) {

  const country =
    field(wine, ['País', 'Pais', 'país', 'pais', 'PAÍS', 'PAIS']);

  const region =
    field(wine, ['Região', 'Regiao', 'região', 'regiao', 'REGIÃO', 'REGIAO']);

  return {
    id: field(wine, ['ID', 'Id', 'id']),
    name: field(wine, ['Nome', 'nome', 'NOME']) || 'Vinho',
    price: field(wine, ['Preço', 'Preco', 'preço', 'preco', 'PREÇO']) || 'Consulte',
    image: field(wine, ['Imagem', 'imagem', 'IMAGEM']),
    type: field(wine, ['Tipo', 'tipo', 'TIPO']),
    grape: field(wine, ['Uva', 'uva', 'UVA']),
    vintage: field(wine, ['Safra', 'safra', 'SAFRA']),
    clicks: Number(field(wine, ['Cliques', 'cliques', 'CLIQUES'])) || 0,
    country,
    region,

    // País e região num campo só: "Argentina - Mendoza".
    origin: [country, region].filter(Boolean).join(' - ')
  };

}


function loadWines() {

  return fetch(SHEET_URL)
    .then(response => {

      if (!response.ok) {
        throw new Error('Falha ao carregar catálogo');
      }

      return response.json();

    })
    .then(data => Array.isArray(data) ? data : []);

}


/* =========================================================
   CLIQUES — alimentam os destaques da home
========================================================= */

function trackClick(id) {

  if (!id || !API_URL) return;

  // Conta no máximo um clique por vinho a cada visita.
  const key = `vv-clique-${id}`;

  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Navegação privada: conta mesmo assim.
  }

  // text/plain evita o preflight de CORS, que o Apps Script não responde.
  const body = JSON.stringify({ acao: 'clique', id });

  const sent =
    navigator.sendBeacon?.(
      API_URL,
      new Blob([body], { type: 'text/plain;charset=utf-8' })
    );

  if (!sent) {
    fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    }).catch(() => {});
  }

}


/* =========================================================
   DESTAQUES DA HOME (mais clicados)
========================================================= */

const highlightGrid =
  document.getElementById('destaques-grid');

if (highlightGrid) {

  const HIGHLIGHTS = 4;

  const eyebrow =
    document.getElementById('destaques-eyebrow');


  const shuffle = list => {

    const copy = [...list];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;

  };


  const detail = (label, value) =>
    value
      ? `<div class="wine-detail"><span>${label}</span><strong>${esc(value)}</strong></div>`
      : '';


  function renderHighlights(wines) {

    const withImage =
      wines.map(wineData).filter(wine => wine.image);

    const clicked =
      withImage
        .filter(wine => wine.clicks > 0)
        .sort((a, b) => b.clicks - a.clicks);

    // Enquanto não houver cliques suficientes, completa com rótulos sorteados.
    const picks =
      clicked
        .concat(shuffle(withImage.filter(wine => !wine.clicks)))
        .slice(0, HIGHLIGHTS);


    if (!picks.length) {
      highlightGrid.hidden = true;
      return;
    }


    if (eyebrow && clicked.length) {
      eyebrow.textContent = 'Mais procurados';
    }


    highlightGrid.innerHTML = picks.map(wine => {

      const details = [
        detail('Uva', wine.grape),
        detail('Safra', wine.vintage),
        detail('Tipo', wine.type),
        detail('Origem', wine.origin)
      ].join('');

      return `
        <article class="wine-card">

          <div class="wine-photo">
            <img src="${esc(wine.image)}" alt="${esc(wine.name)}" loading="lazy">
          </div>

          <div class="wine-info">

            <span class="wine-category">${esc(wine.country || wine.type || 'Vinho')}</span>

            <h3>${esc(wine.name)}</h3>

            ${details ? `<div class="wine-details">${details}</div>` : ''}

            <a class="wine-link" href="catalogo.html?busca=${encodeURIComponent(wine.name)}">
              Ver no catálogo <span aria-hidden="true">→</span>
            </a>

          </div>

        </article>
      `;

    }).join('');

  }


  loadWines()
    .then(renderHighlights)
    .catch(error => {
      console.error('Erro ao carregar destaques:', error);
      highlightGrid.hidden = true;
    })
    .finally(() => {
      highlightGrid.removeAttribute('aria-busy');
    });

}


/* =========================================================
   CATÁLOGO
========================================================= */

const catalogGrid =
  document.getElementById('catalogo');

if (catalogGrid) {

  const searchInput =
    document.getElementById('busca-vinho');

  const filterButtons = [
    ...document.querySelectorAll('.filter-btn')
  ];

  const count =
    document.getElementById('catalog-count');

  const empty =
    document.getElementById('catalog-empty');


  let wines = [];
  let activeFilter = 'todos';

  // Links da home chegam como catalogo.html?busca=Tucumen.
  let term =
    new URLSearchParams(location.search).get('busca') || '';

  if (searchInput) {
    searchInput.value = term;
  }


  /* =======================================================
     ESQUELETO ENQUANTO CARREGA
  ======================================================= */

  catalogGrid.innerHTML =
    '<div class="catalog-card is-skeleton" aria-hidden="true"><div class="catalog-card-image"></div><div class="catalog-card-content"><span></span><span></span><span></span></div></div>'
      .repeat(8);


  /* =======================================================
     BUSCA + FILTRO
  ======================================================= */

  function matches(wine) {

    const type = normalize(wine.type);

    if (
      activeFilter !== 'todos' &&
      !type.includes(activeFilter)
    ) {
      return false;
    }

    const search = normalize(term);

    return [
      wine.name,
      wine.grape,
      wine.region,
      wine.country,
      wine.type
    ].some(value => normalize(value).includes(search));

  }


  /* =======================================================
     RENDERIZA CATÁLOGO
  ======================================================= */

  function render() {

    const list = wines.filter(matches);

    if (empty) {
      empty.hidden = list.length !== 0;
    }

    if (count) {
      count.textContent =
        `${list.length} ${
          list.length === 1
            ? 'rótulo encontrado'
            : 'rótulos encontrados'
        }`;
    }


    catalogGrid.innerHTML = list.map(wine => {

      const formattedPrice =
        wine.price.toLowerCase().includes('r$') ||
        normalize(wine.price) === 'consulte'
          ? wine.price
          : `R$ ${wine.price}`;

      const message =
        `Olá! Tenho interesse no vinho ${wine.name} - ${formattedPrice}. Poderia me informar a disponibilidade?`;

      const whatsappUrl =
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

      const meta =
        [wine.type, wine.country].filter(Boolean).join(' • ');

      return `
        <article class="catalog-card">

          <div class="catalog-card-image">
            <img src="${esc(wine.image || './img/logo.png')}" alt="${esc(wine.name)}" loading="lazy">
          </div>

          <div class="catalog-card-content">

            <span class="catalog-type">${esc(meta || 'Vinho')}</span>

            <h2>${esc(wine.name)}</h2>

            <div class="catalog-wine-details">

              <div class="catalog-wine-detail">
                <span>Uva</span>
                <strong>${esc(displayValue(wine.grape))}</strong>
              </div>

              <div class="catalog-wine-detail">
                <span>Safra</span>
                <strong>${esc(displayValue(wine.vintage))}</strong>
              </div>

              <div class="catalog-wine-detail">
                <span>Tipo</span>
                <strong>${esc(displayValue(wine.type))}</strong>
              </div>

              <div class="catalog-wine-detail">
                <span>Origem</span>
                <strong>${esc(displayValue(wine.origin))}</strong>
              </div>

            </div>

            <div class="catalog-card-bottom">

              <strong>${esc(formattedPrice)}</strong>

              <a
                href="${esc(whatsappUrl)}"
                target="_blank"
                rel="noopener"
                data-id="${esc(wine.id)}"
                aria-label="Pedir ${esc(wine.name)} no WhatsApp"
              >
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                Pedir
              </a>

            </div>

          </div>

        </article>
      `;

    }).join('');

  }


  /* =======================================================
     CLIQUE EM "PEDIR"
  ======================================================= */

  catalogGrid.addEventListener('click', event => {

    const link = event.target.closest('a[data-id]');

    if (link) {
      trackClick(link.dataset.id);
    }

  });


  /* =======================================================
     FILTROS
  ======================================================= */

  filterButtons.forEach(button => {

    button.addEventListener('click', () => {

      activeFilter = button.dataset.filter;

      filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', String(btn === button));
      });

      render();

    });

  });


  /* =======================================================
     BUSCA
  ======================================================= */

  searchInput?.addEventListener('input', event => {

    term = event.target.value;

    render();

  });


  /* =======================================================
     CARREGA PLANILHA
  ======================================================= */

  loadWines()

    .then(data => {

      wines = data.map(wineData);

      catalogGrid.removeAttribute('aria-busy');

      render();

    })

    .catch(error => {

      catalogGrid.removeAttribute('aria-busy');

      console.error('Erro ao carregar catálogo:', error);

      if (count) {
        count.textContent =
          'Não foi possível carregar o catálogo agora.';
      }

      catalogGrid.innerHTML = `
        <div class="catalog-error">
          <h2>Catálogo temporariamente indisponível.</h2>
          <p>Você ainda pode falar com a loja pelo WhatsApp para consultar os rótulos.</p>
          <a class="button button-primary" href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">
            Falar no WhatsApp
          </a>
        </div>
      `;

    });

}
