# Fussballmanager – Design-Spec

Stand: 2026-10-31

## 1. Ziel und Rahmen

Ein Fußballmanager im Retro-Look für den Browser, inspiriert von *Eishockey Manager* (1993).

**Ziele**

- Bis zu 4 menschliche Manager spielen gemeinsam an einem PC.
- Wichtigstes Ziel ist ein einfaches, flüssiges Spiel ohne lange Pausen. Eine Saison soll mit 4 Managern in **1–2 Stunden** spielbar sein.
- Das Spiel ist endlos: Auf eine Saison folgt die nächste.

**Nicht-Ziele (bewusst ausgeklammert)**

- Echte Vereine, Spieler oder Lizenzen. Alles ist fiktiv.
- Online-Multiplayer über das Internet zwischen verschiedenen Orten.
- 2D- oder 3D-Spieldarstellung.

**Ausbaustufen**

| Schritt | Inhalt |
|---|---|
| 1 | Komplettes Spiel im Hot-Seat-Modus am Laptop: 2 Ligen, mehrere Saisons, alle Menüs aus diesem Dokument |
| 2 | Handy-Modus: Handys als Fernbedienung per WebRTC, der Laptop ist der gemeinsame Bildschirm |
| 3 | Nationaler Pokal |
| 4 | Internationaler Pokal |
| später | Mehrere Spielerattribute statt einer Stärke, Transfers zwischen Managern, weitere Feinheiten |

Diese Spec beschreibt Schritt 1 vollständig und legt fest, welche Vorkehrungen Schritt 1 für die späteren Schritte trifft.

## 2. Zeitbudget und Tempo-Regeln

34 Spieltage in 1–2 Stunden ergeben etwa **2–3 Minuten pro Spieltag für alle Manager zusammen**. Daraus folgen feste Regeln:

- Alle Einstellungen bleiben bestehen, bis man sie ändert: Aufstellung, Taktik, Training, Eintrittspreis.
- Ein Spieltag ist im Normalfall mit „Weiter“ durchklickbar. Kein Menü muss zwingend besucht werden.
- Nachrichten, die eine Entscheidung verlangen, erscheinen nur, wenn eine Entscheidung nötig ist, und brauchen dann einen Klick (Annehmen / Ablehnen / Gegenangebot).
- Die Konferenz dauert in normaler Geschwindigkeit etwa 45 Sekunden. Sie lässt sich beschleunigen oder überspringen.
- Eine Verhandlung hat höchstens 3 Runden.
- Jedes Menü ist per Taste erreichbar.

## 3. Spielablauf

### 3.1 Neues Spiel

1. Anzahl der Manager wählen (1–4) und Namen eingeben.
2. Jeder Manager wählt einen beliebigen Verein aus beiden Ligen. Zwei Manager können nicht denselben Verein wählen.
3. Zu jedem Verein werden die Saisonerwartung des Vorstands und das Budget angezeigt. Der Startverein bestimmt damit den Schwierigkeitsgrad.
4. Die Welt wird aus einem Zufalls-Seed erzeugt. Der Seed kann optional eingegeben werden, damit sich eine Welt reproduzieren lässt.

### 3.2 Ein Spieltag

1. **Manager-Runden (Hot-Seat):** Reihum erscheint „Manager X ist dran“, danach das Hauptmenü des eigenen Vereins. „Weiter“ beendet die Runde dieses Managers. Ein entlassener Manager ohne Verein überspringt seine Runde, sieht aber seine Jobangebote.
2. **Vor dem Anpfiff:** Die KI-Vereine stellen auf. Für jeden Manager wird geprüft, ob seine Aufstellung gültig ist (11 einsatzfähige Spieler, kein gesperrter oder verletzter Spieler). Ist sie es nicht, ergänzt das Spiel sie automatisch und zeigt einen Hinweis an.
3. **Konferenz, 1. Halbzeit:** Alle Spiele beider Ligen werden simuliert und als Ticker abgespielt. Angezeigt wird die Liga des ersten Managers, mit TAB wechselt man die Liga.
4. **Halbzeit:** Jeder menschliche Manager, dessen Verein spielt, bekommt nacheinander die Halbzeitansicht mit Auswechseln, Formation und Spielweise. „Weiter“ überspringt sie.
5. **Konferenz, 2. Halbzeit.**
6. **Auswertung:** Ergebnisse, Tabellen, Torschützen, Verletzungen und Sperren.
7. **Verarbeitung im Hintergrund:** Finanzen buchen, Training und Entwicklung anwenden, Kondition und Form aktualisieren, Sperren und Verletzungen herunterzählen, KI-Transfers und -Verträge ausführen, Vorstandsvertrauen aktualisieren, Nachrichten erzeugen.
8. **Autosave.**

### 3.3 Saisonende (nach dem 34. Spieltag)

