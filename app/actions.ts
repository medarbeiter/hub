'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {
  createSession,
  destroySession,
  getSessionUser,
  requireAuthenticatedUser,
  requireRecht,
  requireUser,
  verifyLogin,
} from '@/lib/auth';
import {RECHTE, istRecht, type Recht} from '@/lib/rechte';
import {rolleAendern, rolleAnlegen, rolleByKey, rolleLabel, rolleLoeschen} from '@/lib/rollen';
import {
  activeUsers,
  confirmAutoClosed,
  createSegment,
  deleteSegment,
  geplanteSchnitte,
  getUser,
  isMonthLocked,
  lockMonth,
  monthRecord,
  segmentsForDay,
  stamp,
  undoStamp,
  unlockMonth,
  updateSegment,
  validateSegment,
  type SegmentInput,
} from '@/lib/time';
import {fmtDate, fmtDateRange, fmtMonth, fmtTime, monthOf, nowMinutes, parseEuro, todayISO} from '@/lib/format';
import {schnittText} from '@/lib/pausenschnitt';
import {
  darfKommentarLoeschen,
  kommentarById,
  loescheKommentar,
  schreibeKommentar,
} from '@/lib/profil-kommentare';
// Jede Mutation dieser Datei hinterlässt eine Zeile im Protokoll — auch die
// abgewiesene. „Wer hat versucht, den gesperrten Monat zu ändern" ist genau
// die Frage, wegen der es eines gibt. Das Vokabular der Aktionen liegt in
// lib/protokoll.ts; hier wird nur benannt, was gerade geschah.
import {
  beschreibeAbwesenheit,
  beschreibeBeleg,
  beschreibePerson,
  beschreibeReise,
  beschreibeSegment,
  protokolliere,
  protokollPruefen,
  type Kettenbefund,
} from '@/lib/protokoll';
import {
  abbestellteArten,
  createUser,
  eigenesPasswortAendern,
  resetPassword,
  setUserActive,
  updateUser,
  zusatzRechte,
  type UserInput,
} from '@/lib/users';
import {
  absenderAdresse,
  autoCloseCutoffMin,
  belegungGrenze,
  getSetting,
  mailAktiv,
  mergeWindowMin,
  setSetting,
  setSpesenSaetze,
  spesenSaetze,
} from '@/lib/settings';
import type {SatzStufe} from '@/lib/pauschale';
import {setDayType} from '@/lib/daytypes';
import {isBundesland} from '@/lib/feiertage';
import {getDb, type AbwesenheitArt, type BelegArt, type DayTypeKind} from '@/lib/db';
// Die Statusmaschine der Abwesenheit trägt dieselben Verben wie die der Reise.
// Sie werden hier umbenannt statt umbenannt exportiert: in den Domänenmodulen
// heißen sie richtig, und nur diese Datei kennt beide zugleich.
import {
  abwesenheitById,
  anspruchFor,
  createAbwesenheit,
  deleteAbwesenheit,
  einreichen as abwesenheitEinreichen,
  genehmigen as abwesenheitGenehmigen,
  mitTagen,
  setAuDatei,
  setUebertrag,
  speichereAuDatei,
  updateAbwesenheit,
  zurueckweisen as abwesenheitZurueckweisen,
  zurueckziehen as abwesenheitZurueckziehen,
  type AbwesenheitInput,
} from '@/lib/abwesenheit';
import {ABWESENHEIT_ARTEN, ART_LABEL, istAntrag, restanspruch} from '@/lib/abwesenheit-arten';
import {
  BELEG_ARTEN,
  addBeleg,
  createReise,
  deleteBeleg,
  deleteReise,
  eingereichteImMonat,
  einreichen,
  genehmigen,
  mitRechnung,
  reiseById,
  reisenZurPruefung,
  speichereBelegDatei,
  updateReise,
  zurueckweisen,
  zurueckziehen,
  type ReiseInput,
} from '@/lib/spesen';
import {
  einrichtungNeuStarten,
  einrichtungsDaten,
  istStartansicht,
  onboardingAbschliessen,
  onboardingIstFertig,
  persoenlicheEinstellungenSpeichern,
  startPfad,
} from '@/lib/onboarding';
import {avatarLabel, istAvatar} from '@/lib/avatar';
import {setzeProfilbild, speichereAvatarDatei} from '@/lib/profilbild';
import type {EinrichtungsDaten} from '@/lib/onboarding';
import {googleKontoFuer, trenneGoogleKonto} from '@/lib/google';
import {
  oauthClientAendern,
  oauthClientAnlegen,
  oauthClientNachNummer,
  oauthClientSecretErneuern,
  oauthClientSetzeAktiv,
  oauthTokensEntziehen,
  appZugriffBeenden,
  weiterZielGueltig,
} from '@/lib/oauth-apps';
import {otpauthParsen, VERFAHREN_STANDARD} from '@/lib/totp';
import {
  sichtbarkeitText,
  zugangskontoAendern,
  zugangskontoAnlegen,
  zugangskontoById,
  zugangskontoLoeschungAnfordern,
  zugangskontoName,
  type ZugangskontoEingabe,
} from '@/lib/zugangscodes';
import {loescheAlleGoogleEreignisse, syncGoogleAbwesenheiten} from '@/lib/google-kalender';
// Der E-Mail-Versand steht neben dem Kalenderabgleich und trägt dieselbe
// Regel: er läuft *nach* der Buchung, wirft nie und hält nichts auf. Was
// gesagt wird, steht in lib/benachrichtigungen.ts — hier wird nur benannt,
// welches Ereignis gerade eingetreten ist.
import {
  meldeAbwesenheitEingegangen,
  meldeAbwesenheitEntschieden,
  meldeMonatAbgeschlossen,
  meldePasswortZurueckgesetzt,
  meldeReiseEntschieden,
  meldeWillkommen,
  meldeZugangscodeLoeschenBestaetigen,
} from '@/lib/benachrichtigungen';
// Der Prüfkreis bekommt keine Eingangspost mehr; was liegen bleibt, mahnt
// lib/erinnerungen.ts an. Von dort braucht eine Aktion nur das Vergessen:
// wer seinen Antrag zurückzieht, fängt beim erneuten Einreichen von vorn an.
import {vergiss} from '@/lib/erinnerungen';
import {ABWAEHLBARE_ARTEN, istMailArt, mailArtLabel, type MailArt} from '@/lib/mail-arten';

export interface ActionState {
  error: string | null;
}

export interface LoginState extends ActionState {
  einrichtung: EinrichtungsDaten | null;
}

export interface PasswortState extends ActionState {
  gespeichert: boolean;
}

const OK: ActionState = {error: null};

function parseTime(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min <= 1440 ? min : null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return {error: 'Bitte E-Mail und Passwort eingeben.', einrichtung: null};
  const user = await verifyLogin(email, password);
  if (!user) {
    // Die versuchte Adresse wird mitgeschrieben — ohne sie sagt eine Reihe
    // fehlgeschlagener Anmeldungen nichts darüber, ob jemand sein Passwort
    // vergessen hat oder ob ein Konto durchprobiert wird. Gekürzt, weil das
    // Feld aus einem Formular kommt und niemand fremden Text in beliebiger
    // Länge in den Nachweis schreiben können soll.
    protokolliere({
      akteur: null,
      akteurName: email.trim().slice(0, 120) || 'ohne Angabe',
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'Anmeldung an MedArbeiter',
      fehler: 'E-Mail oder Passwort ist falsch.',
    });
    return {error: 'E-Mail oder Passwort ist falsch.', einrichtung: null};
  }
  await createSession(user.id);
  protokolliere({akteur: user, aktion: 'anmelden', gegenstand: 'Anmeldung an MedArbeiter'});
  if (!onboardingIstFertig(user.id)) {
    // Ein etwaiges `weiter` verfällt hier bewußt: erst die Einrichtung. Die
    // anfragende App wiederholt ihre Weiterleitung danach einfach.
    return {error: null, einrichtung: einrichtungsDaten(user)};
  }
  // Rücksprung einer App-Anmeldung — dasselbe feste Präfix wie auf der
  // Anmeldeseite, hier erneut geprüft, weil das Feld aus einem Formular kommt.
  const weiter = String(formData.get('weiter') ?? '');
  redirect(weiterZielGueltig(weiter) ? weiter : startPfad(user.id));
}

export async function eigenesPasswortAendernAction(
  _prev: PasswortState,
  formData: FormData,
): Promise<PasswortState> {
  const user = await requireAuthenticatedUser();
  const passwort = String(formData.get('neuesPasswort') ?? '');
  const wiederholung = String(formData.get('passwortWiederholung') ?? '');
  if (!passwort || !wiederholung) {
    return {error: 'Bitte das neue Passwort zweimal eingeben.', gespeichert: false};
  }
  if (passwort !== wiederholung) {
    return {error: 'Die beiden Passwörter stimmen nicht überein.', gespeichert: false};
  }
  const error = await eigenesPasswortAendern(user.id, passwort);
  protokolliere({
    akteur: user,
    aktion: 'passwort.aendern',
    gegenstand: `Eigenes Passwort von ${user.name} geändert`,
    betroffen: {id: user.id, name: user.name},
    fehler: error,
  });
  return {error, gespeichert: error === null};
}

/**
 * Der simulierte Verbinden-Knopf — nur noch für Entwicklung ohne
 * Google-Zugangsdaten, und nur wenn MOCK_GOOGLE_OAUTH=1 es ausdrücklich
 * erlaubt. Der echte Weg läuft über /api/google/start und /api/google/callback.
 */
