import {describe, expect, test} from 'bun:test';
import {
  ALLE_RECHTE,
  ALLE_ROLLEN,
  RECHTE,
  ROLLEN,
  effektiveRechte,
  hatRecht,
  istRecht,
  istRolle,
  rolleLabel,
  rollenMitRecht,
} from '@/lib/rechte';

describe('Rechte-Vokabular', () => {
  test('jede Rolle bündelt nur bekannte Rechte', () => {
    for (const rolle of ALLE_ROLLEN) {
      for (const recht of ROLLEN[rolle].rechte) expect(istRecht(recht)).toBe(true);
    }
  });

  test('Verwaltung und Geschäftsführung tragen jedes Recht', () => {
    for (const recht of ALLE_RECHTE) {
      expect(hatRecht({role: 'verwaltung'}, recht)).toBe(true);
      expect(hatRecht({role: 'geschaeftsfuehrung'}, recht)).toBe(true);
    }
  });

  test('jede Rolle kann den eigenen Datensatz führen', () => {
    for (const rolle of ALLE_ROLLEN) {
      expect(hatRecht({role: rolle}, 'zeit.erfassen')).toBe(true);
      expect(hatRecht({role: rolle}, 'abwesenheit.beantragen')).toBe(true);
      expect(hatRecht({role: rolle}, 'spesen.erfassen')).toBe(true);
    }
  });

  test('Basisrollen tragen keine Aufsichtsrechte', () => {
    for (const rolle of ['mitarbeiter', 'fulfillment', 'vertrieb'] as const) {
      expect(hatRecht({role: rolle}, 'mitarbeiter.verwalten')).toBe(false);
      expect(hatRecht({role: rolle}, 'abschluss.verwalten')).toBe(false);
      expect(hatRecht({role: rolle}, 'protokoll.alle')).toBe(false);
    }
  });

  test('mitgereichte wirksame Rechte gewinnen über das Rollenbündel', () => {
    // Sitzung mit Zusatzrecht: die Rolle allein dürfte nicht prüfen.
    expect(hatRecht({role: 'vertrieb', rechte: ['spesen.pruefen']}, 'spesen.pruefen')).toBe(true);
    // Leere wirksame Menge heißt leer — nicht „fall zurück auf die Rolle".
    expect(hatRecht({role: 'verwaltung', rechte: []}, 'zeit.erfassen')).toBe(false);
  });

  test('effektiveRechte vereinigt, dedupliziert und verwirft Unbekanntes', () => {
    const rechte = effektiveRechte('mitarbeiter', ['spesen.pruefen', 'spesen.pruefen', 'quatsch']);
    expect(rechte).toContain('spesen.pruefen');
    expect(rechte).toContain('zeit.erfassen');
    expect(rechte.filter((r) => r === 'spesen.pruefen')).toHaveLength(1);
    expect(rechte).not.toContain('quatsch');
    // Unbekannte Rolle: nur die (gültigen) Zusatzrechte bleiben.
    expect(effektiveRechte('alt-rolle', ['zeit.erfassen'])).toEqual(['zeit.erfassen']);
  });

  test('rollenMitRecht findet die Verwalterrollen', () => {
    expect(rollenMitRecht('mitarbeiter.verwalten').sort()).toEqual(['geschaeftsfuehrung', 'verwaltung']);
  });

  test('Etiketten: bekannt übersetzt, unbekannt unverändert', () => {
    expect(rolleLabel('geschaeftsfuehrung')).toBe('Geschäftsführung');
    expect(rolleLabel('mitarbeiter')).toBe('Mitarbeiter');
    // Alte Protokollzeilen tragen eingefrorene Rollenschlüssel und dürfen nicht kippen.
    expect(rolleLabel('praktikant-2019')).toBe('praktikant-2019');
    expect(istRolle('praktikant-2019')).toBe(false);
  });

  test('jedes Recht trägt Etikett und Beschreibung', () => {
    for (const recht of ALLE_RECHTE) {
      expect(RECHTE[recht].label.length).toBeGreaterThan(0);
      expect(RECHTE[recht].beschreibung.length).toBeGreaterThan(0);
    }
  });
});
