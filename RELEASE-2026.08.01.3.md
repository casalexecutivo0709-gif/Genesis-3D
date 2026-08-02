# Genesis 3D — versão 2026.08.01.3

## Diagnóstico anterior

- O indicador de puxar para atualizar era criado com texto e `display:flex`, mesmo sem gesto. Uma classe ou transformação residual podia mantê-lo visível no topo.
- A mensagem comercial do compositor e a mensagem do compartilhamento usavam implementações separadas. A versão de compartilhamento ainda tinha linhas vazias e não apresentava valor unitário em quantidades maiores.
- O detalhe do pedido permitia trocar apenas o status de produção; o pagamento continuava restrito ao formulário completo.
- A busca de clientes usava `toLowerCase().includes()`, sem normalização de acentos nem ordenação de relevância.
- O menu e o editor de imagens já existiam e estavam ligados ao IndexedDB/servidor, mas toque prolongado seguido de clique podia abrir o menu duas vezes.

## Alterações implementadas

- Indicador de atualização criado vazio, com `hidden`, sem altura e sem texto no estado normal.
- Uma única função gera a mensagem padrão do compositor e do compartilhamento.
- Arte individual mostra `quantidade × valor unitário` e `TOTAL A PAGAR` quando a quantidade é maior que um.
- Pagamento rápido salva no mesmo objeto do pedido, usando o total histórico salvo e a fila idempotente já existente.
- Rascunho do pagamento rápido é persistido pelo mesmo fluxo IndexedDB dos demais formulários.
- Busca de clientes normaliza acentos, caixa e espaços, classifica resultados e oferece cadastro quando não há correspondência.
- Supressão temporária do clique após toque prolongado/contextmenu evita menus duplicados.
- Versão do aplicativo atualizada para `2026.08.01.3` e cache do Service Worker para `v32`, mantendo atualização somente após confirmação.

## Arquivos alterados

- `corrigido.html`
- `genesis-workspace.js`
- `genesis-workspace.css`
- `service-worker.js`
- `tests/static.test.js`
- `PENDENCIAS.md`
- `README.md`
- `RELEASE-2026.08.01.3.md`

## Testes realizados

- Sintaxe de todo o JavaScript inline e dos módulos principais: aprovado.
- Testes financeiros automatizados: quatro cenários aprovados, incluindo idempotência.
- Testes estruturais PWA/IndexedDB/Google Sheets/servidor/imagens: aprovados.
- Orçamento de três unidades: `3 un. x R$ 11,48` e `Total a pagar: R$ 34,44` confirmados na mensagem e na arte.
- Mensagem padrão: seis linhas, sem linhas vazias, frete grátis, produção e validade confirmados.
- Pagamento integral: total `R$ 20,06`, data local e saldo `R$ 0,00` confirmados.
- Pagamento parcial: recebido `R$ 5,00`, saldo `R$ 15,06` e status parcial persistidos.
- Arte desktop: foto preservada, hierarquia financeira correta, aviso e rodapé dentro das margens.
- Estado normal do pull-to-refresh: `hidden=true`, texto vazio e sem classe de exibição.

## Configuração adicional

Nenhum serviço pago ou nova chave é necessário. Google Sheets, Google Drive, Worker e servidor local continuam opcionais ou no fluxo gratuito já configurado. O servidor local não é necessário para o aplicativo abrir ou salvar um orçamento.
