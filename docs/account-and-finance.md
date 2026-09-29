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
