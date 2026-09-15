import { pb } from "./pb.ts";
import { ADMIN_PASSWORD } from "./config.ts";

const PLATFORMS: Array<{
  platform: string;
  title_limit: number;
  description_limit: number;
  max_images: number;
  image_min_side: number;
  hashtag_limit: number;
  tone_notes: string;
  system_prompt: string;
}> = [
  {
    platform: "ebay",
    title_limit: 80,
    description_limit: 5000,
    max_images: 24,
    image_min_side: 500,
    hashtag_limit: 0,
    tone_notes: "sachlich, keyword-dicht, scanbar mit Bullet-Points",
    system_prompt:
      "Marke, Produktart und Schlüsselattribute in die ersten 50 Zeichen des Titels. Beschreibung mit Bullet-Points, Item-Specifics (Marke, Größe, Farbe, Zustand) ausfüllen. Keine Kontaktdaten, kein Verkauf außerhalb eBays.",
  },
  {
    platform: "kleinanzeigen",
    title_limit: 65,
    description_limit: 3500,
    max_images: 20,
    image_min_side: 0,
    hashtag_limit: 0,
    tone_notes: "mobil, ehrlich, knapp",
    system_prompt:
      "Mobil-optimiert: die wichtigsten Fakten (Zustand, Preis, Abholung/Versand) in die ersten ca. 99 Zeichen der Beschreibung. Ehrlicher, knapper Stil, keine Hashtags.",
  },
  {
    platform: "vinted",
    title_limit: 60,
    description_limit: 1000,
    max_images: 20,
    image_min_side: 0,
    hashtag_limit: 0,
    tone_notes: "ehrlich, Maße betonen",
    system_prompt:
      "Titel-Formel: Marke + Artikelart + Farbe + Größe. Maße (Bund, Länge, Schrittlänge etc.) explizit angeben, Mängel ehrlich nennen. Käuferschutz-Kultur: lieber zu ehrlich als zu vage.",
  },
  {
    platform: "depop",
    title_limit: 0,
    description_limit: 1000,
    max_images: 4,
    image_min_side: 640,
    hashtag_limit: 5,
    tone_notes: "locker, persönlich, Hashtags",
    system_prompt:
      "Titel und Beschreibung bilden EIN gemeinsames Feld (Gesamtlimit beachten). Die ersten 4–5 Wörter tragen die wichtigsten Keywords. Lockerer, persönlicher Ton, wie an eine Freundin/einen Freund. Genau 5 Hashtags, immer voll ausnutzen.",
  },
];

const text = (name: string, opts: Record<string, unknown> = {}) => ({
  name, type: "text", required: false, max: 0, ...opts,
});
const number = (name: string, opts: Record<string, unknown> = {}) => ({
  name, type: "number", required: false, ...opts,
});
const bool = (name: string, opts: Record<string, unknown> = {}) => ({
  name, type: "bool", required: false, ...opts,
});
const date = (name: string, opts: Record<string, unknown> = {}) => ({
  name, type: "date", required: false, ...opts,
});
const json = (name: string, opts: Record<string, unknown> = {}) => ({
  name, type: "json", required: false, ...opts,
});
const relation = (name: string, collectionId: string, opts: Record<string, unknown> = {}) => ({
  name, type: "relation", required: false, maxSelect: 1, collectionId, cascadeDelete: false, ...opts,
});

