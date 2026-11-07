# Live-Viertel und Torszenen – Design

Stand: 2026-11-06. Ergänzt die Haupt-Spec `2026-10-31-fussballmanager-design.md` und ersetzt dort die Konferenz (Abschnitte 2, 3.2 Punkte 3 und 5, 3.3 Punkt 2, 4 „Konferenz“ und „Optionen“).

Klick-Entwurf zum Anschauen: `docs/superpowers/mockups/live-viertel.html` (einzelne Datei, im Browser öffnen). Er ist ein Wegwerf-Entwurf. Er zeigt Aussehen, Druckkurve (Variante B) und die Choreografie der Szene. Sein Code ist keine Vorlage für die Umsetzung.

## 1. Warum

Bisher läuft ein Spieltag als Konferenz ab: eine Anzeigetafel mit Ergebnissen, und bei einem Tor blinkt eine Zeile. Das ist langweilig. Der Nutzer will mitfiebern, und zwar bei den Spielen der menschlichen Manager:

- Er will sehen, wer gerade Druck macht.
- Bei einer Großchance will er gebannt zuschauen, ob daraus ein Tor wird. Das gilt für die eigene Chance genauso wie für die des Gegners.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Jedes Spiel mit einem menschlichen Manager läuft live in einem eigenen Bildschirmbereich.
- Eine Druckkurve zeigt über das ganze Spiel, welche Mannschaft drückt.
- Jedes Tor und ausgewählte Großchancen werden als kurze, animierte Pixelszene gezeigt: Blick über die Schulter des Schützen aufs Tor, der Torwart von vorne. Es gibt fünf Ausgänge: Tor, gehalten, vorbei oder drüber, Pfosten oder Latte.

**Nicht-Ziele**
- Der Druck ist **keine Spielmechanik**. Die Kurve zeigt nur, was die Engine ohnehin auswürfelt. Taktik, Tore oder Schwung ändern an den Chancen nichts. Das kann später kommen.
- Es gibt keinen Live-Ticker der Spiele ohne Manager.
- Es gibt keine verschiedenen Schützen-Grafiken pro Spieler. Grafisch ist es immer derselbe Spieler in Vereinsfarben, nur der Name wechselt.
- Pokale und Handy-Modus gehören nicht dazu.

**Anti-Ziele** (wäre ein Fehlschlag, auch wenn es technisch funktioniert)
- **Die Szene verrät das Ergebnis vorher.** Spielstand, Meldung, Live-Tabelle und Torton dürfen erst im Moment des Schusses umspringen, nicht schon in der Ereignisminute.
- **Die Spielergebnisse ändern sich.** Für denselben Seed muss die Engine dieselben Ergebnisse liefern wie vorher. Das Balancing und die Langzeittests bleiben gültig (Abschnitt 6.3).
- **Szenen fluten das Spiel.** Mehr als etwa 7 Szenen pro Spiel sind zu viel.

## 3. Ablauf eines Spieltags (ändert Haupt-Spec 3.2)

1. Die Manager-Runden und „Vor dem Anpfiff“ bleiben unverändert.
2. **Live, 1. Halbzeit:** Alle Spiele werden wie bisher simuliert. Gezeigt wird der Live-Bildschirm (Abschnitt 4).
3. **Halbzeit** bleibt unverändert. Sie beginnt erst, wenn alle laufenden Szenen fertig sind.
4. **Live, 2. Halbzeit.**
5. **Auswertung:** Die bestehende Ergebnisübersicht (`Results.svelte`) zeigt alle Ergebnisse des Spieltags. Sie bleibt, wie sie ist.

Die Konferenz entfällt ersatzlos (Abschnitt 10). Das gilt auch für die Relegation: Hin- und Rückspiel laufen über den Live-Bildschirm.

Ein nötiges Elfmeterschießen bleibt ein einzelnes Ereignis ohne Szene. Sein Ergebnis steht nach dem Abpfiff im Viertel und in der Ergebnisübersicht. *(Meine Entscheidung.)*

## 4. Der Live-Bildschirm

### 4.1 Aufteilung

Die logische Fläche ist 1280×800 Pixel (Haupt-Spec Abschnitt 4).

