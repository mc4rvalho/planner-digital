# Arquitetura

## Componentes

O monorepositório usa npm workspaces. React/Vite entrega uma SPA responsiva; NestJS expõe uma API JSON independente do cliente. Isso permite conectar um futuro app móvel à mesma API sem reescrever autenticação e regras de agenda.

PostgreSQL armazena usuários, preferências e eventos. A criação inicial das tabelas é idempotente, transacional e protegida por advisory lock. Evoluções usam as migrações versionadas de `database/migrations.ts`, registradas em `schema_migrations`; `CREATE TABLE IF NOT EXISTS` permanece apenas para o esquema inicial.

## Autenticação

A estrutura segue o Auth Guard fornecido: `bcrypt/`, `constants/`, `controllers/`, `entities/`, `guard/`, `services/`, `strategy/` e `auth.module.ts`. Passport Local aceita `usuario` (e-mail) e `senha`. JWT usa `sub` como UUID imutável do usuário, algoritmo HS256, issuer/audience fixos e validade de uma hora.

A chave não fica no código. `JWT_SECRET` exige no mínimo 32 caracteres. O segredo de exemplo enviado na conversa não é usado. Senhas são hasheadas com bcrypt (custo 12); o cadastro valida comprimento mínimo e limite de 72 bytes do algoritmo. Senhas/hashes não entram nas respostas. Falhas de login usam uma mensagem uniforme.

O cliente mantém o token apenas em memória; atualizar a página exige novo login. Logout descarta o token localmente, mas não revoga cópias de tokens já emitidos. Troca e recuperação de senha incrementam `token_version`, invalidando JWTs anteriores. Recuperação usa token aleatório com hash, validade e consumo único. Refresh tokens e confirmação de e-mail são evoluções futuras.

## Isolamento e agenda

Todas as consultas de eventos restringem `user_id` ao usuário autenticado; o cliente nunca escolhe o proprietário. Alterações em eventos de outra pessoa retornam 404. SQL usa parâmetros.

Inserções em lote travam a linha do usuário dentro de uma transação. A validação impede intervalos invertidos, sobreposição interna e conflitos com eventos existentes. Um conflito desfaz o lote completo. Escritas concorrentes do mesmo usuário são serializadas. Eventos adjacentes são permitidos; eventos concluídos continuam ocupando seus horários.

Datas persistem como `TIMESTAMPTZ`. O cliente usa Luxon para navegar dia/semana/mês/ano no fuso IANA das preferências. Dias de horário de verão podem ter 23 ou 25 horas. O ano e a data iniciais vêm do relógio atual, sem calendário anual estático. A semana começa na segunda-feira em todos os idiomas; formato de data e horário são configuráveis.

## IA

1. Usuário descreve o planejamento e seleciona uma data de referência.
2. API envia texto, preferências e eventos do ano de referência ao Gemini. O frontend informa esse envio.
3. Gemini responde com JSON estruturado (até 100 eventos).
4. A API valida o JSON com Zod; saída do modelo nunca é tratada como comando SQL ou código.
5. A pessoa revisa, edita ou remove sugestões no modal.
6. Somente a confirmação salva, usando as mesmas regras do cadastro manual.

A chave Gemini fica exclusivamente no backend. A chamada tem timeout de 45 segundos e limite de requisições. Falhas do provedor não expõem suas respostas brutas. Não há geração simulada quando a chave não existe.

## Operação

Helmet e CORS restrito à origem configurada protegem a API. Throttler limita requisições em memória: uma instância do backend é a configuração inicial. Para múltiplas réplicas, usar armazenamento de rate limit compartilhado. `trust proxy=1` pressupõe um único proxy confiável à frente do NestJS; revisar na mudança de infraestrutura.

Docker usa build separado e processo sem root. GitHub Actions executa tipagem, build, testes, testes de navegador e build dos contêineres antes de disparar hooks de publicação.

A área financeira, perfil, SMTP e migrações estão detalhados em [perfil e finanças](account-and-finance.md).
