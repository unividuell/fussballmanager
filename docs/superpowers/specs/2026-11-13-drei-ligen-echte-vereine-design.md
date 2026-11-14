# Drei Ligen mit echten Vereinen – Design

Stand: 2026-11-13. Ergänzt die Haupt-Spec `2026-10-31-fussballmanager-design.md` und die Wirtschafts-Spec `2026-11-12-wirtschaft-balancing-design.md`. Ändert dort Haupt-Spec Abschnitt 1 (Nicht-Ziel „echte Vereine“), 3.1 (Neues Spiel), 3.3 (Saisonende), 5.4/6 (Wettbewerbe), 8.4/8.5 (Erwartungen) und 12 (Langzeittest).

## 1. Warum

Der Nutzer will mehr Fußballgefühl: echte Vereine statt erfundener Namen und drei Ligen statt zwei. Das Spiel ist rein privat, es wird nicht veröffentlicht. Damit fällt das bisherige Nicht-Ziel „echte Vereine“ weg *(Entscheidung des Nutzers)*. Die Spieler bleiben fiktiv.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
1. Es gibt drei Ligen mit je 18 Vereinen: Bundesliga, 2. Bundesliga und 3. Liga, zusammen 54 Vereine.
2. Die Vereine tragen ihre echten, gebräuchlichen Namen (Abschnitt 3), mit passenden Kurznamen und Vereinsfarben.
3. Die Vereine sind ungefähr so stark wie in echt *(Entscheidung des Nutzers)*. Bayern ist klar vorn. Traditionsvereine in unteren Ligen haben volle Stadien und mehr Geld, sportlich aber nur einen Kader auf dem Niveau ihrer Liga (Abschnitt 3, „Zwei Werte“).
4. Zwischen 1. und 2. sowie zwischen 2. und 3. Liga gibt es Auf- und Abstieg nach denselben Regeln.
5. Beim neuen Spiel stehen alle 54 Vereine zur Wahl.

**Nicht-Ziele**
- Pixel-Wappen nach den echten Vereinslogos (kommt später, eigene Spec). Bis dahin bleibt das bisherige Wappen-System (Muster und zwei Farben), nur mit den echten Vereinsfarben.
- Echte Spieler, echte Trainer, echte Stadionnamen.
- Eine 4. Liga oder Abstieg aus der 3. Liga.
- Pokale (Schritte 3 und 4).
- Änderungen an Spielsimulation, Training oder Taktik.

**Anti-Ziele** (wäre ein Fehlschlag, auch wenn es technisch funktioniert)
- **Ein Verein steht in der falschen Liga.** Zum Spielstart müssen alle 54 Vereine genau in der Liga stehen, in der sie 2026/27 wirklich spielen. Die Liga darf nicht aus dem Ruf abgeleitet werden.
- **Das Spiel wird langsamer.** Ein Spieltag darf für die Manager nicht spürbar länger dauern als bisher. Live laufen weiterhin nur die Spiele mit menschlichen Managern. Pro Spieltag werden 27 statt 18 Spiele berechnet. Geprüft wird das mit einer Zeitmessung (Abschnitt 8), ein eigenes Optimierungsprojekt ist nicht vorgesehen. *(Meine Entscheidung.)*
- **Drittligisten gehen pleite.** Auch in der 3. Liga gelten die Grundsätze der Wirtschafts-Spec: Kein normal geführter Verein gerät schnell in Geldnot.
- **Die Wirtschaft der beiden oberen Ligen verschiebt sich spürbar.** Die Zielkorridore der Wirtschafts-Spec (Abschnitt 4.1, 5.1) müssen weiter halten.

## 3. Vereine

Quelle: Wikipedia, Teilnehmerlisten der Saison 2026/27, Stand 8. November 2026. Es werden die gebräuchlichen Vereinsnamen verwendet, wie unten aufgeführt, nicht die eingetragenen Langnamen.

