# Wirtschafts-Balancing, Stadion und Vorstand – Design

Stand: 2026-11-12. Ergänzt die Haupt-Spec `2026-10-31-fussballmanager-design.md` und ändert dort Abschnitt 4 (Hauptmenü), 8.1 (Einnahmen, Stadion), 8.3 (Marktwert), 8.5 (Vorstand) und 12 (Langzeittest).

Entwurf zum Anschauen: https://claude.ai/artifact/D2vWoBDgddqzgk7H1Y1wzM, Entwurf **B**. Er ist ein Wegwerf-Entwurf für Aufteilung und Inhalt. Sein Code ist keine Vorlage.

## 1. Warum

Eine simulierte Testsaison (3 Spielwelten × 3 Saisons, 4 passive Manager neben den KI-Vereinen) hat gezeigt:

- **Geld verliert seinen Sinn.** Jeder Verein macht Gewinn, auch ohne dass sein Manager irgendetwas tut. Ein passiver Erstligist wächst in 3 Saisons von 4,4 auf 31 Mio. Der Median der KI-Vereine steigt von etwa 3,5 auf 5–11 Mio, der reichste erreicht 96 Mio. Kein KI-Verein lag je über dem Dispo-Limit. Die Tickets bringen den Löwenanteil: 17–23 Mio pro Saison bei einem Erstligisten, verglichen mit 3,4 Mio TV-Geld.
- **Topspieler sind zu billig, um besonders zu wirken.** Der teuerste Spieler zu Spielbeginn hat 13,5 Mio Marktwert. Spieler über 20 Mio gibt es nicht.
- **Der Stadionausbau ist wertlos.** Die Stadien sind nur zu 45–65 % gefüllt, denn schon die Startstufe ist größer als die höchste mögliche Nachfrage. Ein Verein mit Ruf 90 kommt als Tabellenerster auf höchstens etwa 42.000 Zuschauer bei 65.000 Plätzen.
- **Der Eintrittspreis ist keine Entscheidung.** Der voreingestellte Preis ist immer schon der erlösoptimale, und er hängt nicht vom Erfolg ab.
- **Der Vorstand ist unsichtbar.** Saisonziel und Vertrauen tauchen in der Oberfläche nicht auf. Man erfährt das Ziel erst am Saisonende, obwohl der Sponsorbonus daran hängt. Das Vertrauen fällt schnell auf 0 und bleibt dort.

## 2. Was der Nutzer will

- **Der Spaß steht vorn.** Geld soll nicht schnell knapp werden, und kein Verein soll schnell in Geldnot geraten. Dispo und Limit sind eine seltene Notbremse für grobe Fehler, kein Alltag.
- **Geld ist zum Ausgeben da.** Der große Moment ist ein Königstransfer für 20 Mio. Er soll erreichbar sein und sich wie ein Highlight anfühlen.
- **Später kommt mehr Geld dazu.** Pokal und Europapokal (Ausbaustufen 3 und 4) werden zusätzliche Einnahmen bringen. Die Liga allein darf deshalb nicht schon das ganze Geld liefern.
- **Stadien werden voll, und Ausbau bringt mehr Zuschauer.** Große Vereine sind schon in der ersten Saison meist ausverkauft, ein Ausbau lohnt bei ihnen also sofort. Kleinere Vereine kommen erst mit Erfolg an ihre Grenze.
- **Saisonziel und Vertrauen sind immer sichtbar,** über die Kopfzeile und einen eigenen Menüpunkt „Vorstand“ (Entwurf B).

## 3. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
1. Die Geldmenge wächst gebremst statt ungebremst (Zielgrößen in Abschnitt 4.1).
2. Ein großer, gut geführter Erstligist kann sich ohne Pokale nach ein bis zwei Saisons Sparen einen Spieler für etwa 20 Mio leisten. Kleinere Vereine schaffen das nur über Spielerverkäufe oder später über Pokalerfolge. „20 Mio“ meint die tatsächlich gezahlte Ablöse, bezahlt aus eigenem Guthaben ohne Dispo. Weil KI-Vereine einen Leistungsträger nur über Marktwert abgeben, liegt der Marktwert eines solchen Spielers etwa bei 15–20 Mio. *(Meine Entscheidung.)*
3. Spitzenspieler kosten 15–25 Mio.
4. Erfolgreiche Vereine füllen ihr Stadion bei einem vernünftigen Preis, und ein Ausbau zahlt sich aus.
5. Der Eintrittspreis ist eine echte Entscheidung: Bei vollem Stadion lohnt ein höherer Preis, bei leerem ein niedrigerer.
6. Saisonziel und Vertrauen sind jederzeit sichtbar, und das Vertrauen reagiert ausgewogen.

