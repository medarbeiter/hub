/**
 * Das Zeichenvokabular der App.
 *
 * Ein Sinn, ein Sinnbild — überall dasselbe. Komponenten benennen nie ein
 * Piktogramm, sondern eine Bedeutung (`sinn="einstempeln"`), damit „bearbeiten"
 * in der Belegzeile, im Team-Blatt und in der Mitarbeiterverwaltung nicht drei
 * verschiedene Stifte werden können. Wer ein neues Zeichen braucht, trägt es
 * hier ein — und sieht dabei, ob die Bedeutung schon eines hat.
 *
 * Typicons über `react-icons/ti`. Der Satz hat, anders als der zuvor benutzte,
 * KEINE Strichstärkenachse: jedes Zeichen kommt in genau einer Stärke, und nur
 * zu einem Teil der Zeichen gibt es eine `…Outline`-Fassung. Die drei Stärken
 * von früher (bold ≤16 px, regular ≥20 px, fill für „ausgewählt") lassen sich
 * damit nicht nachbauen. An ihre Stelle tritt eine Formachse mit zwei Werten:
 *
 *   voll    – der Regelfall. Ein durchgehend gefülltes Zeichen, in jeder Größe
 *             dasselbe. Weil Typicons flächig statt strichig zeichnet, tragen
 *             auch 14-px-Glyphen genug Masse für die 3:1-Grenze bei
 *             nicht-textlichen Bedienelementen — die Stärke, die früher „bold"
 *             beisteuern musste, steckt hier in der Fläche.
 *   umriss  – dasselbe Zeichen als Kontur, ausschließlich für den NICHT
 *             ausgewählten / nicht laufenden Zustand. Damit bleibt der Kanal
 *             erhalten, den früher `fill` trug: gefüllt heißt „läuft gerade /
 *             ist entschieden / ist ausgewählt", Kontur heißt das Gegenteil.
 *
 * `UMRISS` unten führt nur die Bedeutungen, für die Typicons eine Kontur
 * mitbringt. Für alle anderen fällt `umriss()` auf die volle Form zurück; die
 * Auswahl trägt dort allein die Hinterlegung der Navigation bzw. der goldene
 * Unterstrich der Bereichsleiste. Betroffen sind `mitarbeiter` (Typicons hat
 * zu `TiContacts` keine Kontur), `abschluss` (zu `TiArchive` ebenso wenig),
 * `protokoll` (`TiBook`), `teamkalender` (`TiClipboard`) und `siegel`
 * (`TiBookmark`).
 *
 * Jedes Sinnbild steht neben seiner Beschriftung und ist deshalb immer
 * `aria-hidden`. Ein Zeichen, das allein etwas behaupten müsste, gibt es nicht.
 *
 * `react-icons/ti` ist ein Sammelmodul; der Produktionsbau schüttelt die nicht
 * benutzten Zeichen heraus. Es ist kontextfrei (die Bibliothek greift nur auf
 * `React.createContext` zu, wenn es das gibt) und damit sowohl aus Server- als
 * auch aus Client-Komponenten importierbar.
 */

import type {ComponentType} from 'react';
import type {IconBaseProps} from 'react-icons';

