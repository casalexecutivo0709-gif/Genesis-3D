# Genesis 3D — versão 2026.08.01.4

## Resultado

Esta versão conclui as pendências de conectividade que permaneceram abertas após a atualização de experiência, orçamentos, pagamentos, clientes e imagens da versão 2026.08.01.3. Nenhum cálculo financeiro, orçamento, pedido, imagem, rascunho ou histórico é apagado na migração.

## Diagnóstico e correções

### Worker de modelos

- o Worker público respondeu HTTP 200 como `Genesis 3D Model Bridge` v10;
- a origem oficial `https://casalexecutivo0709-gif.github.io` foi autorizada por CORS;
- a busca MakerWorld retornou modelos com imagem e o detalhe do primeiro modelo respondeu corretamente;
- o teste do app passou a usar `cache: no-store` e parâmetro de invalidação;
- uma sondagem sem CORS diferencia Worker acessível bloqueado pelo navegador de falha de rede/DNS;
- timeout, origem recusada, versão antiga e resposta inválida possuem mensagens e códigos distintos;
- o relatório interno registra endpoint, origem, HTTP, duração e versão, sem tokens.

### Servidor local

- a origem recebida e `allowedOrigins` são normalizadas antes da comparação;
- a lista continua explícita, sem curinga, e mantém autenticação por código de pareamento;
- o servidor v3 devolve `origin_not_allowed` (HTTP 403) e `invalid_pairing_code` (HTTP 401);
- ausência de resposta agora aparece como servidor desligado/inacessível ou certificado não confiável, nunca como um erro de origem reaproveitado;
- a falha continua preservando imagens e fila no IndexedDB;
- o servidor local instalado foi reiniciado na versão 3 e permaneceu ativo na porta 8765.

## Arquivos alterados

- `corrigido.html`
- `genesis-workspace.js`
- `service-worker.js`
- `makerworld-worker.js`
- `genesis-local-server/server.mjs`
- `genesis-local-server/README.md`
- `tests/static.test.js`
- `PENDENCIAS.md`
- `README.md`
- `RELEASE-2026.08.01.4.md`

## Testes realizados

- sintaxe dos scripts externos, Worker e servidor local;
- compilação do script JavaScript embutido no HTML;
- 4 cenários financeiros e idempotência, sem alteração de fórmulas;
- teste estrutural de PWA, IndexedDB, fila offline, Google Sheets, imagens, pagamento rápido e novos diagnósticos;
- Worker público: HTTP 200, CORS oficial, versão 10, MakerWorld e Thingiverse disponíveis;
- busca MakerWorld: 3 resultados, primeiro resultado com imagem e detalhe carregado;
- servidor local v3: origem oficial aceita, origem desconhecida recusada com HTTP 403 e pareamento inválido recusado com HTTP 401.

## Atualização segura

O app sobe para `2026.08.01.4` e o Service Worker para `33-connectivity-20260801`. A atualização usa os mesmos bancos e chaves, é aditiva e não exige remover o ícone da tela inicial. O servidor local continua opcional e gratuito.
