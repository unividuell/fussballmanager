# Traditionsvereine aus der Regionalliga – Design

Stand: 2026-11-17. Ergänzt `2026-11-13-drei-ligen-echte-vereine-design.md` und `2026-11-16-startliga-design.md`.

## 1. Warum

Der Nutzer will auch mit bekannten Traditionsvereinen spielen können, die heute in der Regionalliga spielen, etwa 1860 München oder SSV Ulm. Es sollen genau 10 sein: Zusammen mit den 54 Vereinen der drei Ligen ergibt das 64 Vereine, ein perfekter Turnierbaum für den späteren Pokal *(Entscheidung des Nutzers)*.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
1. Die Spielwelt hat immer genau 64 Vereine: 54 in den drei Ligen, 10 in der „Regionalliga“.
2. Zum Spielstart sind in der Regionalliga die 10 Traditionsvereine aus Abschnitt 3 *(vom Nutzer bestätigt)*.
3. Ein Manager kann einen Traditionsverein wählen. Dann muss er eine Startliga wählen, vorausgewählt ist die 3. Liga *(Entscheidung des Nutzers)*. Der Verein wird an diese Liga angepasst wie bei der Startliga-Wahl.
4. Für jeden Traditionsverein, der in eine Liga kommt, rutscht der schwächste nicht gesperrte Drittligist in die Regionalliga *(Entscheidung des Nutzers)*. Die Nachrückkette läuft wie in der Startliga-Spec, die Regionalliga ist dabei die Stufe unter der 3. Liga.
5. Die Vereine der Regionalliga bleiben mit spielfähigem Kader erhalten, damit der Pokal sie später einbeziehen kann.

**Nicht-Ziele**
- Ligaspiele der Regionalliga, eine Regionalliga-Tabelle, Auf- oder Abstieg zwischen 3. Liga und Regionalliga. Das kann mit dem Pokal oder später kommen.
- Wirtschaft der Regionalliga-Vereine (keine Einnahmen und Ausgaben, kein Vorstand).
- Der Pokal selbst.

**Anti-Ziele**
- **Die Zahl der Vereine ändert sich.** Nach dem Spielstart und nach jedem Saisonwechsel gibt es genau 64 Vereine, davon 18 pro Liga und 10 in der Regionalliga.
- **Regionalliga-Vereine verfallen.** Ihr Kader darf über die Saisons nicht ausbluten. Jeder hat zu jedem Saisonbeginn mindestens 22 Spieler.
- **Regionalliga-Vereine stören die Ligen.** Sie kaufen und verkaufen keine Spieler, machen keine Angebote und tauchen weder in Ligatabellen noch im Live-Bildschirm auf.
- **Wer nichts Neues wählt, merkt etwas** in den drei Ligen. Die 54 Ligavereine und ihre Kader entstehen bei gleichem Seed wie bisher. Die zusätzlichen Spieler der Traditionsvereine werden nach allen bisherigen erzeugt.

## 3. Die 10 Traditionsvereine

Quelle: Wikipedia, Regionalligen 2026/27.

| Verein | Regionalliga 2026/27 |
|---|---|
| TSV 1860 München | Bayern |
| SSV Ulm 1846 | Südwest |
| FC Erzgebirge Aue | Nordost |
| Kickers Offenbach | Südwest |
| Stuttgarter Kickers | Südwest |
| Rot-Weiß Oberhausen | West |
| SG Wattenscheid 09 | West |
| FC Carl Zeiss Jena | Nordost |
| 1. FC Lokomotive Leipzig | Nordost |
| Chemnitzer FC | Nordost |

Sie stehen im Vereinsdatensatz mit der Startliga „RL“, mit Kurzname, Farben, Wappenmuster, Ruf und Kaderstärke.
- **Kaderstärke:** unterhalb des Bands der 3. Liga, also schwächer als der schwächste Drittligist.
- **Ruf:** nach Tradition. 1860 München etwa auf dem Niveau großer Zweitligisten, die übrigen etwa auf dem Niveau mittlerer bis großer Drittligisten. Der Ruf ist für die Regionalliga ohne Wirkung und wird bei einem Wechsel in eine Liga ohnehin angepasst (Startliga-Spec, Abschnitt 4).

