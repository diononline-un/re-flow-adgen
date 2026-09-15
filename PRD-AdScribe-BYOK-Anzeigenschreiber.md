# PRD & Entwicklungsplan: „AdScribe" — BYOK-Anzeigenschreiber

*Arbeitstitel „AdScribe" — bitte final benennen. Stand: 15.09.2026*

## 1. Vision & Scope

Eine Web-App, die aus einem Produktfoto + ein paar Schlagwörtern (Größe, Anlass, Zustand, Marke) per Vision-Modell + LLM-Harness ein plattformoptimiertes Listing generiert — für eBay, Kleinanzeigen, Vinted und Depop. **BYOK**: Nutzer bringen ihren eigenen Claude- oder DeepSeek-API-Key mit, keine eigenen Modellkosten für den Betreiber.

Wird als **eigenständiger Service** gebaut (eigenes Repo/eigene DB), aber architektonisch so nah wie möglich am ReFlow-Stack, damit eine spätere Integration als ReFlow-Feature (Cross-Login, gemeinsames Billing) ohne Rewrite möglich ist.

## 2. Tech-Stack

Gleiche Basis wie ReFlow, um Wiederverwendung von Komponenten/Auth-Logik/Deploy-Pipeline zu maximieren:

| Layer | Wahl |
|---|---|
| Backend/DB/Auth | PocketBase (SQLite, eigene Instanz — kein Shared-DB mit ReFlow im MVP) |
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind |
| Storage (Bilder) | Cloudflare R2 |
| Hosting | Hetzner Cloud (eigener CX/CPX-Server, getrennt von ReFlow) |
| Reverse Proxy | Caddy oder nginx mit Rate-Limiting auf Edge-Ebene |

Migration zu „ReFlow-Modul" später: PocketBase-Collections sind bewusst mandantenfähig (`tenant_id`-Feld von Anfang an, auch wenn im MVP nur ein Mandant existiert).

## 3. Design-System

Grayscale/8-bit, referenziert an Fritz-Kola (schwarz/weiß, hoher Kontrast, plakative Typo, kein Farbverlauf, harte Kanten statt Rundungen, evtl. Halftone/Dither-Texturen als Deko-Element). Konkret:

