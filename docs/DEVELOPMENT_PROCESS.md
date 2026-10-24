# Processo de desenvolvimento — Case Nobre CRM

## Objetivo

Este documento explica como o case foi planejado e construído. Ele registra as decisões, os trade-offs, a abordagem de validação e os limites conhecidos da implementação. Não é uma alegação de que o sistema está pronto para produção.

## Ponto de partida

O enunciado pediu um CRM interno para o time comercial da Nobre Brindes e exigiu que um entre quatro problemas operacionais fosse resolvido com uma automação. Ele diz explicitamente que não é preciso integrar um CRM externo.

O problema escolhido foi follow-up: ajudar o vendedor a identificar as oportunidades abertas que precisam de ação hoje. A escolha usa informações que já existem no CRM, entrega valor sem depender de terceiros e permite testar a regra.

## Planejamento e escopo

O trabalho foi planejado para cinco dias corridos, com escopo congelado no fim do terceiro dia. O plano está em [PLAN.md](./PLAN.md).

A implementação foi dividida nas seguintes camadas:

1. Contratos compartilhados e regras puras de domínio.
2. Schema PostgreSQL, seed original do case e seed sintético determinístico.
3. API Fastify, mudanças transacionais de oportunidade e automação de follow-up.
4. Interface Next.js organizada por feature.
5. Documentação e verificações automatizadas finais.

A sequência manteve as regras de negócio independentes de HTTP, SQL e interface. Assim, transições de etapa, cálculo de atenção e planejamento de lembretes podem ser testados sem executar a aplicação inteira.

## Decisões técnicas

### Monorepo e fronteiras

O monorepo pnpm tem quatro áreas principais:

```text
apps/api                 API Fastify, acesso ao PostgreSQL, job agendado
apps/web                 interface Next.js
packages/contracts       schemas Zod compartilhados e definições de erros da API
packages/domain          regras puras de negócio e seus testes
```

Os schemas Zod são a fonte única dos contratos de requisição e resposta. A API os usa para validação e geração de OpenAPI; o frontend os usa para validar as respostas do servidor.

### API e persistência

A API usa Fastify, PostgreSQL, SQL parametrizado por `pg` e `fastify-type-provider-zod`.

Mudanças de etapa da oportunidade rodam dentro de uma transação. O serviço bloqueia a oportunidade com `SELECT ... FOR UPDATE`, confere a versão enviada, valida a transição, atualiza o registro e grava o histórico de etapas na mesma transação. Uma escrita desatualizada devolve `409 VERSION_CONFLICT`, o que dá ao cliente uma forma segura de reverter uma atualização otimista.

Os erros usam Problem Details (RFC 9457): valores estáveis e legíveis por máquina de `code` ficam em inglês, enquanto `title` e `detail` ficam em português para a interface.

### Regras do funil

- Uma oportunidade precisa de atenção quando está aberta e não tem contato, ou quando o último contato ocorreu há dois ou mais dias corridos. O que precisa de atenção é ordenado por portões de urgência, descritos adiante.
- Mover para Perdida exige um motivo.
- Fechamento e Perdida são etapas finais.
- Etapas a partir da apresentação de orçamento exigem valor estimado positivo e pelo menos um item de brinde.
- Cada item de brinde tem `name` e `quantity`.
- Mudanças de oportunidade usam concorrência otimista por `expectedVersion`.

O PDF não definiu se os dias seriam corridos ou úteis. Foram escolhidos dias corridos e a decisão foi documentada. Ele também não definiu todos os retornos possíveis no funil, então foram permitidos apenas retornos explícitos de uma etapa que fazem sentido para o negócio.

### Prioridade dentro da atenção

A regra de dois dias responde se uma oportunidade está vencida, e responde bem. O que ela não responde é por onde começar. Medido sobre a carga completa de 87 oportunidades, o limite sinaliza 59 delas: um alerta que dispara em dois terços do quadro não orienta ninguém, e o vendedor volta a decidir no olho justamente o que a ferramenta deveria decidir por ele.

As oportunidades vencidas são ordenadas por quatro portões, avaliados na ordem e com o primeiro que casa vencendo:

1. `UNTOUCHED` — nenhum contato registrado. Ninguém começou a venda, e este é o problema que o enunciado lista em primeiro lugar.
2. `EVENT_IMMINENT` — evento do cliente dentro de sete dias. É uma data dura: perdido o prazo, não sobra tempo de produção.
3. `PROPOSAL_EXPIRED` — validade da proposta já passou. É o mais recuperável dos três, porque um orçamento pode ser reemitido.
4. `OVERDUE_CONTACT` — o caso base, só idade do último contato.

A ordem é de irrecuperabilidade, não de gravidade percebida: o critério foi quanto da venda se perde se o vendedor deixar aquele caso para amanhã. Com a mesma carga, os três primeiros portões somam 21 oportunidades e o caso base fica com 38, o que devolve ao alerta a capacidade de significar alguma coisa.

