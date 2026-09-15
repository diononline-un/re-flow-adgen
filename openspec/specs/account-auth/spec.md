# account-auth Specification

## Purpose
Registrierung und Login: Nutzer melden sich ausschließlich mit Username und Passwort an. Modellaufrufe laufen über serverseitige Provider-Keys (BYOK gekippt), Nutzer-Keys existieren nicht mehr.

## Requirements

### Requirement: Registrierung mit Username und Passwort
Das System SHALL eine Registrierung ausschließlich über Username und Passwort anbieten, ohne E-Mail-Adresse. Der Username MUST eindeutig sein. Das Datenmodell SHALL ein leeres Feld `recovery_code_hash` vorhalten, ohne es im MVP zu nutzen.

#### Scenario: Erfolgreiche Registrierung
- **WHEN** ein Nutzer einen freien Username und ein Passwort mit mindestens 8 Zeichen absendet
- **THEN** legt das System den Account an, loggt den Nutzer ein und zeigt die Generate-Ansicht

#### Scenario: Username bereits vergeben
- **WHEN** ein Nutzer einen bereits vergebenen Username absendet
- **THEN** weist das System die Registrierung zurück und zeigt eine verständliche Fehlermeldung

### Requirement: Login ohne Passwort-Reset
Das System SHALL Login über Username und Passwort anbieten. Es SHALL keinen automatisierten Passwort-Reset per E-Mail anbieten.

#### Scenario: Falsche Zugangsdaten
- **WHEN** ein Nutzer falsche Zugangsdaten eingibt
- **THEN** zeigt das System eine Fehlermeldung ohne Hinweis, welcher Teil der Zugangsdaten falsch war

### Requirement: Server-seitige Provider-Keys
Das System SHALL Modellaufrufe über serverseitig konfigurierte Provider-Keys ausführen (`DEEPSEEK_API_KEY` primär, `ANTHROPIC_API_KEY` als Fallback). Keys SHALL ausschließlich aus der Server-ENV kommen, nie im Repo liegen und nie geloggt oder an Clients ausgeliefert werden. Nutzer SHALL keine eigenen Keys hinterlegen können.

#### Scenario: Primärer Provider fehlerhaft
- **WHEN** der primäre Provider einen Aufruf ablehnt und ein Fallback-Key konfiguriert ist
- **THEN** wiederholt das System Vision-Check und Harness automatisch über den Fallback-Provider

#### Scenario: Kein Provider-Key konfiguriert
- **WHEN** kein Provider-Key gesetzt ist und keine Stub-Anforderung vorliegt
- **THEN** lehnt das System die Generation mit einem Konfigurationsfehler ab

### Requirement: Sperrlogik neuer Accounts
Das System SHALL einen neuen Account sofort sperren, wenn der Device-Fingerprint bereits einem bestehenden Account zugeordnet ist.

#### Scenario: Registrierung mit bereits genutztem Fingerprint
- **WHEN** ein Nutzer sich mit einem Fingerprint registriert, der bereits einem bestehenden Account zugeordnet ist
- **THEN** wird der neue Account gesperrt und der Nutzer erhält eine Meldung

### Requirement: Sprachpräferenzen pro Nutzer
Das System SHALL für eingeloggte Nutzer die zuletzt verwendete Listing-Sprache speichern und beim nächsten Generate-Flow vorauswählen.

#### Scenario: Zuletzt verwendete Listing-Sprache
- **WHEN** ein Nutzer mit gespeicherter Listing-Sprache den Generate-Flow öffnet
- **THEN** ist seine zuletzt verwendete Listing-Sprache vorausgewählt
