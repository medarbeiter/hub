/**
 * Seed script — creates the initial Verwaltung account, and with --demo a set
 * of SYNTHETIC demo employees with generated time entries (for trying out the
 * app; replace with real accounts before production use).
 *
 *   bun scripts/seed.ts           # admin account only
 *   bun scripts/seed.ts --demo    # admin + demo employees + demo entries
 */

import {getDb} from '../lib/db';
import {addDays, dailySollMinutes, isoDate, todayISO, weekdayIndex} from '../lib/time';

const db = getDb();
const demo = process.argv.includes('--demo');

// Deterministic PRNG so demo data is stable across runs.
let seed = 424242;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

async function upsertUser(
  email: string,
  name: string,
  role: import('../lib/rechte').Rolle,
  weeklyMinutes: number,
  password: string,
): Promise<number> {
  const existing = db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const hash = await Bun.password.hash(password);
  db.query('INSERT INTO users (email, password_hash, name, role, weekly_minutes) VALUES (?, ?, ?, ?, ?)').run(
    email,
    hash,
    name,
    role,
    weeklyMinutes,
  );
  const row = db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email)!;
  return row.id;
}

function seedDay(userId: number, date: string, weeklyMinutes: number): void {
  const soll = dailySollMinutes({weekly_minutes: weeklyMinutes}, date);
  if (soll === 0) return; // weekend
  if (rand() < 0.06) return; // occasional absence day (Urlaub/Krank not tracked)
  const start = randInt(7 * 60 + 30, 9 * 60); // 07:30–09:00
  const drift = randInt(-25, 40); // daily over/under time
  const work = Math.max(soll + drift, 60);
  const insert = db.query(
    'INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, ?, ?, ?)',
  );
  if (work <= 300) {
    // Short day (part-time): one block, no Pause.
    insert.run(userId, date, 'arbeit', start, start + work);
    return;
  }
  const morning = Math.min(randInt(3 * 60 + 30, 4 * 60 + 30), work - 60);
  const pauseLen = randInt(30, 60);
  insert.run(userId, date, 'arbeit', start, start + morning);
  insert.run(userId, date, 'pause', start + morning, start + morning + pauseLen);
  insert.run(userId, date, 'arbeit', start + morning + pauseLen, start + morning + pauseLen + (work - morning));
}

const adminEmail = 'verwaltung@medarbeiter.example';
const adminPassword = 'medarbeiter2026';
const adminId = await upsertUser(adminEmail, 'Sabine Vogel', 'verwaltung', 2400, adminPassword);
console.log(`Verwaltung: ${adminEmail} / ${adminPassword}  (Passwort bitte ändern)`);

