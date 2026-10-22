# PRONOTE für Gladys

Diese Integration bringt **PRONOTE**, die Schulverwaltungssoftware der meisten
französischen Schulen, in Gladys: Noten, Hausaufgaben, Stundenplan, Fehlzeiten,
Mitteilungsheft und ungelesene Nachrichten eines Schülers — oder jedes Kindes eines Elternkontos.

Sie liest PRONOTE so wie die PRONOTE-App, alle paar Minuten, und veröffentlicht das
Gefundene als Gladys-Geräte, Szenenauslöser und Dashboard-Widgets.

> PRONOTE und Index Éducation sind an dieser Integration nicht beteiligt. Sie nutzt
> die freie Bibliothek [pawnote](https://github.com/LiterateInk/Pawnote.js), um mit
> PRONOTE zu kommunizieren.

## Voraussetzungen

- Gladys **5.1 oder neuer**.
- Ein PRONOTE-Konto als **Schüler** oder **Eltern** (Lehrkräftekonten werden nicht
  unterstützt).
- Die Adresse deines PRONOTE-Bereichs, wie dein Browser sie anzeigt, z. B.
  `https://0123456a.index-education.net/pronote/`.

## Konfiguration

Öffne in Gladys **Integrationen → PRONOTE → Konfiguration**.

| Feld                           | Was eintragen                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| PRONOTE-Adresse                | Die Adresse des PRONOTE-Bereichs. Das Ende (`eleve.html`, `parent.html`) wird nicht benötigt.                                                    |
| Kontoart                       | **Schüler** für ein Schülerkonto, **Eltern** für ein Elternkonto (ein Gerät pro Kind).                                                           |
| Benutzername / Passwort        | Dein PRONOTE-Benutzername und -Passwort.                                                                                                         |
| Aktualisierungsintervall (min) | Wie oft PRONOTE abgerufen wird. 30 Minuten reichen; der Server wird von der ganzen Schule geteilt.                                               |
| Hausaufgaben-Zeitraum          | Wie viele Tage Hausaufgaben gezählt und aufgelistet werden, ab dem nächsten Schultag (Standard 7). In den Ferien zählen die Tage ab Schulbeginn. |
| Zeitzone der Schule            | Standard `Europe/Paris`. Überseegebiete: `Indian/Reunion`, `America/Martinique`, `Pacific/Noumea`…                                               |
| Detaillierte Protokolle        | Zum Untersuchen eines Problems einschalten, danach wieder aus.                                                                                   |

Speichere und drücke dann **Verbindung testen**: Es zeigt, wer angemeldet ist und
was für jeden Schüler gefunden wurde.

Nach der ersten Anmeldung gibt PRONOTE der Integration ein **Sitzungstoken**, das
für die nächsten Anmeldungen das Passwort ersetzt, wie bei der PRONOTE-App. Es wird
im eigenen Speicher der Integration aufbewahrt.

### Konten mit Anmeldung über ein ENT

Wenn du PRONOTE über das ENT deiner Region erreichst (Mon Bureau Numérique, ENT77,
Skolengo…), hast du kein PRONOTE-Passwort. Nutze stattdessen einen **QR-Code**:

1. Öffne in PRONOTE am Computer das Menü neben deinem Namen und wähle **QR-Code für
   die mobile App**. Wähle einen 4-stelligen Code.
2. Scanne den QR-Code mit der Handykamera (nicht mit der PRONOTE-App): Das Handy
   zeigt einen Text, der mit `{"jeton"` beginnt. Kopiere ihn.
3. Drücke in Gladys **Mit QR-Code anmelden**, füge den Text ein und gib den
   4-stelligen Code ein. Sei schnell: Der QR-Code ist nur wenige Minuten gültig.

Lass die Felder Adresse, Benutzername und Passwort leer oder trage nur die Adresse
ein. Die Sitzung wird dann wie nach einer Anmeldung mit Passwort aufbewahrt.

## Geräte

Drücke **Entdecken** (oder warte auf den ersten Abruf), um die Geräte zu sehen, und
lege sie an.

**Ein Gerät pro Schüler**:

| Funktion                         | Wert                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Overall average                  | Der Gesamtdurchschnitt des laufenden Zeitraums, von 20 (wenn die Schule ihn anzeigt). |
| Homework to do                   | Die noch nicht erledigten Hausaufgaben im Hausaufgaben-Zeitraum.                      |
| Homework for the next school day | Die noch nicht erledigten Hausaufgaben für den nächsten Schultag.                     |
| Absences (period)                | Die Fehlzeiten des laufenden Zeitraums.                                               |
| Delays (period)                  | Die Verspätungen des laufenden Zeitraums.                                             |
| Next lesson                      | Text, z. B. `14:00 MATHEMATIQUES (B12)` (mit Datum, wenn nicht heute).                |
| Next school day start            | Text, z. B. `08:00`: die erste stattfindende Stunde des nächsten Schultags.           |
| Last grade                       | Text, z. B. `MATHEMATIQUES 15/20 (12/10)`.                                            |

Die Funktionsnamen sind beim Anlegen englisch; du kannst sie in Gladys umbenennen.

**Ein Gerät für das Konto**: die Anzahl der **ungelesenen Nachrichten**.

Die Geräte sind schreibgeschützt: In PRONOTE wird nichts geändert.

## Szenen

### Auslöser

| Auslöser                                   | Wann                                                                                    | Variablen                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Eine neue Note wird veröffentlicht         | Seit dem letzten Abruf ist eine Note erschienen.                                        | Name des Schülers, Fach, Note, von, Note von 20, Note wie geschrieben, Gewichtung, Klassendurchschnitt, Kommentar, Datum |
| Neue Hausaufgaben werden aufgegeben        | Hausaufgaben sind erschienen oder wurden geändert.                                      | Name des Schülers, Fach, Beschreibung, fällig am                                                                         |
| Eine Stunde fällt aus                      | Eine Stunde der nächsten Tage fällt jetzt aus.                                          | Name des Schülers, Fach, Datum, Beginn, Ende, PRONOTE-Status                                                             |
| Eine Fehlzeit oder Verspätung wird erfasst | Die Schule hat eine Fehlzeit oder Verspätung erfasst.                                   | Name des Schülers, Art (`absence` / `delay`), Datum, entschuldigt (`yes` / `no`), Minuten Verspätung, Grund              |
| Eine Notiz steht im Mitteilungsheft        | Eine Lehrkraft oder die Schule hat eine Notiz geschrieben (Bemerkung, Lob, Heftmangel). | Name des Schülers, Art (`issue` / `observation` / `encouragement` / `other`), Titel, Fach, Kommentar, Datum              |

Jeder Auslöser kann auf einen Schüler beschränkt werden. Der erste Abruf nach der
Installation merkt sich nur, was schon da ist: Für die Noten der vergangenen Wochen
wird nichts gemeldet.

### Aktionen

- **PRONOTE jetzt abrufen**: aktualisiert Geräte und Widgets sofort. Gefundene
  Neuigkeiten werden beim nächsten planmäßigen Abruf von den Auslösern gemeldet.
- **Tag eines Schülers abrufen**: für heute, morgen oder den nächsten Schultag die
  Anzahl der Stunden, den Beginn der ersten, das Ende der letzten, die ausfallenden
  Fächer und die offenen Hausaufgaben als vorlesbare Liste.

Beispiel: _jeden Wochentag um 07:00 → Tag eines Schülers abrufen (nächster
Schultag) → Sagen „Erste Stunde um {{first_lesson}}. Hausaufgaben:
{{homework_text}}“_.

## Widgets

- **PRONOTE-Schüler**: die Übersicht. Durchschnitt, offene Hausaufgaben,
  Fehlzeiten, nächste Stunde, nächster Schultag (nur wenn er nicht schon die
  nächste Stunde ist), letzte Note und ungelesene Nachrichten. Eine Schaltfläche
  **Aktualisieren** ruft PRONOTE sofort ab. Die Einstellung **Liste** (Standard:
  **Keine**) kann eine der folgenden Listen hinzufügen.

- **PRONOTE-Hausaufgaben**: die Hausaufgaben des Hausaufgaben-Zeitraums, jeweils
  als **Erledigt**, **Offen**, **Heute** oder **Morgen** markiert, wie in PRONOTE,
  unter einer Kachel **Offen**.

- **PRONOTE-Noten**: der Durchschnitt und die neuesten Noten, mit dem
  Klassendurchschnitt. Die Einstellung **Anzahl der Noten** geht von 1 bis 8
  (Standard 8): eine Gladys-Liste hat höchstens 8 Zeilen.

- **PRONOTE-Mitteilungsheft**: die Notizen der Lehrkräfte und der Schule
  (Bemerkungen, Lob, Heftmängel) des laufenden Zeitraums.

- **PRONOTE-Stundenplan**: die Stunden von heute, morgen oder dem nächsten
  Schultag, mit Ausfällen und Tests markiert. Die Einstellung **Angezeigte Tage**
  (Standard 1) erweitert ihn auf bis zu 8 Tage ab diesem Tag: eine Zeile pro Tag,
  mit Uhrzeiten und Fächern, und die Stunden beim Öffnen der Zeile. **Heute** und
  **8** zeigen heute bis T+7. Tage ohne Unterricht (Wochenende, Ferien) fehlen.

Jedes Widget hat eine Einstellung **Schüler**: ein Widget pro Kind hinzufügen.
Alle zeigen den letzten Abruf: Das Öffnen eines Dashboards fragt PRONOTE nie ab.

## Schaltflächen der Konfiguration

- **Verbindung testen**: ruft PRONOTE ab und sagt, was gefunden wurde, oder warum
  nicht.
- **Mit QR-Code anmelden**: siehe oben.
- **Gespeicherte Sitzung vergessen**: löscht das gespeicherte Sitzungstoken (zum
  Kontowechsel oder nach einer Passwortänderung anderswo).

## Fehlerbehebung

| Meldung                                                   | Was tun                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRONOTE hat Benutzername oder Passwort abgelehnt          | Prüfe sie auf der PRONOTE-Website. Der Abruf pausiert, bis du die Konfiguration speicherst oder die Verbindung testest.                                                                                                                                              |
| PRONOTE verlangt die Einrichtung der Kontosicherheit      | Melde dich einmal in der PRONOTE-App oder -Website an, um sie abzuschließen (neues Passwort, PIN), und nutze dann den QR-Code.                                                                                                                                       |
| Die IP-Adresse wurde gesperrt                             | Zu viele fehlgeschlagene Anmeldungen oder Anfragen: Der nächste Abruf wartet eine Stunde, die Schaltfläche Aktualisieren und die Szenenaktion ebenfalls. Nutze bis dahin nicht „Verbindung testen“.                                                                  |
| PRONOTE hat die Sitzung direkt nach der Anmeldung beendet | PRONOTE hat diesem Konto eine Seite verweigert und die Sitzung geschlossen. Der nächste Abruf wartet eine Stunde, wie nach einer Sperre, damit sich die Anmeldungen nicht häufen. Schicke die Protokolle der Integration an den Entwickler, wenn es wieder passiert. |
| Der Server ist nicht erreichbar                           | Prüfe die Adresse. Ein ausgelasteter Server wird beim nächsten Abruf erneut versucht.                                                                                                                                                                                |

Schalte **Detaillierte Protokolle** ein, um jeden Schritt in den Protokollen der
Integration zu sehen. Passwörter und Tokens werden nie protokolliert.

## Bekannte Einschränkungen

- **Lehrkräftekonten** werden nicht unterstützt.
- PRONOTE hat keine Benachrichtigungen: Neuigkeiten werden bei jedem Abruf gefunden,
  eine neue Note erscheint also innerhalb des Aktualisierungsintervalls.

## Deine Daten

Das Passwort bleibt in der geheimen Konfiguration von Gladys. Das Sitzungstoken
liegt im privaten Speicher der Integration; Noten, Hausaufgaben und Stundenplan
werden nur im Arbeitsspeicher gehalten und an dein Gladys übermittelt. Nichts wird
anderswohin gesendet.
