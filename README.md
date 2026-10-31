# Vini Vinhos — redesign

Nova versão visual do projeto Vini Vinhos, mantendo a estrutura simples em HTML, CSS e JavaScript e reaproveitando a pasta `img` do repositório original.

## Como usar

1. Copie `index.html`, `catalogo.html`, `style.css` e `script.js` para a raiz do repositório ViniVinhos.
2. Mantenha a pasta `img` atual no mesmo lugar.
3. O catálogo continua buscando os dados da mesma planilha via OpenSheet.
4. Abra `index.html` com Live Server para testar.

## Painel admin

O painel fica em `/admin.html`. Não há link para ele no site, e ele não aparece no Google (`noindex`). O cliente continua vendo só a página inicial e o catálogo.

Depois do login, o painel tem:

- **Adicionar vinho**: Nome, Preço, Estoque, Uva, Safra, Tipo, País e foto. A foto é convertida para WEBP, recortada e tem o fundo removido automaticamente (exceto quando já é transparente). Dá para desligar a remoção de fundo por foto.
- **Configurações**: lista dos vinhos cadastrados (editar e remover), opções de imagem (qualidade do WEBP, tamanho máximo, remover fundo por padrão) e troca de senha.

A planilha continua sendo o banco de dados. Quem grava nela é um Google Apps Script (`apps-script/Code.gs`), que confere a senha antes de qualquer alteração. As fotos novas ficam numa pasta do Google Drive chamada **Vini Vinhos - Imagens**.

### Configurar uma vez

1. Abra a planilha, vá em **Extensões → Apps Script** e cole o conteúdo de `apps-script/Code.gs` no arquivo `Código.gs`. Salve.
2. Em **Configurações do projeto** (ícone de engrenagem) → **Propriedades do script**, adicione a propriedade `ADMIN_SENHA` com a senha que você quer usar (mínimo 8 caracteres). No primeiro login ela é trocada por um hash e apagada.
3. No editor, escolha a função `autorizar` e clique em **Executar**. Aceite as permissões de Planilhas e Drive.
4. Clique em **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Copie a URL que termina em `/exec` e cole em `API_URL`, no topo de `admin.js`.

Sempre que alterar o `Code.gs`, faça **Implantar → Gerenciar implantações → Editar → Nova versão** para a mudança valer.

### Destaques da página inicial

Os 4 cards de destaque da home são os vinhos com mais cliques no botão **Pedir** do catálogo. Cada clique soma 1 na coluna **Cliques** da planilha (criada sozinha pelo Apps Script). Enquanto não houver vinhos clicados suficientes, as vagas são completadas com rótulos sorteados que tenham foto.

- Cada visitante conta no máximo um clique por vinho a cada visita, e cada vinho aceita até 20 cliques por minuto.
- Para zerar o ranking, apague os números da coluna **Cliques**.
- O registro de cliques usa a mesma URL do Apps Script do painel (`API_URL` no topo de `script.js` e de `admin.js`).

### Observações

- Vinhos novos aparecem no catálogo em até cerca de 1 minuto, por causa do cache do OpenSheet.
- A remoção de fundo roda no próprio navegador, sem custo. Na primeira vez ela baixa cerca de 100 MB; depois fica em cache. Use Chrome, Edge ou Firefox (o Safari não gera WEBP).
- A biblioteca de remoção de fundo (`@imgly/background-removal`) é AGPL-3.0. Ela exige que o código do site seja público, então mantenha o repositório aberto no GitHub.
- Ao editar uma foto ou remover um vinho, a foto antiga é apagada do Drive. As fotos da pasta `img/vinhos` nunca são apagadas.

## Melhorias

- visual mais editorial e menos genérico;
- navegação responsiva;
- hero com slider reaproveitando as fotos atuais;
- seção institucional mais limpa;
- cards de destaque sem preços fictícios;
- catálogo com busca + filtros;
- estado de carregamento, vazio e erro no catálogo;
- pedido direto via WhatsApp;
- layout mobile revisado;
- animações discretas, sem elementos decorativos aleatórios.