## 4. Regionalliga im Spiel

- Die Regionalliga ist kein Wettbewerb mit Spielen. Sie ist die Menge der Vereine, die in keiner der drei Ligen stehen.
- **Kader:** Verträge von Regionalliga-Spielern laufen nicht aus. Altern und Karriereende laufen wie bei allen Spielern. Zu jedem Saisonbeginn wird jeder Regionalliga-Kader auf 25 Spieler aufgefüllt, mit neu erzeugten Spielern passend zur Kaderstärke der Regionalliga (unteres Ende der 3. Liga oder darunter). *(Meine Entscheidung.)*
- **Markt:** Spieler von Regionalliga-Vereinen sind für Manager und KI nicht verfügbar. Regionalliga-Vereine kaufen nicht und schicken keine Angebote.
- **Finanzen und Vorstand:** Sie werden nicht gebucht bzw. nicht bewertet.
- **Ein Verein, der beim Spielstart in die Regionalliga rutscht,** behält seinen Namen und seine Farben. Sein Kader wird an die Regionalliga angepasst wie bei jedem Wechsel.

**Gleicher Seed:** „Wie bisher“ gilt für die Welt beim Spielstart: Ligavereine, ihre Spieler und die Vereinslosen sind gleich. Im weiteren Spielverlauf dürfen die Ergebnisse abweichen, weil die zusätzlichen Spieler dieselbe Zufallsfolge mitbenutzen. *(Meine Entscheidung.)*

**Spielstände:** Neue Spielstand-Version. Ältere Spielstände mit 54 Vereinen werden beim Laden mit einer verständlichen Meldung abgelehnt, wie beim Wechsel auf echte Vereine. Es gibt nur Testspielstände. *(Meine Entscheidung, nach dem Vorbild von 2026-11-13, Abschnitt 7.)*

## 5. Oberfläche

- In „Neues Spiel“ bekommt die Vereinsauswahl eine vierte Gruppe „Traditionsvereine (Regionalliga)“.
- Wählt ein Manager einen Traditionsverein, springt die Startliga auf „3. Liga“. Die Regionalliga ist keine wählbare Startliga.
- Tabellen, Live-Bildschirm und Saisonende zeigen weiterhin nur die drei Ligen.

## 6. Tests

- **Datensatz:** 64 Vereine, 10 mit Startliga „RL“, genau die Namen aus Abschnitt 3, eindeutige Kurznamen. Jede RL-Kaderstärke liegt unter der schwächsten der 3. Liga.
- **Welt:** Nach dem Spielstart 18/18/18 in den Ligen und 10 Vereine ohne Liga. Die Ligavereine und ihre Spieler sind gleich wie vor dieser Änderung (gleicher Seed, Spieler-IDs und Werte der 54 Ligavereine unverändert).
- **1860 in die 3. Liga:** 1860 steht in L3, der schwächste Drittligist ist ohne Liga und angepasst. Es bleiben 64 Vereine.
- **1860 in die 1. Liga:** Je ein schwächster Verein steigt aus der 1. in die 2. und aus der 2. in die 3. Liga ab, der schwächste Drittligist rutscht in die Regionalliga.
- **Langzeit:** Über 10 Saisons bleiben 64 Vereine. Jeder Regionalliga-Verein hat zu jedem Saisonbeginn mindestens 22 Spieler. Kein Spieler wechselt zu oder von einem Regionalliga-Verein, außer beim Auffüllen.
- **Oberfläche:** Die vierte Gruppe mit 10 Vereinen, die Startliga springt bei einem Traditionsverein auf „3. Liga“, und ein Spiel mit 1860 in der 3. Liga startet dort.

## 7. Dem Umsetzer überlassen

- Ruf, Kaderstärke, Kurznamen, Farben und Wappenmuster der 10 Vereine im Rahmen von Abschnitt 3
- Wie die Regionalliga im Code markiert ist (z. B. `leagueOf` = `null` und eine Hilfsfunktion)
- Wo die Ausnahmen für Regionalliga-Vereine sitzen (Markt, Verträge, Finanzen)