A decisão mais importante aqui é de fronteira: **os portões ordenam, nunca ampliam**. Uma oportunidade contatada hoje continua fora da lista mesmo com evento amanhã, porque alguém comprovadamente já está cuidando dela. Isso preserva o significado de `needsAttention`, e portanto também o da automação de follow-up, que cria lembretes a partir dele — mudar a abrangência mudaria silenciosamente o que é um lembrete.

A prioridade é derivada a cada requisição e nunca persistida, então nenhuma migração acompanha a regra. Em compensação, ela existe duas vezes: em TypeScript, em `attentionPriority`, e espelhada em SQL, porque a ordenação e a paginação acontecem no banco. Essa duplicação é o custo real da decisão, e é o mesmo custo que a regra de atenção já pagava.

A duplicação não é evitável aqui. Ordenar em TypeScript depois da consulta ordenaria apenas a página já trazida, e a primeira página deixaria de conter as oportunidades mais urgentes do funil; eliminar o lado TypeScript tiraria a regra do pacote de domínio, onde ela é função pura e testável, e impediria o cálculo otimista que o front faz ao arrastar um card antes de a API responder.

O que é evitável é a divergência silenciosa entre as duas. `attention-sql-mirror.test.ts` roda a expressão SQL real contra o banco de teste e compara, caso a caso, com a função de domínio: quinze entradas que cobrem as bordas do horizonte, a validade que vence hoje, o limite exato de dias, o lead nunca contatado e as etapas finais. Nenhuma linha é escrita, porque o espelho é expressão pura e um `VALUES` basta. O teste foi verificado contra uma mutação deliberada — trocar `<` por `<=` na comparação de validade — e acusa a diferença.

Na interface, os quatro portões viram **dois pesos**, não quatro. A faixa lateral do card distingue apenas "vencida" de "vencida com prazo contra", porque o card já diz em palavras qual é o prazo — "Proposta vencida em 21/10", "Evento em 2 dias". Repetir isso em cor seria transformar o quadro na árvore de natal que a mudança veio desfazer. A granularidade fina fica na ordem dos cards dentro da coluna.

### Automação de follow-up

O job agendado roda a cada 15 minutos por padrão, e o mesmo serviço está disponível em `POST /follow-up/run` para execução manual. Ele cria lembretes para oportunidades que precisam de atenção e encerra lembretes quando um contato recente é registrado ou a oportunidade chega a uma etapa final.

O problema 4 do enunciado tem duas metades, e elas foram resolvidas em lugares diferentes. "É fácil esquecer de dar retorno" é o job: ele roda sem ninguém pedir, grava o pendente e pode avisar fora do app pelo webhook, inclusive quando a tela está fechada — que é exatamente quando se esquece. "Como ajudar o vendedor a se organizar" são os portões de urgência, que decidem a ordem. A segunda metade não é automação nenhuma: só calcula quando alguém renderiza uma página. São camadas complementares, e a mesma ordenação rege o quadro e a lista de lembretes, para que as duas superfícies nunca discordem sobre qual é o caso mais urgente.

A automação é deliberadamente idempotente:

- `pg_advisory_xact_lock` serializa execuções manuais e agendadas.
- Um índice único parcial permite apenas um lembrete aberto por oportunidade.
- As inserções usam `ON CONFLICT DO NOTHING`.

Isso torna seguras execuções repetidas e concorrentes.

### Frontend

O app web usa Next.js 16 App Router e React 19, pois o enunciado pede Next.js. Os módulos são organizados por feature:

```text
features/pipeline
features/opportunity-detail
features/reminders
features/filters
shared/api
shared/ui
```

O React Query controla o estado de servidor. Busca e filtros ficam na URL, portanto um link compartilhado preserva a visualização. O estado local fica limitado às interações da interface. Zustand não foi adicionado de propósito. O quadro usa dnd-kit e aplica uma atualização otimista de etapa, revertendo-a se a API rejeitar a requisição. O drawer de detalhe é carregado sob demanda com `Suspense`; `useDeferredValue` mantém a busca responsiva e `useTransition` é usado na troca de filtros.

Quando as colunas não cabem na viewport, o quadro rola na horizontal em vez de encolhê-las para caber. É o comportamento padrão de quadros kanban e preserva uma largura de coluna em que o card continua legível. O custo é que, em telas menores, as etapas finais ficam fora de vista sem nenhum sinal de que existem.

A alternativa considerada foi reduzir a largura das colunas conforme a viewport, o que elimina a rolagem mas aperta o conteúdo do card. Optou-se por manter a largura e sinalizar a rolagem: as bordas do quadro recebem um gradiente que aparece apenas do lado que ainda esconde conteúdo e some ao chegar no início ou no fim. O gradiente é decorativo (`aria-hidden`, sem captura de ponteiro), portanto não interfere no arrastar e soltar nem na leitura por leitores de tela.

O quadro está dividido em três módulos: `board.tsx` guarda apenas o `DndContext`, as regras de movimento e o overlay, enquanto a coluna e o card vivem em `board-column.tsx` e `draggable-card.tsx`.

