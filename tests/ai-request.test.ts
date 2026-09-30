import { test } from "node:test";
import assert from "node:assert/strict";
import { requestGemini } from "../apps/api/src/ai/request";
const url = "https://provider.invalid/generate";
test("temporary provider failures recover without changing the request or deadline", async () => {
  const waits: number[] = [],
    warnings: string[] = [];
  const signal = AbortSignal.timeout(1000);
  let attempts = 0;
  const response = await requestGemini(
    url,
    { method: "POST", body: "private input", signal },
    {
      fetch: async (_url, init) => {
        assert.equal(init?.signal, signal);
        assert.equal(init?.body, "private input");
        return ++attempts < 3
          ? new Response("private provider output", { status: 503 })
          : new Response("result");
      },
      wait: async (ms) => {
        waits.push(ms);
      },
      random: () => 0,
      warn: (message) => warnings.push(message),
    },
  );
  assert.equal(await response.text(), "result");
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal(attempts, 3);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((message) => !message.includes("private")));
});
test("permanent provider errors are not retried and private bodies are not exposed", async () => {
  for (const status of [400, 401, 402, 403, 404]) {
    let attempts = 0;
    await assert.rejects(
      requestGemini(
        url,
        {},
        {
          fetch: async () => {
            attempts++;
            return new Response("secret", { status });
          },
          wait: async () => {
            assert.fail("must not wait");
          },
          warn: () => {},
        },
      ),
      /AI_PROVIDER_UNAVAILABLE/,
    );
    assert.equal(attempts, 1);
  }
});
test("persistent overload stops after three attempts and honors Retry-After", async () => {
  let attempts = 0;
  const waits: number[] = [];
  await assert.rejects(
    requestGemini(
      url,
      {},
      {
        fetch: async () => {
          attempts++;
          return new Response("", {
            status: 429,
            headers: { "Retry-After": "4" },
          });
        },
        wait: async (ms) => {
          waits.push(ms);
        },
        warn: () => {},
        random: () => 0,
      },
    ),
    /AI_PROVIDER_UNAVAILABLE/,
  );
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [4000, 4000]);
});
test("an aborted request does not start another provider attempt", async () => {
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(
    requestGemini(
      url,
      { signal: controller.signal },
      {
        fetch: async () => {
          attempts++;
          return new Response("", { status: 503 });
        },
        wait: async () => {
          controller.abort();
        },
        warn: () => {},
      },
    ),
  );
  assert.equal(attempts, 1);
});
test("network errors retry without leaking exception details", async () => {
  let attempts = 0;
  const warnings: string[] = [];
  const result = await requestGemini(
    url,
    {},
    {
      fetch: async () => {
        if (++attempts === 1) throw new Error("secret URL");
        return new Response("ok");
      },
      wait: async () => {},
      warn: (message) => warnings.push(message),
    },
  );
  assert.equal(result.status, 200);
  assert.equal(attempts, 2);
  assert.ok(warnings.every((message) => !message.includes("secret")));
});

test("a configured alternative is used after provider overload with the same body and deadline", async () => {
  const calls: string[] = [];
  const signal = AbortSignal.timeout(1000);
  const result = await requestGemini(
    url,
    { body: "same-input", signal },
    {
      fallbackUrl: "https://provider.invalid/alternative",
      fetch: async (input, init) => {
        calls.push(String(input));
        assert.equal(init?.body, "same-input");
        assert.equal(init?.signal, signal);
        return new Response("", { status: calls.length === 1 ? 503 : 200 });
      },
      wait: async () => {},
      warn: () => {},
    },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [url, "https://provider.invalid/alternative"]);
});
