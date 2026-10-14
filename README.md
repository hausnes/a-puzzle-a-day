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

### Milepæler og utseende

**🏅 Milepæler** viser mål du kan jobbe mot. Hver milepæl låser opp en ny bakgrunn for spillet
eller et nytt utseende på brikkene, og du kan bytte fritt mellom det du har låst opp.

| Milepæl | Låser opp |
| --- | --- |
| Løs ditt første puslespill | Brikker: Bjørk |
| Løs 3 puslespill uten hint | Bakgrunn: Skog |
| Løs 5 puslespill (hint er lov) | Brikker: Regnbue |
| Løs 3 dager på rad | Bakgrunn: Hav |
| Løs uten hint på under 5 minutter | Brikker: Skifer |
| Løs 10 puslespill | Bakgrunn: Solnedgang |
| Løs 7 dager på rad | Brikker: Pastell |
| Løs 10 puslespill uten hint | Bakgrunn: Stjernenatt |
| Løs uten hint på under 2 minutter | Brikker: Neon |
| Løs 30 puslespill | Brikker: Gull |

Milepælene regnes ut fra statistikken, så også dager som er spilt tidligere, teller med.
Når du låser opp noe nytt, står det i gratulasjonen, og knappen får en rød prikk til du har sett det.
Gratulasjonen viser også hvilket mål som er nærmest å bli nådd.
Milepælene ligger i `MILESTONES` i `game.js`, og temaene ligger som `[data-theme]` i `style.css`.

### Legg til på hjemskjermen

Spillet kan legges til på hjemskjermen eller installeres som app, og åpnes da i eget vindu uten adresselinje:
på iPhone via Del → «Legg til på Hjem-skjerm», på Android via menyen → «Installer app»,
og i Chrome/Edge på PC via installer-knappen i adresselinjen.
NB: på iPhone har hjemskjerm-appen egen lagring, så statistikk og milepæler fra Safari blir ikke med.

Fremgangen lagres i nettleseren per dag. For å teste en annen dato kan du legge til `?dato=2026-12-24` i adressen.
Dager spilt på denne måten telles ikke med i statistikken.

## Filer

- `index.html` – sideoppsett
- `style.css` – utseende
- `game.js` – brett, brikker, dra-og-slipp, tastaturstyring og sjekk av løsning
- `favicon.svg`, `apple-touch-icon.png` og `icon-*.png` – ikoner for fanen, hjemskjermen og installert app
- `manifest.webmanifest` – navn, ikoner og farger når spillet legges til på hjemskjermen eller installeres
