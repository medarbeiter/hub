import {afterEach, beforeEach, expect, test, describe} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {eigeneSchluessel} from '../lib/eigene-rechte';
import {ALLE_RECHTE} from '../lib/rechte';
import {
  alleRollen,
  istRolle,
  kontenMitRolle,
  rechteDerRolle,
  rolleAendern,
  rolleAnlegen,
  rolleLabel,
  rolleLoeschen,
  rollenSchluessel,
  wirksameRechte,
} from '../lib/rollen';

// Die drei Regeln der Rollenverwaltung (Kopf von lib/rollen.ts): nur eigene
// Rechte sind verhandelbar, keine Selbstaussperrung, eine Rolle in Gebrauch
// ist unlöschbar.

let db: Database;

function benutzer(email: string, role: string): User {
  db.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, 'x', email, role);
  const u = db
    .query<User, [string]>('SELECT id, email, name, role, weekly_minutes, active, created_at FROM users WHERE email = ?')
    .get(email)! as User;
  u.rechte = wirksameRechte(u.role, []);
  return u;
}

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

afterEach(() => setDbForTesting(undefined));

describe('Migration 27', () => {
  test('die fünf mitgelieferten Rollen stehen als Datensätze da', () => {
    expect(alleRollen().map((r) => r.schluessel).sort()).toEqual([
      'fulfillment', 'geschaeftsfuehrung', 'mitarbeiter', 'vertrieb', 'verwaltung',
    ]);
    // Verwaltung trägt den Vollzugriff „*" (Migration 28) — wirksam ist damit
    // jedes Recht, auch nach der Migration hinzugekommene, eingebaut oder
    // eigen (Migration 32 sät die medarbeiterAI-Rechte), ohne Neuvergabe.
    const alles: string[] = [...ALLE_RECHTE, ...eigeneSchluessel()].sort();
    expect(rechteDerRolle('verwaltung')).toContain('*');
    expect(([...wirksameRechte('verwaltung')] as string[]).sort()).toEqual(alles);
    expect(([...wirksameRechte('geschaeftsfuehrung')] as string[]).sort()).toEqual(alles);
    expect(rechteDerRolle('mitarbeiter')).toContain('zeit.erfassen');
    expect(rechteDerRolle('mitarbeiter')).not.toContain('mitarbeiter.verwalten');
    expect(rechteDerRolle('mitarbeiter')).not.toContain('*'); // „*" nur an Rollen, die alles trugen
  });

  test('users.role trägt keine CHECK-Klausel mehr — ein frei benannter Schlüssel ist speicherbar', () => {
    expect(() => benutzer('neu@t.de', 'buchhaltung')).not.toThrow();
  });
});

describe('Nachschlagen', () => {
  test('eine gelöschte oder unbekannte Rolle bündelt nichts', () => {
    expect(rechteDerRolle('gibt-es-nicht')).toEqual([]);
    expect(wirksameRechte('gibt-es-nicht', ['zeit.erfassen'])).toEqual(['zeit.erfassen']);
  });

  test('rolleLabel: Datensatz, dann Rückfall-Etikett, dann der Schlüssel selbst', () => {
    expect(rolleLabel('verwaltung')).toBe('Verwaltung');
    db.query('DELETE FROM rollen WHERE schluessel = ?').run('verwaltung');
    expect(rolleLabel('verwaltung')).toBe('Verwaltung'); // altes Protokoll bleibt lesbar
    expect(rolleLabel('praktikant-2019')).toBe('praktikant-2019');
  });

  test('rollenSchluessel faltet Umlaute und Sonderzeichen', () => {
    expect(rollenSchluessel('Bürokräfte')).toBe('buerokraefte');
    expect(rollenSchluessel('Außendienst (Süd)')).toBe('aussendienst-sued');
    expect(rollenSchluessel('!!!')).toBe('');
  });
});

describe('rolleAnlegen', () => {
  test('legt an, was die handelnde Person selbst trägt — und nur das', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    const beschraenkt: User = {...chef, rechte: ['rollen.verwalten', 'zeit.erfassen']};
    const ergebnis = rolleAnlegen(beschraenkt, {
      label: 'Buchhaltung',
      rechte: ['zeit.erfassen', 'mitarbeiter.verwalten'],
    });
    expect('error' in ergebnis).toBe(false);
    expect(rechteDerRolle('buchhaltung')).toEqual(['zeit.erfassen']);
  });

  test('weist doppelte Namen und leere Schlüssel ab', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    expect(rolleAnlegen(chef, {label: 'Verwaltung', rechte: []})).toEqual({
      error: 'Eine Rolle mit diesem Namen gibt es bereits.',
    });
    // Schlüsselkollision trotz anderem Etikett: „Vertrieb!" → vertrieb.
    expect(rolleAnlegen(chef, {label: 'Vertrieb!', rechte: []})).toEqual({
      error: 'Eine Rolle mit diesem Namen gibt es bereits.',
    });
    expect(rolleAnlegen(chef, {label: '☂', rechte: []})).toEqual({
      error: 'Der Name braucht mindestens einen Buchstaben oder eine Zahl.',
    });
  });

  test('ohne rollen.verwalten keine Berechtigung', () => {
    const anna = benutzer('anna@t.de', 'mitarbeiter');
    expect(rolleAnlegen(anna, {label: 'Neu', rechte: []})).toEqual({error: 'Keine Berechtigung.'});
  });
});

