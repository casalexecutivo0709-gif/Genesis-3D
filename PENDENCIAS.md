# Pendências — Genesis 3D

Este arquivo registra as solicitações recebidas e o estado da atualização. O aplicativo deve continuar 100% gratuito e preservar os dados locais entre versões.

## Concluídas na versão 2026.07.30.9

- [x] Usar a silhueta exata do chapéu Genesis para representar as cores disponíveis.
- [x] Tingir automaticamente cada chapéu conforme o nome da cor cadastrada no filamento.
- [x] Aplicar contorno branco nas cores escuras, especialmente no preto, para manter a leitura no fundo preto.
- [x] Exibir os chapéus coloridos tanto no orçamento individual quanto no orçamento de kit.
- [x] Adicionar a seleção opcional de cores também ao compositor de kits.
- [x] Manter a seção totalmente oculta nas artes quando nenhuma cor estiver selecionada.
- [x] Salvar as cores do kit e preservá-las ao converter o kit em pedido.

## Concluídas na versão 2026.07.30.8

- [x] Remover a faixa preta externa da logo no cabeçalho, preservando a mesma arte do ícone instalado na tela inicial.
- [x] Aplicar o mesmo recorte da logo nas artes de orçamento.
- [x] Priorizar o login exato exibido ao lado do avatar nos prints da Shopee, como `hugohackenhaar627`.
- [x] Fazer uma segunda leitura gratuita focada no login quando a primeira análise não conseguir identificá-lo.
- [x] Adicionar seleção opcional de cores a partir dos filamentos cadastrados.
- [x] Não exibir nenhuma informação de cor quando nenhuma cor for selecionada.
- [x] Salvar as cores no orçamento, no rascunho automático e no pedido convertido.
- [x] Exibir as cores escolhidas na arte e na mensagem compartilhada.
- [x] Reduzir os espaços e a altura da arte de orçamento de item avulso.

## Regra de atualização e dados

- O schema local permanece na versão 22 nesta atualização.
- Nenhuma rotina de limpeza ou recriação do histórico é executada durante a atualização.
- Orçamentos antigos sem o campo de cores continuam compatíveis.
- O Service Worker mantém a navegação atual e atualiza os arquivos sem trocar o endereço do aplicativo.
