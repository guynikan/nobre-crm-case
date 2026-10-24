# Nobre CRM: funil de oportunidades da Nobre Brindes

Desenvolvi uma primeira versão de CRM interno para o time comercial da Nobre Brindes: Kanban do funil, detalhe da oportunidade com histórico e contatos, regras de etapa validadas no backend e uma automação de follow-up (problema 4 do case) que cria e encerra lembretes.

- **Front:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, React Query, dnd-kit.
- **API:** Node.js 22, Fastify 5, Zod (contratos compartilhados com o front), PostgreSQL via `pg` com SQL explícito, node-cron.
- **Monorepo pnpm:** `apps/web`, `apps/api`, `packages/contracts` (schemas Zod) e `packages/domain` (regras puras, testadas).

## Como rodar

Pré-requisitos: Node.js 22 ou mais novo, pnpm 8 ou mais novo e PostgreSQL 15 ou mais novo rodando localmente.

```bash
pnpm install

# 1. Banco (qualquer Postgres local serve; não há Docker obrigatório)
createdb nobre_crm
createdb nobre_crm_test        # opcional: banco isolado para os testes de integração da API

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

Verificação: `pnpm typecheck`, `pnpm test` e `pnpm build` na raiz. Os testes de integração da API rodam contra `TEST_DATABASE_URL` e **apagam esse banco**. Se a variável estiver vazia, eles são pulados.

Follow-up manual pelo terminal: `pnpm follow-up:run` (o mesmo job que o agendador roda).

### As datas do case acompanham o dia de hoje

Os dados do case são de 15/10/2026, e "dias sem contato" depende de "hoje". Para não congelar a data de negócio, configurei o seed para deslocar as sete linhas do enunciado para o dia em que roda, preservando os intervalos: a `OPP-2002` fica com 9 dias sem contato e a proposta da `OPP-2004` continua vencida em qualquer execução.

Mantive `CASE_OPPORTUNITIES_AS_GIVEN` idêntica ao PDF e faço o deslocamento apenas na carga, em `shiftOnto`. Para reposicionar os dados no dia atual, rodo `pnpm db:seed` novamente. Uso `America/Sao_Paulo` como fuso de negócio.

## O que tem na tela

- **Funil (`/`):** Implementei um Kanban com uma coluna por etapa e outra para Perdida. Mostro em cada coluna o total, a soma dos valores e quantas oportunidades precisam de atenção. Nos cards, exibo valor, brinde e quantidade, vendedor, dias sem contato e alertas de data. A faixa lateral tem três níveis de urgência e ordeno os cards pelos portões de prioridade.
- **Arrastar card:** Permito puxar cards das etapas finais dentro da própria coluna; se ultrapassam esse limite, voltam à posição original e aviso por que não podem ser movidos. Durante o arrasto, destaco as colunas permitidas e apago as proibidas. Ao soltar numa coluna proibida, explico o motivo sem chamar a API; ao soltar em Perdida, peço o motivo num diálogo. Faço a mudança de forma otimista e, se a API recusa, restauro o card e mostro o motivo em pt-BR. Também implementei o arrasto pelo teclado.
- **Busca e filtros:** Permito buscar por empresa ou código, filtrar por vendedor e, na visão de lista, por etapa. Guardo tudo na URL (`?q=pulso&view=list`) para que um link compartilhado abra a mesma visão. Não criei um filtro de atenção: deixei a urgência ordenar e colorir o quadro inteiro.
- **Detalhe (drawer):** Mostro dados comerciais, itens, edição de valor e datas, máscara de moeda nos campos monetários, registro de contato, botões para as etapas permitidas e histórico de etapas.
- **Lembretes (sino no cabeçalho):** Criei um painel de trabalho com lembretes abertos e o botão "Verificar agora". No rodapé, mostro o tempo estimado até a próxima verificação. Não exibo lembretes encerrados; o sino mostra quantos continuam abertos. Quando chega um lembrete novo, mostro um toast e uma contagem no título da aba enquanto ninguém olha. Não criei uma rota separada.
- **Criar oportunidade:** Adicionei o botão "Nova oportunidade" ao funil. Inicio cada oportunidade em Primeiro Contato e permito informar vendedor, valor, brindes, validade da proposta e data do evento no cadastro ou depois. Apliquei máscara de moeda brasileira nos campos monetários.
- **Estados:** Implementei esqueleto no carregamento, erro com "Tentar de novo", estado vazio com mensagem e indicador "Atualizando…" enquanto mantenho os dados anteriores na tela.

## Minhas decisões

### Regras de etapa (validadas no backend em `packages/domain/src/pipeline.ts`)

| De | Pode ir para |
|---|---|
| Primeiro Contato | Apresentação de Orçamento, Perdida |
| Apresentação de Orçamento | Follow-up, Perdida |
| Follow-up | Forecast, **Apresentação de Orçamento** (revisão), Perdida |
| Forecast | Fechamento, **Follow-up** (negociação esfriou), Perdida |
| Fechamento, Perdida | nada (estados finais) |

- **Avanço de uma etapa por vez.** Decidi não permitir saltos, para garantir que uma oportunidade só chegue a Fechamento depois de passar por Forecast.
- **Retornos permitidos, sempre de uma etapa:**
  - Permiti Follow-up → Apresentação de Orçamento quando o cliente pede revisão da proposta (exemplo do próprio enunciado).
  - Permiti Forecast → Follow-up quando a negociação que parecia certa esfria e precisa voltar a ser acompanhada.
- **Retornos proibidos:**
  - Não permiti voltar para Primeiro Contato: um orçamento já apresentado não "deixa de existir".
  - Não permiti sair de Fechamento ou de Perdida. Para mim, retomar uma venda perdida significa criar outra oportunidade.
- **Orçamento obrigatório.** Exijo valor estimado maior que zero e pelo menos um item de brinde (`name`, `quantity`) a partir de Apresentação de Orçamento, inclusive quando a oportunidade é editada.
- **Perdida.** Permito marcar como perdida em qualquer etapa não final e exijo um motivo. Também rejeito um motivo enviado para outra etapa (`LOST_REASON_NOT_ALLOWED`) para não sujar o dado.
- **Fechamento.** Trato essa etapa como venda ganha.
- **Histórico.** Gravo cada mudança em `stage_history` (quando, de onde, para onde e motivo) na mesma transação. Na carga inicial, registro a etapa importada com `source = SEED`, porque não conheço as etapas anteriores.
- **Concorrência.** Uso `expectedVersion` nas escritas. O serviço faz `SELECT … FOR UPDATE` e compara a versão; se outra pessoa alterou a oportunidade antes, a API responde `409 VERSION_CONFLICT` e o front desfaz o movimento.
- **Erros.** Adotei Problem Details (RFC 9457): mantenho `code` estável em inglês e escrevo `title` e `detail` em pt-BR. A lista completa está em `packages/contracts/src/problem.ts`.

### Atenção e prioridade

Defini que uma oportunidade não final precisa de atenção quando está há 2 dias ou mais sem contato, ou quando ainda não tem contato registrado. Escolhi dias corridos porque o PDF não especifica dias úteis e deixei o limite configurável (`ATTENTION_THRESHOLD_DAYS`). Reutilizo a mesma função (`evaluateAttention`) na API e no front para que o update otimista mostre o mesmo resultado que o servidor vai devolver.

Percebi que essa regra responde *se* uma oportunidade está vencida, mas não responde por onde começar. Na carga completa de 87 oportunidades ela sinaliza 59; com dois terços do quadro em alerta, eu ainda estaria deixando o vendedor decidir no olho o que a ferramenta deveria ajudar a priorizar. Por isso ordeno as oportunidades vencidas por quatro portões (`attentionPriority`), avaliados na ordem, com o primeiro que casa vencendo:

| Portão | Quando | Por quê |
|---|---|---|
| `UNTOUCHED` | nenhum contato registrado | priorizei porque ninguém começou a venda; é o problema 1 do enunciado |
| `EVENT_IMMINENT` | evento do cliente em até 7 dias | coloquei em seguida porque o prazo de produção não se move |
| `PROPOSAL_EXPIRED` | validade da proposta já passou | deixei depois porque considero mais recuperável: um orçamento pode ser reemitido |
| `OVERDUE_CONTACT` | só idade do último contato | mantive como caso base |

Escolhi a ordem pela irrecuperabilidade, não pela gravidade percebida: considerei quanto da venda se perde ao deixar cada caso para amanhã. Os três primeiros portões somam 21 oportunidades e o caso base fica com 38, o que devolve ao alerta a capacidade de significar alguma coisa. Ignorei a etapa de propósito — para mim, uma oportunidade em Primeiro Contato sem prazo vencendo é menos urgente que um Follow-up com evento depois de amanhã.

**Fiz os portões ordenarem, sem ampliar a lista.** Uma oportunidade contatada hoje continua fora da lista mesmo com evento amanhã, porque alguém comprovadamente já está cuidando dela. Assim preservo o significado de `needsAttention` e, por tabela, o da automação de follow-up, que cria lembretes a partir dele.

Decidi derivar a prioridade a cada requisição em vez de persistir, para não precisar de migração quando a regra mudar. Isso me obriga a manter a expressão em TypeScript e espelhá-la em SQL, porque ordeno no banco antes de limitar os resultados; ordenar em TypeScript depois da consulta só ordenaria a página já carregada. Criei `apps/api/test/attention-sql-mirror.test.ts` para executar a expressão SQL real contra o banco de teste e compará-la, caso a caso, com a função de domínio.

### Automação: problema 4 (lembrar de dar retorno)

**Por que escolhi o problema 4:** ele responde diretamente à pergunta "o vendedor encontra rápido a negociação que precisa trabalhar hoje?". Também consigo resolvê-lo com dados que o CRM já tem, sem depender de telefonia, enriquecimento ou transcrição externos.

**Como funciona** (`apps/api/src/modules/follow-up`):

1. Agendo um job node-cron (`FOLLOW_UP_CRON`, a cada 15 minutos por padrão) e exponho `POST /follow-up/run` para execução manual. Também rodo o job quando o servidor inicia.
2. Leio as oportunidades e os lembretes abertos e deixo a função pura `planFollowUp` decidir o que criar e encerrar.
3. **Criação:** registro um lembrete com o motivo (`DAYS_WITHOUT_CONTACT` ou `NO_CONTACT_RECORDED`) e os dias sem contato.
4. **Encerramento:**
   - Encerro o lembrete imediatamente quando registro um contato recente (`CONTACT_REGISTERED`).
   - Também encerro quando ganho ou perco a oportunidade (`OPPORTUNITY_FINAL`).
   - Se a necessidade desaparece por outro motivo, o job encerra o lembrete (`NO_LONGER_NEEDED`).
5. **Idempotência:**
   - Uso `pg_advisory_xact_lock` para serializar o cron e as execuções manuais, inclusive entre processos.
   - Garanto no máximo um lembrete aberto por oportunidade com um índice único parcial.
   - Uso `INSERT … ON CONFLICT DO NOTHING` para tornar seguras as execuções repetidas.
   - Os testes cobrem execução repetida e concorrente.
6. **Webhook opcional.** Quando configuro `FOLLOW_UP_WEBHOOK_URL`, envio os lembretes novos por POST, por exemplo para um canal de chat. Se o webhook falha, mantenho os lembretes e registro a falha no log.

**Testes das regras críticas:**

- `packages/domain`: transições, motivo de perda, invariante de orçamento, atenção, plano de follow-up e datas de calendário.
- `apps/api/test/follow-up.test.ts` (integração com Postgres): cadastro com contato inicial registrado no histórico e rejeição de contato futuro; lembretes do dia 15/10, idempotência sequencial e concorrente, encerramento por contato e por perda, contato antigo que mantém o lembrete, e o avanço de data para 17/10.

### Lembrete é notificação, não uma seção

Trato atenção como propriedade do funil no instante em que olho: calculo a cada requisição. Já o lembrete é um registro criado pelo job, com `dueOn`, `status` e `resolvedAt`, que encerro por um fato de negócio. Como o quadro já organiza e colore o trabalho por urgência, uso o lembrete para que algo criado enquanto ninguém olhava não passe despercebido. Por isso escolhi tratá-lo como notificação, não como uma seção de navegação.

Coloquei os lembretes num sino no cabeçalho, com a contagem de abertos sempre visível, uma fila para agir e o disparo manual. Não exibo lembretes encerrados: quero que o painel ajude a trabalhar os pendentes, não consultar histórico. Também não criei uma rota separada; o funil continua sendo a única tela. Em cada linha mostro o portão que a colocou ali ("Evento em 2 dias", "Proposta vencida há 6 dias"), em vez de repetir a contagem de dias. Ordeno a fila por prazo, não por silêncio, então os dias poderiam contradizer a ordem visual. Deixo a fila como escolha informada, porque o vendedor pode saber algo que o funil não sabe.

Quando chega um lembrete novo, mostro um toast e somo a contagem ao título da aba para alcançar quem está em outra aba do navegador. Limpo a contagem ao abrir o painel, não ao voltar o foco para a aba; limpá-la no retorno esconderia o aviso. Derivo o número dos lembretes ainda abertos e não vistos, sem acumular eventos, então um lembrete encerrado antes de ser visto deixa de ser anunciado.

Como o enunciado dispensa autenticação, não criei estado de leitura por usuário. Para esta primeira versão basta saber se o lembrete está aberto ou encerrado; a regra de negócio é que o encerra.

### Outras decisões

- **Contratos Zod compartilhados.** Uso o mesmo schema para validar requisições na API, gerar o OpenAPI (`/docs`) e validar respostas no front.
- **Estado.** Guardo o estado do servidor no React Query, os filtros na URL e o estado local só na interface. Não incluí Zustand porque não precisava de outra camada para esse estado.
- **React 19:**
  - `useTransition` na troca de filtros.
  - `useDeferredValue` para o quadro não travar enquanto você digita.
  - `lazy` + `Suspense` no drawer de detalhe, que só é baixado quando alguém abre uma oportunidade.
- **Dinheiro em centavos** (inteiro) e **datas de calendário como `YYYY-MM-DD`**, sem fuso. Trato "último contato" como um dia do calendário, não como um instante.
- **Busca no backend.** Busco até 500 oportunidades por filtro, o que atende ao volume deste time. Deixei paginação no contrato para quando esse limite deixar de bastar.
- **Rolagem do quadro.** Mantive a largura das colunas e escolhi a rolagem horizontal quando elas não cabem, para preservar a leitura dos cards. Acrescentei um gradiente em `shared/ui/scroll-fade.tsx` só no lado que ainda esconde conteúdo; ele é decorativo (`aria-hidden`, sem captura de ponteiro), então não interfere no arrasto nem em leitores de tela.
- **Sem onboarding.** Não implementei tour nem modal de boas-vindas. Como o critério do enunciado é encontrar rapidamente o que trabalhar hoje, preferi orientar a pessoa onde a dúvida aparece: o painel explica os lembretes, os estados vazios explicam a causa, o card diz por que exige atenção e um destino inválido no arrasto informa as etapas alcançáveis.

## Inconsistências da carga inicial e como foram tratadas

Preservei os valores do PDF em `CASE_OPPORTUNITIES_AS_GIVEN`, em `apps/api/src/db/seed/case-data.ts`. Corrigi apenas o que entraria em conflito com uma regra e registrei cada exceção em `CASE_CORRECTIONS`, com o valor original e o motivo.

| Oportunidade | O que há nos dados | Tratamento |
|---|---|---|
| OPP-2007 (Perdida) | Sem motivo de perda, mas Perdida exige motivo | **Corrigi explicitamente:** atribuí "Motivo não registrado na carga original". Não afrouxei a regra e deixei a lacuna visível no detalhe. |
| OPP-2001 (Primeiro Contato) | Sem validade de proposta | Mantive em branco porque ainda não há proposta apresentada. |
| OPP-2002 (Apresentação) | Proposta vencida em 13/10, oportunidade aberta, 9 dias sem contato | Mantive os dados. O card mostra "Proposta vencida" e o follow-up cria lembrete. |
| OPP-2004 (Follow-up) | Proposta vencida em 10/10, 13 dias sem contato | Mantive os dados e o alerta; o follow-up cria lembrete. É o caso mais urgente do funil. |
| OPP-2003 (Follow-up) | Evento do cliente (18/10) antes do fim da validade da proposta (20/10) | Mantive as datas. O card avisa "Evento em 3 dias": considero o evento o prazo real, não a validade da proposta. |
| OPP-2006 (Fechamento) | Evento em 17/10, dois dias depois da data de referência | Mantive o evento próximo. Como Fechamento é final, interpreto o aviso como risco de produção e entrega, não de venda. |
| Todas | "Último contato" é só uma data | Converto a data num registro em `contacts` para iniciar o histórico com o dado disponível. |
| Todas | As etapas anteriores à carga são desconhecidas | Inicio o histórico na etapa importada e marco a entrada como carga inicial. |

Campos em branco viram `null`, nunca um valor inventado.

## Limitações

- Não implementei autenticação nem perfis, porque o PDF não exige. Com isso, qualquer pessoa com acesso à API pode alterar oportunidades e o histórico não registra quem fez a mudança.
- Deixei fora a entrada de leads pelo site e a distribuição automática; cadastro novas oportunidades manualmente pelo funil.
- Não mostro histórico de lembretes encerrados no painel do sino; mantenho ali apenas o que ainda pede ação.
- Não expus na interface a troca de vendedor nem a correção do nome da empresa. O `PATCH` aceita `sellerId` e `companyName`, mas deixei essas operações disponíveis só pela API; redistribuir carteira é ação de gestão e exigiria autenticação e perfis.
- Não implementei e-mail nem push. Mostro lembretes no CRM e permito configurar um webhook.
- Limitei o quadro a 500 oportunidades por filtro. Se esse volume deixar de bastar, preciso paginar por coluna.
- Escolhi dias corridos para atenção. Para usar dias úteis, preciso acrescentar um calendário de feriados.

## Como eu protegeria a API em produção

- **Autenticação:** Eu adicionaria SSO da empresa (OIDC) no front, com token de curta duração validado na API (`@fastify/jwt` ou um gateway). Cada requisição identificaria o vendedor, e o histórico registraria quem mudou o quê.
- **Autorização por perfil:** Eu permitiria ao vendedor alterar só as próprias oportunidades e ao gestor visualizar e alterar todas. Colocaria a checagem no serviço, não na rota.
- **Rede:**
  - Exigiria HTTPS.
  - Restringiria CORS ao domínio do front (já deixei a origem configurável em `WEB_ORIGIN`).
  - Colocaria a API atrás de um proxy ou WAF e manteria o Postgres numa rede privada.
- **Já existe hoje:**
  - `@fastify/helmet` e rate limit (300 requisições por minuto por IP).
  - Validação Zod de toda entrada.
  - SQL só com parâmetros.
  - Erros sem stack trace para o cliente.
  - `POST /follow-up/run` é idempotente, então chamadas repetidas não causam dano.
- **Segredos:** Não versiono credenciais (`.env` está no `.gitignore`; só mantenho `.env.example` no repositório). Em produção, guardaria os segredos num cofre como Secrets Manager ou Vault e daria ao usuário do banco apenas os privilégios necessários.
- **Operação:** Já configurei logs estruturados com pino sem dados sensíveis, health check em `/health` e proteção do job contra execução dupla pelo advisory lock.

## Os outros três problemas

### 1. SLA do primeiro contato

- **Ideia:** Eu daria a cada lead novo um prazo para o primeiro contato, por exemplo duas horas úteis.
- **Fila de distribuição:** Distribuiria o lead ao vendedor com menos leads abertos ou faria rodízio.
- **Escalonamento:** Se o prazo estourasse sem contato, encaminharia o lead ao gestor ou redistribuiria a carteira.
- **Implementação:**
  - Adicionaria `first_contact_due_at` à oportunidade.
  - Reutilizaria o padrão do job de follow-up: cron, plano puro testável e idempotência por índice parcial, com a regra adicional de ausência de contato desde a criação.
  - Criaria um webhook para o formulário do site (`POST /leads`) cadastrar a oportunidade em Primeiro Contato.
  - Mediria o tempo até o primeiro contato por vendedor.

### 2. Conhecer a empresa do lead

- **Ideia:** Eu enriqueceria o lead pelo CNPJ com razão social, CNAE, porte, endereço e site, usando uma fonte pública. Também mostraria no detalhe as compras anteriores do mesmo CNPJ nas três marcas do grupo.
- **Implementação:**
  - Criaria uma fila de jobs (por exemplo, `pg-boss` no próprio Postgres) para consultar a API de CNPJ com retry e cache.
  - Guardaria os dados em `company_profiles`, junto com a data da consulta.
  - Opcionalmente, geraria um resumo do site com LLM e o identificaria claramente como automático.

### 3. Informações da ligação acessíveis depois

- **Ideia:** Eu transformaria o roteiro de ligação num formulário estruturado no detalhe: quantidade estimada, data do evento, orçamento, decisor e concorrentes. O vendedor preencheria durante a chamada, e as respostas alimentariam a oportunidade.
- **Gravação:** Se a chamada fosse gravada, usaria transcrição automática (por exemplo, Whisper) para sugerir esses campos e pediria confirmação ao vendedor.
- **Implementação:**
  - Criaria `call_notes` com respostas em JSON validadas por um schema Zod versionado do roteiro.
  - Adicionaria busca textual no Postgres (`tsvector`).
  - Exibiria as anotações na linha do tempo junto com os contatos.

## Processo de desenvolvimento e decisões técnicas

Parti do prazo de cinco dias corridos e do pedido de implementar apenas uma das quatro automações. Escolhi entregar um CRM que leva uma oportunidade do cadastro ao fechamento ou à perda e implementar o follow-up. Não integrei um CRM externo: usei os dados e o PostgreSQL do próprio projeto. Registrei os outros três problemas como propostas de evolução.

Organizei o trabalho de dentro para fora para testar as regras sem depender da aplicação inteira e só depois conectá-las à interface:

1. Contratos compartilhados e regras puras de domínio.
2. Schema PostgreSQL, carga fiel dos dados do case e carga sintética determinística.
3. API Fastify, persistência transacional e automação de follow-up.
4. Interface Next.js organizada por feature.
5. Documentação, verificações automatizadas e revisão manual do fluxo.

Escolhi essa ordem para reduzir acoplamento: mantive a regra de transição independente de HTTP, o plano de follow-up independente do cron e os contratos compartilhados entre API e interface. Assim, consigo testar o comportamento sem subir a aplicação inteira e deixar claro onde cada garantia é aplicada.

No plano original, distribuí o trabalho pelo prazo do case: comecei por contratos e domínio; passei ao banco, à carga e à API transacional; em seguida implementei o job de follow-up e o Kanban, fechando o escopo principal ao fim do terceiro dia; deixei detalhe, filtros, documentação e revisão para os dias finais. Quis validar cedo as regras de negócio e integrar a automação escolhida antes de dedicar o restante do tempo ao acabamento.

### Fronteiras da aplicação

Dividi o monorepo em quatro áreas com responsabilidades distintas:

| Área | Responsabilidade | Decisão |
|---|---|---|
| `packages/contracts` | schemas Zod de requisições, respostas e erros | Usei como fonte única para validar a API, gerar OpenAPI e validar respostas no front. |
| `packages/domain` | transições, atenção, prioridade e plano de follow-up | Mantive regras puras para testá-las sem banco, servidor ou navegador. |
| `apps/api` | Fastify, serviços, repositórios PostgreSQL, migrations e jobs | Escrevi SQL explícito e parametrizado; concentrei validação e transações nos serviços. |
| `apps/web` | Next.js, componentes e interação | Organizei por feature e deixei em `shared` apenas o que é realmente reutilizado. |

Na API, coloquei cada mudança de etapa numa transação. O serviço bloqueia a oportunidade com `SELECT ... FOR UPDATE`, confere `expectedVersion`, aplica as regras e grava a oportunidade e o histórico juntos. Se a versão ficou antiga, devolvo `409 VERSION_CONFLICT`; o front desfaz a atualização otimista. Com isso evito que duas pessoas sobrescrevam silenciosamente uma à outra ou que uma falha deixe a etapa salva sem o respectivo histórico.

Adotei Problem Details (RFC 9457) para os erros. Mantenho `code` estável e em inglês para clientes de API; escrevo `title` e `detail` em pt-BR para orientar a pessoa na interface. Deixei autenticação completa fora do escopo porque o enunciado dispensa essa entrega; descrevi os controles presentes e os reforços que eu faria para produção na seção de segurança.

No front, usei React Query para o estado do servidor, a URL para busca e filtros e estado local para as interações da tela. Não incluí Zustand porque não encontrei estado global de interface que justificasse outra camada. Usei `dnd-kit` no quadro e uma atualização otimista para responder sem esperar; se a API recusa a mudança, restauro o estado anterior. Carrego o drawer sob demanda com `lazy` e `Suspense`, uso `useDeferredValue` para manter a busca responsiva e `useTransition` ao trocar filtros.

### Priorização e o custo de espelhar a regra no banco

Comecei com uma regra simples de atenção: oportunidade aberta sem contato ou com pelo menos dois dias corridos desde o último contato. Na carga sintética de 87 oportunidades, ela sinaliza 59. Percebi que a regra responde quem precisa de atenção, mas sozinha não responde quem deve vir primeiro. Então acrescentei os quatro portões de urgência documentados acima para ordenar esses casos pelo risco de perder a venda, sem ampliar o conjunto de oportunidades consideradas atrasadas.

Escolhi a ordem pela possibilidade de recuperar a venda. Uma oportunidade sem contato ainda não começou a ser trabalhada; o evento iminente tem uma data de produção que não se move; uma proposta vencida ainda pode ser reemitida; por fim, fica o silêncio sem outro prazo crítico. Na carga sintética, os três primeiros portões somam 21 oportunidades e 38 ficam no caso base de contato atrasado. Dei três níveis à faixa lateral para distinguir esses riscos sem repetir em cor a explicação textual do card.

Calculo a prioridade a cada leitura em vez de armazená-la, para evitar migrações quando a regra mudar. Isso me obriga a manter expressões equivalentes em TypeScript e SQL: ordeno no banco antes de limitar os resultados, porque ordenar depois da paginação poderia deixar os casos mais urgentes fora da página. Aceitei esse custo e reduzi o risco de divergência com `attention-sql-mirror.test.ts`, que executa a expressão SQL real contra entradas de borda e compara o resultado com a função de domínio. Também confirmei que o teste detecta uma alteração deliberada na comparação de validade da proposta.

### Por que a automação é um job e a urgência é calculada na leitura

Separei as duas necessidades do problema 4. Para evitar esquecimentos, agendei um job que roda a cada 15 minutos por padrão, também é executado quando a API inicia e pode ser disparado manualmente por `POST /follow-up/run`. Ele registra lembretes pendentes e pode avisar por webhook mesmo quando ninguém está com o CRM aberto. Para organizar o trabalho de hoje, calculo a prioridade na leitura do quadro e do painel. Uso a mesma ordenação nas duas superfícies para que nunca discordem sobre qual caso vem primeiro.

Fiz o job idempotente para suportar chamadas repetidas ou simultâneas: uso `pg_advisory_xact_lock` para serializar execuções, um índice único parcial para permitir só um lembrete aberto por oportunidade e `INSERT ... ON CONFLICT DO NOTHING` para tornar a inserção repetida segura. Encerro um lembrete quando registro contato recente, finalizo a oportunidade ou desaparece a condição de atenção. Mantive o plano de criação e encerramento numa função pura, que posso testar sem cron ou banco.

Tratei o sino como notificação e fila de ação, não como seção de histórico. O estado aberto já existe no funil e o painel serve para agir, então não mostro lembretes encerrados ali. Uso um toast para avisar enquanto a tela está aberta e o título da aba para manter a contagem enquanto a pessoa não olha. Derivo essa contagem dos lembretes abertos ainda não vistos; se um lembrete for encerrado antes, ele deixa de ser anunciado. Não criei estado de leitura por usuário porque o case dispensa autenticação.

### Decisões de interface e seus trade-offs

Mantive uma largura de coluna que preserva a leitura dos cards e escolhi rolar horizontalmente quando elas não cabem. Considerei encolhê-las, mas isso reduziria o espaço para o conteúdo comercial. Acrescentei um gradiente nas bordas para mostrar quando há conteúdo fora da tela; deixei-o decorativo, sem captura de ponteiro, para não interferir no arrasto nem em leitores de tela.

Dividi o quadro por responsabilidade: deixei `board.tsx` coordenar o contexto e as regras de movimento, `board-column.tsx` representar cada etapa e `draggable-card.tsx` representar o card. Coloquei medição e indicação de rolagem em `shared/ui/scroll-fade.tsx` para reutilizá-las sem acoplar ao funil. Mantive coluna e card na feature de pipeline porque dependem de etapas, atenção e arrasto.

Não implementei tour nem modal de boas-vindas. Preferi orientar onde a dúvida aparece: explico a causa nos estados vazios, o motivo da atenção no card, os lembretes no painel e as etapas permitidas quando alguém tenta um destino inválido. Aceitei que uma pessoa nova aprende no próprio fluxo, sem visita guiada, porque o produto é interno e deve ajudar a localizar rapidamente o que trabalhar hoje.

### Tratamento dos dados e do calendário

Mantive os dados do PDF em `CASE_OPPORTUNITIES_AS_GIVEN` e corrigi na carga apenas a oportunidade perdida sem motivo, porque a regra exige essa informação. Preservei os campos em branco como `null` e registrei a etapa importada como início conhecido do histórico, sem inventar etapas anteriores. Armazeno datas de calendário como `YYYY-MM-DD`, sem fuso, e uso `America/Sao_Paulo` para determinar “hoje”.

Não congelei o relógio em 15/10/2026 porque “dias sem contato” e “proposta vencida” envelheceriam e o cabeçalho passaria a mostrar uma data antiga. Em vez disso, faço o seed deslocar as datas para o dia em que roda, preservando os intervalos. Aceitei que as datas carregadas não sejam cópias literais do PDF e mantive o dado original para comparação.

### Validação e limites

Configurei `pnpm typecheck`, `pnpm test` e `pnpm build` como verificações do projeto. A suíte atual registra 60 testes de domínio, 23 integrações com PostgreSQL e 5 testes de formatação monetária no front. Os testes de integração usam `TEST_DATABASE_URL` e são pulados quando ela não está configurada; limpo o banco informado durante a execução. Nas verificações manuais que registrei, cobri arrasto, rollback após `409`, motivo de perda, filtros na URL, encerramento de lembrete por contato, execução manual do job e notificação de lembrete novo.

Deixei fora do escopo autenticação, distribuição automática de leads, enriquecimento de empresas, captura estruturada de ligações, envio de e-mail ou push e paginação além de 500 oportunidades por filtro. Fiz esse recorte para entregar uma automação funcional em vez de simular os quatro problemas sem integração real.

Houve assistência de IA durante a implementação (Claude Code com Claude Opus e Codex em etapas posteriores). As decisões de produto e arquitetura foram definidas antes de cada etapa e revisadas no resultado. A IA ajudou na implementação e na revisão de inconsistências; as regras críticas foram protegidas por testes, e as verificações automatizadas e manuais acima registram a validação realizada.

## Estrutura

```
apps/
  api/    Fastify: modules/{opportunities,follow-up,sellers,system}, db/ (migrations, seed), cli/
  web/    Next.js: src/app (rotas), src/shared (api, ui, formatação), src/features/{pipeline,opportunity-detail,reminders,filters}
packages/
  contracts/  schemas Zod compartilhados (requisição, resposta, erros)
  domain/     regras puras: transições, atenção, plano de follow-up, datas
```