1. Meister und Absteiger werden ermittelt. Es gibt je 2 direkte Auf- und Absteiger.
2. **Relegation:** Der 16. der 1. Liga spielt gegen den 3. der 2. Liga, in Hin- und Rückspiel als echte Spieltage mit Konferenz. Ist das Gesamtergebnis gleich, folgt direkt ein Elfmeterschießen, das als ein Ereignis simuliert wird. Es gibt weder Auswärtstorregel noch Verlängerung.
3. **Prämien** werden nach Tabellenplatz ausgezahlt.
4. **Vorstandsbilanz** für jeden Manager: Ziel erreicht oder verfehlt, möglicherweise Entlassung, möglicherweise Angebote anderer Vereine (Abschnitt 8.5).
5. **Sommerpause** (Details zu Nachwuchs und Karriereende in Abschnitt 8.4):
   - Die Spieler altern um 1 Jahr.
   - Auslaufende Verträge enden, die betroffenen Spieler werden vereinslos.
   - Spieler ab etwa 33 Jahren können ihre Karriere beenden.
   - Jeder Verein bekommt 2–3 Nachwuchsspieler.
   - Neue Sponsorangebote kommen herein.
   - Das Transferfenster öffnet.
6. Ein neuer Spielplan wird erzeugt und die neue Saison beginnt.

### 3.4 Transferfenster

- **Sommer:** zwischen Saisonende und dem 1. Spieltag. Diese Phase ist als eine Vorbereitungsrunde umgesetzt, in der jeder Manager einmal dran ist.
- **Winter:** vor den Spieltagen 18 und 19.
- Außerhalb der Fenster lassen sich nur vereinslose Spieler verpflichten.

## 4. Optik (Stil „Rasen & Holztafel“)

Die Referenz-Mockups liegen hier: https://claude.ai/artifact/7yPio9FvtHP7uZX4d14hiv (Variante B).

**Logische Fläche:** 640×400 Pixel. Sie wird pixelgenau mit ganzzahligem Faktor skaliert, wenn möglich, sonst mit `image-rendering: pixelated`, und auf dem Bildschirm zentriert. Die Ränder sind dunkel.

**Gestaltungselemente**

- Hintergrund ist gestreifter Rasen in zwei Grüntönen.
- Fenster und Tafeln sind dunkelbraune Holztafeln mit hellem Rahmen.
- Text ist cremefarben, Hervorhebungen sind gelb, Warnungen rotbraun.
- Pixel-Schriften: „Press Start 2P“ für Überschriften, „VT323“ für Fließtext und Tabellen. Beide werden lokal mitgeliefert, nicht über einen CDN geladen.
- Jeder Verein hat zwei Vereinsfarben und ein einfaches, generiertes Wappen: eine Schildform in den Vereinsfarben mit Muster wie Streifen, Schärpe oder geteilt.

**Bildschirme**

- **Hauptmenü:** 8 Kacheln mit Symbol in einem 4×2-Raster: Mannschaft, Training, Verträge, Transfers, Finanzen, Tabelle, Nachrichten, Weiter. Darüber eine Kopfzeile mit Wappen, Vereinsname, Spieltag und Kontostand.
- **Listen-Bildschirme** (Kader, Tabelle, Spielplan, Transfermarkt, Verträge): eine große Holztafel mit einer Tabelle. Ein Klick auf einen Spaltenkopf sortiert, die Liste scrollt innerhalb der Tafel.
- **Konferenz:** eine Anzeigetafel aus Holz mit 9 Zeilen (Heim, Ergebnis, Gast, letztes Ereignis), oben die Spielminute. Bei einem Tor blinkt die Zeile 1 Sekunde lang auf. Die Tasten:
  - **TAB** wechselt die Liga.
  - **+** und **−** ändern das Tempo.
  - **Leertaste** überspringt bis zur Halbzeit bzw. zum Ende.
- **Dialoge** (Verhandlung, Nachrichten, Bestätigungen): kleine Holztafeln, die über dem aktuellen Bildschirm liegen.

**Bedienung**

- Alles ist mit der Maus bedienbar.
- **Tasten:**
  - **1–8** wählt eine Hauptmenü-Kachel.
  - **Esc** führt zurück.
  - **Enter** bestätigt bzw. heißt „Weiter“.
  - **Pfeiltasten** bewegen sich durch Listen.
- **Optionen:** Scanlines (standardmäßig aus), Konferenz-Tempo, Ton an/aus. Ton ist für Schritt 1 optional: kurze Chiptune-Effekte für Tor und Abpfiff.

## 5. Architektur

```
┌──────────────────────── Browser (Laptop / Host) ─────────────────────────┐
│  UI (Svelte)                 Session                Engine (reines TS)    │
│  ─ Bildschirme, Menüs  ──►  ─ nimmt Befehle an ──►  ─ Spielstand          │
│  ─ Konferenz-Ticker    ◄──  ─ prüft Berechtigung    ─ Simulation, Regeln  │
│                              ─ verteilt Updates                           │
│                         Transport (austauschbar)     Speicher (IndexedDB) │
│                         Schritt 1: lokal             Autosave + 3 Slots   │
│                         Schritt 2: WebRTC → Handys   Export/Import        │
└───────────────────────────────────────────────────────────────────────────┘
```

**Technik**

- TypeScript, Vite und Svelte 5, getestet mit Vitest und Playwright.
- Kein Server. Gebaut wird eine statische Seite, z. B. für GitHub Pages.

### 5.1 Schichten

