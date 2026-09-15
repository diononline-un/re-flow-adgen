# ui-design-system Specification

## Purpose
Das 8-bit/Grayscale-Design-System (Fritz-Kola-Referenz) und die i18n-Grundlage mit sechs UI-Sprachen.

## Requirements

### Requirement: Grayscale-Design-Tokens
Das System SHALL ein Design-System mit Reinweiß, 3–4 Graustufen und Tiefschwarz umsetzen; einziger Bunt-Akzent ist ein knalliges Signalrot für Fehler und Limit-Meldungen. UI-Elemente SHALL kantige 1–2px-Borders statt Schatten und Rundungen verwenden; Headlines in fetter Display-Typo, Preise/Zähler in Mono.

#### Scenario: Farbwelt konsistent
- **WHEN** eine beliebige Ansicht gerendert wird
- **THEN** erscheinen ausschließlich Graustufen plus optionalem Signalrot für Fehler-/Limit-Zustände

### Requirement: UI-Sprachen DE/EN/FR/IT/NL/ES
Das System SHALL die UI in sechs Sprachen anbieten (DE, EN, FR, IT, NL, ES) mit Sprachumschalter im Header. Die UI-Sprachwahl SHALL unabhängig von der Listing-Sprache sein.

#### Scenario: Sprachwechsel
- **WHEN** ein Nutzer im Header die Sprache wechselt
- **THEN** erscheinen alle UI-Texte sofort in der gewählten Sprache

#### Scenario: Listing-Sprache unabhängig
- **WHEN** ein Nutzer mit UI-Sprache DE eine Generation startet
- **THEN** kann er im Generate-Formular eine davon abweichende Listing-Sprache wählen
