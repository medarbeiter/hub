// Die Notizen an einer Personenkarte — geprüft wird, wer ein Wort wieder
// wegnehmen darf und was beim Schreiben abgewiesen wird. Die Karte selbst
// zeichnet nur, was hier entschieden wurde.

import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {wirksameRechte} from '../lib/rollen';
import {createDb, setDbForTesting} from '../lib/db';
import {
  KOMMENTAR_MAX_ZEICHEN,
  darfKommentarLoeschen,
  kommentarById,
  kommentareFuer,
  loescheKommentar,
  schreibeKommentar,
} from '../lib/profil-kommentare';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

afterEach(() => {
  setDbForTesting(undefined);
  db.close();
});

function person(name: string, role = 'mitarbeiter'): {id: number; role: string; rechte: string[]} {
  db.query('INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(`${name}@haus.de`, 'x', name, role);
  const id = db.query<{id: number}, []>('SELECT last_insert_rowid() AS id').get()!.id;
  return {id, role, rechte: wirksameRechte(role, [])};
}

describe('schreibeKommentar', () => {
  test('legt die Notiz an und gibt ihre Kennung zurück', () => {
    const anna = person('Anna');
    const bea = person('Bea');
    const id = schreibeKommentar(bea.id, anna.id, '  Haha, lustiges Profilbild!  ');
    expect(typeof id).toBe('number');
    expect(kommentarById(id as number)?.text).toBe('Haha, lustiges Profilbild!');
  });

  test('leer und zu lang werden auf Deutsch abgewiesen', () => {
    const anna = person('Anna');
    const bea = person('Bea');
    expect(schreibeKommentar(bea.id, anna.id, '   ')).toBe('Bitte einen Kommentar eingeben.');
    expect(schreibeKommentar(bea.id, anna.id, 'x'.repeat(KOMMENTAR_MAX_ZEICHEN + 1))).toContain('höchstens');
  });

  test('an einer Person, die es nicht gibt, hängt keine Notiz', () => {
    const anna = person('Anna');
    expect(schreibeKommentar(999, anna.id, 'Hallo?')).toBe('Diese Person gibt es nicht.');
  });
});

describe('darfKommentarLoeschen', () => {
  const kommentar = {autor_id: 1, person_id: 2};

  test('die Verfasserin darf', () => {
    expect(darfKommentarLoeschen({id: 1, role: 'mitarbeiter'}, kommentar)).toBe(true);
  });

  test('wer die Notiz abbekommen hat, darf sie von der eigenen Karte nehmen', () => {
    expect(darfKommentarLoeschen({id: 2, role: 'mitarbeiter'}, kommentar)).toBe(true);
  });

  test('ein Unbeteiligter darf nicht', () => {
    expect(darfKommentarLoeschen({id: 3, role: 'mitarbeiter', rechte: []}, kommentar)).toBe(false);
  });

  test('wer Konten verwaltet, darf', () => {
    expect(darfKommentarLoeschen({id: 3, role: 'verwaltung', rechte: ['mitarbeiter.verwalten']}, kommentar)).toBe(true);
  });
});

describe('kommentareFuer', () => {
  test('jüngste zuerst, mit Autor und Löschrecht je Zeile', () => {
    const anna = person('Anna');
    const bea = person('Bea');
    schreibeKommentar(bea.id, anna.id, 'Erstes');
    schreibeKommentar(bea.id, bea.id, 'Zweites');

    const ausAnnasSicht = kommentareFuer(bea.id, {id: anna.id, role: 'mitarbeiter'});
    expect(ausAnnasSicht.map((k) => k.text)).toEqual(['Zweites', 'Erstes']);
    expect(ausAnnasSicht.map((k) => k.darfLoeschen)).toEqual([false, true]);
    expect(ausAnnasSicht[1]!.autor?.name).toBe('Anna');
    expect(ausAnnasSicht[1]!.zeit).toMatch(/^\d+\.\d+\.\d{4}, \d{2}:\d{2} Uhr$/);

    // Auf der eigenen Karte darf Bea beides wegnehmen.
    const ausBeasSicht = kommentareFuer(bea.id, {id: bea.id, role: 'mitarbeiter'});
    expect(ausBeasSicht.every((k) => k.darfLoeschen)).toBe(true);
  });

  test('ein gelöschtes Konto nimmt seine Kommentare mit', () => {
    const anna = person('Anna');
    const bea = person('Bea');
    schreibeKommentar(bea.id, anna.id, 'Bis bald');
    db.query('DELETE FROM users WHERE id = ?').run(anna.id);
    expect(kommentareFuer(bea.id, {id: bea.id, role: 'mitarbeiter'})).toEqual([]);
  });

  test('gelöscht ist gelöscht', () => {
    const anna = person('Anna');
    const bea = person('Bea');
    const id = schreibeKommentar(bea.id, anna.id, 'Weg damit') as number;
    loescheKommentar(id);
    expect(kommentarById(id)).toBeNull();
    expect(kommentareFuer(bea.id, {id: bea.id, role: 'mitarbeiter'})).toEqual([]);
  });
});
