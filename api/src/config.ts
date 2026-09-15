export const PB_URL = process.env.PB_URL ?? "http://pocketbase:8080";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "diononline@adgen.local";
export const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD ?? "";
export const PROVIDER_STUB = (process.env.PROVIDER_STUB ?? "true") === "true";
export const FREE_GENERATIONS = 5;
export const SUPPORT_TIER_DAILY_CAP = 1000;
export const MAX_RETRIES = 2;

// BYOK gekippt: Server-seitige Provider-Keys (nur ENV, nie ins Repo).
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export const LISTING_LANGS = ["de", "en", "fr", "it", "nl", "es"];

export function providerKey(provider: string): string {
  if (provider === "deepseek") return DEEPSEEK_API_KEY;
  if (provider === "anthropic") return ANTHROPIC_API_KEY;
  return "";
}

/** Fallback-Provider, falls der primäre fehlschlägt (nur wenn Key vorhanden). */
export function fallbackProvider(primary: string): string | null {
  if (primary === "deepseek" && ANTHROPIC_API_KEY) return "anthropic";
  if (primary === "anthropic" && DEEPSEEK_API_KEY) return "deepseek";
  return null;
}
