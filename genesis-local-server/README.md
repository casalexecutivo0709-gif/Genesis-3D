# Cópia local do Genesis 3D

Este pequeno servidor guarda os dados e as imagens dentro da pasta `GenesisData` do próprio computador. Ele não envia o conteúdo para uma nuvem.

## Primeira execução

1. Instale o Node.js LTS no computador.
2. Clique duas vezes em `start-server.cmd`.
3. Na primeira execução será criado o arquivo privado `config.json` e será mostrado um código de pareamento.
4. Configure um certificado HTTPS confiável em `tls.pfxPath` ou, preferencialmente, em `tls.certPath` e `tls.keyPath`. O Safari bloqueia conexões HTTP iniciadas pelo aplicativo HTTPS.
5. No Genesis, abra **Mais → Configurações → Cópia no seu computador**, informe o endereço HTTPS e o código de pareamento.

O arquivo `config.json`, o certificado e a pasta `GenesisData` não devem ser publicados no GitHub.

## HTTPS na rede local

Use um certificado válido para o nome ou endereço pelo qual o iPhone acessará o computador. Uma opção prática é criar uma autoridade local com `mkcert`, instalar essa autoridade também no iPhone e gerar um arquivo PFX para o nome do computador. Depois informe o caminho do PFX e sua senha no `config.json`.

O certificado precisa aparecer como confiável no iPhone em **Ajustes → Geral → Sobre → Ajustes de Confiança de Certificados**. O computador e o iPhone devem estar na mesma rede.

## Recuperação

O servidor mantém:

- a última cópia completa de cálculos, orçamentos, pedidos, kits e configurações;
- até 30 cópias anteriores;
- cada imagem pelo seu `imageId`, sem duplicar a imagem dentro dos pedidos.

O botão **Restaurar do computador** baixa a última cópia e recupera também as imagens referenciadas.

## Biblioteca e versões de imagens

A versão 2 amplia este mesmo servidor, sem criar outro serviço. As imagens ficam em `GenesisData/images/<image_id>/`, separadas por identificador estável:

- `original`: arquivo recebido sem sobrescrita;
- `edited`: versão derivada pelo editor;
- `optimized`: cópia leve usada no orçamento;
- `thumbnail`: miniatura para listas e biblioteca;
- `metadata.json`: nome seguro, hash, dimensões, origem e vínculos.

Os nomes enviados pelo navegador nunca controlam o caminho no disco. O servidor valida token, origem, tipo MIME, assinatura do arquivo, limite de tamanho e identificadores para bloquear path traversal. O padrão é 25 MB por arquivo e pode ser ajustado com `maxImageBytes` no `config.json`.

## Endpoints da versão 3

- `GET /health`: conexão e versão do servidor;
- `GET /v1/status`: imagens, espaço utilizado, fila e último backup;
- `GET /v1/images`: biblioteca local pesquisável;
- `POST /v1/images/:image_id`: recebe original, editada, otimizada ou miniatura;
- `GET /v1/images/:image_id`: entrega a melhor variante disponível;
- `GET /v1/images/:image_id/meta`: metadados e versões;
- `POST /v1/folder/open`: abre a pasta de imagens no próprio computador, se `allowOpenFolder` estiver ativo;
- `POST /v1/snapshots` e `GET /v1/snapshots/latest`: backup e restauração dos dados.

Todos os endpoints exigem o código de pareamento. O servidor deve permanecer restrito a `localhost` ou à rede local; não encaminhe a porta 8765 no roteador e não publique essa porta na internet.

## Diagnóstico de conexão

A versão 3 normaliza as origens configuradas, registra de forma segura a origem recusada e devolve códigos distintos sem expor o pareamento:

- **Servidor desligado/inacessível**: confirme que `start-server.cmd` está aberto, que a porta 8765 foi liberada na rede privada e que celular e computador estão na mesma rede;
- **Certificado HTTPS não confiável**: abra o endereço do servidor no Safari e confirme que o certificado instalado aparece como confiável;
- **Código de pareamento inválido**: copie novamente o código do `config.json` local;
- **Origem não autorizada**: mantenha `https://casalexecutivo0709-gif.github.io` em `allowedOrigins`.

Uma falha de rede não é mais conservada como “Origem não permitida”. O aplicativo mantém orçamento, imagem e fila no IndexedDB enquanto o servidor estiver indisponível.

## Atualizar o servidor

Depois de baixar uma nova versão do Genesis, feche a janela antiga do servidor e execute novamente `start-server.cmd`. A pasta `GenesisData`, o `config.json`, os certificados, as imagens e os backups não são apagados durante a atualização.
