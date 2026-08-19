import {describe, expect, test} from 'bun:test';
import {zuschnitt} from '../lib/zuschnitt';

describe('zuschnitt', () => {
  test('Zoom 1 ist der mittige Beschnitt, den der Avatar ohnehin zeigt', () => {
    expect(zuschnitt(1200, 800, 1, 600, 400)).toEqual({seite: 800, x: 600, y: 400});
  });

  test('der Ausschnitt bleibt im Bild, egal wie weit gezogen wird', () => {
    const links = zuschnitt(1200, 800, 1, -5000, 400);
    expect(links.x).toBe(400);
    const unten = zuschnitt(1200, 800, 1, 600, 5000);
    expect(unten.y).toBe(400);
  });

  test('Herauszoomen zieht einen weit außen liegenden Mittelpunkt zurück', () => {
    const eng = zuschnitt(1200, 800, 4, 1150, 400);
    expect(eng.seite).toBe(200);
    expect(eng.x).toBe(1100);
    // derselbe rohe Mittelpunkt, wieder aufgezogen: von selbst wieder gültig
    expect(zuschnitt(1200, 800, 1, 1150, 400).x).toBe(800);
  });
});
