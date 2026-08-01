# Pendências — Genesis 3D

Este arquivo registra as solicitações recebidas e o estado da atualização. O aplicativo deve continuar 100% gratuito e preservar os dados locais entre versões.

## Concluídas na versão 2026.08.01.2

### URGENTE — impedir que a imagem do item anterior apareça no novo orçamento

- [x] Ao iniciar um novo item ou orçamento, desvincular e retirar imediatamente da tela a imagem do item anterior.
- [x] Exibir um estado neutro ou a mensagem **“Carregando nova imagem…”** enquanto a imagem correta estiver sendo buscada, processada e salva.
- [x] Vincular a imagem somente se ela pertencer ao item/orçamento atualmente aberto, validando o ID do registro antes de atualizar a tela.
- [x] Cancelar ou ignorar respostas atrasadas de buscas e importações anteriores para impedir que uma imagem antiga substitua a imagem atual.
- [x] Invalidar corretamente o cache de imagem e atualizar o preview assim que a nova imagem estiver pronta.
- [x] Não exigir que o usuário feche, reabra ou atualize manualmente o aplicativo para visualizar a imagem correta.
- [x] Preservar a imagem certa durante todo o fluxo: cálculo, orçamento, edição, kit, pedido, compartilhamento e histórico.
- [x] O gesto de puxar para atualizar deve funcionar como recurso adicional, e não como solução obrigatória para corrigir a imagem.

### Atualização ao puxar a tela para baixo

- [x] Implementar o gesto **puxar para atualizar** (pull-to-refresh), semelhante ao Instagram, quando o usuário estiver no topo da tela.
- [x] Exibir um indicador visual enquanto a atualização estiver acontecendo e uma confirmação discreta ao terminar.
- [x] Atualizar os dados da tela atual, incluindo alterações sincronizadas, sem trocar de página.
- [x] Preservar formulários em edição, imagens, rascunhos, filtros, posição da tela e todo o histórico durante a atualização.
- [x] Impedir atualizações duplicadas caso o usuário puxe a tela várias vezes seguidas.
- [x] Se existir uma nova versão do aplicativo, avisar o usuário e pedir confirmação antes de aplicá-la, sem forçar o recarregamento durante uma edição.

### Edição completa de orçamentos e pedidos

- [x] Ao tocar em **Editar** em um orçamento, voltar à tela inicial completa de criação/cálculo, com todos os dados originais preenchidos.
- [x] Ao tocar em **Editar** em um pedido, voltar ao mesmo fluxo completo de criação/cálculo usado para gerar o orçamento ou pedido.
- [x] Restaurar para edição: produto, tempo de impressão, peso, filamento, quantidade, margem, lucro, custos, preços direto/Shopee, frete, prazo, validade, cliente, foto, cores, observações e links.
- [x] Manter disponíveis todas as funções da calculadora, inclusive recálculo automático de custo, preço e lucro durante a edição.
- [x] Ao salvar, atualizar o orçamento ou pedido original em vez de criar uma duplicata.
- [x] Preservar o mesmo ID, número, imagem, vínculo entre orçamento/pedido/kit, status e histórico da operação.
- [x] Antes de abrir a edição, salvar um rascunho e permitir restauração caso o aplicativo seja fechado ou colocado em segundo plano.
- [x] Para registros históricos com dados incompletos, carregar tudo o que estiver disponível e indicar claramente quais campos precisam ser preenchidos, sem inventar valores.

### Desktop, servidor local e imagens

- [x] Criar modos Automático, Celular e Desktop sem nova aplicação, nova rota ou nova base de dados.
- [x] Adicionar menu lateral, formulário amplo, painel de imagem e prévia do orçamento em tempo real no computador.
- [x] Ampliar o servidor local existente para originais, editadas, otimizadas, miniaturas, biblioteca, versões, status e backup.
- [x] Criar a entidade `Imagens` no IndexedDB e no Google Sheets, salvando apenas metadados e referências na planilha.
- [x] Adicionar fila offline, deduplicação por hash e fallback para IndexedDB quando computador ou Drive estiverem indisponíveis.
- [x] Adicionar seleção, arrastar e soltar, Ctrl + V, biblioteca, imagens recentes, MakerWorld e reutilização de registros anteriores.
- [x] Adicionar menu customizado e editor não destrutivo com recorte, giro, espelhamento, zoom, proporções, desfazer, refazer e restauração do original.
- [x] Preservar rascunho, imagem, enquadramento e fila depois de fechamento inesperado.
- [x] Manter o uso 100% gratuito: servidor próprio, IndexedDB, Google Sheets/Drive opcionais e nenhuma cobrança automática.

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