export async function googleOauthMockVerbindenAction(
  _prev: PasswortState,
): Promise<PasswortState> {
  const user = await requireAuthenticatedUser();
  if (process.env.MOCK_GOOGLE_OAUTH !== '1') {
    return {error: 'Die simulierte Verknüpfung ist nicht freigeschaltet.', gespeichert: false};
  }
  const result = getDb()
    .query('UPDATE users SET google_einrichtung_abgeschlossen = 1 WHERE id = ? AND active = 1')
    .run(user.id);
  const error = result.changes === 1 ? null : 'Das Mitarbeiterkonto wurde nicht gefunden.';
  protokolliere({
    akteur: user,
    aktion: 'oauth.google-demo-verbinden',
    gegenstand: `Google-Vorschau von ${user.name} verbunden`,
    betroffen: {id: user.id, name: user.name},
    fehler: error,
  });
  return {error, gespeichert: error === null};
}

/**
 * Trennt das eigene Google-Konto: erst werden die von uns angelegten
 * Kalender-Ereignisse abgeräumt (nach dem Widerruf käme kein Aufruf mehr
 * durch), dann Widerruf und Löschung der Tokens.
 */
export async function googleTrennenAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const konto = googleKontoFuer(user.id);
  if (!konto) return {error: 'Es ist kein Google-Konto verbunden.'};
  await loescheAlleGoogleEreignisse(user.id);
  await trenneGoogleKonto(user.id);
  protokolliere({
    akteur: user,
    aktion: 'oauth.google-trennen',
    gegenstand: `Google-Konto von ${user.name} getrennt`,
    betroffen: {id: user.id, name: user.name},
    vorher: {'Google-Konto': konto.google_email},
  });
  revalidatePath('/profil');
  return OK;
}

/**
 * „Zugriff beenden" unter Angemeldete Apps auf /profil: die Person selbst
 * widerruft, was der Hub einer Hausanwendung über ihr Konto herausgibt.
 */
export async function appZugriffBeendenAction(clientNummer: number): Promise<ActionState> {
  const user = await requireUser();
  const app = appZugriffBeenden(user.id, clientNummer);
  if (!app) return {error: 'Diese App-Anmeldung gibt es nicht mehr.'};
  protokolliere({
    akteur: user,
    aktion: 'oauth.app-trennen',
    gegenstand: `Zugriff von ${app.name} auf das eigene Konto beendet`,
  });
  revalidatePath('/profil');
  return OK;
}

export async function logoutAction(formData?: FormData): Promise<void> {
  // Vor dem Zerstören der Sitzung gelesen: danach ist nicht mehr feststellbar,
  // wer sich abgemeldet hat.
  const user = await getSessionUser();
  if (user) protokolliere({akteur: user, aktion: 'abmelden', gegenstand: 'Abmeldung von MedArbeiter'});
  await destroySession();
  // Wer sich aus dem neuen Blatt abmeldet, landet dort wieder — sonst wechselt
  // ein Klick unbemerkt die Oberfläche. Nur diese eine Angabe ist erlaubt,
  // damit das Feld keine offene Weiterleitung wird.
  // Der Kontowechsel auf der Freigabeseite meldet ab, ohne die App-Anmeldung
  // zu verlieren: das geprüfte Rücksprungziel geht als ?weiter= mit zur
  // Anmeldung — dieselbe eine erlaubte Form wie bei loginAction.
  const weiter = formData?.get('weiter');
  if (typeof weiter === 'string' && weiterZielGueltig(weiter)) {
    redirect(`/login?weiter=${encodeURIComponent(weiter)}`);
  }
  redirect(formData?.get('zurueck') === '/new/login' ? '/new/login' : '/login');
}

function persoenlicheEinstellungenAusForm(formData: FormData) {
  const startansicht = String(formData.get('startansicht') ?? 'tag');
  const avatar = String(formData.get('avatar') ?? 'vertrieb-akquise');
  return {
    startansicht,
    hinweiseZuOffenenTagen: String(formData.get('hinweiseZuOffenenTagen') ?? 'ja') === 'ja',
    avatar,
    mailAbbestellt: mailAbbestellungAusForm(formData),
  };
}

/**
 * Aus dem Formular kommt, was jemand *haben* will — gespeichert wird, was er
 * *nicht* will. Die Umkehr passiert hier und nicht in der Datenbank: so
 * erreicht eine später hinzukommende Nachrichtenart alle bisherigen
 * Empfänger, statt still bei niemandem anzukommen (siehe Migration 20).
 *
 * Das Feld fehlt ganz, solange ein Formular es nicht schickt — dann bleibt die
 * bestehende Auswahl stehen, statt von einem unbeteiligten Formular
 * zurückgesetzt zu werden.
 */
function mailAbbestellungAusForm(formData: FormData): MailArt[] | null {
  if (!formData.has('mailArten')) return null;
  const gewaehlt = new Set(formData.getAll('mailArten').map(String).filter(istMailArt));
  return ABWAEHLBARE_ARTEN.filter((art) => !gewaehlt.has(art));
}

export async function onboardingCompleteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  if (formData.get('datenBestaetigt') !== 'ja') {
    return {error: 'Bitte bestätige zuerst, dass deine Stammdaten richtig sind.'};
  }
  const werte = persoenlicheEinstellungenAusForm(formData);
  if (!istStartansicht(werte.startansicht)) return {error: 'Bitte eine gültige Startansicht wählen.'};
  if (!istAvatar(werte.avatar)) return {error: 'Bitte eine gültige Profilfigur wählen.'};
  const einstellungen = {
    ...werte,
    startansicht: werte.startansicht,
    avatar: werte.avatar,
    // Schickt das Formular die Liste nicht mit, bleibt die bestehende Auswahl
    // stehen: ein Formular ohne das Feld hat dazu keine Meinung.
    mailAbbestellt: werte.mailAbbestellt ?? abbestellteArten(user.id),
  };
  const error = onboardingAbschliessen(user.id, einstellungen);
  protokolliere({
    akteur: user,
    aktion: 'profil.bestaetigen',
    gegenstand: `Stammdaten von ${user.name} bestätigt`,
    betroffen: {id: user.id, name: user.name},
    nachher: {
      Startansicht: werte.startansicht,
      'Hinweise zu offenen Tagen': werte.hinweiseZuOffenenTagen ? 'an' : 'aus',
      Profilfigur: avatarLabel(werte.avatar),
      'Abbestellte Nachrichten': einstellungen.mailAbbestellt.map(mailArtLabel).join(', ') || null,
    },
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/', 'layout');
  redirect(startPfad(user.id));
}

export async function personalSettingsSaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const werte = persoenlicheEinstellungenAusForm(formData);
  if (!istStartansicht(werte.startansicht)) return {error: 'Bitte eine gültige Startansicht wählen.'};
  if (!istAvatar(werte.avatar)) return {error: 'Bitte eine gültige Profilfigur wählen.'};
  const einstellungen = {
    ...werte,
    startansicht: werte.startansicht,
    avatar: werte.avatar,
    // Schickt das Formular die Liste nicht mit, bleibt die bestehende Auswahl
    // stehen: ein Formular ohne das Feld hat dazu keine Meinung.
    mailAbbestellt: werte.mailAbbestellt ?? abbestellteArten(user.id),
  };
  const error = persoenlicheEinstellungenSpeichern(user.id, einstellungen);
  protokolliere({
    akteur: user,
    aktion: 'profil.einstellungen',
    gegenstand: `Persönliche Einstellungen von ${user.name}`,
    betroffen: {id: user.id, name: user.name},
    nachher: {
      Startansicht: werte.startansicht,
      'Hinweise zu offenen Tagen': werte.hinweiseZuOffenenTagen ? 'an' : 'aus',
      Profilfigur: avatarLabel(werte.avatar),
      'Abbestellte Nachrichten': einstellungen.mailAbbestellt.map(mailArtLabel).join(', ') || null,
    },
    fehler: error,
  });
  if (!error) {
    revalidatePath('/profil');
    revalidatePath('/', 'layout');
  }
  return {error};
}

/**
 * Das eigene Profilbild setzen oder entfernen. Nur für das eigene Konto: ein
 * Bild von sich ist die eine Angabe, die niemand für jemand anderen wählt —
 * auch die Verwaltung nicht.
 *
 * Protokolliert wird der Vorgang, nicht die Datei: „gesetzt" oder „entfernt",
 * dieselbe Haltung, mit der das Zurücksetzen eines Passworts die Tatsache und
 * nicht den Wert festhält.
 */
export async function profilbildAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Wie `onboardingCompleteAction`: eine angemeldete Sitzung genügt. Das Bild
  // wird im Einrichtungsassistenten gewählt, also *vor* dem Abschluss, und die
  // Handlung reicht ohnehin nur an den eigenen Datensatz.
  const user = await requireAuthenticatedUser();
  const entfernen = formData.get('entfernen') !== null;
  const eingang = formData.get('bild');

  let gespeichert: {datei: string; typ: string} | null = null;
  if (!entfernen) {
    if (!(eingang instanceof File) || eingang.size === 0) return {error: 'Bitte ein Bild wählen.'};
    const ergebnis = await speichereAvatarDatei(eingang);
    if (typeof ergebnis === 'string') return {error: ergebnis};
    gespeichert = ergebnis;
  }

  setzeProfilbild(user.id, gespeichert);
  protokolliere({
    akteur: user,
    aktion: 'profil.bild',
    gegenstand: `Profilbild von ${user.name}`,
    betroffen: {id: user.id, name: user.name},
    nachher: {Profilbild: gespeichert ? 'gesetzt' : 'entfernt'},
    fehler: null,
  });
  revalidatePath('/profil');
  revalidatePath('/', 'layout');
  return OK;
}

/**
 * Ein Wort an einer Personenkarte. Kein Vorgang, keine Prüfung, keine
 * Nachricht — die Karte steht ohnehin offen, und wer sie öffnet, liest mit.
 *
 * `revalidatePath` gibt es hier nicht: die Kommentare hängen an keiner Seite,
 * sondern an der Karte, und die holt ihre Liste selbst nach (api/person/…/
 * kommentare). Eine ganze Seite neu zu bauen, weil jemand „schönes Bild!"
 * geschrieben hat, wäre die teuerste Art, nichts zu bewirken.
 */
