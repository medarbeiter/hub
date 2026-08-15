import {describe, expect, test} from 'bun:test';
import {createDb} from '../lib/db';
import {bootstrapAdmin, deploymentConfig} from '../lib/bootstrap';

const valid = {
  APP_URL: 'https://hub.example.de',
  ADMIN_EMAIL: 'admin@example.de',
  ADMIN_NAME: 'Erste Verwaltung',
  ADMIN_PASSWORD: 'SicheresPasswort2026',
};

describe('Deployment-Konfiguration', () => {
  test('verlangt alle vier Pflichtwerte', () => {
    for (const key of Object.keys(valid)) {
      expect(() => deploymentConfig({...valid, [key]: ''})).toThrow();
    }
  });

  test('erlaubt HTTPS und lokales HTTP, aber kein öffentliches HTTP', () => {
    expect(deploymentConfig(valid).appUrl).toBe('https://hub.example.de');
    expect(deploymentConfig({...valid, APP_URL: 'http://localhost:3000'}).appUrl)
      .toBe('http://localhost:3000');
    expect(() => deploymentConfig({...valid, APP_URL: 'http://hub.example.de'})).toThrow();
  });

  test('prüft E-Mail, Namen und die bestehenden Passwortregeln', () => {
    expect(() => deploymentConfig({...valid, ADMIN_EMAIL: 'keine-mail'})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_NAME: '  '})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_PASSWORD: 'nur-buchstaben'})).toThrow();
    expect(() => deploymentConfig({...valid, ADMIN_PASSWORD: '123456789012'})).toThrow();
  });
});

describe('Verwaltungs-Bootstrap', () => {
  test('legt genau ein Konto mit wechselpflichtigem Startpasswort an', async () => {
    const db = createDb(':memory:');
    const config = deploymentConfig(valid);
    expect(await bootstrapAdmin(db, config)).toBe(true);
    const row = db.query<{
      email: string; name: string; role: string; weekly_minutes: number;
      must_change_password: number; password_hash: string;
    }, []>('SELECT email, name, role, weekly_minutes, must_change_password, password_hash FROM users').get()!;
    expect(row).toMatchObject({
      email: 'admin@example.de', name: 'Erste Verwaltung', role: 'verwaltung',
      weekly_minutes: 2400, must_change_password: 1,
    });
    expect(await Bun.password.verify(valid.ADMIN_PASSWORD, row.password_hash)).toBe(true);
  });

  test('verändert ein bestehendes Konto bei erneutem Start nicht', async () => {
    const db = createDb(':memory:');
    await bootstrapAdmin(db, deploymentConfig(valid));
    const vorher = db.query<{email: string; password_hash: string}, []>(
      'SELECT email, password_hash FROM users',
    ).get()!;
    expect(await bootstrapAdmin(db, deploymentConfig({
      ...valid,
      ADMIN_EMAIL: 'anders@example.de',
      ADMIN_PASSWORD: 'AnderesPasswort2026',
    }))).toBe(false);
    expect(db.query('SELECT email, password_hash FROM users').get()).toEqual(vorher);
  });
});
