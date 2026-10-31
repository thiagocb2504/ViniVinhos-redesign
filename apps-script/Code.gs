/* =========================================================
   VINI VINHOS — API DO PAINEL ADMIN
   Google Apps Script publicado como "App da Web".

   - A planilha continua sendo o banco de dados.
   - As imagens (WEBP) ficam numa pasta do Google Drive.
   - A senha do admin fica nas Propriedades do script,
     nunca no código do site.
========================================================= */

const PLANILHA_ID = '139ZqOOfftdnX3RyN6Q0e3QM1vpwJO-Xnvv1Ym-I4QMY';
const ABA = 'Página1';
const PASTA_IMAGENS = 'Vini Vinhos - Imagens';

const CAMPOS = ['Nome', 'Imagem', 'Preço', 'Estoque', 'Uva', 'Safra', 'Tipo', 'País', 'Região'];

// Preenchida só pelo site (botão "Pedir"); o painel não mexe nela.
const COLUNA_CLIQUES = 'Cliques';
const MAX_CLIQUES_POR_MINUTO = 20;

const SESSAO_SEGUNDOS = 6 * 60 * 60;
const MAX_FALHAS_LOGIN = 8;
const BLOQUEIO_SEGUNDOS = 10 * 60;

const CONFIG_PADRAO = {
  removerFundo: true,
  qualidade: 0.85,
  tamanhoMax: 1000
};


/* =========================================================
   ENTRADA
========================================================= */

function doPost(e) {

  let corpo = {};

  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (erro) {
    return resposta({ ok: false, erro: 'Requisição inválida.' });
  }

  try {

    if (corpo.acao === 'login') {
      return resposta(login(corpo.senha));
    }

    // Única ação pública: não precisa de login.
    if (corpo.acao === 'clique') {
      return resposta(registrarClique(corpo.id));
    }

    if (!sessaoValida(corpo.token)) {
      return resposta({ ok: false, erro: 'Sessão expirada. Entre novamente.', sessao: false });
    }

    const acoes = {
      logout: () => logout(corpo.token),
      listar: () => listarVinhos(),
      adicionar: () => adicionarVinho(corpo.vinho, corpo.imagem),
      atualizar: () => atualizarVinho(corpo.id, corpo.vinho, corpo.imagem),
      remover: () => removerVinho(corpo.id),
      trocarSenha: () => trocarSenha(corpo.senhaAtual, corpo.novaSenha),
      obterConfig: () => ({ ok: true, config: obterConfig() }),
      salvarConfig: () => salvarConfig(corpo.config)
    };

    const acao = acoes[corpo.acao];

    if (!acao) {
      return resposta({ ok: false, erro: 'Ação desconhecida.' });
    }

    return resposta(acao());

  } catch (erro) {
    console.error(erro);
    return resposta({ ok: false, erro: erro.message || String(erro) });
  }

}

function doGet() {
  return resposta({ ok: true, servico: 'Vini Vinhos admin' });
}

function resposta(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =========================================================
   LOGIN E SESSÃO
========================================================= */

function login(senha) {

  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('falhas_login') || 0);

  if (falhas >= MAX_FALHAS_LOGIN) {
    return { ok: false, erro: 'Muitas tentativas. Aguarde 10 minutos.' };
  }

  if (!senhaConfere(String(senha || ''))) {
    cache.put('falhas_login', String(falhas + 1), BLOQUEIO_SEGUNDOS);
    return { ok: false, erro: 'Senha incorreta.' };
  }

  cache.remove('falhas_login');

  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('sessao_' + token, '1', SESSAO_SEGUNDOS);

  return { ok: true, token: token };

}

function logout(token) {
  CacheService.getScriptCache().remove('sessao_' + token);
  return { ok: true };
}

function sessaoValida(token) {

  if (!token) return false;

  const cache = CacheService.getScriptCache();

  if (!cache.get('sessao_' + token)) return false;

  // Renova a sessão a cada uso.
  cache.put('sessao_' + token, '1', SESSAO_SEGUNDOS);

  return true;

}

function senhaConfere(senha) {

  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty('ADMIN_HASH');
  const salt = props.getProperty('ADMIN_SALT');

  if (hash && salt) {
    return hashSenha(senha, salt) === hash;
  }

  // Primeiro acesso: senha definida em texto em ADMIN_SENHA.
  // Ao entrar, ela é trocada por um hash e apagada.
  const inicial = props.getProperty('ADMIN_SENHA');

  if (!inicial) {
    throw new Error('Senha do admin não configurada. Defina ADMIN_SENHA nas Propriedades do script.');
  }

  if (senha !== inicial) return false;

  gravarSenha(senha);

  return true;

}

function trocarSenha(senhaAtual, novaSenha) {

  if (!senhaConfere(String(senhaAtual || ''))) {
    return { ok: false, erro: 'Senha atual incorreta.' };
  }

  if (String(novaSenha || '').length < 8) {
    return { ok: false, erro: 'A nova senha precisa ter pelo menos 8 caracteres.' };
  }

  gravarSenha(String(novaSenha));

  return { ok: true };

}

