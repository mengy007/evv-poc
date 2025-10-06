// src/app/lib/api.ts

/**
 * Strongly-typed fetch helpers for client & server code.
 *
 * Usage:
 *   const data = await apiGet<MyType>("/api/sessions?limit=all");
 *   const created = await apiPost<MyType>("/api/user", { name: "Alice" });
 *
 * If an endpoint can return null, type the generic as a union:
 *   const maybe = await apiGet<MyType | null>("/api/maybe-null");
 */

export type JsonRecord = Record<string, unknown>;

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

/** Safely parse JSON; returns null on empty body or invalid JSON. */
async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Merge JSON headers into RequestInit (without clobbering others). */
function withJsonHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

/** Throw HttpError for non-2xx; otherwise return parsed JSON (or {} for 204). */
async function assertOk<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {} as T;
    }
    const data = await parseJsonSafe<T>(res);
    // If the endpoint legitimately returns null, call sites should type T as a union (T | null).
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return data as T;
  }

  type ErrBody = { error?: string } & JsonRecord;
  const body = await parseJsonSafe<ErrBody>(res);
  const msg = (body?.error ?? res.statusText) || "HTTP Error";
  throw new HttpError(msg, res.status, body);
}

/** GET JSON */
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, method: "GET" });
  return assertOk<T>(res);
}

/** POST JSON (body is JSON-serializable) */
export async function apiPost<T, B extends JsonRecord = JsonRecord>(
  url: string,
  body?: B,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...withJsonHeaders(init),
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  return assertOk<T>(res);
}

/** PUT JSON */
export async function apiPut<T, B extends JsonRecord = JsonRecord>(
  url: string,
  body?: B,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...withJsonHeaders(init),
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
  return assertOk<T>(res);
}

/** DELETE (optionally with JSON body) */
export async function apiDelete<T, B extends JsonRecord = JsonRecord>(
  url: string,
  body?: B,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...withJsonHeaders(init),
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });
  return assertOk<T>(res);
}
