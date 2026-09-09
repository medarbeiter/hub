# Team & Ziele Implementation Plan

> Ausführung mit superpowers:subagent-driven-development; unabhängige Datenlogik und Oberfläche, anschließend gemeinsame Prüfung.

**Goal:** Teamereignisse und persönliche, automatisch auswertbare Ziele für alle angemeldeten Personen.
**Architecture:** SQLite speichert Ziele; Fortschritt und historische Feed-Ereignisse werden aus Quelldaten abgeleitet. Server Actions schützen Mutationen. ZeitRahmen trägt Feed und Profile.
**Tech Stack:** Bun, SQLite, Next.js, Astryx.
**Spec:** `docs/superpowers/specs/2026-09-09-team-ziele-design.md`

## Grenzen
German only, Bun only, bestehende Hauszeit und Komponenten. Keine fremden privaten Daten im Payload. Keine Änderungen an bestehenden Migrationen.

## Aufgaben
- [ ] Datenlogik: `lib/ziele.ts`, `lib/ziele-arten.ts`, Migration in `lib/db.ts`, `tests/ziele.test.ts`. Tests zuerst: Grenzen, Eigentümer, private Ziele, Korrekturen, Jubiläen und Duplikate.
- [ ] Integration: Zielaktionen und Auditvokabular; `/timeline`, `/profil/[userId]`, Zieloberfläche, Profilverweise, Navigation. Vorhandene Formular- und Layoutkomponenten verwenden.
- [ ] Prüfung: gezielte Bun-Tests, TypeScript, Produktionsbuild; unabhängiger Review und Desktop-/Mobilprüfung soweit lokale Laufzeit verfügbar. Produkt- und Oberflächenregeln ergänzen.

## Entscheidungen
- Automatische Erfolge werden gelesen, nicht durch einen Hintergrunddienst in mutable Kopien geschrieben. Dadurch gelten Korrekturen sofort.
- Bestehende Nutzerdateien bleiben unberührt; Entwicklung im aktuellen Arbeitsverzeichnis. Kein Commit oder Deployment beauftragt.
