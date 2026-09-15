import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import PocketBase from "pocketbase";
import { pb, superuserLogin, userFromToken, adminFromToken, sanitizeUser, recordFileUrl } from "./pb.ts";
import { hashFingerprint } from "./crypto.ts";
import {
  FREE_GENERATIONS,
  SUPPORT_TIER_DAILY_CAP,
  MAX_RETRIES,
  ADMIN_EMAIL,
  PB_URL,
  PROVIDER_STUB,
  LISTING_LANGS,
  providerKey,
  fallbackProvider,
} from "./config.ts";
import { makeAdapter, sanitizeUserInput } from "./providers.ts";
import type { PlatformConfig, ProviderAdapter, VisionResult } from "./providers.ts";
import { runHarness } from "./harness.ts";
import { seed } from "./seed.ts";

type UserRec = Record<string, any>;

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

const RL = {
  auth: { max: 10, timeWindow: "1 minute" },
  gen: { max: 20, timeWindow: "1 minute" },
  normal: { max: 60, timeWindow: "1 minute" },
  feedback: { max: 30, timeWindow: "1 minute" },
  admin: { max: 120, timeWindow: "1 minute" },
};

function fail(reply: FastifyReply, code: number, error: string, message: string) {
  return reply.code(code).send({ error, message });
}

async function getCounter(fingerprintHash: string): Promise<UserRec | null> {
  try {
    return (await pb
      .collection("usage_counters")
      .getFirstListItem(`fingerprint_hash = "${fingerprintHash}"`)) as unknown as UserRec;
  } catch {
    return null;
  }
}

async function platformConfig(platform: string): Promise<PlatformConfig> {
  const rec = (await pb
    .collection("platform_configs")
    .getFirstListItem(`platform = "${platform}"`)) as unknown as UserRec;
  return {
    platform: rec.platform,
    title_limit: rec.title_limit,
    description_limit: rec.description_limit,
    max_images: rec.max_images,
    hashtag_limit: rec.hashtag_limit ?? 0,
    tone_notes: rec.tone_notes ?? "",
    system_prompt: rec.system_prompt ?? "",
  };
}