export async function profilKommentarAction(personId: number, text: string): Promise<ActionState> {
  const user = await requireRecht('profil.kommentieren');
  const ergebnis = schreibeKommentar(personId, user.id, text);
  if (typeof ergebnis === 'string') return {error: ergebnis};
  const geschrieben = kommentarById(ergebnis);
  protokolliere({
    akteur: user,
    aktion: 'profil.kommentar',
    gegenstand: `Kommentar auf der Karte von ${geschrieben?.person_name ?? 'unbekannt'}`,
    betroffen: {id: personId, name: geschrieben?.person_name ?? ''},
    nachher: {Kommentar: geschrieben?.text},
    fehler: null,
  });
  return OK;
}

/**
 * Ein Wort zurücknehmen. Darf, wer es geschrieben hat, wessen Karte es trägt,
 * und wer Konten verwaltet — der abgewiesene Versuch steht mit im Protokoll,
 * wie jede abgewiesene Handlung im Haus.
 */
export async function profilKommentarLoeschenAction(kommentarId: number): Promise<ActionState> {
  const user = await requireUser();
  const kommentar = kommentarById(kommentarId);
  if (!kommentar) return {error: 'Diesen Kommentar gibt es nicht mehr.'};

  const gegenstand = `Kommentar auf der Karte von ${kommentar.person_name}`;
  if (!darfKommentarLoeschen(user, kommentar)) {
    const fehler = 'Diesen Kommentar darf nur seine Verfasserin oder ihr Gegenüber löschen.';
    protokolliere({
      akteur: user,
      aktion: 'profil.kommentar-loeschen',
      gegenstand,
      betroffen: {id: kommentar.person_id, name: kommentar.person_name},
      fehler,
    });
    return {error: fehler};
  }

  loescheKommentar(kommentarId);
  protokolliere({
    akteur: user,
    aktion: 'profil.kommentar-loeschen',
    gegenstand,
    betroffen: {id: kommentar.person_id, name: kommentar.person_name},
    // Der Wortlaut bleibt im Nachweis stehen: gelöscht ist es auf der Karte,
    // gesagt bleibt es gesagt — und die betroffene Person liest ihre Spur.
    vorher: {Kommentar: kommentar.text},
    fehler: null,
  });
  return OK;
}

// ---------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------

/**
 * Die Kette nachrechnen. Nur die Verwaltung: die Prüfung liest jede Zeile, und
 * ihr Ergebnis ist eine Aussage über den ganzen Datensatz, nicht über den
 * eigenen Ausschnitt.
 *
 * Die Prüfung selbst wird nicht protokolliert — sie ändert nichts, und ein
 * Nachweis, der bei jedem Blick auf ihn wächst, verwässert sich selbst.
 */
export async function protokollPruefenAction(): Promise<Kettenbefund> {
  await requireRecht('protokoll.alle');
  return protokollPruefen();
}

// ---------------------------------------------------------------------------
// Stamping
// ---------------------------------------------------------------------------

/** Die vier Stempelhandlungen tragen im Protokoll ihre eigenen Namen. */
const STEMPEL_AKTION = {
  einstempeln: 'stempeln.ein',
  pause: 'stempeln.pause',
  fortsetzen: 'stempeln.fort',
  ausstempeln: 'stempeln.aus',
} as const;

const STEMPEL_WORT: Record<keyof typeof STEMPEL_AKTION, string> = {
  einstempeln: 'Einstempeln',
  pause: 'Pause',
  fortsetzen: 'Weiterarbeiten',
  ausstempeln: 'Ausstempeln',
};

