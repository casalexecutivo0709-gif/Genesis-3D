# Validação final — Genesis 3D

Data: 2026-08-09  
Objetivo: estabilidade e correção somente de bugs reproduzíveis, mantendo custo mensal de R$ 0.

## Validação automatizada

- [x] OCR Shopee com pedido completo, cortado, uma ou várias unidades, variação, valores, frete, desconto, login e conflitos.
- [x] Datas numéricas e datas Shopee em português, como `16 de jul 2026`.
- [x] OCR de baixa confiança permanece na etapa de revisão e não inventa ID ausente.
- [x] Rascunho salvo antes do seletor de arquivos e recuperação em `visibilitychange`, `pagehide`, `pageshow` e `focus`.
- [x] Proteção contra imagem antiga, liberação de Object URLs e Canvas.
- [x] Fila, deduplicação, idempotência, realtime e conflitos simulados.
- [x] Fallback de thumbnail/imagem do Drive e ausência de Base64 no Google Sheets.
- [x] Orçamento individual, quantidade maior que um, kit, cores e mensagem compacta.
- [x] Atualização PWA sob confirmação, sem `clients.claim()` ou `skipWaiting()` automático.
- [x] Servidor local: HTTPS, autenticação, CORS, imagens, backup e leitura de restauração.
- [x] Worker: origem oficial, OPTIONS e bloqueio de origem desconhecida.
- [x] Worker ao vivo: buscas MakerWorld e Thingiverse retornaram resultados reais; busca curta retornou erro controlado.
- [x] Interface local atual: 390 px, 844 px horizontal, 1024 px e 1440 px, sem erro de console ou overflow horizontal.
- [x] Oito ciclos de abrir/fechar modal, sem overlay residual, desfoque, Canvas ou Object URL crescente.
- [x] Supabase ausente do código ativo.

## Checklist no aparelho real

- [ ] OCR Shopee — **TESTE MANUAL NECESSÁRIO** com prints reais claros, cortados e levemente desfocados.
- [ ] Biblioteca de fotos iPhone — **TESTE MANUAL NECESSÁRIO**.
- [ ] Editor de imagem no iPhone — **TESTE MANUAL NECESSÁRIO**.
- [ ] Rascunho após colocar o Safari/PWA em segundo plano — **TESTE MANUAL NECESSÁRIO**.
- [ ] Tela branca durante uso prolongado — **TESTE MANUAL NECESSÁRIO**.
- [ ] Scroll rápido e ciclos de abrir/fechar modais — **TESTE MANUAL NECESSÁRIO**.
- [ ] Sync celular → PC — **TESTE MANUAL NECESSÁRIO**.
- [ ] Sync PC → celular — **TESTE MANUAL NECESSÁRIO**.
- [ ] Offline → online, confirmando fila final igual a zero — **TESTE MANUAL NECESSÁRIO**.
- [ ] Conflito real no mesmo pedido em dois aparelhos — **TESTE MANUAL NECESSÁRIO**.
- [ ] Drive: abrir orçamento antigo sem imagem no cache local — **TESTE MANUAL NECESSÁRIO**.
- [ ] Orçamento WhatsApp no iPhone — **TESTE MANUAL NECESSÁRIO**; o Genesis não envia automaticamente.
- [ ] PWA update mantendo histórico, imagens e configurações — **TESTE MANUAL NECESSÁRIO**.
- [x] Servidor local — validado automaticamente neste computador.
- [x] MakerWorld — busca real validada diretamente no Worker; importação na interface publicada permanece manual.
- [x] Thingiverse — busca real validada diretamente no Worker; importação na interface publicada permanece manual.

## Bugs reproduzidos e corrigidos

- Data Shopee escrita por extenso não era convertida para a data do pedido.
- Login do comprador podia perder o prefixo `cliente` e uma linha vizinha podia ser confundida com ID do pedido.
- A calculadora desktop transbordava horizontalmente em 1024 px; o painel lateral agora quebra para baixo.

## Roteiro manual curto

1. Criar um orçamento no celular, preencher todos os campos e escolher uma foto.
2. Recortar a foto, voltar ao formulário e confirmar que nenhum campo foi perdido.
3. Salvar e confirmar no computador; alterar status no computador e confirmar no celular.
4. Repetir offline, voltar online e conferir o indicador `Sincronizado` e fila `0`.
5. Alterar o mesmo pedido nos dois aparelhos e testar as três opções de conflito.
6. Abrir um orçamento antigo, compartilhar no WhatsApp e conferir imagem, valores, cores e texto.
7. Atualizar a PWA quando houver aviso e confirmar que o histórico permaneceu.

## Apps Script antigo

O Genesis atual utiliza o projeto da conta `casalexecutivo0709@gmail.com`. O projeto duplicado da outra conta não é dependência do aplicativo e pode ser excluído manualmente depois de conferência do proprietário.