/** Führt Vision + Harness aus; bei Fehler Fallback-Provider (wenn konfiguriert). */
async function runPipeline(
  primary: string,
  opts: {
    images: { data: string; mediaType: string }[];
    keywords: string;
    lang: string;
    config: PlatformConfig;
  },
): Promise<{ vision: VisionResult; result: Awaited<ReturnType<typeof runHarness>> }> {
  const run = async (provider: string) => {
    const adapter: ProviderAdapter = makeAdapter(provider, providerKey(provider));
    const vision = await adapter.visionExtract({ images: opts.images, keywords: opts.keywords, lang: opts.lang });
    const result = await runHarness(adapter, { config: opts.config, vision, keywords: opts.keywords, lang: opts.lang }, MAX_RETRIES);
    return { vision, result };
  };
  try {
    return await run(primary);
  } catch (err) {
    const fb = fallbackProvider(primary);
    if (!fb) throw err;
    return run(fb);
  }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await superuserLogin();
  await seed();

  app.get("/api/health", async () => ({ ok: true, service: "re-flow-adgen-api" }));

  // ------------------------------------------------------------------ Auth

  app.post("/api/auth/register", { config: { rateLimit: RL.auth } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const fingerprintRaw = String(body?.fingerprintHash ?? "").slice(0, 256);
    const fingerprintHash = fingerprintRaw ? hashFingerprint(fingerprintRaw) : "";

    if (!USERNAME_RE.test(username)) {
      return fail(reply, 400, "invalid_username", "Username: 3–32 Zeichen, nur Buchstaben, Zahlen, Punkt, Minus, Unterstrich.");
    }
    if (password.length < 8) {
      return fail(reply, 400, "weak_password", "Passwort muss mindestens 8 Zeichen lang sein.");
    }

    // Sperrlogik: Fingerprint bereits einem bestehenden Account zugeordnet?
    let blocked = false;
    let flagged = false;
    const counter = fingerprintHash ? await getCounter(fingerprintHash) : null;
    if (counter && Number(counter.accounts_seen ?? 0) >= 1) {
      blocked = true;
      flagged = true; // mehrere Accounts pro Fingerprint = verdächtig
    }

    const email = `${username}@adgen.local`;
    let user: UserRec;
    try {
      user = (await pb.collection("users").create({
        email,
        emailVisibility: false,
        password,
        passwordConfirm: password,
        username,
        tenant_id: "default",
        preferred_ui_lang: String(body?.uiLang ?? "de"),
        last_listing_lang: "",
        support_tier: false,
        blocked,
        gens_free_used: 0,
        is_admin: false,
        api_key_encrypted: "",
        api_key_provider: "",
        api_key_hash: "",
        recovery_code_hash: "",
      })) as unknown as UserRec;
    } catch (err: any) {
      const data = err?.response?.data ?? {};
      if (data?.email?.code === "validation_not_unique" || data?.username?.code === "validation_not_unique") {
        return fail(reply, 409, "username_taken", "Dieser Username ist bereits vergeben.");
      }
      return fail(reply, 500, "register_failed", "Registrierung fehlgeschlagen.");
    }

    if (fingerprintHash) {
      if (counter) {
        await pb.collection("usage_counters").update(counter.id as string, {
          accounts_seen: Number(counter.accounts_seen ?? 0) + 1,
          flagged: counter.flagged || flagged,
        });
      } else {
        await pb.collection("usage_counters").create({
          fingerprint_hash: fingerprintHash,
          api_key_hash: "",
          ip_last_seen: req.ip ?? "",
          count: 0,
          flagged,
          unlocked_by_admin: false,
          accounts_seen: 1,
          key_changes: 0,
          bound_user_id: "",
        });
      }
    }

    // Login über frischen Client, damit der globale Superuser-Store intakt bleibt
    const loginClient = new PocketBase(PB_URL);
    const login = await loginClient.collection("users").authWithPassword(email, password);
    return reply.send({
      token: login.token,
      user: sanitizeUser(login.record as unknown as UserRec),
      blocked,
      warning: blocked
        ? "Dieser Account wurde gesperrt: Der Geräte-Fingerprint ist bereits einem bestehenden Account zugeordnet."
        : undefined,
    });
  });

  app.post("/api/auth/login", { config: { rateLimit: RL.auth } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) return fail(reply, 400, "missing_fields", "Username und Passwort erforderlich.");
    try {
      const loginClient = new PocketBase(PB_URL);
      const res = await loginClient.collection("users").authWithPassword(`${username}@adgen.local`, password);
      const user = res.record as unknown as UserRec;
      if (user.blocked) return fail(reply, 403, "blocked", "Account gesperrt. Bitte wende dich an den Support.");
      return reply.send({ token: res.token, user: sanitizeUser(user) });
    } catch {
      return fail(reply, 401, "invalid_credentials", "Username oder Passwort falsch.");
    }
  });

  app.get("/api/me", { config: { rateLimit: RL.normal } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    return reply.send({ user: sanitizeUser(user) });
  });

  // ------------------------------------------------------- Einstellungen

  app.put("/api/me/settings", { config: { rateLimit: RL.normal } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const body = req.body as UserRec;
    const patch: UserRec = {};

    if (body.preferredUiLang !== undefined) {
      const lang = String(body.preferredUiLang);
      if (!LISTING_LANGS.includes(lang)) return fail(reply, 400, "invalid_lang", "Unbekannte Sprache.");
      patch.preferred_ui_lang = lang;
    }
    if (body.lastListingLang !== undefined) {
      const lang = String(body.lastListingLang);
      if (!LISTING_LANGS.includes(lang)) return fail(reply, 400, "invalid_lang", "Unbekannte Sprache.");
      patch.last_listing_lang = lang;
    }

    if (Object.keys(patch).length === 0) return fail(reply, 400, "empty_patch", "Keine Änderungen übermittelt.");

    const updated = (await pb.collection("users").update(user.id as string, patch)) as unknown as UserRec;
    return reply.send({ user: sanitizeUser(updated) });
  });

  // ------------------------------------------------------- Quota

  app.get("/api/quota", { config: { rateLimit: RL.normal } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    const fingerprintRaw = String((req.query as UserRec)?.fingerprint ?? "").slice(0, 256);
    const fingerprintHash = fingerprintRaw ? hashFingerprint(fingerprintRaw) : "";
    const counter = fingerprintHash ? await getCounter(fingerprintHash) : null;

    if (user) {
      const used = Number(user.gens_free_used ?? 0);
      return reply.send({
        mode: "account",
        total: FREE_GENERATIONS,
        used,
        remaining: user.support_tier ? null : Math.max(0, FREE_GENERATIONS - used),
        supportTier: !!user.support_tier,
        blocked: !!user.blocked,
        flagged: !!(counter?.flagged && !counter?.unlocked_by_admin),
      });
    }
    const count = Number(counter?.count ?? 0);
    return reply.send({
      mode: "fingerprint",
      total: FREE_GENERATIONS,
      used: count,
      remaining: Math.max(0, FREE_GENERATIONS - count),
      supportTier: false,
      blocked: false,
      flagged: !!(counter?.flagged && !counter?.unlocked_by_admin),
    });
  });

  // ------------------------------------------------------- Platforms

  app.get("/api/platforms", { config: { rateLimit: RL.normal } }, async () => {
    const list = await pb.collection("platform_configs").getFullList({ sort: "platform" });
    return {
      platforms: (list as unknown as UserRec[]).map((p) => ({
        platform: p.platform,
        title_limit: p.title_limit,
        description_limit: p.description_limit,
        max_images: p.max_images,
        hashtag_limit: p.hashtag_limit ?? 0,
        tone_notes: p.tone_notes ?? "",
      })),
    };
  });

  // ------------------------------------------------------- Generate

  app.post("/api/generate", { config: { rateLimit: RL.gen } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));

    const images: Array<{ data: string; mediaType: string }> = [];
    const rawImages = Array.isArray(body?.images) ? body.images : [];
    if (rawImages.length > 24) return fail(reply, 400, "too_many_images", "Maximal 24 Bilder pro Anfrage.");
    for (const img of rawImages) {
      const dataUrl = String(img);
      const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
      if (!m) return fail(reply, 400, "invalid_image", "Bilder müssen als Base64-Data-URL (JPEG/PNG/WebP/GIF) kommen.");
      if (m[2].length > 7 * 1024 * 1024) {
        return fail(reply, 400, "image_too_large", "Maximal 5 MB pro Bild (Base64).");
      }
      images.push({ data: m[2], mediaType: m[1] });
    }
    if (images.length === 0) return fail(reply, 400, "no_image", "Mindestens ein Bild ist erforderlich.");

    const platform = String(body?.platform ?? "");
    const listingLang = String(body?.listingLang ?? "de");
    if (!LISTING_LANGS.includes(listingLang)) {
      return fail(reply, 400, "invalid_lang", "Unbekannte Anzeigensprache.");
    }
    const keywords = sanitizeUserInput(String(body?.keywords ?? "").slice(0, 2000));
    const fingerprintRaw = String(body?.fingerprintHash ?? "").slice(0, 256);
    const fingerprintHash = fingerprintRaw ? hashFingerprint(fingerprintRaw) : "";
    const counter = fingerprintHash ? await getCounter(fingerprintHash) : null;

    if (user?.blocked) return fail(reply, 403, "blocked", "Account gesperrt. Bitte wende dich an den Support.");
    if (counter?.flagged && !counter?.unlocked_by_admin) {
      return fail(reply, 403, "flagged", "Dieses Gerät wurde gesperrt. Bitte wende dich an den Support.");
    }

    // Kontingent
    if (user && !user.support_tier && Number(user.gens_free_used ?? 0) >= FREE_GENERATIONS) {
      return fail(reply, 429, "quota_exceeded", "Dein Freikontingent (5 Generations) ist aufgebraucht.");
    }
    if (user && user.support_tier) {
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = await pb.collection("generations").getList(1, 1, {
        filter: `user_id = "${user.id}" && created >= "${today} 00:00:00.000Z"`,
      });
      if (todayCount.totalItems >= SUPPORT_TIER_DAILY_CAP) {
        return fail(reply, 429, "daily_cap", "Tageslimit erreicht (1000 Generations).");
      }
    }
    if (!user && Number(counter?.count ?? 0) >= FREE_GENERATIONS) {
      return fail(reply, 429, "quota_exceeded", "Dein Freikontingent (5 Generations) ist aufgebraucht.");
    }

    // Konfiguration
    let config: PlatformConfig;
    try {
      config = await platformConfig(platform);
    } catch {
      return fail(reply, 400, "unknown_platform", `Unbekannte Plattform: ${platform}`);
    }
    if (images.length > config.max_images) {
      return fail(reply, 400, "too_many_images", `Maximal ${config.max_images} Bilder für ${platform}.`);
    }

    // Provider: Server-Key (BYOK gekippt). Body-Provider nur für Stub-Override (Tests).
    const requested = String(body?.provider ?? "");
    const primary =
      PROVIDER_STUB || requested === "stub"
        ? "stub"
        : requested === "deepseek" || requested === "anthropic"
          ? requested
          : providerKey("deepseek") ? "deepseek" : "anthropic";
    if (primary !== "stub" && !providerKey(primary)) {
      return fail(reply, 502, "provider_missing", `Kein API-Key für Provider ${primary} konfiguriert.`);
    }

    // Pipeline (mit Fallback-Provider)
    let vision: VisionResult;
    let result: Awaited<ReturnType<typeof runHarness>>;
    try {
      ({ vision, result } = await runPipeline(primary, { images, keywords, lang: listingLang, config }));
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 200);
      return fail(reply, 502, "provider_error", `Anbieter-Fehler: ${msg}`);
    }

    // Persistenz
    const fd = new FormData();
    fd.append("user_id", user?.id ?? "");
    fd.append("tenant_id", "default");
    fd.append("platform", platform);
    fd.append("listing_lang", listingLang);
    fd.append("input_keywords", keywords);
    fd.append("vision_result_json", JSON.stringify(vision));
    fd.append("output_json", JSON.stringify(result.listing));
    fd.append("ip", req.ip ?? "");
    fd.append("fingerprint_hash", fingerprintHash);
    for (let i = 0; i < images.length; i++) {
      const buf = Buffer.from(images[i].data, "base64");
      fd.append("images", new Blob([buf], { type: images[i].mediaType }), `image-${i + 1}.jpg`);
    }
    let record: UserRec;
    try {
      record = (await pb.collection("generations").create(fd)) as unknown as UserRec;
    } catch (err: any) {
      const detail = JSON.stringify(err?.response?.data ?? err?.originalError?.data ?? err?.message ?? err);
      return fail(reply, 500, "persist_failed", `Speichern fehlgeschlagen: ${detail.slice(0, 400)}`);
    }

    // Zähler
    if (user) {
      await pb.collection("users").update(user.id as string, {
        gens_free_used: Number(user.gens_free_used ?? 0) + 1,
      });
    }
    if (fingerprintHash) {
      if (counter) {
        await pb.collection("usage_counters").update(counter.id as string, {
          count: Number(counter.count ?? 0) + 1,
          ip_last_seen: req.ip ?? "",
        });
      } else {
        await pb.collection("usage_counters").create({
          fingerprint_hash: fingerprintHash,
          api_key_hash: "",
          ip_last_seen: req.ip ?? "",
          count: 1,
          flagged: false,
          unlocked_by_admin: false,
          accounts_seen: 0,
          key_changes: 0,
          bound_user_id: "",
        });
      }
    }

    const imageUrls = ((record.images as string[]) ?? []).map((f) => recordFileUrl(record, f));

    return reply.send({
      id: record.id,
      output: result.listing,
      vision,
      truncated: result.truncated,
      images: imageUrls,
      quotaRemaining: user
        ? user.support_tier
          ? null
          : Math.max(0, FREE_GENERATIONS - (Number(user.gens_free_used ?? 0) + 1))
        : Math.max(0, FREE_GENERATIONS - (Number(counter?.count ?? 0) + 1)),
    });
  });

  // ------------------------------------------------------- History

  app.get("/api/history", { config: { rateLimit: RL.normal } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const list = (await pb.collection("generations").getList(1, 50, {
      filter: `user_id = "${user.id}"`,
      sort: "-created",
    })) as unknown as { items: UserRec[] };
    return {
      items: list.items.map((g) => ({
        id: g.id,
        platform: g.platform,
        listing_lang: g.listing_lang,
        input_keywords: g.input_keywords,
        vision_result_json: g.vision_result_json,
        output_json: g.output_json,
        created: g.created,
        images: ((g.images as string[]) ?? []).map((f) => recordFileUrl(g, f)),
      })),
    };
  });

  // ------------------------------------------------------- Feedback

  app.post("/api/feedback", { config: { rateLimit: RL.feedback } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const body = req.body as UserRec;
    const generationId = String(body?.generationId ?? "").slice(0, 150);
    const rating = Number(body?.rating ?? 0);
    const comment = String(body?.comment ?? "").slice(0, 2000);
    if (!generationId || (rating !== 1 && rating !== -1)) {
      return fail(reply, 400, "invalid_feedback", "generationId und rating (1 oder -1) erforderlich.");
    }
    const fb = (await pb.collection("feedback").create({
      generation_id: generationId,
      rating,
      comment,
      ticket_id: "",
    })) as unknown as UserRec;

    let ticket: UserRec | null = null;
    if (rating === -1 && comment.trim() !== "") {
      ticket = (await pb.collection("tickets").create({
        feedback_id: fb.id,
        status: "offen",
        admin_note: "",
        closed_at: "",
      })) as unknown as UserRec;
      await pb.collection("feedback").update(fb.id as string, { ticket_id: ticket.id });
    }
    return reply.send({ id: fb.id, ticketId: ticket?.id ?? null });
  });

  // ------------------------------------------------------- Admin

  async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const ok = await adminFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!ok) fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    return ok;
  }

  app.post("/api/admin/login", { config: { rateLimit: RL.auth } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const password = String(body?.password ?? "");
    try {
      const client = new PocketBase(PB_URL);
      const res = await client.collection("_superusers").authWithPassword(ADMIN_EMAIL, password);
      return reply.send({ token: res.token });
    } catch {
      return fail(reply, 401, "invalid_credentials", "Falsches Passwort.");
    }
  });

  app.get("/api/admin/stats", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const gens = (await pb.collection("generations").getFullList({ batch: 500 })) as unknown as UserRec[];
    const byDay: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byLang: Record<string, number> = {};
    for (const g of gens) {
      const day = String(g.created ?? "").slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      byPlatform[String(g.platform)] = (byPlatform[String(g.platform)] ?? 0) + 1;
      byLang[String(g.listing_lang)] = (byLang[String(g.listing_lang)] ?? 0) + 1;
    }
    const users = await pb.collection("users").getList(1, 1, {});
    const ticketsOpen = await pb.collection("tickets").getList(1, 1, { filter: 'status != "geschlossen"' });
    return reply.send({
      generations_total: gens.length,
      by_day: byDay,
      by_platform: byPlatform,
      by_lang: byLang,
      users_total: users.totalItems,
      tickets_open: ticketsOpen.totalItems,
    });
  });

  app.get("/api/admin/tickets", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const list = (await pb.collection("tickets").getList(1, 100, {
      sort: "-created",
      expand: "feedback_id",
    })) as unknown as { items: UserRec[] };
    return reply.send({ items: list.items });
  });

  app.patch("/api/admin/tickets/:id", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { id } = req.params as { id: string };
    const body = req.body as UserRec;
    const status = String(body?.status ?? "");
    if (!["offen", "in Bearbeitung", "geschlossen"].includes(status)) {
      return fail(reply, 400, "invalid_status", "Status: offen / in Bearbeitung / geschlossen.");
    }
    const patch: UserRec = { status };
    if (status === "geschlossen") patch.closed_at = new Date().toISOString();
    await pb.collection("tickets").update(id, patch);
    return reply.send({ ok: true });
  });

  app.get("/api/admin/users", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const list = (await pb.collection("users").getFullList({ batch: 500, sort: "created" })) as unknown as UserRec[];
    return reply.send({
      items: list.map((u) => ({
        id: u.id,
        username: u.username,
        created: u.created,
        blocked: !!u.blocked,
        support_tier: !!u.support_tier,
        gens_free_used: Number(u.gens_free_used ?? 0),
        is_admin: !!u.is_admin,
      })),
    });
  });

  app.patch("/api/admin/users/:id", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { id } = req.params as { id: string };
    const body = req.body as UserRec;
    const patch: UserRec = {};
    if (typeof body.support_tier === "boolean") patch.support_tier = body.support_tier;
    if (typeof body.blocked === "boolean") patch.blocked = body.blocked;
    if (Object.keys(patch).length === 0) return fail(reply, 400, "empty_patch", "Keine Änderungen übermittelt.");
    await pb.collection("users").update(id, patch);
    return reply.send({ ok: true });
  });

  app.get("/api/admin/counters", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const list = (await pb.collection("usage_counters").getFullList({
      batch: 500,
      sort: "-created",
      filter: "flagged = true",
    })) as unknown as UserRec[];
    return reply.send({
      items: list.map((c) => ({
        id: c.id,
        fingerprint_hash: c.fingerprint_hash,
        count: Number(c.count ?? 0),
        accounts_seen: Number(c.accounts_seen ?? 0),
        ip_last_seen: c.ip_last_seen,
        unlocked_by_admin: !!c.unlocked_by_admin,
        created: c.created,
      })),
    });
  });

  app.patch("/api/admin/counters/:id", { config: { rateLimit: RL.admin } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { id } = req.params as { id: string };
    const body = req.body as UserRec;
    const patch: UserRec = {};
    if (typeof body.unlocked_by_admin === "boolean") patch.unlocked_by_admin = body.unlocked_by_admin;
    if (typeof body.flagged === "boolean") patch.flagged = body.flagged;
    if (Object.keys(patch).length === 0) return fail(reply, 400, "empty_patch", "Keine Änderungen übermittelt.");
    await pb.collection("usage_counters").update(id, patch);
    return reply.send({ ok: true });
  });
}
