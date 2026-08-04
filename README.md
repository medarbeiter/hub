# MedArbeiter Zeiterfassung

Interne Arbeitszeiterfassung für MedArbeiter: Mitarbeiter stempeln sich auf
einer lebendigen Tages-Zeitleiste ein und aus, die Verwaltung prüft, korrigiert
und schließt Monate für die Lohnabrechnung ab.

## Setup

```bash
bun install
bun scripts/seed.ts          # legt das Verwaltungskonto an (Zugangsdaten werden ausgegeben)
bun scripts/seed.ts --demo   # optional: synthetische Demo-Mitarbeiter und -Zeiten
bun run dev                  # http://localhost:3000
```

Die Datenbank liegt unter `data/medarbeiter.db` (SQLite/WAL, wird automatisch
angelegt und migriert). Produktion: `bun run build && bun run start`.

## Oberflächen

| Route | Wer | Zweck |
|---|---|---|
| `/` (Heute) | alle | Live-Zeitleiste, Ein-/Ausstempeln, Wochenübersicht, Zeitkonto |
| `/zeiten` | alle | Monatshistorie, Tagesdetail, eigene Korrekturen |
| `/team` | Verwaltung | Alle Mitarbeiter als Mini-Zeitleisten, Live-Status, Anomalien |
| `/abschluss` | Verwaltung | Monatsabschluss je Mitarbeiter (sperrt den Monat) |
| `/berichte` | Verwaltung | Monatssummen, Zeitkonten, CSV-Export, Druckansicht (PDF) |
| `/druck/[monat]` | Verwaltung | Druckoptimierter Arbeitszeitnachweis, ein Blatt je Mitarbeiter |

## Grundregeln der Fachlogik

- Segmente (`arbeit`/`pause`) gehören zu genau einem Kalendertag und enden nie
  nach Mitternacht. Ein offenes Segment an einem vergangenen Tag ist ein
  vergessenes Ausstempeln — es wird nie automatisch geschlossen, sondern als
  Warnung angezeigt und manuell korrigiert.
- Das Zeitkonto zählt nur erfasste Tage (Ist − Soll je Tag mit Einträgen).
- Abgeschlossene Monate sind schreibgeschützt; Korrekturen protokollieren, wer
  sie vorgenommen hat.

Weitere Dokumentation: `PRODUCT.md` (Produktwahrheit), `DESIGN.md` (visuelles
System), `CLAUDE.md` (Arbeitsregeln für KI-Sessions).
