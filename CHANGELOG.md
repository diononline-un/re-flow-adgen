# Changelog

## 2026-09-15 — Upload-Dropzone für normale User-Interaktion abgesichert

- Klick- und Drop-Pfad hart verifiziert (Klick → Picker öffnet; DragEvent-Drop mit echten File-Objekten → Thumbnail). Fixes: Drop jetzt im ganzen Formular akzeptiert (nicht nur Box), globaler dragover/drop-Guard gegen Browser-Navigation bei Daneben-Drop, fehlgeschlagene Konvertierungen erscheinen sichtbar (vorher still geschluckt), Verarbeitungs-Indikator, `e.target.value=""` erlaubt erneutes Wählen derselben Datei, Keyboard-Bedienung (Enter/Space).
- HEIC mit leerem MIME (Dateimanager-Fall) und JPEG mit leerem MIME werden per Extension-Fallback erkannt.

## 2026-09-15 — HEIC-Upload gefixt + Asset-Caching

- HEIC-Dateien erschienen im Dateidialog nicht bzw. wurden verworfen: `accept` um `.heic/.heif/.hif`-Extension erweitert (MIME-Datenbanken vieler Systeme kennen HEIC nicht), Datei-Erkennung mit Extension-Fallback für leere/generische MIME-Typen, fehlerhafte Einzeldateien brechen den Batch nicht mehr ab. Mit echtem HEIC-Sample (libheif-Testbild) end-to-end verifiziert: Upload → HEIC→JPEG → Vision-Call → Listing.
- nginx: Hashed Assets immutable gecacht, fehlende Chunks geben sauber 404 statt SPA-Fallback (verhinderte „MIME type text/html"-Fehler nach Deploys), `index.html` no-cache.

## 2026-09-15 — Fixrunde: BYOK gekippt, Dark-Mode, Admin-User-Management, Hardening

- BYOK entfernt: Modellaufrufe laufen über serverseitige Keys (`DEEPSEEK_API_KEY` primär, `ANTHROPIC_API_KEY` als automatischer Fallback, aktuell ohne Key deaktiviert); Gast-Key-UI und Key-Settings raus; echter DeepSeek-Lauf live verifiziert.
- Admin-Panel ausgebaut: User-Management direkt in /admin (Support-Tier geben/entziehen, sperren/entsperren), geflaggte Geräte entsperren, App-Admin `dionoffline` (is_admin, Passwort = ADMIN_INITIAL_PASSWORD), Admin-Nav nur für Admins sichtbar, Admin-Endpunkte akzeptieren Superuser- und Admin-User-Tokens.
- Dark-Mode als Default (invertierte Farbwelt über CSS-Variablen), Light/Dark-Umschalter im Header, Theme-Persistenz ohne Flash; PayPal.me-Handle auf `gruenebluete` umgestellt, Tier-Auswahl prefillt den Betrag, Laufzeit-Labels jetzt sauber lokalisiert (EN zeigt nicht mehr Deutsch).
- HEIC/HEIF-Upload mit automatischer HEIC→JPEG-Konvertierung (heic2any, lazy geladen).
- Security-Hardening: Helmet auf API, nginx-Security-Header + CSP (mit Hash für Theme-Script), per-Route-Rate-Limits (Login 10/min, Generate 20/min, …), Bild-/Sprach-/Key-Validierung, Prompt-Injection-Schutz für Stichworte (Delimiter + Bereinigung), .env.local 600, Body-Limit 32 MB.
- Smoke-Test auf 28 Checks erweitert (Admin-Userliste, Tier-Vergabe, dionoffline-Zugriff, Injection-Check, Stub-Override pro Request); Unit-Tests 10/10.

## 2026-09-15 — MVP komplett (M0–M5, lokaler Docker-Stack)

- Kompletter BYOK-Anzeigenschreiber nach PRD gebaut: PocketBase (Auth/DB/Files, Port 2013), Node-API (Fastify: Vision-Check + Plattform-Harness für eBay/Kleinanzeigen/Vinted/Depop, AES-256-GCM-Key-Storage, Kontingent-/Anti-Abuse, harte Zeichenlimit-Validierung mit Retry, Port 2015), Frontend (React 18/Vite 5/TS/Tailwind, 8-bit-Grayscale-Design, 6 UI-Sprachen, Port 2014 via nginx).
- Auth nur Username+Passwort (keine E-Mail); Registrierungs-Sperre bei Fingerprint-/Key-Wiederverwendung; 5 freie Generations pro Fingerprint/Account; Fingerprint-Flagging; IP nur als Signal.
- Feedback 👍/👎 mit automatischer Ticket-Erzeugung; Admin-Seite (/admin) mit Statistiken und Ticket-Statusfluss; User-Management über PB-Admin-UI.
- OpenSpec eingeführt: Change `implement-re-flow-adgen-mvp` (proposal/specs/design/tasks) als Grundlage; offene PRD-Punkte entschieden (kein Stripe im MVP, PayPal.me-Paywall-Hinweis, manueller Support-Tier, Passwort-Admin statt WebAuthn, lokaler PB-Filespeicher statt R2).
- Qualität: API-Unit-Tests (8/8), End-to-End-Smoke `scripts/smoke.mjs` (17/17 Checks), Rate-Limit (300 req/min), `PROVIDER_STUB`-Modus für kostenloses Entwickeln.
- Offen: echte Key-Tests gegen Claude/DeepSeek, Stripe/R2/WebAuthn, VPS-Deployment, Limit-Verifikation gegen Marktplatz-Hilfeseiten.
