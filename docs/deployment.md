# Publicação — Render + Vercel

Repositório informado: https://github.com/mc4rvalho/planner-digital.

## 1. GitHub

Enviar a implementação e o `package-lock.json` para `main`. Nunca enviar `config/.env`. O workflow usa o ambiente GitHub `production`, que deve ser criado em Settings → Environments.

## 2. Vercel

Criar a conta, importar o repositório e usar a **raiz do repositório**, não `apps/web`, como Root Directory. `vercel.json` define instalação, build e pasta de saída. Reservar o endereço do projeto e configurar `VITE_API_URL` com a URL HTTPS da API no Render. A variável é incorporada no build; alterá-la exige novo deploy.

## 3. Render

Criar a conta e um Blueprint a partir do `render.yaml`. O arquivo define API Docker, PostgreSQL, segredo JWT gerado e health check. Informar:

- `FRONTEND_URL`: origem HTTPS exata do frontend, sem barra final.
- `GEMINI_API_KEY`: chave obtida no Google AI Studio, inserida somente no Render.
- `GEMINI_MODEL`: `gemini-2.5-flash` como padrão configurável; verificar disponibilidade na conta antes do deploy.

`DATABASE_URL` é ligada ao PostgreSQL do Blueprint. O health check exige banco acessível; o primeiro boot cria o esquema.

O Blueprint usa planos gratuitos para não provisionar recursos pagos implicitamente. Esses planos têm limitações de operação e retenção/expiração; revisar o painel e escolher plano persistente apropriado antes de atender usuários reais. Não existe garantia de disponibilidade, backup ou durabilidade de produção apenas por usar este arquivo.

## 4. CI/CD

A publicação automática pelo Git está desativada em Render (`autoDeployTrigger: off`) e Vercel (`git.deploymentEnabled: false`). O pipeline valida o commit antes de solicitar deploy.

Criar um Deploy Hook para a branch `main` em cada plataforma e cadastrar no ambiente GitHub `production`:

- `RENDER_DEPLOY_HOOK`
- `VERCEL_DEPLOY_HOOK`

Sem os hooks, o job de deploy falha explicitamente; ele não declara publicação bem-sucedida. A primeira configuração dos serviços ocorre nos painéis. Hooks iniciam builds assíncronos: o sucesso do workflow confirma a aceitação da solicitação, não a conclusão do deploy. Verificar logs e URL de saúde nas plataformas.

Hooks publicam o HEAD da branch na hora do disparo; para promoção rigorosa de um SHA específico, evoluir para integração com as APIs/CLI dos provedores. A concorrência do workflow cancela execuções antigas, mas não cancela builds já aceitos pelos provedores.

## 5. Verificação após publicação

Criar uma conta, entrar, adicionar evento, sair/entrar novamente e confirmar persistência. Testar outra conta, geração Gemini, preferências, tela mobile e `/health`. Configurar backups e monitoramento no plano escolhido.

## Referências oficiais consultadas

- [Render Blueprint](https://render.com/docs/blueprint-spec)
- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Configuração de projeto Vercel](https://vercel.com/docs/project-configuration)
- [Saída estruturada Gemini](https://ai.google.dev/gemini-api/docs/structured-output)