if (demo) {
  const employees: Array<[string, string, number]> = [
    ['a.brandt@medarbeiter.example', 'Anna Brandt', 2400],
    ['j.keller@medarbeiter.example', 'Jonas Keller', 2400],
    ['m.schroeder@medarbeiter.example', 'Maria Schröder', 1800],
    ['t.hoffmann@medarbeiter.example', 'Tim Hoffmann', 2400],
    ['l.wagner@medarbeiter.example', 'Lena Wagner', 1200],
    ['d.fischer@medarbeiter.example', 'David Fischer', 2400],
    ['s.becker@medarbeiter.example', 'Sofia Becker', 1800],
  ];

  const today = todayISO();
  const firstDay = addDays(today, -45);

  for (const [email, name, weekly] of employees) {
    const id = await upsertUser(email, name, 'mitarbeiter', weekly, 'demo2026');
    const already = db
      .query<{n: number}, [number]>('SELECT COUNT(*) AS n FROM segments WHERE user_id = ?')
      .get(id)!;
    if (already.n > 0) continue;
    for (let d = firstDay; d < today; d = addDays(d, 1)) {
      seedDay(id, d, weekly);
    }
  }

  // Live states for today: two clocked in, one in Pause, one forgotten clock-out yesterday.
  const byEmail = (email: string) =>
    db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email)!.id;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const insert = db.query('INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, ?, ?, ?)');
  const open = db.query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, ?)');

  const anna = byEmail('a.brandt@medarbeiter.example');
  if (db.query<{n: number}, [number, string]>('SELECT COUNT(*) AS n FROM segments WHERE user_id = ? AND date = ?').get(anna, today)!.n === 0 && nowMin > 13 * 60) {
    insert.run(anna, today, 'arbeit', 8 * 60 + 2, 12 * 60 + 15);
    insert.run(anna, today, 'pause', 12 * 60 + 15, 12 * 60 + 45);
    open.run(anna, today, 'arbeit', 12 * 60 + 45);
  }
  const jonas = byEmail('j.keller@medarbeiter.example');
  if (db.query<{n: number}, [number, string]>('SELECT COUNT(*) AS n FROM segments WHERE user_id = ? AND date = ?').get(jonas, today)!.n === 0 && nowMin > 9 * 60 + 30) {
    insert.run(jonas, today, 'arbeit', 8 * 60 + 31, Math.min(nowMin - 10, 12 * 60));
    open.run(jonas, today, 'pause', Math.min(nowMin - 10, 12 * 60));
  }
  // Forgotten clock-out: open segment yesterday for Tim.
  const tim = byEmail('t.hoffmann@medarbeiter.example');
  const yesterday = addDays(today, -1);
  if (weekdayIndex(yesterday) <= 4) {
    db.query('DELETE FROM segments WHERE user_id = ? AND date = ? AND kind = ? AND end_min IS NOT NULL AND start_min > ?').run(tim, yesterday, 'arbeit', 12 * 60);
    open.run(tim, yesterday, 'arbeit', 13 * 60 + 12);
  }

  // Drei synthetische Dienstreisen: eine mehrtägige zur Prüfung eingereicht,
  // eine eintägige knapp unter der Acht-Stunden-Schwelle (zeigt, wie „kein
  // Anspruch" aussieht) und eine bereits genehmigte mit Beleg.
  const stempel = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const reisen = db.query(
    `INSERT INTO reisen (user_id, start_date, start_min, end_date, end_min, zweck, ziel, status,
       satz_teiltag_cent, satz_volltag_cent, eingereicht_at, entschieden_at, entschieden_von)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  if (db.query<{n: number}, []>('SELECT COUNT(*) AS n FROM reisen').get()!.n === 0) {
    const lena = byEmail('l.wagner@medarbeiter.example');
    reisen.run(
      anna, addDays(today, -12), 6 * 60 + 30, addDays(today, -10), 19 * 60 + 40,
      'Fotoshooting Klinik Nord', 'Hamburg', 'eingereicht', 1000, 2000, stempel, null, null,
    );
    reisen.run(
      jonas, addDays(today, -6), 8 * 60 + 15, addDays(today, -6), 15 * 60 + 30,
      'Portraittermin Praxis Süd', 'Leipzig', 'entwurf', null, null, null, null, null,
    );
    reisen.run(
      lena, addDays(today, -25), 7 * 60, addDays(today, -24), 17 * 60 + 20,
      'Imagefilm Pflegeheim', 'Rostock', 'genehmigt', 1000, 2000, stempel, stempel, adminId,
    );
    const letzte = db.query<{id: number}, []>('SELECT id FROM reisen ORDER BY id DESC LIMIT 1').get()!.id;
    db.query(
      'INSERT INTO reise_belege (reise_id, art, datum, betrag_cent, beschreibung) VALUES (?, ?, ?, ?, ?)',
    ).run(letzte, 'uebernachtung', addDays(today, -25), 8900, 'Hotel am Hafen, eine Nacht');
  }

  console.log(`Demo: ${employees.length} Mitarbeiter (Passwort: demo2026), Zeiten ${firstDay} – ${today}, drei Dienstreisen. Alle Demo-Daten sind synthetisch.`);
}

console.log(`Datenbank: ${process.cwd()}/data/medarbeiter.db`);
