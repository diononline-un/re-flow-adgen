## Purpose

Fingerprint-basiertes Freikontingent (5 Generations), Zähllogik, Missbrauchs-Flagging und die Paywall mit Spendenhinweis.

## ADDED Requirements

### Requirement: Freikontingent pro Fingerprint und Account
Das System SHALL 5 kostenlose Generations gewähren, gezählt pro Device-Fingerprint (Gäste) bzw. pro Account (eingeloggte Nutzer). Die IP SHALL pro Generation geloggt werden, aber kein hartes Blockkriterium sein.

#### Scenario: Kontingent erschöpft
- **WHEN** ein Fingerprint seine 5. kostenlose Generation verbraucht hat und eine weitere startet
- **THEN** blockiert das System die Generation und zeigt den Paywall-/Spendenhinweis

#### Scenario: Kontingent verfügbar
- **WHEN** ein Fingerprint unter 5 Generationen liegt
- **THEN** läuft die Generation normal durch

### Requirement: Fingerprint-Flagging
Das System SHALL einen Fingerprint automatisch flaggen, wenn verdächtige Muster auftreten (mehrere Accounts, ungewöhnlich viele Key-Wechsel). Geflaggte Fingerprints MUST manuell im Admin entsperrt werden.

#### Scenario: Flagging bei Mehrfach-Accounts
- **WHEN** derselbe Fingerprint bei mehreren Account-Registrierungen auftritt
- **THEN** flaggt das System den Fingerprint und blockiert neue Generations, bis ein Admin entsperrt

### Requirement: Paywall und Spendenhinweis
Das System SHALL nach Verbrauch des Kontingents einen Paywall-Hinweis mit PayPal.me-Spendenlink (`dionotto@outlook.de`) anzeigen, inklusive Erklärung, dass „Freunde & Familie" nur der Sender im Checkout wählen kann, sowie die Abo-Staffel als Information.

#### Scenario: Paywall-Anzeige
- **WHEN** ein Nutzer mit erschöpftem Kontingent eine Generation startet oder die Pricing-Seite öffnet
- **THEN** sieht er Spendenlink, Zahlart-Hinweis und Abo-Staffel

### Requirement: Support-Tier hebt Limit auf
Das System SHALL für Nutzer mit manuell vergebenem Support-Tier das Generationslimit aufheben (Sanity-Cap: 1000 Generations/Tag).

#### Scenario: Support-Tier-Nutzer generiert unbegrenzt
- **WHEN** ein Nutzer mit Support-Tier über 5 Generationen hinaus generiert
- **THEN** blockiert das System ihn nicht (solange der Tages-Cap nicht erreicht ist)