| Spiele mit Manager | Aufteilung |
|---|---|
| 1 | Das Spiel füllt den ganzen Bildschirm (1280×800). |
| 2–4 | Vier Viertel à 640×400. Freie Viertel zeigen die **Live-Tabelle**. |

- **Ein Viertel pro Spiel, nicht pro Manager.** Spielen zwei Manager gegeneinander, teilen sie sich ein Viertel. Das frei gewordene Viertel zeigt ebenfalls die Live-Tabelle.
  - Beispiel 1: Zwei Manager spielen gegeneinander, es gibt sonst kein Spiel mit Manager. Dann ist es **ein** Spiel, und es füllt den ganzen Bildschirm.
  - Beispiel 2: Bei vier Managern mit zwei direkten Duellen gibt es zwei Viertel mit Spielen und zwei mit Tabelle.
- **Reihenfolge der Viertel:** Die Spiele stehen in der Reihenfolge der Manager, links oben beginnend. Ein geteiltes Spiel steht an der Stelle seines ersten Managers.
- **Live-Tabelle:**
  - Sie zeigt die Liga des ersten Managers. Spielen die Manager in verschiedenen Ligen und sind zwei Viertel frei, zeigt das zweite freie Viertel die andere Liga.
  - Sie sortiert sich bei jedem Tor um. Bei Spielen ohne Manager zählt das Tor in seiner Ereignisminute. Bei Spielen mit Manager zählt es erst, wenn die Szene es auflöst.
  - Die Vereine der Manager sind hervorgehoben.
  - In der Relegation gibt es keine laufende Liga. Das freie Viertel zeigt dann die Abschlusstabelle der Liga des ersten Managers. *(Meine Entscheidung.)*

### 4.2 Ein Viertel

Als Vorlage dient der Klick-Entwurf. Alle Maße sind im Entwurf in 320×200 angegeben, im Spiel ist ein Viertel doppelt so groß.

- **Kopfzeile** (Holz): Wappen oder Farbchip und Name des Heimvereins, Spielstand, Gastverein, Spielminute. Bei einem Tor blinkt der Spielstand kurz auf.
- **Druckkurve** mit einer Zeile darunter: „▲ Heim · Chancen x : y · Gast ▼“ (Abschnitt 5).
- **Meldungen** (Holz, unten): die letzten 3 Zeilen, die neueste oben. Tore stehen in Gelb.
  - Gemeldet werden Tore, Chancen ohne Szene („Schuss von Müller, drüber“), Ausgänge von Szenen („Müller: gehalten“), Karten, Verletzungen und Wechsel.
  - Die Texte der Chancen ohne Szene sucht das Spiel aus einer kleinen Liste aus.

Bei nur einem Spiel gilt dasselbe Layout in doppelter Größe.

### 4.3 Uhr und Tasten

- Die Uhr läuft für alle Spiele gemeinsam, mit den bestehenden Stufen `TEMPOS = [1000, 500, 200]` ms pro Spielminute.
- **Solange in irgendeinem Viertel eine Szene läuft, gilt die langsamste Stufe (1000 ms).** Danach gilt wieder die gewählte Stufe. Die anderen Spiele laufen in dieser Zeit weiter.
- **Tasten:**
  - **+** und **−** ändern das Tempo.
  - **Leertaste** springt ans Ende der Halbzeit und bricht laufende Szenen ab. Alle bis dahin fälligen Ereignisse gelten dann sofort als aufgelöst.
  - **Enter** geht weiter, sobald die Halbzeit oder das Spiel zu Ende und keine Szene mehr offen ist.
  - **TAB** entfällt.
- Am Ende der Halbzeit erscheinen „HALBZEIT“ bzw. „ABPFIFF“ und der Knopf „Weiter (Enter)“, wie bisher in der Konferenz.

## 5. Druckkurve

### 5.1 Darstellung (Variante B aus dem Entwurf)