**Nicht-Ziele**
- Pokale, neue Geldquellen, dynamischer Ruf und Spielerattribute gehören nicht dazu.
- An der Spielsimulation und ihrer Kalibrierung (Haupt-Spec 7.3) ändert sich nichts.
- Der Vorstand bekommt keine neuen Folgen: keine Entlassungen, keine Budgetvorgaben (Haupt-Spec 8.5 bleibt).
- Taktik, Training und Verträge bleiben unverändert, ebenso die Verhandlungsregeln.

**Anti-Ziele** (wäre ein Fehlschlag, auch wenn es technisch funktioniert)
- **Ein Verein rutscht bei normalem Spiel in die Geldnot.** Wer einen gewöhnlichen Kader hält und nicht wild einkauft, bleibt im Plus. Das gilt auch für den schwächsten Zweitligisten.
- **Das Spiel wird knauserig.** Man muss nicht jeden Spieltag rechnen. Der Kontostand ist ein Polster, kein Engpass.
- **Der Königstransfer ist Alltag.** Wenn sich jeder Erstligist jede Saison einen 20-Mio-Spieler leisten kann, ist er kein Highlight mehr.
- **Mit Pokalen wird es zu viel.** Die Liga-Wirtschaft ist so abgestimmt, dass später zusätzliches Pokalgeld ins Spiel kommen kann, ohne dass die Geldmenge wieder davonläuft.

## 4. Wirtschaft

### 4.1 Zielgrößen

Gemessen wird mit KI-Vereinen über 10 Saisons, im erweiterten Langzeittest (Abschnitt 7). Die Werte sind Korridore, keine Punktziele.

| Größe | Ziel |
|---|---|
| Median-Kontostand der KI-Vereine | bleibt über 10 Saisons in einem Band von etwa 0,7× bis 2,5× des Startwerts, ohne Trend nach oben |
| Reichster KI-Verein | höchstens etwa 40 Mio |
| KI-Vereine über dem Dispo-Limit | im Normalfall 0, höchstens vereinzelt und kurz |
| Ergebnis eines großen Erstligisten (Ruf 85+) vor Transfers | etwa 8–12 Mio pro Saison |
| Ergebnis eines mittleren Erstligisten vor Transfers | etwa 2–5 Mio pro Saison |
| Ergebnis eines Zweitligisten vor Transfers | etwa 0–2 Mio pro Saison, nie strukturell negativ |
| Teuerste Spieler | etwa 5–10 Spieler mit einem Marktwert über 15 Mio, die Spitze bei 20–25 Mio |

„Vor Transfers“ heißt: Einnahmen minus Gehälter, Unterhalt und Zinsen, mit einem gewöhnlichen, gepflegten Kader.

### 4.2 Stellschrauben

Welche Konstanten und Formeln geändert werden, entscheidet der Umsetzer. Naheliegend sind:

- **Ticketeinnahmen dämpfen.** Sie sind heute mit Abstand die größte Quelle.
- **Gehälter** (`salaryFor`) **und Marktwerte** (`marketValue`) für starke Spieler anheben, damit Topspieler teuer werden und Stars beim Gehalt spürbar ins Gewicht fallen.
- **Stadionunterhalt** an die neue Ticketwirtschaft anpassen.
- **KI-Transferbudget:** KI-Vereine sollen überschüssiges Geld wieder ausgeben, damit sie nicht horten. Die Grenze von höchstens 2–3 Transfers pro Fenster (Haupt-Spec 8.4) bleibt.

Ein passiver menschlicher Manager verliert weiterhin Spieler durch auslaufende Verträge. Das bleibt so. Weil seine Gehaltskosten dabei fallen, darf er etwas Geld ansammeln, aber nicht mehr als ein gut geführter Verein derselben Größe.

## 5. Stadion und Eintrittspreis

### 5.1 Verhalten

