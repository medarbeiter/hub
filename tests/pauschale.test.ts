import {describe, expect, test} from 'bun:test';
import {
  MAX_REISETAGE,
  STANDARD_SAETZE,
  TEILTAG_AB_MIN,
  berechneSpesen,
  pruefeSpanne,
  satzFuer,
  tageDerReise,
  type ReiseSpanne,
  type SatzStufe,
} from '../lib/pauschale';

// Eine feste Stufe für die Regeltests; die datierte Tabelle hat einen eigenen Block.
const SAETZE: SatzStufe = {ab: '1900-01-01', halbCent: 1400, vollCent: 2000};

// Verankert im August 2026 wie der Rest der Suite. 2026-08-04 ist ein Dienstag.
const spanne = (
  startDate: string,
  startMin: number,
  endDate: string,
  endMin: number,
): ReiseSpanne => ({startDate, startMin, endDate, endMin});

describe('berechneSpesen — eintägige Reise', () => {
  test('unter 8 Std. Abwesenheit ergibt keinen Anspruch und sagt warum', () => {
    // 08:00 bis 15:30 = 7:30 Std.
    const r = berechneSpesen(spanne('2026-08-04', 480, '2026-08-04', 930), SAETZE);
    expect(r.tage).toHaveLength(1);
    expect(r.tage[0]!.art).toBe('eintaegig');
    expect(r.tage[0]!.satzCent).toBe(0);
    expect(r.pauschaleCent).toBe(0);
    expect(r.tage[0]!.grund).toContain('0:30');
  });

  test('genau 8 Std. erfüllt die Schwelle', () => {
    const r = berechneSpesen(spanne('2026-08-04', 480, '2026-08-04', 480 + TEILTAG_AB_MIN), SAETZE);
    expect(r.tage[0]!.abwesenheitMin).toBe(TEILTAG_AB_MIN);
    expect(r.pauschaleCent).toBe(1400);
    expect(r.tage[0]!.grund).toBe('Abwesenheit ab 8 Std.');
  });

  test('mehr als 8 Std. ergibt denselben Teiltagessatz — nicht mehr', () => {
    const r = berechneSpesen(spanne('2026-08-04', 360, '2026-08-04', 1320), SAETZE);
    expect(r.tage[0]!.abwesenheitMin).toBe(960);
    expect(r.pauschaleCent).toBe(1400);
  });

  test('Rückkehr um Mitternacht ist erlaubt (endMin 1440)', () => {
    const r = berechneSpesen(spanne('2026-08-04', 300, '2026-08-04', 1440), SAETZE);
    expect(r.tage[0]!.abwesenheitMin).toBe(1140);
    expect(r.pauschaleCent).toBe(1400);
  });
});

