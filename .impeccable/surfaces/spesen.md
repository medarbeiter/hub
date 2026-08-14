---
version: 1
slug: "spesen"
primary_target: "route:/spesen"
related_targets: ["route:/spesen/pruefen"]
---

# Surface: Reisen & Spesen (Spesenabrechnung)

Mode: Operate (both screens).

Audience & job: photographers who work away from the office for hours or days claim their
Verpflegungsmehraufwand; Verwaltung reviews those claims against the stamped record and releases them
for payroll.

Problem it replaces: the claim was written by hand — date, duration of absence, start and end of the
activity, purpose — with the **duration calculated manually** and the applicable flat rate looked up
from a table that has already changed once. A hand-calculated duration is the kind of number that
reaches payroll wrong.

Direction: **"Die Reise rechnet sich selbst."** The employee says when they left, when they were back,
and why; everything else is derived and shown. The editor renders the day-by-day derivation live while
the trip is typed, each day naming the rule that produced its amount — the same show-your-work move
`zeitkontoSummary()` already makes for the Zeitkonto. Memorable moment: the **Abwesenheitsspange**, a
stone measuring bracket under the day's stamped lane, with a dashed extension to the eight-hour
threshold on a day that earned nothing — the shortfall is in the picture, not just as 0,00 € in a row.

Visual authority: the existing MedArbeiter world. `/spesen` pours into the same `ZeitRahmen` as Meine
Zeit (Kopf / Bühne / Belege / Kontext-Rail) with the one navigator (`Monat │ Jahr`); `/spesen/pruefen`
uses the manager-page skeleton that `/team`, `/abschluss` and `/berichte` already use — manager
surfaces deliberately do not use `ZeitRahmen`.

Named rule added: **Spesen sind kein Gold.** Gold means worked time and the primary action; money is
primary ink and the absence bracket is stone at full opacity.

Model decisions (user-confirmed 2026-08-05, rate spec supplied same day):
- Calculated **per calendar day**, never from total hours. Single day: ≥ 8 h → half rate, below → 0.
  Multi-day: half for arrival and departure day regardless of hours, full for each day fully in
  between (`2 × halb + (Tage − 2) × voll`).
- Dated rate table, editable in Einstellungen: 14/28 € until 2025-09-30, 10/20 € from 2025-10-01.
  The **departure date** picks the tier, so a trip across the cutover keeps one rate. The tier is
  frozen onto the claim at Einreichen.
- Scope: Verpflegungspauschale plus Belege with optional file. No Kürzung bei gestellten Mahlzeiten,
  no kilometre allowance.
- Workflow Entwurf → Eingereicht → Genehmigt / Abgelehnt (required German reason). An eingereichte
  Reise blocks the Monatsabschluss; a locked month freezes its trips.
- Trips never overlap for one person; an Entwurf may be in the future, a submission may not.

Seams into the existing app: the Tag range offers "Als Dienstreise abrechnen" for a stamped day not yet
covered by a trip (deep link `/spesen?neu=<datum>`); the editor offers, never applies, the day's first
Einstempeln and last Ausstempeln as the absence window, because absence starts at home and not at the
desk. Abschluss gained an "Offene Reisen" column and a blocking banner; Berichte gained a Spesen CSV.

Unresolved (do not invent): whether a short trip across midnight (23:00 → 01:00) should really count as
two calendar days — implemented per the supplied spec and flagged for the client; whether trips belong
on the print sheet; whether Verwaltung may create a trip on an employee's behalf (today they may edit
and correct, but creation starts with the employee).
