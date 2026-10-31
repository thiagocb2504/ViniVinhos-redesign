/* =========================================================
   PAINEL ADMIN — VINI VINHOS
   Página sem link no site. Toda a segurança fica no
   Apps Script: sem a senha, a API não grava nada.
========================================================= */

// Cole aqui a URL do App da Web do Apps Script (termina em /exec).
const API_URL = 'https://script.google.com/macros/s/AKfycbwxQQO02ZEyksJTeez_UAkjDVEnyQS4GPyu1sGZdcMDxxV51T_LoRkziCHmVwGU9usR/exec';

const BG_REMOVAL_URL =
  'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/index.mjs';

const TOKEN_KEY = 'vv_admin_token';

const $ = id => document.getElementById(id);


/* =======================================================
   ESTADO
======================================================= */

const sessao = {
  get() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(valor) {
    try { sessionStorage.setItem(TOKEN_KEY, valor); } catch { /* sem storage: só dura até recarregar */ }
  },
  limpar() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* idem */ }
  }
};

let token = sessao.get();
let config = { removerFundo: true, qualidade: 0.85, tamanhoMax: 1000 };
let vinhos = [];
let vinhosCarregados = false;
let filtroLista = 'todos';
let editando = null;
let formAlterado = false;
let imagem = null;
let versaoImagem = 0;
let previewUrl = null;


/* =======================================================
   ELEMENTOS
======================================================= */

const loginView = $('login-view');
const appView = $('app-view');
const tabs = $('admin-tabs');
const headerActions = $('header-actions');

const wineForm = $('wine-form');
const salvarBtn = $('salvar');
const formErro = $('form-erro');
const removerFundoInput = $('remover-fundo');
const imagemInput = $('imagem-input');
const dropzone = $('dropzone');
const preview = $('preview');
const previewImg = $('preview-img');
const dropzoneEmpty = $('dropzone-empty');
const imageStatus = $('image-status');
const limparImagemBtn = $('limpar-imagem');

const wineList = $('wine-list');
const configForm = $('config-form');
const senhaForm = $('senha-form');


/* =======================================================
   API
======================================================= */

async function api(acao, dados = {}) {

  if (!API_URL) {
    throw new Error('Falta configurar a URL do Apps Script (API_URL) no arquivo admin.js.');
  }

  let resposta;

  try {
    // text/plain evita o preflight de CORS, que o Apps Script não responde.
    resposta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, token, ...dados })
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet.');
  }

  const json = await resposta.json().catch(() => ({ ok: false, erro: 'Resposta inválida do servidor.' }));

  if (json.sessao === false) {
    encerrarSessao();
  }

  if (!json.ok) {
    throw new Error(json.erro || 'Algo deu errado.');
  }

  return json;

}


/* =======================================================
   UTILITÁRIOS DE TELA
======================================================= */

let toastTimer;

function avisar(mensagem, tipo = 'ok') {

  const toast = $('toast');

  toast.querySelector('i').className = tipo === 'erro'
    ? 'fa-solid fa-circle-exclamation'
    : 'fa-solid fa-circle-check';
  toast.querySelector('span').textContent = mensagem;
  toast.dataset.tipo = tipo;

  // Reinicia a animação de entrada.
  toast.hidden = true;
  void toast.offsetWidth;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);

}

// Janela de confirmação no estilo do site, no lugar do confirm() do navegador.
function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false }) {

  const dialogo = $('dialogo');

  $('dialogo-titulo').textContent = titulo;
  $('dialogo-texto').textContent = texto;
  $('dialogo-ok').textContent = botao;
  dialogo.classList.toggle('is-danger', perigo);
  dialogo.returnValue = '';

  return new Promise(resolve => {
    dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'ok'), { once: true });
    dialogo.showModal();
    $('dialogo-ok').focus();
  });

}

