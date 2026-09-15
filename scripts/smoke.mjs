#!/usr/bin/env node
// Smoke-Test für den lokalen Re-Flow-AdGen-Stack (nginx → API → PocketBase).
// Nutzung: node scripts/smoke.mjs [BASE_URL]  (Default: http://localhost:2014)

const BASE = process.argv[2] ?? "http://localhost:2014";
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD ?? "";

let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function j(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // leerer Body ok
  }
  return { status: res.status, data };
}

const TS = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const IMG =
  "data:image/jpeg;base64," +
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  ).toString("base64");

// 1. Health + Plattformen
const health = await j("GET", "/api/health");
ok("Health-Check", health.status === 200 && health.data.ok === true);
const platforms = await j("GET", "/api/platforms");
ok(
  "Plattform-Konfigurationen",
  platforms.status === 200 && platforms.data.platforms?.length === 4,
  `${platforms.data.platforms?.map((p) => p.platform).join(",")}`,
);

// 2. Registrierung + Login
const uname = `smoke_${TS}`;
const reg = await j("POST", "/api/auth/register", {
  username: uname,
  password: "smoketest123",
  fingerprintHash: `smoke-fp-${TS}`,
});
ok("Registrierung", reg.status === 200 && !!reg.data.token && reg.data.user.username === uname);
const token = reg.data.token;
const login = await j("POST", "/api/auth/login", { username: uname, password: "smoketest123" });
ok("Login", login.status === 200 && !!login.data.token);

// 3. Key speichern (verschlüsselt; Antwort darf den Klartext nie enthalten)
const SMOKE_KEY = `sk-ant-smoke-${TS}`;
const keySave = await j(
  "PUT",
  "/api/me/settings",
  { apiKey: SMOKE_KEY, provider: "anthropic" },
  token,
);
ok(
  "Key-Speicherung (verschlüsselt)",
  keySave.status === 200 && !JSON.stringify(keySave.data).includes(SMOKE_KEY),
);

// 4. Generation eBay (Stub)
const gen = await j(
  "POST",
  "/api/generate",
  {
    images: [IMG],
    keywords: "Jeansjacke Blau L",
    platform: "ebay",
    listingLang: "de",
    fingerprintHash: `smoke-fp-${TS}`,
  },
  token,
);
ok(
  "Generation eBay",
  gen.status === 200 && gen.data.output?.title && gen.data.output.title.length <= 80,
  `Titel=${gen.data.output?.title?.length}Z`,
);

// 5. Generation Depop (kombiniertes Limit + Hashtags)
const depop = await j(
  "POST",
  "/api/generate",
  {
    images: [IMG],
    keywords: "Vintage Sweater",
    platform: "depop",
    listingLang: "en",
    fingerprintHash: `smoke-fp-${TS}`,
  },
  token,
);
ok(
  "Generation Depop",
  depop.status === 200 &&
    (depop.data.output?.hashtags?.length ?? 0) === 5 &&
    depop.data.output.title.length + depop.data.output.description.length <= 1000,
);

// 6. History (nur eigene)
const hist = await j("GET", "/api/history", undefined, token);
ok("History gefiltert", hist.status === 200 && hist.data.items?.length === 2);

// 7. Feedback negativ → Ticket
const fb = await j(
  "POST",
  "/api/feedback",
  { generationId: gen.data.id, rating: -1, comment: "Smoke-Test-Ticket" },
  token,
);
ok("Feedback + Ticket", fb.status === 200 && !!fb.data.ticketId);

// 8. Admin: Login, Stats, Tickets, Statuswechsel
const adminLogin = await j("POST", "/api/admin/login", { password: ADMIN_PASSWORD });
const adminOk = adminLogin.status === 200 && !!adminLogin.data.token;
ok("Admin-Login", adminOk, adminLogin.status === 401 ? "falsches/fehlendes ADMIN_INITIAL_PASSWORD" : "");
if (adminOk) {
  const at = adminLogin.data.token;
  const stats = await j("GET", "/api/admin/stats", undefined, at);
  ok("Admin-Statistiken", stats.status === 200 && stats.data.generations_total >= 2);
  const tickets = await j("GET", "/api/admin/tickets", undefined, at);
  ok("Admin-Tickets", tickets.status === 200 && tickets.data.items?.length >= 1);
  const patch = await j(
    "PATCH",
    `/api/admin/tickets/${fb.data.ticketId}`,
    { status: "geschlossen" },
    at,
  );
  ok("Ticket-Statuswechsel", patch.status === 200);
  const badAdmin = await j("GET", "/api/admin/stats", undefined, "ungueltig");
  ok("Admin-Schutz", badAdmin.status === 401);
}

// 9. Quota (Konto: 2 verbraucht → remaining 3)
const quota = await j("GET", `/api/quota?fingerprint=smoke-fp-${TS}`, undefined, token);
ok("Quota-Zähler", quota.status === 200 && quota.data.used === 2 && quota.data.remaining === 3);

// 10. Ungeschützter Gast (Stub) + Gäste-Quota
const guest = await j("POST", "/api/generate", {
  images: [IMG],
  keywords: "Gast Test",
  platform: "vinted",
  listingLang: "de",
  fingerprintHash: `smoke-guest-${TS}`,
});
ok("Gast-Generation", guest.status === 200 && !!guest.data.id);

// 11. Auth-Schutz History
const noAuthHist = await j("GET", "/api/history");
ok("History braucht Login", noAuthHist.status === 401);

// 12. Ungültige Plattform
const badPlat = await j(
  "POST",
  "/api/generate",
  { images: [IMG], keywords: "x", platform: "etsy", listingLang: "de", fingerprintHash: `smoke-x-${TS}` },
  token,
);
ok("Unbekannte Plattform abgelehnt", badPlat.status === 400 && badPlat.data.error === "unknown_platform");

console.log(failures === 0 ? "\nSMOKE OK — alle Checks grün" : `\nSMOKE FAIL — ${failures} Check(s) rot`);
process.exit(failures === 0 ? 0 : 1);