- Für jede Spielminute gibt es eine Säule. Nach oben zeigt der Druck der Heimmannschaft in ihrer Vereinsfarbe, nach unten der Druck der Gastmannschaft in deren Farbe.
- Die Mittellinie ist hell. Bei Minute 45 steht eine gestrichelte Halbzeitmarke, an der aktuellen Minute ein gelber Strich.
- Chancen erscheinen als kleine helle Punkte am oberen bzw. unteren Rand, auf der Seite der angreifenden Mannschaft. Tore erscheinen als größere gelbe Punkte.
  - Eine Chance mit Szene erscheint erst, wenn die Szene aufgelöst ist.
  - Eine Chance ohne Szene erscheint in ihrer Minute.
- Der Verlauf bleibt das ganze Spiel über sichtbar, auch über die Halbzeit hinweg.

### 5.2 Woraus die Kurve entsteht

Die Kurve zeigt nur, was die Engine ohnehin würfelt. Es gibt drei Zutaten:

1. **Wer greift an:** In `minuteStep` entscheidet das Mittelfeldverhältnis in jeder Minute, welche Seite angreift. Diese Entscheidung wird pro Minute festgehalten (Abschnitt 6.1). Geglättet über die letzten Minuten ergibt sie die Grundbewegung der Kurve.
2. **Druck vor Chancen:** `simulateHalf` rechnet eine ganze Halbzeit im Voraus. Die Oberfläche kennt deshalb alle Chancen der Halbzeit, bevor sie abgespielt werden. In den 2–3 Minuten vor einer Chance steigt die Kurve zur Seite der angreifenden Mannschaft, vor Großchancen und Toren stärker. So baut sich der Druck sichtbar vor der Chance auf.
3. **Leichtes Rauschen:** Das Rauschen wird aus Spiel-ID und Minute abgeleitet, nicht aus dem Zufallsgenerator der Engine. Dieselbe Halbzeit ergibt also immer dieselbe Kurve.

Die Kurve berechnet eine reine Funktion in der Oberflächenlogik. Sie bekommt die Ereignisse und die Angriffsseiten einer Halbzeit und liefert einen Wert zwischen −1 und +1 pro Minute. Wie genau geglättet und gewichtet wird, entscheidet der Umsetzer. Ziel ist eine Kurve wie im Entwurf: deutlich bewegt, mit erkennbaren Druckphasen.

## 6. Engine-Änderungen

### 6.1 Was neu festgehalten wird

- **Chancen ohne Tor** werden ein neues Ereignis in `MatchEvent`:
  `{ minute, type: "chance", club, player, big: boolean }`.
  - `player` ist der Schütze, den `attack()` ohnehin auswählt.
  - `big` markiert eine Großchance, die eine Szene bekommt.
  - Tore bleiben `type: "goal"` und bekommen immer eine Szene.
- **Angriffsseite pro Minute:** `LiveMatch` bekommt ein Feld mit der Seite, die in der jeweiligen Minute angegriffen hat (`"home" | "away"`). Es ist nur während des Spieltags nötig und wird nicht in `Match` gespeichert.

### 6.2 Was eine Großchance ist

- Eine Chance ohne Tor gilt als Großchance, wenn ihre Torwahrscheinlichkeit `pGoal` (bereits in `attack()` berechnet) über einer Schwelle liegt.
- Die Schwelle wird so eingestellt, dass **im Schnitt 2–3 Großchancen ohne Tor pro Spiel** entstehen. Zusammen mit den durchschnittlich etwa 3 Toren ergibt das 5–6 Szenen pro Spiel.
  - Zur Einordnung: Pro Spiel entstehen insgesamt etwa 8–9 Chancen, denn pro Minute greift nur eine Seite an, mit einer Chancenwahrscheinlichkeit von etwa 0,096. Aus etwa einem Drittel davon wird ein Tor.
- Die Schwelle steht als Konstante in `SIM` und wird in einem Test über viele Spiele geprüft (Abschnitt 11).

### 6.3 Zufallsgenerator unangetastet

Die Erweiterung darf **keinen zusätzlichen Zufallswert** aus dem Engine-Generator ziehen, weder für `big` noch für die Angriffsseite noch für den Ausgang einer Szene. Damit bleiben für jeden Seed alle Ergebnisse gleich. Ein Test prüft das an einem festen Seed: Die Ergebnisse vor und nach der Änderung sind identisch.

### 6.4 Speicherstand