- Die Nachfrage hängt wie bisher von Ruf, Liga, Tabellenplatz, Gegner und Preis ab (Haupt-Spec 8.1).
- **Große Vereine** (etwa die obersten Plätze nach Ruf in der 1. Liga) sind bei einem vernünftigen Preis schon in der ersten Saison meist ausverkauft. Ihr Ausbau lohnt sofort.
- **Kleinere Vereine** haben im Startstadion Lücken und kommen erst mit sportlichem Erfolg an die Kapazitätsgrenze.
- **Ein Verein im Abstiegskampf** hat auch bei gutem Preis sichtbare Lücken.
- **Ausbau:** Nach der Fertigstellung kommen bei einem erfolgreichen Verein spürbar mehr Zuschauer. Die Baukosten verdienen sich für einen Verein, der vorher ausverkauft war, in etwa 3–5 Saisons wieder ein.
- **Eintrittspreis:** Der erlösbeste Preis hängt jetzt von der Lage ab. Ist das Stadion voll, bringt ein höherer Preis mehr, weil man Zuschauer verliert, die ohnehin keinen Platz bekommen hätten. Ist es leer, bringt ein niedrigerer Preis mehr. Der Bereich von etwa 15 bis 40 € aus der Haupt-Spec bleibt der Richtwert.

### 5.2 Umsetzungshinweise

- Startstufe (`initialStage`), Kapazitäten, Baukosten, Bauzeiten und die Nachfrageformel dürfen neu abgestimmt werden. Die 5 Ausbaustufen und das Bauen über mehrere Spieltage bleiben.
- KI-Vereine setzen ihren Preis passend zur Lage (voll oder leer). Wie genau, entscheidet der Umsetzer. Sie bauen ihr Stadion aus, wenn es sich lohnt und das Geld reicht. *(Meine Entscheidung, damit KI-Vereine ihr Geld sinnvoll ausgeben und mit menschlichen Managern mithalten.)*
- Der bisherige „Richtwert“ im Eintrittspreis-Feld zeigt einen festen optimalen Preis. Er entfällt oder wird zu einem Hinweis, der zur Lage passt, etwa „ausverkauft – Preis erhöhen?“ oder „viele freie Plätze“. *(Meine Entscheidung: Der Hinweis soll die Entscheidung erklären, aber nicht abnehmen.)*

## 6. Vorstand und Hauptmenü

### 6.1 Kopfzeile

`ClubHeader` zeigt auf jedem Vereinsbildschirm zusätzlich das Saisonziel, etwa „Ziel: Aufstieg“, neben Platz und Kontostand. Die Bezeichnung kommt aus `expectationLabel`.

### 6.2 Hauptmenü mit 10 Kacheln

Die Reihenfolge ist: 1 Mannschaft, 2 Training, 3 Verträge, 4 Transfers, 5 Finanzen, **6 Stadion** (neu), **7 Vorstand** (neu), 8 Tabelle, 9 Nachrichten, 0 Weiter. Das Raster hat 5 Spalten und 2 Zeilen. Enter bleibt „Weiter“, S und O bleiben Speichern und Optionen. *(Meine Entscheidung: Tasten 1–9 und 0, Weiter liegt jetzt auf 0 statt 8.)*

Die Fläche bleibt 1280×800, und der bestehende Layout-Test gegen Überlauf gilt auch für das neue Raster.

### 6.3 Seite „Stadion“

Die Bereiche **Eintritt** und **Stadion** ziehen aus dem Finanzmenü auf diese Seite um:
- Kapazität und Ausbaustufe
- Zuschauer beim letzten Heimspiel und Auslastung, etwa „27.400 von 28.000, 98 %“
- Eintrittspreis setzen, mit dem Hinweis aus 5.2
- Ausbau starten, mit Kosten und Bauzeit, und den Stand eines laufenden Ausbaus

Das Finanzmenü behält Bilanz, Kontostand, Dispo-Limit und Sponsor.

### 6.4 Seite „Vorstand“

