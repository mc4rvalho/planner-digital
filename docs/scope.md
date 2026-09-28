# Escopo entregue e próximas etapas

## Implementado

- Cadastro e login individuais com JWT e Passport Local/JWT, seguindo a estrutura fornecida.
- Preferências por conta: português/inglês/espanhol, 12h/24h, formatos de data, fuso IANA e tema.
- Agenda de dia/semana/mês/ano calculada dinamicamente, navegação entre períodos e retorno a hoje.
- Cadastro manual, conclusão e exclusão de eventos; validação de conflitos e persistência PostgreSQL.
- Entrada em texto corrido, integração Gemini, revisão/edição de sugestões antes da confirmação.
- Layout responsivo, modal nativo com gerenciamento de foco e navegação por teclado.
- Docker, configurações de Render/Vercel, pipeline GitHub Actions e documentação.

## Limitações explícitas

- Publicação e geração real com Gemini precisam de contas/chave; arquivos de configuração não equivalem a deploy realizado.
- Não há sincronização com Google Calendar/Outlook, notificações, recorrência formal, importação CSV, compartilhamento ou anexos.
- Sugestões podem descrever uma semana, mês ou ano, mas estão limitadas a 100 eventos por solicitação. O contexto existente enviado à IA cobre o ano da data de referência; conflitos de outros anos ainda são verificados ao salvar.
- Compromissos sem duração devem ser revisados: a IA pode estimar horários. Toda sugestão é editável antes de salvar.
- Para mudar título ou horário de um evento já salvo nesta versão, excluí-lo e criá-lo novamente.
- Logout é local; não há refresh/revogação de token, recuperação de senha, MFA ou verificação de e-mail.
- Sem funcionamento offline ou app nativo. A API independente e o frontend responsivo permitem essa evolução, mas um aplicativo exige trabalho adicional.
- O visual usa fontes Google Fonts com fallback local. O cliente envia ao Gemini o texto e eventos do período apenas ao acionar a organização por IA; não há geração em background.

## Evolução sugerida

Migrações versionadas, backups, observabilidade e recuperação de conta; depois edição de eventos persistidos, recorrência, notificações e sincronização de calendário. Para mobile, avaliar PWA ou cliente nativo consumindo a mesma API conforme os recursos desejados.
