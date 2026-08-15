import {afterEach, describe, expect, test} from 'bun:test';
import {healthResponse} from '../app/api/health/route';

let restoreConsoleError: (() => void) | undefined;

afterEach(() => restoreConsoleError?.());

describe('Healthcheck', () => {
  test('meldet eine erreichbare Datenbank als bereit', async () => {
    const response = healthResponse(() => {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status: 'ok'});
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('gibt bei Datenbankfehlern nur eine generische 503-Antwort aus', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    restoreConsoleError = () => {
      console.error = originalConsoleError;
    };

    const response = healthResponse(() => {
      throw new Error('/app/data/medarbeiter.db: geheim');
    });
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({status: 'nicht_bereit'});
    expect(body).not.toContain('medarbeiter.db');
  });
});