- `Match.events` enthält künftig auch `chance`-Ereignisse. Das sind rund 6 pro Spiel und damit unkritisch für die Größe.
- Die Prüfung beim Laden (`src/storage/validate.ts`, `guards.ts`) muss den neuen Ereignistyp akzeptieren. Alte Spielstände haben keine `chance`-Ereignisse und bleiben gültig.
- Ob dafür die Schemaversion steigt und eine leere Migration nötig ist, entscheidet der Umsetzer nach den bestehenden Regeln in Haupt-Spec Abschnitt 10.

## 7. Torszene

### 7.1 Wann

- Es gibt eine Szene für jedes Tor und jede Chance mit `big: true`, aber **nur in Spielen mit menschlichem Manager**.
- **Eigene Warteschlange pro Viertel:** Fällt eine neue Szene fällig, während im selben Viertel noch eine läuft, startet sie direkt danach.
- In verschiedenen Vierteln dürfen Szenen gleichzeitig laufen.
- Das Viertel zeigt während der Szene die Szene statt Kurve und Meldungen. Danach kehrt es zurück.

### 7.2 Ausgang

- Bei einem Tor ist der Ausgang „TOR!“.
- Bei einer Großchance ohne Tor wird der Ausgang abgeleitet: Ein Hashwert aus Spiel-ID und Minute bestimmt ihn, wieder ohne den Engine-Generator.
  - Gewichte: **gehalten 55 %, vorbei oder drüber 30 %, Pfosten oder Latte 15 %**.
  - Unterarten, ebenfalls aus dem Hashwert: Gehalten wird gefangen oder abgewehrt, vorbei geht seitlich oder drüber, Aluminium trifft Pfosten oder Latte.
- Der Schütze in der Szene ist der echte Spieler aus dem Ereignis. Sein Name steht in der Szenenzeile.

### 7.3 Ablauf

Die Choreografie und Zeiten stehen im Entwurf `docs/superpowers/mockups/szene.js` und sind vom Nutzer abgenommen („genau richtig“).

**Zeitplan** (ab Szenenstart):

| Zeit | Ereignis |
|---|---|
| 0–760 ms | Anlauf des Schützen (Posen 1–4) |
| 760 ms | Schuss (Pose 5, Grasbüschel) |
| 760–1280 ms | Ballflug: Bogen, Ball wird kleiner, Schatten am Boden |
| ab 980 ms | Torwart springt (tief, mittel oder hoch, je nach Ziel) |
| 1280 ms | Auflösung |
| 3400 ms | Ende der Szene |

**Bei der Auflösung (1280 ms):**
- Die große Einblendung erscheint: „TOR!“ in Gelb, sonst „GEHALTEN!“, „VORBEI!“, „DRÜBER!“, „PFOSTEN!“ oder „LATTE!“ in Creme.
- Erst jetzt springen Spielstand, Meldung, Kurvenpunkt und Live-Tabelle um, und der Torton spielt.
- **Tor:** Das Netz beult aus und blinkt, der Schütze jubelt, der Torwart kniet geschlagen am Boden. Der Torwart springt meist in die falsche Ecke oder zu kurz.
- **Gehalten:** Der Torwart wehrt zur Seite ab und liegt danach am Boden, oder er fängt einen zentralen Ball im Stehen. Danach ballt er die Faust.
- **Vorbei oder drüber:** Der Torwart springt vergeblich, der Ball fliegt am Tor vorbei oder darüber.
- **Pfosten oder Latte:** Es gibt einen Funken, und der Ball springt zurück ins Feld. Bei einem Lattentreffer springt der Torwart senkrecht hoch.
- Bei Fehlschüssen schlägt der Schütze die Hände über dem Kopf zusammen.

**Szenenzeile oben:** „GROSSCHANCE 34' Müller · FC Rheinau“.

**Farben:**
- Der Schütze trägt Trikot und Stutzen in Vereinsfarbe 1 und die Hose in Vereinsfarbe 2.
- Der Torwart bekommt eine Farbe aus einer festen Liste, die sich von beiden Farben seines Vereins deutlich abhebt.

### 7.4 Szene im Spiel

