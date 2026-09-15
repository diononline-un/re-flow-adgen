# Changelog

## 2026-09-15 — MVP komplett (M0–M5, lokaler Docker-Stack)

- Kompletter BYOK-Anzeigenschreiber nach PRD gebaut: PocketBase (Auth/DB/Files, Port 2013), Node-API (Fastify: Vision-Check + Plattform-Harness für eBay/Kleinanzeigen/Vinted/Depop, AES-256-GCM-Key-Storage, Kontingent-/Anti-Abuse, harte Zeichenlimit-Validierung mit Retry, Port 2015), Frontend (React 18/Vite 5/TS/Tailwind, 8-bit-Grayscale-Design, 6 UI-Sprachen, Port 2014 via nginx).
- Auth nur Username+Passwort (keine E-Mail); Registrierungs-Sperre bei Fingerprint-/Key-Wiederverwendung; 5 freie Generations pro Fingerprint/Account; Fingerprint-Flagging; IP nur als Signal.
- Feedback 👍/👎 mit automatischer Ticket-Erzeugung; Admin-Seite (/admin) mit Statistiken und Ticket-Statusfluss; User-Management über PB-Admin-UI.
- OpenSpec eingeführt: Change `implement-re-flow-adgen-mvp` (proposal/specs/design/tasks) als Grundlage; offene PRD-Punkte entschieden (kein Stripe im MVP, PayPal.me-Paywall-Hinweis, manueller Support-Tier, Passwort-Admin statt WebAuthn, lokaler PB-Filespeicher statt R2).
- Qualität: API-Unit-Tests (8/8), End-to-End-Smoke `scripts/smoke.mjs` (17/17 Checks), Rate-Limit (300 req/min), `PROVIDER_STUB`-Modus für kostenloses Entwickeln.
- Offen: echte Key-Tests gegen Claude/DeepSeek, Stripe/R2/WebAuthn, VPS-Deployment, Limit-Verifikation gegen Marktplatz-Hilfeseiten.
