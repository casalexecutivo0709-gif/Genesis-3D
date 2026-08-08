# Realtime celular ↔ desktop — plano Spark

O Firebase é opcional e transporta somente eventos pequenos. Google Sheets permanece como banco principal; nenhuma imagem, pedido completo ou dado financeiro é armazenado no Firebase.

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/) e crie um projeto no plano **Spark**. Não vincule conta de faturamento e não migre para Blaze.
2. Em **Authentication → Sign-in method**, ative apenas **Anônimo**.
3. Em **Realtime Database**, crie o banco e escolha a região mais próxima disponível. Não use modo de teste permanente.
4. Na aba **Regras**, substitua o conteúdo por `database.rules.json` desta pasta e publique.
5. Em **Configurações do projeto → Seus apps**, registre um app Web para a origem `https://casalexecutivo0709-gif.github.io`.
6. Copie somente `apiKey` e `databaseURL`. No Genesis, abra **Configurações → Sincronização realtime opcional**, cole esses dois valores e toque em **Gerar** para criar o código privado do espaço.
7. Copie o mesmo `apiKey`, `databaseURL` e código do espaço para o celular e o computador. Depois ative e teste em ambos.

Não coloque essa configuração no repositório. O plano Spark não solicita cartão; ao exceder a cota gratuita, o Realtime Database é interrompido e o Genesis continua offline/Google Sheets sem gerar cobrança.