**Bundesliga:** FC Bayern München, Borussia Dortmund, SC Freiburg, RB Leipzig, Bayer 04 Leverkusen, Werder Bremen, SV Elversberg, VfB Stuttgart, TSG 1899 Hoffenheim, Eintracht Frankfurt, Hamburger SV, 1. FSV Mainz 05, SC Paderborn 07, FC Augsburg, 1. FC Köln, 1. FC Union Berlin, FC Schalke 04, Borussia Mönchengladbach

**2. Bundesliga:** Hertha BSC, 1. FC Nürnberg, 1. FC Kaiserslautern, 1. FC Magdeburg, VfL Wolfsburg, Arminia Bielefeld, 1. FC Heidenheim, VfL Bochum, FC St. Pauli, SpVgg Greuther Fürth, Hannover 96, Energie Cottbus, Eintracht Braunschweig, VfL Osnabrück, Dynamo Dresden, Karlsruher SC, SV Darmstadt 98, Holstein Kiel

**3. Liga** (18 von 20; die Zweitvertretungen TSG 1899 Hoffenheim II und VfB Stuttgart II entfallen, *Entscheidung des Nutzers*): Viktoria Köln, MSV Duisburg, Rot-Weiss Essen, SV Wehen Wiesbaden, FC Ingolstadt 04, 1. FC Saarbrücken, Alemannia Aachen, SV Waldhof Mannheim, Hansa Rostock, SV Meppen, Fortuna Düsseldorf, Preußen Münster, Würzburger Kickers, SSV Jahn Regensburg, SC Verl, SG Sonnenhof Großaspach, SC Fortuna Köln, TSV Havelse

**Je Verein werden fest hinterlegt:**
- Name wie oben
- Kurzname für enge Anzeigen (Live-Bildschirm, Tabellen), höchstens so lang wie die bisherigen Kurznamen, z. B. „Bayern“, „Dortmund“, „Schalke“, „St. Pauli“, „Havelse“
- Zwei Vereinsfarben, möglichst nah an den echten Farben, auf dem dunklen Holz-Look lesbar
- **Ruf** (1–100) nach echter Größe, Tradition und Zuschauerzuspruch, nicht nach aktuellem Tabellenplatz. Anhaltspunkte: Bayern etwa 98, Dortmund etwa 92, große Traditionsvereine wie Schalke, HSV, Hertha, Köln, Frankfurt, Gladbach, Bremen hoch, kleine Vereine wie Elversberg, Heidenheim, Verl, Havelse niedrig. Ein Traditionsverein in einer unteren Liga hat einen höheren Ruf als die meisten seiner Ligakonkurrenten.
- **Kaderstärke** (1–100) nach der aktuellen sportlichen Stärke 2026/27. Sie liegt im Band der eigenen Liga: Der schwächste Bundesligist ist stärker als der Durchschnitt der 2. Liga, der stärkste Drittligist schwächer als der Durchschnitt der 2. Liga. Innerhalb der Liga ordnet der Umsetzer nach echter Stärke, z. B. Bayern vor Dortmund vor Leipzig und Elversberg im unteren Bereich der Bundesliga.
- Das Wappenmuster wählt der Umsetzer fest je Verein aus den bestehenden Mustern.

Die Daten liegen als fester Datensatz im Code (eine Datei mit 54 Einträgen), nicht zufällig erzeugt. Die Kader bleiben zufällig, ihre Stärke folgt wie bisher dem Ruf. Der Seed bestimmt also nur noch Spieler und Zufallsfolge, nicht mehr die Vereine.

**Zwei Werte** *(Entscheidung des Nutzers, Variante A)*: Die Startliga steht im Datensatz und wird nicht aus einem der Werte abgeleitet.
- Die **Kaderstärke** bestimmt nur die Stärke der erzeugten Spieler beim Spielstart (bisher `baseStrengthFor(reputation)`). Danach entwickeln sich die Kader wie bisher.
- Der **Ruf** bestimmt alles Wirtschaftliche wie bisher: Zuschauer, Stadionstufe, Startpreis, Sponsoren, Startkapital, Dispo-Limit, Gehaltsforderungen und die Erwartung des Vorstands. Ein Traditionsverein in der 3. Liga hat also ein volles Stadion, mehr Geld und einen Vorstand, der den Aufstieg erwartet. Den Aufstieg muss er sich trotzdem erarbeiten, etwa mit Transfers. *(Die Erwartung nach Ruf ist meine Entscheidung; sie entspricht dem bisherigen Verhalten.)*
- Die Kaderstärke wird nach dem Spielstart nicht gespeichert. Ein Verein trägt wie bisher nur den Ruf.

