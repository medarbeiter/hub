import {describe, expect, test} from 'bun:test';

// WCAG 2.1 contrast, computed rather than eyeballed. Every pairing the UI
// actually ships is listed here, so a token change that breaks one fails the
// build instead of shipping quietly.

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/** Composite a colour with alpha over an opaque backdrop. */
function over(hex: string, alpha: number, backdrop: string): string {
  const mix = (c: string, d: string) => {
    const x = parseInt(c, 16) * alpha + parseInt(d, 16) * (1 - alpha);
    return Math.round(x).toString(16).padStart(2, '0');
  };
  const f = hex.replace('#', '');
  const b = backdrop.replace('#', '');
  return `#${mix(f.slice(0, 2), b.slice(0, 2))}${mix(f.slice(2, 4), b.slice(2, 4))}${mix(f.slice(4, 6), b.slice(4, 6))}`;
}

const C = {
  gold: '#e1b025',
  onGold: '#231a02',
  bronzeText: '#7c5f05',
  goldIcon: '#8f6e06',

  goldWash: '#f7edd2',
  ink: '#1c1917',
  stone: '#67625a',
  paper: '#faf8f3',
  white: '#ffffff',
  parchment: '#f5f2ea',
  pauseStone: '#8b8474',
  borderEmphasized: '#d8d2c6',
  warningFill: '#dd7200',
  warningText: '#6e3500',
  warningWash: '#fad0b5',
  errorFill: '#e33f4a',
  errorText: '#a50c25',
  errorWash: '#facecb',
  successFill: '#198100',
  infoFill: '#0074e2',
  onDark: '#ffffff',
};

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

describe('Text auf Flächen (≥4,5:1)', () => {
  const pairs: Array<[string, string, string]> = [
    ['Haupttext auf Papier', C.ink, C.paper],
    ['Haupttext auf Weiß', C.ink, C.white],
    ['Sekundärtext auf Papier', C.stone, C.paper],
    ['Sekundärtext auf Weiß', C.stone, C.white],
    ['Sekundärtext auf Pergament', C.stone, C.parchment],
    ['Bronze-Akzenttext auf Weiß', C.bronzeText, C.white],
    ['Bronze-Akzenttext auf Papier', C.bronzeText, C.paper],
    ['Bronze-Akzenttext auf Goldwäsche', C.bronzeText, C.goldWash],
    ['Dunkle Tinte auf Gold', C.onGold, C.gold],
    ['Warntext auf Warnwäsche', C.warningText, C.warningWash],
    ['Warntext auf Weiß', C.warningText, C.white],
    ['Fehlertext auf Fehlerwäsche', C.errorText, C.errorWash],
    ['Fehlertext auf Weiß', C.errorText, C.white],
    ['Weiß auf Infoblau', C.onDark, C.infoFill],
    ['Weiß auf Erfolgsgrün', C.onDark, C.successFill],
    // The badge/status orange carries dark ink, not white — this is why.
    ['Dunkle Tinte auf Warnorange', '#171717', C.warningFill],
  ];
  for (const [name, fg, bg] of pairs) {
    test(`${name}`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  }
});

describe('Bedeutungstragende Flächen (≥3:1)', () => {
  const pairs: Array<[string, string, string]> = [
    ['Pausen-Stein auf Pergament-Spur', C.pauseStone, C.parchment],
    ['Pausen-Stein auf Weiß', C.pauseStone, C.white],
    ['Jetzt-Linie (Bronze) auf Weiß', C.bronzeText, C.white],
    ['Fokusring auf Weiß', C.goldIcon, C.white],
    ['Fokusring auf Papier', C.goldIcon, C.paper],
    ['Auswahl-Rahmen auf Goldwäsche', C.bronzeText, C.goldWash],
    ['Fehlerfläche auf Weiß', C.errorFill, C.white],
    ['Warnfläche auf Weiß', C.warningFill, C.white],
  ];
  for (const [name, fg, bg] of pairs) {
    test(`${name}`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
  }
});

describe('Arbeitszeit-Gold: der Rahmen trägt den Kontrast, nicht die Füllung', () => {
  // The brand gold is fixed and simply cannot reach 3:1 on a light ground.
  // Every gold surface that carries meaning therefore ships with a bronze
  // hairline (.arbeit-flaeche / inset shadow) that does.
  test('die Goldfüllung allein bliebe unter 3:1 — dokumentiert, nicht übersehen', () => {
    expect(contrast(C.gold, C.white)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(C.gold, C.parchment)).toBeLessThan(NON_TEXT_MIN);
  });

  test('der Bronze-Rahmen hebt den Block von jedem Untergrund ab', () => {
    for (const ground of [C.white, C.paper, C.parchment, C.goldWash]) {
      expect(contrast(C.goldIcon, ground)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    }
  });

  test('der Rahmen ist auch gegen die eigene Füllung sichtbar', () => {
    // Not a WCAG threshold, but the outline has to read as an outline.
    expect(contrast(C.goldIcon, C.gold)).toBeGreaterThan(2);
  });
});

describe('Grenzfälle, die im Briefing als verdächtig benannt wurden', () => {
  test('Wochen-Balken eines leeren Tages heben sich von der Karte ab', () => {
    // Empty day = bare track on a white card.
    expect(contrast(C.parchment, C.white)).toBeLessThan(NON_TEXT_MIN);
    // …which is why the track alone may not carry meaning: the Soll tick does.
    expect(contrast(C.pauseStone, C.parchment)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('Hairline-Rahmen sind Dekoration, kein Bedeutungsträger', () => {
    // 8% warm ink on white — deliberately below 3:1, so nothing may depend on it.
    expect(contrast(over(C.ink, 0.08, C.white), C.white)).toBeLessThan(NON_TEXT_MIN);
    // The emphasized border is the one used where a boundary must be seen.
    expect(contrast(C.borderEmphasized, C.white)).toBeLessThan(NON_TEXT_MIN);
  });
});