import {
  TiAdjustContrast,
  TiArchive,
  TiArrowBack,
  TiArrowDownThick,
  TiArrowLeft,
  TiArrowRight,
  TiArrowSortedDown,
  TiArrowSync,
  TiArrowUpThick,
  TiAttachment,
  TiAttachmentOutline,
  TiArrowBackOutline,
  TiArrowLeftOutline,
  TiArrowRightOutline,
  TiArrowSyncOutline,
  TiBook,
  TiBookmark,
  TiBriefcase,
  TiCalculator,
  TiCalendar,
  TiCalendarOutline,
  TiCamera,
  TiCameraOutline,
  TiCancel,
  TiCancelOutline,
  TiChartArea,
  TiChartAreaOutline,
  TiChartBar,
  TiChartBarOutline,
  TiChartLine,
  TiChartLineOutline,
  TiChevronLeft,
  TiChevronLeftOutline,
  TiChevronRight,
  TiChevronRightOutline,
  TiClipboard,
  TiCode,
  TiCodeOutline,
  TiCoffee,
  TiCog,
  TiCogOutline,
  TiContacts,
  TiCreditCard,
  TiDirections,
  TiDocument,
  TiDocumentText,
  TiDownload,
  TiDownloadOutline,
  TiEquals,
  TiEqualsOutline,
  TiExport,
  TiExportOutline,
  TiFlag,
  TiFlagOutline,
  TiFlowMerge,
  TiGroup,
  TiGroupOutline,
  TiHome,
  TiHomeOutline,
  TiInfinity,
  TiInfinityOutline,
  TiInfoLarge,
  TiInfoLargeOutline,
  TiInputChecked,
  TiInputCheckedOutline,
  TiKey,
  TiKeyOutline,
  TiLocation,
  TiLocationOutline,
  TiLockClosed,
  TiLockClosedOutline,
  TiLockOpen,
  TiLockOpenOutline,
  TiMail,
  TiMediaPause,
  TiMediaPauseOutline,
  TiMediaPlay,
  TiMediaPlayOutline,
  TiMediaRecord,
  TiMediaRecordOutline,
  TiMediaStop,
  TiMediaStopOutline,
  TiMortarBoard,
  TiPencil,
  TiPin,
  TiPinOutline,
  TiPlane,
  TiPlaneOutline,
  TiPlug,
  TiPlus,
  TiPlusOutline,
  TiPower,
  TiPowerOutline,
  TiPrinter,
  TiPuzzle,
  TiPuzzleOutline,
  TiRefresh,
  TiRefreshOutline,
  TiStarburst,
  TiStarburstOutline,
  TiStopwatch,
  TiThLarge,
  TiThLargeOutline,
  TiThList,
  TiThListOutline,
  TiThSmall,
  TiThSmallOutline,
  TiThermometer,
  TiTick,
  TiTickOutline,
  TiTicket,
  TiTime,
  TiTimes,
  TiTimesOutline,
  TiTrash,
  TiTree,
  TiUpload,
  TiUploadOutline,
  TiUser,
  TiUserAdd,
  TiUserAddOutline,
  TiUserDelete,
  TiUserDeleteOutline,
  TiUserOutline,
  TiWarning,
  TiWarningOutline,
  TiWeatherNight,
  TiWeatherSunny,
  TiZoom,
  TiZoomOutline,
} from 'react-icons/ti';

import type {AbwesenheitStatus, ReiseStatus} from '@/lib/db';
import type {TagArt} from '@/lib/pauschale';
import type {Erfassungsart, ProtokollBereich} from '@/lib/protokoll-arten';

/** Die zwei Formen, in denen ein Zeichen auftreten darf. */
export type Form = 'voll' | 'umriss';

/**
 * Was ein Typicon annimmt — react-icons reicht alles Weitere an das <svg>.
 * `ComponentType` statt `IconType`, damit die eingebackenen Fassungen unten
 * einen `displayName` tragen dürfen.
 */
export type Zeichen = ComponentType<IconBaseProps>;

/**
 * Das Vokabular. Links steht die Bedeutung, rechts das Zeichen — und weil die
 * Bedeutung der Schlüssel ist, fällt eine Doppelung beim Eintragen auf.
 *
 * Bewusste Gleichsetzungen (dieselbe Bedeutung, also dasselbe Zeichen):
 *   arbeit = arbeitstag  – die Tagesart „Arbeitstag" ist Arbeit; und „Pause
 *                          beenden" trägt ebenfalls `arbeit`, weil es genau
 *                          das heißt: zurück an die Arbeit.
 *   reise                – der Bereich „Reisen & Spesen" und der Weg dorthin
 *                          („Als Dienstreise abrechnen") sind dasselbe Ziel.
 *   herleitung           – „So entsteht die Zahl" im Zeitkonto wie in der
 *                          Verpflegungspauschale: dieselbe Frage.
 *   erneut = reaktivieren – beide heißen „noch einmal".
 */