- **Engine** (`src/engine/`): reines TypeScript ohne Abhängigkeiten zu DOM, Svelte oder Browser-APIs.
  - Sie enthält den gesamten Spielstand und alle Regeln.
  - Sie ist deterministisch: Gleicher Spielstand plus gleicher Befehl ergeben immer dasselbe Ergebnis.
  - Der Zufall kommt aus einem seed-basierten Zufallsgenerator, dessen Zustand Teil des Spielstands ist.
- **Session** (`src/session/`): Sie hält den aktuellen Spielstand, nimmt Befehle von Transporten entgegen und prüft die Berechtigung (Manager X darf nur seinen eigenen Verein ändern). Sie gibt Befehle an die Engine weiter, benachrichtigt Abonnenten über Änderungen und stößt den Autosave an. Außerdem steuert sie die Phasen eines Spieltags (Abschnitt 5.4).
- **Transport** (`src/transport/`): eine Schnittstelle mit zwei Funktionen, „Befehl senden“ und „Updates empfangen“. In Schritt 1 gibt es nur `LocalTransport`, der die Session direkt aufruft. In Schritt 2 kommt `WebRtcTransport` dazu.
- **UI** (`src/ui/`): Svelte-Komponenten. Die UI liest den Spielstand nur und ändert ihn ausschließlich über Befehle. Sie enthält keine Spielregeln.
- **Speicher** (`src/storage/`): IndexedDB-Zugriff, Export und Import sowie Migrationen.

### 5.2 Engine-Module

| Modul | Aufgabe |
|---|---|
| `model` | Datentypen (Abschnitt 6), alles als JSON serialisierbar |
| `rng` | seed-basierter Zufallsgenerator (z. B. mulberry32 oder sfc32), Hilfsfunktionen für Bereich, Auswahl und Normalverteilung |
| `generator` | erzeugt die Welt: 36 Vereine, Namen, Kader, Finanzen und Erwartungen |
| `competition` | Spielplan (doppelte Hin- und Rückrunde nach dem Kreisverfahren), Tabelle, Tabellenregeln, Auf- und Abstieg, Relegation. Allgemein gebaut für die Formate `league` und `knockout` |
| `match` | Spielsimulation Minute für Minute, gibt eine Ereignisliste zurück. Halbzeit als Haltepunkt |
| `lineup` | prüft Aufstellungen und erzeugt die automatische Aufstellung |
| `training` | Trainingseffekte, Entwicklung und Alterung |
| `finance` | Einnahmen, Ausgaben, Stadion, Dispo und Zinsen |
| `contracts` | Vertragsforderungen, Verhandlung, Verlängerung, Entlassung |
| `transfers` | Marktwert, Transferliste, Ablöse-Verhandlung, KI-Angebote |
| `board` | Erwartungen, Vertrauen, Entlassung, Jobangebote |
| `ai` | Entscheidungen der KI-Vereine: Aufstellung, Transfers, Verträge, Training |
| `season` | Ablauf von Spieltag und Saisonende, verbindet die Module |
| `commands` | Definition aller Befehle, ihre Prüfung und Anwendung |

### 5.3 Befehle

Jede Änderung durch einen Menschen ist ein Befehl:

```ts
type Command =
  | { type: "setLineup"; managerId; formation; starters: PlayerId[]; bench: PlayerId[] }
  | { type: "setTactics"; managerId; style: "defensive" | "normal" | "offensive"; hardness: "fair" | "normal" | "hard" }
  | { type: "setTraining"; managerId; intensity; focus; individual: PlayerId[] }
  | { type: "setTicketPrice"; managerId; price }
  | { type: "buildStadium"; managerId; stage }
  | { type: "chooseSponsor"; managerId; offerId }
  | { type: "startContractTalk"; managerId; playerId; offer: { salary; years } }
  | { type: "startTransferTalk"; managerId; playerId; fee }
  | { type: "respondNegotiation"; managerId; negotiationId; offer | "accept" | "abort" }
  | { type: "listForTransfer"; managerId; playerId; askingPrice | null }
  | { type: "respondTransferOffer"; managerId; offerId; "accept" | "reject" | { counter: fee } }
  | { type: "releasePlayer"; managerId; playerId }
  | { type: "acceptJobOffer"; managerId; offerId }
  | { type: "halftimeChanges"; managerId; matchId; substitutions; formation?; style? }
  | { type: "endTurn"; managerId };
```

- `applyCommand(state, command)` gibt entweder `{ ok: true, state }` oder `{ ok: false, error }` zurück. Die Fehlermeldung ist ein deutscher Text, den der Mensch lesen kann.
- Ein abgelehnter Befehl lässt den Spielstand unverändert.
- In Schritt 2 schicken die Handys genau diese Befehle.

### 5.4 Phasen eines Spieltags (Zustandsmaschine in der Session)

```
preseason ─► managerTurns ─► firstHalf ─► halftime ─► secondHalf ─► results ─► processing ─┐
   ▲                                                                                       │
   └──────────────── seasonEnd (nach dem letzten Spieltag oder der Relegation) ◄───────────┘
                     sonst zurück zu managerTurns
```

- Eine Phase wartet auf alle Manager, die in ihr dran sind:
  - In Schritt 1 geht das reihum (Hot-Seat).
  - In Schritt 2 geht das parallel: Jeder tippt auf „Bereit“, und sobald alle bereit sind, wechselt die Session die Phase. Die Engine muss dafür nicht geändert werden.