function gravarSenha(senha) {

  const salt = Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();

  props.setProperty('ADMIN_SALT', salt);
  props.setProperty('ADMIN_HASH', hashSenha(senha, salt));
  props.deleteProperty('ADMIN_SENHA');

}

function hashSenha(senha, salt) {

  let bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + senha,
    Utilities.Charset.UTF_8
  );

  for (let i = 0; i < 200; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }

  return Utilities.base64Encode(bytes);

}


/* =========================================================
   PLANILHA
========================================================= */

function aba() {

  const planilha = SpreadsheetApp.openById(PLANILHA_ID);
  const sheet = planilha.getSheetByName(ABA) || planilha.getSheets()[0];

  garantirCabecalhos(sheet);

  return sheet;

}

function garantirCabecalhos(sheet) {

  const ultimaColuna = Math.max(sheet.getLastColumn(), 1);
  const cabecalhos = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0].map(String);
  const faltando = ['ID'].concat(CAMPOS, [COLUNA_CLIQUES]).filter(campo => cabecalhos.indexOf(campo) === -1);

  if (!faltando.length) return;

  let inicio = cabecalhos.length;
  while (inicio > 0 && !cabecalhos[inicio - 1]) inicio--;
  inicio++;
  sheet.getRange(1, inicio, 1, faltando.length).setValues([faltando]);

}

function cabecalhosDe(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function listarVinhos() {

  const sheet = aba();
  const cabecalhos = cabecalhosDe(sheet);
  const linhas = sheet.getLastRow() - 1;

  if (linhas < 1) return { ok: true, vinhos: [] };

  const valores = sheet.getRange(2, 1, linhas, cabecalhos.length).getDisplayValues();

  const vinhos = valores
    .filter(linha => linha.some(valor => valor !== ''))
    .map(linha => {
      const vinho = {};
      cabecalhos.forEach((cabecalho, i) => {
        if (cabecalho) vinho[cabecalho] = linha[i];
      });
      return vinho;
    });

  return { ok: true, vinhos: vinhos };

}

function linhaDoId(sheet, id) {

  const cabecalhos = cabecalhosDe(sheet);
  const colunaId = cabecalhos.indexOf('ID') + 1;
  const linhas = sheet.getLastRow() - 1;

  if (linhas < 1) return -1;

  const ids = sheet.getRange(2, colunaId, linhas, 1).getDisplayValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }

  return -1;

}

function proximoId(sheet) {

  const colunaId = cabecalhosDe(sheet).indexOf('ID') + 1;
  const linhas = sheet.getLastRow() - 1;

  if (linhas < 1) return 1;

  const ids = sheet.getRange(2, colunaId, linhas, 1).getValues()
    .map(linha => Number(linha[0]))
    .filter(numero => !isNaN(numero));

  return (ids.length ? Math.max.apply(null, ids) : 0) + 1;

}

function limparVinho(vinho) {

  const limpo = {};

  CAMPOS.forEach(campo => {
    if (campo === 'Imagem') return;
    limpo[campo] = String((vinho && vinho[campo]) || '').trim().slice(0, 200);
  });

  if (!limpo['Nome']) {
    throw new Error('O nome do vinho é obrigatório.');
  }

  return limpo;

}

function adicionarVinho(vinho, imagem) {

  const dados = limparVinho(vinho);
  const lock = LockService.getScriptLock();

  lock.waitLock(20000);

  try {

    const sheet = aba();
    const cabecalhos = cabecalhosDe(sheet);

    dados['ID'] = proximoId(sheet);
    dados['Imagem'] = imagem ? salvarImagem(imagem, dados['Nome']) : '';

    const linha = cabecalhos.map(cabecalho => cabecalho in dados ? dados[cabecalho] : '');

    sheet.appendRow(linha);

    return { ok: true, vinho: dados };

  } finally {
    lock.releaseLock();
  }

}

function atualizarVinho(id, vinho, imagem) {

  const dados = limparVinho(vinho);
  const lock = LockService.getScriptLock();

  lock.waitLock(20000);

  try {

    const sheet = aba();
    const numeroLinha = linhaDoId(sheet, id);

    if (numeroLinha === -1) {
      throw new Error('Vinho não encontrado. Ele pode ter sido removido da planilha.');
    }

    const cabecalhos = cabecalhosDe(sheet);
    const range = sheet.getRange(numeroLinha, 1, 1, cabecalhos.length);
    const atual = range.getValues()[0];
    const colunaImagem = cabecalhos.indexOf('Imagem');

    if (imagem) {
      apagarImagemDoDrive(atual[colunaImagem]);
      dados['Imagem'] = salvarImagem(imagem, dados['Nome']);
    }

    const nova = cabecalhos.map((cabecalho, i) => cabecalho in dados ? dados[cabecalho] : atual[i]);

    range.setValues([nova]);

    dados['ID'] = id;
    dados['Imagem'] = nova[colunaImagem];

    return { ok: true, vinho: dados };

  } finally {
    lock.releaseLock();
  }

}

