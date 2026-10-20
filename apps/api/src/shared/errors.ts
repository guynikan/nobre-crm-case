import type { ErrorCode, ProblemDetails } from "@nobre/contracts";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";

/** HTTP status and pt-BR title for each error code. Titles are shown to sellers as-is. */
const PROBLEMS: Record<ErrorCode, { status: number; title: string }> = {
  VALIDATION_FAILED: { status: 400, title: "Dados inválidos" },
  NOT_FOUND: { status: 404, title: "Oportunidade não encontrada" },
  VERSION_CONFLICT: {
    status: 409,
    title: "A oportunidade foi alterada por outra pessoa. Recarregue e tente de novo.",
  },
  SAME_STAGE: { status: 422, title: "A oportunidade já está nessa etapa" },
  STAGE_IS_FINAL: {
    status: 422,
    title: "Fechamento e Perdida são etapas finais: a oportunidade não pode mais mudar de etapa",
  },
  TRANSITION_NOT_ALLOWED: { status: 422, title: "Essa mudança de etapa não é permitida" },
  MISSING_ESTIMATED_VALUE: {
    status: 422,
    title: "Informe o valor estimado antes de avançar para Apresentação de Orçamento",
  },
  MISSING_GIFT_ITEMS: {
    status: 422,
    title: "Informe pelo menos um item de brinde antes de avançar para Apresentação de Orçamento",
  },
  LOST_REASON_REQUIRED: { status: 422, title: "Informe o motivo da perda" },
  LOST_REASON_NOT_ALLOWED: { status: 422, title: "Motivo de perda só é aceito ao marcar como Perdida" },
  ITEMS_REQUIRED_FOR_STAGE: {
    status: 422,
    title: "Nesta etapa a oportunidade precisa ter pelo menos um item de brinde",
  },
  ESTIMATED_VALUE_REQUIRED_FOR_STAGE: {
    status: 422,
    title: "Nesta etapa a oportunidade precisa ter valor estimado",
  },
  OPPORTUNITY_IS_FINAL: { status: 422, title: "Oportunidade encerrada não pode ser alterada" },
  CONTACT_IN_FUTURE: { status: 422, title: "A data do contato não pode estar no futuro" },
  RATE_LIMITED: { status: 429, title: "Muitas requisições. Aguarde um instante e tente de novo." },
  INTERNAL_ERROR: { status: 500, title: "Erro inesperado. Tente novamente em instantes." },
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export function problem(
  code: ErrorCode,
  extra: Partial<Pick<ProblemDetails, "detail" | "instance" | "errors">> = {},
): ProblemDetails {
  const { status, title } = PROBLEMS[code];
  return { type: `urn:nobre-crm:problem:${code.toLowerCase()}`, title, status, code, ...stripUndefined(extra) };
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function sendProblem(reply: FastifyReply, body: ProblemDetails) {
  return reply.status(body.status).type("application/problem+json").send(body);
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const instance = request.url;

  if (error instanceof AppError) {
    return sendProblem(reply, problem(error.code, { detail: error.detail, instance }));
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    const errors = error.validation.map((issue) => ({
      path: `${error.validationContext ?? "request"}${issue.instancePath.replaceAll("/", ".")}`,
      message: issue.message ?? "inválido",
    }));
    return sendProblem(reply, problem("VALIDATION_FAILED", { instance, errors }));
  }
  if (error.statusCode === 429) {
    return sendProblem(reply, problem("RATE_LIMITED", { instance }));
  }
  if (isResponseSerializationError(error)) {
    request.log.error({ issues: error.cause.issues }, "response does not match its contract");
    return sendProblem(reply, problem("INTERNAL_ERROR", { instance }));
  }
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    // Malformed JSON, unsupported media type and similar client errors from Fastify itself.
    return sendProblem(reply, problem("VALIDATION_FAILED", { instance, detail: error.message }));
  }
  request.log.error(error, "unhandled error");
  return sendProblem(reply, problem("INTERNAL_ERROR", { instance }));
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return sendProblem(reply, {
    ...problem("NOT_FOUND", { instance: request.url }),
    title: "Recurso não encontrado",
  });
}