- Die Szene wird auf ein Canvas mit 320×200 Pixeln gezeichnet, mit `image-rendering: pixelated` und `imageSmoothingEnabled = false`.
- Im Viertel wird sie 2× skaliert, bei nur einem Spiel 4×. Ein Grafikpixel entspricht damit wie im übrigen Spiel 2×2 logischen Pixeln (Haupt-Spec Abschnitt 4).
- **Szenenkoordinaten** (aus dem aufbereiteten Stadionbild gemessen): Tor innen x 92–228, Unterkante der Latte y 58, Torlinie y 95.

## 8. Grafiken

### 8.1 Herkunft und Aufbereitung

Die Rohbilder hat der Nutzer mit ChatGPT erzeugt. Sie liegen in `assets-raw/szene/` (`stadion`, `torwart`, `schuetze`, `ball-effekte`, `netz`, jeweils `.webp`). Das Skript `assets-raw/szene/aufbereiten.py` macht daraus pixelgenaue PNGs und eine Datei `sprites.json`. Es läuft mit `uv run --no-project --with pillow --with numpy --with scipy python assets-raw/szene/aufbereiten.py`.

| Datei | Größe | Inhalt |
|---|---|---|
| `stadion.png` | 320×200 | Hintergrund |
| `torwart.png` | 4×3 Zellen à 64×56 | 1 bereit, 2 Hüpfer, 3 Seitschritt, 4 gefangen, 5–7 Sprung tief/mittel/hoch nach rechts, 8 liegend, 9 Sprung hoch, 10 fausten, 11 kniend geschlagen, 12 kniend jubelnd |
| `schuetze.png` | 4×2 Zellen à 72×96 | von hinten: 1 stehend, 2–3 Anlauf, 4 Standbein, 5 Schuss, 6 Ausschwung, 7 Jubel, 8 Hände am Kopf |
| `ball-effekte.png` | 6×4 Zellen à 16×16 | Reihe 3 Schatten, Reihe 4 Funke (3 Bilder) und Grasbüschel (3 Bilder). Die Bälle in Reihe 1–2 werden nicht benutzt. |
| `netz.png` | 136×37 | ausgebeultes Netz, wird über das Tor gelegt |
| `sprites.json` | | pro Pose ihr Begrenzungsrahmen in der Zelle, zum Ausrichten an Füßen bzw. Körpermitte |

**Hinweise zu den Bildern:**
- Sprünge nach links entstehen durch Spiegeln.
- Den **Ball** zeichnet das Spiel selbst Pixel für Pixel: weiß mit dunklem Rand und einem wandernden Fleck als Drehung, 9 bis 5 Pixel groß. Die Bälle aus ChatGPT verlieren beim Verkleinern ihr Muster.
- **Platzhalterfarben** zum Umfärben: Torwarttrikot `#00FF00`, Schützentrikot und Stutzen `#FF00FF`, Schützenhose `#00FFFF`. Das Umfärben passiert einmal pro Verein und wird zwischengespeichert. Die Farben werden mit Toleranz erkannt, weil die Palettenreduktion sie leicht verschieben kann.
- Wo die fertigen PNGs im Projekt liegen und wie sie geladen werden, entscheidet der Umsetzer. Das Skript schreibt sie derzeit nach `docs/superpowers/mockups/szene/`. Die Haupt-Spec verlangt, dass alles lokal mitgeliefert wird, ohne CDN.
- Bekannter Schönheitsfehler: Pose 7 des Torwarts hat einen kleinen weißen Fleck an der Hüfte. Er kann bleiben oder von Hand retuschiert werden.

## 9. Ton und Optionen

- **Torton:** Der bestehende Ton `goal` spielt künftig im Moment der Auflösung einer Tor-Szene, nicht mehr in der Ereignisminute. Ist die Szene abgeschaltet oder übersprungen, spielt er in der Minute.
- **Pfiff:** `whistle` am Ende der Halbzeit bleibt.
- **Neue Töne** für Schuss und Aluminium sind erlaubt, aber nicht nötig. Sie müssen im Stil der bestehenden Chiptunes bleiben. *(Meine Entscheidung: kann der Umsetzer weglassen.)*
- **Optionen:**
  - „Konferenz-Tempo“ heißt künftig „Spieltempo“.
  - Neu kommt **„Torszenen an/aus“** hinzu, standardmäßig an. *(Meine Entscheidung, siehe Abschnitt 12.)* Bei „aus“ gibt es keine Szenen und keine Verlangsamung. Tore und Großchancen werden in ihrer Minute aufgelöst. Die Druckkurve bleibt.
  - Die neue Option gehört zu den gespeicherten Optionen und braucht einen Standardwert für vorhandene Optionen.

