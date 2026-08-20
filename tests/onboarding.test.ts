import {afterEach, describe, expect, test} from 'bun:test';
import {createDb, getDb, setDbForTesting} from '../lib/db';
import {wirksameRechte} from '../lib/rollen';
import {AVATAR_KEYS} from '../lib/avatar';
import {
  einrichtungNeuStarten,
  onboardingAbschliessen,
  onboardingIstFertig,
  persoenlicheEinstellungen,
  persoenlicheEinstellungenSpeichern,
  startPfad,
} from '../lib/onboarding';
import type {User} from '../lib/db';
import {eigenesPasswortAendern, mussPasswortAendern} from '../lib/users';

afterEach(() => setDbForTesting(undefined));

function neuerNutzer(): number {
  const db = createDb(':memory:');
  setDbForTesting(db);
  db.query(
    `INSERT INTO users (email, password_hash, name, role, weekly_minutes, urlaubstage_jahr)
     VALUES ('neu@medarbeiter.example', 'hash', 'Neue Person', 'mitarbeiter', 1800, 30)`,
  ).run();
  return Number(db.query<{id: number}, []>('SELECT id FROM users').get()!.id);
}

describe('Onboarding', () => {
  test('ein neues Konto bleibt bis zur eigenen Bestätigung gesperrt', () => {
    const id = neuerNutzer();
    expect(onboardingIstFertig(id)).toBe(false);

    expect(
      onboardingAbschliessen(id, {startansicht: 'woche', hinweiseZuOffenenTagen: false, avatar: 'buchhaltung-controlling', mailAbbestellt: []}),
    ).toBeNull();
    expect(onboardingIstFertig(id)).toBe(true);
    expect(persoenlicheEinstellungen(id)).toEqual({
      startansicht: 'woche',
      hinweiseZuOffenenTagen: false,
      avatar: 'buchhaltung-controlling',
      mailAbbestellt: [],
    });
    expect(startPfad(id)).toBe('/?ansicht=woche');
  });

  test('eine spätere Stammdatenänderung verlangt eine neue Bestätigung', () => {
    const id = neuerNutzer();
    onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []});
    expect(onboardingIstFertig(id)).toBe(true);

    getDb().query('UPDATE users SET weekly_minutes = 2400, profile_version = profile_version + 1 WHERE id = ?').run(id);
    expect(onboardingIstFertig(id)).toBe(false);
  });

  test('ein Startpasswort muss vor der Stammdatenfreigabe ersetzt werden', async () => {
    const id = neuerNutzer();
    const hash = await Bun.password.hash('Startpasswort1');
    getDb()
      .query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
      .run(hash, id);

    expect(mussPasswortAendern(id)).toBe(true);
    expect(
      onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []}),
    ).toContain('Startpasswort');
    expect(await eigenesPasswortAendern(id, 'Startpasswort1')).toContain('Startpasswort');
    expect(await eigenesPasswortAendern(id, 'Mein-sicheres-Passwort-2026')).toBeNull();
    expect(mussPasswortAendern(id)).toBe(false);
  });

  test('die Verwaltung kann die Einrichtung neu starten; eine bestehende Google-Verknüpfung bleibt', () => {
    const id = neuerNutzer();
    const verwaltung = {id: 999, role: 'verwaltung', rechte: wirksameRechte('verwaltung', [])} as User;
    onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []});
    expect(onboardingIstFertig(id)).toBe(true);

    // Ohne verbundenes Konto kommt auch der Google-Schritt wieder.
    expect(einrichtungNeuStarten(verwaltung, id)).toBeNull();
    expect(onboardingIstFertig(id)).toBe(false);
    expect(
      getDb().query<{g: number}, [number]>('SELECT google_einrichtung_abgeschlossen g FROM users WHERE id = ?').get(id)!.g,
    ).toBe(0);

    // Mit verbundenem Konto bleibt der Schritt erledigt — er beschafft eine
    // Verknüpfung, und die ist ja da.
    getDb()
      .query(
        `INSERT INTO google_konten (user_id, google_sub, google_email, access_token, token_expiry)
         VALUES (?, 'sub', 'n@gmail.com', 'token', 0)`,
      )
      .run(id);
    getDb().query('UPDATE users SET google_einrichtung_abgeschlossen = 1 WHERE id = ?').run(id);
    onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []});
    expect(einrichtungNeuStarten(verwaltung, id)).toBeNull();
    expect(
      getDb().query<{g: number}, [number]>('SELECT google_einrichtung_abgeschlossen g FROM users WHERE id = ?').get(id)!.g,
    ).toBe(1);

    expect(einrichtungNeuStarten({id: 1, role: 'mitarbeiter'} as User, id)).toBe('Keine Berechtigung.');
  });

  test('ein neues Konto schließt die Google-Verknüpfung vor der Freigabe ab', () => {
    const id = neuerNutzer();
    getDb().query('UPDATE users SET google_einrichtung_abgeschlossen = 0 WHERE id = ?').run(id);
    expect(
      onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []}),
    ).toContain('Google-Konto');
  });

  test('persönliche Einstellungen ändern die Stammdatenfreigabe nicht', () => {
    const id = neuerNutzer();
    onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []});
    expect(
      persoenlicheEinstellungenSpeichern(id, {startansicht: 'konto', hinweiseZuOffenenTagen: false, avatar: 'headset-calling', mailAbbestellt: []}),
    ).toBeNull();
    expect(onboardingIstFertig(id)).toBe(true);
    expect(persoenlicheEinstellungen(id).avatar).toBe('headset-calling');
    expect(startPfad(id)).toBe('/?ansicht=konto');
  });

  test('nur eine Figur aus dem lokalen Satz wird gespeichert', () => {
    const id = neuerNutzer();
    expect(
      onboardingAbschliessen(id, {
        startansicht: 'tag',
        hinweiseZuOffenenTagen: true,
        avatar: 'fremde-url' as 'vertrieb-akquise',
        mailAbbestellt: [],
      }),
    ).toContain('Profilfigur');
    expect(onboardingIstFertig(id)).toBe(false);
  });

  test('jede neue lokale Profilfigur lässt sich speichern', () => {
    const id = neuerNutzer();
    onboardingAbschliessen(id, {
      startansicht: 'tag',
      hinweiseZuOffenenTagen: true,
      avatar: AVATAR_KEYS[0],
      mailAbbestellt: [],
    });

    for (const avatar of AVATAR_KEYS) {
      expect(
        persoenlicheEinstellungenSpeichern(id, {
          startansicht: 'tag',
          hinweiseZuOffenenTagen: true,
          avatar,
          mailAbbestellt: [],
        }),
      ).toBeNull();
    }

    expect(persoenlicheEinstellungen(id).avatar).toBe(AVATAR_KEYS[AVATAR_KEYS.length - 1]!);
  });

  test('unplausible Stammdaten können nicht bestätigt werden', () => {
    const id = neuerNutzer();
    getDb().query('UPDATE users SET weekly_minutes = 0 WHERE id = ?').run(id);
    expect(
      onboardingAbschliessen(id, {startansicht: 'tag', hinweiseZuOffenenTagen: true, avatar: 'vertrieb-akquise', mailAbbestellt: []}),
    ).toContain('Wochen-Sollzeit');
    expect(onboardingIstFertig(id)).toBe(false);
  });
});