describe('rolleAendern', () => {
  test('ändert Etikett und Bündel — und wirkt auf alle Träger sofort', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    const anna = benutzer('anna@t.de', 'mitarbeiter');
    expect(rolleAendern(chef, 'mitarbeiter', {label: 'Team', rechte: ['zeit.erfassen', 'berichte.sehen']})).toBeNull();
    expect(rolleLabel('mitarbeiter')).toBe('Team');
    expect(wirksameRechte(anna.role, [])).toEqual(['zeit.erfassen', 'berichte.sehen']);
  });

  test('fremde Rechte bleiben unangetastet', () => {
    benutzer('chef@t.de', 'verwaltung');
    const pfleger = benutzer('rollenpfleger@t.de', 'mitarbeiter');
    const beschraenkt: User = {...pfleger, rechte: ['rollen.verwalten', 'zeit.erfassen']};
    // Der Versuch, verwaltung alles zu nehmen und sich zu geben, verpufft:
    expect(rolleAendern(beschraenkt, 'verwaltung', {label: 'Verwaltung', rechte: ['zeit.erfassen']})).toBeNull();
    const danach = rechteDerRolle('verwaltung');
    expect(danach).toContain('mitarbeiter.verwalten'); // konnte er nicht entfernen
    expect(danach).toContain('zeit.erfassen');
    expect(rolleAendern(beschraenkt, 'mitarbeiter', {
      label: 'Mitarbeiter',
      rechte: [...rechteDerRolle('mitarbeiter'), 'mitarbeiter.verwalten'],
    })).toBeNull();
    expect(rechteDerRolle('mitarbeiter')).not.toContain('mitarbeiter.verwalten'); // konnte er nicht vergeben
  });

  test('keine Selbstaussperrung aus der eigenen Rolle', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    const ohneRollen = ALLE_RECHTE.filter((r) => r !== 'rollen.verwalten' && r !== '*');
    expect(rolleAendern(chef, 'verwaltung', {label: 'Verwaltung', rechte: ohneRollen})).toBe(
      'Du kannst dir nicht selbst das Recht „Rollen verwalten" entziehen.',
    );
    const ohneMitarbeiter = ALLE_RECHTE.filter((r) => r !== 'mitarbeiter.verwalten' && r !== '*');
    expect(rolleAendern(chef, 'verwaltung', {label: 'Verwaltung', rechte: ohneMitarbeiter})).toBe(
      'Du kannst dir nicht selbst das Recht „Mitarbeiter verwalten" entziehen.',
    );
    // Eine fremde Rolle zu beschneiden bleibt erlaubt — der Chef behält seine Rechte selbst.
    expect(rolleAendern(chef, 'geschaeftsfuehrung', {label: 'Geschäftsführung', rechte: ohneMitarbeiter})).toBeNull();
  });

  test('wer die Rechte als Zusatzrechte trägt, darf die eigene Rolle beschneiden', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (?, ?)').run(chef.id, 'rollen.verwalten');
    db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (?, ?)').run(chef.id, 'mitarbeiter.verwalten');
    const ohneBeide = ALLE_RECHTE.filter((r) => r !== 'rollen.verwalten' && r !== 'mitarbeiter.verwalten' && r !== '*');
    expect(rolleAendern(chef, 'verwaltung', {label: 'Verwaltung', rechte: ohneBeide})).toBeNull();
  });
});

describe('rolleLoeschen', () => {
  test('eine Rolle in Gebrauch ist unlöschbar — auch bei stillgelegten Konten', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    const anna = benutzer('anna@t.de', 'vertrieb');
    db.query('UPDATE users SET active = 0 WHERE id = ?').run(anna.id);
    expect(kontenMitRolle('vertrieb')).toBe(1);
    expect(rolleLoeschen(chef, 'vertrieb')).toBe(
      'Diese Rolle ist noch einem Konto zugewiesen. Bitte zuerst eine andere Rolle zuweisen.',
    );
  });

  test('löscht eine unbenutzte Rolle samt Zugangscode-Leserkreis', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    db.query("INSERT INTO totp_konten (dienst, secret, erstellt_von) VALUES ('D', 'x', ?)").run(chef.id);
    db.query("UPDATE totp_konten SET sichtbarkeit = 'rolle'").run();
    const totpId = db.query<{id: number}, []>('SELECT id FROM totp_konten').get()!.id;
    db.query('INSERT INTO totp_konto_rollen (totp_id, rolle) VALUES (?, ?)').run(totpId, 'fulfillment');
    expect(rolleLoeschen(chef, 'fulfillment')).toBeNull();
    expect(istRolle('fulfillment')).toBe(false);
    expect(db.query('SELECT COUNT(*) AS n FROM totp_konto_rollen').get()).toEqual({n: 0});
  });

  test('die letzte Rolle bleibt', () => {
    const chef = benutzer('chef@t.de', 'verwaltung');
    for (const s of ['mitarbeiter', 'fulfillment', 'vertrieb', 'geschaeftsfuehrung']) {
      expect(rolleLoeschen(chef, s)).toBeNull();
    }
    // Nur noch verwaltung — und die trägt der Chef selbst (in Gebrauch), also
    // greift schon die Zuweisungs-Sperre; ohne ihn die Letzte-Rolle-Sperre.
    expect(rolleLoeschen(chef, 'verwaltung')).toBe(
      'Diese Rolle ist noch einem Konto zugewiesen. Bitte zuerst eine andere Rolle zuweisen.',
    );
    db.query('DELETE FROM users').run();
    expect(rolleLoeschen(chef, 'verwaltung')).toBe('Die letzte Rolle kann nicht gelöscht werden.');
  });
});
