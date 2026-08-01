# Pendências — Genesis 3D

Este arquivo registra as solicitações recebidas e o estado da atualização. O aplicativo deve continuar 100% gratuito e preservar os dados locais entre versões.

## Concluídas na versão 2026.08.01.1

- [x] Criar fonte financeira única para venda direta, Shopee, kits e Genesis Insights.
- [x] Excluir de faturamento e lucro os pedidos não realizados, não pagos, cancelados, recusados e expirados.
- [x] Calcular taxas Shopee como venda bruta menos valor efetivamente recebido, sem descontar duas vezes.
- [x] Explodir kits nos componentes e fechar desconto, taxas, faturamento, custos e lucro até o último centavo.
- [x] Preservar custos históricos como snapshot e impedir recálculo por preços atuais.
- [x] Criar as 15 abas do Google Sheets e a API completa em Google Apps Script.
- [x] Adicionar configuração, teste, migração, fila offline, sincronização manual e automática no aplicativo.
- [x] Migrar coleções grandes para IndexedDB com backup e validação anteriores.
- [x] Persistir rascunhos gerais e criar painel de recuperação amigável.
- [x] Limitar cache temporário do Service Worker e manter atualização somente após confirmação.
- [x] Manter o servidor local como backup opcional, sem torná-lo obrigatório.
- [x] Fixar a barra inferior e preservar sua posição durante a navegação e abertura de modais.
- [x] Manter a leitura Shopee pelo login exibido e a revisão híbrida Excel + OCR/IA gratuita.
- [x] Alinhar os chapéus coloridos à esquerda com espaçamento fixo, sem esticar para preencher o card.
- [x] Corrigir o alinhamento do texto “Este orçamento inclui…” nas artes de item e kit.
- [x] Documentar implantação, segurança, diagnóstico e testes.

## Etapa externa necessária

- [ ] O proprietário deve implantar `google-apps-script/Code.gs` na própria conta Google e informar a URL `/exec` e o token em **Mais → Configurações**. O código está pronto; essa autorização não pode ser criada publicamente pelo GitHub.

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

- O schema local passa de 22 para 23 por migração aditiva e validada.
- Nenhuma rotina de limpeza ou recriação do histórico é executada durante a atualização.
- Orçamentos antigos sem o campo de cores continuam compatíveis.
- O Service Worker mantém a navegação atual e atualiza os arquivos sem trocar o endereço do aplicativo.