- **Saisonziel** mit Klartext und Zielkorridor auf einer Leiter mit 18 Plätzen: Die Zielplätze sind markiert, der aktuelle Platz ist hervorgehoben.
- **Sponsorbonus**, der am Saisonziel hängt, solange ein Sponsor gewählt ist.
- **Vertrauen** als Balken von 0 bis 100 mit markierter Warnschwelle (30) und einem Trend (steigend, gleich, fallend) über die letzten Spieltage. Darunter steht der Hinweis, dass niemand entlassen wird.
- **Ein kurzer Satz vom Vorstand**, der zur Lage passt, zum Beispiel „Drei Plätze fehlen noch. Wir erwarten mehr.“ Die Texte schreibt der Umsetzer, ein Satz je Lage genügt.
- **Bisherige Saisons:** Saison, Liga, Ziel, Endplatz, erreicht oder verfehlt. Die laufende Saison steht als „läuft“ darin.

Für die Tabelle der bisherigen Saisons müssen Ziel und Endplatz des Manager-Vereins pro Saison gespeichert werden. Für den Trend wird ein kurzer Verlauf des Vertrauens gespeichert. Das braucht eine neue Spielstand-Version.

**Alte Spielstände:** Bisher gibt es nur Testspielstände, sie dürfen ignoriert werden (Entscheidung des Nutzers). Die Migration ergänzt nur die neuen Felder mit leeren Werten. Kontostände, Stadien, Preise und Verträge werden nicht umgerechnet. Ein alter Spielstand lädt also mit der alten Geldlage weiter, und das ist in Ordnung.

### 6.5 Vertrauen ausgewogener

Heute verliert ein Verein bis zu 2,5 Punkte pro Spieltag, gewinnt aber höchstens 1,5, und ein paar Plätze unter dem Ziel ziehen ihn in wenigen Spieltagen auf 0. Neu:
- Gewinn und Verlust pro Spieltag sind etwa gleich groß.
- Ein Verein, der knapp neben dem Ziel liegt (1–2 Plätze), verliert nur wenig.
- Ein Verein, der eine halbe Saison deutlich unter dem Ziel liegt, landet unter der Warnschwelle, aber nicht dauerhaft bei 0.

Die genaue Formel entscheidet der Umsetzer. *(Meine Entscheidung.)* Die Folgen des Vertrauens bleiben wie in Haupt-Spec 8.5: nur Nachrichten.

## 7. Tests

- **Langzeittest Wirtschaft** (`tests/longrun/economy.test.ts`): Die Grenzen werden auf die Zielgrößen aus 4.1 umgestellt. Dazu kommen Prüfungen für die Auslastung (große Vereine überwiegend über 90 %, Abstiegskandidaten deutlich darunter) und die Marktwertspitze.
- **Ein Test, der den Königstransfer belegt:** Ein großer Erstligist mit gepflegtem Kader hat nach höchstens 2 Saisons ohne Transfers mindestens etwa 20 Mio zur Verfügung.
- **Stadion:** Bei vollem Stadion bringt ein höherer Preis mehr Erlös, bei leerem ein niedrigerer. Ein Ausbau erhöht bei einem vorher ausverkauften Verein die Zuschauerzahl.
- **Vorstand:** Gewinn und Verlust sind symmetrisch. Ein knapp verfehltes Ziel kostet wenig. Die Saisonhistorie wird gespeichert, und ein v2-Spielstand lädt mit leerer Historie.
- **Oberfläche:** Menü mit 10 Kacheln und neuen Tasten, Stadion- und Vorstandsseite, Ziel in der Kopfzeile, kein Überlauf bei 1280×800.
- **Ergebnisgleichheit:** Die Spielsimulation selbst ändert sich nicht. Weil sich Kader und KI-Transfers durch die neue Wirtschaft ändern, dürfen sich Saisonergebnisse und der Fingerabdruck in `rngFingerprint.test.ts` aber ändern. Dann wird der Fingerabdruck bewusst neu aufgenommen, mit Begründung im Commit.

## 8. Dem Umsetzer überlassen

- Alle Zahlenwerte und genauen Formeln für Tickets, Nachfrage, Gehälter, Marktwerte, Unterhalt, Stadionstufen, KI-Preise, KI-Budget und Vertrauen, solange die Zielgrößen aus 4.1, 5.1 und 6.5 erreicht werden
- Die Texte des Vorstands und die Hinweise zum Eintrittspreis
- Die Symbole der neuen Kacheln und die genaue Anordnung innerhalb der Seiten, im Stil des Spiels und nach Entwurf B
- Ob Sponsor- und Prämienbeträge mit angepasst werden müssen, um die Zielgrößen zu treffen
