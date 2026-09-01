import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {
  alleKonkretenSchluessel,
  eigeneRechte,
  eigeneSchluessel,
  gesamtVokabular,
  istBekanntesRecht,
  rechtAendern,
  rechtAnlegen,
  rechtLabel,
  rechtLoeschen,
} from '../lib/eigene-rechte';
import {ALLE_RECHTE, hatRecht} from '../lib/rechte';
import {rolleAnlegen, wirksameRechte} from '../lib/rollen';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});
afterEach(() => setDbForTesting(undefined));

// Erst im Test bauen — auf Modulebene gäbe es die Test-Datenbank noch nicht.
// Und nach jedem rechtAnlegen neu, wie es die echte Sitzung auch tut: die
// wirksamen Rechte werden je Request geladen, ein „*" kennt das neue Recht
// also ab der nächsten Anfrage.
const alsActor = (id: number, role: string): User =>
  ({id, role, rechte: wirksameRechte(role)}) as unknown as User;

const EINGABE = {label: 'Berichte sehen', beschreibung: 'Berichte der App lesen.', bereich: 'CRM', stufe: 'weitreichend'};

describe('Migration 32', () => {
  test('die drei medarbeiterAI-Rechte sind gesät und überall bekannt', () => {
    expect(eigeneSchluessel()).toEqual(['ai.settings.manage', 'ai.subaccounts.manage', 'ai.subaccounts.read']);
    expect(istBekanntesRecht('ai.subaccounts.read')).toBe(true);
    expect(rechtLabel('ai.subaccounts.manage')).toBe('Unterkonten verwalten');
    expect(gesamtVokabular().map((r) => r.schluessel)).toContain('ai.settings.manage');
    expect(alleKonkretenSchluessel()).not.toContain('*');
  });
});

describe('rechtAnlegen', () => {
  test('braucht rechte.verwalten', () => {
    expect(rechtAnlegen(alsActor(2, 'mitarbeiter'), 'crm.leads.read', EINGABE)).toBe('Keine Berechtigung.');
    expect(rechtAnlegen(alsActor(1, 'verwaltung'), 'crm.leads.read', EINGABE)).toBeNull();
  });

  test('der Schlüssel muss die App-Form haben und frei sein', () => {
    const verwalter = alsActor(1, 'verwaltung');
    expect(rechtAnlegen(verwalter, 'ohnepunkt', EINGABE)).not.toBeNull();
    expect(rechtAnlegen(verwalter, 'Groß.buchstaben', EINGABE)).not.toBeNull();
    expect(rechtAnlegen(verwalter, '*', EINGABE)).not.toBeNull();
    expect(rechtAnlegen(verwalter, 'zeit.erfassen', EINGABE)).toBe('Diesen Schlüssel trägt bereits ein eingebautes Recht.');
    expect(rechtAnlegen(verwalter, 'ai.subaccounts.read', EINGABE)).toBe('Ein Recht mit diesem Schlüssel gibt es bereits.');
  });

  test('ein neues Recht wirkt sofort: Bündel, Zusatzrecht und „*" entfalten es', () => {
    expect(rechtAnlegen(alsActor(1, 'verwaltung'), 'crm.leads.read', EINGABE)).toBeNull();
    // „*" (verwaltung) schließt es ohne Neuvergabe ein
    expect(wirksameRechte('verwaltung') as string[]).toContain('crm.leads.read');
    expect(hatRecht({role: 'x', rechte: wirksameRechte('verwaltung')}, 'crm.leads.read' as never)).toBe(true);
    // als Rollenbündel-Recht vergebbar — vom neu geladenen Actor, wie im echten Request
    const ergebnis = rolleAnlegen(alsActor(1, 'verwaltung'), {label: 'CRM-Nutzer', rechte: ['crm.leads.read' as never]});
    if ('error' in ergebnis) throw new Error(ergebnis.error);
    expect(wirksameRechte(ergebnis.schluessel) as string[]).toContain('crm.leads.read');
    // als Zusatzrecht wirksam
    expect(wirksameRechte('mitarbeiter', ['crm.leads.read']) as string[]).toContain('crm.leads.read');
  });
});

describe('rechtAendern und rechtLoeschen', () => {
  test('Anzeige ist änderbar, der Schlüssel nicht Teil der Eingabe', () => {
    expect(rechtAendern(alsActor(1, 'verwaltung'), 'ai.settings.manage', {...EINGABE, label: 'Konfiguration'})).toBeNull();
    expect(rechtLabel('ai.settings.manage')).toBe('Konfiguration');
    expect(rechtAendern(alsActor(2, 'mitarbeiter'), 'ai.settings.manage', EINGABE)).toBe('Keine Berechtigung.');
    expect(rechtAendern(alsActor(1, 'verwaltung'), 'gibt.es-nicht', EINGABE)).toBe('Dieses Recht gibt es nicht.');
  });

  test('Löschen räumt Zusatzrechte ab und reinigt Bündel beim Lesen', () => {
    const ergebnis = rolleAnlegen(alsActor(1, 'verwaltung'), {label: 'KI-Nutzer', rechte: ['ai.subaccounts.read' as never]});
    if ('error' in ergebnis) throw new Error(ergebnis.error);
    db.query('INSERT INTO users (id, email, password_hash, name, role) VALUES (9, \'x@t.de\', \'x\', \'T\', \'mitarbeiter\')').run();
    db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (9, ?)').run('ai.subaccounts.read');

    expect(rechtLoeschen(alsActor(2, 'mitarbeiter'), 'ai.subaccounts.read')).toBe('Keine Berechtigung.');
    expect(rechtLoeschen(alsActor(1, 'verwaltung'), 'ai.subaccounts.read')).toBeNull();

    expect(istBekanntesRecht('ai.subaccounts.read')).toBe(false);
    expect(db.query('SELECT 1 FROM benutzer_rechte WHERE recht = ?').get('ai.subaccounts.read')).toBeNull();
    expect(wirksameRechte(ergebnis.schluessel) as string[]).toEqual([]);
    // „*" entfaltet es nicht mehr — der Katalog kennt es nicht mehr
    expect(wirksameRechte('verwaltung') as string[]).not.toContain('ai.subaccounts.read');
    expect(alleKonkretenSchluessel()).not.toContain('ai.subaccounts.read');
  });
});

test('gesamtVokabular hängt eigene hinter die eingebauten und trägt Bereiche', () => {
  const vokabular = gesamtVokabular();
  expect(vokabular.slice(0, ALLE_RECHTE.length).map((r) => r.schluessel)).toEqual(ALLE_RECHTE);
  expect(vokabular.find((r) => r.schluessel === 'ai.subaccounts.read')?.bereich).toBe('medarbeiterAI');
  expect(eigeneRechte().every((r) => r.bereich.length > 0)).toBe(true);
});
