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

- Uma oportunidade precisa de atenção quando está aberta e não tem contato, ou quando o último contato ocorreu há dois ou mais dias corridos.
- Mover para Perdida exige um motivo.
- Fechamento e Perdida são etapas finais.
- Etapas a partir da apresentação de orçamento exigem valor estimado positivo e pelo menos um item de brinde.
- Cada item de brinde tem `name` e `quantity`.
- Mudanças de oportunidade usam concorrência otimista por `expectedVersion`.

O PDF não definiu se os dias seriam corridos ou úteis. Foram escolhidos dias corridos e a decisão foi documentada. Ele também não definiu todos os retornos possíveis no funil, então foram permitidos apenas retornos explícitos de uma etapa que fazem sentido para o negócio.

### Automação de follow-up

O job agendado roda a cada 15 minutos por padrão, e o mesmo serviço está disponível em `POST /follow-up/run` para execução manual. Ele cria lembretes para oportunidades que precisam de atenção e encerra lembretes quando um contato recente é registrado ou a oportunidade chega a uma etapa final.

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

## Tratamento dos dados

As sete oportunidades fornecidas pelo case são preservadas em `CASE_OPPORTUNITIES_AS_GIVEN`. Uma seed determinística separada adiciona 80 registros sintéticos para testar uma faixa maior da interface e das consultas.

Os dados de origem não foram normalizados silenciosamente. A `OPP-2007` chegou como Perdida sem o motivo exigido pela nova regra, então a seed registra de forma explícita a correção “Motivo não registrado na carga original.” Outras entradas atípicas, como propostas vencidas e campos em branco, continuam visíveis como dados ou alertas, em vez de serem inventadas ou apagadas. A tabela completa está no [README](../README.md#inconsist%C3%AAncias-da-carga-inicial-e-como-foram-tratadas).

Para tornar o resultado reproduzível, a data de negócio usa por padrão `2026-10-15`, a data de referência do case. Ela pode ser removida para usar a data real.

## Validação

As verificações configuradas no repositório foram executadas a partir da raiz depois da implementação:

```bash
pnpm typecheck
pnpm test
pnpm build
```

As três concluíram com sucesso no estado final da implementação. A suíte de testes inclui 52 testes de domínio e 5 testes de integração de follow-up. O build gera o bundle da API e as rotas Next.js `/` e `/lembretes`.

Também foram registradas verificações manuais da interface para arrastar e soltar, rollback após um `409`, diálogo de motivo de perda, filtros na URL, encerramento de lembrete por contato e execução manual do follow-up. Essas verificações complementam, e não substituem, os testes automatizados das regras críticas.

## Limites da entrega e próximos passos

O case deixa deliberadamente de fora autenticação, autorização por vendedor, criação de oportunidades pela interface, envio de lembretes por e-mail ou push e paginação acima de 500 itens no quadro por filtro. O [README](../README.md#limita%C3%A7%C3%B5es) documenta esses limites e os reforços de produção que seriam priorizados em seguida.

## Uso de IA

Houve assistência de IA durante a implementação. As decisões técnicas e de produto foram definidas antes de cada etapa: stack, transições de etapa, problema escolhido, estratégia de idempotência, tratamento dos dados de origem e fronteiras entre features. O resultado foi revisado pelos comandos configurados de build, typecheck e teste, com cobertura automatizada para as regras críticas de negócio.
