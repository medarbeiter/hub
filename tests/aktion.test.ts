import {describe, expect, mock, test} from 'bun:test';
import {AKTION_FEHLGESCHLAGEN, sicher, sicheresFormular} from '@/lib/aktion';

describe('sicher', () => {
  test('reicht die Antwort der Aktion unverändert durch', async () => {
    const ok = sicher(async () => ({error: null}));
    expect(await ok()).toEqual({error: null});

    const abgelehnt = sicher(async () => ({error: 'Du bist bereits eingestempelt.'}));
    expect(await abgelehnt()).toEqual({error: 'Du bist bereits eingestempelt.'});
  });

  test('reicht die Argumente durch', async () => {
    const aktion = sicher(async (id: number, wert: string) => ({error: `${id}:${wert}`}));
    expect(await aktion(7, 'a')).toEqual({error: '7:a'});
  });

  test('aus einer Verwerfung wird derselbe {error}, den die Aufrufstelle anzeigt', async () => {
    const konsole = mock(() => {});
    const vorher = console.error;
    console.error = konsole;
    try {
      // Genau die Verwerfung, die eine lange offene Seite auslöst.
      const aktion = sicher(async (): Promise<{error: string | null}> => {
        throw new Error('Failed to find Server Action "abc". This request might be from an older deployment.');
      });
      expect(await aktion()).toEqual({error: AKTION_FEHLGESCHLAGEN});
      // Der wirkliche Fehler bleibt auffindbar, statt verschluckt zu werden.
      expect(konsole).toHaveBeenCalled();
    } finally {
      console.error = vorher;
    }
  });

  test('behauptet nichts über den Datensatz', () => {
    // Ein Fehler nach dem Schreiben sieht von hier aus aus wie einer davor.
    expect(AKTION_FEHLGESCHLAGEN).not.toMatch(/nichts (gespeichert|gebucht)/i);
  });
});

describe('sicheresFormular', () => {
  test('behält den vorigen Zustand und setzt nur den Fehler', async () => {
    const konsole = mock(() => {});
    const vorher = console.error;
    console.error = konsole;
    try {
      // Das einmalig gezeigte Secret darf nicht unter der Fehlermeldung verschwinden.
      const aktion = sicheresFormular(
        async (_zustand: {error: string | null; secret: string}, _fd: FormData) => {
          throw new Error('Failed to find Server Action');
        },
      );
      expect(await aktion({error: null, secret: 'abc'}, new FormData())).toEqual({
        error: AKTION_FEHLGESCHLAGEN,
        secret: 'abc',
      });
    } finally {
      console.error = vorher;
    }
  });

  test('reicht Erfolg unverändert durch', async () => {
    const aktion = sicheresFormular(
      async (_z: {error: string | null}, wert: string): Promise<{error: string | null}> => ({error: wert}),
    );
    expect(await aktion({error: null}, 'nope')).toEqual({error: 'nope'});
  });
});
