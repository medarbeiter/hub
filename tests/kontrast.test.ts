import {describe, expect, test} from 'bun:test';
import {MAILFARBEN, TON_FARBEN} from '../emails/farben';

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
  /* Der Stein, mit dem die zweite Handlung im aufgeklappten Eintrag ihre
     Kante zieht. */
  iconStone: '#737373',
  infoFill: '#0074e2',
  onDark: '#ffffff',

  /* Die umgekehrte Fläche der Aufmerksamkeitsmeldung und die drei Töne, die
     darauf stehen. Astryx' `MediaTheme` dreht dort `color-scheme`, also lösen
     sich alle `light-dark()`-Paare dieses Themas auf ihre DUNKLE Seite auf —
     genau diese Werte sind hier eingetragen, nicht die hellen. */
  tinte: '#1c1917',
  tinteText: '#a9a49a',
  tinteAkzent: '#eece6d',
  tinteWarnung: '#ffc9a2',
  tinteFehler: '#ffc6c1',
  tinteErfolg: '#9fe59b',
  tinteZeichen: '#a3a3a3',
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
    // Das Datum in der gezogenen Auswahl des Monatsstapels und im überfahrenen
    // Tagesgriff — dieselbe Sekundärfarbe, zwei neue Gründe.
    ['Sekundärtext auf Goldwäsche (gewählte Tageszeile)', C.stone, C.goldWash],
    ['Sekundärtext auf Pergament (Tagesgriff im Überfahren)', C.stone, C.parchment],
    ['Dunkle Tinte auf Gold', C.onGold, C.gold],
    ['Warntext auf Warnwäsche', C.warningText, C.warningWash],
    ['Warntext auf Weiß', C.warningText, C.white],
    // Die Stempelleiste trägt die Goldwäsche des Kranzes; die ArbZG-Warnung
    // und ein Stempelfehler stehen als Text direkt darauf.
    ['Warntext auf der Goldwäsche der Leiste', C.warningText, C.goldWash],
    ['Fehlertext auf der Goldwäsche der Leiste', C.errorText, C.goldWash],
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
    // Zugangscodes: der Restzeit-Ring neben dem Code. Der Bogen trägt die
    // Bedeutung (Stein, knapp: Warnorange — das Orange deckt „Warnfläche auf
    // Weiß" oben); die Spur darunter ist Zierde und darf der Haarstrich sein.
    ['Code-Ring (Bogen) auf Weiß', C.iconStone, C.white],
    // Reisen & Spesen: die Abwesenheitsspange und die Tageszellen im Reiseband
    // sind steingrau, nicht bronzen — Gold heißt gearbeitete Zeit.
    ['Abwesenheitsspange auf Weiß', C.stone, C.white],
    ['Abwesenheitsspange auf Papier', C.stone, C.paper],
    ['Abwesenheitsspange über der Pergament-Spur', C.stone, C.parchment],
    ['Abwesenheitsspange über einer Goldfläche', C.stone, C.gold],
    ['Reisetag-Zelle (Kante) auf der Pergament-Spur', C.stone, C.parchment],
    ['Jahresbalken (Stein) auf der Pergament-Spur', C.stone, C.parchment],
    // Abwesenheit: dieselbe Sprache wie beim Reiseband, aus demselben Grund —
    // eine Abwesenheit ist keine gearbeitete Zeit, also trägt sie kein Gold.
    // Der Tag mit Soll steht als volle Kante, der ohne als gestrichelte; beide
    // Male trägt die Kante die Bedeutung und nicht die Füllung.
    ['Abwesenheitszelle (Kante) auf der Pergament-Spur', C.stone, C.parchment],
    ['Abwesenheitszelle (Kante) auf Weiß', C.stone, C.white],
    // Die Tagesfelder im Abwesenheits-Editor: gestrichelt heißt „zählt nicht".
    ['Tagesfeld (Kante) auf Weiß', C.stone, C.white],
    // Der gezogene Tagesgriff im Monatsstapel färbt seine Zeile golden ein;
    // der Aufklapppfeil und die Tagesart-Zeichen liegen dann darauf.
    ['Tagesgriff-Auswahl: Zeichen auf Goldwäsche', C.goldIcon, C.goldWash],
    ['Tagesgriff im Überfahren: Zeichen auf Pergament', C.goldIcon, C.parchment],
    // Der aufgeklappte Navigationseintrag: seine beiden Schaltflächen stehen
    // auf dem Papier der Seitenleiste. Weder Astryx' getönte `secondary`-
    // Füllung noch das Markengold erreichen dort allein 3:1 — die Kante trägt
    // die Abgrenzung, nicht die Füllung.
    ['Zweite Handlung (Kante) auf dem Leistenpapier', C.iconStone, C.paper],
    ['Goldene Handlung (Kante) auf dem Leistenpapier', C.goldIcon, C.paper],
    // Der Stempelstand: seit das Wort „Eingestempelt" fort ist (es stand neben
    // einem Knopf mit der Aufschrift „Ausstempeln"), trägt der Punkt den
    // laufenden Zustand selbst und ist damit bedeutungstragend. Der goldene
    // bekommt darum den Haarstrich; der orange Pausenpunkt steht allein.
    // Die Leiste trägt seit dem Kranz die Goldwäsche (auf dem Telefon Weiß) —
    // beide Punkte müssen auf beiden Gründen stehen. Das Warnorange schafft
    // Weiß von selbst (3,24:1), fällt auf der Wäsche aber auf 2,78:1: darum
    // zieht dort der Warntextton die Kante, wie beim goldenen Punkt die Bronze.
    ['Stempelpunkt „läuft" (Kante) auf der Leiste (Telefon, Weiß)', C.goldIcon, C.white],
    ['Stempelpunkt „läuft" (Kante) auf der Goldwäsche der Leiste', C.goldIcon, C.goldWash],
    ['Stempelpunkt „Pause" (Fläche) auf der Leiste (Telefon, Weiß)', C.warningFill, C.white],
    ['Stempelpunkt „Pause" (Kante) auf der Goldwäsche der Leiste', C.warningText, C.goldWash],
    // Die goldene Handlung auf der Goldwäsche: die Füllung erreicht ≈1,7:1 und
    // trägt nichts — der Bronze-Haarstrich tut es (.stempel-leiste-Regel).
    ['Goldene Handlung (Kante) auf der Goldwäsche der Leiste', C.goldIcon, C.goldWash],
    // Der gewählte Navigationseintrag: Goldwäsche mit Bronzekante auf dem
    // Papier der Leiste — die Kante trägt, die Füllung nie (Wäsche auf Papier
    // ≈1,1:1).
    ['Gewählter Navigationseintrag (Kante) auf dem Leistenpapier', C.goldIcon, C.paper],

    // --- Das Monatsgitter ------------------------------------------------
    // Es löst vier Bänder ab und erbt deren zwei Kanäle unverändert: die
    // Kante der Marke sagt „steht fest", ihre Füllung „kostet etwas". Die
    // Zelle steht auf Weiß, ein Ruhetag auf Papier, der offene Tag auf der
    // Goldwäsche — die Marke muss auf allen dreien den Boden schaffen.
    ['Gittermarke (Kante) auf einer weißen Zelle', C.stone, C.white],
    ['Gittermarke (Kante) auf einem Ruhetag', C.stone, C.paper],
    ['Gittermarke (Kante) auf dem offenen Tag', C.stone, C.goldWash],
    ['Gitterstein (ohne Art) auf einer weißen Zelle', C.stone, C.white],
    // Der Heute-Ring und der Rahmen des offenen Tages sind bronzen wie jede
    // andere Stelle, an der diese Anwendung „jetzt" oder „hier" sagt.
    ['Heute-Ring der Zelle auf Weiß', C.goldIcon, C.white],
    ['Heute-Ring der Zelle auf einem Ruhetag', C.goldIcon, C.paper],
    ['Rahmen des offenen Tages auf der Goldwäsche', C.goldIcon, C.goldWash],

    // --- Belegungskurve, Wochenraster, Spannenstreifen ---------------------
    // Die Kurve zählt, wie viele gleichzeitig weg sind; über der Grenze
    // wechselt sie ins Orange. Gelb wäre hier verboten — es imitierte die
    // Marke.
    ['Belegungssäule (Stein) auf Weiß', C.stone, C.white],
    ['Belegungssäule über der Grenze (Orange) auf Weiß', C.warningFill, C.white],
    // Das Wochenraster ersetzt die 365-Tage-Bahn. Seine Rampe ist *ein* Stein
    // in vier Helligkeiten — dieselbe Zwei-Steine-Regel wie im Protokollband.
    // Geprüft wird die oberste Stufe (die volle Woche) und die gestrichelte
    // Kante des beantragten Zustands; die unteren Stufen sind ausdrücklich
    // Hintergrundgewicht und stehen nie allein für eine Aussage.
    ['Wochenraster: volle Woche auf der Pergament-Spur', C.stone, C.parchment],
    ['Wochenraster: beantragt (Kante) auf der Pergament-Spur', C.stone, C.parchment],
    ['Wochenraster: laufende Woche (Bronzering) auf der Pergament-Spur', C.goldIcon, C.parchment],
    // Der Spannenstreifen in der Belegspalte: dieselben zwei Kanäle, kleiner.
    ['Spannenzelle (Kante) auf Weiß', C.stone, C.white],
    ['Spannenzelle (Kante) auf der Goldwäsche der offenen Zeile', C.stone, C.goldWash],
  ];
  for (const [name, fg, bg] of pairs) {
    test(`${name}`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
  }
});