export const SINNBILD = {
  // ── Zeit und Stempeln ────────────────────────────────────────────────────
  arbeit: TiBriefcase,
  /* Die drei Stempelhandlungen als ein Dreiklang: starten, anhalten, beenden.
     Der Kaffeebecher wanderte dabei zur Verpflegung, wo er die Pauschale
     bezeichnet — die Pause ist hier eine Uhrhandlung, keine Mahlzeit. */
  pause: TiMediaPause,
  einstempeln: TiMediaPlay,
  ausstempeln: TiMediaStop,
  /** Ein Zeitpunkt: „seit 08:12". */
  uhrzeit: TiTime,
  /** Eine verstrichene Spanne: „7:20 Std. heute". */
  dauer: TiStopwatch,
  feierabend: TiHome,
  /** Die Schicht, die von gestern herüberläuft. */
  nachtschicht: TiWeatherNight,
  /** Ein Eintrag ohne Ende — nicht dasselbe wie „läuft gerade". */
  ohneEnde: TiInfinity,

  // ── Die Zeiträume ────────────────────────────────────────────────────────
  tag: TiWeatherSunny,
  /* Woche und Jahr haben kein eigenes Kalenderblatt in Typicons; das Raster
     steht für die Menge der Tage, die man auf einmal sieht: sieben kleine
     Felder gegen vier große Viertel. */
  woche: TiThSmall,
  monat: TiCalendar,
  jahr: TiThLarge,
  konto: TiChartLine,
  /** Der Sprung zurück in die Gegenwart. */
  jetzt: TiPin,

  // ── Tagesarten ───────────────────────────────────────────────────────────
  arbeitstag: TiBriefcase,
  /* Der Bereich „Abwesenheit" braucht ein eigenes Zeichen und nicht das des
     Urlaubs: in einer Liste, die beides führt, stünde sonst zweimal derselbe
     Baum für zwei verschiedene Dinge. Der Pfeil aus dem Rahmen heraus sagt,
     was alle vier Arten teilen — an diesem Tag nicht am Platz. */
  abwesenheit: TiExport,
  urlaub: TiTree,
  krank: TiThermometer,
  feiertag: TiFlag,
  freizeitausgleich: TiArrowSync,
  fortbildung: TiMortarBoard,

  // ── Reisen und Spesen ────────────────────────────────────────────────────
  reise: TiPlane,
  /* Typicons kennt nur ein Flugzeug, keinen Start und keine Landung: die
     Richtung trägt hier der Pfeil. */
  anreise: TiArrowUpThick,
  abreise: TiArrowDownThick,
  /** Halber und voller Satz als halb bzw. ganz gefüllter Kreis. */
  satzHalb: TiAdjustContrast,
  satzVoll: TiMediaRecord,
  verpflegung: TiCoffee,
  geld: TiCreditCard,
  beleg: TiDocumentText,
  datei: TiAttachment,
  /* Kein Bett im Satz. Das Dach als Kontur — Feierabend ist das eigene Dach,
     die Übernachtung ein fremdes. */
  uebernachtung: TiHomeOutline,
  fahrt: TiDirections,
  parken: TiLocation,
  ticket: TiTicket,
  sonstiges: TiPuzzle,
  einreichen: TiUpload,
  genehmigen: TiInputChecked,
  zurueckweisen: TiCancel,
  zurueckziehen: TiArrowBack,
  pruefen: TiThList,

  // ── Verwaltung ───────────────────────────────────────────────────────────
  team: TiGroup,
  /* Der Teamkalender zeigt Menschen über Tagen — nicht denselben Gegenstand
     wie „Team" (wer ist gerade da) und nicht denselben wie „Monat" (mein
     Zeitraum). Das Klemmbrett ist der Belegungsplan: wer diese Woche da ist. */
  teamkalender: TiClipboard,
  mitarbeiter: TiContacts,
  /* Das Protokoll ist das Journal des Datensatzes. Bewusst weder Liste
     (`pruefen`) noch Beleg (`beleg`): es wird nicht abgearbeitet und ist keine
     Quittung, sondern das, was hinterher nachgelesen wird. */
  protokoll: TiBook,
  /* Das Siegel der Hashkette: die Zeile bestätigt sich selbst und ihre
     Vorgängerin. Kein Schloss — hier ist nichts zugesperrt, hier ist etwas
     bezeugt. */
  siegel: TiBookmark,
  /** Den Monat zumachen und weglegen. */
  abschluss: TiArchive,
  berichte: TiChartBar,
  einstellungen: TiCog,
  abmelden: TiPower,
  rolleMitarbeiter: TiUser,
  rolleVerwaltung: TiStarburst,
  passwort: TiKey,
  /* Die geteilten Einmalcodes der gemeinsamen Firmenkonten. Bewusst nicht der
     Schlüssel: `passwort` ist das persönliche Geheimnis einer Person, der
     Zugangscode die geteilte, ablaufende Ziffernfolge. */
  zugangscode: TiCode,
  /* Deaktivieren und Reaktivieren treffen immer eine Person — das Zeichen
     sagt das jetzt mit, statt ein allgemeines Verbots- bzw. Wiederholzeichen
     zu tragen. */
  deaktivieren: TiUserDelete,
  reaktivieren: TiUserAdd,
  /* Eine andere Hausanwendung steckt sich bei MedArbeiter an und holt sich
     die Anmeldung hier ab. Der Stecker, nicht der Schlüssel: verwaltet wird
     die Verbindung, nicht ein Geheimnis. */
  verbundeneApps: TiPlug,
  summe: TiEquals,

  // ── Aktionen ─────────────────────────────────────────────────────────────
  hinzufuegen: TiPlus,
  entfernen: TiTrash,
  bearbeiten: TiPencil,
  bestaetigen: TiTick,
  drucken: TiPrinter,
  csv: TiDocument,
  erneut: TiRefresh,
  suchen: TiZoom,
  /** Einen QR-Code mit der Kamera lesen — nicht `suchen`: gesucht wird in Daten, gescannt in der Welt. */
  scannen: TiCamera,
  /* Die App auf das Gerät holen. Der Pfeil nach unten ins Gerät ist das
     Zeichen, das jeder App-Laden benutzt — hier für den Hinweis, dass
     MedArbeiter sich installieren lässt. */
  installieren: TiDownload,
  /** Zusammenführen zweier Stempelungen — die Einstellung dazu. */
  zusammenfuehren: TiFlowMerge,

  // ── Zustände und Hinweise ────────────────────────────────────────────────
  hinweis: TiInfoLarge,
  warnung: TiWarning,
  fehler: TiTimes,
  gesperrt: TiLockClosed,
  entsperrt: TiLockOpen,
  /** „So entsteht die Zahl" — Zeitkonto wie Verpflegungspauschale. */
  herleitung: TiCalculator,
  trend: TiChartArea,
  email: TiMail,

  // ── Schrittwerk ──────────────────────────────────────────────────────────
  zurueck: TiChevronLeft,
  weiter: TiChevronRight,
  aufklappen: TiArrowSortedDown,
  /** Zu einem anderen Ding hin — nicht ein Zeitraum weiter. */
  hin: TiArrowRight,
  /** Der Weg zurück in der Hierarchie (Brotkrume). */
  hinauf: TiArrowLeft,
} as const satisfies Record<string, Zeichen>;

