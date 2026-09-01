/**
 * Die eigenen Rechte — der Datensatz (DB-gebunden).
 *
 * Ein eigenes Recht ist eine Zeile in `eigene_rechte` (Migration 32): ein
 * Schlüssel, den eine angebundene App prüft (`rechte.includes('…')` in ihrer
 * userinfo-Antwort), plus deutsches Etikett, Beschreibung, Bereich und Stufe
 * für die Formulare. Der Hub selbst prüft eigene Rechte nie — seine eigenen
 * Handlungen tragen eingebaute Rechte (lib/rechte.ts); hier steht, was für
 * Apps wie medarbeiterAI vergeben wird, ohne dass ein Deployment nötig wäre.
 *
 * Gepflegt unter dem Recht `rechte.verwalten`. Der Schlüssel ist der Vertrag
 * mit der App und darum unveränderlich; Etikett, Beschreibung, Bereich und
 * Stufe sind Anzeige und frei änderbar. Löschen entfernt die Zusatzrechte
 * der Konten mit; aus Rollenbündeln fällt der tote Schlüssel beim Lesen
 * (rechteAus) und beim nächsten Speichern (mischeRechte) von selbst.
 */
import {getDb, type User} from './db';
import {
  hatRecht,
  istRecht,
  rechtEintraege,
  KONKRETE_RECHTE,
  type RechtEintrag,
  type RechtStufe,
} from './rechte';

interface EigenesRechtZeile {
  schluessel: string;
  label: string;
  beschreibung: string;
  bereich: string;
  stufe: RechtStufe;
}

export function eigeneRechte(): RechtEintrag[] {
  return getDb()
    .query<EigenesRechtZeile, []>(
      'SELECT schluessel, label, beschreibung, bereich, stufe FROM eigene_rechte ORDER BY bereich COLLATE NOCASE, schluessel',
    )
    .all();
}

/** Nur die Schlüssel — das `zusatz`-Argument von vereinigeRechte()/mischeRechte(). */
export function eigeneSchluessel(): string[] {
  return getDb()
    .query<{schluessel: string}, []>('SELECT schluessel FROM eigene_rechte ORDER BY bereich COLLATE NOCASE, schluessel')
    .all()
    .map((z) => z.schluessel);
}

/** Eingebaut oder eigen — der Filter für alles, was als Recht hereingereicht wird. */
export function istBekanntesRecht(schluessel: string): boolean {
  if (istRecht(schluessel)) return true;
  return getDb().query('SELECT 1 FROM eigene_rechte WHERE schluessel = ?').get(schluessel) !== null;
}

/** Eingebautes und eigenes Vokabular in einer Liste — was die Formulare bekommen. */
export function gesamtVokabular(): RechtEintrag[] {
  return [...rechtEintraege(), ...eigeneRechte()];
}

/** Alle konkreten Schlüssel (nie „*") — der Rollen-Katalog für Client-Apps. */
export function alleKonkretenSchluessel(): string[] {
  return [...KONKRETE_RECHTE, ...eigeneSchluessel()];
}

/** Deutsches Etikett; für gelöschte Schlüssel (alte Protokollzeilen) der Schlüssel selbst. */
export function rechtLabel(schluessel: string): string {
  return gesamtVokabular().find((r) => r.schluessel === schluessel)?.label ?? schluessel;
}

export interface EigenesRechtEingabe {
  label: string;
  beschreibung: string;
  bereich: string;
  stufe: string;
}

const SCHLUESSEL_MUSTER = /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/;

function pruefeEingabe(eingabe: EigenesRechtEingabe): string | null {
  if (!eingabe.label.trim()) return 'Bitte einen Namen für das Recht angeben.';
  if (eingabe.label.trim().length > 60) return 'Der Name ist zu lang (höchstens 60 Zeichen).';
  if (!eingabe.bereich.trim()) return 'Bitte einen Bereich angeben — meist der Name der App.';
  if (eingabe.bereich.trim().length > 40) return 'Der Bereich ist zu lang (höchstens 40 Zeichen).';
  if (eingabe.beschreibung.length > 200) return 'Die Beschreibung ist zu lang (höchstens 200 Zeichen).';
  if (!['grundlegend', 'weitreichend', 'kritisch'].includes(eingabe.stufe)) return 'Unbekannte Stufe.';
  return null;
}

export function rechtAnlegen(actor: User, schluessel: string, eingabe: EigenesRechtEingabe): string | null {
  if (!hatRecht(actor, 'rechte.verwalten')) return 'Keine Berechtigung.';
  if (!SCHLUESSEL_MUSTER.test(schluessel) || schluessel.length > 100) {
    return 'Der Schlüssel braucht die Form „app.bereich.aktion": Kleinbuchstaben, Ziffern und Bindestriche, durch Punkte gegliedert.';
  }
  if (istRecht(schluessel)) return 'Diesen Schlüssel trägt bereits ein eingebautes Recht.';
  if (istBekanntesRecht(schluessel)) return 'Ein Recht mit diesem Schlüssel gibt es bereits.';
  const invalid = pruefeEingabe(eingabe);
  if (invalid) return invalid;
  getDb()
    .query('INSERT INTO eigene_rechte (schluessel, label, beschreibung, bereich, stufe) VALUES (?, ?, ?, ?, ?)')
    .run(schluessel, eingabe.label.trim(), eingabe.beschreibung.trim(), eingabe.bereich.trim(), eingabe.stufe);
  return null;
}

export function rechtAendern(actor: User, schluessel: string, eingabe: EigenesRechtEingabe): string | null {
  if (!hatRecht(actor, 'rechte.verwalten')) return 'Keine Berechtigung.';
  if (!getDb().query('SELECT 1 FROM eigene_rechte WHERE schluessel = ?').get(schluessel)) {
    return 'Dieses Recht gibt es nicht.';
  }
  const invalid = pruefeEingabe(eingabe);
  if (invalid) return invalid;
  getDb()
    .query('UPDATE eigene_rechte SET label = ?, beschreibung = ?, bereich = ?, stufe = ? WHERE schluessel = ?')
    .run(eingabe.label.trim(), eingabe.beschreibung.trim(), eingabe.bereich.trim(), eingabe.stufe, schluessel);
  return null;
}

export function rechtLoeschen(actor: User, schluessel: string): string | null {
  if (!hatRecht(actor, 'rechte.verwalten')) return 'Keine Berechtigung.';
  const db = getDb();
  if (!db.query('SELECT 1 FROM eigene_rechte WHERE schluessel = ?').get(schluessel)) {
    return 'Dieses Recht gibt es nicht.';
  }
  db.query('DELETE FROM eigene_rechte WHERE schluessel = ?').run(schluessel);
  // Zusatzrechte zeigen sonst auf einen toten Schlüssel (wie totp_konto_rollen
  // beim Rollenlöschen); Rollenbündel reinigen sich beim Lesen von selbst.
  db.query('DELETE FROM benutzer_rechte WHERE recht = ?').run(schluessel);
  return null;
}
