> **Umgezogen.** Dieses Projekt lebt weiter im Sammelrepo [reseller-toolbelt](https://github.com/diononline-un/reseller-toolbelt) unter dem Ordner `adgen`. Dieses Repo ist archiviert und bekommt keine Updates mehr.

# Re-Flow-AdGen

Anzeigenschreiber: Produktfoto + Stichworte → plattformfertiges Listing für eBay, Kleinanzeigen, Vinted und Depop. Modellkosten trägt der Betreiber über serverseitige Provider-Keys (BYOK wurde gekippt).

PRD: [`PRD-AdScribe-BYOK-Anzeigenschreiber.md`](PRD-AdScribe-BYOK-Anzeigenschreiber.md) · Specs/Tasks: [`openspec/`](openspec/)

## Stack

- **PocketBase** (SQLite, eigene Instanz) — Auth, Daten, Dateien, Admin-UI. Port `127.0.0.1:2013`.
- **API-Service** (Node/Fastify, TypeScript) — Modellaufrufe (Vision-Check + Plattform-Harness, DeepSeek primär, Anthropic-Fallback), Kontingent-/Anti-Abuse-Logik, harte Zeichenlimit-Validierung, Prompt-Injection-Schutz. Port `127.0.0.1:2015`.
- **Frontend** (React 18, Vite 5, TS, Tailwind, i18next) — 8-bit/Grayscale-Design mit Dark-Mode (Default dark) + Light-Mode, 6 UI-Sprachen, HEIC→JPEG-Konvertierung beim Upload. Port `2014` (nginx, proxyt `/api` und `/pb`).

## Lokaler Start

```bash
cp .env.example .env.local
openssl rand -hex 32            # ENCRYPTION_KEY eintragen
# DEEPSEEK_API_KEY setzen (Anthropic-Fallback optional), PROVIDER_STUB=false für echte Aufrufe
# ADMIN_INITIAL_PASSWORD setzen (Superuser diononline + App-Admin dionoffline)

docker compose up -d --build
make smoke                     # End-to-End-Check (28 Checks)
```

- App: <http://localhost:2014>
- PocketBase-Admin-UI (Superuser `diononline`): <http://127.0.0.1:2013/_/>
- Eigenes Admin-Panel: <http://localhost:2014/admin> — Superuser-Passwort ODER App-Admin-User `dionoffline` (is_admin). User-Management (Support-Tier geben/entziehen, sperren/entsperren), geflaggte Geräte entsperren, Tickets, Statistiken.
- API-Health: <http://127.0.0.1:2015/api/health>

Der API-Service seedet beim Boot idempotent: Collections (users, generations, usage_counters, feedback, tickets, platform_configs), Admin-Superuser, App-Admin `dionoffline`, Plattform-Konfigurationen.

## Provider-Keys & Stub-Modus

- `DEEPSEEK_API_KEY` (primär, Modell `DEEPSEEK_MODEL`, Default `deepseek-flash`), `ANTHROPIC_API_KEY` (Fallback, nur aktiv wenn gesetzt, Modell `ANTHROPIC_MODEL`). Schlägt der primäre Provider fehl, versucht der API-Service automatisch den Fallback.
- `PROVIDER_STUB=true` (Default): feste Stub-Antworten, keine Kosten — für Entwicklung und Smoke-Tests. Der Smoke-Test erzwingt Stub pro Request (`provider: "stub"`), damit er auch bei echten Keys nichts kostet.

## Sicherheit

- Keys nur in `.env.local` (gitignored, chmod 600), nie im Repo, kein Klartext-Logging.
- Auth ausschließlich über PocketBase (Passwort-Hash); Admin-Endpunkte akzeptieren nur Superuser- oder is_admin-Tokens.
- Rate-Limits pro Route (Login/Register 10/min, Generate 20/min, Admin 120/min, …), Body-Limit 32 MB, Bild-Cap 5 MB/Datei und Plattform-Maxima.
- Prompt-Injection-Schutz: Stichworte werden bereinigt und im Prompt als reine Daten delimitiert.
- nginx: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, server_tokens off; Helmet auf der API; PocketBase/API nur auf 127.0.0.1 gebunden.
- Fingerprint-Kontingent (5 free), Account-Sperrlogik, Flagging; IP nur als Log-Signal.

## Tests

```bash
cd api && npm install && node --test src/   # Unit-Tests (Harness-Validierung, Provider-Adapter, Prompt-Sanitize)
make smoke                                   # E2E über nginx → API → PocketBase (28 Checks)
```

## Offene Punkte (bewusst auf später verschoben)

- Echte Zahlungsabwicklung (Stripe) — aktuell PayPal.me-Spendenhinweis (`paypal.me/gruenebluete`, Tier-Auswahl prefillt den Betrag) + manuell vergebener Support-Tier.
- Cloudflare R2 für Bild-Storage (lokal: PocketBase-Dateispeicher).
- WebAuthn/Passkey für Admin (aktuell Passwort-Login).
- Edge-Rate-Limiting für Produktivbetrieb; Plattform-Limits vor Produktivsetzung gegen offizielle Verkäufer-Hilfeseiten verifizieren.
