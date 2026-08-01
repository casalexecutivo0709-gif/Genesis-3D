# Genesis 3D

Aplicativo web instalável para orçamento, pedidos e composição de kits de impressão 3D.

## O que funciona

- Calculadora original de custos, margem, venda direta e Shopee.
- Pesquisa no MakerWorld e no Thingiverse.
- Importação automática de nome, imagem, link, tempo e peso quando a fonte fornece esses dados.
- Foto persistida no orçamento, no pedido convertido e nos kits.
- Mensagem automática e arte pronta para compartilhar com o cliente.
- Kits com várias peças, quantidades, desconto, prazo, frete, layout visual e conversão em pedido.
- Uso no celular como PWA e funcionamento offline do conteúdo já salvo.
- Modo de visualização Automático, Celular ou Desktop, usando a mesma aplicação e os mesmos dados sem recarregar a página.
- Área de trabalho desktop com menu lateral, calculadora ampla, painel de foto e prévia do orçamento em tempo real.
- Biblioteca e editor não destrutivo de imagens com recorte, proporção, rotação, espelhamento, zoom, desfazer, refazer e restauração do original.
- Inserção de imagens por seleção, arrastar e soltar, Ctrl + V, MakerWorld, biblioteca, orçamento ou pedido anterior.
- Fila resiliente de imagens no IndexedDB, miniaturas, deduplicação por hash e sincronização posterior com o computador e, opcionalmente, Google Drive.
- Leitura de prints da Shopee com a franquia gratuita do Cloudflare Workers AI e OCR local de reserva, sempre com revisão antes de importar.
- Cópia automática de segurança no IndexedDB para preservar o histórico entre atualizações.
- Espelhamento opcional dos dados e imagens no próprio computador.
- Banco principal gratuito no Google Sheets, com fila offline e API em Google Apps Script.
- Compatibilidade opcional com a sincronização legada do Supabase.

O download do arquivo 3D é aberto na página oficial do MakerWorld ou Thingiverse. Login, licença e condições do autor continuam sendo respeitados.

## Serviços necessários

### GitHub

É recomendado para guardar as versões e publicar o aplicativo pelo GitHub Pages. O aplicativo também pode ser hospedado em outro serviço HTTPS, portanto GitHub não é uma dependência técnica obrigatória.

### Cloudflare Worker

É necessário para a pesquisa integrada e para carregar imagens externas de forma confiável no orçamento. Navegadores bloqueiam parte desses acessos diretos por CORS; o Worker faz a ponte segura.

O reconhecimento visual usa o binding `AI` do Cloudflare Workers AI em **modo gratuito rígido**. O aplicativo limita o uso a 24 prints por dia em cada aparelho e troca automaticamente para o OCR local quando a IA gratuita não estiver disponível. Mantenha a conta no plano Workers Free, sem cadastrar forma de pagamento nem aceitar upgrade.

### Google Sheets + Apps Script

É a opção principal para manter uma cópia central gratuita dos dados. A planilha fica no Google Drive do proprietário e o Apps Script recebe lotes idempotentes, com token configurado fora do repositório.

O aplicativo não depende da planilha para abrir: primeiro grava no IndexedDB e sincroniza quando a internet volta. Veja o passo a passo completo em [`GOOGLE-SHEETS.md`](GOOGLE-SHEETS.md).

### Supabase (legado e opcional)

Foi preservado para quem já o utilizava. Uma nova instalação pode usar apenas Google Sheets, IndexedDB e a cópia opcional no computador.

Se for usado, mantenha o projeto exclusivamente no plano gratuito e sem cobrança automática. O caminho principal sem nuvem continua sendo IndexedDB no celular e a cópia opcional no próprio computador.

## Publicar o aplicativo no GitHub Pages

1. Envie todos os arquivos deste diretório para um repositório GitHub.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch principal e a pasta **/(root)**.
5. Salve e aguarde o endereço HTTPS informado pelo GitHub.

O arquivo `index.html` abre automaticamente o aplicativo principal.

## Atualizar o Cloudflare Worker

O projeto já contém `wrangler.jsonc` apontando para o Worker `hello`, usado pelo aplicativo atual.

O Worker está conectado ao repositório pelo Cloudflare Workers Builds. Cada alteração
mesclada na branch `main` executa automaticamente `npx wrangler deploy`. A opção
`keep_vars` preserva as variáveis configuradas no painel, mantendo credenciais fora
do GitHub.

