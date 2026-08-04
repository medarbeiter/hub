/**
 * One-off cleanup — merges historic stamp fragments the live merge logic now
 * prevents: adjacent same-kind entries with gaps at or below the merge window,
 * plus micro-pauses (shorter than the window) sandwiched between two work
 * entries. Gaps are absorbed into the surviving entry, exactly like the live
 * behavior. Open entries are never touched; locked months are skipped and
 * reported. The surviving row keeps its own edited_by — the script fabricates
 * no editor.
 *
 *   bun scripts/merge-fragments.ts                 # dry run (default): report only
 *   bun scripts/merge-fragments.ts --apply         # write the merges
 *   bun scripts/merge-fragments.ts --window=3      # override merge window (minutes)
 *   bun scripts/merge-fragments.ts --user=7        # single user only
 */

import {getDb, type Segment} from '../lib/db';
import {mergeWindowMin} from '../lib/settings';
import {fmtTime, monthOf} from '../lib/format';

const db = getDb();
const apply = process.argv.includes('--apply');
const windowArg = process.argv.find((a) => a.startsWith('--window='));
const userArg = process.argv.find((a) => a.startsWith('--user='));
const window = windowArg ? Number(windowArg.split('=')[1]) : mergeWindowMin();
const onlyUser = userArg ? Number(userArg.split('=')[1]) : null;

if (!Number.isFinite(window) || window < 0) {
  console.error(`Ungültiges Fenster: ${windowArg}`);
  process.exit(1);
}

interface Plan {
  userId: number;
  userName: string;
  date: string;
  /** ids of rows absorbed into the survivor (deleted) */
  absorbed: number[];
  survivorId: number;
  /** null = the run ends in an open segment; the survivor is reopened */
  newEndMin: number | null;
  newNote: string | null;
  before: string;
}

const lockedMonths = new Map<number, Set<string>>();
for (const row of db.query<{user_id: number; month: string}, []>('SELECT user_id, month FROM month_locks').all()) {
  if (!lockedMonths.has(row.user_id)) lockedMonths.set(row.user_id, new Set());
  lockedMonths.get(row.user_id)!.add(row.month);
}

const users = db
  .query<{id: number; name: string}, []>('SELECT id, name FROM users ORDER BY id')
  .all()
  .filter((u) => onlyUser === null || u.id === onlyUser);

const plans: Plan[] = [];
const skippedLocked = new Set<string>();

function fmtSeg(s: {kind: string; start_min: number; end_min: number | null}): string {
  return `${s.kind === 'arbeit' ? 'A' : 'P'} ${fmtTime(s.start_min)}–${s.end_min === null ? 'offen' : fmtTime(s.end_min)}`;
}

for (const user of users) {
  const dates = db
    .query<{date: string}, [number]>('SELECT DISTINCT date FROM segments WHERE user_id = ? ORDER BY date')
    .all(user.id);
  for (const {date} of dates) {
    if (lockedMonths.get(user.id)?.has(monthOf(date))) {
      skippedLocked.add(`${user.name}: ${monthOf(date)}`);
      continue;
    }
    const segments = db
      .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? ORDER BY start_min')
      .all(user.id, date);

    // Micro-pauses flush between two work entries are fumbling, not breaks.
    const dropped = new Set<number>();
    for (let i = 1; i < segments.length - 1; i++) {
      const p = segments[i]!;
      const before = segments[i - 1]!;
      const after = segments[i + 1]!;
      if (
        p.kind === 'pause' &&
        p.end_min !== null &&
        p.end_min - p.start_min < window &&
        before.kind === 'arbeit' &&
        before.end_min === p.start_min &&
        after.kind === 'arbeit' &&
        after.start_min === p.end_min
      ) {
        dropped.add(p.id);
      }
    }

    // Merge runs of adjacent same-kind segments with gaps within the window.
    // An open segment can only end a run (nothing follows a running entry);
    // the survivor is then reopened, mirroring the live merge behavior.
    const surviving = segments.filter((s) => !dropped.has(s.id));
    let run: Segment[] = [];
    const runs: Segment[][] = [];
    for (const s of surviving) {
      const prev = run[run.length - 1];
      if (prev && prev.kind === s.kind && prev.end_min !== null && s.start_min - prev.end_min <= window) {
        run.push(s);
      } else {
        if (run.length > 1) runs.push(run);
        run = [s];
      }
    }
    if (run.length > 1) runs.push(run);

    // Dropped micro-pauses only matter when their neighbours actually merge;
    // otherwise deleting them would erase a recorded (if tiny) break.
    const mergedIds = new Set(runs.flat().map((s) => s.id));
    const effectiveDrops = [...dropped].filter((id) => {
      const idx = segments.findIndex((s) => s.id === id);
      return mergedIds.has(segments[idx - 1]!.id) && mergedIds.has(segments[idx + 1]!.id);
    });

    if (runs.length === 0) continue;

    for (const r of runs) {
      const survivor = r[0]!;
      const runEnd = r[r.length - 1]!.end_min ?? 1440;
      const notes = r.map((s) => s.note).filter((n): n is string => Boolean(n));
      plans.push({
        userId: user.id,
        userName: user.name,
        date,
        absorbed: [
          ...r.slice(1).map((s) => s.id),
          ...effectiveDrops.filter((id) => {
            const p = segments.find((s) => s.id === id)!;
            return p.start_min >= survivor.start_min && p.end_min! <= runEnd;
          }),
        ],
        survivorId: survivor.id,
        newEndMin: r[r.length - 1]!.end_min,
        newNote: notes.length > 0 ? [...new Set(notes)].join(' · ') : null,
        before: segments.map(fmtSeg).join(', '),
      });
    }
  }
}

if (plans.length === 0) {
  console.log(`Keine zusammenführbaren Fragmente gefunden (Fenster: ${window} Min.).`);
} else {
  console.log(`${apply ? 'Führe zusammen' : 'Vorschau (nichts geändert)'} — Fenster: ${window} Min.\n`);
  for (const p of plans) {
    console.log(`${p.userName} · ${p.date}`);
    console.log(`  vorher: ${p.before}`);
    console.log(
      `  ändert: Eintrag #${p.survivorId} endet neu ${p.newEndMin === null ? 'offen' : fmtTime(p.newEndMin)}, löscht #${p.absorbed.join(', #')}`,
    );
  }
  console.log(`\n${plans.length} Zusammenführungen, ${plans.reduce((n, p) => n + p.absorbed.length, 0)} Einträge entfallen.`);

  if (apply) {
    db.transaction(() => {
      const update = db.query("UPDATE segments SET end_min = ?, note = ?, updated_at = datetime('now') WHERE id = ?");
      const del = db.query('DELETE FROM segments WHERE id = ?');
      for (const p of plans) {
        update.run(p.newEndMin, p.newNote, p.survivorId);
        for (const id of p.absorbed) del.run(id);
      }
    })();
    console.log('Angewendet.');
  } else {
    console.log('Dry-Run — zum Anwenden: bun scripts/merge-fragments.ts --apply');
  }
}

if (skippedLocked.size > 0) {
  console.log(`\nÜbersprungen (Monat abgeschlossen): ${[...skippedLocked].sort().join('; ')}`);
}
