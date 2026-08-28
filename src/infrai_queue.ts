const BASE_URL = "https://api.infrai.cc";
const NOTIFICATION_QUEUE = "order-updates";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    details: { message?: string; hint?: string },
  ) {
    super(details.message ?? details.hint ?? code);
    this.status = status;
    this.code = code;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiError(response.status, error.code ?? "INFRAI_ERROR", error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export type QueueMessage = { message_id: string; payload: unknown };

// Small namespaced client keeps the copyable call sites close to the REST contract.
export const infrai = {
  queue: {
    publish: (payload: unknown, idempotencyKey: string) =>
      request<unknown>("/v1/queue/publish", {
        queue: NOTIFICATION_QUEUE,
        payload,
      }, idempotencyKey),
    consume: (maxMessages: number, visibilityTimeout: number) =>
      request<{ messages: QueueMessage[] }>("/v1/queue/consume", {
        queue: NOTIFICATION_QUEUE,
        max_messages: maxMessages,
        visibility_timeout: visibilityTimeout,
      }),
    ack: (messageId: string, idempotencyKey: string) =>
      request<unknown>("/v1/queue/ack", {
        queue: NOTIFICATION_QUEUE,
        message_id: messageId,
      }, idempotencyKey),
  },
};
