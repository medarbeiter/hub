import {getDb} from './db';

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