## 4. Ligen und Saisonablauf

- **Drei Ligen** mit je 18 Vereinen und 34 Spieltagen. Der Kalender bleibt gleich lang. Alle drei Ligen spielen an denselben Kalendertagen.
- **Auf- und Abstieg zwischen 1. und 2. Liga** bleibt wie bisher: Die Plätze 17 und 18 steigen ab, die Plätze 1 und 2 steigen auf. Der 16. der 1. Liga spielt in der Relegation gegen den 3. der 2. Liga.
- **Zwischen 2. und 3. Liga** gelten dieselben Regeln: Die Plätze 17 und 18 der 2. Liga steigen ab, die Plätze 1 und 2 der 3. Liga steigen auf, und der 16. der 2. Liga spielt in der Relegation gegen den 3. der 3. Liga.
- **Beide Relegationen** laufen an denselben zwei Kalendertagen nach dem 34. Spieltag, je mit Hin- und Rückspiel. Es gilt dieselbe Entscheidungsregel wie bisher, also Gesamtergebnis und dann Elfmeterschießen. Spielt ein Manager-Verein in einer Relegation, läuft sein Spiel live wie bisher.
- **Nach der Saison** haben alle drei Ligen wieder genau 18 Vereine. Pro Grenze wechseln 2 oder 3 Vereine in jede Richtung.
- **Saisonende-Bildschirm und Saisonhistorie** nennen Meister und Torschützenkönig aller drei Ligen sowie Auf- und Absteiger beider Grenzen.
- **Erwartungen des Vorstands:** Sie werden in jeder Liga wie bisher nach Ruf verteilt. Für die 3. Liga lauten die Stufen „Aufstieg“, „oberes Drittel“, „gesichertes Mittelfeld“ und „Klassenerhalt“. Weil es keinen Abstieg aus der 3. Liga gibt, gilt „Klassenerhalt“ dort trotzdem als Ziel „Platz 15 oder besser“, damit der Vorstand gleich reagiert. *(Meine Entscheidung.)*

## 5. Wirtschaft der 3. Liga

Die Wirtschafts-Spec gilt sinngemäß für die 3. Liga. Zusätzlich:

- TV-Geld, Sponsorangebote, Platzprämien und die Nachfrage im Stadion sind in der 3. Liga niedriger als in der 2. Liga. Die Werte wählt der Umsetzer.
- **Zielkorridor** (Ergebnis vor Transfers, gemessen wie in der Wirtschafts-Spec an Referenzvereinen mit vernünftigem Manager): ein mittlerer Drittligist etwa 0 bis +1 Mio pro Saison, ein kleiner Drittligist nie strukturell negativ.
- **Ein Aufstieg in die 2. Liga lohnt sich spürbar:** Ein Aufsteiger hat in der 2. Liga deutlich mehr Einnahmen als zuvor.
- **Die KI-Korridore** (Median, Maximum, Dispo) gelten für alle 54 Vereine zusammen.
- **Große Vereine in unteren Ligen:** Auch ein Traditionsverein mit hohem Ruf in der 2. oder 3. Liga darf bei normaler Führung nicht strukturell ins Minus rutschen. Der Ruf bringt ihm höhere Einnahmen (Zuschauer, Sponsor), sein Kader ist nur ligaüblich stark. *(Meine Entscheidung.)*
- **Referenzvereine** für die Korridore werden je Liga nach Ruf gewählt: ein großer, ein mittlerer und ein kleiner Verein der Liga. *(Meine Entscheidung.)*
- Die bisherige Unterscheidung „2. Liga“ in Wirtschaftsformeln (Sponsorfaktor, Nachfragefaktor, TV-Geld, Prämien, Transferbereitschaft „Wechsel in eine niedrigere Liga“) wird auf drei Stufen erweitert.

