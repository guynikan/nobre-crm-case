# Nobre CRM: funil de oportunidades da Nobre Brindes

Primeira versão de um CRM interno para o time comercial da Nobre Brindes: Kanban do funil, detalhe da oportunidade com histórico e contatos, regras de etapa validadas no backend e uma automação de follow-up (problema 4 do case) que cria e encerra lembretes sozinha.

- **Front:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, React Query, dnd-kit.
- **API:** Node.js 22, Fastify 5, Zod (contratos compartilhados com o front), PostgreSQL via `pg` com SQL explícito, node-cron.
- **Monorepo pnpm:** `apps/web`, `apps/api`, `packages/contracts` (schemas Zod) e `packages/domain` (regras puras, testadas).

## Como rodar

Pré-requisitos: Node.js 22 ou mais novo, pnpm 8 ou mais novo e PostgreSQL 15 ou mais novo rodando localmente.

```bash
pnpm install

# 1. Banco (qualquer Postgres local serve; não há Docker obrigatório)
createdb nobre_crm
createdb nobre_crm_test        # opcional: só para o teste de integração do follow-up

# 2. Configuração da API (não há credenciais no repositório)
cp apps/api/.env.example apps/api/.env
# ajuste DATABASE_URL e TEST_DATABASE_URL para o seu usuário do Postgres

# 3. Estrutura e carga inicial
pnpm db:migrate
pnpm db:seed                   # as 7 oportunidades do case
pnpm db:seed:synthetic         # opcional: as 7 + 80 sintéticas determinísticas (substitui a carga)

# 4. Desenvolvimento (dois terminais)
pnpm dev:api                   # http://localhost:3333  (documentação OpenAPI em /docs)
pnpm dev:web                   # http://localhost:3000
```

O front usa `http://localhost:3333` por padrão. Para outra URL, crie `apps/web/.env.local` a partir de `apps/web/.env.example`.

Build de produção: `pnpm build`, depois `pnpm start:api` e `pnpm start:web`.

Verificação: `pnpm typecheck`, `pnpm test` e `pnpm build` na raiz. O teste de integração do follow-up roda contra `TEST_DATABASE_URL` e **apaga esse banco**. Se a variável estiver vazia, o teste é pulado.

Follow-up manual pelo terminal: `pnpm follow-up:run` (o mesmo job que o agendador roda).

### As datas do case acompanham o dia de hoje

Os dados do case são de 15/10/2026, e "dias sem contato" depende de "hoje". Em vez de congelar a data de negócio, o seed desloca as sete linhas do enunciado para a data em que roda, preservando todos os intervalos entre elas: a `OPP-2002` fica com 9 dias sem contato e a proposta da `OPP-2004` continua vencida, em qualquer dia que você execute o seed.

A tabela em `CASE_OPPORTUNITIES_AS_GIVEN` permanece idêntica ao PDF; o deslocamento acontece na carga, em `shiftOnto`. Rode `pnpm db:seed` de novo para reposicionar os dados no dia atual. O fuso de negócio é `America/Sao_Paulo`.

## O que tem na tela

- **Funil (`/`):** Kanban com uma coluna por etapa e mais a coluna Perdida. Cada coluna mostra o total, a soma dos valores e quantas oportunidades precisam de atenção. O card mostra valor, brinde e quantidade, vendedor, dias sem contato e alertas de data (proposta vencida, evento passado ou nos próximos 7 dias).
- **Arrastar card:** enquanto você arrasta, as colunas permitidas ficam destacadas e as proibidas ficam apagadas. Soltar numa coluna proibida explica o porquê sem chamar a API. Soltar em Perdida abre um diálogo que exige o motivo. A mudança aparece na hora (update otimista). Se a API recusar, o card volta e uma mensagem em pt-BR diz o motivo. O teclado também funciona: espaço, setas e espaço.
- **Busca e filtros:** empresa ou código, vendedor, "precisam de atenção hoje" e, na visão de lista, etapa. Tudo fica na URL (`?q=pulso&attention=1&view=list`), então um link compartilhado abre a mesma visão.
- **Detalhe (drawer):** dados comerciais, itens, edição de valor e itens, registro de contato, botões das etapas permitidas (alternativa acessível ao arrasto) e histórico de etapas.
- **Lembretes (`/lembretes`):** lembretes abertos e encerrados, filtro por vendedor e botão "Verificar agora". O menu mostra quantos lembretes estão abertos.
- **Estados:** esqueleto no carregamento, erro com "Tentar de novo", vazio com mensagem e indicador "Atualizando…" quando os dados anteriores continuam na tela.

