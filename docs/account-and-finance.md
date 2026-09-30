# Perfil, segurança e finanças

## Perfil e senha

A aba **Meu perfil** permite mudar o nome, adicionar/substituir/remover a foto e alterar a senha. O e-mail permanece somente leitura nesta versão. A foto é cortada no centro e redimensionada no navegador para 256×256, convertida para JPEG e armazenada no PostgreSQL. O servidor aceita apenas JPEG, PNG ou WebP com cabeçalho válido, até 180 KB; SVG e URLs externas não são aceitos.

Trocar a senha exige a senha atual. A versão de autenticação do usuário é incrementada e invalida todos os JWTs anteriores. O dispositivo que fez a troca recebe um novo token. Senhas exigem 10 caracteres e no máximo 72 bytes. Atualizar a página ainda encerra a sessão porque o token fica em memória.

**Esqueci minha senha**, no login, solicita um link por e-mail. O token aleatório de 256 bits é armazenado somente como hash SHA-256, expira em 30 minutos e é consumido atomicamente uma única vez. Uma redefinição invalida os demais links e sessões. O link usa fragmento (`#reset=...`) para evitar enviar o token como parâmetro HTTP; o frontend remove o fragmento do endereço após lê-lo. Nenhum token de recuperação é retornado pela API ou escrito nos logs.

Configurar no backend (`config/.env` local, variáveis no Render):

```dotenv
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-do-provedor
SMTP_PASSWORD=senha-do-provedor
SMTP_FROM=contato@seu-dominio.com
```

Para SMTP com TLS implícito na porta 465, usar `SMTP_SECURE=true`. O remetente precisa ser autorizado no provedor. Sem SMTP, a recuperação retorna 503 e informa indisponibilidade; não há link secreto exibido na tela ou nos logs como alternativa. Trocar a senha dentro do perfil funciona sem SMTP. O envio externo real depende dessas credenciais e das permissões de rede da hospedagem.

## Agenda e tema

O botão de lápis em cada evento abre o formulário existente preenchido. É possível mudar título, início, fim e categoria. A conclusão é preservada. A atualização usa a mesma trava por usuário que a criação; conflitos, inclusive concorrentes, não sobrescrevem eventos. O botão de sol/lua no cabeçalho alterna imediatamente o tema e persiste a preferência da conta. O seletor nas configurações continua disponível.

## Organização financeira

A aba **Finanças** inclui:

- Período mensal com navegação, total de entradas, saídas e saldo do período.
- Gráfico diário de entradas/saídas e gráfico de despesas por categoria, com valores também em texto.
- Cadastro, edição e exclusão de lançamentos: descrição, valor, tipo, data e categoria.
- Categorias próprias por usuário, com nome e cor editáveis. Excluir uma categoria mantém os lançamentos como “sem categoria”.
- Texto corrido interpretado pelo Gemini. As sugestões são editáveis e só são salvas após confirmação.

Valores são armazenados como centavos inteiros, sem cálculos de ponto flutuante na conversão da entrada. No formulário manual, use `1234,56` ou `1234.56`, sem separador de milhares. Cada lançamento aceita de R$ 0,01 a R$ 9.999.999,99. A moeda desta versão é **BRL**; não há conversão cambial. O saldo é a diferença entre entradas e saídas do período, sem saldo inicial bancário. Não existe conexão com contas bancárias.

O dashboard calcula todo o período, mas exibe no máximo os 500 lançamentos mais recentes. Os filtros de tipo se aplicam à lista; os gráficos e totais continuam representando todo o período. Lançamentos usam datas civis (`DATE`), não horários. Inserções em lote são atômicas e limitadas a 100 itens. Categorias de outra conta são rejeitadas tanto pela aplicação quanto por chave estrangeira composta no banco.

A IA recebe somente o texto enviado, a data de referência, o idioma e as categorias da pessoa; não recebe o histórico financeiro existente. Valores ausentes não devem ser inventados. Validações de schema e propriedade de categoria são executadas novamente antes de salvar. A IA pode interpretar errado: a revisão dos valores/datas é obrigatória. Reenviar e confirmar o mesmo texto pode criar duplicatas; não existe reconciliação bancária automática.

## Migrações e verificação

`database/migrations.ts` contém migrações versionadas executadas com transação e advisory lock. A migração 1 adiciona foto, versão de autenticação, recuperação de senha e tabelas financeiras sem apagar dados existentes. A tabela `schema_migrations` impede reaplicações.

`tests/features.integration.cjs` cobre perfil, edição e conflitos, propriedade de categorias/lançamentos, precisão do dashboard, rollback, revogação de tokens e recuperação concorrente de uso único. O envio de e-mail e o provedor Gemini são substituídos por dublês controlados nos testes; não há mensagens externas nem consumo de chave real no CI. `tests/features.e2e.ts` percorre perfil, foto, senha, temas, categorias, lançamentos e revisão da IA em desktop/mobile; apenas a resposta da IA é simulada nesse fluxo.

## Contas previstas e pagamentos parciais