export type Sinn = keyof typeof SINNBILD;

/**
 * Die Konturfassungen. Nur was Typicons mitbringt steht hier; alles andere
 * fällt auf die volle Form zurück (siehe Kopf dieser Datei).
 */
const UMRISS = {
  abwesenheit: TiExportOutline,
  pause: TiMediaPauseOutline,
  einstempeln: TiMediaPlayOutline,
  ausstempeln: TiMediaStopOutline,
  ohneEnde: TiInfinityOutline,
  woche: TiThSmallOutline,
  monat: TiCalendarOutline,
  jahr: TiThLargeOutline,
  konto: TiChartLineOutline,
  jetzt: TiPinOutline,
  feiertag: TiFlagOutline,
  freizeitausgleich: TiArrowSyncOutline,
  reise: TiPlaneOutline,
  satzVoll: TiMediaRecordOutline,
  datei: TiAttachmentOutline,
  parken: TiLocationOutline,
  sonstiges: TiPuzzleOutline,
  einreichen: TiUploadOutline,
  genehmigen: TiInputCheckedOutline,
  zurueckweisen: TiCancelOutline,
  zurueckziehen: TiArrowBackOutline,
  pruefen: TiThListOutline,
  team: TiGroupOutline,
  berichte: TiChartBarOutline,
  einstellungen: TiCogOutline,
  abmelden: TiPowerOutline,
  rolleMitarbeiter: TiUserOutline,
  rolleVerwaltung: TiStarburstOutline,
  passwort: TiKeyOutline,
  zugangscode: TiCodeOutline,
  deaktivieren: TiUserDeleteOutline,
  reaktivieren: TiUserAddOutline,
  summe: TiEqualsOutline,
  hinzufuegen: TiPlusOutline,
  bestaetigen: TiTickOutline,
  erneut: TiRefreshOutline,
  hinweis: TiInfoLargeOutline,
  warnung: TiWarningOutline,
  fehler: TiTimesOutline,
  gesperrt: TiLockClosedOutline,
  entsperrt: TiLockOpenOutline,
  trend: TiChartAreaOutline,
  feierabend: TiHomeOutline,
  zurueck: TiChevronLeftOutline,
  weiter: TiChevronRightOutline,
  hin: TiArrowRightOutline,
  hinauf: TiArrowLeftOutline,
  suchen: TiZoomOutline,
  scannen: TiCameraOutline,
  installieren: TiDownloadOutline,
} as const satisfies Partial<Record<Sinn, Zeichen>>;