## Decisões

### Regras de etapa (validadas no backend em `packages/domain/src/pipeline.ts`)

| De | Pode ir para |
|---|---|
| Primeiro Contato | Apresentação de Orçamento, Perdida |
| Apresentação de Orçamento | Follow-up, Perdida |
| Follow-up | Forecast, **Apresentação de Orçamento** (revisão), Perdida |
| Forecast | Fechamento, **Follow-up** (negociação esfriou), Perdida |
| Fechamento, Perdida | nada (estados finais) |

- **Avanço de uma etapa por vez.** Ninguém pula etapa, e é isso que garante "Fechamento só a partir de Forecast".
- **Retornos permitidos, sempre de uma etapa:**
  - Follow-up → Apresentação de Orçamento: o cliente pediu revisão da proposta (exemplo do próprio enunciado).
  - Forecast → Follow-up: a negociação que parecia certa esfriou e volta a ser acompanhada.
- **Retornos proibidos:**
  - Voltar para Primeiro Contato: um orçamento já apresentado não "deixa de existir".
  - Sair de Fechamento ou de Perdida. Retomar uma venda perdida seria uma nova oportunidade.
- **Orçamento obrigatório.** Apresentação de Orçamento e todas as etapas depois dela exigem valor estimado maior que zero e pelo menos um item de brinde (`name`, `quantity`). A mesma regra vale na edição: uma oportunidade nessas etapas não pode ficar sem valor nem sem itens.
- **Perdida** vale a partir de qualquer etapa não final e exige motivo. Um motivo enviado para outra etapa é rejeitado (`LOST_REASON_NOT_ALLOWED`) para não sujar o dado.
- **Fechamento** é tratado como venda ganha.
- **Histórico.** Cada mudança grava `stage_history` (quando, de onde, para onde, motivo) na mesma transação da mudança. A carga inicial grava a etapa importada com `source = SEED`, porque as etapas anteriores não são conhecidas.
- **Concorrência.** Toda escrita envia `expectedVersion`. O serviço faz `SELECT … FOR UPDATE` e compara a versão: se outra pessoa alterou antes, a resposta é `409 VERSION_CONFLICT` e o front desfaz o movimento.
- **Erros.** Os erros seguem o padrão Problem Details (RFC 9457), com `code` estável em inglês e `title`/`detail` em pt-BR. A lista completa está em `packages/contracts/src/problem.ts`.

### Atenção

Uma oportunidade não final precisa de atenção quando está há 2 dias ou mais sem contato, ou quando não tem nenhum contato registrado. Os dias são corridos, porque o PDF não diz se são úteis, e o limite é configurável (`ATTENTION_THRESHOLD_DAYS`). A mesma função (`evaluateAttention`) roda na API e no front. Com isso, o update otimista mostra o mesmo resultado que o servidor vai devolver.

### Automação: problema 4 (lembrar de dar retorno)

**Por que o problema 4:** é o que mais conversa com a pergunta "o vendedor encontra rápido a negociação que precisa trabalhar hoje?". Ele também usa só dados que o CRM já tem, sem depender de integração externa (telefonia, enriquecimento, transcrição).

**Como funciona** (`apps/api/src/modules/follow-up`):

1. Um job node-cron (`FOLLOW_UP_CRON`, padrão a cada 15 minutos) e o endpoint `POST /follow-up/run` chamam o mesmo serviço. O servidor também roda o job uma vez ao subir.
2. O serviço lê as oportunidades abertas e os lembretes abertos. A função pura `planFollowUp` decide o que criar e o que encerrar.
3. **Criação:** um lembrete com o motivo (`DAYS_WITHOUT_CONTACT` ou `NO_CONTACT_RECORDED`) e os dias sem contato.
4. **Encerramento:**
   - Registrar um contato recente encerra o lembrete na hora (`CONTACT_REGISTERED`).
   - Ganhar ou perder a oportunidade também encerra (`OPPORTUNITY_FINAL`).
   - Se a necessidade sumiu por outro motivo, o job encerra (`NO_LONGER_NEEDED`).
5. **Idempotência:**
   - Um `pg_advisory_xact_lock` serializa o cron e as execuções manuais, inclusive entre processos.
   - Um índice único parcial garante no máximo um lembrete aberto por oportunidade.
   - O `INSERT … ON CONFLICT DO NOTHING` torna seguro rodar duas vezes.
   - Os testes cobrem execução repetida e concorrente.
