import {describe, expect, test} from 'bun:test';
import {
  ALLE_RECHTE,
  STUFEN,
  RECHTE,
  STANDARD_ROLLEN_LABEL,
  hatRecht,
  istRecht,
  mischeRechte,
  vereinigeRechte,
} from '@/lib/rechte';

// Die Rollenbündel selbst sind Datensätze (tests/rollen.test.ts) — hier steht
// nur noch die reine Arithmetik, die Server und Browser teilen.

describe('Rechte-Vokabular', () => {
  test('jedes Recht trägt Label und Beschreibung', () => {
    for (const recht of ALLE_RECHTE) {
      expect(RECHTE[recht].label.length).toBeGreaterThan(0);
      expect(RECHTE[recht].beschreibung.length).toBeGreaterThan(0);
      expect(STUFEN[RECHTE[recht].stufe]).toBeDefined();
      expect(istRecht(recht)).toBe(true);
    }
    expect(istRecht('quatsch')).toBe(false);
  });

  test('die fünf mitgelieferten Rollen behalten ihr Rückfall-Etikett', () => {
    expect(STANDARD_ROLLEN_LABEL['geschaeftsfuehrung']).toBe('Geschäftsführung');
    expect(STANDARD_ROLLEN_LABEL['mitarbeiter']).toBe('Mitarbeiter');
  });
});

describe('hatRecht', () => {
  test('zählt ausschließlich die mitgereichten wirksamen Rechte', () => {
    expect(hatRecht({role: 'vertrieb', rechte: ['spesen.pruefen']}, 'spesen.pruefen')).toBe(true);
    // Leere wirksame Menge heißt leer — nicht „fall zurück auf die Rolle".
    expect(hatRecht({role: 'verwaltung', rechte: []}, 'zeit.erfassen')).toBe(false);
  });

  test('ohne geladene Rechte gibt es kein Ja — die Bündel leben in der Datenbank', () => {
    expect(hatRecht({role: 'verwaltung'}, 'mitarbeiter.verwalten')).toBe(false);
  });
});

describe('vereinigeRechte', () => {
  test('vereinigt, dedupliziert und verwirft Unbekanntes', () => {
    const rechte = vereinigeRechte(['zeit.erfassen'], ['spesen.pruefen', 'spesen.pruefen', 'quatsch']);
    expect(rechte).toContain('spesen.pruefen');
    expect(rechte).toContain('zeit.erfassen');
    expect(rechte.filter((r) => r === 'spesen.pruefen')).toHaveLength(1);
    expect(rechte).not.toContain('quatsch');
  });

  test('leeres Bündel: nur die (gültigen) Zusatzrechte bleiben', () => {
    expect(vereinigeRechte([], ['zeit.erfassen'])).toEqual(['zeit.erfassen']);
  });
});

describe('mischeRechte', () => {
  test('eigene Rechte lassen sich vergeben und entfernen', () => {
    const neu = mischeRechte(['zeit.erfassen'], ['spesen.pruefen'], ['zeit.erfassen', 'spesen.pruefen']);
    expect(neu).toEqual(['spesen.pruefen']);
  });

  test('fremde Rechte bleiben unangetastet — weder vergeben noch entfernt', () => {
    // Der Bearbeiter trägt nur zeit.erfassen: mitarbeiter.verwalten kann er
    // weder aus dem Bündel nehmen (fehlt in gewuenscht) noch hineinschummeln.
    const neu = mischeRechte(
      ['mitarbeiter.verwalten'],
      ['zeit.erfassen', 'rollen.verwalten'],
      ['zeit.erfassen'],
    );
    expect(neu).toEqual(['zeit.erfassen', 'mitarbeiter.verwalten']);
  });

  test('Unbekanntes fällt heraus', () => {
    expect(mischeRechte([], ['quatsch'], ['zeit.erfassen', 'quatsch'])).toEqual([]);
  });
});

describe('Vollzugriff („*")', () => {
  test('hatRecht: „*" beantwortet jedes Recht mit Ja — auch unentfaltet', () => {
    for (const recht of ALLE_RECHTE) {
      expect(hatRecht({role: 'egal', rechte: ['*']}, recht)).toBe(true);
    }
  });

  test('vereinigeRechte entfaltet „*" auf das ganze Vokabular', () => {
    expect(vereinigeRechte(['*'])).toEqual(ALLE_RECHTE);
    expect(vereinigeRechte(['zeit.erfassen'], ['*'])).toEqual(ALLE_RECHTE);
  });

  test('mischeRechte: „*" vergibt und entfernt nur, wer es selbst trägt', () => {
    expect(mischeRechte([], ['*'], ['zeit.erfassen'])).toEqual([]);
    expect(mischeRechte(['*'], [], ['zeit.erfassen'])).toEqual(['*']);
    expect(mischeRechte([], ['*'], vereinigeRechte(['*']))).toEqual(['*']);
  });
});
