# A-Puzzle-A-Day

Digital versjon av A-Puzzle-A-Day (DragonFjord).

Spill live-versjonen her: https://hausnes.github.io/a-puzzle-a-day

A‑Puzzle‑A‑Day Deluxe er et kalenderutfordrings‑puslespill der åtte trebiter skal plasseres i en ramme slik at én måned og én dag vises.

## Slik spiller du

Legg alle de åtte brikkene på brettet slik at bare **dagens måned og dato** er synlige. Når du klarer det, får du en gratulasjon.

| Handling | Mus | Tastatur |
| --- | --- | --- |
| Flytte brikke | Dra og slipp | `Tab` for å velge, `Enter` for å plukke opp, piltaster, `Enter` for å legge ned |
| Rotere | Klikk på brikka, eller `R` / scrollehjul mens du drar | `R` |
| Speilvende | Høyreklikk eller Shift+klikk, eller `F` mens du drar | `F` |
| Avbryte | `Esc` mens du drar | `Esc` |
| Sende brikka tilbake | Slipp den utenfor brettet | `Delete` |

### Hint

Står du fast, kan du trykke **💡 Hint** for å få hjelp til å legge én brikke, maks tre ganger per dag.
Hintet tar utgangspunkt i brikkene du allerede har lagt, og bruker den løsningen som beholder flest av dem.
Ligger noen brikker slik at oppgaven ikke kan løses, flyttes de, og hintet viser hvor en av dem skal ligge.
Brikker lagt med hint får en 💡, og når oppgaven er løst, står det hvor mange hint du brukte.
«Start på nytt» nullstiller ikke hint-telleren.

### Statistikk og deling

**📊 Statistikk** viser rekker (dager på rad, også uten hint), snitt-, median- og beste tid,
antall hint, fordelingen av løsetider og en kalender over de siste 15 ukene.
Alt regnes ut fra det som er lagret i nettleseren, så ingenting sendes noe sted.
Når dagens oppgave er løst, kan du dele resultatet (delemeny på mobil, utklippstavle på PC).

Fremgangen lagres i nettleseren per dag. For å teste en annen dato kan du legge til `?dato=2026-12-24` i adressen.
Dager spilt på denne måten telles ikke med i statistikken.

## Filer

- `index.html` – sideoppsett
- `style.css` – utseende
- `game.js` – brett, brikker, dra-og-slipp, tastaturstyring og sjekk av løsning
