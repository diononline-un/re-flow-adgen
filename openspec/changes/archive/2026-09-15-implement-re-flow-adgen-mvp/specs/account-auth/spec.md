## Purpose

Registrierung, Login und BYOK-Key-Verwaltung: Nutzer melden sich ausschließlich mit Username und Passwort an und hinterlegen ihren eigenen Claude- oder DeepSeek-API-Key verschlüsselt.

## ADDED Requirements

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

### Requirement: BYOK-Key verschlüsselt speichern
Das System SHALL den API-Key serverseitig AES-256-GCM-verschlüsselt speichern (Key aus Server-ENV) und niemals im Klartext persistieren oder loggen. Der Nutzer SHALL den Key im Einstellungsbereich hinterlegen und jederzeit überschreiben können.

#### Scenario: Key hinterlegen
- **WHEN** ein eingeloggter Nutzer einen API-Key samt Provider-Typ (Claude oder DeepSeek) speichert
- **THEN** speichert das System nur die verschlüsselte Form und den Provider-Typ und bestätigt die Speicherung

#### Scenario: Key überschreiben
- **WHEN** ein Nutzer einen bereits hinterlegten Key durch einen neuen ersetzt
- **THEN** überschreibt das System den verschlüsselten Key, ohne den alten irgendwo auszugeben

### Requirement: Sperrlogik neuer Accounts
Das System SHALL einen neuen Account sofort sperren, wenn der Device-Fingerprint ODER der eingegebene API-Key bereits einem bestehenden Account zugeordnet ist.

#### Scenario: Registrierung mit bereits genutztem Fingerprint
- **WHEN** ein Nutzer sich mit einem Fingerprint registriert, der bereits einem bestehenden Account zugeordnet ist
- **THEN** wird der neue Account gesperrt und der Nutzer erhält eine Meldung

#### Scenario: Key bereits anderem Account zugeordnet
- **WHEN** ein Nutzer einen API-Key speichert, der bereits einem anderen Account zugeordnet ist
- **THEN** sperrt das System den Account des Nutzers und verweist auf den Support

### Requirement: Sprachpräferenzen pro Nutzer
Das System SHALL für eingeloggte Nutzer die zuletzt verwendete Listing-Sprache speichern und beim nächsten Generate-Flow vorauswählen.

#### Scenario: Zuletzt verwendete Listing-Sprache
- **WHEN** ein Nutzer mit gespeicherter Listing-Sprache den Generate-Flow öffnet
- **THEN** ist seine zuletzt verwendete Listing-Sprache vorausgewählt
