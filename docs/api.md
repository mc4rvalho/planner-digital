# API HTTP

Base local: `http://localhost:3000`. JSON em requisições e respostas. Rotas privadas exigem `Authorization: Bearer <accessToken>`.

| Método | Rota                      | Comportamento                                            |
| ------ | ------------------------- | -------------------------------------------------------- |
| GET    | `/health`                 | Verifica conexão com PostgreSQL                          |
| POST   | `/usuarios/cadastrar`     | Cria conta e retorna token + usuário                     |
| POST   | `/usuarios/logar`         | Autentica usando Passport Local                          |
| GET    | `/usuarios/me`            | Retorna usuário e preferências                           |
| GET    | `/events?from=ISO&to=ISO` | Lista intervalos que intersectam o período, até 370 dias |
| POST   | `/events`                 | Insere lote atômico de 1–100 eventos                     |
| PATCH  | `/events/:id`             | Altera conclusão ou título/horário/categoria do evento                               |
| DELETE | `/events/:id`             | Exclui evento próprio                                    |
| PATCH  | `/preferences`            | Salva todas as preferências                              |
| POST   | `/planner/propose`        | Gera sugestões, sem salvar                               |

## Cadastro e login

```json
{
  "nome": "Ana Silva",
  "usuario": "ana@example.com",
  "senha": "uma-senha-forte"
}
```

No login, omitir `nome`. Resposta: `{ "user": { "id", "name", "email", "preferences" }, "accessToken": "...", "expiresIn": 3600 }`. O token vem sem prefixo; o cliente adiciona `Bearer` no cabeçalho.

## Eventos

```json
{
  "events": [
    {
      "title": "Estudar",
      "start": "2026-10-01T14:00:00-03:00",
      "end": "2026-10-01T15:00:00-03:00",
      "category": "study"
    }
  ]
}
```

Categorias: `work`, `personal`, `health`, `study`. Datas devem incluir offset ou `Z`. `end` deve ser posterior a `start`. Atualização de conclusão: `{"completed":true}`.

## Preferências

```json
{
  "locale": "pt-BR",
  "hourCycle": "h23",
  "dateFormat": "dd/MM/yyyy",
  "timezone": "America/Recife",
  "theme": "light"
}
```

Idiomas: `pt-BR`, `en-US`, `es-ES`. Horas: `h23`, `h12`. Datas: `dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd`. Temas: `light`, `dark`.

## IA

```json
{
  "text": "Amanhã quero caminhar das 18h às 18h30",
  "referenceDate": "2026-10-01"
}
```

Resposta: `{ "events": [...] }`. Não altera o banco. A data de referência é explícita para interpretar “amanhã”, “esta semana” etc.

Erros: 400 entrada inválida, 401 não autenticado/token expirado, 404 evento inexistente ou não pertencente ao usuário, 409 conflito de cadastro/agenda, 429 limite de requisições e 503 Gemini indisponível/não configurado. Detalhes internos do provedor não são retornados.

## Perfil e recuperação

| Método | Rota | Corpo |
| --- | --- | --- |
| PATCH | `/account/profile` | `{ "name": "Ana", "photo": null }` ou foto como data URL raster |
| POST | `/account/password` | `{ "currentPassword": "...", "newPassword": "..." }`; retorna nova sessão JWT |
| POST | `/account/forgot-password` | `{ "email": "ana@example.com" }`; público, resposta genérica |
| POST | `/account/reset-password` | `{ "token": "...", "newPassword": "..." }`; público, uso único |

Edição completa de evento em `PATCH /events/:id` usa `{ title, start, end, category }`, sem `completed`; a conclusão tem atualização independente com `{ completed }`.

## Finanças (rotas privadas)

| Método | Rota | Comportamento |
| --- | --- | --- |
| GET | `/finance?from=2026-10-01&to=2026-11-01` | Dashboard, totais, gráficos e até 500 lançamentos; fim exclusivo |
| GET/POST | `/finance/categories` | Lista ou cria categoria `{ name, color }` |
| PATCH/DELETE | `/finance/categories/:id` | Edita ou exclui categoria própria |
| POST | `/finance/transactions` | Lote `{ transactions: [...] }` |
| PATCH/DELETE | `/finance/transactions/:id` | Edita ou exclui lançamento próprio |
| POST | `/finance/propose` | `{ text, referenceDate }`; sugere sem salvar |

Lançamento: `{ "description": "Mercado", "amountCents": 8290, "type": "expense", "date": "2026-10-01", "categoryId": null }`. Tipo: `income` ou `expense`. Todos os valores financeiros retornados nos totais/gráficos também são centavos. Categoria em edição/criação: `{ "name": "Alimentação", "color": "#7963d2" }`.
