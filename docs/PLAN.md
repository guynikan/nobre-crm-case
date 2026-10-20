# Plano de execução — Case Nobre Brindes (CRM de oportunidades)

Prazo: 5 dias corridos. Data de referência dos dados: 15/10/2026.

**Integração pedida pelo PDF (uma linha):** escolher 1 dos 4 problemas e implementar uma automação funcional integrada ao *nosso próprio* CRM, com testes das regras críticas; o PDF diz explicitamente "não precisa integrar um CRM real". Escolha: problema 4 (follow-up / lembretes de retorno).

## 1. Plano por dia
| Dia | Entrega | Estado |
|---|---|---|
| 1 | Monorepo pnpm, contratos Zod compartilhados, regras de domínio (pipeline, motivo de perda, atenção 2 dias) com testes | feito (`537810d`) |
| 2 | Migration Postgres, seed das 7 oportunidades (valores de origem preservados + correções explícitas) e seed sintético determinístico; API Fastify: erros Problem Details, repositório, serviço transacional | seed feito (`34e1508`); serviço em `07fb9ab` (WIP) |
| 3 | API completa (rotas, job de follow-up com node-cron + endpoint manual) e front: board kanban com dnd-kit, update otimista com rollback. **Fim do dia 3: escopo congelado.** | em andamento |
| 4 | Detalhe da oportunidade (histórico, contatos, brindes), lista de lembretes, filtros/busca na URL, estados de erro/carregamento | — |
| 5 | README (execução, decisões, inconsistências do seed, limitações, uso de IA, os 3 problemas não implementados), build/teste limpos, revisão final | — |

## 2. Arquitetura
- `packages/contracts`: schemas Zod (fonte única dos tipos da API e do front).
- `packages/domain`: funções puras (transições, etapas finais, atenção, datas de calendário), testadas.
- `apps/api` (Fastify + `fastify-type-provider-zod`, Postgres via `pg`, SQL explícito):
  - `db/` migrations SQL versionadas, seed do case e sintético.
  - `modules/opportunities` (repositório SQL + serviço com transação, `SELECT … FOR UPDATE`, checagem de versão, histórico de etapas na mesma transação).
  - `modules/follow-up` (job node-cron diário + `POST /follow-up/run`; abre/resolve lembretes, idempotente).
  - `shared/errors.ts` (Problem Details RFC 9457: `code` em inglês, `title`/`detail` em pt-BR), `shared/clock.ts` (relógio injetável, fixável em 15/10/2026).
- `apps/web` (React 19 + Vite, feature-based):
  - `src/app` (providers, router, QueryClient), `src/shared` (api client, ui, formatação pt-BR).
  - `src/features/pipeline` (board, dnd-kit, mutação otimista com rollback), `src/features/opportunity-detail` (lazy + Suspense), `src/features/reminders`, `src/features/filters` (estado na URL, `useDeferredValue` na busca, `useTransition` na troca de filtro).
  - Estado: React Query para servidor, URL para filtros, estado local para UI. Sem Zustand.

## 3. Contratos e regras principais
- Etapas: Lead → Orçamento → Negociação → Fechamento | Perdida. Fechamento e Perdida são finais.
- `POST /opportunities/:id/stage` com `{ toStage, expectedVersion, lostReason? }`; Perdida exige motivo; conflito de versão → 409.
- `POST /opportunities/:id/contacts` (`contactedOn` não pode ser futuro; oportunidade final não aceita contato).
- `GET /opportunities` paginado, filtros por vendedor, etapa, atenção e busca.
- Atenção: oportunidade não final sem contato registrado ou com ≥ 2 dias sem contato.
- Brindes: `{ name, quantity }`.
- Erros: Problem Details com `code` (`VALIDATION_FAILED`, `NOT_FOUND`, `VERSION_CONFLICT`, `OPPORTUNITY_IS_FINAL`, …).
- Seed: valores de origem preservados; cada exceção (ex.: OPP-2007 Perdida sem motivo) recebe tratamento explícito registrado, sem afrouxar as regras novas.

## 4. Critérios de entrega
- `pnpm install && pnpm db:migrate && pnpm db:seed` sobe o banco com as 7 do case; `db:seed:synthetic` adiciona 80 determinísticas.
- `pnpm test` verde (regras críticas: transições, perda com motivo, atenção, follow-up).
- `pnpm build` e `pnpm typecheck` limpos.
- Mover card no board persiste; falha da API desfaz o movimento e mostra erro em pt-BR.
- Rodar o follow-up cria lembretes para quem precisa de atenção e não duplica ao rodar de novo.

**Lacunas reais do PDF:** não define retornos de etapa (decisão nossa), nem SLA do primeiro contato, nem autenticação/perfis; campos em branco são intencionais e sem regra de preenchimento; não diz se "dias sem contato" são corridos ou úteis (adotamos corridos).
