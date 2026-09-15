import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import PocketBase from "pocketbase";
import { pb, superuserLogin, userFromToken, adminFromToken, sanitizeUser, recordFileUrl } from "./pb.ts";
import { encryptSecret, decryptSecret, hashFingerprint, hashApiKey } from "./crypto.ts";
import { FREE_GENERATIONS, SUPPORT_TIER_DAILY_CAP, MAX_RETRIES, ADMIN_EMAIL, PB_URL, PROVIDER_STUB } from "./config.ts";
import { makeAdapter } from "./providers.ts";
import type { PlatformConfig } from "./providers.ts";
import { runHarness } from "./harness.ts";
import { seed } from "./seed.ts";

type UserRec = Record<string, any>;

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

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

async function getKeyCounter(apiKeyHash: string): Promise<UserRec | null> {
  try {
    return (await pb
      .collection("usage_counters")
      .getFirstListItem(`api_key_hash = "${apiKeyHash}"`)) as unknown as UserRec;
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

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await superuserLogin();
  await seed();

  app.get("/api/health", async () => ({ ok: true, service: "re-flow-adgen-api" }));

  // ------------------------------------------------------------------ Auth

  app.post("/api/auth/register", async (req: FastifyRequest, reply: FastifyReply) => {
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
        api_key_encrypted: "",
        api_key_provider: "",
        api_key_hash: "",
        recovery_code_hash: "",
      })) as unknown as UserRec;
    } catch (err: any) {
      const data = err?.response?.data ?? {};
      if (data?.email?.code === "validation_not_unique") {
        return fail(reply, 409, "username_taken", "Dieser Username ist bereits vergeben.");
      }
      if (data?.username?.code === "validation_not_unique") {
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

  app.post("/api/auth/login", async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.get("/api/me", async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    return reply.send({ user: sanitizeUser(user) });
  });

  // ------------------------------------------------------- Key-Settings

  app.put("/api/me/settings", async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const body = req.body as UserRec;
    const patch: UserRec = {};

    if (body.apiKey !== undefined && String(body.apiKey).trim() !== "") {
      const apiKey = String(body.apiKey).trim();
      const provider = String(body.provider ?? "anthropic");
      if (!["anthropic", "deepseek"].includes(provider)) {
        return fail(reply, 400, "invalid_provider", "Provider muss 'anthropic' oder 'deepseek' sein.");
      }
      const keyHash = hashApiKey(apiKey);
      const existing = await getKeyCounter(keyHash);
      if (existing && existing.bound_user_id && existing.bound_user_id !== user.id) {
        // Key gehört bereits einem anderen Account → Account sperren (PRD §6)
        await pb.collection("users").update(user.id as string, { blocked: true });
        return fail(reply, 403, "key_in_use", "Dieser API-Key ist bereits einem anderen Account zugeordnet. Dein Account wurde gesperrt.");
      }
      patch.api_key_encrypted = encryptSecret(apiKey);
      patch.api_key_provider = provider;
      patch.api_key_hash = keyHash;
    }
    if (body.preferredUiLang !== undefined) patch.preferred_ui_lang = String(body.preferredUiLang);
    if (body.lastListingLang !== undefined) patch.last_listing_lang = String(body.lastListingLang);

    if (Object.keys(patch).length === 0) return fail(reply, 400, "empty_patch", "Keine Änderungen übermittelt.");

    const updated = (await pb.collection("users").update(user.id as string, patch)) as unknown as UserRec;

    if (patch.api_key_hash) {
      const keyCounter = await getKeyCounter(patch.api_key_hash);
      const changes = keyCounter ? Number(keyCounter.key_changes ?? 0) + 1 : 1;
      if (keyCounter) {
        await pb.collection("usage_counters").update(keyCounter.id as string, {
          bound_user_id: user.id,
          key_changes: changes,
          flagged: keyCounter.flagged || changes > 5,
        });
      } else {
        await pb.collection("usage_counters").create({
          fingerprint_hash: "",
          api_key_hash: patch.api_key_hash,
          ip_last_seen: req.ip ?? "",
          count: 0,
          flagged: false,
          unlocked_by_admin: false,
          accounts_seen: 0,
          key_changes: 1,
          bound_user_id: user.id,
        });
      }
    }

    return reply.send({ user: sanitizeUser(updated) });
  });

  // ------------------------------------------------------- Quota

  app.get("/api/quota", async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.get("/api/platforms", async () => {
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

  app.post("/api/generate", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));

    const images: Array<{ data: string; mediaType: string }> = [];
    for (const img of Array.isArray(body?.images) ? body.images : []) {
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
    const keywords = String(body?.keywords ?? "").slice(0, 2000);
    const fingerprintRaw = String(body?.fingerprintHash ?? "").slice(0, 256);
    const fingerprintHash = fingerprintRaw ? hashFingerprint(fingerprintRaw) : "";
    const counter = fingerprintHash ? await getCounter(fingerprintHash) : null;

    if (user?.blocked) return fail(reply, 403, "blocked", "Account gesperrt. Bitte wende dich an den Support.");
    if (counter?.flagged && !counter?.unlocked_by_admin) {
      return fail(reply, 403, "flagged", "Dieses Gerät wurde gesperrt. Bitte wende dich an den Support.");
    }

    // Key ermitteln
    let apiKey = "";
    let provider = "";
    if (user) {
      if (!user.api_key_encrypted && !PROVIDER_STUB) {
        return fail(reply, 400, "no_key", "Kein API-Key hinterlegt. Lege ihn unter Einstellungen an.");
      }
      apiKey = PROVIDER_STUB ? "" : decryptSecret(String(user.api_key_encrypted));
      provider = PROVIDER_STUB ? "stub" : String(user.api_key_provider ?? "anthropic");
    } else {
      apiKey = String(body?.apiKey ?? "").trim();
      provider = String(body?.provider ?? "");
      if (!apiKey && !PROVIDER_STUB) {
        return fail(reply, 400, "no_key", "Als Gast gib einen API-Key für diese Generation an.");
      }
      if (PROVIDER_STUB) provider = "stub";
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

    // Adapter + Pipeline
    const adapter = makeAdapter(provider, apiKey);
    let vision;
    let result;
    try {
      vision = await adapter.visionExtract({ images, keywords, lang: listingLang });
      result = await runHarness(
        adapter,
        { config, vision, keywords, lang: listingLang },
        MAX_RETRIES,
      );
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 400);
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

  app.get("/api/history", async (req: FastifyRequest, reply: FastifyReply) => {
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

  app.post("/api/feedback", async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!user) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const body = req.body as UserRec;
    const generationId = String(body?.generationId ?? "");
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

  app.post("/api/admin/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as UserRec;
    const password = String(body?.password ?? "");
    try {
      const res = await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, password);
      return reply.send({ token: res.token });
    } catch {
      return fail(reply, 401, "invalid_credentials", "Falsches Passwort.");
    }
  });

  app.get("/api/admin/stats", async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = await adminFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!ok) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");

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

  app.get("/api/admin/tickets", async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = await adminFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!ok) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
    const list = (await pb.collection("tickets").getList(1, 100, {
      sort: "-created",
      expand: "feedback_id",
    })) as unknown as { items: UserRec[] };
    return reply.send({ items: list.items });
  });

  app.patch("/api/admin/tickets/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = await adminFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
    if (!ok) return fail(reply, 401, "unauthorized", "Nicht eingeloggt.");
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
}
