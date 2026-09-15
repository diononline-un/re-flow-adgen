---
name: Re-Flow-AdGen
status: in-development
progress: 100
last_updated: 2026-09-15
tags: [web, docker, pocketbase, ai]
---

# Re-Flow-AdGen — Projektstatus

Anzeigenschreiber: Foto + Stichworte → fertiges Listing für eBay, Kleinanzeigen, Vinted, Depop. Server-Key statt BYOK.

## Ist-Zustand

- MVP lokal komplett + Fixrunde: Docker-Stack (PocketBase 2013, API 2015, Frontend 2014), Smoke 28/28 grün, Unit-Tests 10/10.
- BYOK gekippt: DeepSeek-Server-Key aktiv (echter Lauf verifiziert), Anthropic-Fallback vorbereitet. Dark-Mode Default + Light-Umschalter, HEIC→JPEG-Auto-Convert, 6 UI-Sprachen.
- Admin in /admin: User-Management (Support-Tier, sperren), Flag-Entsperrung, Tickets, Stats; App-Admin dionoffline; Paywall via paypal.me/gruenebluete mit Tier-Prefill.
- Hardening: CSP/Security-Header, Helmet, per-Route-Rate-Limits, Input-Validierung, Prompt-Injection-Schutz, Keys nur in .env.local.

## Nächste Schritte

- [x] User-Management + Support-Tier direkt im Admin-Panel
- [x] PayPal.me gruenebluete + Tier-Amount-Prefill + lokalisierte Laufzeiten
- [x] Dark/Light-Mode (Default Dark)
- [x] HEIC-Upload mit Konvertierung
- [x] BYOK raus, DeepSeek-Server-Key + Anthropic-Fallback
- [x] dionoffline als App-Admin, Admin-Nav nur für Admins
- [x] Security-Hardening + Prompt-Injection-Schutz
- [ ] Später: Stripe/R2/WebAuthn, VPS-Deployment, Limit-Verifikation gegen Marktplatz-Hilfeseiten
