export const PB_URL = process.env.PB_URL ?? "http://pocketbase:8080";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "diononline@adgen.local";
export const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD ?? "";
export const PROVIDER_STUB = (process.env.PROVIDER_STUB ?? "true") === "true";
export const FREE_GENERATIONS = 5;
export const SUPPORT_TIER_DAILY_CAP = 1000;
export const MAX_RETRIES = 2;
