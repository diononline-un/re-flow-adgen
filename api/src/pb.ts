import PocketBase from "pocketbase";
import { PB_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from "./config.ts";

export const pb = new PocketBase(PB_URL);

export async function superuserLogin(): Promise<void> {
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Returns authed user id from a Bearer token, or null for guests. */
export async function userFromToken(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  const client = new PocketBase(PB_URL);
  client.authStore.save(token);
  try {
    const res = await client.collection("users").authRefresh();
    return res.record as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Validates a superuser (admin) Bearer token. */
export async function adminFromToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const client = new PocketBase(PB_URL);
  client.authStore.save(token);
  try {
    await client.collection("_superusers").authRefresh();
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUser(rec: Record<string, unknown>): Record<string, unknown> {
  const { api_key_encrypted, api_key_hash, recovery_code_hash, passwordHash, tokenKey, email, ...rest } = rec;
  void api_key_encrypted; void api_key_hash; void recovery_code_hash; void passwordHash; void tokenKey; void email;
  return rest;
}

export function fileUrl(collection: string, recordId: string, filename: string): string {
  const token = pb.authStore.token;
  return `${PB_URL}/api/files/${collection}/${recordId}/${filename}?token=${encodeURIComponent(token ?? "")}`;
}

/** Rewrites internal PB URLs to the browser-reachable /pb/ path. */
export function browserFileUrl(url: string): string {
  return url.replace(PB_URL, "/pb");
}

/** File URL for a record's file field, browser-ready. */
export function recordFileUrl(record: Record<string, unknown>, filename: string): string {
  const url = pb.files.getUrl(record, filename) as unknown as string;
  return browserFileUrl(url);
}
