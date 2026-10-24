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

if (slides.length > 1) {

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
   CATÁLOGO
========================================================= */

const catalogGrid =
  document.getElementById('catalogo');

if (catalogGrid) {

  const SHEET_URL =
    'https://opensheet.elk.sh/139ZqOOfftdnX3RyN6Q0e3QM1vpwJO-Xnvv1Ym-I4QMY/Página1';

  const WHATSAPP =
    '5561981090715';


  const searchInput =
    document.getElementById(
      'busca-vinho'
    );

  const filterButtons = [
    ...document.querySelectorAll(
      '.filter-btn'
    )
  ];

  const count =
    document.getElementById(
      'catalog-count'
    );

  const empty =
    document.getElementById(
      'catalog-empty'
    );


  let wines = [];
  let activeFilter = 'todos';
  let term = '';


  /* =======================================================
     NORMALIZA TEXTO
  ======================================================= */

  const normalize = value =>

    String(value || '')

      .normalize('NFD')

      .replace(
        /[\u0300-\u036f]/g,
        ''
      )

      .trim()

      .toLowerCase();


  /* =======================================================
     PEGA CAMPOS DA PLANILHA
  ======================================================= */

  const field = (
    wine,
    names
  ) => {

    for (
      const name of names
    ) {

      if (
        wine[name] != null &&
        String(wine[name]).trim() !== ''
      ) {

        return String(
          wine[name]
        ).trim();

      }

    }

    return '';

  };


  /* =======================================================
     MOSTRA TRAVESSÃO SE NÃO TIVER INFORMAÇÃO
  ======================================================= */

  const displayValue = value => {

    if (
      value == null ||
      String(value).trim() === ''
    ) {
      return '—';
    }

    return String(value).trim();

  };


  /* =======================================================
     FILTRO POR TIPO
  ======================================================= */

  function matchesType(wine) {

    if (
      activeFilter === 'todos'
    ) {
      return true;
    }


    const type =
      normalize(
        field(
          wine,
          [
            'Tipo',
            'tipo',
            'TIPO'
          ]
        )
      );


    if (
      activeFilter === 'rose'
    ) {

      return type.includes(
        'rose'
      );

    }


    return type.includes(
      activeFilter
    );

  }


  /* =======================================================
     BUSCA + FILTRO
  ======================================================= */

  function filteredWines() {

    return wines.filter(
      wine => {

        const name =
          normalize(
            field(
              wine,
              [
                'Nome',
                'nome',
                'NOME'
              ]
            )
          );


        const grape =
          normalize(
            field(
              wine,
              [
                'Uva',
                'uva',
                'UVA'
              ]
            )
          );


        const region =
          normalize(
            field(
              wine,
              [
                'Região',
                'Regiao',
                'região',
                'regiao',
                'REGIÃO',
                'REGIAO'
              ]
            )
          );


        const country =
          normalize(
            field(
              wine,
              [
                'País',
                'Pais',
                'país',
                'pais',
                'PAÍS',
                'PAIS'
              ]
            )
          );


        const type =
          normalize(
            field(
              wine,
              [
                'Tipo',
                'tipo',
                'TIPO'
              ]
            )
          );


        const search =
          normalize(term);


        const matchesSearch =

          name.includes(search) ||

          grape.includes(search) ||

          region.includes(search) ||

          country.includes(search) ||

          type.includes(search);


        return (
          matchesType(wine) &&
          matchesSearch
        );

      }
    );

  }


  /* =======================================================
     RENDERIZA CATÁLOGO
  ======================================================= */

  function render() {

    const list =
      filteredWines();


    catalogGrid.innerHTML = '';


    if (empty) {

      empty.hidden =
        list.length !== 0;

    }


    if (count) {

      count.textContent =
        `${list.length} ${
          list.length === 1
            ? 'rótulo encontrado'
            : 'rótulos encontrados'
        }`;

    }


    list.forEach(wine => {


      /* -------------------------
         CAMPOS PRINCIPAIS
      ------------------------- */

      const name =
        field(
          wine,
          [
            'Nome',
            'nome',
            'NOME'
          ]
        ) || 'Vinho';


      const price =
        field(
          wine,
          [
            'Preço',
            'Preco',
            'preço',
            'preco',
            'PREÇO'
          ]
        ) || 'Consulte';


      const image =
        field(
          wine,
          [
            'Imagem',
            'imagem',
            'IMAGEM'
          ]
        ) ||
        './img/logo.png';


      const type =
        field(
          wine,
          [
            'Tipo',
            'tipo',
            'TIPO'
          ]
        );


      const country =
        field(
          wine,
          [
            'País',
            'Pais',
            'país',
            'pais',
            'PAÍS',
            'PAIS'
          ]
        );


      const grape =
        field(
          wine,
          [
            'Uva',
            'uva',
            'UVA'
          ]
        );


      const vintage =
        field(
          wine,
          [
            'Safra',
            'safra',
            'SAFRA'
          ]
        );


      const region =
        field(
          wine,
          [
            'Região',
            'Regiao',
            'região',
            'regiao',
            'REGIÃO',
            'REGIAO'
          ]
        );


      /* -------------------------
         META DO CARD
      ------------------------- */

      const meta = [
        type,
        country
      ]
        .filter(Boolean)
        .join(' • ');


      /* -------------------------
         WHATSAPP
      ------------------------- */

      const formattedPrice =

        price
          .toLowerCase()
          .includes('r$') ||

        normalize(price) ===
          'consulte'

          ? price

          : `R$ ${price}`;


      const message =
        `Olá! Tenho interesse no vinho ${name} - ${formattedPrice}. Poderia me informar a disponibilidade?`;


      const whatsappUrl =
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
          message
        )}`;


      /* -------------------------
         CARD
      ------------------------- */

      const article =
        document.createElement(
          'article'
        );


      article.className =
        'catalog-card';


      article.innerHTML = `

        <div class="catalog-card-image">

          <img
            src="${image}"
            alt="${name}"
            loading="lazy"
          >

        </div>


        <div class="catalog-card-content">


          <span class="catalog-type">
            ${meta || 'Vinho'}
          </span>


          <h2>
            ${name}
          </h2>


          <div class="catalog-wine-details">


            <div class="catalog-wine-detail">

              <span>
                Uva
              </span>

              <strong>
                ${displayValue(grape)}
              </strong>

            </div>


            <div class="catalog-wine-detail">

              <span>
                Safra
              </span>

              <strong>
                ${displayValue(vintage)}
              </strong>

            </div>


            <div class="catalog-wine-detail">

              <span>
                Tipo
              </span>

              <strong>
                ${displayValue(type)}
              </strong>

            </div>


            <div class="catalog-wine-detail">

              <span>
                Região
              </span>

              <strong>
                ${displayValue(region)}
              </strong>

            </div>


          </div>


          <div class="catalog-card-bottom">


            <strong>
              ${formattedPrice}
            </strong>


            <a
              href="${whatsappUrl}"
              target="_blank"
              rel="noopener"
              aria-label="Pedir ${name} no WhatsApp"
            >

              <i class="fa-brands fa-whatsapp"></i>

              Pedir

            </a>


          </div>


        </div>

      `;


      catalogGrid.appendChild(
        article
      );

    });

  }


  /* =======================================================
     FILTROS
  ======================================================= */

  filterButtons.forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          activeFilter =
            button.dataset.filter;


          filterButtons.forEach(
            btn => {

              btn.classList.toggle(
                'active',
                btn === button
              );

            }
          );


          render();

        }
      );

    }
  );


  /* =======================================================
     BUSCA
  ======================================================= */

  searchInput?.addEventListener(
    'input',
    event => {

      term =
        event.target.value;

      render();

    }
  );


  /* =======================================================
     CARREGA PLANILHA
  ======================================================= */

  fetch(SHEET_URL)

    .then(response => {

      if (!response.ok) {

        throw new Error(
          'Falha ao carregar catálogo'
        );

      }

      return response.json();

    })


    .then(data => {

      wines =
        Array.isArray(data)
          ? data
          : [];


      render();

    })


    .catch(error => {

      console.error(
        'Erro ao carregar catálogo:',
        error
      );


      if (count) {

        count.textContent =
          'Não foi possível carregar o catálogo agora.';

      }


      catalogGrid.innerHTML = `

        <div class="catalog-error">

          <h2>
            Catálogo temporariamente indisponível.
          </h2>

          <p>
            Você ainda pode falar com a loja pelo WhatsApp
            para consultar os rótulos.
          </p>

          <a
            class="button button-primary"
            href="https://wa.me/${WHATSAPP}"
            target="_blank"
            rel="noopener"
          >
            Falar no WhatsApp
          </a>

        </div>

      `;

    });

}