6. **Webhook opcional.** `FOLLOW_UP_WEBHOOK_URL` recebe um POST com os lembretes novos, por exemplo para um canal de chat. Uma falha do webhook não desfaz os lembretes; ela só fica no log.

**Testes das regras críticas:**

- `packages/domain`: transições, motivo de perda, invariante de orçamento, atenção, plano de follow-up e datas de calendário.
- `apps/api/test/follow-up.test.ts` (integração com Postgres): lembretes do dia 15/10, idempotência sequencial e concorrente, encerramento por contato e por perda, contato antigo que mantém o lembrete, e o avanço de data para 17/10.

### Outras decisões

- **Contratos Zod compartilhados.** O mesmo schema valida a requisição na API, gera o OpenAPI (`/docs`) e valida a resposta no front.
- **Estado.** O estado do servidor fica no React Query (sem Zustand), os filtros ficam na URL e o estado local fica só para a UI.
- **React 19:**
  - `useTransition` na troca de filtros.
  - `useDeferredValue` para o quadro não travar enquanto você digita.
  - `lazy` + `Suspense` no drawer de detalhe, que só é baixado quando alguém abre uma oportunidade.
- **Dinheiro em centavos** (inteiro) e **datas de calendário como `YYYY-MM-DD`**, sem fuso: "último contato" é um dia, não um instante.
- **Busca no backend.** O quadro pede até 500 oportunidades por vez, o que basta para o volume de um time. A paginação já existe no contrato para quando isso deixar de bastar.

## Inconsistências da carga inicial e como foram tratadas

Os valores do PDF foram preservados como vieram (`CASE_OPPORTUNITIES_AS_GIVEN` em `apps/api/src/db/seed/case-data.ts`). Só foi corrigido o que quebraria uma regra, e cada correção está declarada em `CASE_CORRECTIONS`, com o valor original e o motivo.

| Oportunidade | O que há nos dados | Tratamento |
|---|---|---|
| OPP-2007 (Perdida) | Sem motivo de perda, mas Perdida exige motivo | **Corrigido explicitamente:** motivo "Motivo não registrado na carga original". A regra não foi afrouxada, e a lacuna fica visível no detalhe. |
| OPP-2001 (Primeiro Contato) | Sem validade de proposta | Mantido em branco. Faz sentido: ainda não há proposta apresentada. |
| OPP-2002 (Apresentação) | Proposta vencida em 13/10, oportunidade aberta, 9 dias sem contato | Mantido. O card mostra "Proposta vencida", e o follow-up cria lembrete. |
| OPP-2004 (Follow-up) | Proposta vencida em 10/10, 13 dias sem contato | Mantido, com o mesmo alerta e o lembrete. É o caso mais urgente do funil. |
| OPP-2003 (Follow-up) | Evento do cliente (18/10) antes do fim da validade da proposta (20/10) | Mantido. O card avisa "Evento em 3 dias": o prazo real é o do evento, não o da proposta. |
| OPP-2006 (Fechamento) | Evento em 17/10, dois dias depois da data de referência | Mantido. Fechamento é final, e o card avisa que o evento está próximo (risco de produção e entrega, não de venda). |
| Todas | "Último contato" é só uma data | Vira um registro em `contacts`, para o histórico de contatos começar com o dado que existe. |
| Todas | As etapas anteriores à carga são desconhecidas | O histórico começa na etapa importada, marcado como carga inicial. |

Campos em branco viram `null`, nunca um valor inventado.

## Limitações

- Sem autenticação nem perfis (o PDF não exige). Qualquer pessoa com acesso à API pode alterar qualquer oportunidade, e o histórico não registra quem fez a mudança.
- Não há tela para criar oportunidade. A API tem `POST /opportunities`, mas o fluxo de entrada de leads ficou fora do escopo.
- Lembretes aparecem no CRM e, opcionalmente, num webhook. Não há e-mail nem push.
- O quadro carrega até 500 oportunidades por filtro. Acima disso, seria preciso paginar por coluna.
- Os testes automatizados cobrem as regras críticas e o follow-up. A interface foi verificada manualmente: arrastar, rollback em 409, Perdida com motivo, contato que encerra lembrete, filtros na URL e execução manual do follow-up.
- Os dias de atenção são corridos. Dias úteis precisariam de um calendário de feriados.

