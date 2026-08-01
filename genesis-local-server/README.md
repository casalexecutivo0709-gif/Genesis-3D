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