describe('berechneSpesen — mehrtägige Reise', () => {
  test('zwei Tage sind An- und Abreise, ohne vollen Tag dazwischen', () => {
    const r = berechneSpesen(spanne('2026-08-04', 480, '2026-08-05', 1080), SAETZE);
    expect(r.tage.map((t) => t.art)).toEqual(['anreise', 'abreise']);
    expect(r.pauschaleCent).toBe(2800);
  });

  test('drei Tage: halb + voll + halb', () => {
    const r = berechneSpesen(spanne('2026-08-04', 420, '2026-08-06', 1200), SAETZE);
    expect(r.tage.map((t) => t.art)).toEqual(['anreise', 'zwischentag', 'abreise']);
    expect(r.tage.map((t) => t.satzCent)).toEqual([1400, 2000, 1400]);
    expect(r.pauschaleCent).toBe(4800);
  });

  test('fünf Tage: drei volle Tage dazwischen', () => {
    const r = berechneSpesen(spanne('2026-08-03', 480, '2026-08-07', 960), SAETZE);
    expect(r.tage).toHaveLength(5);
    expect(r.tage.filter((t) => t.art === 'zwischentag')).toHaveLength(3);
    expect(r.pauschaleCent).toBe(1400 + 3 * 2000 + 1400);
  });

  test('An- und Abreisetag zählen unabhängig von der Stundenzahl', () => {
    // Abfahrt 23:30, Rückkehr 00:20 am übernächsten Tag — beide Randtage sehr kurz.
    const r = berechneSpesen(spanne('2026-08-04', 1410, '2026-08-06', 20), SAETZE);
    expect(r.tage[0]!.satzCent).toBe(1400);
    expect(r.tage[2]!.satzCent).toBe(1400);
    expect(r.pauschaleCent).toBe(4800);
  });

  test('die Abwesenheit summiert sich über alle Reisetage', () => {
    // 04.08. 08:00 bis 06.08. 18:00 = 16 + 24 + 18 Std.
    const r = berechneSpesen(spanne('2026-08-04', 480, '2026-08-06', 1080), SAETZE);
    expect(r.abwesenheitMin).toBe((1440 - 480) + 1440 + 1080);
  });

  test('über die Monatsgrenze hinweg', () => {
    const r = berechneSpesen(spanne('2026-07-30', 600, '2026-08-02', 900), SAETZE);
    expect(r.tage.map((t) => t.datum)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']);
    expect(r.pauschaleCent).toBe(1400 + 2000 + 2000 + 1400);
  });
});

describe('berechneSpesen — Belege und Sätze', () => {
  test('Belege addieren sich zur Pauschale, ohne sie zu verändern', () => {
    const r = berechneSpesen(spanne('2026-08-04', 480, '2026-08-05', 1080), SAETZE, 8790);
    expect(r.pauschaleCent).toBe(2800);
    expect(r.belegeCent).toBe(8790);
    expect(r.summeCent).toBe(11590);
  });

  test('eine eingefrorene Satztabelle rechnet mit den alten Sätzen weiter', () => {
    const alt: SatzStufe = {ab: '1900-01-01', halbCent: 1200, vollCent: 2400};
    const r = berechneSpesen(spanne('2026-08-04', 420, '2026-08-06', 1200), alt);
    expect(r.pauschaleCent).toBe(1200 + 2400 + 1200);
  });
});

describe('pruefeSpanne', () => {
  test('gültige Spannen gehen durch', () => {
    expect(pruefeSpanne(spanne('2026-08-04', 480, '2026-08-04', 1080))).toBeNull();
    expect(pruefeSpanne(spanne('2026-08-04', 480, '2026-08-09', 60))).toBeNull();
  });

  test('Rückkehr vor Abfahrt wird abgelehnt', () => {
    expect(pruefeSpanne(spanne('2026-08-05', 480, '2026-08-04', 1080))).toBe(
      'Die Rückkehr muss nach der Abfahrt liegen.',
    );
    expect(pruefeSpanne(spanne('2026-08-04', 600, '2026-08-04', 600))).toBe(
      'Die Rückkehr muss nach der Abfahrt liegen.',
    );
  });

  test('unvollständige oder unmögliche Angaben werden benannt', () => {
    expect(pruefeSpanne(spanne('', 480, '2026-08-04', 1080))).toContain('Datum und Uhrzeit');
    expect(pruefeSpanne(spanne('2026-08-04', -1, '2026-08-04', 1080))).toContain('Abfahrt');
    expect(pruefeSpanne(spanne('2026-08-04', 480, '2026-08-04', 1441))).toContain('Rückkehr');
    expect(pruefeSpanne(spanne('2026-08-04', 480, '2026-08-04', 0))).toContain('Rückkehr');
  });

  test('eine unplausibel lange Reise wird abgelehnt statt gerechnet', () => {
    const meldung = pruefeSpanne(spanne('2026-01-01', 480, '2026-12-31', 1080));
    expect(meldung).toBe(`Eine Reise kann höchstens ${MAX_REISETAGE} Tage dauern.`);
  });
});

describe('tageDerReise', () => {
  test('zählt beide Randtage mit', () => {
    expect(tageDerReise(spanne('2026-08-04', 0, '2026-08-06', 60))).toEqual([
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);
  });

  test('ein Tag bleibt ein Tag', () => {
    expect(tageDerReise(spanne('2026-08-04', 0, '2026-08-04', 60))).toEqual(['2026-08-04']);
  });
});

describe('die datierte Satztabelle', () => {
  test('die Stufe entscheidet der Abfahrtstag, nicht der Rückkehrtag', () => {
    // Der Stichtag selbst gehört schon zur neuen Stufe.
    expect(satzFuer(STANDARD_SAETZE, '2025-09-30')).toEqual({ab: '1900-01-01', halbCent: 1400, vollCent: 2800});
    expect(satzFuer(STANDARD_SAETZE, '2025-10-01')).toEqual({ab: '2025-10-01', halbCent: 1000, vollCent: 2000});
  });

  test('eine Reise über den Stichtag rechnet durchgehend mit der Abfahrtsstufe', () => {
    // 30.09. bis 02.10.: alter Satz, weil die Abfahrt davor liegt — sonst
    // wechselte der Satz mitten in derselben Abrechnung.
    const r = berechneSpesen(spanne('2025-09-30', 780, '2025-10-02', 960), STANDARD_SAETZE);
    expect(r.stufe.halbCent).toBe(1400);
    expect(r.pauschaleCent).toBe(1400 + 2800 + 1400);
  });

  test('vor der ersten Stufe gilt die früheste, statt gar keine', () => {
    expect(satzFuer([{ab: '2025-10-01', halbCent: 1000, vollCent: 2000}], '2020-01-01').halbCent).toBe(1000);
  });

  test('die Tabelle wird unabhängig von ihrer Reihenfolge ausgewertet', () => {
    const unsortiert = [...STANDARD_SAETZE].reverse();
    expect(satzFuer(unsortiert, '2026-02-10').halbCent).toBe(1000);
  });
});

describe('Echtdaten aus der bisherigen Abrechnung', () => {
  // Jede Zeile ist ein tatsächlich abgerechneter Fall. Sie halten die Regel
  // fest, dass je Kalendertag gerechnet wird: die Gesamtstundenzahl taucht in
  // keiner dieser Erwartungen auf, sobald die Reise über Mitternacht geht.
  const faelle: Array<[string, ReiseSpanne, number]> = [
    ['27.08.2025 12:00 – 28.08.2025 21:00 → 2 Tage', spanne('2025-08-27', 720, '2025-08-28', 1260), 2800],
    ['04.09.2025 07:00 – 16:40 → 1 Tag ab 8 Std.', spanne('2025-09-04', 420, '2025-09-04', 1000), 1400],
    ['01.10.2025 13:00 – 03.10.2025 16:00 → 3 Tage, neuer Satz', spanne('2025-10-01', 780, '2025-10-03', 960), 4000],
    ['08.12.2025 12:00 – 11.12.2025 14:30 → 4 Tage', spanne('2025-12-08', 720, '2025-12-11', 870), 6000],
    ['10.02.2026 06:40 – 17:00 → 1 Tag ab 8 Std.', spanne('2026-02-10', 400, '2026-02-10', 1020), 1000],
    ['24.03.2026 13:00 – 27.03.2026 16:30 → 4 Tage', spanne('2026-03-24', 780, '2026-03-27', 990), 6000],
  ];
  for (const [name, s, erwartet] of faelle) {
    test(name, () => {
      expect(berechneSpesen(s, STANDARD_SAETZE).pauschaleCent).toBe(erwartet);
    });
  }

  test('die Stundenzahl ist bei mehrtägigen Reisen ohne Bedeutung', () => {
    // 50 Std. und 58,5 Std. über je drei Kalendertage ergeben denselben Betrag.
    const kurz = berechneSpesen(spanne('2025-10-01', 780, '2025-10-03', 960), STANDARD_SAETZE);
    const lang = berechneSpesen(spanne('2025-10-01', 420, '2025-10-03', 1230), STANDARD_SAETZE);
    expect(lang.abwesenheitMin).toBeGreaterThan(kurz.abwesenheitMin);
    expect(lang.pauschaleCent).toBe(kurz.pauschaleCent);
  });

  test('eine kurze Nacht über Mitternacht zählt als zwei Tage', () => {
    // 23:00 bis 01:00 = zwei Kalendertage = 2 × halber Satz. Bewusst so
    // festgehalten: die Regel rechnet je Kalendertag, nicht je 24 Stunden.
    const r = berechneSpesen(spanne('2026-02-10', 1380, '2026-02-11', 60), STANDARD_SAETZE);
    expect(r.tage).toHaveLength(2);
    expect(r.pauschaleCent).toBe(2000);
  });
});
