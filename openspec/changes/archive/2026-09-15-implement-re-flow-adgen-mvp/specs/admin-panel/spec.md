## Purpose

Admin-Panel hinter Passwort-Login: User-Management (sperren/entsperren), Fingerprint-Flags aufheben, Support-Tier vergeben, Ticket-Übersicht und Nutzungsstatistiken.

## ADDED Requirements

### Requirement: Admin-Zugang hinter Login
Das System SHALL alle Admin-Funktionen hinter Login schützen; öffentliche Endpunkte dafür existieren nicht. Ein Admin-User SHALL bei Deployment einmalig angelegt werden; das Initialpasswort kommt ausschließlich aus der Server-ENV (`ADMIN_INITIAL_PASSWORD`).

#### Scenario: Unauthentifizierter Admin-Zugriff
- **WHEN** eine Anfrage ohne gültige Admin-Session Admin-Daten liest
- **THEN** verweigert das System den Zugriff

### Requirement: User-Management
Das System SHALL Admins erlauben, Nutzer zu sperren/entsperren, Fingerprint-Flags aufzuheben und den Support-Tier manuell zu vergeben.

#### Scenario: Geflaggten Fingerprint entsperren
- **WHEN** ein Admin einen geflaggten Fingerprint entsperrt
- **THEN** kann der zugehörige Nutzer wieder generieren

### Requirement: Ticket-Übersicht
Das System SHALL Tickets mit Feedback-Verknüpfung, Status und Zeitstempeln im Admin-Panel listen.

#### Scenario: Ticketliste
- **WHEN** ein Admin die Ticket-Übersicht öffnet
- **THEN** sieht er offene, in Bearbeitung befindliche und geschlossene Tickets samt zugehörigem Feedback

### Requirement: Nutzungsstatistiken
Das System SHALL Statistiken anzeigen: Generations pro Tag, Plattform-Verteilung und Sprach-Verteilung.

#### Scenario: Statistiken anzeigen
- **WHEN** ein Admin die Statistik-Ansicht öffnet
- **THEN** sieht er die drei Verteilungen auf Basis der gespeicherten Generationen
