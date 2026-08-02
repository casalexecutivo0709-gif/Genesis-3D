# Pendências — Genesis 3D

Este arquivo registra as solicitações recebidas e o estado da atualização. O aplicativo deve continuar 100% gratuito e preservar os dados locais entre versões.

## Pendências abertas — conectividade do Worker e servidor local

### URGENTE — busca de modelos online não conecta ao Worker

- [ ] Investigar por que o teste feito dentro do Genesis informa **“Não foi possível conectar ao Worker”**, mesmo com a URL `https://hello.douglasscaramelli.workers.dev` correta.
- [ ] Registrar no relatório interno o status HTTP, endpoint consultado, origem da página, tempo da requisição e mensagem devolvida pelo Worker, sem registrar tokens ou dados sensíveis.
- [ ] Diferenciar na interface: Worker fora do ar, falha de internet/DNS, bloqueio do navegador, CORS, timeout, versão antiga em cache e resposta inválida.
- [ ] Invalidar com segurança uma configuração antiga armazenada em cache e repetir o teste após atualização do Service Worker, sem apagar orçamentos, pedidos, imagens ou rascunhos.
- [ ] Manter a calculadora funcionando normalmente quando a ponte estiver indisponível e apresentar uma orientação específica para o erro detectado.
- [ ] Revalidar busca, detalhes e importação de imagem do MakerWorld e Thingiverse no PWA instalado, Safari/iPhone e navegador do computador.

**Diagnóstico de 01/08/2026:** o endereço público respondeu `HTTP 200`, identificou o serviço **Genesis 3D Model Bridge v10** e devolveu `Access-Control-Allow-Origin: https://casalexecutivo0709-gif.github.io`. Portanto, o Worker está ativo; a próxima investigação deve se concentrar na requisição feita pelo aplicativo, cache/Service Worker, rede ou bloqueio específico do navegador.

### URGENTE — servidor local mostra “Origem não permitida”

- [ ] Registrar de forma segura qual cabeçalho `Origin` foi realmente recebido pelo servidor quando uma requisição for recusada.
- [ ] Comparar e normalizar a origem recebida com `allowedOrigins`, removendo apenas barra final e mantendo uma lista explícita; não liberar CORS com curinga.
- [ ] Autorizar somente a origem oficial `https://casalexecutivo0709-gif.github.io` e endereços locais necessários para desenvolvimento, preservando autenticação por token.
- [ ] Distinguir claramente na interface: servidor desligado, endereço incorreto, certificado HTTPS não confiável, código de pareamento inválido e origem não autorizada.
- [ ] Não conservar como estado atual uma mensagem antiga de “Origem não permitida” quando o servidor estiver desligado ou não responder.
- [ ] Adicionar ao relatório de erros: origem recebida, URL configurada, versão do servidor, último contato e categoria da falha, sem incluir o código de pareamento.
- [ ] Verificar inicialização automática e mostrar instrução para iniciar o servidor quando a porta `8765` não estiver ativa.
- [ ] Testar a conexão no computador e no celular, dentro e fora da rede local, confirmando que a indisponibilidade nunca interrompe o orçamento nem perde imagens.

**Diagnóstico de 01/08/2026:** o `config.json` já contém a origem oficial correta e TLS configurado. Durante a verificação, não havia nenhum processo escutando a porta `8765`; isso deve aparecer como **“Servidor desligado”**, e não como erro de origem.

## Concluídas na versão 2026.08.01.3

### Experiência e atualização

- [x] Manter o gesto de puxar para atualizar sem deixar o indicador ocupando espaço no estado normal.
- [x] Criar o indicador inicialmente vazio e oculto, exibindo progresso somente durante o gesto.
- [x] Mostrar somente spinner e **“Atualizando...”** durante a atualização e remover texto, altura e classes ao terminar.
- [x] Preservar tela, posição, formulário, rascunho, imagem e filas sem recarregar a página.

### Orçamento e compartilhamento

- [x] Exibir quantidade, valor unitário e total na arte quando houver mais de uma unidade.
- [x] Utilizar exatamente o preço unitário e o total já salvos no snapshot do orçamento, com duas casas decimais.
- [x] Gerar o texto compacto em no máximo seis linhas, sem linhas vazias ou repetição do total.
- [x] Aplicar frete grátis ou valor do frete, prazo e validade com singular/plural correto.
- [x] Preservar o modelo editável das Configurações e acrescentar o campo dinâmico `{CORES}`.
- [x] Manter foto, logotipo, cores, aviso e rodapé dentro das margens da arte compacta.

### Pagamento rápido e clientes

- [x] Adicionar no topo do detalhe do pedido uma área de atualização rápida para produção e pagamento independentes.
- [x] Ao marcar **Pago**, preencher o total salvo, a data local e a data/hora da confirmação, mantendo campos editáveis.
- [x] Ao marcar **Pago parcialmente**, abrir o valor recebido, sugerir a data atual e mostrar o saldo restante sem permitir saldo negativo.
- [x] Salvar no mesmo pedido e refletir em Kanban, detalhes, fila offline, Google Sheets e Insights sem duplicar a venda.
- [x] Preservar a atualização rápida como rascunho no IndexedDB para recuperação depois de fechamento inesperado.
- [x] Filtrar clientes em tempo real ignorando acentos, caixa e espaços extras, com ordenação por relevância.
- [x] Mostrar **“Nenhum cliente encontrado”** e a ação para cadastrar o nome digitado sem criar duplicidade normalizada.

### Imagens e servidor existentes — revalidação

- [x] Revalidar menu customizado por clique, toque, toque prolongado e teclado sem abertura duplicada.
- [x] Manter editor não destrutivo, original, versões, miniatura, rascunho e restauração depois de falha.
- [x] Manter seleção, arrastar e soltar, Ctrl + V, biblioteca, MakerWorld e reutilização de imagem anterior.
- [x] Manter IndexedDB como primeira gravação, servidor local opcional, fila posterior e Drive opcional.
- [x] Confirmar que imagem e metadados continuam ligados ao orçamento e ao pedido real, sem Base64 no Google Sheets.

### Validação

- [x] Validar no navegador o cenário `3 un. x R$ 11,48` com total `R$ 34,44` na mensagem e na arte.
- [x] Validar pagamento integral com preenchimento automático e pagamento parcial com saldo persistente.
- [x] Executar verificação de sintaxe, testes financeiros, testes estruturais e inspeção visual do layout desktop.
- [x] Manter os recursos responsivos do layout celular e o Service Worker sem `skipWaiting()` agressivo.

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