function zeichenFuer(sinn: Sinn, form: Form): Zeichen {
  if (form === 'umriss') return (UMRISS as Partial<Record<Sinn, Zeichen>>)[sinn] ?? SINNBILD[sinn];
  return SINNBILD[sinn];
}

const GROESSE = {
  /** In dichten Zeilen neben 13-px-Text. */
  zeile: 14,
  /** Der Regelfall: Schaltflächen, Beschriftungen, Navigation. */
  normal: 16,
  /** Kartenüberschriften und Seitentitel. */
  gross: 20,
  /** Leerzustände — das Zeichen trägt die leere Fläche. */
  leer: 32,
} as const;

/**
 * Die erlaubten Farben. `erben` ist der Regelfall: in einer Schaltfläche nimmt
 * das Zeichen damit deren Tinte an, und die Dunkle-Tinte-auf-Gold-Regel gilt
 * automatisch mit, statt an jeder Aufrufstelle wiederholt zu werden.
 */
const TON = {
  erben: 'currentColor',
  primaer: 'var(--color-icon-primary)',
  sekundaer: 'var(--color-icon-secondary)',
  akzent: 'var(--color-icon-accent)',
  warnung: 'var(--color-warning)',
  fehler: 'var(--color-error)',
  erfolg: 'var(--color-success)',
} as const;

interface SinnbildProps {
  sinn: Sinn;
  groesse?: keyof typeof GROESSE;
  ton?: keyof typeof TON;
  /**
   * Nur auf `umriss` setzen, um „nicht ausgewählt / läuft nicht" zu zeigen.
   * Der Regelfall ist die volle Form.
   */
  form?: Form;
  className?: string;
}

/**
 * Ein Zeichen aus dem Vokabular. Immer dekorativ: die Beschriftung daneben
 * trägt die Bedeutung, das Zeichen macht sie nur schneller auffindbar.
 */
export function Sinnbild({sinn, groesse = 'normal', ton = 'erben', form = 'voll', className}: SinnbildProps) {
  const Zeichen = zeichenFuer(sinn, form);
  return (
    <Zeichen
      size={GROESSE[groesse]}
      color={TON[ton]}
      className={className}
      aria-hidden
      focusable={false}
      style={{flexShrink: 0}}
    />
  );
}

/**
 * Manche Astryx-Props verlangen eine Komponente statt eines Elements
 * (`SideNavItem.icon` / `.selectedIcon`, `TextInput.startIcon`) — dort lässt
 * sich `form` nicht durchreichen. Diese beiden Helfer backen sie ein.
 *
 * Der Cache ist nicht nur Sparsamkeit: eine bei jedem Render neu erzeugte
 * Komponente wäre für React ein neuer Typ und würde das Zeichen bei jedem
 * Navigationswechsel neu einhängen.
 */
const gebacken = new Map<string, Zeichen>();

function mitForm(sinn: Sinn, form: Form): Zeichen {
  const schluessel = `${sinn}:${form}`;
  const fertig = gebacken.get(schluessel);
  if (fertig) return fertig;
  const Grund = zeichenFuer(sinn, form);
  const Gebacken: Zeichen = (props) => <Grund {...props} aria-hidden focusable={false} />;
  Gebacken.displayName = `Sinnbild(${schluessel})`;
  gebacken.set(schluessel, Gebacken);
  return Gebacken;
}

/** Der Regelzustand eines Zeichens in einem Bedienelement: nicht ausgewählt. */
export function umriss(sinn: Sinn): Zeichen {
  return mitForm(sinn, 'umriss');
}

/** „Ausgewählt / läuft gerade / ist entschieden." */
export function gefuellt(sinn: Sinn): Zeichen {
  return mitForm(sinn, 'voll');
}

