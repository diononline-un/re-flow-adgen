---
name: Re-Flow-AdGen
status: in-development
progress: 100
last_updated: 2026-09-15
tags: [web, docker, pocketbase, byok, ai]
---

# Re-Flow-AdGen — Projektstatus

BYOK-Anzeigenschreiber: Foto + Stichworte → fertiges Listing für eBay, Kleinanzeigen, Vinted, Depop.

## Ist-Zustand

- MVP lokal komplett (M0–M5): Docker-Stack (PocketBase 2013, API 2015, Frontend 2014) läuft, Smoke-Test 17/17 grün.
- Auth (Username/PW), BYOK-Key (AES-256-GCM), Vision-Check + Harness für 4 Plattformen, harte Limit-Validierung, History, Feedback → Tickets, Admin (Stats/User/Flags), Fingerprint-Kontingent (5 free) + Anti-Abuse, 6 UI-Sprachen.
- PRD offene Punkte geklärt: kein Stripe (PayPal.me-Hinweis + manueller Support-Tier), Admin-Passwort statt WebAuthn, lokaler PB-Filespeicher statt R2.

## Nächste Schritte

- [x] M0 Fundament (PB, Auth, Design, i18n)
- [x] M1 Core Generate-Flow (Upload, Key, Adapter, eBay-Harness)
- [x] M2 Alle Plattformen + Validierung + History
- [x] M3 Limits & Paywall (Fingerprint, Zähler, Pricing-Seite)
- [x] M4 Feedback & Tickets & Admin
- [x] M5 Politur (Design, Smoke-Test, Rate-Limit, Doku)
- [ ] Echte BYOK-Keys mit PROVIDER_STUB=false gegenprüfen
- [ ] Später: Stripe/R2/WebAuthn, VPS-Deployment, Limit-Verifikation gegen Marktplatz-Hilfeseiten