- Die Simulation einer Halbzeit läuft vollständig in der Engine. Die Konferenz spielt danach nur die fertige Ereignisliste mit Zeitstempeln ab.

## 6. Datenmodell (Kern)

```ts
interface GameState {
  version: number;            // Version des Spielstand-Schemas, für Migrationen
  rngState: RngState;
  season: number;             // 1, 2, 3, …
  matchday: number;           // aktueller Spieltag im Kalender
  phase: Phase;
  managers: Manager[];        // 1–4 Menschen
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  competitions: Competition[];// 1. Liga, 2. Liga, Relegation (später: Pokale)
  calendar: CalendarEntry[];  // pro Spieltag: welche Wettbewerbe und Partien
  negotiations: Negotiation[];
  transferOffers: TransferOffer[];
  messages: Message[];
  history: SeasonRecord[];    // Meister, Auf- und Absteiger, Torschützenkönig pro Saison
}

interface Manager { id; name; clubId: ClubId | null; jobOffers: JobOffer[]; career: CareerEntry[] }

interface Club {
  id; name; shortName; colors: [string, string]; crest: CrestSpec;
  reputation: number;         // 1–100, bestimmt Erwartungen, Zuschauer und Anziehungskraft für Spieler
  managerId: ManagerId | null;// null = KI
  squad: PlayerId[];
  lineup: Lineup; tactics: Tactics; training: TrainingPlan;
  finance: { balance; overdraftLimit; ticketPrice; stadium: { capacity; stage; building?: { stage; readyAtMatchday } }; sponsor?: Sponsor; ledger: LedgerEntry[] };
  board: { expectation: Expectation; confidence: number };
}

interface Player {
  id; firstName; lastName; age; position: "GK" | "DF" | "MF" | "FW";
  strength: number;           // 1–99
  potential: number;          // 1–99, verdeckt; angezeigt als Tendenz (★ bis ★★★★★)
  form: number;               // −3 … +3
  fitness: number;            // 0–100
  injury?: { matchesLeft };
  suspension?: { matchesLeft };
  yellowCards: number;        // bei 5 gelben Karten folgt 1 Spiel Sperre
  morale: number;             // 0–100, beeinflusst die Vertragsverhandlung
  contract: { clubId | null; salary; endsSeason; releaseClause? };
  stats: { season: { apps; goals }; career: { apps; goals } };
  transferListed?: { askingPrice | null };
}
```

**Erweiterbarkeit:** `strength` bleibt in Schritt 1 der einzige Leistungswert. Wenn später Attribute dazukommen, wird `strength` aus ihnen berechnet, und eine Migration erzeugt die Attribute aus der bisherigen Stärke.

**Wettbewerbe:** `Competition` hat `format: "league" | "knockout"`, die Teilnehmer, die Partien und die Regeln (Punkte, Tiebreaker, Auf- und Abstiegsplätze). Die Relegation ist ein Wettbewerb im Format `knockout` mit einer Runde aus Hin- und Rückspiel. Pokale werden später als weitere `knockout`-Wettbewerbe in den Kalender eingetragen.

## 7. Mannschaft, Taktik, Spiel, Training

### 7.1 Kader

- 22–28 Spieler pro Verein, davon mindestens 2 Torhüter.
- Ein Verein mit weniger als 16 Spielern bekommt eine Warnung. Fällt er unter 14 Spieler, ergänzt das Spiel den Kader automatisch mit vereinslosen Spielern zum Mindestgehalt.

### 7.2 Mannschaft-Menü

- **Formationen:** 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 4-2-4. Jede Formation legt die Anzahl der Spieler pro Mannschaftsteil fest.
- **Aufstellung:** Die Startelf hat Plätze nach Mannschaftsteil, dazu bis zu 9 Ersatzspieler, von denen 5 eingewechselt werden dürfen. Spieler werden per Klick oder Ziehen gesetzt.
- **„Automatisch“** stellt die beste Elf für die gewählte Formation auf, nach Stärke, Form und Kondition.
- **Spielweise:** defensiv, normal oder offensiv. **Härte:** fair, normal oder hart.
- **Spieler auf fremder Position:** Es gilt der folgende Stärke-Faktor.

  | Spieler ist … | spielt als … | Faktor |
  |---|---|---|
  | Feldspieler | Nachbarposition (ABW↔MF, MF↔ST) | 0,85 |
  | Feldspieler | weiter entfernte Position (ABW↔ST) | 0,65 |
  | Torwart | Feldspieler | 0,3 |
  | Feldspieler | Torwart | 0,3 |

### 7.3 Spielsimulation

Für jedes Team und jeden Mannschaftsteil wird eine **effektive Teamstärke** berechnet: für Abwehr (inklusive Torwart-Anteil), Mittelfeld und Angriff.

```
effektiveStärke(Spieler) = strength × Positionsfaktor × (1 + 0,03 × form) × Konditionsfaktor
Konditionsfaktor = 0,7 + 0,3 × fitness/100
Mannschaftsteil = Mittelwert der Spieler, gewichtet mit der Anzahl laut Formation
```

**Spielweise**

| Spielweise | Angriff | Abwehr |
|---|---|---|
| offensiv | +10 % | −10 % |
| defensiv | −10 % | +10 % |

