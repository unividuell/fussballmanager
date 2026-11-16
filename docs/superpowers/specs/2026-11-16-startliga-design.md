# Startliga wählen – Design

Stand: 2026-11-16. Ergänzt `2026-11-13-drei-ligen-echte-vereine-design.md` (Abschnitte 3 und 6).

## 1. Warum

Der Nutzer will mit jedem Verein in jeder Liga beginnen können, etwa mit dem FC Bayern in der 3. Liga. Das soll sich dann vollständig nach 3. Liga anfühlen. Vom Verein bleiben nur Name und Vereinsfarben *(Entscheidung des Nutzers)*.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
1. Beim neuen Spiel wählt jeder Manager zusätzlich zum Verein eine Startliga (1., 2. oder 3. Liga). Vorausgewählt ist die echte Liga des Vereins.
2. Ein Verein in einer anderen als seiner echten Liga wird vollständig an die Startliga angepasst: Kader, Geld, Stadion, Eintrittspreis, Fans und Erwartung des Vorstands. Name, Kurzname, Farben und Wappenmuster bleiben.
3. Alle Ligen haben danach wieder genau 18 Vereine. Die Lücke wird aufgefüllt, indem Vereine nachrücken. Auch diese werden an ihre neue Liga angepasst *(Entscheidung des Nutzers)*.

**Nicht-Ziele**
- Freie Wahl der Werte (Ruf, Kaderstärke) durch den Manager.
- Ligawahl während eines laufenden Spiels.
- Änderungen an Saisonablauf, Wirtschaft oder Simulation.

**Anti-Ziele**
- **Wer nichts ändert, merkt etwas.** Wählt kein Manager eine andere Liga, entsteht genau dieselbe Welt wie bisher, bei gleichem Seed mit denselben Spielern.
- **Ein Manager-Verein rückt nach.** Vereine von Managern bleiben immer in der Liga, die ihr Manager gewählt hat.
- **Ein angepasster Verein ist sportlich oder wirtschaftlich ein Ausreißer seiner neuen Liga.** Bayern in der 3. Liga darf weder den Kader noch das Geld noch das Stadion eines Erstligisten haben.

## 3. Nachrücken

Für jeden Manager, dessen Startliga von der echten Liga seines Vereins abweicht, in der Reihenfolge der Manager:

- **Verein nach unten** (z. B. Bayern von der 1. in die 3. Liga): Der Verein wechselt in die Startliga. Die Liga, die er verlässt, wird von unten aufgefüllt. Aus jeder Liga zwischen Start- und echter Liga rückt der stärkste Verein eine Liga hoch. Bei Bayern in die 3. Liga rückt also der stärkste Zweitligist in die 1. Liga und der stärkste Drittligist in die 2. Liga.
- **Verein nach oben** (z. B. Havelse von der 3. in die 1. Liga): Spiegelbildlich steigt aus jeder Liga zwischen echter Liga und Startliga der schwächste Verein eine Liga ab.
- **„Stärkster“ und „schwächster“** richten sich nach der Kaderstärke aus dem Datensatz (`ClubSeed.strength`), bei Gleichstand nach dem Ruf. Gesucht wird unter den Vereinen, die in diesem Moment in der Liga stehen, also nach den Wechseln früherer Manager.
- **Gesperrte Vereine:** Vereine von Managern und Vereine, die beim Spielstart schon einmal gewechselt sind, werden übersprungen. „Beim Spielstart“ meint den ganzen Aufbau mit allen Managern. Jeder Verein wechselt also höchstens einmal. *(Meine Entscheidung.)*
- **Gegenläufige Wahlen** (ein Manager setzt einen Erstligisten in die 2. Liga, ein anderer einen Zweitligisten in die 1. Liga) werden ebenfalls der Reihe nach abgearbeitet. Es wird nicht vorher verrechnet. Das ist einfach und vorhersehbar, auch wenn dabei mehr Vereine wechseln als nötig. *(Meine Entscheidung.)*

## 4. Anpassen an eine Liga

Grundlage sind die Datensatzwerte der echten Vereine der Zielliga (`CLUBS` mit `league` gleich Zielliga).

| Wer | Ruf | Kaderstärke |
|---|---|---|
| Vom Manager in eine andere Liga gesetzter Verein | Median der Zielliga | Median der Zielliga |
| Nachrücker nach oben | niedrigster Wert der Zielliga | niedrigster Wert der Zielliga |
| Nachrücker nach unten | höchster Wert der Zielliga | höchster Wert der Zielliga |

*(Meine Entscheidung: Ein Nachrücker nach oben fühlt sich wie ein Aufsteiger an, ein Nachrücker nach unten wie ein Absteiger. Ruf und Kaderstärke werden getrennt bestimmt.)*

Aus den neuen Werten folgt alles wie beim Spielstart:
- Der Kader wird neu erzeugt, mit `baseStrengthFor(Kaderstärke)` und dem Gehaltsfaktor der Zielliga. Die bisherigen Spieler des Vereins werden entfernt.
- Startkapital, Stadionstufe, Startpreis und Dispo-Limit folgen dem neuen Ruf und der Zielliga.
- Die Erwartung des Vorstands folgt wie immer aus dem Ruf innerhalb der Liga.

## 5. Oberfläche

- Jede Manager-Zeile in „Neues Spiel“ bekommt neben der Vereinsauswahl eine Auswahl „Startliga“ mit 1., 2. und 3. Liga.
- Wählt der Manager einen Verein, springt die Startliga auf dessen echte Liga. Danach kann er sie ändern.
- Die Zeile muss bei 1280×800 ohne Überlauf passen.

## 6. Tests

- **Ohne Ligawahl unverändert:** Ein Spiel mit Startliga gleich echter Liga ergibt dieselbe Welt wie ohne Angabe (gleicher Seed).
- **Bayern in die 3. Liga:**
  - Danach haben alle Ligen 18 Vereine, Bayern steht in L3.
  - Der stärkste Zweitligist steht in L1, der stärkste Drittligist in L2.
  - Bayerns Ruf und Stammelf liegen beim Median der 3. Liga, Startkapital und Stadion passen zum neuen Ruf.
  - Der Nachrücker in L1 hat Ruf und Kaderstärke des schwächsten Erstligisten.
- **Havelse in die 1. Liga:** spiegelbildlich.
- **Zwei Manager:** Der eine setzt Bayern in die 3. Liga, der andere wählt den stärksten Zweitligisten in seiner echten Liga. Dann rückt dieser nicht nach, sondern der nächststärkere.
- **Oberfläche:** Startliga-Auswahl springt beim Vereinswechsel auf die echte Liga. Ein Spiel mit Bayern in der 3. Liga startet dort.

## 7. Dem Umsetzer überlassen

- Wo die Logik liegt (z. B. eine Funktion in `src/engine/season.ts` oder ein eigenes Modul), solange `startNewGame` die Wahl entgegennimmt
- Genaue Gestaltung der Auswahl in der Manager-Zeile
- Ob Spieler aus dem alten Kader vereinslos werden oder ganz entfallen (sie dürfen nicht doppelt existieren)
