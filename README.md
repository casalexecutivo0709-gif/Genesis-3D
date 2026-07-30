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
- Sincronização opcional entre aparelhos usando Supabase.

O download do arquivo 3D é aberto na página oficial do MakerWorld ou Thingiverse. Login, licença e condições do autor continuam sendo respeitados.

## Serviços necessários

### GitHub

É recomendado para guardar as versões e publicar o aplicativo pelo GitHub Pages. O aplicativo também pode ser hospedado em outro serviço HTTPS, portanto GitHub não é uma dependência técnica obrigatória.

### Cloudflare Worker

É necessário para a pesquisa integrada e para carregar imagens externas de forma confiável no orçamento. Navegadores bloqueiam parte desses acessos diretos por CORS; o Worker faz a ponte segura.

### Supabase

É opcional para uso em apenas um aparelho. É recomendado para login, backup e restauração dos mesmos dados em mais de um celular ou computador.

## Publicar o aplicativo no GitHub Pages

1. Envie todos os arquivos deste diretório para um repositório GitHub.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch principal e a pasta **/(root)**.
5. Salve e aguarde o endereço HTTPS informado pelo GitHub.

O arquivo `index.html` abre automaticamente o aplicativo principal.

## Atualizar o Cloudflare Worker

O projeto já contém `wrangler.jsonc` apontando para o Worker `hello`, usado pelo aplicativo atual.

```powershell
npx wrangler login
npx wrangler secret put THINGIVERSE_ACCESS_TOKEN
npx wrangler deploy
```

O token do Thingiverse é opcional, mas necessário para habilitar a busca nessa fonte. Nunca coloque esse token diretamente no GitHub.

Se o aplicativo for publicado em outro domínio, acrescente somente a origem HTTPS, sem caminho, à variável `ALLOWED_ORIGINS` no `wrangler.jsonc`, separando múltiplas origens por vírgula. Depois execute `npx wrangler deploy` novamente.

Após publicar, teste:

```text
https://SEU-WORKER.workers.dev/health
```

A resposta deve informar `version: 4`, `makerworld: true` e o estado do Thingiverse.

## Ativar sincronização com Supabase

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
- `service-worker.js`: instalação e cache offline.
- `manifest.json`: nome, ícones e aparência da PWA.
- `makerworld-worker.js`: ponte para MakerWorld, Thingiverse e imagens.
- `supabase-schema.sql`: tabela e políticas de segurança da sincronização.