## Como eu protegeria a API em produção

- **Autenticação:** SSO da empresa (OIDC) no front, com token de curta duração validado na API (`@fastify/jwt` ou um gateway). Cada requisição carrega o vendedor, e o histórico grava quem mudou o quê.
- **Autorização por perfil:** vendedor altera só as próprias oportunidades, gestor vê e altera todas. A checagem fica no serviço, não na rota.
- **Rede:**
  - HTTPS obrigatório.
  - CORS restrito ao domínio do front (já configurável em `WEB_ORIGIN`).
  - A API fica atrás de um proxy ou WAF, e o Postgres em rede privada.
- **Já existe hoje:**
  - `@fastify/helmet` e rate limit (300 requisições por minuto por IP).
  - Validação Zod de toda entrada.
  - SQL só com parâmetros.
  - Erros sem stack trace para o cliente.
  - `POST /follow-up/run` é idempotente, então chamadas repetidas não causam dano.
- **Segredos:**
  - Nada no repositório (`.env` está no `.gitignore`, e só os `.env.example` são versionados).
  - Em produção, os segredos ficam num cofre (Secrets Manager, Vault ou equivalente).
  - O usuário do banco tem só os privilégios necessários.
- **Operação:** logs estruturados (pino) sem dados sensíveis, health check em `/health` e o job protegido contra execução dupla pelo advisory lock.

## Os outros três problemas

### 1. SLA do primeiro contato

- **Ideia:** todo lead novo entra com um prazo de primeiro contato, por exemplo 2 horas úteis.
- **Fila de distribuição:** o lead vai para o vendedor com menos leads abertos, ou por rodízio.
- **Escalonamento:** se o prazo estoura sem contato registrado, o lead vai para o gestor ou é redistribuído.
- **Implementação:**
  - Coluna `first_contact_due_at` na oportunidade.
  - O mesmo padrão do job de follow-up: cron, plano puro testável e idempotência por índice parcial, com uma regra a mais, "sem contato desde a criação".
  - Webhook do formulário do site (`POST /leads`) criando a oportunidade em Primeiro Contato.
  - Métrica de tempo até o primeiro contato por vendedor.

### 2. Conhecer a empresa do lead

- **Ideia:** ao criar o lead com o CNPJ, enriquecer automaticamente com razão social, CNAE, porte, endereço e site, a partir de uma fonte pública de CNPJ. Mostrar isso no detalhe, junto com as compras anteriores do mesmo CNPJ nas três marcas do grupo.
- **Implementação:**
  - Fila de jobs (por exemplo `pg-boss`, no próprio Postgres) que consulta a API de CNPJ com retry e cache.
  - Os dados vão para a tabela `company_profiles` com data da consulta.
  - Opcionalmente, um resumo gerado por LLM a partir do site da empresa, sempre marcado como "gerado automaticamente".

### 3. Informações da ligação acessíveis depois

- **Ideia:** o roteiro da ligação vira um formulário estruturado no detalhe da oportunidade: quantidade estimada, data do evento, orçamento, decisor e concorrentes. O vendedor preenche durante a ligação, e os campos alimentam a própria oportunidade.
- **Gravação:** se a ligação for gravada, a transcrição automática (por exemplo Whisper) pode extrair os mesmos campos como sugestão para o vendedor confirmar.
- **Implementação:**
  - Tabela `call_notes` com as respostas em JSON validadas por um schema Zod versionado do roteiro.
  - Busca por texto no Postgres (`tsvector`).
  - Exibição na linha do tempo junto com os contatos.

## Uso de IA

O código foi escrito com assistência de IA (Claude Code, com o modelo Claude Opus). Eu defini as decisões técnicas e de produto antes de cada etapa: stack, regras de retorno de etapa, problema escolhido, idempotência, tratamento das inconsistências e arquitetura feature-based. A IA implementou a partir delas, e eu revisei. As regras críticas têm testes automatizados, e a interface foi testada manualmente contra a API e o Postgres locais.

## Estrutura

```
apps/
  api/    Fastify: modules/{opportunities,follow-up,sellers,system}, db/ (migrations, seed), cli/
  web/    Next.js: src/app (rotas), src/shared (api, ui, formatação), src/features/{pipeline,opportunity-detail,reminders,filters}
packages/
  contracts/  schemas Zod compartilhados (requisição, resposta, erros)
  domain/     regras puras: transições, atenção, plano de follow-up, datas
docs/PLAN.md  plano de execução
```