**Härte:** Die Stufe „hart“ bringt +5 % Zweikampfanteil im Mittelfeld, erhöht aber die Wahrscheinlichkeit für Karten und Verletzungen.

**Heimvorteil:** +5 % auf alle Mannschaftsteile.

**Ablauf je Minute (90 Minuten, Nachspielzeit vereinfacht weggelassen)**

1. Der Ballbesitz wird nach dem Verhältnis der Mittelfeldstärken gewürfelt.
2. Das Team mit Ballbesitz erzeugt mit der Wahrscheinlichkeit `p_chance` eine Torchance. Diese hängt vom Verhältnis Angriff zu gegnerischer Abwehr ab.
3. Aus einer Chance wird ein Tor mit der Wahrscheinlichkeit `p_tor`. Diese hängt von der Stärke des Schützen und der Stärke des Torwarts ab.
4. Als Torschütze wird bevorzugt ein Stürmer gewählt, dann Mittelfeldspieler, selten Abwehrspieler, jeweils gewichtet nach Stärke.
5. Daneben werden seltenere Ereignisse gewürfelt: gelbe Karte, gelb-rote Karte, rote Karte, Verletzung. Eine rote Karte reduziert die Mannschaft. Ein verletzter Spieler wird von der KI ausgewechselt; bei einem menschlichen Manager wird automatisch der beste passende Ersatzspieler eingewechselt, solange noch Wechsel übrig sind.
6. Über die 90 Minuten sinkt die Kondition, bei harter Spielweise stärker.

**Kalibrierung:** Die Konstanten werden so abgestimmt, dass die folgenden Ziele erreicht werden. Ein Test prüft das über 5000 simulierte Spiele.

- Im Schnitt fallen **2,6–3,0 Tore** pro Spiel.
- Etwa **45 % Heimsiege, 27 % Unentschieden und 28 % Auswärtssiege** bei gleich starken Teams, jeweils mit einer Toleranz von ±5 Prozentpunkten.
- Ein Team, das 10 Stärkepunkte schwächer ist, gewinnt trotzdem noch in etwa 15–25 % der Spiele.

**Halbzeit:** `simulateHalf(state, match, 1)` liefert die Ereignisse der Minuten 1–45 und einen Zwischenstand. Danach werden die Halbzeitbefehle angewendet, dann `simulateHalf(…, 2)`. KI-Vereine treffen ihre Halbzeit-Entscheidungen nach einfachen Regeln: Wer zurückliegt, spielt offensiver; müde Spieler werden ausgewechselt.

**Erholung zwischen den Spieltagen:** Spieler, die nicht gespielt haben, erholen sich vollständig auf 100. Spieler, die gespielt haben, regenerieren teilweise, je nach Trainingsplan.

**Form:** Sie ändert sich nach jedem Spiel abhängig vom eigenen Spiel und vom Ergebnis, mit einer Tendenz zurück zu 0.

### 7.4 Training-Menü

- **Intensität:** locker, normal oder hart.

  | Intensität | Stärke-Entwicklung | Konditionsabzug | Verletzungsrisiko |
  |---|---|---|---|
  | locker | ×0,6 | gering | kein |
  | normal | ×1,0 | mittel | gering |
  | hart | ×1,4 | hoch | erhöht |

- **Schwerpunkt:** Kondition, Taktik oder Technik.
  - Kondition bringt +50 % Regeneration.
  - Taktik bringt im nächsten Spiel +3 % auf alle Mannschaftsteile.
  - Technik bringt den vollen Entwicklungseffekt. Bei Kondition und Taktik ist der Entwicklungseffekt halbiert.
- **Förderung:** Bis zu 3 Spieler bekommen den doppelten Entwicklungseffekt.
- **Entwicklung pro Spieltag:**
  - Der Basiswert hängt vom Alter und vom Abstand zum Potenzial ab:
    - **Bis 24 Jahre:** Wachstum Richtung Potenzial, umso schneller, je größer der Abstand ist.
    - **25–30 Jahre:** stabil, es gibt nur noch kleine Gewinne bis zum Potenzial.
    - **Ab 31 Jahren:** langsamer Abbau, ab 33 schneller.
  - Der Basiswert wird mit den Faktoren aus Intensität, Schwerpunkt und Förderung multipliziert.
  - Bei Werten unter 1 wird mit Nachkommastellen gerechnet. Der Spieler hat intern eine Bruchteil-Stärke, angezeigt wird die gerundete Stärke.
  - Die Entwicklung wird bei jedem Spieltag angewendet, Spielpraxis bringt einen kleinen Bonus.

## 8. Wirtschaft

Alle Beträge sind in Euro. Die Größenordnungen sind Startwerte für das Balancing.

### 8.1 Einnahmen und Ausgaben

**Zuschauer pro Heimspiel**

```
Zuschauer = min(Kapazität, Nachfrage)
Nachfrage = Basis(reputation, Liga) × Erfolgsfaktor(Tabellenplatz, Form der letzten 5 Spiele) × Gegnerfaktor × Preisfaktor(ticketPrice)
```

Ein höherer Eintrittspreis senkt die Nachfrage. Der optimale Preis liegt je nach Liga und Erfolg zwischen etwa 15 und 40 €.