- Palette: Reinweiß, 3–4 Graustufen, Tiefschwarz. Ein einziger Akzent erlaubt (Schwarz-Weiß-Fotografie-Stil, kein Bunt) — optional ein knalliges Signalrot nur für „Fehler"/„Limit erreicht", analog zur Fritz-Kola-Flaschenkontur-Ästhetik.
- Typo: Eine fette, plakative Display-Schrift für Headlines (z. B. serifenlose Grotesk mit hohem Kontrast), Mono-Font für Preise/Zähler (Retro-Terminal-Anmutung passt zu „8-bit").
- UI-Elemente: Pixelige/kantige Buttons und Rahmen (1–2px harte Border statt Shadow), bewusst reduzierte Icon-Sprache.
- Referenz-Skill: `frontend-design` beim Bau der Komponenten nutzen (Design-Tokens/Tailwind-Konfiguration).

## 4. Sprachen (i18n)

- **UI-Sprachen:** DE, EN, FR, IT, NL, ES (i18next o. ä., Sprachumschalter im Header).
- **Listing-Sprache:** unabhängig von der UI-Sprache pro Generation wählbar (Dropdown im Generate-Formular). Default = zuletzt verwendete Listing-Sprache des Nutzers (im Account gespeichert, bei Gästen im LocalStorage/Fingerprint-Profil).
- Übersetzt wird nicht nachträglich — der Harness generiert die Ziel-Sprache direkt im Prompt (bessere Idiomatik als Post-Translation, besonders bei Marktplatz-Slang wie Depop-Hashtags).

## 5. Nutzerflows

### 5.1 Registrierung & Login
- Nur **Username + Passwort**, keine E-Mail-Adresse.
- **Kein Passwort-Reset via Mail möglich.** MVP-Realität: Single-Tenant-Betrieb (nur du + Support-Discord), daher im Erstausbau irrelevant — Passwortverlust wird manuell via Discord-Support gelöst. Für spätere Mehrnutzer-Skalierung: optionaler Recovery-Code, der einmalig bei Registrierung angezeigt wird (nicht Teil des MVP-Scopes, aber Datenmodell sollte ein `recovery_code_hash`-Feld leer vorhalten, um späteres Nachrüsten ohne Migration zu erlauben).

### 5.2 Generate-Flow
1. Bild-Upload (1 Pflichtbild, weitere optional) + Freitext-Schlagwörter mit Platzhalter-Hinweis „Größe, Anlass, Zustand, Marke, Material, Besonderheiten".
2. Zielplattform wählen (eBay / Kleinanzeigen / Vinted / Depop), Zielsprache wählen.
3. **Vision-Check**: Bild + Stichworte gehen an das Vision-fähige Modell des hinterlegten Keys (Claude oder DeepSeek — beide unterstützen inzwischen nativ Vision über denselben Endpunkt, siehe Abschnitt 7). Output: strukturierte Artikel-Erkennung (Kategorie, erkannte Marke/Logo, sichtbarer Zustand, Farbe, auffällige Mängel) als JSON.
4. Erkannter Artikel + User-Stichwörter werden zusammengeführt und an den **Harness** übergeben (plattformspezifischer System-Prompt, siehe Abschnitt 8).
5. Harness produziert das fertige Listing (Titel, Beschreibung, Item-Specifics/Tags, ggf. Hashtags) im Format der Zielplattform.
6. Ergebnis wird angezeigt, editierbar, kopierbar; landet in der **Generate-History** des Accounts.

### 5.3 Generate History
- Eingeloggte Nutzer sehen **nur ihre eigenen** Generations (Query gefiltert auf `user_id`).
- Gäste (nicht eingeloggt) sehen keine persistente Historie — Generation wird nur clientseitig für die aktuelle Session gehalten (kein Cross-Device-Zugriff ohne Account, das ist ein guter Login-Incentive).

### 5.4 Feedback → Ticket-System
- Unter jeder Generation ein Feedback-Button (👍/👎 oder Sternebewertung + optionales Freitextfeld).
- Negatives Feedback mit Text erzeugt automatisch ein Ticket in einer `tickets`-Collection (Status: offen/in Bearbeitung/geschlossen), sichtbar im Admin-Panel. Kein separates Helpdesk-Tool im MVP — PocketBase-Collection + Admin-UI reicht.

## 6. Limits & Anti-Abuse

Ziel: 5 kostenlose Generations, danach Spendenhinweis/Paywall.

- **Zähl-Einheit:** Free-Kontingent wird **pro Device-Fingerprint** gezählt (nicht pro IP, nicht rein pro API-Key — Fingerprint ist der primäre Schlüssel, wie gewünscht).
- **Blocklogik neuer Accounts:** Ist der Fingerprint **oder** der eingegebene API-Key bereits einem bestehenden Account zugeordnet, wird ein neuer Account damit sofort gesperrt (kein Freikontingent-Reset über Zweitaccount).
- **Fingerprint-Flagging:** Ein Fingerprint, der verdächtige Muster zeigt (z. B. mehrere Accounts, ungewöhnlich viele Key-Wechsel), wird automatisch geflaggt und muss manuell im Admin-Panel entsperrt werden.
- **IP** wird zusätzlich geloggt (pro Generation), aber **nicht** als hartes Blockkriterium verwendet — nur als Signal im Admin-Panel bei Missbrauchsprüfung (CGNAT/Mobilfunk-NAT macht IP als hartes Limit unzuverlässig).
- Technisch: Fingerprint via FingerprintJS (Open-Source-Variante, self-hosted Edition falls Budget/Datenschutz das verlangt) + serverseitiger Zähler in PocketBase (`usage_counters`-Collection: `fingerprint_hash`, `api_key_hash`, `count`, `flagged`, `unlocked_by_admin`).

## 7. BYOK & Vision-Modelle — Recherchestand (15.09.2026)

Beide unterstützten Anbieter bieten Vision inzwischen **über denselben Endpunkt** wie die Text-Generierung (kein separater Vision-Call nötig):

**Claude (Anthropic API):**
- Bild als `image`-Content-Block (Typ `base64` oder `url`) direkt in der `messages`-Anfrage, gemischt mit Text.
- Limits: max. 5 MB pro Base64-Bild direkt über die Anthropic API (10 MB laut Doku als Obergrenze, in der Praxis meldet die API bei >5 MB Base64-Länge einen Fehler — im Harness daher hart auf **5 MB / Bild** clientseitig komprimieren), max. Bildmaße 8000×8000 px, aber Downscaling auf ~1568 px lange Kante bringt keine Erkennungsverbesserung mehr und spart Tokens. Bis zu 100 Bilder pro Request bei 200k-Context-Modellen.
- Unterstützte Formate: JPEG, PNG, GIF (nur erster Frame), WebP.

**DeepSeek (V4.1 Flash, „deepseek-flash"):**
- Seit Kurzem native Multimodalität im selben Modell/Endpunkt (`deepseek-flash`), OpenAI-kompatibles Chat-Completions-Format mit `image_url`-Content-Block, alternativ Anthropic-kompatibler Endpunkt (`/anthropic`) mit `image`/`source`-Block analog zu Claude.
- Limits: max. 32 MB pro Bild (Base64/externe URL), Request-Body insgesamt max. 48 MiB, bis zu 600 Bilder/Request, max. Bildmaße 8192 px/Seite (sinkt auf 4096 px ab 15+ Bildern im selben Request).
- Unterstützte Formate: JPEG, PNG, GIF, WebP.
- Wichtig für den Harness: `detail: "low"` skaliert serverseitig auf 512×512 herunter — für den reinen Artikel-Erkennungsschritt ausreichend und günstiger; für Zustands-/Mängel-Erkennung `original` verwenden.

**Implikation für die App:** Key-Eingabemaske unterscheidet zwei Provider-Typen (Anthropic-Format vs. DeepSeek-Format), aber beide laufen durch denselben internen Vision-Check-Schritt, nur mit providerspezifischem Request-Adapter. Kein Nutzer ist auf einen Anbieter beschränkt, was Vision angeht — beide können sowohl den Erkennungsschritt als auch die Text-Generierung übernehmen.

**Key-Storage:** Verschlüsselt serverseitig gespeichert (z. B. AES-256-GCM, Verschlüsselungskey aus Server-ENV, nie im Klartext in der DB), einmalig im Einstellungen-Bereich hinterlegt, jederzeit überschreibbar. Kein Klartext-Logging der Keys, auch nicht in Fehlermeldungen/Sentry.

## 8. Plattform-Recherche: Formate & Limits (mit Quellen)

Alle Angaben Stand September 2026, aus aktueller Web-Recherche — Marktplätze ändern Limits gelegentlich ohne große Ankündigung, daher empfiehlt sich ein Konfigurations-Objekt pro Plattform (nicht hart im Prompt verdrahtet), das sich leicht aktualisieren lässt.

### eBay
- Titel: **80 Zeichen hart** (Server lehnt längere Titel ab, kein stilles Abschneiden). Praxis: erste 50–55 Zeichen werden in der mobilen Suche angezeigt (~65 % des eBay-Traffics ist mobil) — wichtigste Keywords (Marke, Produktart, Attribute) nach vorne.
- Beschreibung: kein knapper Hard-Limit-Wert einheitlich dokumentiert, gängige Empfehlung ist prägnant/scanbar statt vollzuschreiben (Bullet-Points).
- Bilder: bis zu **24 Fotos** kostenlos, Minimum 500×500 px, empfohlen **1600×1600 px** (aktiviert Zoom-Feature), Formate JPEG/PNG, kein Wasserzeichen/Rahmen/Text im Bild erlaubt.
- Best Practice: 8–12 Fotos für gebrauchte/detailreiche Artikel (Ganzansicht, alle Seiten, Nahaufnahmen von Mängeln, Etiketten/Seriennummer).

### eBay Kleinanzeigen
- Titel: praktisch nutzbares Limit **~65 Zeichen** (Eingabefeld begrenzt dort, wo es zählt — für Auffindbarkeit relevant).
- Beschreibung: Angaben schwanken je Quelle zwischen **3.500 und 4.000 Zeichen** Gesamtlimit — im Harness konservativ auf **3.500 Zeichen** auslegen, um Abschneiden am Ende (inkl. „…") zu vermeiden.
- Bilder: bis zu **20 Fotos**, erstes Bild = Galeriebild.
- Best Practice: mobil-optimierter Stil (Kleinanzeigen wird überwiegend mobil genutzt), erste ~99 Zeichen der Beschreibung sollten die wichtigsten Fakten enthalten, da sie in Suchergebnis-Vorschauen erscheinen.

### Vinted
- Titel: **kein hartes Zeichenlimit** dokumentiert, Praxis-Empfehlung **20–60 Zeichen** (Formel: Marke + Artikelart + Farbe + Größe).
- Beschreibung: praktisches Limit **~1.000 Zeichen** (manche Quellen nennen kein Limit, Community-Konsens/Tools rechnen mit 1.000 als sicherem Wert).
- Bilder: bis zu **20 Fotos**, mindestens 1 Pflichtbild, empfohlen 5–10.
- Best Practice: Maße (Bund, Schrittlänge etc.) explizit angeben senkt Rückfragen laut Vinted-eigenen Angaben deutlich; Ehrlichkeit bei Mängeln wird von der Plattform-Kultur stark honoriert (Käuferschutz ist streng).

### Depop
- **Ein gemeinsames Titel+Beschreibungsfeld**, kein separates Titelfeld — Limit **1.000 Zeichen gesamt**. Die ersten Worte fungieren als Titel für die Suche.
- Hashtags: bis zu **5**, sollten immer voll ausgenutzt werden.
- Bilder: **4 Fotos + 1 optionales Video**, Pflicht-Seitenverhältnis **1:1** (Nicht-quadratische Bilder werden zugeschnitten), Minimum ca. 640 px lange Kante.
- Best Practice: lockerer, persönlicher Ton statt Corporate-Sprache („schreib wie an eine Freundin/einen Freund"), Depop-Algorithmus gewichtet die ersten 4–5 Wörter am stärksten.

### Plattform-Konfigurationstabelle (Auszug für den Harness)

| Plattform | Titel-Limit | Beschreibung-Limit | Max. Bilder | Bild-Min/Empf. | Ton |
|---|---|---|---|---|---|
| eBay | 80 Zeichen | scanbar, Bullet-Points | 24 | 500px min / 1600px empf. | sachlich, keyword-dicht |
| Kleinanzeigen | 65 Zeichen | 3.500 Zeichen | 20 | – | mobil, ehrlich, knapp |
| Vinted | 20–60 Zeichen (kein Hard-Limit) | 1.000 Zeichen | 20 | – | ehrlich, Maße betonen |
| Depop | 1.000 Zeichen (Titel+Text kombiniert) | s. Titel | 4 Fotos + 1 Video | 640px min, 1:1 | locker, persönlich, Hashtags |

## 9. Harness-Design

Zweistufiger Prompt-Aufbau pro Generation:

1. **Vision-Extraktions-Prompt** (plattformunabhängig): liefert strukturiertes JSON (Kategorie, Marke/Logo, Farbe, sichtbarer Zustand, Auffälligkeiten, geschätztes Material).
2. **Plattform-Harness-Prompt**: nimmt das JSON aus Schritt 1 + die User-Stichwörter + die Plattform-Konfiguration (Abschnitt 8) und produziert strukturierten Output (Titel, Beschreibung, Tags/Hashtags je nach Plattform) — als JSON-Schema erzwungen (JSON-Mode bei DeepSeek, `tool_use`/strukturierte Ausgabe bei Claude), damit das Frontend die Felder direkt ins Formular mappen kann.

Wichtig: Zeichenlimits serverseitig **hart validieren** (nicht nur im Prompt anweisen) — LLMs überschreiten Zeichenlimits gelegentlich, daher Post-Processing-Check mit Kürzung/Retry bei Überschreitung.

## 10. Pricing & Paywall

- **5 kostenlose Generations** pro Fingerprint/Account.
- Danach: PayPal.me-Spendenhinweis an `dionotto@outlook.de`, mit Anleitung „bitte als Freunde/Familie senden" (technischer Hinweis: PayPal.me-Links erlauben Betrag+Währung als URL-Parameter, z. B. `paypal.me/dionotto/5EUR`, aber die Zahlungsart „Freunde & Familie" kann nicht per Link erzwungen werden — nur der Sender wählt sie im PayPal-Checkout manuell. Der Hinweistext im UI muss das explizit erklären).
- **Abo-Staffel** (vorgeschlagen, 12 Monate ≈ 35 % Ersparnis ggü. 12×Monatspreis):

| Laufzeit | Preis gesamt | Preis/Monat | Ersparnis ggü. 1M-Preis |
|---|---|---|---|
| 1 Monat | 5,00 € | 5,00 € | – |
| 3 Monate | 13,50 € | 4,50 € | 10 % |
| 6 Monate | 24,00 € | 4,00 € | 20 % |
| 12 Monate | 39,00 € | 3,25 € | 35 % |

- Support-Tier (bezahlte Stufe) schaltet **ausschließlich mehr Generations frei** — kein separates Feature-Set, kein privilegierter Support-Kanal (bewusst simpel gehalten).

## 11. Admin-Panel

- Zugriff **hinter Login** (kein öffentlicher Endpunkt), initial mit klassischem Passwort-Login (kein WebAuthn/Passkey-Hardware nötig im MVP — „Passkey" hier als „geschützter Zugang", nicht als FIDO2-Standard interpretiert; falls doch echtes WebAuthn gewünscht ist, bitte kurz bestätigen, das wäre ein zusätzlicher Implementierungsblock).
- Admin-User `diononline` wird bei Deployment einmalig angelegt. **Das Passwort wird nur einmal ausgegeben und nicht ins Repo/in Config-Dateien committed** — es lebt ausschließlich als Server-ENV-Variable (`ADMIN_INITIAL_PASSWORD`) bzw. wird direkt nach dem ersten Login geändert und der Hash in der DB gespeichert.
- Funktionen: User-Management (sperren/entsperren, Fingerprint-Flags aufheben), Support-Tier manuell vergeben, Ticket-Übersicht (aus Feedback-System), Nutzungsstatistiken (Generations/Tag, Plattform-Verteilung, Sprach-Verteilung).

**Einmaliges Admin-Passwort (nur hier in diesem Chat, nicht in der Datei):**
`ooyms8n1o!veXssMK=&l`
→ Direkt nach Erstlogin ändern und nirgends im Code/Repo hinterlegen.

## 12. Datenmodell (PocketBase-Collections, Auszug)

- `users` — username, password_hash, tenant_id, preferred_ui_lang, last_listing_lang, support_tier, api_key_encrypted, api_key_provider (`claude`/`deepseek`)
- `generations` — user_id (nullable für Gäste), platform, listing_lang, input_keywords, input_image_ref, vision_result_json, output_json, created_at
- `usage_counters` — fingerprint_hash, api_key_hash, ip_last_seen, count, flagged, unlocked_by_admin
- `feedback` — generation_id, rating, comment, ticket_id (nullable)
- `tickets` — feedback_id, status, admin_note, created_at, closed_at
- `platform_configs` — platform, title_limit, description_limit, max_images, tone_notes (editierbar im Admin-Panel statt hart im Code, da Marktplatz-Limits sich ändern)

## 13. Entwicklungsplan (Phasen)

| Phase | Inhalt |
|---|---|
| M0 — Fundament | PocketBase-Setup, Auth (Username/PW), Grayscale-Design-System, i18n-Grundgerüst (6 Sprachen, nur UI-Strings) |
| M1 — Core Generate-Flow | Bild-Upload, Key-Settings (verschlüsselt), Vision-Check-Adapter für Claude + DeepSeek, ein Plattform-Harness (eBay zuerst, da am besten dokumentiert) |
| M2 — Alle Plattformen | Kleinanzeigen/Vinted/Depop-Harness + Konfigurationstabelle, harte Zeichenlimit-Validierung, Generate-History |
| M3 — Limits & Paywall | Fingerprint-Integration, Zähllogik, PayPal.me-Hinweis-UI, Pricing-Seite |
| M4 — Feedback & Admin | Feedback-Buttons, Ticket-System, Admin-Panel (User-Mgmt, Flags, Statistiken) |
| M5 — Politur | Design-Feinschliff (8-bit-Details), Lasttest der Rate-Limits, Vorbereitung ReFlow-Integrationsschnittstelle |

## 14. Offene Punkte / Annahmen, die du gegenprüfen solltest

- Abo-Zahlung (die 5/13,50/24/39 €-Staffel) läuft vermutlich über einen echten Zahlungsanbieter (Stripe?) — im Chat war nur der **Spendenlink** für die Free-Limit-Überschreitung spezifiziert, nicht die technische Abwicklung der Abo-Zahlung selbst. Das sollte vor M3 geklärt werden (Stripe Subscriptions wäre naheliegend, da PayPal.me keine wiederkehrenden Zahlungen unterstützt).
- „Passkey" für Admin-Panel: aktuell als einfaches Passwort-Login umgesetzt — falls echtes WebAuthn/FIDO2 gewünscht ist, bitte bestätigen.
- Plattform-Limits (Abschnitt 8) sind Stand heute und sollten vor Produktivsetzung nochmal gegen die jeweiligen offiziellen Verkäufer-Hilfeseiten verifiziert werden, da einige Werte (v. a. Kleinanzeigen-Beschreibungslimit, Vinted) in verschiedenen Quellen leicht abweichen.
