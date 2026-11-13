# Design: Re-Flow-AdGen MVP

## Context

Greenfield-Repo `./`, bisher nur die PRD. Lokaler Docker-Stack, kein VPS-Push. Port-Ring: 2013 (PocketBase), 2014 (Frontend+Reverse-Proxy). Motivation siehe `proposal.md — Why`; Verhaltensverträge in den sechs Specs unter `specs/`.

## Goals / Non-Goals

**Goals:**
- Ein `docker compose up --build` bringt den kompletten Stack hoch (PocketBase, API, Frontend) und ist danach voll bedienbar.
- BYOK-Modellaufrufe laufen ausschließlich serverseitig; Browser-Code sieht nie fremde API-Keys.
- Reproduzierbares Setup ohne manuelle UI-Klicks: Collection-Import + Seed-Skript.

**Non-Goals:**
- Kein Stripe/echte Zahlungsabwicklung, kein Cloudflare R2, kein WebAuthn (siehe proposal).
- Keine VPS-/Produktiv-Auslieferung, kein GitHub-Remote-Push in diesem Change.
- Kein gemeinsames ReFlow-Billing/Cross-Login (nur `tenant_id`-Feld vorbereitet).

## Decisions

### D1: Drei Dienste — PocketBase + Node-API + Frontend/nginx
PocketBase (SQLite, eigene Instanz) hält Auth, Daten und Dateien. Ein schlanker Node-API-Service (Fastify, TypeScript) macht alle BYOK-Modellaufrufe, Verschlüsselung, Kontingentlogik und Limit-Validierung. Frontend = statischer Vite-Build hinter nginx, der `/pb/*` an PocketBase und `/api/*` an den API-Service proxyt.

**Warum Node-API statt PocketBase-JS-Hooks (goja-JSVM)?** Vision-Calls brauchen Binärdatei→Base64 und Multipart-FormData; JSVM-Globals dafür sind begrenzt (`$http` ist für JSON-APIs gedacht). Ein Node-Service hat natives `fetch`/`Buffer`/`FormData`, sauberes Logging und ist unabhängig von der PB-Version. Alternative (Alles in pb_hooks) verworfen.

### D2: Auth über PocketBase `users`-Collection, Username-only
PB-Auth-Collections verlangen ein `email`-Feld. Der API-Service setzt beim Registrieren intern `email = "<username>@adgen.local"` — Nutzer sieht nie eine E-Mail, kein Mail-Versand existiert. Eigene Token-Implementierung verworfen: PB-Auth-Tokens, Session-Refresh und Rule-Scoping bleiben nutzbar.

### D3: Admin = PB-_superusers + kleine Custom-Statistik-Seite
Admin-User `diononline` wird per Seed als `_superuser` angelegt (Initialpasswort aus `ADMIN_INITIAL_PASSWORD`-ENV, nie im Repo). PocketBase-Admin-UI (`/_/`) deckt User-Management, Flag-Entsperrung, Tickets und Support-Tier ab; das Frontend bekommt eine zusätzliche Admin-Route `/admin` (Superuser-Login) mit Statistiken (Generations/Tag, Plattform-, Sprachverteilung). Komplettes Eigenbau-Admin-Panel verworfen — PB-Admin-UI existiert und ist ausreichend für MVP.

### D4: BYOK-Key mit AES-256-GCM im API-Service verschlüsselt
Key-String wird mit `ENCRYPTION_KEY` (32 Byte hex, aus ENV) per AES-256-GCM verschlüsselt; DB speichert `ciphertext`, `iv`, `tag`, `provider`. Kein Klartext-Logging, Fehlermeldungen geben nie Key-Inhalte aus. Der Key verlässt den API-Service nur entschlüsselt in Richtung Anthropic/DeepSeek.