**Weitere Einnahmen**

- **TV-Geld:** pro Spieltag ein fester Betrag, abhängig von der Liga.
- **Sponsor:** Zu Saisonbeginn kommen 2–3 Angebote mit einem festen Betrag pro Spieltag und einem Bonus, falls das Saisonziel erreicht wird. Wählt der Manager nicht aus, wird das erste Angebot genommen.
- **Prämien** am Saisonende nach Tabellenplatz.

**Ausgaben**

- Gehälter, pro Spieltag gebucht. Das Wochengehalt gilt als Gehalt pro Spieltag.
- Stadionunterhalt, abhängig von der Ausbaustufe.
- Dispo-Zinsen.

**Stadion:** 5 Ausbaustufen mit steigender Kapazität. Jede Stufe hat Baukosten, die beim Start fällig werden, und eine Bauzeit von 6–12 Spieltagen. Die neue Kapazität gilt nach Fertigstellung.

**Dispo**

- Das Limit hängt von der Reputation ab.
- Wer das Limit überzieht, bekommt eine Vorstandswarnung.
- Wer 3 Spieltage in Folge über dem Limit liegt, verliert stark an Vertrauen.
- Wer über dem Limit ist, kann keine Transfers mehr tätigen.

**Finanzen-Menü:** Kontostand, Bilanz des letzten Spieltags und der laufenden Saison nach Kategorien, Eintrittspreis, Stadionausbau und Sponsor.

### 8.2 Verträge

- Ein Vertrag besteht aus dem Gehalt pro Spieltag, dem Saisonende, an dem er ausläuft (1–5 Saisons Laufzeit), und optional einer Ausstiegsklausel.
- **Forderung eines Spielers:**
  - Sie hängt von Stärke, Alter, Reputation des Vereins, Liga und Stimmung ab.
  - Ein Spieler mit kaum Einsätzen fordert weniger, will aber eher wechseln.
  - Junge Spieler wünschen lange Laufzeiten, alte Spieler kurze.
- **Verhandlung** (höchstens 3 Runden):
  1. Der Manager bietet Gehalt und Laufzeit.
  2. Der Spieler reagiert:
     - Er nimmt an, wenn das Angebot bei mindestens 100 % seiner Forderung liegt.
     - Er macht eine Gegenforderung, wenn das Angebot zwischen 70 und 100 % liegt.
     - Er bricht ab, wenn das Angebot unter 70 % liegt. Dabei verliert er Stimmung.
  3. Die Gegenforderung kommt dem Manager mit jeder Runde etwas entgegen. In Runde 3 ist das letzte Wort des Spielers endgültig.
  4. Nach einem Abbruch kann erst nach 3 Spieltagen neu verhandelt werden.
- **Verträge-Menü:** eine Liste aller Spieler mit Gehalt und Laufzeit. Verträge, die zum Saisonende auslaufen, sind markiert. Ab 10 Spieltagen vor Saisonende erscheint dazu eine Nachricht.
- **Entlassen:** Die Abfindung beträgt 50 % des restlichen Gehalts und wird sofort gezahlt. Der Spieler wird vereinslos.

### 8.3 Transfermarkt

- **Suche:** Filter nach Position, Stärke (von–bis), Alter, Marktwert, Liga und „nur Transferliste“ sowie eine Liste der Vereinslosen.
- **Marktwert:** Er hängt von Stärke, Alter, Potenzial, Vertragslaufzeit und Liga ab.
- **Kauf** in zwei Stufen, beide mit höchstens 3 Runden:
  1. **Ablöse mit dem Verein verhandeln.** Ein KI-Verein verkauft eher, wenn der Spieler auf der Transferliste steht, wenn er auf seiner Position überzählig ist oder wenn das Angebot deutlich über dem Marktwert liegt. Leistungsträger gibt er nur gegen viel Geld ab. Eine Ausstiegsklausel erzwingt den Verkauf.
  2. **Gehalt mit dem Spieler verhandeln**, wie in Abschnitt 8.2. Ein Spieler wechselt ungern zu einem Verein mit deutlich geringerer Reputation oder in eine niedrigere Liga.
  3. Scheitert die zweite Stufe, ist der Transfer geplatzt, und es wird keine Ablöse fällig.
- **Verkauf:**
  - Der Manager setzt einen Spieler auf die Transferliste, optional mit Wunschpreis.
  - KI-Vereine schicken Angebote als Nachricht. Mögliche Antworten: Annehmen, Ablehnen oder Gegenangebot. Das Hin und Her dauert höchstens 3 Runden.
  - Auch für Spieler, die nicht auf der Transferliste stehen, kommen gelegentlich Angebote.
- **Vereinslose Spieler** sind jederzeit verpflichtbar. Es entfällt nur die Verhandlung über die Ablöse.
- **Transfers zwischen menschlichen Managern** sind in Schritt 1 nicht vorgesehen. Ihre Spieler erscheinen für den jeweils anderen Manager als nicht verfügbar.

### 8.4 KI-Vereine

