# Google Sheets — configuração do banco Genesis 3D

Esta integração usa apenas serviços com opção gratuita: Google Sheets, Google Drive e Google Apps Script. O Genesis continua funcionando offline mesmo quando a cota diária do Google for atingida; as alterações permanecem na fila do celular e são reenviadas depois.

## 1. Criar o Apps Script

1. Entre em [script.google.com](https://script.google.com/) com a conta proprietária da planilha.
2. Crie um **Novo projeto** chamado `Genesis 3D API`.
3. Substitua o conteúdo de `Code.gs` pelo arquivo [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Em **Configurações do projeto**, marque a opção para mostrar o arquivo de manifesto.
5. Substitua `appsscript.json` pelo arquivo [`google-apps-script/appsscript.json`](google-apps-script/appsscript.json).

## 2. Criar planilha, abas e token

No editor, escolha a função `setupGenesisDatabase` e clique em **Executar**. Autorize o acesso à planilha e ao Drive. A função cria automaticamente:

- Configuracoes
- Produtos
- Filamentos
- Clientes
- Calculos
- Orcamentos
- Orcamento_Itens
- Kits
- Kit_Itens
- Pedidos
- Vendas
- Venda_Itens
- Custos
- Sincronizacao
- Diagnosticos
- Imagens

Depois crie um token aleatório com pelo menos 20 caracteres. No editor, execute uma função temporária como esta uma única vez:

```javascript
function configurarMeuToken() {
  setGenesisToken('COLE-AQUI-UM-TOKEN-ALEATORIO-COM-PELO-MENOS-20-CARACTERES');
}
```

Execute, confirme que funcionou e apague a função temporária. O token fica em **Script Properties**, não no código público do GitHub.

## 3. Implantar como aplicativo da web

1. Clique em **Implantar → Nova implantação**.
2. Selecione **Aplicativo da Web**.
3. Em **Executar como**, escolha **Eu**.
4. Em **Quem pode acessar**, escolha **Qualquer pessoa**. O conteúdo continua protegido pelo token validado no backend.
5. Implante e copie a URL final terminada em `/exec`.

Ao alterar o Apps Script depois, crie uma **nova versão da implantação**. A URL `/exec` continua a mesma.

## 4. Conectar o Genesis

1. Abra o Genesis no celular.
2. Vá a **Mais → Configurações → Google Sheets — banco principal gratuito**.
3. Cole a URL `/exec` e o mesmo token.
4. Toque em **Testar conexão**.
5. Toque em **Preparar dados atuais**. Antes da migração, o Genesis cria backup no IndexedDB e também no computador, se a cópia local estiver ligada.
6. Ative **Sincronizar automaticamente quando houver internet**.
7. Toque em **Sincronizar agora**.

O indicador mostra quantas alterações aguardam envio e o horário do último sucesso. Não apague o ícone da tela inicial nem altere o endereço do GitHub Pages; assim, o IndexedDB e todo o histórico local permanecem na mesma origem.

## Segurança e limites gratuitos

- Nunca coloque o token no repositório, em capturas de tela ou em logs.
- O envio usa lotes de até 60 operações no aplicativo e até 100 na API.
- Imagens completas não são colocadas em células. A aba `Imagens` contém apenas IDs estáveis, hash, dimensões, origem, vínculos, versão, URLs e estado de sincronização.
- A API possui a operação opcional `uploadImage`, que grava a versão otimizada no Drive somente quando **Enviar versão otimizada ao Google Drive** estiver ativado nas configurações.
- O arquivo original permanece no servidor local quando ele estiver configurado; IndexedDB preserva o rascunho, a miniatura e a fila de arquivos ainda não sincronizados.
- O modo privado entrega a imagem pelo Apps Script autenticado. O modo por link facilita o uso fora da rede local, mas só deve ser habilitado quando essa forma de acesso for desejada.
- Se o Google ficar indisponível, não há perda: a fila fica no IndexedDB e usa tentativas com atraso progressivo.
- Operações têm `operation_id`; reenvios não duplicam registros.
- Conflitos de versão não sobrescrevem silenciosamente a cópia existente e são registrados em `Diagnosticos`.

## Validar

Depois do primeiro envio, confirme:

1. A aba `Sincronizacao` contém as operações como `synced`.
2. Pedidos realizados aparecem em `Vendas`.
3. Componentes de kits aparecem separadamente em `Venda_Itens`.
4. Pedidos aguardando pagamento e cancelados não aparecem em `Vendas`.
5. A soma de `faturamento_alocado` dos itens é igual a `faturamento_total` da venda.
6. A aba `Imagens` contém somente metadados e referências, nunca Base64.
7. Ao ativar o Drive, `drive_file_id`, `drive_url` e `sync_status` são atualizados depois do envio.