A divisão seguiu o motivo de mudança, não o tamanho do arquivo. A medição de rolagem virou um componente genérico em `shared/ui/scroll-fade.tsx`, porque nada nela é específico do funil e outra lista horizontal poderia reaproveitá-la. Coluna e card ficaram em `features/pipeline`, já que dependem do estado do arrasto e dos rótulos de etapa, e promovê-los a compartilhados só criaria acoplamento sem reuso real.

### Orientação do usuário

Não há tour guiado, modal de boas-vindas nem fluxo de onboarding. O critério do enunciado é se o vendedor encontra rápido a negociação que precisa trabalhar hoje, e um CRM interno de time pequeno não tem o problema de descoberta que justificaria esse tipo de fluxo. Se o quadro precisasse de um tour para ser compreendido, o problema estaria no quadro.

A orientação foi colocada onde a dúvida aparece:

- O cabeçalho da página de lembretes explica em uma frase qual regra gerou aquela lista e em que situações um lembrete se encerra sozinho.
- Os estados vazios informam a causa, não apenas a ausência. Filtro sem resultado sugere limpar os filtros; banco sem dados aponta o comando de seed; nenhum lembrete aberto é descrito como todas as oportunidades em aberto terem tido contato recente.
- O card diz em palavras por que exige atenção, como “9 dias sem contato” ou “Nenhum contato registrado”, em vez de depender apenas da cor da borda.
- Um destino inválido no arrastar e soltar é recusado com a lista das etapas alcançáveis a partir da etapa atual, e as colunas bloqueadas ficam esmaecidas durante o arrasto.
- A data de negócio fixa do case aparece no cabeçalho e explica, no próprio título, por que não é a data real.

O custo da escolha é que nada ensina a interface de forma ativa: quem abre o app pela primeira vez descobre as regras conforme esbarra nelas. Para um time que usa a ferramenta todo dia, esse custo é pago uma vez; para um produto self-service, a conclusão provavelmente seria outra.

## Tratamento dos dados

As sete oportunidades fornecidas pelo case são preservadas em `CASE_OPPORTUNITIES_AS_GIVEN`. Uma seed determinística separada adiciona 80 registros sintéticos para testar uma faixa maior da interface e das consultas.

Os dados de origem não foram normalizados silenciosamente. A `OPP-2007` chegou como Perdida sem o motivo exigido pela nova regra, então a seed registra de forma explícita a correção “Motivo não registrado na carga original.” Outras entradas atípicas, como propostas vencidas e campos em branco, continuam visíveis como dados ou alertas, em vez de serem inventadas ou apagadas. A tabela completa está no [README](../README.md#inconsist%C3%AAncias-da-carga-inicial-e-como-foram-tratadas).

A data de referência do case, `2026-10-15`, é o que torna os dados legíveis: "dias sem contato" e "proposta vencida" só significam algo em relação a um hoje. Congelar a data de negócio resolveria isso, mas envelheceria: poucos dias depois o cabeçalho anunciaria uma data que não é a de ninguém.

A carga desloca as linhas do enunciado para o dia em que o seed roda, somando a cada data a diferença entre a data de referência e hoje. Os intervalos são preservados, então a `OPP-2002` tem 9 dias sem contato em qualquer execução, e a tabela em `CASE_OPPORTUNITIES_AS_GIVEN` continua idêntica ao PDF — o deslocamento é da carga, não do dado de origem. O preço é que as datas exibidas não coincidem, uma a uma, com as do enunciado; em troca, o relógio de negócio é o relógio real, sem variável de ambiente para configurar.

## Validação

As verificações configuradas no repositório foram executadas a partir da raiz depois da implementação:

```bash
pnpm typecheck
pnpm test
pnpm build
```

As três concluíram com sucesso no estado final da implementação. A suíte de testes inclui 60 testes de domínio e 20 de integração contra PostgreSQL, entre follow-up e o espelho SQL da prioridade. O build gera o bundle da API e as rotas Next.js `/` e `/lembretes`.

Também foram registradas verificações manuais da interface para arrastar e soltar, rollback após um `409`, diálogo de motivo de perda, filtros na URL, encerramento de lembrete por contato e execução manual do follow-up. Essas verificações complementam, e não substituem, os testes automatizados das regras críticas.

## Limites da entrega e próximos passos

O case deixa deliberadamente de fora autenticação, autorização por vendedor, criação de oportunidades pela interface, envio de lembretes por e-mail ou push e paginação acima de 500 itens no quadro por filtro. O [README](../README.md#limita%C3%A7%C3%B5es) documenta esses limites e os reforços de produção que seriam priorizados em seguida.

## Uso de IA

Houve assistência de IA durante a implementação. As decisões técnicas e de produto foram definidas antes de cada etapa: stack, transições de etapa, problema escolhido, estratégia de idempotência, tratamento dos dados de origem e fronteiras entre features. O resultado foi revisado pelos comandos configurados de build, typecheck e teste, com cobertura automatizada para as regras críticas de negócio.