function removerVinho(id) {

  const lock = LockService.getScriptLock();

  lock.waitLock(20000);

  try {

    const sheet = aba();
    const numeroLinha = linhaDoId(sheet, id);

    if (numeroLinha === -1) {
      throw new Error('Vinho não encontrado.');
    }

    const colunaImagem = cabecalhosDe(sheet).indexOf('Imagem') + 1;

    apagarImagemDoDrive(sheet.getRange(numeroLinha, colunaImagem).getValue());
    sheet.deleteRow(numeroLinha);

    return { ok: true };

  } finally {
    lock.releaseLock();
  }

}


/* =========================================================
   CLIQUES (destaques da página inicial)
========================================================= */

function registrarClique(id) {

  id = String(id || '').trim();

  if (!/^\d{1,6}$/.test(id)) {
    return { ok: false, erro: 'ID inválido.' };
  }

  // Limita cliques repetidos no mesmo vinho para ninguém inflar o ranking.
  const cache = CacheService.getScriptCache();
  const chave = 'cliques_' + id;
  const recentes = Number(cache.get(chave) || 0);

  if (recentes >= MAX_CLIQUES_POR_MINUTO) {
    return { ok: true, ignorado: true };
  }

  cache.put(chave, String(recentes + 1), 60);

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    return { ok: true, ignorado: true };
  }

  try {

    const sheet = aba();
    const numeroLinha = linhaDoId(sheet, id);

    if (numeroLinha === -1) {
      return { ok: false, erro: 'Vinho não encontrado.' };
    }

    const coluna = cabecalhosDe(sheet).indexOf(COLUNA_CLIQUES) + 1;
    const celula = sheet.getRange(numeroLinha, coluna);

    celula.setValue((Number(celula.getValue()) || 0) + 1);

    return { ok: true };

  } finally {
    lock.releaseLock();
  }

}


/* =========================================================
   IMAGENS NO DRIVE
========================================================= */

function pastaImagens() {

  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA_IMAGENS_ID');

  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (erro) {
      // A pasta foi apagada; cria outra abaixo.
    }
  }

  const pasta = DriveApp.createFolder(PASTA_IMAGENS);
  props.setProperty('PASTA_IMAGENS_ID', pasta.getId());

  return pasta;

}

function salvarImagem(imagem, nome) {

  if (!imagem.base64 || imagem.tipo !== 'image/webp') {
    throw new Error('A imagem precisa chegar em WEBP.');
  }

  const bytes = Utilities.base64Decode(imagem.base64);

  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error('Imagem muito grande (máximo 5 MB).');
  }

  const slug = String(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'vinho';

  const arquivo = pastaImagens().createFile(
    Utilities.newBlob(bytes, 'image/webp', slug + '-' + Date.now() + '.webp')
  );

  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return 'https://lh3.googleusercontent.com/d/' + arquivo.getId();

}

// Só apaga imagens que estão na pasta do painel; as do repositório (img/vinhos) ficam intactas.
function apagarImagemDoDrive(url) {

  const encontrado = String(url || '').match(/googleusercontent\.com\/d\/([\w-]+)/);

  if (!encontrado) return;

  try {

    const arquivo = DriveApp.getFileById(encontrado[1]);
    const pastaId = PropertiesService.getScriptProperties().getProperty('PASTA_IMAGENS_ID');
    const pais = arquivo.getParents();

    while (pais.hasNext()) {
      if (pais.next().getId() === pastaId) {
        arquivo.setTrashed(true);
        return;
      }
    }

  } catch (erro) {
    console.warn('Não foi possível apagar a imagem antiga:', erro);
  }

}


/* =========================================================
   CONFIGURAÇÕES DE IMAGEM
========================================================= */

function obterConfig() {

  const salvo = PropertiesService.getScriptProperties().getProperty('CONFIG_IMAGEM');

  return Object.assign({}, CONFIG_PADRAO, salvo ? JSON.parse(salvo) : {});

}

function salvarConfig(config) {

  const qualidade = Number(config && config.qualidade);
  const tamanhoMax = Number(config && config.tamanhoMax);

  const limpo = {
    removerFundo: Boolean(config && config.removerFundo),
    qualidade: Math.min(Math.max(isNaN(qualidade) ? CONFIG_PADRAO.qualidade : qualidade, 0.5), 1),
    tamanhoMax: Math.min(Math.max(isNaN(tamanhoMax) ? CONFIG_PADRAO.tamanhoMax : Math.round(tamanhoMax), 300), 2400)
  };

  PropertiesService.getScriptProperties().setProperty('CONFIG_IMAGEM', JSON.stringify(limpo));

  return { ok: true, config: limpo };

}


/* =========================================================
   Rode uma vez pelo editor para autorizar o acesso
   à planilha e ao Drive antes de publicar.
========================================================= */

function autorizar() {
  aba();
  pastaImagens();
  console.log('Tudo certo: planilha e pasta de imagens acessíveis.');
}