/**
 * Der Aufklapppfeil, den alle drei Stapel tragen — Tage, Reisen, Prüfliste.
 * Vorher stand dieselbe Drehung dreimal als Inline-Stil in den Komponenten;
 * die Bewegung war dabei an keiner der drei Stellen für `prefers-reduced-motion`
 * abgeschaltet. Jetzt an einer (siehe `.aufklapp-pfeil` in globals.css).
 */
export function Aufklapppfeil({offen}: {offen: boolean}) {
  return (
    <span className="aufklapp-pfeil" data-offen={offen ? 'true' : undefined}>
      <Sinnbild sinn="aufklappen" ton="sekundaer" />
    </span>
  );
}

// ── Übersetzungen aus der Domäne ───────────────────────────────────────────
//
// `DayTypeKind` braucht keine: seine Werte (`urlaub`, `krank`, `feiertag`,
// `freizeitausgleich`, `fortbildung`) sind absichtlich schon Schlüssel des
// Vokabulars, sodass `sinn={dayType}` genügt. Die beiden folgenden Unions
// heißen anders und werden hier übersetzt — an einer Stelle, damit eine
// Zuordnung nicht in drei Komponenten auseinanderläuft.

/** Die Art eines Reisetags: hin, ganz weg, zurück — oder alles an einem Tag. */
export const TAGART_SINN: Record<TagArt, Sinn> = {
  eintaegig: 'tag',
  anreise: 'anreise',
  zwischentag: 'reise',
  abreise: 'abreise',
};

/** Der Stand einer Reise im Ablauf. */
export const REISE_STATUS_SINN: Record<ReiseStatus, Sinn> = {
  entwurf: 'bearbeiten',
  eingereicht: 'einreichen',
  genehmigt: 'genehmigen',
  abgelehnt: 'zurueckweisen',
};

/**
 * Der Stand einer Abwesenheit. Dieselben vier Zeichen wie bei der Reise —
 * derselbe Ablauf trägt dieselben Zeichen. Nur `gemeldet` ist neu: eine
 * Krankmeldung durchläuft keine Prüfung, sie wird zur Kenntnis genommen.
 */
/**
 * Der Bereich einer Protokollzeile trägt das Zeichen, das dieser Teil der
 * Anwendung ohnehin trägt — wer im Protokoll einen Kalender sieht, weiß ohne
 * Legende, dass die Zeile aus „Meine Zeit" stammt. Deshalb steht hier keine
 * neue Bildsprache, sondern eine Zuordnung auf die vorhandene.
 *
 * `zugang` ist der einzige Bereich ohne eigenen Navigationseintrag: An- und
 * Abmelden wohnen im Fuß der Seitenleiste, und von dort kommt auch sein
 * Zeichen.
 */
export const PROTOKOLL_BEREICH_SINN: Record<ProtokollBereich, Sinn> = {
  zugang: 'abmelden',
  zeit: 'monat',
  abwesenheit: 'abwesenheit',
  spesen: 'reise',
  abschluss: 'abschluss',
  stammdaten: 'mitarbeiter',
  einstellungen: 'einstellungen',
};

/**
 * Wie die Zeit in den Datensatz kam — die drei Zeichen sind bewusst schon
 * vergeben:
 *
 *   `uhrzeit`    – die Uhr. Gestempelt heißt: an der Uhr, zum Ereignis.
 *   `bearbeiten` – der Stift. Nachgetragen heißt: von Hand geschrieben.
 *   `erneut`     – die Maschine hat es selbst getan, ohne dass jemand danach
 *                  gefragt hat.
 *
 * Keine neuen Glyphen: die Unterscheidung ist neu, die Bedeutungen sind es
 * nicht — eine Uhr für „gemessen“ und ein Stift für „geschrieben“ liest jeder
 * ohne Legende.
 */
export const ERFASSUNG_SINN: Record<Erfassungsart, Sinn> = {
  gestempelt: 'uhrzeit',
  nachgetragen: 'bearbeiten',
  automatisch: 'erneut',
};

export const ABWESENHEIT_STATUS_SINN: Record<AbwesenheitStatus, Sinn> = {
  entwurf: 'bearbeiten',
  eingereicht: 'einreichen',
  gemeldet: 'hinweis',
  genehmigt: 'genehmigen',
  abgelehnt: 'zurueckweisen',
};