- **Aufstellung:** Jeder KI-Verein wählt eine Formation passend zum Kader und stellt automatisch die beste Elf auf.
- **Spielweise** nach Stärkeverhältnis: gegen einen klar stärkeren Gegner defensiv, gegen einen klar schwächeren offensiv.
- **Verträge:** Leistungsträger verlängern sie 5–10 Spieltage vor dem Vertragsende. Schwache und alte Spieler lassen sie auslaufen.
- **Transfers:**
  - Nur in den Transferfenstern.
  - Ein KI-Verein kauft für die schwächste Position, wenn das Budget es erlaubt. Dabei achtet er auf ein Gehaltsbudget von höchstens 60–70 % der erwarteten Einnahmen.
  - Er verkauft Überzählige.
  - Pro Fenster tätigt er höchstens 2–3 Transfers, damit der Markt ruhig bleibt.
- **Stabilität:**
  - **Nachwuchs:** Jeder Verein erhält pro Saison 2–3 Nachwuchsspieler im Alter von 16–18 Jahren. Ihre Stärke liegt deutlich unter dem Kaderschnitt, ihr Potenzial streut.
  - **Karriereende:** Ab etwa 33 Jahren beenden Spieler mit steigender Wahrscheinlichkeit ihre Karriere.
  - **Neue Vereinslose:** Jede Saison kommen 20–30 neue vereinslose Spieler auf den Markt, damit es immer verfügbare Spieler gibt.
  - Ein Langzeittest prüft, dass Durchschnittsstärke und Kadergrößen über 10 Saisons stabil bleiben.

### 8.5 Vorstand

**Erwartung pro Saison**

Sie richtet sich nach der Reputation im Vergleich zu den anderen Vereinen der Liga.

- **1. Liga:** „Meisterschaft“, „oberes Drittel“, „gesichertes Mittelfeld“ oder „Klassenerhalt“.
- **2. Liga:** „Aufstieg“, „oberes Drittel“, „gesichertes Mittelfeld“ oder „Klassenerhalt“.

**Vertrauen (0–100)**

- Start bei 60.
- Nach jedem Spieltag wird der Tabellenplatz mit dem Zielkorridor verglichen. Dabei werden die letzten Ergebnisse stärker gewichtet.
- Die Finanzlage beeinflusst das Vertrauen: Ein überzogenes Limit wirkt negativ.

**Folgen von niedrigem Vertrauen**

| Vertrauen | Folge |
|---|---|
| unter 30 | Warnung per Nachricht |
| unter 15 | Entlassung, auch mitten in der Saison (frühestens ab dem 8. Spieltag) |

**Saisonende**

- **Ziel erreicht:** Das Vertrauen steigt, und es kommen mit gewisser Wahrscheinlichkeit Angebote größerer Vereine. Der Manager kann wechseln oder bleiben.
- **Ziel deutlich verfehlt:** Die Entlassung ist wahrscheinlich.

**Nach der Entlassung**

- Der Manager bekommt 1–3 Angebote von Vereinen, die ihren Trainer entlassen haben. Das sind meist Vereine mit geringerer Reputation. Die KI-Vereine entlassen ihre Trainer ebenfalls nach diesen Regeln, damit es freie Stellen gibt.
- Nimmt der Manager kein Angebot an, setzt er bis zum nächsten Spieltag aus und bekommt dann neue Angebote.
- Spätestens nach 3 Spieltagen ohne Verein bekommt er garantiert ein Angebot eines Zweitligisten.

## 9. Nachrichten

Nachrichten werden pro Manager angelegt. Es gibt zwei Arten:

- **Info:** Verletzung, Vertrag läuft aus, Stadion fertig, Vorstandswarnung, Saisonbilanz.
- **Entscheidung:** Transferangebot, Gegenangebot, Jobangebot, Sponsorwahl. Jede Entscheidungsnachricht hat eine Standard-Reaktion, die gilt, wenn der Manager nicht reagiert: Transferangebote verfallen nach 2 Spieltagen als abgelehnt, die Sponsorwahl fällt auf das erste Angebot.

Beim Start seiner Runde sieht jeder Manager einen Hinweis auf neue Nachrichten. Dieser Hinweis erscheint nur, wenn eine Entscheidung offen ist.

## 10. Speichern

- **IndexedDB:**
  - Ein Autosave-Slot, der nach jedem Spieltag und nach dem Saisonende überschrieben wird, sowie 3 manuelle Slots.
  - Pro Slot werden Metadaten gespeichert: Manager, Saison, Spieltag und Datum.
- **Export und Import:** Der Spielstand wird als JSON-Datei heruntergeladen bzw. hochgeladen.
- **Versionen und Migration:**
  - Jeder Spielstand hat `version`.
  - Beim Laden laufen die Migrationen nacheinander, also v1 → v2 → … bis zur aktuellen Version.
  - Spielstände aus einer neueren Version werden mit einer Meldung abgelehnt.
- **Prüfung beim Laden:**
  - Grundlegende Konsistenz: Alle IDs sind auflösbar, und jeder Verein hat einen Kader.
  - Ist ein Spielstand beschädigt, wird das gemeldet und der Autosave angeboten.

## 11. Fehlerbehandlung