## 6. Oberfläche

- **Neues Spiel:** Die Vereinsauswahl zeigt alle 54 Vereine, gruppiert nach Liga, in der Reihenfolge des Datensatzes oder nach Ruf. Die Auswahl muss bei 1280×800 ohne Überlauf funktionieren, etwa mit drei Spalten oder einer Liste mit Liga-Umschalter. Die Form wählt der Umsetzer.
- **Tabellen:** Alle drei Ligen sind erreichbar, wie bisher per Umschalter.
- **Live-Bildschirm, Ergebnisse, Saisonende:** Sie berücksichtigen die dritte Liga und die zweite Relegation. Wo bisher „die andere Liga“ angezeigt wird, entscheidet der Umsetzer, wie die Live-Tabelle mit drei Ligen umgeht. Vorrang hat die Liga des ersten Managers, dann die Ligen der übrigen Manager.
- Die Namen sind länger als die bisherigen Fantasienamen, z. B. „Borussia Mönchengladbach“. Überall, wo Platz knapp ist, wird der Kurzname verwendet. Der Layout-Test gegen Überlauf gilt weiter.

## 7. Spielstand

Neue Spielstand-Version. Alte Spielstände dürfen ignoriert werden, es gibt nur Testspielstände *(Entscheidung des Nutzers wie beim letzten Mal)*. Eine Migration ist nicht nötig. Ein Spielstand älterer Version wird beim Laden mit einer verständlichen Meldung abgelehnt. *(Meine Entscheidung: Eine Migration von 36 Fantasievereinen auf 54 echte Vereine wäre aufwendig und ohne Nutzen.)*

## 8. Tests

- **Datensatz:** 54 Vereine, je 18 pro Startliga, eindeutige Namen und Kurznamen, Ruf zwischen 1 und 100, zwei verschiedene Farben. Die Bundesliga enthält „FC Bayern München“, die 3. Liga enthält „TSV Havelse“ und keine Zweitvertretung.
- **Startliga:** Nach `startNewGame` steht jeder Verein in der Liga aus dem Datensatz, auch wenn sein Ruf höher ist als der einiger Vereine der Liga darüber.
- **Auf- und Abstieg** an beiden Grenzen, mit und ohne Relegationssieg des Unterklassigen. Danach haben alle drei Ligen 18 Vereine.
- **Langzeittests** auf 54 Vereine erweitert: Saisons, Wirtschaft (Abschnitt 5) und die bestehenden Korridore der Wirtschafts-Spec.
- **Kaderstärke:** Nach dem Spielstart liegt die mittlere Stammelf jedes Bundesligisten über dem Mittel der 2. Liga, die jedes Drittligisten darunter. Ein Verein mit hohem Ruf in der 3. Liga hat keinen Kader auf Bundesliga-Niveau.
- **Zeitmessung:** Ein automatisch gespielter Spieltag (KI-Teil ohne Live-Wiedergabe) dauert mit 54 Vereinen höchstens etwa das 1,6-Fache der bisherigen 36 Vereine, gemessen im selben Testlauf gegen eine Welt mit nur zwei Ligen oder gegen einen festen Richtwert.
- **Oberfläche:** Vereinsauswahl mit 54 Vereinen, Tabellen mit drei Ligen, Saisonende mit beiden Relegationen, kein Überlauf bei 1280×800.

## 9. Dem Umsetzer überlassen

- Kurznamen, Farben, Ruf, Kaderstärke und Wappenmuster je Verein, innerhalb der Vorgaben aus Abschnitt 3
- Die Wirtschaftswerte der 3. Liga
- Die Gestaltung der Vereinsauswahl und der Live-Tabelle mit drei Ligen
- Interne Bezeichner, z. B. ob die Wettbewerbe `L1`/`L2`/`L3` und `REL1`/`REL2` heißen