const SYSTEM_FIELDS: Array<Record<string, unknown>> = [
  { name: "created", type: "autodate", system: true, required: false, onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", system: true, required: false, onCreate: true, onUpdate: true },
];

async function ensureCollection(
  name: string,
  type: "base" | "auth",
  fields: Array<Record<string, unknown>>,
): Promise<string> {
  // PB 0.30 legt Systemfelder bei API-Create nicht automatisch an
  const withSystem = type === "base" ? [...fields, ...SYSTEM_FIELDS] : fields;

  let existing: Record<string, unknown> | null = null;
  try {
    existing = (await pb.collections.getOne(name)) as unknown as Record<string, unknown>;
  } catch {
    existing = null;
  }

  if (!existing) {
    const created = await pb.collections.create({ name, type, fields: withSystem } as any);
    return created.id as string;
  }

  // Fehlende Felder ergänzen (PB bootstrappt z. B. eine Default-users-Collection)
  const current = (existing.fields as Array<Record<string, unknown>>) ?? [];
  const currentNames = new Set(current.map((f) => String(f.name)));
  const missing = withSystem.filter((f) => !currentNames.has(String(f.name)));
  if (missing.length > 0) {
    await pb.collections.update(existing.id as string, {
      fields: [...current, ...missing],
    } as any);
  }
  return existing.id as string;
}

/** Korrigiert den Typ eines bestehenden Felds (alte Daten gehen verloren — nur Dev-Seed). */
async function fixFieldType(
  collectionId: string,
  fieldName: string,
  expectedType: string,
  replacement: Record<string, unknown>,
): Promise<void> {
  const col = (await pb.collections.getOne(collectionId)) as unknown as Record<string, unknown>;
  const fields = (col.fields as Array<Record<string, unknown>>) ?? [];
  const field = fields.find((f) => String(f.name) === fieldName);
  if (!field || String(field.type) === expectedType) return;
  const without = fields.filter((f) => String(f.name) !== fieldName);
  await pb.collections.update(collectionId, { fields: without } as any);
  await pb.collections.update(collectionId, { fields: [...without, replacement] } as any);
}

export async function seed(): Promise<void> {
  const usersId = await ensureCollection("users", "auth", [
    text("username", { required: true, unique: true, min: 3, max: 32, pattern: "^[a-zA-Z0-9_.-]+$" }),
    text("tenant_id", { required: true, max: 100 }),
    text("preferred_ui_lang", { required: false, max: 10 }),
    text("last_listing_lang", { required: false, max: 10 }),
    bool("support_tier"),
    bool("blocked"),
    number("gens_free_used"),
    text("api_key_encrypted", { max: 2000 }),
    text("api_key_provider", { max: 20 }),
    text("api_key_hash", { max: 64 }),
    text("recovery_code_hash", { max: 200 }),
    bool("is_admin"),
  ]);

  const generationsId = await ensureCollection("generations", "base", [
    relation("user_id", usersId),
    text("tenant_id", { required: true, max: 100 }),
    text("platform", { required: true, max: 30 }),
    text("listing_lang", { required: true, max: 10 }),
    text("input_keywords", { max: 5000 }),
    json("vision_result_json"),
    json("output_json"),
    {
      name: "images", type: "file", required: false, maxSelect: 24, maxSize: 10485760,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      thumbs: [],
    },
    text("ip", { max: 64 }),
    text("fingerprint_hash", { max: 64 }),
  ]);

  const feedbackId = await ensureCollection("feedback", "base", [
    relation("generation_id", generationsId, { cascadeDelete: true }),
    number("rating", { required: true }),
    text("comment", { max: 5000 }),
    text("ticket_id", { max: 150 }),
  ]);

  // Altbestand aus früherem Boot: ticket_id war Relation — zu Text korrigieren
  await fixFieldType(feedbackId, "ticket_id", "text", text("ticket_id", { max: 150 }));

  await ensureCollection("tickets", "base", [
    relation("feedback_id", feedbackId, { required: true, cascadeDelete: true }),
    {
      name: "status", type: "select", required: true, maxSelect: 1,
      values: ["offen", "in Bearbeitung", "geschlossen"],
    },
    text("admin_note", { max: 5000 }),
    date("closed_at"),
  ]);

  await ensureCollection("usage_counters", "base", [
    text("fingerprint_hash", { max: 64 }),
    text("api_key_hash", { max: 64 }),
    text("ip_last_seen", { max: 64 }),
    number("count"),
    bool("flagged"),
    bool("unlocked_by_admin"),
    number("accounts_seen"),
    number("key_changes"),
    text("bound_user_id", { max: 150 }),
  ]);

  await ensureCollection("platform_configs", "base", [
    text("platform", { required: true, unique: true, max: 30 }),
    number("title_limit"),
    number("description_limit"),
    number("max_images"),
    number("image_min_side"),
    number("hashtag_limit"),
    text("tone_notes", { max: 500 }),
    text("system_prompt", { max: 5000 }),
  ]);

  for (const p of PLATFORMS) {
    try {
      const existing = await pb.collection("platform_configs").getFirstListItem(`platform = "${p.platform}"`);
      await pb.collection("platform_configs").update(existing.id as string, p);
    } catch {
      await pb.collection("platform_configs").create(p);
    }
  }

  // App-Admin dionoffline (falls nicht vorhanden) — Passwort = ADMIN_INITIAL_PASSWORD aus ENV
  if (ADMIN_PASSWORD) {
    try {
      const existing = (await pb.collection("users").getFirstListItem('username = "dionoffline"')) as unknown as Record<string, unknown>;
      if (!existing.is_admin) {
        await pb.collection("users").update(existing.id as string, { is_admin: true });
      }
    } catch {
      await pb.collection("users").create({
        email: "dionoffline@adgen.local",
        emailVisibility: false,
        password: ADMIN_PASSWORD,
        passwordConfirm: ADMIN_PASSWORD,
        username: "dionoffline",
        tenant_id: "default",
        preferred_ui_lang: "de",
        last_listing_lang: "",
        support_tier: false,
        blocked: false,
        gens_free_used: 0,
        api_key_encrypted: "",
        api_key_provider: "",
        api_key_hash: "",
        recovery_code_hash: "",
        is_admin: true,
      });
    }
  }
}
