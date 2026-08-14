import {describe, expect, test} from 'bun:test';
import {kalendergitter, rasterStufe, wochenraster} from '@/lib/kalendergitter';

describe('kalendergitter', () => {
  test('faltet den Monat in volle Wochen von Montag bis Sonntag', () => {
    // August 2026 beginnt an einem Samstag und endet an einem Montag.
    const g = kalendergitter('2026-08');
    expect(g.wochen.length).toBe(6);
    for (const w of g.wochen) expect(w.tage.length).toBe(7);
    expect(g.alleTage[0]).toBe('2026-07-27'); // Montag der ersten Woche
    expect(g.alleTage.at(-1)).toBe('2026-09-06'); // Sonntag der letzten
  });

  test('trennt die Tage des Monats von denen der Nachbarmonate', () => {
    const g = kalendergitter('2026-08');
    expect(g.monatsTage.length).toBe(31);
    expect(g.monatsTage[0]).toBe('2026-08-01');
    expect(g.monatsTage.at(-1)).toBe('2026-08-31');
    // Die Randtage werden gezeichnet, gehören aber nicht dem Monat.
    const ersteWoche = g.wochen[0]!;
    expect(ersteWoche.tage.filter((t) => t.imMonat).map((t) => t.datum)).toEqual([
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  test('jede Spalte ist durchgehend derselbe Wochentag', () => {
    const g = kalendergitter('2026-02');
    for (const w of g.wochen) {
      w.tage.forEach((tag, i) => expect(tag.spalte).toBe(i));
    }
    // Spalte 0 ist überall ein Montag.
    for (const w of g.wochen) {
      expect(new Date(`${w.tage[0]!.datum}T12:00:00`).getDay()).toBe(1);
    }
  });

  test('ein Februar, der genau auf Wochengrenzen fällt, bekommt vier Zeilen', () => {
    // Februar 2027: 1.2. ist ein Montag, 28.2. ein Sonntag.
    const g = kalendergitter('2027-02');
    expect(g.wochen.length).toBe(4);
    expect(g.alleTage.length).toBe(28);
    expect(g.alleTage.every((t) => t.startsWith('2027-02'))).toBe(true);
  });

  test('trägt die Kalenderwoche je Zeile', () => {
    const g = kalendergitter('2026-08');
    expect(g.wochen.map((w) => w.kw)).toEqual([31, 32, 33, 34, 35, 36]);
  });
});

describe('wochenraster', () => {
  test('gibt die Wochen eines Jahres nach ISO', () => {
    const w = wochenraster('2026');
    expect(w.length).toBe(53);
    expect(w[0]!.kw).toBe(1);
    expect(w[0]!.montag).toBe('2025-12-29');
    expect(w.at(-1)!.kw).toBe(53);
  });

  test('ein 52-Wochen-Jahr bekommt 52 Spalten', () => {
    const w = wochenraster('2025');
    expect(w.length).toBe(52);
    expect(w.at(-1)!.kw).toBe(52);
  });

  test('jede Woche läuft von Montag bis Sonntag', () => {
    for (const woche of wochenraster('2026')) {
      expect(new Date(`${woche.montag}T12:00:00`).getDay()).toBe(1);
      expect(new Date(`${woche.sonntag}T12:00:00`).getDay()).toBe(0);
    }
  });
});

describe('rasterStufe', () => {
  test('null Tage sind keine Stufe', () => {
    expect(rasterStufe(0)).toBe(0);
    expect(rasterStufe(-1)).toBe(0);
  });

  test('die Rampe steigt dort, wo der Unterschied etwas bedeutet', () => {
    expect(rasterStufe(1)).toBe(1);
    expect(rasterStufe(2)).toBe(2);
    expect(rasterStufe(3)).toBe(2);
    expect(rasterStufe(4)).toBe(3);
    expect(rasterStufe(5)).toBe(4);
    // Mehr als fünf Arbeitstage kann eine Woche nicht haben — aber wenn doch
    // einer gezählt würde, fällt er nicht aus der Rampe.
    expect(rasterStufe(7)).toBe(4);
  });
});
