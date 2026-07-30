# Genesis 3D — regra permanente de custo zero

O Genesis 3D deve permanecer 100% gratuito para o proprietário e para os usuários.

## Regras obrigatórias

- Não adicionar APIs, bancos, hospedagens, plugins ou serviços que possam gerar cobrança por uso, assinatura, excedente ou ativação automática.
- Não solicitar cartão ou plano pago como requisito de funcionamento.
- Toda integração externa deve funcionar no plano gratuito com limite rígido. Ao atingir o limite, a operação deve falhar com segurança e usar uma alternativa local gratuita.
- Preferir processamento no navegador, IndexedDB, arquivos no próprio computador e software de código aberto.
- Recursos de IA devem usar processamento local ou franquias gratuitas que, no plano configurado, bloqueiem o uso excedente em vez de cobrar.
- Nunca migrar, habilitar ou recomendar automaticamente um plano pago.
- Antes de publicar uma nova dependência externa, confirmar na documentação atual se existe risco de cobrança.
- Se uma função não puder ser oferecida sem custo, desativá-la e explicar claramente a limitação ao usuário.

## Arquitetura de fallback

Serviço gratuito com limite → processamento local → preenchimento manual.

Nenhum erro de limite pode apagar rascunhos, imagens, cálculos, orçamentos, kits ou pedidos.