describe('Sinnbilder: jedes Zeichen ist eine nicht-textliche Fläche (≥3:1)', () => {
  // Die Zeichen tragen nie allein eine Aussage — die Beschriftung steht immer
  // daneben. Sie sind trotzdem bedeutungstragende grafische Objekte und müssen
  // den Nicht-Text-Boden auf jedem Grund schaffen, auf dem sie vorkommen.
  // `sekundaer` ist der Regelton, `akzent` der Bronzeton, dazu die beiden
  // Statustöne aus components/sinnbilder.tsx. Jeder Ton, den das Vokabular
  // anbietet, steht hier — und jeder, der hier steht, wird auch benutzt.
  const iconSecondary = '#737373';
  const grounds: Array<[string, string]> = [
    ['Weiß', C.white],
    ['Papier', C.paper],
    ['Pergament', C.parchment],
    // Die aufgeklappte Bahn und die gewählte Reisezeile liegen auf der
    // Goldwäsche — dort sitzen Aufklapppfeil und Tagesart-Zeichen.
    ['Goldwäsche', C.goldWash],
  ];
  const tones: Array<[string, string]> = [
    ['Sekundärzeichen', iconSecondary],
    ['Akzentzeichen (Bronze)', C.goldIcon],
    ['Warnzeichen', C.warningText],
    ['Fehlerzeichen', C.errorText],
  ];
  for (const [toneName, fg] of tones) {
    for (const [groundName, bg] of grounds) {
      test(`${toneName} auf ${groundName}`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
      });
    }
  }

  // Zeichen in einer Schaltfläche erben deren Tinte (`ton="erben"`), damit die
  // Dunkle-Tinte-auf-Gold-Regel automatisch gilt statt an jeder Aufrufstelle
  // wiederholt zu werden. Das ist die Rechnung dazu.
  test('Geerbte Tinte auf dem goldenen Primärknopf', () => {
    expect(contrast(C.onGold, C.gold)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });
});