export async function stampAction(
  action: 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln',
): Promise<ActionState> {
  const user = await requireRecht('zeit.erfassen');
  const heute = todayISO();
  const error = stamp(user.id, action);
  protokolliere({
    akteur: user,
    aktion: STEMPEL_AKTION[action],
    gegenstand: `${STEMPEL_WORT[action]} um ${fmtTime(nowMinutes())}`,
    datum: heute,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function undoStampAction(): Promise<ActionState> {
  const user = await requireRecht('zeit.erfassen');
  const error = undoStamp(user.id);
  protokolliere({
    akteur: user,
    aktion: 'stempeln.rueckgaengig',
    gegenstand: 'Ausstempeln innerhalb von 30 Sekunden zurückgenommen',
    datum: todayISO(),
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Segment corrections
// ---------------------------------------------------------------------------

function segmentInputFromForm(formData: FormData): SegmentInput | string {
  const date = String(formData.get('date') ?? '');
  const kind = String(formData.get('kind') ?? 'arbeit');
  const startMin = parseTime(formData.get('start'));
  const endMin = parseTime(formData.get('end'));
  if (startMin === null || endMin === null) return 'Bitte Beginn und Ende im Format HH:MM angeben.';
  if (kind !== 'arbeit' && kind !== 'pause') return 'Ungültige Art.';
  const note = String(formData.get('note') ?? '').trim();
  return {date, kind, startMin, endMin, note: note || undefined};
}

/** Ein Eintrag als Wertepaare für die Gegenüberstellung im Protokoll. */
function segmentWerte(input: SegmentInput) {
  return {
    Art: input.kind === 'arbeit' ? 'Arbeit' : 'Pause',
    Beginn: fmtTime(input.startMin),
    Ende: fmtTime(input.endMin),
    Notiz: input.note ?? null,
  };
}

export async function segmentSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('zeit.erfassen');
  const input = segmentInputFromForm(formData);
  if (typeof input === 'string') return {error: input};
  const segmentId = Number(formData.get('segmentId') ?? 0);
  const userId = Number(formData.get('userId') ?? actor.id);

  // Der Zustand *vor* der Änderung wird gelesen, solange es ihn noch gibt —
  // hinterher ließe er sich nicht mehr rekonstruieren.
  const vorher = segmentId ? beschreibeSegment(segmentId) : null;
  // Was die Pause aus der Arbeit schneidet, gehört in dieselbe Zeile: der
  // Schnitt ist Teil dieser einen Handlung, nicht eine zweite.
  const schnitt = schnittText(geplanteSchnitte(userId, input, segmentId || undefined));
  const error = segmentId
    ? updateSegment(actor, segmentId, input)
    : createSegment(actor, userId, input);

  protokolliere({
    akteur: actor,
    aktion: segmentId ? 'eintrag.aendern' : 'eintrag.anlegen',
    gegenstand:
      vorher?.text ??
      `${input.kind === 'arbeit' ? 'Arbeit' : 'Pause'} am ${fmtDate(input.date)}, ${fmtTime(input.startMin)}–${fmtTime(input.endMin)}`,
    betroffen: vorher?.betroffen ?? beschreibePerson(userId),
    datum: input.date,
    vorher: vorher?.werte ?? null,
    nachher: {...segmentWerte(input), ...(schnitt && !error ? {'Arbeitszeit geschnitten': schnitt} : {})},
    fehler: error,
  });

  if (error) return {error};
  revalidatePath('/', 'layout');
  return OK;
}

export async function dayTypeSaveAction(
  userId: number,
  date: string,
  type: DayTypeKind | null,
  note?: string,
): Promise<ActionState> {
  const actor = await requireRecht('zeit.erfassen');
  const error = setDayType(actor, userId, date, type, note);
  protokolliere({
    akteur: actor,
    aktion: 'tagesart.setzen',
    gegenstand: `Tagesart am ${fmtDate(date)}: ${type ?? 'zurückgesetzt'}`,
    betroffen: beschreibePerson(userId),
    datum: date,
    nachher: {Tagesart: type ?? 'keine', Notiz: note ?? null},
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function segmentConfirmAction(segmentId: number): Promise<ActionState> {
  const actor = await requireRecht('zeit.erfassen');
  const eintrag = beschreibeSegment(segmentId);
  const error = confirmAutoClosed(actor, segmentId);
  protokolliere({
    akteur: actor,
    aktion: 'eintrag.bestaetigen',
    gegenstand: eintrag?.text ?? `Eintrag ${segmentId}`,
    betroffen: eintrag?.betroffen ?? null,
    datum: eintrag?.datum ?? null,
    nachher: eintrag?.werte ?? null,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function segmentDeleteAction(segmentId: number): Promise<ActionState> {
  const actor = await requireRecht('zeit.erfassen');
  const eintrag = beschreibeSegment(segmentId);
  const error = deleteSegment(actor, segmentId);
  protokolliere({
    akteur: actor,
    aktion: 'eintrag.loeschen',
    gegenstand: eintrag?.text ?? `Eintrag ${segmentId}`,
    betroffen: eintrag?.betroffen ?? null,
    datum: eintrag?.datum ?? null,
    vorher: eintrag?.werte ?? null,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Monatsabschluss
// ---------------------------------------------------------------------------

/**
 * Der Abschluss aus der Sicht des Betroffenen: sein Monat ist ab jetzt
 * schreibgeschützt, und das erfährt er, ohne die Anwendung öffnen zu müssen.
 * Die Zahlen stehen mit dabei — sonst wäre es eine Aufforderung nachzusehen
 * und keine Mitteilung.
 */
async function meldeAbschluss(userId: number, month: string, actorName: string): Promise<void> {
  const user = getUser(userId);
  if (!user) return;
  const record = monthRecord(user, month);
  await meldeMonatAbgeschlossen(userId, {
    monat: month,
    istMin: record.workedMin,
    sollMin: record.sollMin,
    saldoMin: record.workedMin - record.sollMin,
    abgeschlossenVon: actorName,
  });
}

export async function lockMonthAction(userId: number, month: string): Promise<ActionState> {
  const actor = await requireRecht('abschluss.verwalten');
  const error = lockMonth(actor, userId, month);
  protokolliere({
    akteur: actor,
    aktion: 'monat.abschliessen',
    gegenstand: `Monatsabschluss ${fmtMonth(month)}`,
    betroffen: beschreibePerson(userId),
    datum: month,
    fehler: error,
  });
  if (!error) await meldeAbschluss(userId, month, actor.name);
  revalidatePath('/', 'layout');
  return {error};
}

/** Lock the month for every employee without open entries; returns counts. */
export async function lockAllAction(month: string): Promise<{locked: number; skipped: number; error: string | null}> {
  const actor = await requireRecht('abschluss.verwalten');
  if (month >= monthOf(todayISO())) {
    return {locked: 0, skipped: 0, error: 'Der laufende Monat kann noch nicht abgeschlossen werden.'};
  }
  let locked = 0;
  let skipped = 0;
  for (const user of activeUsers()) {
    if (isMonthLocked(user.id, month)) continue;
    const record = monthRecord(user, month);
    if (record.openSegments > 0 || eingereichteImMonat(user.id, month) > 0) {
      skipped += 1;
      continue;
    }
    const error = lockMonth(actor, user.id, month);
    // Eine Zeile je Mitarbeiter, nicht eine für den Stapel: abgeschlossen wird
    // jeder Monat einzeln, und im Nachweis muss neben jedem Datensatz stehen,
    // wann er zugemacht wurde — nicht in einer Sammelbuchung, die man
    // aufdröseln muss.
    protokolliere({
      akteur: actor,
      aktion: 'monat.abschliessen',
      gegenstand: `Monatsabschluss ${fmtMonth(month)} (Sammelabschluss)`,
      betroffen: {id: user.id, name: user.name},
      datum: month,
      fehler: error,
    });
    if (error === null) {
      locked += 1;
      // Wie im Protokoll: eine Nachricht je Mitarbeiter. Aus seiner Sicht ist
      // sein Monat abgeschlossen worden, nicht „ein Stapel Monate".
      await meldeAbschluss(user.id, month, actor.name);
    } else skipped += 1;
  }
  revalidatePath('/', 'layout');
  return {locked, skipped, error: null};
}

// ---------------------------------------------------------------------------
// Drag-to-correct (programmatic segment resize from the timeline)
// ---------------------------------------------------------------------------

export async function segmentResizeAction(segmentId: number, startMin: number, endMin: number): Promise<ActionState> {
  const actor = await requireRecht('zeit.erfassen');
  const segment = getDb()
    .query<{user_id: number; date: string; kind: 'arbeit' | 'pause'; note: string | null}, [number]>(
      'SELECT user_id, date, kind, note FROM segments WHERE id = ?',
    )
    .get(segmentId);
  if (!segment) return {error: 'Eintrag nicht gefunden.'};
  const vorher = beschreibeSegment(segmentId);
  const error = updateSegment(actor, segmentId, {
    date: segment.date,
    kind: segment.kind,
    startMin,
    endMin,
    note: segment.note ?? undefined,
  });
  // Eigene Aktion, nicht „geändert": eine gezogene Kante ist eine Schätzung,
  // ein eingetippter Wert eine Angabe. Wer den Nachweis später liest, soll den
  // Unterschied sehen können.
  protokolliere({
    akteur: actor,
    aktion: 'eintrag.ziehen',
    gegenstand: vorher?.text ?? `Eintrag am ${fmtDate(segment.date)}`,
    betroffen: vorher?.betroffen ?? null,
    datum: segment.date,
    vorher: vorher?.werte ?? null,
    nachher: {Beginn: fmtTime(startMin), Ende: fmtTime(endMin)},
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// User management (Verwaltung)
// ---------------------------------------------------------------------------

export interface UserActionState {
  error: string | null;
  /** One-time password to hand to the employee; shown exactly once. */
  password?: string;
  /**
   * Ob die Zugangsdaten zusätzlich per E-Mail hinausgingen. Das Kennwort steht
   * *trotzdem* auf dem Bildschirm: der Versand kann scheitern, und die
   * Verwaltung soll nicht raten müssen, ob sie es weitergeben muss.
   */
  versandt?: 'gesendet' | 'uebersprungen' | 'fehler';
}

function userInputFromForm(formData: FormData): UserInput {
  return {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    role: (String(formData.get('role') ?? 'mitarbeiter') as UserInput['role']),
    weeklyMinutes: Math.round(Number(formData.get('weeklyHours') ?? 0) * 60),
    bundesland: String(formData.get('bundesland') ?? '').trim(),
    extraRechte: formData.getAll('extraRechte').map(String).filter(istRecht),
    // 30 als Vorgabe: der gesetzliche Mindesturlaub liegt bei 20 Werktagen
    // (§ 3 BUrlG), üblich sind 30 — die Zahl steht im Formular und ist änderbar.
    urlaubstageJahr: Math.round(Number(formData.get('urlaubstage') ?? 30)),
  };
}

/**
 * Der Personalstamm als Wertepaare. Das Kennwort steht bewusst nicht darunter
 * — weder das gesetzte noch das erzeugte. Ein Nachweis, in dem Zugangsdaten
 * liegen, ist ein Leck mit Zeitstempel.
 */
function userWerte(input: UserInput) {
  return {
    Name: input.name,
    'E-Mail': input.email,
    Rolle: rolleLabel(input.role),
    Zusatzrechte: input.extraRechte.map((r) => RECHTE[r].label).join(', ') || null,
    'Wochenstunden': (input.weeklyMinutes / 60).toFixed(2).replace('.', ','),
    Bundesland: input.bundesland || null,
    Urlaubstage: input.urlaubstageJahr,
  };
}

export async function userCreateAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const input = userInputFromForm(formData);
  // Die Wahl der Verwaltung, nicht die der Anwendung: ein Startpasswort per
  // E-Mail ist bequem und für ein Konto, das beim ersten Anmelden ohnehin
  // gewechselt werden muss, vertretbar — aber es ist ein Kennwort in einem
  // Postfach, und wer das nicht will, bekommt es weiterhin nur angezeigt.
  const perMail = formData.get('zugangPerMail') === 'ja';
  const result = await createUser(actor, input);
  protokolliere({
    akteur: actor,
    aktion: 'mitarbeiter.anlegen',
    gegenstand: `Mitarbeiter ${input.name}`,
    betroffen: null,
    nachher: {
      ...userWerte(input),
      // Nur die Tatsache, nie das Kennwort — dieselbe Regel wie beim
      // Zurücksetzen. Dass die Zugangsdaten den Weg über ein Postfach
      // genommen haben, ist aber ein Vorgang, den der Nachweis kennen soll.
      Zugangsdaten: perMail ? 'per E-Mail versendet' : 'nur angezeigt',
    },
    fehler: 'error' in result ? result.error : null,
  });
  revalidatePath('/', 'layout');
  if ('error' in result) return {error: result.error};

  // Erst nach der Buchung, und die Angaben kommen aus dem Datensatz statt aus
  // dem Formular: was der Server angelegt hat, ist die Wahrheit.
  const angelegt = perMail ? getUser(result.id) : null;
  const versandt = angelegt ? await meldeWillkommen(angelegt, result.password) : undefined;
  return {error: null, password: result.password, versandt};
}

export async function userUpdateAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const userId = Number(formData.get('userId') ?? 0);
  const input = userInputFromForm(formData);
  const vorher = getUser(userId);
  const rechteVorher = zusatzRechte(userId);
  const error = updateUser(actor, userId, input);
  protokolliere({
    akteur: actor,
    aktion: 'mitarbeiter.aendern',
    gegenstand: `Mitarbeiter ${vorher?.name ?? input.name}`,
    betroffen: vorher ? {id: vorher.id, name: vorher.name} : null,
    vorher: vorher
      ? {
          Name: vorher.name,
          'E-Mail': vorher.email,
          Rolle: rolleLabel(vorher.role),
          Zusatzrechte: rechteVorher.map((r) => RECHTE[r].label).join(', ') || null,
          'Wochenstunden': (vorher.weekly_minutes / 60).toFixed(2).replace('.', ','),
          Bundesland: vorher.bundesland ?? null,
          Urlaubstage: vorher.urlaubstage_jahr,
        }
      : null,
    nachher: userWerte(input),
    fehler: error,
  });
  // Der Ereignistitel trägt den Namen der Person — nach einer Umbenennung
  // zieht der Abgleich jedes Ereignis nach (der Fingerabdruck weicht ab).
  // Ohne Namensänderung stellt er das fest und fragt Google gar nicht erst an.
  if (!error && vorher && vorher.name !== input.name.trim()) {
    await syncGoogleAbwesenheiten(userId);
  }
  revalidatePath('/', 'layout');
  return {error};
}

export async function einrichtungNeuStartenAction(userId: number): Promise<ActionState> {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const betroffen = beschreibePerson(userId);
  const error = einrichtungNeuStarten(actor, userId);
  protokolliere({
    akteur: actor,
    aktion: 'mitarbeiter.einrichtung-neustart',
    gegenstand: `Einrichtung von ${betroffen?.name ?? userId} neu gestartet`,
    betroffen,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function userResetPasswordAction(userId: number, perMail = false): Promise<UserActionState> {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const result = await resetPassword(actor, userId);
  protokolliere({
    akteur: actor,
    aktion: 'mitarbeiter.passwort',
    // Nur die Tatsache — das erzeugte Kennwort wird der Verwaltung einmal
    // angezeigt und nirgends festgehalten.
    gegenstand: 'Passwort zurückgesetzt und einmalig angezeigt',
    betroffen: beschreibePerson(userId),
    nachher: {Zugangsdaten: perMail ? 'per E-Mail versendet' : 'nur angezeigt'},
    fehler: 'error' in result ? result.error : null,
  });
  if ('error' in result) return {error: result.error};
  const betroffener = perMail ? getUser(userId) : null;
  const versandt = betroffener
    ? await meldePasswortZurueckgesetzt(betroffener, result.password, actor.name)
    : undefined;
  return {error: null, password: result.password, versandt};
}

export async function userSetActiveAction(userId: number, active: boolean): Promise<ActionState> {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const betroffen = beschreibePerson(userId);
  const error = setUserActive(actor, userId, active);
  // Offboarding räumt auch drüben auf: die von uns angelegten Ereignisse
  // verschwinden aus dem Kalender, der Zugriff wird widerrufen. Wer
  // wiederkommt, verbindet neu — ein gesperrtes Konto behält keine Tokens.
  // Auch die App-Anmeldungen: ein gesperrtes Konto authentifiziert sich
  // nirgends mehr, auch nicht mit einem noch lebenden OAuth-Token.
  if (!error && !active) oauthTokensEntziehen(userId);
  const konto = !error && !active ? googleKontoFuer(userId) : null;
  if (konto) {
    await loescheAlleGoogleEreignisse(userId);
    await trenneGoogleKonto(userId);
    protokolliere({
      akteur: actor,
      aktion: 'oauth.google-trennen',
      gegenstand: `Google-Konto von ${betroffen?.name ?? userId} bei der Deaktivierung getrennt`,
      betroffen,
      vorher: {'Google-Konto': konto.google_email},
    });
  }
  protokolliere({
    akteur: actor,
    aktion: active ? 'mitarbeiter.reaktivieren' : 'mitarbeiter.deaktivieren',
    gegenstand: `Mitarbeiter ${betroffen?.name ?? userId}`,
    betroffen,
    nachher: {Zugang: active ? 'aktiv' : 'gesperrt'},
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Rollen (Recht rollen.verwalten)
// ---------------------------------------------------------------------------

/** Eine Rolle als Wertepaare fürs Protokoll — Name und die deutschen Namen ihrer Rechte. */
function rolleWerte(rolle: {label: string; rechte: readonly Recht[]}) {
  return {
    Name: rolle.label,
    Rechte: rolle.rechte.map((r) => RECHTE[r].label).join(', ') || '—',
  };
}

/** Anlegen und Ändern in einer Aktion — ein leerer `schluessel` heißt anlegen (der Schlüssel entsteht erst aus dem Namen). */
export async function rolleSpeichernAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('rollen.verwalten');
  const schluessel = String(formData.get('schluessel') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const rechte = formData.getAll('rechte').map(String).filter(istRecht);

  const vorher = schluessel ? rolleByKey(schluessel) : null;
  let error: string | null;
  let neuerSchluessel = schluessel;
  if (schluessel) {
    error = rolleAendern(actor, schluessel, {label, rechte});
  } else {
    const ergebnis = rolleAnlegen(actor, {label, rechte});
    error = 'error' in ergebnis ? ergebnis.error : null;
    if (!('error' in ergebnis)) neuerSchluessel = ergebnis.schluessel;
  }
  // Was gespeichert wurde, ist die Wahrheit — nicht das Formular: fremde
  // Rechte bleiben beim Mischen stehen, auch wenn sie nicht mitgeschickt wurden.
  const gespeichert = error === null ? rolleByKey(neuerSchluessel) : null;
  protokolliere({
    akteur: actor,
    aktion: schluessel ? 'rolle.aendern' : 'rolle.anlegen',
    gegenstand: `Rolle ${vorher?.label ?? label}`,
    vorher: vorher ? rolleWerte(vorher) : null,
    nachher: gespeichert ? rolleWerte(gespeichert) : rolleWerte({label, rechte}),
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function rolleLoeschenAction(schluessel: string): Promise<ActionState> {
  const actor = await requireRecht('rollen.verwalten');
  const vorher = rolleByKey(schluessel);
  const error = rolleLoeschen(actor, schluessel);
  protokolliere({
    akteur: actor,
    aktion: 'rolle.loeschen',
    gegenstand: `Rolle ${vorher?.label ?? schluessel}`,
    vorher: vorher ? rolleWerte(vorher) : null,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Einstellungen (Verwaltung)
// ---------------------------------------------------------------------------

export async function settingsSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('einstellungen.verwalten');

  const mergeRaw = String(formData.get('mergeWindow') ?? '').trim();
  const merge = Number(mergeRaw);
  if (!Number.isInteger(merge) || merge < 0 || merge > 15) {
    return {error: 'Das Zusammenführen-Fenster muss zwischen 0 und 15 Minuten liegen.'};
  }

  const cutoffRaw = String(formData.get('autoCloseCutoff') ?? '').trim();
  let cutoff = '';
  if (cutoffRaw !== '') {
    const parsed = parseTime(cutoffRaw);
    if (parsed === null || parsed >= 1440) return {error: 'Bitte eine Uhrzeit im Format HH:MM angeben.'};
    cutoff = String(parsed);
  }

  const land = String(formData.get('bundesland') ?? '').trim();
  if (land !== '' && !isBundesland(land)) return {error: 'Unbekanntes Bundesland.'};

  // Der Absender muss eine Adresse sein, sonst weist Resend jeden Versand ab
  // und niemand erfährt, warum. Leer ist erlaubt und heißt „die Vorgabe".
  const absender = String(formData.get('mailAbsender') ?? '').trim();
  if (absender !== '' && !/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(absender)) {
    return {error: 'Bitte einen Absender wie „MedArbeiter Hub <zeit@firma.de>" angeben.'};
  }

  // Leer heißt „keine Grenze" und ist ausdrücklich erlaubt: wie viele
  // gleichzeitig zu viele sind, weiß nur der Betrieb, und eine erfundene Zahl
  // wäre eine Warnung, für die niemand einsteht.
  const grenzeRaw = String(formData.get('belegungGrenze') ?? '').trim();
  if (grenzeRaw !== '') {
    const grenze = Number(grenzeRaw);
    if (!Number.isInteger(grenze) || grenze < 0 || grenze > 999) {
      return {error: 'Die Belastungsgrenze muss eine ganze Zahl ab 0 sein – oder leer bleiben.'};
    }
  }

  // Die Satztabelle kommt als JSON aus dem Formular; jede Stufe wird einzeln
  // geprüft, damit ein Tippfehler benannt wird statt still zu verschwinden.
  let stufenRoh: unknown;
  try {
    stufenRoh = JSON.parse(String(formData.get('spesenStufen') ?? '[]'));
  } catch {
    return {error: 'Die Satztabelle konnte nicht gelesen werden.'};
  }
  if (!Array.isArray(stufenRoh) || stufenRoh.length === 0) {
    return {error: 'Bitte mindestens eine Satzstufe angeben.'};
  }
  const stufen: SatzStufe[] = [];
  for (const eintrag of stufenRoh as Array<{ab?: string; halb?: string; voll?: string}>) {
    const ab = String(eintrag.ab ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ab)) {
      return {error: 'Bitte für jede Satzstufe ein Datum im Format JJJJ-MM-TT angeben.'};
    }
    const halbCent = parseEuro(String(eintrag.halb ?? ''));
    const vollCent = parseEuro(String(eintrag.voll ?? ''));
    if (halbCent === null || vollCent === null) {
      return {error: `Bitte für die Stufe ab ${ab} beide Beträge wie 14,00 angeben.`};
    }
    if (stufen.some((s) => s.ab === ab)) {
      return {error: `Für den ${ab} ist bereits eine Stufe erfasst.`};
    }
    stufen.push({ab, halbCent, vollCent});
  }

  // Vor dem Schreiben gelesen, damit die Gegenüberstellung im Protokoll die
  // alten Werte kennt: „Zusammenführen-Fenster 2 → 5 Minuten" ist die
  // Auskunft, nicht „Einstellungen geändert".
  const alt = einstellungenWerte();
  setSetting('merge_window_min', String(merge));
  setSetting('auto_close_cutoff_min', cutoff);
  setSetting('bundesland', land);
  setSetting('belegung_grenze', grenzeRaw);
  setSetting('mail_aktiv', formData.get('mailAktiv') === 'ja' ? 'ja' : 'nein');
  setSetting('mail_absender', absender);
  setSpesenSaetze(stufen.sort((a, b) => a.ab.localeCompare(b.ab)));
  protokolliere({
    akteur: actor,
    aktion: 'einstellungen.aendern',
    gegenstand: 'Einstellungen der Zeiterfassung',
    betroffen: null,
    vorher: alt,
    nachher: einstellungenWerte(),
  });
  revalidatePath('/', 'layout');
  return OK;
}

/** Die Einstellungen als lesbare Wertepaare — einmal vor und einmal nach dem Speichern. */
function einstellungenWerte() {
  const cutoff = autoCloseCutoffMin();
  return {
    'Zusammenführen-Fenster': `${mergeWindowMin()} Min.`,
    'Kappungsgrenze': cutoff === null ? 'aus' : fmtTime(cutoff),
    Bundesland: getSetting('bundesland') || 'nicht gesetzt',
    Belastungsgrenze: belegungGrenze() === null ? 'nicht gesetzt' : `${belegungGrenze()} gleichzeitig`,
    'E-Mail-Versand': mailAktiv() ? 'an' : 'aus',
    'E-Mail-Absender': absenderAdresse(),
    Verpflegungssätze: spesenSaetze()
      .map((s) => `ab ${fmtDate(s.ab)}: ${(s.halbCent / 100).toFixed(2)}/${(s.vollCent / 100).toFixed(2)} €`)
      .join(' · '),
  };
}

// ---------------------------------------------------------------------------
// Reisen & Spesen
// ---------------------------------------------------------------------------

function reiseInputFromForm(formData: FormData): ReiseInput | string {
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  const startMin = parseTime(formData.get('startTime'));
  const endMin = parseTime(formData.get('endTime'));
  if (startMin === null || endMin === null) {
    return 'Bitte Abfahrt und Rückkehr mit Datum und Uhrzeit angeben.';
  }
  return {
    startDate,
    startMin,
    endDate,
    endMin,
    zweck: String(formData.get('zweck') ?? ''),
    ziel: String(formData.get('ziel') ?? ''),
  };
}

export async function reiseSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  const input = reiseInputFromForm(formData);
  if (typeof input === 'string') return {error: input};
  const reiseId = Number(formData.get('reiseId') ?? 0);
  const userId = Number(formData.get('userId') ?? actor.id);
  const vorher = reiseId ? beschreibeReise(reiseId) : null;
  const error = reiseId ? updateReise(actor, reiseId, input) : createReise(actor, userId, input);
  protokolliere({
    akteur: actor,
    aktion: reiseId ? 'reise.aendern' : 'reise.anlegen',
    gegenstand: vorher?.text ?? `Reise ${fmtDateRange(input.startDate, input.endDate)}`,
    betroffen: vorher?.betroffen ?? beschreibePerson(userId),
    datum: input.startDate,
    vorher: vorher?.werte ?? null,
    nachher: {
      Zweck: input.zweck,
      Ziel: input.ziel || null,
      Abfahrt: `${fmtDate(input.startDate)} ${fmtTime(input.startMin)}`,
      Rückkehr: `${fmtDate(input.endDate)} ${fmtTime(input.endMin)}`,
    },
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/', 'layout');
  return OK;
}

/** Die fünf Reise-Aktionen unterscheiden sich nur im Verb — also eine Stelle dafür. */
async function reiseVorgang(
  reiseId: number,
  aktion: 'reise.loeschen' | 'reise.einreichen' | 'reise.zurueckziehen' | 'reise.genehmigen' | 'reise.zurueckweisen',
  actor: Awaited<ReturnType<typeof requireUser>>,
  lauf: () => string | null,
  notiz?: Record<string, string>,
): Promise<ActionState> {
  const reise = beschreibeReise(reiseId);
  const error = lauf();
  protokolliere({
    akteur: actor,
    aktion,
    gegenstand: reise?.text ?? `Reise ${reiseId}`,
    betroffen: reise?.betroffen ?? null,
    datum: reise?.datum ?? null,
    vorher: aktion === 'reise.loeschen' ? reise?.werte ?? null : null,
    nachher: notiz ?? null,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function reiseDeleteAction(reiseId: number): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  return reiseVorgang(reiseId, 'reise.loeschen', actor, () => deleteReise(actor, reiseId));
}

export async function reiseEinreichenAction(reiseId: number): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  // Kein Versand: dass eine Abrechnung wartet, steht in der Prüfliste. Post
  // gibt es erst, wenn sie liegen bleibt — siehe lib/erinnerungen.ts.
  return reiseVorgang(reiseId, 'reise.einreichen', actor, () => einreichen(actor, reiseId));
}

/**
 * Die Nachricht zu einer entschiedenen Reise, aus der ID gelesen: erst nach
 * der Buchung steht der Zustand fest, den die Nachricht nennt.
 */
async function meldeReise(reiseId: number, entschiedenVon: string, genehmigt: boolean): Promise<void> {
  const reise = reiseById(reiseId);
  if (!reise) return;
  const {rechnung, belege} = mitRechnung(reise);
  await meldeReiseEntschieden(reise, entschiedenVon, genehmigt, rechnung, belege.length);
}

export async function reiseZurueckziehenAction(reiseId: number): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  const ergebnis = await reiseVorgang(reiseId, 'reise.zurueckziehen', actor, () => zurueckziehen(actor, reiseId));
  // Zurückgezogen heißt: wartet auf niemanden mehr. Das Gedächtnis der
  // Erinnerung darf weg, damit ein erneutes Einreichen seine Frist von vorn
  // bekommt statt sofort zu mahnen.
  if (!ergebnis.error) vergiss('reise', reiseId);
  return ergebnis;
}

export async function reiseGenehmigenAction(reiseId: number): Promise<ActionState> {
  const actor = await requireRecht('spesen.pruefen');
  const ergebnis = await reiseVorgang(reiseId, 'reise.genehmigen', actor, () => genehmigen(actor, reiseId));
  if (!ergebnis.error) await meldeReise(reiseId, actor.name, true);
  return ergebnis;
}

export async function reiseZurueckweisenAction(reiseId: number, grund: string): Promise<ActionState> {
  const actor = await requireRecht('spesen.pruefen');
  const ergebnis = await reiseVorgang(
    reiseId,
    'reise.zurueckweisen',
    actor,
    () => zurueckweisen(actor, reiseId, grund),
    {Grund: grund.trim()},
  );
  if (!ergebnis.error) await meldeReise(reiseId, actor.name, false);
  return ergebnis;
}

/** Approve every trip currently awaiting review; returns counts like lockAllAction. */
export async function reisenGenehmigenAlleAction(): Promise<{
  genehmigt: number;
  uebersprungen: number;
  error: string | null;
}> {
  const actor = await requireRecht('spesen.pruefen');
  let genehmigt = 0;
  let uebersprungen = 0;
  for (const {reise} of reisenZurPruefung('eingereicht')) {
    const beschreibung = beschreibeReise(reise.id);
    const error = genehmigen(actor, reise.id);
    // Wie beim Sammelabschluss: eine Zeile je Vorgang. Eine Sammelbuchung
    // sagte nicht, welche Abrechnung wann genehmigt wurde.
    protokolliere({
      akteur: actor,
      aktion: 'reise.genehmigen',
      gegenstand: `${beschreibung?.text ?? `Reise ${reise.id}`} (Sammelgenehmigung)`,
      betroffen: beschreibung?.betroffen ?? null,
      datum: beschreibung?.datum ?? null,
      fehler: error,
    });
    if (error === null) {
      genehmigt += 1;
      // Auch die Nachricht geht einzeln hinaus. Wer seine Abrechnung
      // eingereicht hat, wartet auf *seine* Entscheidung — dass sie im Stapel
      // fiel, ist eine Angelegenheit der Verwaltung und keine seine.
      await meldeReise(reise.id, actor.name, true);
    } else uebersprungen += 1;
  }
  revalidatePath('/', 'layout');
  return {genehmigt, uebersprungen, error: null};
}

export async function belegAddAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  const reiseId = Number(formData.get('reiseId') ?? 0);
  const art = String(formData.get('art') ?? '');
  if (!(BELEG_ARTEN as string[]).includes(art)) return {error: 'Bitte eine Belegart wählen.'};
  const datum = String(formData.get('datum') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return {error: 'Bitte ein Belegdatum angeben.'};
  const betragCent = parseEuro(String(formData.get('betrag') ?? ''));
  if (betragCent === null) return {error: 'Bitte einen Betrag wie 12,50 angeben.'};

  // Die Datei wird erst abgelegt, wenn alles andere gültig ist — sonst bliebe
  // bei jedem Formularfehler eine verwaiste Datei auf der Platte liegen.
  const eingang = formData.get('datei');
  let datei: string | undefined;
  let dateiTyp: string | undefined;
  let dateiName: string | undefined;
  if (eingang instanceof File && eingang.size > 0) {
    const gespeichert = await speichereBelegDatei(eingang, datum.slice(0, 4));
    if (typeof gespeichert === 'string') return {error: gespeichert};
    datei = gespeichert.datei;
    dateiTyp = gespeichert.typ;
    dateiName = eingang.name;
  }

  const error = addBeleg(actor, reiseId, {
    art: art as BelegArt,
    datum,
    betragCent,
    beschreibung: String(formData.get('beschreibung') ?? ''),
    datei,
    dateiName,
    dateiTyp,
  });
  const reise = beschreibeReise(reiseId);
  protokolliere({
    akteur: actor,
    aktion: 'beleg.anlegen',
    gegenstand: `Beleg zu ${reise?.text ?? `Reise ${reiseId}`}`,
    betroffen: reise?.betroffen ?? null,
    datum,
    nachher: {
      Art: art,
      Datum: fmtDate(datum),
      Betrag: `${(betragCent / 100).toFixed(2).replace('.', ',')} €`,
      Datei: dateiName ?? null,
    },
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/', 'layout');
  return OK;
}

export async function belegDeleteAction(belegId: number): Promise<ActionState> {
  const actor = await requireRecht('spesen.erfassen');
  const beleg = beschreibeBeleg(belegId);
  const error = deleteBeleg(actor, belegId);
  protokolliere({
    akteur: actor,
    aktion: 'beleg.loeschen',
    gegenstand: beleg?.text ?? `Beleg ${belegId}`,
    betroffen: beleg?.betroffen ?? null,
    datum: beleg?.datum ?? null,
    vorher: beleg?.werte ?? null,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

export async function unlockMonthAction(userId: number, month: string): Promise<ActionState> {
  const actor = await requireRecht('abschluss.verwalten');
  const error = unlockMonth(actor, userId, month);
  protokolliere({
    akteur: actor,
    aktion: 'monat.oeffnen',
    gegenstand: `Monatsabschluss ${fmtMonth(month)} aufgehoben`,
    betroffen: beschreibePerson(userId),
    datum: month,
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Abwesenheiten
// ---------------------------------------------------------------------------

function abwesenheitInputFromForm(formData: FormData): AbwesenheitInput | string {
  const von = String(formData.get('von') ?? '').trim();
  const bis = String(formData.get('bis') ?? '').trim();
  const art = String(formData.get('art') ?? '');
  if (!(ABWESENHEIT_ARTEN as string[]).includes(art)) return 'Bitte eine Art der Abwesenheit wählen.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    return 'Bitte den ersten und den letzten Tag angeben.';
  }
  const rohMinuten = formData.get('minuten');
  const minuten = rohMinuten === null ? undefined : Number(rohMinuten);
  if (minuten !== undefined && !Number.isInteger(minuten)) return 'Bitte die Minuten als ganze Zahl angeben.';
  return {
    von,
    bis,
    art: art as AbwesenheitArt,
    notiz: String(formData.get('notiz') ?? ''),
    minuten,
    ruecksprache_vorgesetzte: Boolean(formData.get('ruecksprache')),
  };
}

export async function abwesenheitSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.beantragen');
  const input = abwesenheitInputFromForm(formData);
  if (typeof input === 'string') return {error: input};
  const id = Number(formData.get('abwesenheitId') ?? 0);
  const userId = Number(formData.get('userId') ?? actor.id);

  // Die Notiz steht bewusst nicht in der Gegenüberstellung, wenn es um Krank
  // geht: das Feld gibt es dort nicht (Art. 9 DSGVO), und ein Protokoll wäre
  // die zweite Stelle, an der eine Diagnose landen könnte.
  const nachher = {
    Art: ART_LABEL[input.art],
    Von: fmtDate(input.von),
    Bis: fmtDate(input.bis),
    Notiz: input.art === 'krank' ? null : input.notiz || null,
    Umfang: input.minuten !== undefined ? `${input.minuten} Min.` : null,
    Rücksprache: istAntrag(input.art) ? (input.ruecksprache_vorgesetzte ? 'bestätigt' : 'nein') : null,
  };

  if (id) {
    const vorher = beschreibeAbwesenheit(id);
    const inhaberId = abwesenheitById(id)?.user_id ?? userId;
    const error = updateAbwesenheit(actor, id, input);
    protokolliere({
      akteur: actor,
      aktion: 'abwesenheit.aendern',
      gegenstand: vorher?.text ?? `${ART_LABEL[input.art]} ${fmtDateRange(input.von, input.bis)}`,
      betroffen: vorher?.betroffen ?? null,
      datum: input.von,
      vorher: vorher?.werte ?? null,
      nachher,
      fehler: error,
    });
    if (error) return {error};
    await syncGoogleAbwesenheiten(inhaberId);
    revalidatePath('/', 'layout');
    return OK;
  }

  const result = createAbwesenheit(actor, userId, input);
  protokolliere({
    akteur: actor,
    aktion: 'abwesenheit.anlegen',
    gegenstand: `${ART_LABEL[input.art]} ${fmtDateRange(input.von, input.bis)}`,
    betroffen: beschreibePerson(userId),
    datum: input.von,
    nachher,
    fehler: 'error' in result ? result.error : null,
  });
  if ('error' in result) return {error: result.error};

  // Eine Krankmeldung darf ihre Bescheinigung gleich mitbringen. Die Datei wird
  // erst abgelegt, wenn die Spanne steht — sonst bliebe bei jedem
  // Formularfehler eine verwaiste Datei liegen.
  const eingang = formData.get('au');
  if (eingang instanceof File && eingang.size > 0) {
    const gespeichert = await speichereAuDatei(eingang, input.von.slice(0, 4));
    if (typeof gespeichert === 'string') return {error: gespeichert};
    const fehler = setAuDatei(actor, result.id, {...gespeichert, name: eingang.name});
    if (fehler) return {error: fehler};
  }

  await syncGoogleAbwesenheiten(userId);
  // Eine Meldung gilt sofort und ist damit schon geschehen — der Prüfkreis
  // erfährt es hier. Ein Antrag ist an dieser Stelle noch ein Entwurf und
  // wartet auf niemanden; seine Nachricht geht beim Einreichen hinaus.
  await meldeSpanne(result.id);
  revalidatePath('/', 'layout');
  return OK;
}

/**
 * Die Nachricht an den Prüfkreis zu einer Spanne — aus der ID, weil der Zustand
 * nach der Buchung zählt und nicht der davor. Tut nichts, solange die Spanne
 * noch niemanden angeht (Entwurf) oder das Konto verschwunden ist.
 */
async function meldeSpanne(id: number): Promise<void> {
  const a = abwesenheitById(id);
  if (!a || a.status === 'entwurf' || a.status === 'abgelehnt') return;
  const inhaber = getUser(a.user_id);
  if (!inhaber) return;
  // Nur beim Urlaub kostet die Spanne Anspruch; sonst wäre die Zeile eine
  // Zahl ohne Bedeutung.
  const kosten = a.art === 'urlaub' ? mitTagen(a, inhaber).arbeitstage.length : null;
  await meldeAbwesenheitEingegangen(a, inhaber.name, kosten);
}

/** Die Entscheidung an die betroffene Person — genehmigt oder zurückgewiesen. */
async function meldeEntscheidung(id: number, actorName: string, genehmigt: boolean): Promise<void> {
  const a = abwesenheitById(id);
  if (!a) return;
  const inhaber = getUser(a.user_id);
  // Was nach dieser Entscheidung noch frei ist — nur beim Urlaub, und nur,
  // wenn er auch gewährt wurde.
  const rest =
    inhaber && a.art === 'urlaub' && genehmigt
      ? restanspruch(anspruchFor(inhaber, a.von.slice(0, 4)))
      : null;
  await meldeAbwesenheitEntschieden(a, actorName, genehmigt, rest);
}

/** Dieselbe Sammelstelle wie bei der Reise: fünf Vorgänge, ein Verb Unterschied. */
async function abwesenheitVorgang(
  id: number,
  aktion:
    | 'abwesenheit.loeschen'
    | 'abwesenheit.einreichen'
    | 'abwesenheit.zurueckziehen'
    | 'abwesenheit.genehmigen'
    | 'abwesenheit.zurueckweisen'
    | 'abwesenheit.bescheinigung',
  actor: Awaited<ReturnType<typeof requireUser>>,
  lauf: () => string | null,
  notiz?: Record<string, string>,
): Promise<ActionState> {
  const a = beschreibeAbwesenheit(id);
  // Vor dem Lauf gemerkt: nach einem Löschen weiß niemand mehr, wessen
  // Kalender abzugleichen wäre.
  const inhaberId = abwesenheitById(id)?.user_id;
  const error = lauf();
  protokolliere({
    akteur: actor,
    aktion,
    gegenstand: a?.text ?? `Abwesenheit ${id}`,
    betroffen: a?.betroffen ?? null,
    datum: a?.datum ?? null,
    vorher: aktion === 'abwesenheit.loeschen' ? a?.werte ?? null : null,
    nachher: notiz ?? null,
    fehler: error,
  });
  if (!error && inhaberId) await syncGoogleAbwesenheiten(inhaberId);
  revalidatePath('/', 'layout');
  return {error};
}

export async function abwesenheitDeleteAction(id: number): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.beantragen');
  return abwesenheitVorgang(id, 'abwesenheit.loeschen', actor, () => deleteAbwesenheit(actor, id));
}

export async function abwesenheitEinreichenAction(id: number): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.beantragen');
  // Kein Versand: dass ein Antrag wartet, steht in der Prüfliste, mit Zähler
  // in der Seitenleiste. Post gibt es erst, wenn er liegen bleibt — siehe
  // lib/erinnerungen.ts.
  return abwesenheitVorgang(id, 'abwesenheit.einreichen', actor, () => abwesenheitEinreichen(actor, id));
}

export async function abwesenheitZurueckziehenAction(id: number): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.beantragen');
  const ergebnis = await abwesenheitVorgang(id, 'abwesenheit.zurueckziehen', actor, () =>
    abwesenheitZurueckziehen(actor, id),
  );
  // Wie bei der Reise: zurückgezogen heißt, die Frist beginnt beim erneuten
  // Einreichen von vorn.
  if (!ergebnis.error) vergiss('abwesenheit', id);
  return ergebnis;
}

export async function abwesenheitGenehmigenAction(id: number): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.pruefen');
  const a = abwesenheitById(id);
  // Die Selbstgenehmigung steht im Datensatz und gehört auch in den Nachweis:
  // es gibt keine zweite Instanz über der Verwaltung, und das wird benannt
  // statt still zugelassen.
  const selbst = a?.user_id === actor.id ? {Hinweis: 'Von der Verwaltung selbst genehmigt'} : undefined;
  const ergebnis = await abwesenheitVorgang(
    id,
    'abwesenheit.genehmigen',
    actor,
    () => abwesenheitGenehmigen(actor, id),
    selbst,
  );
  if (!ergebnis.error) await meldeEntscheidung(id, actor.name, true);
  return ergebnis;
}

export async function abwesenheitZurueckweisenAction(id: number, grund: string): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.pruefen');
  const ergebnis = await abwesenheitVorgang(
    id,
    'abwesenheit.zurueckweisen',
    actor,
    () => abwesenheitZurueckweisen(actor, id, grund),
    {Grund: grund.trim()},
  );
  if (!ergebnis.error) await meldeEntscheidung(id, actor.name, false);
  return ergebnis;
}

export async function auUploadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.beantragen');
  const id = Number(formData.get('abwesenheitId') ?? 0);
  const jahr = String(formData.get('jahr') ?? '').slice(0, 4);
  const eingang = formData.get('au');
  if (!(eingang instanceof File) || eingang.size === 0) return {error: 'Bitte eine Datei wählen.'};
  const gespeichert = await speichereAuDatei(eingang, jahr);
  if (typeof gespeichert === 'string') return {error: gespeichert};
  // Nur der Dateiname, nie der Inhalt und nie ein Befund: was in der
  // Bescheinigung steht, geht das Protokoll so wenig an wie die Anwendung.
  const {error} = await abwesenheitVorgang(id, 'abwesenheit.bescheinigung', actor, () =>
    setAuDatei(actor, id, {...gespeichert, name: eingang.name}),
  );
  if (error) return {error};
  return OK;
}

// ---------------------------------------------------------------------------
// Zugangscodes — die Einmalcodes hinterlegter Konten, je Zugang mit Leserkreis
// ---------------------------------------------------------------------------

/**
 * Formulardaten → Eingabe des Datensatzes. „selbst" ist im Formular ein
 * eigener Punkt, im Datensatz aber nur der Personenkreis mit genau dem
 * Anlegenden — eine Form weniger. Ob der Kreis der handelnden Person
 * überhaupt zusteht, entscheidet lib/zugangscodes.ts, nicht das Formular.
 */
function zugangEingabeAusForm(actorId: number, formData: FormData): ZugangskontoEingabe | string {
  const eingabe = String(formData.get('eingabe') ?? '').trim();
  let dienst = String(formData.get('dienst') ?? '').trim();
  let konto = String(formData.get('konto') ?? '').trim();

  const kreisRoh = String(formData.get('sichtbarkeit') ?? 'alle');
  const sichtbarkeit: ZugangskontoEingabe['sichtbarkeit'] =
    kreisRoh === 'rolle' ? 'rolle' : kreisRoh === 'personen' || kreisRoh === 'selbst' ? 'personen' : 'alle';
  const personen =
    kreisRoh === 'selbst'
      ? [actorId]
      : formData.getAll('personen').map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  const rollen = formData.getAll('rollen').map(String);
  const kreis = {sichtbarkeit, rollen, personen};

  // Ein otpauth-Link bringt alles mit; ein nackter Base32-Schlüssel nutzt die
  // beiden Namensfelder und das übliche Verfahren (SHA1, 6 Stellen, 30 s).
  // Beim Bearbeiten darf das Feld leer bleiben — das Geheimnis bleibt dann.
  if (eingabe.toLowerCase().startsWith('otpauth://')) {
    const geparst = otpauthParsen(eingabe);
    if (typeof geparst === 'string') return geparst;
    dienst = dienst || geparst.dienst;
    konto = konto || geparst.konto;
    return {dienst, konto: konto || null, secret: geparst.secret, verfahren: geparst.verfahren, ...kreis};
  }
  return {dienst, konto: konto || null, secret: eingabe, verfahren: VERFAHREN_STANDARD, ...kreis};
}

export async function zugangscodeAnlegenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('zugangscodes.erfassen');
  const angaben = zugangEingabeAusForm(actor.id, formData);
  if (typeof angaben === 'string') return {error: angaben};
  if (angaben.secret === '') {
    return {error: 'Bitte den Schlüssel des Dienstes oder den otpauth-Link einfügen.'};
  }

  const ergebnis = zugangskontoAnlegen(actor, angaben);
  if (typeof ergebnis === 'string') return {error: ergebnis};

  // Wie beim Passwort: die Tatsache ins Protokoll, das Geheimnis nie.
  protokolliere({
    akteur: actor,
    aktion: 'zugangscode.anlegen',
    gegenstand: `Zugangscode ${zugangskontoName(ergebnis)}`,
    betroffen: null,
    nachher: {
      Dienst: ergebnis.dienst,
      Konto: ergebnis.konto,
      Verfahren: `${ergebnis.algorithmus}, ${ergebnis.stellen} Stellen, alle ${ergebnis.periode} s`,
      'Sichtbar für': sichtbarkeitText(ergebnis) ?? 'Alle Angemeldeten',
    },
  });
  revalidatePath('/zugangscodes');
  return OK;
}

export async function zugangscodeAendernAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('zugangscodes.erfassen');
  const id = Number(formData.get('zugangId') ?? 0);
  const angaben = zugangEingabeAusForm(actor.id, formData);
  if (typeof angaben === 'string') return {error: angaben};

  const vorher = zugangskontoById(id);
  const vorherWerte = vorher
    ? {Dienst: vorher.dienst, Konto: vorher.konto, 'Sichtbar für': sichtbarkeitText(vorher) ?? 'Alle Angemeldeten'}
    : null;
  const error = zugangskontoAendern(actor, id, angaben);
  const nachher = error === null ? zugangskontoById(id) : null;
  protokolliere({
    akteur: actor,
    aktion: 'zugangscode.aendern',
    gegenstand: `Zugangscode ${zugangskontoName(nachher ?? vorher ?? {dienst: angaben.dienst, konto: angaben.konto})}`,
    betroffen: null,
    vorher: vorherWerte,
    nachher: nachher
      ? {
          Dienst: nachher.dienst,
          Konto: nachher.konto,
          'Sichtbar für': sichtbarkeitText(nachher) ?? 'Alle Angemeldeten',
          // Nur die Tatsache eines neuen Geheimnisses, nie sein Wert.
          Schlüssel: angaben.secret === '' ? 'unverändert' : 'ersetzt',
        }
      : null,
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/zugangscodes');
  return OK;
}

export async function zugangscodeLoeschungAnfordernAction(id: number): Promise<ActionState> {
  const actor = await requireRecht('zugangscodes.erfassen');
  const angefordert = zugangskontoLoeschungAnfordern(actor, id);
  if (typeof angefordert === 'string') return {error: angefordert};
  const name = zugangskontoName(angefordert.konto);
  await meldeZugangscodeLoeschenBestaetigen(actor, name, angefordert.token);
  protokolliere({
    akteur: actor,
    aktion: 'zugangscode.loeschen-angefordert',
    gegenstand: `Zugangscode ${name}`,
    betroffen: null,
  });
  return OK;
}

// ---------------------------------------------------------------------------
// Verbundene Apps — MedArbeiter als Anmeldestelle
// ---------------------------------------------------------------------------

export interface AppAnbindungState extends ActionState {
  /** Das App-Geheimnis, genau einmal nach Anlegen/Erneuern — danach gibt es nur noch den Hash. */
  secret: string | null;
}

function redirectUrisAusForm(formData: FormData): string[] {
  return String(formData.get('redirectUris') ?? '')
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean);
}

export async function appAnlegenAction(_prev: AppAnbindungState, formData: FormData): Promise<AppAnbindungState> {
  const actor = await requireRecht('apps.verwalten');
  const name = String(formData.get('name') ?? '');
  const uris = redirectUrisAusForm(formData);
  const ergebnis = await oauthClientAnlegen(actor, name, uris);
  if (typeof ergebnis === 'string') return {error: ergebnis, secret: null};
  // Wie beim Passwort und beim Zugangscode: die Tatsache ins Protokoll, das Geheimnis nie.
  protokolliere({
    akteur: actor,
    aktion: 'oauth.app-anlegen',
    gegenstand: `App-Anbindung ${ergebnis.client.name}`,
    betroffen: null,
    nachher: {
      App: ergebnis.client.name,
      'Client-ID': ergebnis.client.client_id,
      'Weiterleitungs-URIs': ergebnis.client.redirect_uris.join(', '),
    },
  });
  revalidatePath('/apps');
  return {error: null, secret: ergebnis.secret};
}

export async function appAendernAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRecht('apps.verwalten');
  const id = Number(formData.get('appId') ?? 0);
  const name = String(formData.get('name') ?? '');
  const uris = redirectUrisAusForm(formData);
  const vorher = oauthClientNachNummer(id);
  const error = oauthClientAendern(actor, id, {name, redirectUris: uris});
  const nachher = error === null ? oauthClientNachNummer(id) : null;
  protokolliere({
    akteur: actor,
    aktion: 'oauth.app-aendern',
    gegenstand: `App-Anbindung ${(nachher ?? vorher)?.name ?? name}`,
    betroffen: null,
    vorher: vorher ? {App: vorher.name, 'Weiterleitungs-URIs': vorher.redirect_uris.join(', ')} : null,
    nachher: nachher ? {App: nachher.name, 'Weiterleitungs-URIs': nachher.redirect_uris.join(', ')} : null,
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/apps');
  return OK;
}

export async function appAktivAction(id: number, aktiv: boolean): Promise<ActionState> {
  const actor = await requireRecht('apps.verwalten');
  const anbindung = oauthClientNachNummer(id);
  const error = oauthClientSetzeAktiv(actor, id, aktiv);
  protokolliere({
    akteur: actor,
    aktion: 'oauth.app-aktiv',
    gegenstand: `App-Anbindung ${anbindung?.name ?? id}`,
    betroffen: null,
    nachher: {Zugang: aktiv ? 'freigegeben' : 'gesperrt'},
    fehler: error,
  });
  if (error) return {error};
  revalidatePath('/apps');
  return OK;
}

export async function appSecretErneuernAction(id: number): Promise<AppAnbindungState> {
  const actor = await requireRecht('apps.verwalten');
  const anbindung = oauthClientNachNummer(id);
  const ergebnis = await oauthClientSecretErneuern(actor, id);
  protokolliere({
    akteur: actor,
    aktion: 'oauth.app-schluessel',
    gegenstand: `App-Anbindung ${anbindung?.name ?? id}`,
    betroffen: null,
    // Nur die Tatsache — das alte Geheimnis ist damit ungültig, das neue wird einmal angezeigt.
    nachher: {'App-Geheimnis': 'erneuert'},
    fehler: typeof ergebnis === 'string' ? ergebnis : null,
  });
  if (typeof ergebnis === 'string') return {error: ergebnis, secret: null};
  revalidatePath('/apps');
  return {error: null, secret: ergebnis.secret};
}

export async function uebertragSaveAction(userId: number, jahr: string, tage: number): Promise<ActionState> {
  const actor = await requireRecht('abwesenheit.pruefen');
  const error = setUebertrag(actor, userId, jahr, tage);
  protokolliere({
    akteur: actor,
    aktion: 'uebertrag.setzen',
    gegenstand: `Urlaubsübertrag ${jahr}`,
    betroffen: beschreibePerson(userId),
    datum: `${jahr}-01-01`,
    nachher: {Übertrag: `${tage} Tage`},
    fehler: error,
  });
  revalidatePath('/', 'layout');
  return {error};
}
