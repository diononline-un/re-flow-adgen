# Tasks: Re-Flow-AdGen MVP

## 1. Repo & Fundament (M0)

- [x] 1.1 Repo-Grundgerüst anlegen (README, .gitignore, .env.example, docker-compose.yml mit PocketBase 2013 / API / Frontend 2014, Makefile) — verifiziert mit `docker compose config -q`
- [x] 1.2 PocketBase-Collection-Schema als Import-JSON (users, generations, usage_counters, feedback, tickets, platform_configs inkl. tenant_id/user_id-Feldern, Regeln) — verifiziert mit `scripts/seed.mjs` (Import ohne Fehler)
- [x] 1.3 Seed-Skript: Collections importieren, Admin `diononline` aus `ADMIN_INITIAL_PASSWORD` anlegen, `platform_configs` mit PRD-Werten befüllen — verifiziert mit erneutem Seed-Lauf (idempotent)
- [x] 1.4 Frontend-Scaffold (React 18, Vite 5, TS, Tailwind, react-router, i18next, pocketbase-SDK, FingerprintJS) — verifiziert mit erfolgreichem `npm run build`
- [x] 1.5 Design-System: Grayscale-Tokens, Display-/Mono-Fonts, kantige Border-Utilities als Tailwind-Config + Basis-Komponenten (Button, Card, Input) — verifiziert durch Build + visuellen Smoke-Test
- [x] 1.6 i18n-Grundgerüst: alle UI-Strings als Keys, sechs Locale-Dateien (DE/EN/FR/IT/NL/ES), Sprachumschalter im Header — verifiziert per Sprachwechsel im Browser
- [x] 1.7 API-Service-Scaffold (Fastify, TS, PB-SDK, ENV-Konfiguration, Health-Endpoint) — verifiziert mit `curl /api/health`

## 2. Auth & BYOK (M0/M1)

- [x] 2.1 Registrierung + Login (Username/Passwort, email=username@adgen.local serverseitig, Fehlerbehandlung) — verifiziert mit curl-Register/Login-Szenarien inkl. doppeltem Username
- [x] 2.2 Key-Settings: API-Key verschlüsselt speichern/überschreiben (AES-256-GCM via ENCRYPTION_KEY), Provider-Auswahl, Key nie in Logs — verifiziert mit curl + DB-Blick (nur ciphertext)
- [x] 2.3 Account-Sperrlogik: bei Registrierung Fingerprint-/Key-Bindung prüfen, Account bei Verstoß sperren — verifiziert mit curl-Szenario (gleicher Fingerprint, zweiter Account)
- [x] 2.4 Einstellungs-UI im Frontend (Key hinterlegen, Provider, UI-/Listing-Sprachpräferenzen) — verifiziert im Browser

## 3. Core Generate-Flow (M1/M2)

- [x] 3.1 Bildvorbereitung clientseitig: Upload-Komponente (1 Pflichtbild + optionale), Kompression auf 1568 px / 5 MB, Vorschau — verifiziert im Browser mit Testbild
- [x] 3.2 Provider-Adapter: Anthropic + DeepSeek (Vision-Call mit Base64-Bild, Text-Generation, JSON-/strukturierte Ausgabe, Fehlerübersetzung) — verifiziert mit Unit-Test gegen Fetch-Stub
- [x] 3.3 Generate-Endpoint: Vision-Extraktion (JSON: Kategorie/Marke/Zustand/Farbe/Mängel/Material) + Merge mit Stichworten — verifiziert per curl mit Stub-Provider
- [x] 3.4 Plattform-Harness: eBay zuerst (Prompts aus platform_configs, JSON-Schema-Output: Titel/Beschreibung/Specifics) — verifiziert per curl mit Stub-Provider
- [x] 3.5 Harte Zeichenlimit-Validierung (Titel/Beschreibung gegen platform_configs, Retry max. 2, finale Kürzung) — verifiziert mit Unit-Test (künstlich zu langer Titel)
- [x] 3.6 Harness für Kleinanzeigen, Vinted, Depop (inkl. Hashtags, kombinierter Titel+Beschreibung bei Depop) — verifiziert per curl mit Stub-Provider je Plattform
- [x] 3.7 Generate-History (nur eigene, Gäste ohne Persistenz, Session-Historie clientseitig) — verifiziert im Browser mit zwei Accounts
- [x] 3.8 Ergebnis-UI: editierbare Felder, Kopier-Buttons, Feedback-Bereich — verifiziert im Browser

## 4. Limits & Paywall (M3)

- [x] 4.1 Fingerprint-Erhebung (FingerprintJS + Fallback-Session-Hash) und Zähler-Endpoint (5 free pro Fingerprint/Account, Support-Tier unlimited mit 1000/Tag-Cap) — verifiziert mit curl-Sequenz (6. Aufruf blockiert)
- [x] 4.2 Fingerprint-Flagging (mehrere Accounts pro Fingerprint, häufige Key-Wechsel) — verifiziert mit curl-Szenario
- [x] 4.3 Paywall-UI: Spendenhinweis mit PayPal.me-Link (dionotto@outlook.de) + Zahlart-Hinweis + Abo-Staffel als Pricing-Seite — verifiziert im Browser nach Kontingent-Ende
- [x] 4.4 IP-Logging pro Generation (nur Signal, kein Block) — verifiziert per curl + DB-Blick

## 5. Feedback, Tickets & Admin (M4)

- [x] 5.1 Feedback-Endpoint (👍/👎 + optionaler Text) — verifiziert per curl
- [x] 5.2 Ticket-Erzeugung bei negativem Feedback mit Text, Statusfluss offen/in Bearbeitung/geschlossen — verifiziert per curl + Admin-Sicht
- [x] 5.3 Admin-Route /admin mit Superuser-Login: Statistiken (Generations/Tag, Plattform-, Sprachverteilung) — verifiziert im Browser
- [x] 5.4 Admin-Doku (PB-Admin-UI für User-Mgmt/Flags/Tickets/Support-Tier) — verifiziert mit Admin-Login in PB-Admin-UI

## 6. Politur & Abnahme (M5)

- [x] 6.1 Design-Feinschliff: 8-bit-Details, Fehler-/Limit-Zustände in Signalrot, Responsive-Check — verifiziert im Browser (Desktop + Mobile-Viewport)
- [x] 6.2 Smoke-Test-Skript (scripts/smoke.mjs): Health, Register, Login, Generate mit Stub-Provider, Kontingent, Feedback, Ticket, Admin-Stats — verifiziert: alle Checks grün
- [x] 6.3 Rate-Limit-Grundschutz im API-Service (Basic-Limiter, z. B. 60 req/min) — verifiziert mit curl-Schleife
- [x] 6.4 README (Setup, ENV-Variablen, BYOK-Einrichtung, Seed, Smoke-Test) + PROJECT_STATUS.md (progress 100, status in-development) + CHANGELOG-Eintrag — verifiziert durch Lektorat + Dashboard-Schema-Check
- [x] 6.5 Git: lokale Commits (docs main, feature-Branch für Build) — verifiziert mit `git log` (kein Push in diesem Change)