// Mostra um spinner no botão enquanto a ação roda; devolve a função que restaura.
function carregando(botao, texto) {

  const original = botao.innerHTML;

  botao.disabled = true;
  botao.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(texto)}`;

  return () => {
    botao.disabled = false;
    botao.innerHTML = original;
  };

}

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatarPreco(preco) {
  if (!preco) return '';
  return /r\$/i.test(preco) ? preco : `R$ ${preco}`;
}

function origem(pais, regiao) {
  return [pais, regiao].map(v => String(v ?? '').trim()).filter(Boolean).join(' - ');
}

document.addEventListener('click', event => {

  const toggle = event.target.closest('.password-toggle');

  if (!toggle) return;

  const campo = $(toggle.dataset.alvo);
  const mostrar = campo.type === 'password';

  campo.type = mostrar ? 'text' : 'password';
  toggle.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  toggle.querySelector('i').className = mostrar ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';

});


/* =======================================================
   LOGIN
======================================================= */

function mostrarPainel() {
  loginView.hidden = true;
  appView.hidden = false;
  tabs.hidden = false;
  headerActions.hidden = false;
  aplicarConfig();
  resetarFormulario();
  abrirAba('adicionar');
  // Carrega a lista em segundo plano para avisar sobre vinhos repetidos.
  carregarVinhos();
}

function mostrarLogin() {
  loginView.hidden = false;
  appView.hidden = true;
  tabs.hidden = true;
  headerActions.hidden = true;
  $('login-senha').focus();
}

function encerrarSessao() {
  token = null;
  marcarAlterado(false);
  sessao.limpar();
  mostrarLogin();
}

$('login-form').addEventListener('submit', async event => {

  event.preventDefault();

  const erro = $('login-erro');
  const restaurar = carregando(event.submitter, 'Entrando...');

  erro.textContent = '';

  try {
    const resposta = await api('login', { senha: $('login-senha').value });
    token = resposta.token;
    sessao.set(token);
    $('login-senha').value = '';
    await carregarConfig();
    mostrarPainel();
  } catch (e) {
    erro.textContent = e.message;
  } finally {
    restaurar();
  }

});

$('logout').addEventListener('click', async () => {

  if (!await podeDescartar()) return;

  api('logout').catch(() => {});
  encerrarSessao();

});


/* =======================================================
   ABAS
======================================================= */

function abrirAba(nome) {

  tabs.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === nome);
  });

  $('tab-adicionar').hidden = nome !== 'adicionar';
  $('tab-configuracoes').hidden = nome !== 'configuracoes';

  if (nome === 'configuracoes') carregarVinhos();

  window.scrollTo({ top: 0 });

}

tabs.addEventListener('click', async event => {

  const tab = event.target.closest('.admin-tab');

  if (!tab) return;

  // Sair da edição pelo menu volta o formulário para "novo vinho".
  if (tab.dataset.tab === 'adicionar' && editando) {
    if (!await podeDescartar()) return;
    resetarFormulario();
  }

  abrirAba(tab.dataset.tab);

});


/* =======================================================
   FORMULÁRIO DE VINHO
======================================================= */

const REGIOES = {
  argentina: ['Mendoza', 'Valle de Uco', 'Luján de Cuyo', 'Salta', 'Cafayate', 'San Juan', 'Patagônia'],
  chile: ['Valle Central', 'Maipo', 'Colchagua', 'Casablanca', 'Rapel', 'Aconcágua', 'Maule'],
  brasil: ['Serra Gaúcha', 'Vale dos Vinhedos', 'Campanha Gaúcha', 'Serra Catarinense', 'Vale do São Francisco'],
  uruguai: ['Canelones', 'Maldonado', 'Colonia'],
  portugal: ['Douro', 'Alentejo', 'Dão', 'Vinho Verde', 'Lisboa', 'Tejo', 'Península de Setúbal', 'Bairrada'],
  espanha: ['Rioja', 'Ribera del Duero', 'Priorat', 'Rías Baixas', 'Cava', 'La Mancha', 'Navarra'],
  italia: ['Toscana', 'Piemonte', 'Vêneto', 'Puglia', 'Sicília', 'Chianti', 'Montalcino'],
  franca: ['Bordeaux', 'Borgonha', 'Champagne', 'Vale do Rhône', 'Vale do Loire', 'Languedoc', 'Alsácia', 'Provence'],
  'africa do sul': ['Stellenbosch', 'Paarl', 'Western Cape'],
  'estados unidos': ['Califórnia', 'Napa Valley', 'Sonoma', 'Oregon', 'Washington'],
  australia: ['Barossa Valley', 'McLaren Vale', 'Hunter Valley', 'Yarra Valley'],
  'nova zelandia': ['Marlborough', 'Central Otago', "Hawke's Bay"]
};

// Sugere regiões do país digitado e mostra como a origem fica no card.
function atualizarOrigem() {

  const pais = wineForm.elements['País'].value;
  const regiao = wineForm.elements['Região'].value;

  $('lista-regioes').innerHTML = (REGIOES[normalizar(pais)] || [])
    .map(nome => `<option value="${esc(nome)}">`)
    .join('');

  $('origem-preview').querySelector('strong').textContent = origem(pais, regiao) || '—';

}

wineForm.elements['País'].addEventListener('input', atualizarOrigem);
wineForm.elements['Região'].addEventListener('input', atualizarOrigem);

wineForm.addEventListener('input', event => {
  marcarAlterado(true);
  event.target.removeAttribute('aria-invalid');
});

function marcarAlterado(alterado) {

  const estado = $('save-state');

  formAlterado = alterado;
  estado.classList.toggle('is-dirty', alterado);
  estado.textContent = alterado
    ? 'Alterações não salvas'
    : editando ? 'Nenhuma alteração' : 'Preencha os dados do novo vinho';

}

// "89.9" → "89,90", "1234" → "1.234,00". Se não der para entender, deixa como está.
function formatarCampoPreco(valor) {

  let numero = valor.replace(/r\$\s*/i, '').replace(/\s/g, '');

  if (!numero) return '';

  if (numero.includes(',')) numero = numero.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(numero)) numero = numero.replace(/\./g, '');

  const convertido = Number(numero);

  if (!Number.isFinite(convertido) || convertido < 0) return valor;

  return convertido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

}

wineForm.elements['Preço'].addEventListener('blur', event => {
  event.target.value = formatarCampoPreco(event.target.value);
});

// Enter pula para o próximo campo em vez de salvar sem querer.
wineForm.addEventListener('keydown', event => {

  if (event.key !== 'Enter' || event.target.tagName !== 'INPUT' || event.target.type === 'file') return;

  event.preventDefault();

  const campos = [...wineForm.querySelectorAll('input[name], select[name]')];
  const proximo = campos[campos.indexOf(event.target) + 1];

  if (proximo) proximo.focus();

});

// Ctrl+S (ou Cmd+S) salva o vinho.
document.addEventListener('keydown', event => {

  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  if (appView.hidden || $('tab-adicionar').hidden) return;

  event.preventDefault();

  if (!salvarBtn.disabled) wineForm.requestSubmit(salvarBtn);

});

// Monta o mesmo card que o catálogo mostra, com os dados do formulário.
function abrirPrevia() {

  const dados = Object.fromEntries(
    [...new FormData(wineForm)].map(([campo, valor]) => [campo, String(valor).trim()])
  );

  const preco = dados['Preço'] ? formatarPreco(formatarCampoPreco(dados['Preço'])) : 'Consulte';
  const foto = !preview.hidden && previewImg.getAttribute('src') ? previewImg.src : './img/logo.png';
  const meta = [dados.Tipo, dados['País']].filter(Boolean).join(' • ') || 'Vinho';
  const detalhe = (rotulo, valor) => `
    <div class="catalog-wine-detail">
      <span>${rotulo}</span>
      <strong>${esc(valor || '—')}</strong>
    </div>`;

  $('previa-card').innerHTML = `
    <article class="catalog-card">
      <div class="catalog-card-image">
        <img src="${esc(foto)}" alt="">
      </div>
      <div class="catalog-card-content">
        <span class="catalog-type">${esc(meta)}</span>
        <h2>${esc(dados.Nome || 'Vinho')}</h2>
        <div class="catalog-wine-details">
          ${detalhe('Uva', dados.Uva)}
          ${detalhe('Safra', dados.Safra)}
          ${detalhe('Tipo', dados.Tipo)}
          ${detalhe('Origem', origem(dados['País'], dados['Região']))}
        </div>
        <div class="catalog-card-bottom">
          <strong>${esc(preco)}</strong>
          <a><i class="fa-brands fa-whatsapp"></i> Pedir</a>
        </div>
      </div>
    </article>`;

  $('previa').showModal();

}

$('abrir-previa').addEventListener('click', abrirPrevia);

// Pergunta antes de jogar fora o que foi digitado.
async function podeDescartar() {

  if (!formAlterado) return true;

  return confirmar({
    titulo: 'Descartar alterações?',
    texto: 'Há informações no formulário que ainda não foram salvas.',
    botao: 'Descartar',
    perigo: true
  });

}

window.addEventListener('beforeunload', event => {
  if (formAlterado && token) event.preventDefault();
});

function lerFormulario() {

  const dados = Object.fromEntries(
    [...new FormData(wineForm)].map(([campo, valor]) => [campo, String(valor).trim()])
  );

  const invalido = (campo, mensagem) => {
    const elemento = wineForm.elements[campo];
    elemento.setAttribute('aria-invalid', 'true');
    elemento.focus();
    throw new Error(mensagem);
  };

  dados['Preço'] = dados['Preço'].replace(/r\$\s*/i, '');

  if (!dados['Nome']) invalido('Nome', 'Informe o nome do vinho.');

  if (dados['Preço'] && !/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(dados['Preço'])) {
    invalido('Preço', 'Preço inválido. Use o formato 89,90.');
  }

  if (dados['Estoque'] && !/^\d+$/.test(dados['Estoque'])) {
    invalido('Estoque', 'O estoque precisa ser um número inteiro.');
  }

  if (dados['Safra'] && !/^\d{4}$/.test(dados['Safra'])) {
    invalido('Safra', 'A safra precisa ter 4 dígitos, como 2021.');
  }

  return dados;

}

function resetarFormulario() {

  wineForm.reset();
  wineForm.querySelectorAll('[aria-invalid]').forEach(campo => campo.removeAttribute('aria-invalid'));
  editando = null;
  formErro.textContent = '';
  removerFundoInput.checked = config.removerFundo;

  $('form-eyebrow').textContent = 'Novo rótulo';
  $('form-titulo').textContent = 'Adicionar vinho';
  $('edit-flag').hidden = true;
  $('cancelar-edicao').hidden = true;
  salvarBtn.textContent = 'Adicionar vinho';

  limparImagem();
  atualizarOrigem();
  marcarAlterado(false);

}

async function editarVinho(vinho) {

  if (!vinho || !await podeDescartar()) return;

  resetarFormulario();
  editando = vinho;

  for (const campo of wineForm.elements) {
    if (!campo.name) continue;

    let valor = vinho[campo.name] ?? '';

    if (campo.name === 'Preço') valor = valor.replace(/r\$\s*/i, '');

    if (campo.tagName === 'SELECT' && valor && ![...campo.options].some(o => o.value === valor)) {
      campo.add(new Option(valor, valor));
    }

    campo.value = valor;
  }

  $('form-eyebrow').textContent = `ID ${vinho.ID}`;
  $('form-titulo').textContent = vinho.Nome || 'Editar vinho';
  $('edit-flag').hidden = false;
  $('cancelar-edicao').hidden = false;
  salvarBtn.textContent = 'Salvar alterações';

  atualizarOrigem();
  limparImagem();
  marcarAlterado(false);
  abrirAba('adicionar');

}

$('cancelar-edicao').addEventListener('click', async () => {
  if (!await podeDescartar()) return;
  resetarFormulario();
  abrirAba('configuracoes');
});

wineForm.addEventListener('submit', async event => {

  event.preventDefault();
  formErro.textContent = '';

  let dados;

  try {
    dados = lerFormulario();
  } catch (e) {
    formErro.textContent = e.message;
    return;
  }

  if (imagem && !imagem.blob) {
    formErro.textContent = 'A imagem ainda está sendo processada ou falhou. Aguarde ou remova a imagem.';
    return;
  }

  const repetido = vinhos.find(v =>
    normalizar(v.Nome) === normalizar(dados.Nome) && String(v.ID) !== String(editando?.ID)
  );

  if (repetido) {
    const continuar = await confirmar({
      titulo: 'Esse vinho já existe',
      texto: `Já há um vinho chamado "${repetido.Nome}" no catálogo (ID ${repetido.ID}). Salvar mesmo assim?`,
      botao: 'Salvar mesmo assim'
    });
    if (!continuar) return;
  }

  const restaurar = carregando(salvarBtn, 'Salvando...');
  const eraEdicao = Boolean(editando);

  try {

    const foto = imagem ? { tipo: 'image/webp', base64: await blobParaBase64(imagem.blob) } : null;

    if (eraEdicao) {
      await api('atualizar', { id: editando.ID, vinho: dados, imagem: foto });
    } else {
      await api('adicionar', { vinho: dados, imagem: foto });
    }

    restaurar();
    resetarFormulario();
    carregarVinhos();

    if (eraEdicao) {
      avisar(`"${dados.Nome}" atualizado.`);
      abrirAba('configuracoes');
    } else {
      avisar(`"${dados.Nome}" adicionado ao catálogo.`);
      wineForm.elements['Nome'].focus();
    }

  } catch (e) {
    restaurar();
    formErro.textContent = e.message;
  }

});


/* =======================================================
   IMAGEM: WEBP + REMOÇÃO DE FUNDO
======================================================= */

function mostrarPreview(src) {

  if (previewUrl && previewUrl !== src) URL.revokeObjectURL(previewUrl);
  previewUrl = src.startsWith('blob:') ? src : null;

  previewImg.src = src;
  preview.hidden = false;
  dropzoneEmpty.hidden = true;
  dropzone.classList.add('has-image');

}

function statusImagem(texto, estado = '') {
  imageStatus.textContent = texto;
  imageStatus.classList.toggle('is-loading', estado === 'carregando');
  imageStatus.classList.toggle('is-error', estado === 'erro');
  dropzone.classList.toggle('is-processing', estado === 'carregando');
}

function limparImagem() {

  versaoImagem++;
  imagem = null;
  imagemInput.value = '';
  limparImagemBtn.hidden = true;
  salvarBtn.disabled = false;

  if (editando?.Imagem) {
    mostrarPreview(editando.Imagem);
    statusImagem('Imagem atual. Escolha outra foto para substituir.');
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  previewImg.removeAttribute('src');
  preview.hidden = true;
  dropzoneEmpty.hidden = false;
  dropzone.classList.remove('has-image');
  statusImagem('');

}

async function carregarArquivo(arquivo) {

  if (!arquivo) return;

  if (!arquivo.type.startsWith('image/')) {
    statusImagem('Esse arquivo não é uma imagem.', 'erro');
    return;
  }

  let original;

  try {
    original = await createImageBitmap(arquivo);
  } catch {
    statusImagem('Não foi possível abrir essa imagem. Tente um JPG ou PNG.', 'erro');
    return;
  }

  imagem = {
    arquivo,
    original,
    jaTransparente: temFundoTransparente(original),
    semFundo: null,
    blob: null
  };

  marcarAlterado(true);
  limparImagemBtn.hidden = false;
  mostrarPreview(URL.createObjectURL(arquivo));

  await gerarImagem();

}

async function gerarImagem() {

  if (!imagem) return;

  const versao = ++versaoImagem;
  const atual = imagem;

  atual.blob = null;
  salvarBtn.disabled = true;

  const status = (texto, estado = 'carregando') => {
    if (versao === versaoImagem) statusImagem(texto, estado);
  };

  try {

    let fonte = atual.original;
    let nota = '';

    if (removerFundoInput.checked && atual.jaTransparente) {
      nota = 'A imagem já não tem fundo.';
    } else if (removerFundoInput.checked) {
      atual.semFundo ??= removerFundo(atual.arquivo, status);
      fonte = await atual.semFundo;
      nota = 'Fundo removido.';
    }

    status('Convertendo para WEBP...');

    const { blob, largura, altura } = await paraWebp(fonte);

    if (versao !== versaoImagem) return;

    atual.blob = blob;
    mostrarPreview(URL.createObjectURL(blob));
    status(`${nota} WEBP ${largura}×${altura}, ${Math.round(blob.size / 1024)} KB.`.trim(), '');

  } catch (e) {

    console.error(e);
    atual.semFundo = null;
    status(`Erro ao processar a imagem: ${e.message}`, 'erro');

  } finally {

    if (versao === versaoImagem) salvarBtn.disabled = false;

  }

}

// Considera "sem fundo" quando boa parte da borda já é transparente.
function temFundoTransparente(bitmap) {

  const escala = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = new OffscreenCanvas(w, h).getContext('2d');

  ctx.drawImage(bitmap, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  let borda = 0;
  let transparentes = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && y !== 0 && x !== w - 1 && y !== h - 1) continue;
      borda++;
      if (data[(y * w + x) * 4 + 3] < 16) transparentes++;
    }
  }

  return transparentes / borda > 0.3;

}

async function removerFundo(arquivo, status) {

  status('Carregando a remoção de fundo...');

  const { removeBackground } = await import(BG_REMOVAL_URL);

  const blob = await removeBackground(arquivo, {
    output: { format: 'image/png' },
    progress: (etapa, atual, total) => {
      if (etapa.startsWith('fetch')) {
        const pct = total ? Math.round((atual / total) * 100) : 0;
        status(`Baixando o modelo de remoção de fundo (só na primeira vez)... ${pct}%`);
      } else {
        status('Removendo o fundo...');
      }
    }
  });

  return createImageBitmap(blob);

}

// Recorta as bordas vazias, reduz para o tamanho máximo e gera WEBP.
async function paraWebp(bitmap) {

  // Reduz antes de recortar para não estourar a memória com fotos de celular.
  const reducao = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * reducao);
  const height = Math.round(bitmap.height * reducao);
  const trabalho = new OffscreenCanvas(width, height);
  const ctx = trabalho.getContext('2d', { willReadFrequently: true });

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) throw new Error('a imagem ficou vazia depois de remover o fundo. Desmarque "Remover fundo".');

  const margem = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  const recorteL = x1 - x0 + 1;
  const recorteA = y1 - y0 + 1;
  const escala = Math.min(1, config.tamanhoMax / (Math.max(recorteL, recorteA) + margem * 2));
  const largura = Math.round((recorteL + margem * 2) * escala);
  const altura = Math.round((recorteA + margem * 2) * escala);

  const saida = new OffscreenCanvas(largura, altura);
  const out = saida.getContext('2d');

  out.imageSmoothingQuality = 'high';
  out.drawImage(trabalho, x0, y0, recorteL, recorteA, margem * escala, margem * escala, recorteL * escala, recorteA * escala);

  const blob = await saida.convertToBlob({ type: 'image/webp', quality: config.qualidade });

  if (blob.type !== 'image/webp') {
    throw new Error('este navegador não gera WEBP. Use Chrome, Edge ou Firefox.');
  }

  return { blob, largura, altura };

}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
}

imagemInput.addEventListener('change', () => carregarArquivo(imagemInput.files[0]));
removerFundoInput.addEventListener('change', gerarImagem);
limparImagemBtn.addEventListener('click', limparImagem);

['dragenter', 'dragover'].forEach(tipo => dropzone.addEventListener(tipo, event => {
  event.preventDefault();
  dropzone.classList.add('dragging');
}));

['dragleave', 'drop'].forEach(tipo => dropzone.addEventListener(tipo, () => {
  dropzone.classList.remove('dragging');
}));

dropzone.addEventListener('drop', event => {
  event.preventDefault();
  carregarArquivo(event.dataTransfer.files[0]);
});


/* =======================================================
   CONFIGURAÇÕES: VINHOS CADASTRADOS
======================================================= */

const FILTROS = {
  'todos': () => true,
  'sem-foto': v => !v.Imagem,
  'sem-preco': v => !v['Preço'],
  'sem-estoque': v => String(v.Estoque).trim() === '0'
};

async function carregarVinhos() {

  if (!vinhosCarregados) {
    wineList.innerHTML = '<li class="wine-list-empty"><span class="spinner"></span>Carregando vinhos...</li>';
  }

  try {
    vinhos = (await api('listar')).vinhos;
    vinhosCarregados = true;
    renderizarVinhos();
  } catch (e) {
    if (!vinhosCarregados) {
      wineList.innerHTML = `<li class="wine-list-empty"><i class="fa-solid fa-triangle-exclamation"></i>${esc(e.message)}</li>`;
    }
  }

}

function etiquetas(v) {

  const lista = [];

  if (!v.Imagem) lista.push('<span class="badge">Sem foto</span>');
  if (!v['Preço']) lista.push('<span class="badge">Sem preço</span>');
  if (String(v.Estoque).trim() === '0') lista.push('<span class="badge badge-danger">Esgotado</span>');

  return lista.length ? `<div class="wine-row-badges">${lista.join('')}</div>` : '';

}

function renderizarVinhos() {

  const termo = normalizar($('busca-admin').value);
  const buscados = vinhos.filter(v => !termo || normalizar(Object.values(v).join(' ')).includes(termo));
  const lista = buscados
    .filter(FILTROS[filtroLista])
    .sort((a, b) => String(a.Nome).localeCompare(String(b.Nome), 'pt-BR'));

  $('list-filters').querySelectorAll('[data-filtro]').forEach(botao => {
    botao.querySelector('b').textContent = buscados.filter(FILTROS[botao.dataset.filtro]).length;
  });

  $('wines-count').textContent = `${vinhos.length} no catálogo`;

  if (!lista.length) {
    wineList.innerHTML = '<li class="wine-list-empty"><i class="fa-solid fa-wine-bottle"></i>Nenhum vinho encontrado.</li>';
    return;
  }

  wineList.innerHTML = lista.map(v => `
    <li class="wine-row">
      <span class="wine-row-thumb">
        ${v.Imagem
          ? `<img src="${esc(v.Imagem)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'), { className: 'fa-solid fa-wine-bottle' }))">`
          : '<i class="fa-solid fa-wine-bottle"></i>'}
      </span>
      <div class="wine-row-info">
        <strong>${esc(v.Nome || 'Sem nome')}</strong>
        <span>${esc([v.Tipo, origem(v.País, v['Região']), v.Safra].filter(Boolean).join(' · ') || 'Sem detalhes')}</span>
        ${etiquetas(v)}
      </div>
      <div class="wine-row-numbers">
        <strong>${esc(formatarPreco(v['Preço']) || '—')}</strong>
        <span class="muted">${v.Estoque !== '' && v.Estoque != null ? `${esc(v.Estoque)} em estoque` : 'Estoque —'}</span>
      </div>
      <div class="wine-row-actions">
        <button type="button" data-editar="${esc(v.ID)}" title="Editar" aria-label="Editar ${esc(v.Nome)}"><i class="fa-solid fa-pen"></i></button>
        <button type="button" data-remover="${esc(v.ID)}" title="Remover" aria-label="Remover ${esc(v.Nome)}"><i class="fa-solid fa-trash"></i></button>
      </div>
    </li>
  `).join('');

}

$('busca-admin').addEventListener('input', renderizarVinhos);

$('list-filters').addEventListener('click', event => {

  const botao = event.target.closest('[data-filtro]');

  if (!botao) return;

  filtroLista = botao.dataset.filtro;
  $('list-filters').querySelectorAll('[data-filtro]').forEach(b => b.classList.toggle('active', b === botao));
  renderizarVinhos();

});

wineList.addEventListener('click', async event => {

  const editar = event.target.closest('[data-editar]');
  const remover = event.target.closest('[data-remover]');

  if (editar) {
    editarVinho(vinhos.find(v => String(v.ID) === editar.dataset.editar));
    return;
  }

  if (!remover) return;

  const vinho = vinhos.find(v => String(v.ID) === remover.dataset.remover);

  const ok = await confirmar({
    titulo: 'Remover vinho?',
    texto: `"${vinho.Nome}" sai do catálogo e da planilha. Isso não pode ser desfeito.`,
    botao: 'Remover',
    perigo: true
  });

  if (!ok) return;

  const linha = remover.closest('.wine-row');

  remover.disabled = true;
  linha.style.opacity = '.45';

  try {
    await api('remover', { id: vinho.ID });
    vinhos = vinhos.filter(v => v !== vinho);
    if (editando?.ID === vinho.ID) resetarFormulario();
    renderizarVinhos();
    avisar(`"${vinho.Nome}" removido.`);
  } catch (e) {
    remover.disabled = false;
    linha.style.opacity = '';
    avisar(e.message, 'erro');
  }

});


/* =======================================================
   CONFIGURAÇÕES: IMAGEM E SENHA
======================================================= */

async function carregarConfig() {
  config = (await api('obterConfig')).config;
}

function aplicarConfig() {

  const { removerFundo, qualidade, tamanhoMax } = configForm.elements;

  removerFundo.checked = config.removerFundo;
  qualidade.value = Math.round(config.qualidade * 100);

  if (![...tamanhoMax.options].some(o => Number(o.value) === config.tamanhoMax)) {
    tamanhoMax.add(new Option(`${config.tamanhoMax} px`, config.tamanhoMax));
  }

  tamanhoMax.value = String(config.tamanhoMax);
  $('qualidade-valor').textContent = `${qualidade.value}%`;

}

configForm.elements.qualidade.addEventListener('input', event => {
  $('qualidade-valor').textContent = `${event.target.value}%`;
});

configForm.addEventListener('submit', async event => {

  event.preventDefault();

  const { removerFundo, qualidade, tamanhoMax } = configForm.elements;
  const restaurar = carregando(event.submitter, 'Salvando...');

  try {
    const resposta = await api('salvarConfig', {
      config: {
        removerFundo: removerFundo.checked,
        qualidade: Number(qualidade.value) / 100,
        tamanhoMax: Number(tamanhoMax.value)
      }
    });
    config = resposta.config;
    aplicarConfig();
    if (!imagem) removerFundoInput.checked = config.removerFundo;
    avisar('Configurações de imagem salvas.');
  } catch (e) {
    avisar(e.message, 'erro');
  } finally {
    restaurar();
  }

});

senhaForm.addEventListener('submit', async event => {

  event.preventDefault();

  const { senhaAtual, novaSenha, confirmarSenha } = senhaForm.elements;
  const erro = $('senha-erro');

  erro.textContent = '';

  if (novaSenha.value.length < 8) {
    erro.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.';
    return;
  }

  if (novaSenha.value !== confirmarSenha.value) {
    erro.textContent = 'As senhas não conferem.';
    return;
  }

  const restaurar = carregando(event.submitter, 'Trocando...');

  try {
    await api('trocarSenha', { senhaAtual: senhaAtual.value, novaSenha: novaSenha.value });
    senhaForm.reset();
    avisar('Senha alterada.');
  } catch (e) {
    erro.textContent = e.message;
  } finally {
    restaurar();
  }

});


/* =======================================================
   INÍCIO
======================================================= */

(async () => {

  if (!token) {
    mostrarLogin();
    return;
  }

  try {
    await carregarConfig();
    mostrarPainel();
  } catch {
    encerrarSessao();
  }

})();