### D5: Provider-Adapter statt zweier Pipelines
Ein Adapter-Interface (`visionExtract`, `generateListing`) mit zwei Implementierungen: `anthropic` (Messages-API, `image`-Content-Block Base64, strukturierte Ausgabe via `tool_use`/JSON-Erzwingung) und `deepseek` (OpenAI-kompatibles Chat-Completions, `image_url`-Content-Block, JSON-Mode). Modellname pro Provider in `platform_configs`-ähnlicher Settings-Struktur konfigurierbar (Defaults: `deepseek-flash`, `claude-sonnet-4-5`). Bildvorbereitung: Client komprimiert auf max. 1568 px lange Kante / 5 MB (JPEG q≈80); DeepSeek nutzt `detail:"low"` für reine Kategorie-Erkennung, `original` für Zustands-/Mängel-Pass.

### D6: Generate-Pipeline als transaktionale Sequenz
`POST /api/generate`: Auth/Fingerprint prüfen → Kontingent-Check → Bilder laden → Vision-Extraktion (JSON) → Merge mit Stichworten → Plattform-Harness mit JSON-Schema → **harte Validierung** gegen `platform_configs` → bei Überschreitung Retry (max. 2, mit Fehlermeldung im Prompt) oder kontrollierte Kürzung → `generations`-Record speichern → Zähler inkrementieren. Gäste: gleiche Pipeline, ohne Persistenz in History.

### D7: Kontingent per Fingerprint-Hash + Account-Bindung
Frontend erhebt Fingerprint (FingerprintJS Open Source) und sendet Hash an die API. `usage_counters` zählt pro `fingerprint_hash` (Gäste) bzw. Account (eingeloggt). Registrierungs-Sperrlogik: Fingerprint **oder** Key-Hash bereits gebunden → neuer Account sofort gesperrt (`blocked`). Verdächtige Muster (mehrere Accounts pro Fingerprint, häufige Key-Wechsel) setzen `flagged`; gesperrt bis Admin entsperrt. IP wird nur geloggt.

### D8: Plattform-Konfigurationen als DB-Collection
`platform_configs` enthält Titel-/Beschreibungslimits, Bildlimits, Ton-Hinweise und Harness-Prompt-Bausteine — editierbar in der PB-Admin-UI. Seed befüllt eBay/Kleinanzeigen/Vinted/Depop mit PRD-Werten.

### D9: i18n mit i18next, sechs UI-Sprachen
UI-Texte via i18next (DE/EN/FR/IT/NL/ES), Umschalter im Header, Persistenz in LocalStorage bzw. `users.preferred_ui_lang`. Listing-Sprache separat im Generate-Formular, Default = `users.last_listing_lang` bzw. LocalStorage bei Gästen.

## Risks / Trade-offs

- [PocketBase-Image-Version (muchobien `latest`) driftet gegen JS-SDK] → PB-SDK-Version im API-Service pinnen und Health-Check im Smoke-Test; alternativ Tag pinnen, wenn Version bekannt.
- [Anthropic/DeepSeek ändern Endpunkt-/Bildlimits] → Limits als Konstanten im Adapter-Modul gebündelt, Provider-spezifische Fehler in eigene Meldungen übersetzt.
- [FingerprintJS im Privatmodus/Adblock instabil] → Fallback: Session-Hash (LocalStorage); Zähler zählt dann pro Browser-Session, dokumentiert.
- [LLM überschreitet Limits trotz Retry] → finale Kürzung serverseitig erzwingen; Ergebnis bleibt nutzbar, Warnung im UI.
- [AES-Key in ENV verloren → Keys unlesbar] → ENV in `.env.local` (gitignored) dokumentieren; Verlust bedeutet Neu-Eingabe der Keys, kein Datenverlust.
- [Kein Stripe: Abo-Staffel nicht automatisiert] → Staffel nur informativ + manueller Support-Tier; echte Zahlungsabwicklung explizit später.

## Migration Plan

1. `docker compose up --build` startet PocketBase (leeres `pb_data`-Volume), API und Frontend.
2. `make seed` (bzw. `scripts/seed.mjs`) importiert Collections, legt Admin an, befüllt `platform_configs`.
3. Rollback lokal: `docker compose down -v` entfernt Volumes; Repo-Reset reicht für Neuaufbau.
4. Produktiv-Deployment (späterer Change): R2 für Dateien, Caddy/nginx-Rate-Limits, echtes Zahlungssystem, Stripe- oder manuelle Abo-Verwaltung.
