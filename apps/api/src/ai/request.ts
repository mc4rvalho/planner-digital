import { setTimeout as delay } from "node:timers/promises";

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
type Dependencies = {
  fetch: typeof fetch;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  random: () => number;
  warn: (message: string) => void;
  fallbackUrl?: string;
};

// Retry only the provider call: proposal validation and saving are never retried.
export async function requestGemini(
  url: string,
  init: RequestInit,
  dependencies: Partial<Dependencies> = {},
): Promise<Response> {
  const send = dependencies.fetch ?? globalThis.fetch;
  const wait =
    dependencies.wait ?? ((ms, signal) => delay(ms, undefined, { signal }));
  const random = dependencies.random ?? Math.random;
  const warn = dependencies.warn ?? ((message) => console.warn(message));
  // One shared deadline covers all attempts and waits, not 45 seconds per attempt.
  const signal = init.signal ?? AbortSignal.timeout(45000);
  let requestUrl = url;
  for (let attempt = 1; attempt <= 3; attempt++) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await send(requestUrl, { ...init, signal });
    } catch {
      warn(
        `[Gemini] ${signal.aborted ? "timeout_or_abort" : "network_error"} attempt=${attempt}`,
      );
      if (signal.aborted || attempt === 3)
        throw new Error("AI_PROVIDER_UNAVAILABLE");
      await wait(
        1000 * 2 ** (attempt - 1) + Math.floor(random() * 250),
        signal,
      );
      continue;
    }
    if (response.ok) return response;
    // Never log API keys, request text, provider bodies, or generated content.
    warn(`[Gemini] http_status=${response.status} attempt=${attempt}`);
    if (
      [500, 502, 503, 504].includes(response.status) &&
      dependencies.fallbackUrl
    )
      requestUrl = dependencies.fallbackUrl;
    const retryAfter = response.headers.get("retry-after");
    await response.body?.cancel();
    if (!transientStatuses.has(response.status) || attempt === 3)
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const retryDelay =
      retryAfter === null
        ? 0
        : Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
    await wait(
      Math.max(
        retryDelay,
        1000 * 2 ** (attempt - 1) + Math.floor(random() * 250),
      ),
      signal,
    );
  }
  throw new Error("AI_PROVIDER_UNAVAILABLE");
}