- Befehle werden in der Engine geprüft. Fehler gehen als lesbare Meldung zurück, und die UI zeigt sie als kleine Tafel an.
- Die UI verhindert offensichtlich ungültige Aktionen schon vorher, z. B. durch einen ausgegrauten Knopf. Die Engine prüft trotzdem immer selbst, denn das ist in Schritt 2 wichtig, wenn Befehle von Handys kommen.
- Unerwartete Fehler in der Engine während eines Spieltags:
  - Die Verarbeitung bricht ab, und der Zustand vor dem Spieltag bleibt erhalten, weil Updates unveränderlich angewendet werden.
  - Eine Fehlermeldung bietet „Spieltag erneut versuchen“ an.

## 12. Tests

**Unit-Tests (Vitest) pro Engine-Modul, insbesondere:**

- `rng`: Derselbe Seed ergibt dieselbe Folge.
- `competition`:
  - Der Spielplan ist korrekt: Jeder spielt gegen jeden, je einmal zu Hause und einmal auswärts, und niemand spielt zweimal am selben Spieltag.
  - Die Tabellenregeln stimmen: Punkte, dann Tordifferenz, dann erzielte Tore, dann direkter Vergleich.
  - Auf- und Abstieg sowie die Relegation werden richtig ausgewertet.
- `match`: Das Spiel ist deterministisch bei gleichem Seed, und die Kalibrierungsziele aus Abschnitt 7.3 werden über 5000 Spiele erreicht.
- `lineup`: Ungültige Aufstellungen werden erkannt, und die automatische Aufstellung ist immer gültig.
- `contracts` und `transfers`: Die Verhandlungslogik stimmt für jede Runde und Grenze.
- `finance`: Buchungen sind korrekt, und Kapazität und Preis wirken richtig.
- `board`: Die Schwellen für Entlassung und Angebote greifen.

**Langzeittest:** 10 Saisons mit nur KI-Vereinen. Geprüft werden:

- Jeder Verein hat jederzeit mindestens 11 einsatzfähige Spieler oder eine automatische Ergänzung.
- Die Spielerzahl, die Durchschnittsstärke und das Gesamtgeld liegen in stabilen Bereichen.
- Es gibt keine Exceptions.
- Pro Saison wechseln je nach Ausgang der Relegation 2 oder 3 Vereine in jede Richtung, und beide Ligen haben danach wieder genau 18 Vereine.

**Befehlstests:** Für jeden Befehl gibt es einen gültigen und einen ungültigen Fall.

**Speichertests:** Speichern, Laden und Migration einer v1-Testdatei.

**Playwright (Oberfläche):**

- Neues Spiel mit 2 Managern, ein Spieltag inklusive Halbzeit, Saisonende im Schnellvorlauf. Dafür gibt es einen Debug-Schalter, der nur in Testbuilds verfügbar ist.
- Ein Transfer- und ein Vertragsdialog.

## 13. Vorbereitung auf Schritt 2 (Handy-Modus)

Schritt 1 setzt das bereits um:

- Die Engine ist frei von UI- und Browser-Abhängigkeiten.
- Alle Änderungen laufen über Befehle mit `managerId`.
- Die Session prüft die Berechtigung und steuert die Phasen. Das Warten auf Manager ist als Menge von Managern gebaut, die noch nicht bereit sind. Hot-Seat behandelt diese Menge der Reihe nach, der Handy-Modus parallel.
- `Transport` ist eine Schnittstelle.
- Die Oberfläche ist in Ansichten für den großen Bildschirm (Konferenz, Tabelle, Auswertung) und Vereinsansichten getrennt. Die Vereinsansichten ziehen später auf das Handy um.

In Schritt 2 kommt Folgendes dazu (eigene Spec):

- `WebRtcTransport` mit PeerJS-Vermittlung, Raumcode und QR-Code.
- Eine Handy-Ansicht im Hochformat.
- Wiederverbinden nach einem Verbindungsabbruch.
- Ein gemischter Betrieb, bei dem einige Manager am Laptop und andere am Handy spielen.

## 14. Projektstruktur

```
fussballmanager/
├─ docs/superpowers/specs/
├─ public/fonts/            # VT323, Press Start 2P (OFL-Lizenz)
├─ src/
│  ├─ engine/               # model, rng, generator, competition, match, lineup, training,
│  │                        # finance, contracts, transfers, board, ai, season, commands
│  ├─ session/
│  ├─ transport/
│  ├─ storage/
│  ├─ ui/
│  │  ├─ theme/             # Farben, Holztafel-, Kachel- und Tabellen-Komponenten
│  │  ├─ screens/           # NewGame, TurnStart, MainMenu, Squad, Training, Contracts,
│  │  │                     # Transfers, Finance, Tables, Messages, Conference, Halftime,
│  │  │                     # Results, SeasonEnd, Options, SaveLoad
│  │  └─ dialogs/           # Negotiation, Confirm, Error
│  └─ main.ts
├─ tests/
│  ├─ engine/
│  ├─ longrun/
│  └─ e2e/
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 15. Offene Punkte für das Balancing (keine Design-Entscheidungen)

Die genauen Zahlenwerte werden während der Umsetzung festgelegt und über die Tests abgesichert. Dazu gehören Startkapital, Gehaltsniveaus, TV-Gelder, Prämien, Stadionstufen und -kosten, Konstanten der Simulation und Entwicklungsraten. Vorgegeben sind nur die Zielgrößen aus den Abschnitten 7.3, 8 und 12.
