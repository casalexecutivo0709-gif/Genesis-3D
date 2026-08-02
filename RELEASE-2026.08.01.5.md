# Genesis 3D 2026.08.01.5

## Resultado

Esta versão melhora o Kanban e o Genesis Insights no desktop, preservando a mesma aplicação, os mesmos dados, as mesmas fórmulas financeiras e o comportamento mobile/PWA.

## Diagnóstico anterior

- O Kanban desktop reutilizava a estrutura visual do celular, comprimindo as colunas e sem uma barra horizontal clara.
- As colunas não possuíam uma área vertical independente para grandes quantidades de cards.
- As ações de status e pagamento exigiam abrir o detalhe do pedido.
- O Insights mantinha proporções de uma tela estreita em monitores largos e o SVG podia distorcer o gráfico.
- A entrada no Insights pelo menu lateral não solicitava a renderização imediata dos dados.

## Implementação

- Quadro com oito colunas, largura consistente, rolagem horizontal visível e rolagem vertical em cada coluna.
- Cabeçalhos de coluna fixos, cards compactos e resumo superior baseado nos filtros atuais.
- Cards com produto, cliente, pedido, canal, quantidade, total, produção, pagamento e prazo.
- Ações reais para abrir, editar, marcar pago, avançar e escolher qualquer etapa.
- Tabela desktop de pedidos recentes ligada aos mesmos filtros do Kanban.
- Insights em grade de doze colunas, seis KPIs, gráfico amplo e cards distribuídos proporcionalmente.
- SVG proporcional com quantidade de rótulos adaptada à largura disponível.
- Atualização dos Insights ao entrar pela navegação desktop.
- Service Worker v34, sem `clients.claim()` e sem `skipWaiting()` automático.

## Arquivos alterados

- `corrigido.html`
- `genesis-workspace.css`
- `service-worker.js`
- `tests/static.test.js`
- `PENDENCIAS.md`
- `README.md`
- `RELEASE-2026.08.01.5.md`

## Testes

- Compilação de todo o JavaScript embutido no HTML.
- `node --check` nos arquivos JavaScript do aplicativo.
- Suíte `node --test tests/*.test.js`.
- Navegador desktop: oito colunas, rolagem horizontal, rolagem vertical, resumo e tabela recente.
- Navegador desktop: abrir, editar, pagamento, avanço e seleção direta de etapa.
- Navegador desktop: persistência de busca e filtros entre Kanban e Lista.
- Navegador desktop: grade do Insights, contraste e proporção do gráfico.
- Navegador mobile: barra inferior fixa, indicador de atualização oculto e ausência dos componentes exclusivos do desktop.

## Dados e atualização

Não houve migração destrutiva nem alteração do schema. A versão continua usando as chaves existentes do `localStorage`, IndexedDB e Google Sheets. Instalar novamente o ícone não é necessário; a atualização utiliza o mesmo endereço.