## 10. Was entfällt

- `src/ui/screens/Conference.svelte` und der Wechsel zwischen den Ligen mit TAB.
- In `src/ui/logic/ticker.ts` entfallen die konferenzspezifischen Teile. Weiter gebraucht werden `TEMPOS`, `halfBounds` und die Tonlogik, die an die Szenen angepasst wird.
- Die Tests der Konferenz (`tests/ui/conference.test.ts` und Stellen in Ablauf-, Options- und Layout-Tests) werden auf den Live-Bildschirm umgestellt.
- Die Haupt-Spec wird angepasst: In den Abschnitten 2, 3.2, 3.3 und 4 wird „Konferenz“ ersetzt und auf dieses Dokument verwiesen.

## 11. Tests

- **Engine:**
  - Gleicher Seed ergibt dieselben Ergebnisse wie vor der Änderung (6.3).
  - `chance`-Ereignisse haben einen gültigen Verein und Schützen.
  - Über viele Spiele liegt der Durchschnitt bei 2–3 Großchancen ohne Tor pro Spiel.
  - Die Angriffsseite ist für jede Minute gesetzt.
- **Oberflächenlogik**, als reine Funktionen getestet:
  - Druckkurve: Wertebereich, Anstieg vor Chancen, Determinismus.
  - Aufteilung: Spiele und freie Viertel bei 1 bis 4 Managern, mit Duellen und mit verschiedenen Ligen.
  - Szenenplanung: Ausgang aus Ereignis und Hashwert, Gewichte, Determinismus.
  - Auflösung: Spielstand, Tabelle und Ton erst bei der Auflösung.
- **Bildschirm:** Uhr, Verlangsamung, Leertaste, Enter, Warten auf offene Szenen am Halbzeitende.
- **Playwright:** Ein Spieltag mit Szenen läuft durch, und bei 1280×800 läuft nichts über.

## 12. Zeitbudget

Die Haupt-Spec sieht 2–3 Minuten pro Spieltag für alle Manager zusammen vor. Die Konferenz dauerte bei normalem Tempo etwa 45 Sekunden.

- **Rechnung:** Jede Szene läuft 3,4 Sekunden bei verlangsamter Uhr. Bei 5–6 Szenen pro Spiel und 4 Spielen mit Manager sind das bis zu rund 20 Szenen pro Spieltag.
  - Laufen Szenen gleichzeitig, überlappen sie sich, und die Zeit verkürzt sich.
  - Im ungünstigsten Fall verlängert sich der Spieltag um etwa eine Minute.
- **Gegenmittel:** Leertaste zum Überspringen, die Tempostufen und die Option „Torszenen aus“.
- **Entscheidung des Nutzers (2026-11-07):** Der längere Spieltag ist in Ordnung, denn das Mitfiebern ist der Sinn der Sache. Szenen werden deshalb nicht gekürzt oder seltener gemacht, um das alte Budget zu halten. In der Haupt-Spec, Abschnitt 2, wird der Satz zur Konferenzdauer entsprechend angepasst.

## 13. Dem Umsetzer überlassen

- Komponentenaufteilung, Dateinamen, Ablage und Laden der Grafiken.
- Die genaue Glättung und Gewichtung der Druckkurve, im Rahmen von Abschnitt 5.2.
- Die genaue Schwelle für Großchancen, im Rahmen von Abschnitt 6.2.
- Die Liste der Texte für Chancen ohne Szene.
- Ob eine Schemaversion fällig ist (6.4).
- Optionale zusätzliche Töne (9).
- Kleine Abweichungen der Choreografie, solange Zeiten und Ausgänge wie in 7.3 bleiben.