describe('Spesen sind kein Gold', () => {
  // Die Regel als Rechnung: die Abwesenheitsspange muss den Nicht-Text-Boden
  // aus eigener Kraft schaffen, damit sie — anders als eine Goldfläche — ohne
  // zusätzliche Haarlinie auskommt.
  test('Stein trägt den Kontrast ohne Hilfslinie, Gold könnte es nicht', () => {
    expect(contrast(C.stone, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.gold, C.white)).toBeLessThan(NON_TEXT_MIN);
  });

  // Die gestrichelte Verlängerung zur 8-Stunden-Schwelle zeigt, was gefehlt
  // hat. Sie läuft auf voller Deckkraft: bei 50 % läge sie unter dem Boden —
  // genau der Fehler, den der Plan-Geist schon einmal gemacht hat.
  test('die Schwellen-Strichelung läuft auf voller Deckkraft', () => {
    expect(contrast(C.stone, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(over(C.stone, 0.5, C.white), C.white)).toBeLessThan(NON_TEXT_MIN);
  });

  // Die weiße Füllung einer verdienenden Reisetag-Zelle ist Dekoration: gegen
  // die Pergament-Spur erreicht sie nichts. Die steingraue Kante trägt die
  // Bedeutung — dieselbe Regel wie bei der Goldfläche.
  test('die Zellfüllung allein trägt nichts — die Kante tut es', () => {
    expect(contrast(C.white, C.parchment)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(C.stone, C.parchment)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.stone, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });
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

/** Plain sRGB channel mix — what CSS color-mix(in srgb, …) does. */
function mix(a: string, b: string, ratioA: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.replace('#', '').slice(i * 2, i * 2 + 2), 16);
  const out = [0, 1, 2].map((i) =>
    Math.round(ch(a, i) * ratioA + ch(b, i) * (1 - ratioA))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}

describe('Kopfband: die eine bewusste Ausnahme von der Gold-ist-Arbeit-Regel', () => {
  // The header band fades accent-muted into the paper body. It carries no
  // meaning, but text sits on it, so every stop has to clear the text floor.
  const stops = [
    ['oben (volle Goldwäsche)', C.goldWash],
    ['Mitte (30 % Goldwäsche auf Papier)', mix(C.goldWash, C.paper, 0.3)],
    ['unten (Papier)', C.paper],
  ] as const;

  for (const [name, bg] of stops) {
    test(`Haupttext auf dem Kopfband – ${name}`, () => {
      expect(contrast(C.ink, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
    test(`Sekundärtext auf dem Kopfband – ${name}`, () => {
      expect(contrast(C.stone, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
    test(`Akzenttext (aktiver Reiter) auf dem Kopfband – ${name}`, () => {
      expect(contrast(C.bronzeText, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  }

  test('der Fokusring bleibt auf dem Kopfband sichtbar', () => {
    for (const [, bg] of stops) {
      expect(contrast(C.goldIcon, bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    }
  });
});

describe('Tagesbahn: geplante Tage, Jetzt-Pille, Stundenraster', () => {
  test('die gestrichelte Plan-Kante hebt sich von der Spur ab', () => {
    // The dashed bronze edge is the only thing identifying a planned day, so it
    // is never faded. Fading it to 70 % measured 2.59:1 — that is why it isn't.
    expect(contrast(C.goldIcon, C.parchment)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(over(C.goldIcon, 0.7, C.parchment), C.parchment)).toBeLessThan(NON_TEXT_MIN);
  });

  test('die Plan-Füllung allein trägt keine Bedeutung', () => {
    expect(contrast(C.goldWash, C.parchment)).toBeLessThan(NON_TEXT_MIN);
  });

  test('die Jetzt-Pille: Flächenfarbe gegen ihre Schrift', () => {
    expect(contrast(C.white, C.bronzeText)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('das Stundenraster im Goldblock ist Dekoration, kein Bedeutungsträger', () => {
    // 26 % white on gold: readable as a rhythm, deliberately not as an outline —
    // nothing may depend on seeing it.
    const rule = over(C.white, 0.26, C.gold);
    expect(contrast(rule, C.gold)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(rule, C.gold)).toBeGreaterThan(1.1);
  });
});

describe('Kontoverlauf: die Pole der divergierenden Balken', () => {
  for (const ground of [C.white, C.paper] as const) {
    test(`Bronze-Balken (Guthaben) auf ${ground}`, () => {
      expect(contrast(C.goldIcon, ground)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
    test(`Roter Balken (Minus) auf ${ground}`, () => {
      expect(contrast(C.errorFill, ground)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
  }
});

describe('Teamkalender: Abwesenheit trägt Stein, nicht Gold', () => {
  // Dieselbe Regel wie beim Reiseband: eine Abwesenheit ist keine gearbeitete
  // Zeit. Die Kante trägt die Bedeutung — durchgezogen heißt „steht fest",
  // gestrichelt „beantragt" — und muss das auf jedem der drei Gründe tun, über
  // die eine Bahn läuft: der Spur, dem hinterlegten Ruhetag und dem Papier.
  for (const [name, ground] of [
    ['der Spur', C.parchment],
    ['dem hinterlegten Ruhetag', C.paper],
    ['der weißen Füllung', C.white],
  ] as const) {
    test(`Abwesenheitsbalken (Kante) auf ${name}`, () => {
      expect(contrast(C.stone, ground)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });
  }

  test('die Jetzt-Linie steht auf jedem Grund des Bandes', () => {
    for (const ground of [C.white, C.paper, C.parchment, C.goldWash]) {
      expect(contrast(C.bronzeText, ground)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    }
  });

  test('die eigene Zeile: Name und Zeichen auf der Goldwäsche', () => {
    expect(contrast(C.ink, C.goldWash)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(C.stone, C.goldWash)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('der hinterlegte Ruhetag ist eine Lesehilfe, kein Bedeutungsträger', () => {
    // Papier auf der Pergament-Spur liegt bewusst unter dem Boden: wer die
    // Hinterlegung nicht sieht, verliert nichts — die Tageszahl steht auf der
    // Achse und das Wochenende kostet ohnehin keinen Anspruch.
    expect(contrast(C.paper, C.parchment)).toBeLessThan(NON_TEXT_MIN);
  });
});

describe('Protokollband: zwei Steine statt zweier Farben', () => {
  // Markengold heißt gearbeitete Zeit und Hauptschaltfläche; ein
  // Protokolleintrag ist weder das eine noch das andere. Also trennt die
  // Helligkeit zweier Steine die beiden Sorten — und beide müssen den
  // Nicht-Text-Boden aus eigener Kraft schaffen.
  test('der Eingriff-Stein steht auf Weiß und auf Papier', () => {
    expect(contrast(C.stone, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.stone, C.paper)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('der Routine-Stein steht auf Weiß und auf Papier', () => {
    expect(contrast(C.pauseStone, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.pauseStone, C.paper)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('die abgewiesene Handlung steht rot auf Weiß', () => {
    expect(contrast(C.errorFill, C.white)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('die beiden Steine sind voneinander unterscheidbar', () => {
    // Kein WCAG-Schwellenwert — aber die Legende benennt zwei Dinge, und wer
    // sie nicht auseinanderhalten kann, liest die Säule falsch.
    expect(contrast(C.stone, C.pauseStone)).toBeGreaterThan(1.5);
  });

  test('die gewählte Säule: Goldwäsche mit bronzener Kante', () => {
    // Die Auswahl färbt den Grund hinter der Säule. Die Füllung allein trägt
    // dort nichts — wie überall in diesem Haus trägt die Kante.
    expect(contrast(C.goldWash, C.white)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(C.goldIcon, C.goldWash)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    // Und die Säulen selbst bleiben auf der Auswahl lesbar.
    expect(contrast(C.stone, C.goldWash)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.pauseStone, C.goldWash)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('das Siegel: Festbreitenschrift auf der Pergamentfläche', () => {
    expect(contrast(C.stone, C.parchment)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

describe('Meldungen (components/melde.tsx): der eine umgekehrte Grund im Haus', () => {
  // Jede Meldung — Korrekturliste, ArbZG-Hinweis, Stempelfehler, Ausstempel-
  // Bestätigung — steht auf derselben Tinte des Themas statt auf seinem
  // Papier, die einzige Fläche der Anwendung, die das tut. Kein Ton darauf ist
  // von Hand gesetzt; jeder ist die dunkle Hälfte eines Paares, das anderswo
  // seine helle Hälfte zeigt. Umso wichtiger, dass die Rechnung dafür steht.
  test('Titelzeile (Weiß) auf der Tinte', () => {
    expect(contrast(C.onDark, C.tinte)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('Meldungszeile (Sekundärton) auf der Tinte', () => {
    expect(contrast(C.tinteText, C.tinte)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('Datumsverweis (Akzentton) auf der Tinte', () => {
    expect(contrast(C.tinteAkzent, C.tinte)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('Warnzeichen und Sekundärzeichen auf der Tinte', () => {
    expect(contrast(C.tinteWarnung, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(contrast(C.tinteAkzent, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    // Das Kreuz zum Wegklicken — ohne das die Meldung nicht wegginge.
    expect(contrast(C.tinteZeichen, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  // Die beiden Töne, die erst mit `components/melde.tsx` auf diese Fläche
  // kommen: der Stempelfehler (fehler) und die Ausstempel-Bestätigung
  // (erfolg). Dieselbe Rechnung wie beim Warnton — die dunkle Hälfte des
  // Paares aus theme/medarbeiterTheme.ts, hier ausdrücklich in
  // `onDark.tokens` benannt, weil die Fläche sich sonst nicht von selbst
  // umdreht (siehe der Kommentar dort).
  test('Fehlerzeichen und Fehlertitel auf der Tinte', () => {
    expect(contrast(C.tinteFehler, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('Erfolgszeichen auf der Tinte', () => {
    expect(contrast(C.tinteErfolg, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  test('„Jetzt korrigieren": die Kante trägt, nicht die Füllung', () => {
    // Astryx' getönte `secondary`-Füllung ist auf der umgekehrten Fläche Weiß
    // bei 10 % — gegen ihren eigenen Grund bleibt sie weit unter dem Boden.
    // Dieselbe Rechnung wie beim aufgeklappten Navigationseintrag, nur mit
    // umgekehrten Vorzeichen; die steingraue Kante ist die Antwort.
    expect(contrast(over(C.onDark, 0.1, C.tinte), C.tinte)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(C.tinteZeichen, C.tinte)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    // Und die Beschriftung steht auf der Füllung, nicht auf der blanken Tinte.
    expect(contrast(C.onDark, over(C.onDark, 0.1, C.tinte))).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('die Tinte ist die des Hauses, nicht Astryx’ Blauschwarz', () => {
    // Ein warmer Grund unter warmem Text: hätte die Fläche die Vorgabe
    // #0A1317 behalten, wäre sie der einzige kalte Ton der Anwendung.
    expect(C.tinte).toBe('#1c1917');
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

// ---------------------------------------------------------------------------
// Der Posteingang
// ---------------------------------------------------------------------------
//
// Eine E-Mail hat kein `:root`: `emails/farben.ts` hält deshalb Kopien der
// Token als Hex. Zwei Dinge werden hier geprüft, und beide sind nötig.
//
//   1. **Die Kopie ist noch dieselbe.** Driftet ein Token im Theme, ohne dass
//      jemand die Kopie nachzieht, trüge die Post die Farben von gestern —
//      und niemand sähe es, weil im Browser nichts anders aussähe.
//   2. **Die Paarungen tragen.** Dieselben Böden wie überall sonst; ein
//      Postfach ist keine Ausnahme von der Lesbarkeit.

describe('E-Mail: die eingefrorenen Hausfarben', () => {
  test('die Kopie in emails/farben.ts stimmt mit dem Theme überein', () => {
    expect(C.gold).toBe(MAILFARBEN.gold);
    expect(C.onGold).toBe(MAILFARBEN.aufGold);
    expect(C.bronzeText).toBe(MAILFARBEN.bronze);
    expect(C.goldWash).toBe(MAILFARBEN.goldWaesche);
    expect(C.ink).toBe(MAILFARBEN.ink);
    expect(C.stone).toBe(MAILFARBEN.stein);
    expect(C.paper).toBe(MAILFARBEN.papier);
    expect(C.white).toBe(MAILFARBEN.weiss);
    expect(C.parchment).toBe(MAILFARBEN.pergament);
    expect(C.borderEmphasized).toBe(MAILFARBEN.kante);
    expect(C.warningText).toBe(MAILFARBEN.warnung);
    expect(C.warningWash).toBe(MAILFARBEN.warnungWaesche);
    expect(C.warningFill).toBe(MAILFARBEN.warnungFuellung);
    expect(C.errorText).toBe(MAILFARBEN.fehler);
    expect(C.errorWash).toBe(MAILFARBEN.fehlerWaesche);
    expect(C.errorFill).toBe(MAILFARBEN.fehlerFuellung);
    expect(C.successFill).toBe(MAILFARBEN.erfolgFuellung);
  });

  const texte: Array<[string, string, string]> = [
    ['Nachrichtentext auf Weiß', MAILFARBEN.ink, MAILFARBEN.weiss],
    ['Beschriftung der Angaben auf Pergament', MAILFARBEN.stein, MAILFARBEN.pergament],
    ['Wert der Angaben auf Pergament', MAILFARBEN.ink, MAILFARBEN.pergament],
    ['Kopfzeile „MedArbeiter Hub" auf der Goldwäsche', MAILFARBEN.bronze, MAILFARBEN.goldWaesche],
    ['Knopfbeschriftung auf Gold', MAILFARBEN.aufGold, MAILFARBEN.gold],
    ['Fußzeile auf Papier', MAILFARBEN.stein, MAILFARBEN.papier],
    ['Abbestell-Verweis auf Papier', MAILFARBEN.bronze, MAILFARBEN.papier],
    // Die Hinweisfläche, je Ton: Überschrift in der Tinte des Tons, Text in
    // der Haustinte. Beide stehen auf der Wäsche desselben Tons.
    ['Hinweisüberschrift „Begründung" auf Warnwäsche', MAILFARBEN.warnung, MAILFARBEN.warnungWaesche],
    ['Hinweistext auf Warnwäsche', MAILFARBEN.ink, MAILFARBEN.warnungWaesche],
    ['Hinweisüberschrift auf Erfolgswäsche', MAILFARBEN.erfolg, MAILFARBEN.erfolgWaesche],
    ['Hinweistext auf Erfolgswäsche', MAILFARBEN.ink, MAILFARBEN.erfolgWaesche],
    ['Hinweisüberschrift auf Fehlerwäsche', MAILFARBEN.fehler, MAILFARBEN.fehlerWaesche],
    ['Startpasswort auf der Goldwäsche', MAILFARBEN.ink, MAILFARBEN.goldWaesche],
  ];
  for (const [name, fg, bg] of texte) {
    test(`Text: ${name}`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  }

  describe('der Tonstreifen über dem Kopf (≥3:1)', () => {
    // Der Streifen ist das einzige, was den Ton einer Nachricht trägt, bevor
    // jemand ein Wort gelesen hat — also bedeutungstragend und nicht Zierde.
    // Er steht auf dem Papier des Postfachs.
    for (const [name, ton] of Object.entries(TON_FARBEN)) {
      test(`Streifen „${name}" auf Papier`, () => {
        if (name === 'hinweis') {
          // Das Markengold schafft auf hellem Grund nie 3:1 — dieselbe
          // Rechnung wie in der Anwendung. Deshalb steht der goldene Streifen
          // direkt über der Goldwäsche des Kopfes, deren Kante er zieht, und
          // trägt keine Bedeutung allein: „Hinweis" ist der Ruhezustand, und
          // ein Ruhezustand muss nicht angekündigt werden.
          expect(contrast(ton.streifen, MAILFARBEN.papier)).toBeLessThan(NON_TEXT_MIN);
          return;
        }
        expect(contrast(ton.streifen, MAILFARBEN.papier)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
      });
    }
  });

  test('der Knopf trägt eine Kante, weil das Gold allein nicht trägt', () => {
    // Die Gold-braucht-eine-Kante-Regel gilt im Postfach genauso: die Füllung
    // auf Weiß bleibt unter dem Boden, die Bronzekante schafft ihn.
    expect(contrast(MAILFARBEN.gold, MAILFARBEN.weiss)).toBeLessThan(NON_TEXT_MIN);
    expect(contrast(MAILFARBEN.bronze, MAILFARBEN.weiss)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });
});
