import { test } from "node:test";
import assert from "node:assert/strict";
import { validateListing, enforceLimits, runHarness } from "./harness.ts";
import type { PlatformConfig, ProviderAdapter, VisionResult, ListingResult } from "./providers.ts";

const ebay: PlatformConfig = {
  platform: "ebay", title_limit: 80, description_limit: 5000, max_images: 24,
  hashtag_limit: 0, tone_notes: "", system_prompt: "",
};
const depop: PlatformConfig = {
  platform: "depop", title_limit: 0, description_limit: 1000, max_images: 4,
  hashtag_limit: 5, tone_notes: "", system_prompt: "",
};

const listing = (over: Partial<ListingResult>): ListingResult => ({
  title: "T".repeat(90),
  description: "Beschreibung",
  tags: [],
  hashtags: [],
  specifics: [],
  ...over,
});

test("validateListing erkennt zu langen eBay-Titel", () => {
  const issues = validateListing(listing({}), ebay);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].field, "title");
  assert.equal(issues[0].limit, 80);
});

test("validateListing prüft Depop-Titel+Beschreibung kombiniert", () => {
  const l = listing({ title: "T".repeat(600), description: "D".repeat(500) });
  const issues = validateListing(l, depop);
  assert.ok(issues.some((i) => i.field === "title+description"));
});

test("validateListing zählt Hashtags", () => {
  const l = listing({ title: "kurz", hashtags: ["a", "b", "c", "d", "e", "f"] });
  const issues = validateListing(l, depop);
  assert.ok(issues.some((i) => i.field === "hashtags" && i.actual === 6));
});

test("enforceLimits kürzt hart auf Limits", () => {
  const out = enforceLimits(listing({}), ebay);
  assert.ok(out.title.length <= 80);
  const depopOut = enforceLimits(listing({ title: "T".repeat(600), description: "D".repeat(500) }), depop);
  assert.ok(depopOut.title.length + depopOut.description.length <= 1000);
  assert.ok(depopOut.hashtags!.length <= 5);
});

test("runHarness retried bei Limit-Verstoß und kürzt final", async () => {
  let calls = 0;
  const adapter: ProviderAdapter = {
    name: "stub",
    async visionExtract(): Promise<VisionResult> {
      return { category: "", brand: "", color: "", condition: "", flaws: "", material: "", notes: "" };
    },
    async generateListing(): Promise<ListingResult> {
      calls++;
      return listing({}); // immer zu lang
    },
  };
  const res = await runHarness(adapter, { config: ebay, vision: {} as VisionResult, keywords: "", lang: "de" }, 2);
  assert.equal(calls, 3); // 1 initial + 2 Retries
  assert.ok(res.truncated);
  assert.ok(res.listing.title.length <= 80);
});