A aba Finanças tem três visões: Fluxo de caixa, Contas e dívidas, Investimentos.

Em Contas e dívidas, cadastre o título, natureza (fixo, variável ou dívida), valor previsto, vencimento e categoria. Contas fixas podem gerar de 1 a 24 cobranças mensais; o valor informado é **por mês**. Os vencimentos são calculados a partir do dia original: uma cobrança em 31/01 gera 28/02 (ou 29 em ano bissexto) e 31/03. Edições afetam somente a cobrança selecionada; não existe repetição infinita automática. Uma dívida registra o principal total que se deseja acompanhar, sem cálculo de juros, amortização contratual ou parcelamento automático.

Exemplo: Energia prevista em R$ 400. Ao registrar um pagamento de R$ 300, o controle mostra R$ 300 pagos, R$ 100 restantes e estado Parcial. O fluxo de caixa registra apenas R$ 300 de saída, na data do pagamento. Ao pagar os R$ 100 restantes, a conta passa a Pago. O estado Vencido usa o vencimento e a data atual no fuso do usuário. Os totais das contas seguem o filtro de vencimento; pagamentos vinculados são considerados em todas as datas. O caixa segue o mês da movimentação. Por isso os totais das duas visões podem legitimamente diferir.

O histórico permite editar ou excluir pagamentos. O saldo é calculado a partir dos lançamentos; não há contador separado que possa ficar desatualizado. Operações concorrentes são serializadas por usuário. O servidor impede pagamentos acima do total, reduzir o previsto abaixo do já pago e excluir uma conta com histórico vinculado. Para corrigir um cadastro assim, primeiro edite, exclua ou desvincule os lançamentos. Excluir uma categoria apenas remove o vínculo; mantém contas e pagamentos.

## Digitação de pagamentos

Cadastre a conta antes de usar o campo de texto: “Hoje paguei R$ 300 da energia de R$ 400; ainda faltam R$ 100”. O Gemini recebe as contas em aberto e propõe **somente o valor pago**, com o vínculo quando puder identificá-lo. Contas com nomes ambíguos exigem escolher o vínculo na revisão. Valores previstos e saldos pendentes não devem virar outra saída de caixa. Confira o valor e os seletores “Vincular a uma conta” / “Vincular a um investimento” antes de confirmar. Nenhuma sugestão é salva automaticamente. O servidor revalida propriedade e saldo no momento de salvar, mesmo que uma sugestão tenha ficado desatualizada.

## Investimentos

Cadastre um investimento e uma meta opcional. Aportes são saídas de caixa vinculadas ao investimento; resgates são entradas. O saldo exibido é **aportes menos resgates de capital**, não valor de mercado. Não há cotações, rentabilidade, impostos, integração bancária ou recomendação de investimento. O gráfico de gastos por categoria exclui aportes; o fluxo de caixa continua mostrando todas as entradas e saídas. O histórico é manual. O servidor não permite deixar saldo de capital negativo, inclusive ao editar datas ou excluir aportes que já sustentam um resgate. Movimentações no mesmo dia são consolidadas por data; não há horário intradiário.

## Rotinas explícitas e indisponibilidade da IA

Rotinas em português com uma atividade e intervalo explícito por linha (por exemplo “Rodar das 05h30 até às 12h.”) são interpretadas diretamente para a data de referência e fuso selecionados. Todas as linhas devem ser reconhecidas. Essa leitura não depende de Gemini, não salva automaticamente e informa ao usuário que IA não foi necessária. Não interpreta recorrência, datas implícitas ou intervalos que atravessam a meia-noite: esses casos seguem para a IA. Conflitos de horário são rejeitados.

Para chamadas Gemini, `GEMINI_MODEL` é o modelo principal e `GEMINI_FALLBACK_MODEL` é a alternativa (padrão `gemini-3.5-flash-lite`, validado com uma chamada real). Em HTTP 500/502/503/504 do principal, a próxima tentativa usa a alternativa, com o mesmo conteúdo, validação e prazo total de 45 segundos. Credenciais inválidas não são contornadas. Falhas persistentes ainda podem impedir geração. A alternativa pode produzir resultados diferentes, por isso a revisão permanece obrigatória.

## Novos endpoints

- `GET/POST /finance/obligations`; `PATCH/DELETE /finance/obligations/:id`.
- `GET /finance/obligations/:id/transactions`: histórico completo da conta.
- `GET/POST /finance/investments`; `PATCH/DELETE /finance/investments/:id`.
- `GET /finance/investments/:id/transactions`: histórico completo do investimento.
- Transações aceitam `obligationId` ou `investmentId` (UUID ou null), nunca ambos. Pagamentos de contas são do tipo `expense`.
- Dashboard preserva income/expense/balance como fluxo de caixa e também fornece invested/redeemed/spending (saídas menos aportes).

A migração 2 adiciona tabelas e vínculos sem alterar valores de lançamentos existentes. Testes: `tests/finance-management.integration.cjs`, `tests/management.e2e.ts`, `tests/routine.test.ts` e `tests/ai-request.test.ts`.
