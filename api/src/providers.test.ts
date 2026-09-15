import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DeepSeekAdapter, AnthropicAdapter, parseJson } from "./providers.ts";
import type { PlatformConfig, VisionResult } from "./providers.ts";

const calls: Array<{ url: string; init: RequestInit }> = [];
let originalFetch: typeof fetch;

beforeEach(() => {
  calls.length = 0;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ title: "T", description: "D", tags: [], hashtags: [], specifics: [] }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("DeepSeek-Adapter sendet Vision-Call im OpenAI-Format mit image_url-Block", async () => {
  const a = new DeepSeekAdapter("sk-test");
  const vision = await a.visionExtract({ images: [{ data: "QUJD", mediaType: "image/jpeg" }], keywords: "Jacke", lang: "de" });
  assert.equal(vision.title as unknown as string, "T");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.equal(body.model, "deepseek-flash");
  assert.equal(body.response_format.type, "json_object");
  const content = body.messages[0].content;
  assert.equal(content[0].type, "text");
  assert.equal(content[1].type, "image_url");
  assert.equal(content[1].image_url.url, "data:image/jpeg;base64,QUJD");
});

test("Anthropic-Adapter erzwingt Tool-Ausgabe", async () => {
  const a = new AnthropicAdapter("sk-test");
  const cfg: PlatformConfig = {
    platform: "ebay", title_limit: 80, description_limit: 5000, max_images: 24,
    hashtag_limit: 0, tone_notes: "ton", system_prompt: "sys",
  };
  await a.generateListing({ config: cfg, vision: {} as VisionResult, keywords: "", lang: "de" });
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  const init = calls[0].init;
  assert.equal((init.headers as Record<string, string>)["x-api-key"], "sk-test");
  const body = JSON.parse(String(init.body));
  assert.equal(body.tool_choice.type, "tool");
  assert.equal(body.tool_choice.name, "emit_listing");
  assert.equal(body.tools[0].name, "emit_listing");
});

test("parseJson toleriert Markdown-Fences und Drumherum-Text", () => {
  const out = parseJson<{ a: number }>('hier ```json\n{"a": 1}\n``` danach');
  assert.equal(out.a, 1);
});
