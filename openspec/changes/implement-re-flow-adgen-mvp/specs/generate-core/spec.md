## Purpose

Der zentrale Generate-Flow: Bild-Upload plus Stichworte werden per Vision-Modell erkannt, mit dem gewählten BYOK-Anbieter zu einem plattformoptimierten Listing verarbeitet und hart validiert ausgegeben.

## ADDED Requirements

### Requirement: Generate-Flow-Eingaben
Das System SHALL im Generate-Formular anbieten: mindestens 1 Pflichtbild (weitere optional), Freitext-Stichworte, Zielplattform (eBay, Kleinanzeigen, Vinted, Depop) und Zielsprache (unabhängig von der UI-Sprache). Bilder MUST vor dem Upload clientseitig auf höchstens 1568 px lange Kante und 5 MB komprimiert werden.

#### Scenario: Pflichtfeld fehlt
- **WHEN** ein Nutzer das Formular ohne Bild oder ohne Zielplattform absendet
- **THEN** blockiert das Formular und markiert das fehlende Pflichtfeld

### Requirement: Vision-Check
Das System SHALL Bild und Stichworte an das Vision-fähige Modell des hinterlegten Keys senden (Anthropic- oder DeepSeek-kompatibles Format, beide über denselben Endpunkt) und strukturiertes JSON zur Artikelerkennung erhalten: Kategorie, erkannte Marke/Logo, sichtbarer Zustand, Farbe, auffällige Mängel, geschätztes Material.

#### Scenario: Vision-Erkennung erfolgreich
- **WHEN** ein Nutzer einen gültigen Key hinterlegt und eine Generation startet
- **THEN** erhält das System ein JSON mit den Erkennungsfeldern und fährt mit dem Harness fort

#### Scenario: Kein Key hinterlegt
- **WHEN** ein Nutzer ohne hinterlegten Key eine Generation startet
- **THEN** verweist das System auf den Einstellungsbereich zum Key-Hinterlegen

### Requirement: Plattform-Harness
Das System SHALL das Erkennungs-JSON plus Stichworte plus Plattform-Konfiguration an einen plattformspezifischen Harness-Prompt übergeben und strukturierten Output erzwingen (JSON-Mode bei DeepSeek, strukturierte Ausgabe bei Claude): Titel, Beschreibung, Item-Specifics/Tags, ggf. Hashtags.

#### Scenario: Strukturierter Listing-Output
- **WHEN** der Harness erfolgreich antwortet
- **THEN** liefert das System Titel, Beschreibung und plattformspezifische Zusatzfelder als JSON an das Frontend

### Requirement: Harte Zeichenlimit-Validierung
Das System SHALL Zeichenlimits serverseitig hart validieren (nicht nur im Prompt). Bei Überschreitung SHALL es den Output kürzen oder einen Retry auslösen.

#### Scenario: Titel über Limit
- **WHEN** der Harness einen eBay-Titel über 80 Zeichen liefert
- **THEN** kürzt das System serverseitig auf das Limit oder wiederholt die Generierung, bis der Titel valide ist

### Requirement: Plattform-Konfigurationen in der DB
Das System SHALL Plattform-Limits (Titel-/Beschreibungslimit, Max-Bilder, Ton-Hinweise) in einer editierbaren DB-Collection halten statt hart im Code. Die vier Plattformen eBay, Kleinanzeigen, Vinted und Depop MUST initial mit den PRD-Werten befüllt sein.

#### Scenario: Konfiguration laden
- **WHEN** der Harness eine Plattform verarbeitet
- **THEN** verwendet das System die Werte aus der DB-Collection

### Requirement: Generate-History
Das System SHALL jede Generation eingeloggter Nutzer speichern und nur dem erzeugenden Nutzer anzeigen. Gäste SHALL keine persistente History erhalten.

#### Scenario: History gefiltert nach Nutzer
- **WHEN** ein eingeloggter Nutzer seine History öffnet
- **THEN** sieht er ausschließlich seine eigenen Generationen, nicht die anderer Nutzer

#### Scenario: Gast ohne History
- **WHEN** ein Gast die History-Ansicht öffnet
- **THEN** zeigt das System einen Login-Hinweis; die aktuelle Sitzungs-Generation bleibt nur clientseitig erhalten

### Requirement: Ergebnis editierbar und kopierbar
Das System SHALL das Generierungsergebnis anzeigen, editierbar und mit Ein-Klick-Kopierfunktion pro Feld anbieten.

#### Scenario: Feld kopieren
- **WHEN** ein Nutzer den Kopier-Button eines Ergebnisfelds klickt
- **THEN** landet der Feldinhalt in der Zwischenablage und das UI bestätigt das
