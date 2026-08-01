# Diagnóstico técnico — atualização 2026.08.01.1

## Arquitetura encontrada

- Aplicativo monolítico em HTML/JavaScript, hospedado no GitHub Pages e instalado como PWA.
- Dados de negócio eram carregados e regravados como grandes coleções JSON no `localStorage`.
- Imagens já utilizavam `Blob` no IndexedDB, com referências `imageId`, lazy loading e revogação de Object URLs.
- Existia snapshot integral resiliente no IndexedDB e backup opcional no computador.
- Supabase estava presente como cópia integral opcional.
- Service Worker já esperava confirmação do usuário para `skipWaiting`, mas guardava qualquer GET local em um cache sem limite.
- Os Insights liam diretamente os pedidos e possuíam complementos posteriores para Shopee, criando mais de um caminho financeiro.

## Causa provável da tela branca no iPhone

A causa mais consistente com o código e com o desaparecimento posterior de imagens é pressão de memória no Safari/iOS: canvases de alta resolução, Data URLs transitórias, serialização frequente da base completa e cache dinâmico sem limite. Uma exceção ou encerramento da aba pelo iOS podia ocorrer durante essas operações. Não havia evidência de recarga agressiva do Service Worker: a troca de versão já dependia de confirmação.

## Correções aplicadas

- Dados grandes migrados de forma aditiva para registros no IndexedDB.
- Backup de migração criado e validado antes de remover as coleções grandes do `localStorage`.
- Escritas incrementais por coleção, com snapshot integral desacelerado e gravação imediata em segundo plano/fechamento.
- Rascunhos de todas as telas e modais persistidos no IndexedDB, sem campos de senha/token.
- Painel de recuperação com restaurar rascunho, voltar ao início e exportar diagnóstico.
- Cache do Service Worker dividido em estático e temporário, limitado a 60 entradas.
- Atualização continua dependendo de confirmação e espera rascunho/snapshot antes da troca.
- Fonte financeira única em `genesis-finance.js`.
- Pedidos cancelados, recusados, expirados, aguardando pagamento ou Shopee sem repasse confirmado são excluídos dos Insights.
- Kits explodidos em itens, com desconto e taxas proporcionais e fechamento exato dos centavos.
- Custos históricos permanecem como snapshot; lacunas antigas só são preenchidas quando existe cálculo compatível no histórico.
- Shopee continua idempotente pelo ID do pedido e o Excel permanece a fonte financeira prioritária.
- Google Sheets integrado por fila offline, lotes, token, idempotência, retry e conflitos preservados.
- Chapéus de cor agora usam largura fixa de 106 px e começam na esquerda, sem justificar pelo espaço disponível.
- Bloco “Este orçamento inclui…” força alinhamento à esquerda após o desenho dos chapéus.

## Testes executados

- Sintaxe de todos os JavaScripts, script embutido e Google Apps Script.
- Venda direta: bruto 100, taxas 0, faturamento 100, custo 30, lucro 70, margem 70%.
- Venda Shopee: bruto 100, recebido 78, taxas 22, custo 30, lucro 48, margem 61,54%.
- Kit direto: itens 30/40/50 com 10% resultam em 27/36/45 e total 108.
- Kit Shopee: bruto 108, recebido 86,40, taxas 21,60; somas dos itens fecham com a venda.
- Idempotência por ID Shopee e exclusão de status não realizados.
- Abertura real do PWA local sem erros de console.
- Criação de orçamento e geração da arte sem erro.
- Recarregamento após migração: orçamento e rascunho restaurados do IndexedDB.
- A configuração Google Sheets e o contador da fila aparecem no aplicativo.

## Validação externa ainda necessária

A conexão real com uma planilha não pode ser concluída sem a implantação feita na conta Google proprietária. Após seguir `GOOGLE-SHEETS.md`, use **Testar conexão**, **Preparar dados atuais** e **Sincronizar agora** no celular. Essa etapa não exige alteração de código nem novo endereço do aplicativo.
