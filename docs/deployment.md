# Publicação — Render + Vercel

Repositório informado: https://github.com/mc4rvalho/planner-digital.

## Instância publicada em 29/09/2026

- Frontend: https://planner-digital-rho.vercel.app
- API: https://planner-digital-api.onrender.com
- Saúde da API e banco: https://planner-digital-api.onrender.com/health
- Render: workspace **Tempo - Planner Digital**, serviço `planner-digital-api` e PostgreSQL `planner-digital-db`, região Virginia, planos gratuitos.
- Vercel: projeto `planner-digital`, equipe `mc4rvalhos-projects`, conectado ao repositório.

A primeira publicação foi realizada pelas APIs das plataformas, usando as configurações do repositório. Não foi criado um Blueprint gerenciado: não importe outro Blueprint sem revisar os recursos existentes, para evitar duplicação. O JWT de produção foi gerado separadamente. A chave Gemini foi configurada somente na API. `config/.env` local permanece separado da produção.

SMTP não foi enviado: sua configuração ficou a cargo do proprietário. O Render gratuito bloqueia as portas SMTP 25, 465 e 587; usar SMTP nessas portas exige mudar o plano da API, ou adaptar o aplicativo para envio por HTTPS. O PostgreSQL gratuito expira em 30 dias e não tem backups: escolha um plano persistente antes de depender do sistema para dados reais. Consulte as [limitações do Render](https://render.com/docs/free).

Os deploys iniciais estão publicados, mas o CI/CD descrito abaixo ainda depende de cadastrar os dois Deploy Hooks no ambiente GitHub `production`. Até isso ser feito, novos pushes validam o código, mas a etapa de deploy falha por falta dos secrets.

## 1. GitHub

Enviar a implementação e o `package-lock.json` para `main`. Nunca enviar `config/.env`. O workflow usa o ambiente GitHub `production`, que deve ser criado em Settings → Environments.

## 2. Vercel

Criar a conta, importar o repositório e usar a **raiz do repositório**, não `apps/web`, como Root Directory. `vercel.json` define instalação, build e pasta de saída. Reservar o endereço do projeto e configurar `VITE_API_URL` com a URL HTTPS da API no Render. A variável é incorporada no build; alterá-la exige novo deploy.

## 3. Render

Criar a conta e um Blueprint a partir do `render.yaml`. O arquivo define API Docker, PostgreSQL, segredo JWT gerado e health check. Informar:

- `FRONTEND_URL`: origem HTTPS exata do frontend, sem barra final.
- `GEMINI_API_KEY`: chave obtida no Google AI Studio, inserida somente no Render.
- `GEMINI_MODEL`: `gemini-3.8-flash` como padrão configurável; verificar disponibilidade na conta antes do deploy.

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

O modelo padrão segue a [orientação atual do Google para projetos novos](https://ai.google.dev/gemini-api/docs/deprecations), consultada em 28/09/2026: a família 2.5 tem acesso limitado a usuários anteriores. O identificador pode ser substituído por `GEMINI_MODEL`. A chamada real ainda precisa ser validada com a chave da conta.

Para habilitar recuperação de senha, cadastre também `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` no serviço da API. Consulte [perfil e finanças](account-and-finance.md). Não coloque credenciais SMTP no frontend/Vercel.