## 10. Ergebnis (2026-11-14)

Gemessen mit `tests/longrun/measure.ts`: 3 Spielwelten (Seeds 11, 2027, 4242) × 5 Saisons, 4 passive Manager (FC Bayern München, Hertha BSC, Fortuna Düsseldorf, TSV Havelse).

| Größe | Ergebnis |
|---|---|
| KI-Median am Saisonende | 3,3 → 3,3–4,9 Mio, flach |
| Reichster KI-Verein am Saisonende | 9,6–15,8 Mio |
| KI-Vereine über dem Dispo-Limit | 0 (im 10-Saisons-Langzeittest bis zu 3 von 54, meist frische Absteiger) |
| Auslastung 1. Liga | Top 3 0,95–0,96, letzte 3 0,85–0,88 |
| Auslastung 3. Liga | Top 3 0,84–0,88, letzte 3 0,33–0,43 |
| Zeit pro automatisch gespieltem Spieltag | 134–142 ms (vorher 126–136 ms mit 36 Vereinen) |

Ergebnis vor Transfers bei Referenzvereinen mit vernünftigem Manager (Langzeittest, 3 Welten × 4 Saisons): 1. Liga groß Ø 11,2 / mittel 3,1 Mio; 2. Liga groß 5,5 / mittel 2,2 / klein 0,8 Mio; 3. Liga groß 3,4 / mittel 1,0 / klein 0,1 Mio. Ein Aufstieg von der 3. in die 2. Liga bringt im Mittel 37 % mehr Einnahmen. Ein großer Erstligist hat nach 2 Saisons 32–39 Mio.

**Passive Manager:** Ein Verein ohne Eingriffe verliert seine Spieler durch auslaufende Verträge. Der passive FC Bayern steigt in allen drei Welten nach 3 Saisons ab und nach 4 Saisons erneut. Sein Kontostand liegt nach 5 Saisons bei 20–21 Mio, Hertha bei 12–19 Mio, Düsseldorf bei 16–17 Mio, Havelse bei 3 Mio.

**Neue Regeln, die sich beim Abstimmen als nötig erwiesen haben:**
- Gehaltsniveau nach Liga (1. Liga 100 %, 2. Liga 75 %, 3. Liga 55 %).
- Abstiegsklausel: Beim Abstieg sinken die Gehälter auf das Niveau der neuen Liga, Manager bekommen dazu eine Nachricht.
- Dispozins 0,3 % statt 1 % pro Liga-Spieltag (etwa 10 % pro Saison statt 34 %), damit verschuldete Vereine nicht in einer Zinsfalle landen.
- Stadionunterhalt in unteren Ligen günstiger (85 % bzw. 70 %).
- Startpreis und Startstadion der 3. Liga passen zur geringeren Nachfrage.

**Weitere Wertänderungen beim Abstimmen** (gegenüber der Wirtschafts-Spec vom 2026-11-12):
- TV-Geld pro Liga-Spieltag: 1. Liga 50.000 €, 2. Liga 50.000 €, 3. Liga 25.000 €.
- Platzprämien gesamt: 1. Liga 6 Mio, 2. Liga 1 Mio, 3. Liga 0,3 Mio.
- Sponsor nach Liga: 100 % / 50 % / 15 % des Erstliga-Niveaus.
- Grundnachfrage im Stadion nach Liga: 100 % / 50 % / 45 %, Zahlungsbereitschaft 100 % / 65 % / 45 %.
- Stadionunterhalt: Stufe 1 4.000 € (vorher 8.000 €), Stufe 4 90.000 € (vorher 80.000 €) pro Spieltag.
- Spielerprämien reicher KI-Vereine: 8 % statt 5 % des Überschusses pro Liga-Spieltag.
- Ruf angepasst: Bayern 93, Dortmund 91, Schalke 89, Bremen, Köln und Gladbach 82, Elversberg 48.
