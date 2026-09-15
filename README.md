# Re-Flow-AdGen

BYOK-Anzeigenschreiber: Produktfoto + Stichworte → plattformfertiges Listing für eBay, Kleinanzeigen, Vinted und Depop. Nutzer bringen ihren eigenen Claude- oder DeepSeek-API-Key mit.

PRD: [`PRD-AdScribe-BYOK-Anzeigenschreiber.md`](PRD-AdScribe-BYOK-Anzeigenschreiber.md) · Specs/Tasks: [`openspec/`](openspec/)

## Stack

- **PocketBase** (SQLite, eigene Instanz) — Auth, Daten, Dateien, Admin-UI. Port `127.0.0.1:2013`.
- **API-Service** (Node/Fastify, TypeScript) — BYOK-Modellaufrufe (Vision-Check + Plattform-Harness), AES-256-GCM-Key-Verschlüsselung, Kontingent-/Anti-Abuse-Logik, harte Zeichenlimit-Validierung. Port `127.0.0.1:2015`.
- **Frontend** (React 18, Vite 5, TS, Tailwind, i18next) — 8-bit/Grayscale-Design, 6 UI-Sprachen. Port `2014` (nginx, proxyt `/api` und `/pb`).

## Lokaler Start

```bash
cp .env.example .env.local
# ENCRYPTION_KEY erzeugen:
openssl rand -hex 32   # → in .env.local eintragen
# ADMIN_INITIAL_PASSWORD setzen (wird nur beim ersten Boot als Superuser-Passwort genutzt)

docker compose up -d --build
make smoke    # End-to-End-Check (17 Checks)
```

- App: <http://localhost:2014>
- PocketBase-Admin-UI (User-Management, Fingerprint-Flags, Support-Tier, Tickets, platform_configs): <http://127.0.0.1:2013/_/>
- Eigene Admin-Statistik-Seite: <http://localhost:2014/admin> (gleiches Superuser-Passwort)
- API-Health: <http://127.0.0.1:2015/api/health>

Der API-Service seedet beim Boot idempotent: Collections (users, generations, usage_counters, feedback, tickets, platform_configs) + Admin-Superuser + Plattform-Konfigurationen.

## BYOK (echte Modellaufrufe)

`.env.local`: `PROVIDER_STUB=false` setzen, Stack neu bauen. Dann im Frontend unter **Einstellungen** einen Key hinterlegen (Claude = Anthropic API, oder DeepSeek) — gespeichert wird nur die AES-256-GCM-verschlüsselte Form. Modellnamen: Env-Variablen `ANTHROPIC_MODEL` (Default `claude-sonnet-4-5`) und `DEEPSEEK_MODEL` (Default `deepseek-flash`).

`PROVIDER_STUB=true` (Default, keine Kosten): Vision-Erkennung und Listing kommen aus festen Stub-Antworten — für Entwicklung und Smoke-Tests.

## Tests

```bash
cd api && npm install && node --test src/   # Unit-Tests (Harness-Validierung, Provider-Adapter)
make smoke                                   # E2E über nginx → API → PocketBase
```

## Offene Punkte (bewusst auf später verschoben)

- Echte Zahlungsabwicklung (Stripe) — aktuell PayPal.me-Spendenhinweis + manuell vergebener Support-Tier.
- Cloudflare R2 für Bild-Storage (lokal: PocketBase-Dateispeicher).
- WebAuthn/Passkey für Admin (aktuell Passwort-Login).
- Edge-Rate-Limiting (Caddy/nginx) für Produktivbetrieb; lokal: Fastify-Limiter im API-Service.
- Plattform-Limits vor Produktivsetzung gegen offizielle Verkäufer-Hilfeseiten verifizieren.
