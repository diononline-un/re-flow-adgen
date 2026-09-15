# Proposal: Re-Flow-AdGen MVP (BYOK-Anzeigenschreiber)

## Why

Produktfoto plus Stichworte sollen ohne manuelle Schreibarbeit zu einem plattformfertigen Listing werden (eBay, Kleinanzeigen, Vinted, Depop). Nutzer bringen eigene API-Keys mit (BYOK), Betreiber trägt keine Modellkosten. Grundlage ist die PRD `PRD-AdScribe-BYOK-Anzeigenschreiber.md` (Stand 15.09.2026); Arbeitstitel „AdScribe" wird final **Re-Flow-AdGen** genannt.

## What Changes

- Neues eigenständiges Repo/Projekt mit eigenem Docker-Compose-Stack (lokal, keine VPS-Auslieferung in diesem Change).
- PocketBase (SQLite, eigene Instanz) als Backend/DB/Auth; Node-API-Service für BYOK-Modellaufrufe (Vision-Check + Listing-Harness) und harte Zeichenlimit-Validierung.
- React 18 + Vite 5 + TypeScript + Tailwind-Frontend im 8-bit/Grayscale-Design (Fritz-Kola-Referenz), i18n in DE/EN/FR/IT/NL/ES.
- Registrierung/Login nur mit Username + Passwort (keine E-Mail, kein Mail-Passwort-Reset; `recovery_code_hash`-Feld leer vorgehalten).
- Generate-Flow: Bild-Upload (1 Pflichtbild, weitere optional), Stichworte, Zielplattform, Zielsprache, Vision-Erkennung (Claude + DeepSeek, beide über denselben Endpunkt), plattformspezifischer Harness, editierbares/kopierbares Ergebnis, History für eingeloggte Nutzer.
- Limits: 5 kostenlose Generations pro Fingerprint/Account, Anti-Abuse (Account-Sperre bei Fingerprint- oder Key-Wiederverwendung, Flagging), IP nur als Log-Signal, PayPal.me-Spendenhinweis als Paywall-CTA.
- Feedback (👍/👎 + Text) mit automatischer Ticket-Erzeugung bei negativem Feedback mit Text; Admin-Panel (Passwort-Login) für User-Management, Flags, Tickets, Statistiken.
- Plattform-Konfiguration als DB-Collection statt hart im Code.

## Capabilities

### New Capabilities

- `account-auth`: Registrierung/Login (Username+Passwort), BYOK-Key-Verwaltung (verschlüsselt), Sprachpräferenzen, Sperrlogik neuer Accounts.
- `generate-core`: Generate-Flow (Upload, Vision-Check, Plattform-Harness, Zeichenlimit-Validierung), Plattform-Konfigurationen, Generate-History.
- `usage-limits`: Fingerprint-basiertes Freikontingent, Zähler, Flagging, Paywall/Spendenhinweis.
- `feedback-tickets`: Feedback zu Generations, Ticket-Erzeugung und -Status.
- `admin-panel`: Admin-Login, User-Management, Flag-Entsperrung, Ticket-Übersicht, Nutzungsstatistiken.
- `ui-design-system`: 8-bit/Grayscale-Design-System, i18n (6 UI-Sprachen), Sprachumschalter.

### Modified Capabilities

_Keine — Greenfield-Repository ohne bestehende Specs._

## Impact

- Neues Repo `Re-Flow-AdGen` (lokal, ohne GitHub-Remote-Push in diesem Change; Docker-Ports 2013 PocketBase / 2014 Frontend gemäß Port-Ring).
- Neue Abhängigkeiten: PocketBase (Docker-Image), Node 20 API-Service, React 18/Vite 5/TS/Tailwind, PocketBase-JS-SDK, i18next, FingerprintJS.
- Keine Änderungen an ReFlow (Ports 2007/2008) oder anderen Projekten.
- Offene PRD-Punkte, hier entschieden: Abo-Zahlung via Stripe ist **nicht** Teil dieses Changes (Support-Tier wird manuell im Admin vergeben, Paywall-CTA ist der PayPal.me-Link); Admin-Zugang als klassisches Passwort-Login (kein WebAuthn); Bild-Storage lokal über PocketBase-Dateispeicher statt Cloudflare R2 (R2 erst bei Produktiv-Deployment).