```powershell
npx wrangler login
npx wrangler secret put THINGIVERSE_ACCESS_TOKEN
npx wrangler deploy
```

O token do Thingiverse é opcional, mas necessário para habilitar a busca nessa fonte.
O Workers AI não precisa de chave no celular ou no GitHub: o binding `AI` já está declarado no `wrangler.jsonc`. A variável `ZERO_COST_MODE=strict-free` impede que o endpoint de IA funcione fora da arquitetura aprovada de custo zero.

Se o aplicativo for publicado em outro domínio, acrescente somente a origem HTTPS, sem caminho, à variável `ALLOWED_ORIGINS` no `wrangler.jsonc`, separando múltiplas origens por vírgula. Depois execute `npx wrangler deploy` novamente.

Após publicar, teste:

```text
https://SEU-WORKER.workers.dev/health
```

A resposta deve informar `version: 10`, `zeroCostMode: true`, `makerworld: true` e os estados do Thingiverse e da IA Shopee.

## Guardar cópia no próprio computador

O diretório [`genesis-local-server`](genesis-local-server/) contém o servidor sem dependências externas que guarda snapshots, originais, versões editadas, miniaturas e a biblioteca de imagens dentro do computador.

1. Abra o README dessa pasta e configure HTTPS para a rede local.
2. Execute `start-server.cmd`.
3. No aplicativo, abra **Mais → Configurações → Cópia no seu computador**.
4. Informe o endereço HTTPS e o código de pareamento.
5. Teste e ative a cópia automática.

No desktop também é possível usar **Sincronizar imagens**, **Abrir pasta de imagens**, **Fazer backup agora** e **Biblioteca de imagens**. Se o computador estiver desligado, a foto permanece no IndexedDB e entra na fila; o orçamento pode ser salvo normalmente e a sincronização acontece quando o servidor voltar.

Atualizar o aplicativo no mesmo endereço não apaga `localStorage` nem IndexedDB. O Service Worker também só instala a nova versão depois da confirmação do usuário. A cópia no computador oferece recuperação adicional caso os dados do site sejam apagados manualmente ou pelo sistema.

## Ativar sincronização com Google Sheets

1. Siga [`GOOGLE-SHEETS.md`](GOOGLE-SHEETS.md) para criar a planilha e implantar o Apps Script.
2. No aplicativo, abra **Mais → Configurações → Google Sheets**.
3. Informe a URL terminada em `/exec` e o token criado por você.
4. Toque em **Testar conexão** e depois em **Preparar dados atuais**.
5. Ative a sincronização automática.

## Ativar sincronização legada com Supabase

1. Crie um projeto no Supabase.
2. Abra o **SQL Editor** e execute todo o arquivo `supabase-schema.sql`.
3. No aplicativo, abra **Mais → Configurações**.
4. Informe o **Project URL** e a chave **anon/public**.
5. Cadastre o e-mail, entre na conta e envie os dados para a nuvem.

Use apenas a chave pública no aplicativo. A chave `service_role` nunca deve ser colocada no HTML.

## Instalar no celular

### iPhone

1. Abra o endereço HTTPS no Safari.
2. Toque em **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.
4. Ative **Abrir como App da Web** e toque em **Adicionar**.

### Android

1. Abra o endereço HTTPS no Chrome.
2. Abra o menu de três pontos.
3. Toque em **Instalar app** ou **Adicionar à tela inicial**.

## Arquivos principais

- `corrigido.html`: aplicativo.
- `genesis-finance.js`: fonte única dos cálculos de vendas, taxas, kits e Insights.
- `genesis-data.js`: IndexedDB, rascunhos, fila offline, migração e Google Sheets.
- `genesis-workspace.js`: modo desktop, biblioteca, editor, versões e sincronização resiliente de imagens.
- `genesis-workspace.css`: organização responsiva para celular e desktop.
- `service-worker.js`: instalação e cache offline.
- `manifest.json`: nome, ícones e aparência da PWA.
- `makerworld-worker.js`: ponte para MakerWorld, Thingiverse e imagens.
- `genesis-local-server/`: cópia opcional no próprio computador.
- `google-apps-script/`: API e criação automática da planilha Google.
- `supabase-schema.sql`: tabela e políticas de segurança da sincronização.

