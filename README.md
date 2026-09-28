# Tempo · Planner digital

Planner web responsivo em React/TypeScript e NestJS, com PostgreSQL, autenticação JWT/Passport e sugestões de agenda por Gemini. **Tempo é um nome provisório.**

## Iniciar localmente

Requisitos: Node.js 22 e Docker com Compose.

```bash
npm ci
cp config/.env.example config/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Cole o valor gerado em `JWT_SECRET` dentro de `config/.env`. Configure `GEMINI_API_KEY` se quiser usar a IA; o restante do planner funciona sem ela. Não versione esse arquivo.

```bash
docker compose up -d db
npm run dev:api
# Em outro terminal:
npm run dev:web
```

Abra http://localhost:5173 e crie uma conta. O banco é inicializado pela API automaticamente. `DATABASE_URL` deve corresponder à porta do PostgreSQL usado.

Para executar toda a aplicação em contêineres:

```bash
docker compose up --build
```

Frontend: http://localhost:8080. API: http://localhost:3000/health. A configuração do Compose define a origem CORS apropriada.

## Validação

```bash
npm run typecheck
npm run build
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Os testes de integração e navegador precisam de PostgreSQL acessível e das variáveis de `config/.env` (ou ambiente). Use um banco separado de produção. Os testes criam usuários com identificadores exclusivos e removem somente esses registros.

## Organização

```text
apps/api/src/       NestJS, auth, usuários, planner e persistência
apps/web/src/       React, calendário, internacionalização e estilos
apps/web/src/assets/  Ilustrações SVG locais
config/            .env.example, .env local ignorado e Nginx
data/              Exemplos JSON públicos
docs/              Arquitetura, API, deploy e decisões
tests/             Testes de domínio, integração e navegador
.github/workflows/ CI e disparo de deploy após validação
```

Consulte [arquitetura](docs/architecture.md), [API](docs/api.md), [publicação](docs/deployment.md) e [escopo/limitações](docs/scope.md).

**Publicação:** os arquivos de deploy estão preparados. A presença desses arquivos não significa que os serviços já foram criados ou publicados. As contas Render/Vercel, a chave Gemini e os hooks precisam ser configurados pelo proprietário.
