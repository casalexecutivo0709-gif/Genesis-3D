# Google Sheets e Google Drive — configuração gratuita

Esta integração usa a própria conta Google do usuário, sem Google Cloud Billing e sem API paga. As imagens ficam na pasta `Genesis 3D — Imagens`; a planilha recebe apenas IDs, URLs e metadados.

1. Abra o projeto existente em [script.google.com](https://script.google.com/) e substitua `Code.gs` e `appsscript.json` pelos arquivos desta pasta.
2. Execute `setupGenesisDatabase('Genesis 3D — Banco de Dados', 'SEU_TOKEN_ALEATORIO')` uma vez. O token deve ter ao menos 20 caracteres e não deve ser salvo no GitHub.
3. Autorize somente as permissões solicitadas para Planilhas e Drive. A função cria automaticamente a planilha e a pasta de imagens.
4. Em **Implantar → Nova implantação → Aplicativo da Web**, selecione **Executar como: você** e o acesso compatível com chamadas do aplicativo (`Qualquer pessoa`, protegido pelo token do Genesis).
5. Copie a URL terminada em `/exec`. No Genesis, informe essa URL e o mesmo token em **Configurações → Google Sheets**.
6. Teste a conexão. Depois ative **Enviar versão otimizada ao Google Drive** na seção de imagens.

Ao publicar uma atualização de `Code.gs`, crie uma nova versão da implantação mantendo a mesma URL. Se a cota gratuita do Drive ou Apps Script for atingida, a fila permanece no IndexedDB e nenhuma cobrança é habilitada.
