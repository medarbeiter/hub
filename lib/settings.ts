import {getDb} from './db';
import {STANDARD_SAETZE, type SatzStufe} from './pauschale';

// Defaults apply when no row exists — a fresh install needs no seeding.
const DEFAULTS = {
  // Stempellücken unterhalb dieser Minutenzahl gelten als Fehlbedienung und
  // werden beim erneuten Einstempeln in den vorherigen Eintrag zusammengeführt.
  merge_window_min: '2',
  // Uhrzeit (Minuten ab Mitternacht), zu der vergessene offene Einträge
  // vorläufig geschlossen werden. Leer = deaktiviert.
  auto_close_cutoff_min: '',
  // Bundesland für die Feiertagsberechnung; je Mitarbeiter überschreibbar.
  // Leer = keine Feiertage berechnen (lieber nichts als das falsche Land).
  bundesland: '',
  // Ab wie vielen gleichzeitig Abwesenden die Belegungskurve im Teamkalender
  // warnt. Leer = keine Grenze; eine Zahl, die niemand gesetzt hat, darf nicht
  // warnen — wie viele gleichzeitig zu viele sind, weiß nur der Betrieb.
  belegung_grenze: '',
  // Ob überhaupt Nachrichten hinausgehen. Aus heißt: alles läuft wie bisher,
  // nur ohne Post — nichts hängt davon ab, nichts scheitert daran.
  mail_aktiv: 'ja',
  // Der Absender, wie ihn Resend verlangt: „Name <adresse@domain>".
  //
  // Die Vorgabe ist die Hausadresse, nicht Resends Testadresse: dies ist die
  // Zeiterfassung *eines* Unternehmens, und eine Vorgabe, die im Betrieb
  // ohnehin sofort geändert werden müsste, ist keine. Voraussetzung ist, dass
  // hub.med-arbeiter.de bei Resend verifiziert ist (DNS-Einträge, siehe
  // README) — sonst weist Resend jeden Versand ab, und das steht dann als
  // Fehler im Versandbuch statt still zu verschwinden.
  //
  // Absichtlich die Subdomain und nicht med-arbeiter.de: die Zustellbarkeit
  // der Hauspost hängt so nicht daran, wie diese Anwendung sich verhält.
  mail_absender: 'MedArbeiter Hub <zeit@hub.med-arbeiter.de>',
  // Verpflegungspauschale als datierte Satztabelle (JSON), in Cent. Datiert,
  // weil die Sätze sich bereits einmal geändert haben: bis 30.09.2025 galten
  // 14/28 €, ab 01.10.2025 gelten 10/20 €. Leer = die eingebaute Tabelle.
  spesen_saetze: '',
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export function getSetting(key: SettingKey): string {
  const row = getDb()
    .query<{value: string}, [string]>('SELECT value FROM settings WHERE key = ?')
    .get(key);
  return row?.value ?? DEFAULTS[key];
}

export function setSetting(key: SettingKey, value: string): void {
  getDb()
    .query(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(key, value);
}

export function mergeWindowMin(): number {
  const n = Number(getSetting('merge_window_min'));
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

export function autoCloseCutoffMin(): number | null {
  const raw = getSetting('auto_close_cutoff_min');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n < 1440 ? n : null;
}

/**
 * Die Belastungsgrenze des Teamkalenders. Null heißt „nicht eingestellt", und
 * dann zeichnet die Kurve auch keine Linie: eine erfundene Grenze wäre eine
 * Warnung, für die niemand einstehen kann.
 */
export function belegungGrenze(): number | null {
  const roh = getSetting('belegung_grenze');
  if (roh.trim() === '') return null;
  const n = Number(roh);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Ob der E-Mail-Versand eingeschaltet ist. Ohne `RESEND_API_KEY` bleibt es ohnehin bei der Konsole. */
export function mailAktiv(): boolean {
  return getSetting('mail_aktiv') !== 'nein';
}

/**
 * Der Absender. Fällt auf die Vorgabe zurück, sobald das Feld leer oder
 * offensichtlich unbrauchbar ist: ein Absender ohne @ macht aus jedem Versand
 * einen Fehler, und eine leere Einstellung darf keine Post verschlucken.
 */
export function absenderAdresse(): string {
  const roh = getSetting('mail_absender').trim();
  return roh.includes('@') ? roh : DEFAULTS.mail_absender;
}

/**
 * Die Satztabelle. Wie jeder andere Wert hier wird sie beim Lesen neu geprüft
 * und fällt bei Unsinn auf die eingebaute Tabelle zurück — eine kaputte
 * Einstellung darf keine Abrechnung erfinden.
 */
export function spesenSaetze(): SatzStufe[] {
  const roh = getSetting('spesen_saetze');
  if (roh.trim() === '') return STANDARD_SAETZE;
  try {
    const geparst: unknown = JSON.parse(roh);
    if (!Array.isArray(geparst)) return STANDARD_SAETZE;
    const stufen = geparst.filter(istStufe);
    return stufen.length > 0 ? stufen.sort((a, b) => a.ab.localeCompare(b.ab)) : STANDARD_SAETZE;
  } catch {
    return STANDARD_SAETZE;
  }
}

function istStufe(value: unknown): value is SatzStufe {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ab === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.ab) &&
    Number.isInteger(v.halbCent) &&
    (v.halbCent as number) >= 0 &&
    Number.isInteger(v.vollCent) &&
    (v.vollCent as number) >= 0
  );
}

export function setSpesenSaetze(stufen: SatzStufe[]): void {
  setSetting('spesen_saetze', JSON.stringify(stufen));
}
