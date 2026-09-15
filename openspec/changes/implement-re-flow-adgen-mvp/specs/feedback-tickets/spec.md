## Purpose

Feedback zu jeder Generation (👍/👎 plus optionales Freitextfeld) und automatische Ticket-Erzeugung bei negativem Feedback mit Text.

## ADDED Requirements

### Requirement: Feedback unter jeder Generation
Das System SHALL unter jeder Generation einen Feedback-Button (👍/👎) plus optionales Freitextfeld anbieten.

#### Scenario: Positives Feedback
- **WHEN** ein Nutzer 👍 klickt
- **THEN** speichert das System das Feedback mit Bewertung an der Generation

#### Scenario: Negatives Feedback ohne Text
- **WHEN** ein Nutzer 👎 ohne Text absendet
- **THEN** speichert das System das Feedback ohne Ticket

### Requirement: Automatische Ticket-Erzeugung
Das System SHALL bei negativem Feedback mit Freitext automatisch ein Ticket anlegen (Status „offen") und es mit dem Feedback verknüpfen.

#### Scenario: Ticket aus negativem Feedback
- **WHEN** ein Nutzer 👎 mit Freitext absendet
- **THEN** entsteht ein Ticket mit Status „offen", sichtbar im Admin-Panel

### Requirement: Ticket-Status
Das System SHALL Tickets mit den Status offen / in Bearbeitung / geschlossen führen und Statuswechsel im Admin-Panel erlauben.

#### Scenario: Ticket schließen
- **WHEN** ein Admin ein offenes Ticket schließt
- **THEN** erhält das Ticket den Status „geschlossen" mit Zeitstempel
