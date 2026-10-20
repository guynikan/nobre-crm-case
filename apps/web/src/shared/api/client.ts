import { problemDetailsSchema, type ProblemDetails } from "@nobre/contracts";
import type { z } from "zod";
import { API_URL } from "../config";

/** A failed API call. `title` is already user-facing pt-BR text. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | null,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(title);
    this.name = "ApiError";
  }
}

const NETWORK_ERROR = "Não foi possível falar com o servidor. Verifique se a API está rodando.";

interface RequestOptions<T extends z.ZodType> {
  schema: T;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/** Calls the API and validates the response against the shared contract. */
export async function apiRequest<T extends z.ZodType>(path: string, options: RequestOptions<T>): Promise<z.infer<T>> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, null, NETWORK_ERROR);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = problemDetailsSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(response.status, parsed.data, parsed.data.title, parsed.data.detail);
    }
    throw new ApiError(response.status, null, `Erro inesperado (${response.status}). Tente novamente.`);
  }
  return options.schema.parse(payload);
}

export function errorMessage(error: unknown): { title: string; detail?: string } {
  if (error instanceof ApiError) return { title: error.title, ...(error.detail ? { detail: error.detail } : {}) };
  return { title: "Algo deu errado ao exibir os dados. Recarregue a página." };
}
