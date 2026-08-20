/**
 * Das Zeichenvokabular der App.
 *
 * Ein Sinn, ein Sinnbild — überall dasselbe. Komponenten benennen nie ein
 * Piktogramm, sondern eine Bedeutung (`sinn="einstempeln"`), damit „bearbeiten"
 * in der Belegzeile, im Team-Blatt und in der Mitarbeiterverwaltung nicht drei
 * verschiedene Stifte werden können. Wer ein neues Zeichen braucht, trägt es
 * hier ein — und sieht dabei, ob die Bedeutung schon eines hat.
 *
 * Phosphor über `@phosphor-icons/react`. Anders als der zuvor benutzte Satz
 * (Typicons) trägt Phosphor jede Bedeutung als EIN Zeichen mit einer
 * Gewichtsachse (`thin`…`bold`, `fill`, `duotone`) statt als zwei getrennt
 * exportierte Fassungen, von denen nur ein Teil überhaupt existiert. Damit gibt
 * es keine Bedeutung mehr, die ihre Form nicht wechseln kann — die zweite
 * Tabelle (`UMRISS`) und ihr stiller Rückfall auf die volle Form sind entfallen.
 * Die Formachse hat weiterhin genau zwei Werte:
 *
 *   voll    – Gewicht `fill`. Ein durchgehend gefülltes Zeichen: „läuft gerade /
 *             ist entschieden / ist ausgewählt". Der Regelfall.
 *   umriss  – Gewicht `bold`, NICHT `regular`. Ausschließlich für den nicht
 *             ausgewählten / nicht laufenden Zustand. `bold` statt `regular`,
 *             weil die Zeichen auch bei 14 px (`GROESSE.zeile`) neben 13-px-Text
 *             stehen: Phosphors Regelstrich misst 16 von 256 Einheiten und käme
 *             dort auf knapp 0,9 px, `bold` misst 24 und damit rund 1,3 px. Das
 *             ist die Masse, die früher die Fläche des Typicons trug. Gegen die
 *             volle Form bleibt `bold` trotzdem klar unterscheidbar — es ist ein
 *             Umriss, keine Fläche.
 *
 * Importiert wird der SSR-Eingang (`@phosphor-icons/react/ssr`), nicht der
 * Regeleingang: dessen Zeichen lesen `IconContext` über `useContext` und wären
 * damit aus Server-Komponenten nicht benutzbar. Dieses Modul wird aus beiden
 * Welten importiert (u. a. aus `app/(app)/kalender/page.tsx`), und einen
 * `IconContext` setzt die Anwendung nirgends.
 *
 * Die Zeichen heißen hier auf `…Icon`; die kurzen Namen (`Bed`, `Gear`, …) sind
 * im Paket als veraltet markiert.
 *
 * Jedes Sinnbild steht neben seiner Beschriftung und ist deshalb immer
 * `aria-hidden`. Ein Zeichen, das allein etwas behaupten müsste, gibt es nicht.
 */

import type {ComponentType, SVGProps} from 'react';
import type {Icon as PhosphorZeichen, IconWeight} from '@phosphor-icons/react';

import {
  AddressBookIcon,
  AirplaneLandingIcon,
  AirplaneTakeoffIcon,
  AirplaneTiltIcon,
  ArchiveIcon,
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  ArrowUUpLeftIcon,
  ArrowsClockwiseIcon,
  ArrowsMergeIcon,
  BedIcon,
  BookIcon,
  BriefcaseIcon,
  CalculatorIcon,
  CalendarIcon,
  CameraIcon,
  CarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartLineIcon,
  ChartLineUpIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CheckSquareIcon,
  CircleHalfIcon,
  CircleIcon,
  ClipboardTextIcon,
  ClockIcon,
  CodeIcon,
  CoffeeIcon,
  CreditCardIcon,
  DownloadSimpleIcon,
  EnvelopeIcon,
  EqualsIcon,
  FileCsvIcon,
  FlagIcon,
  GearIcon,
  GraduationCapIcon,
  GridNineIcon,
  HouseIcon,
  InfinityIcon,
  InfoIcon,
  KeyIcon,
  ListChecksIcon,
  LockIcon,
  LockOpenIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MoonStarsIcon,
  PaperclipIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  PrinterIcon,
  ProhibitIcon,
  PushPinIcon,
  PuzzlePieceIcon,
  ReceiptIcon,
  SealCheckIcon,
  SignOutIcon,
  SquaresFourIcon,
  StarIcon,
  StopIcon,
  SunIcon,
  TagIcon,
  ThermometerIcon,
  TicketIcon,
  TimerIcon,
  TrashIcon,
  TreeIcon,
  UploadSimpleIcon,
  UserIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersThreeIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react/ssr';

import type {AbwesenheitStatus, ReiseStatus} from '@/lib/db';
import type {TagArt} from '@/lib/pauschale';
import type {Erfassungsart, ProtokollBereich} from '@/lib/protokoll-arten';

/** Die zwei Formen, in denen ein Zeichen auftreten darf. */
export type Form = 'voll' | 'umriss';

/** Welches Phosphor-Gewicht jede Form trägt (Begründung siehe Kopf der Datei). */
const GEWICHT: Record<Form, IconWeight> = {
  voll: 'fill',
  umriss: 'bold',
};

/**
 * Was ein eingebackenes Zeichen annimmt. Genau Astryx' `IconType`
 * (`ComponentType<SVGProps<SVGSVGElement>>`), damit `SideNavItem.icon`,
 * `TextInput.startIcon` und Verwandte es ohne Umweg nehmen — und damit die
 * eingebackenen Fassungen unten einen `displayName` tragen dürfen.
 */
export type Zeichen = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Das Vokabular. Links steht die Bedeutung, rechts das Zeichen — und weil die
 * Bedeutung der Schlüssel ist, fällt eine Doppelung beim Eintragen auf. Jedes
 * Zeichen trägt beide Formen in sich; welche gezeichnet wird, entscheidet erst
 * das Gewicht beim Rendern.
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
  arbeit: BriefcaseIcon,
  /* Die drei Stempelhandlungen als ein Dreiklang: starten, anhalten, beenden.
     Der Kaffeebecher wanderte dabei zur Verpflegung, wo er die Pauschale
     bezeichnet — die Pause ist hier eine Uhrhandlung, keine Mahlzeit. */
  pause: PauseIcon,
  einstempeln: PlayIcon,
  ausstempeln: StopIcon,
  /** Ein Zeitpunkt: „seit 08:12". */
  uhrzeit: ClockIcon,
  /* Eine verstrichene Spanne: „7:20 Std. heute". Phosphor hat keine Stoppuhr;
     der Kurzzeitmesser ist dasselbe Ding und steht klar gegen die Uhr. */
  dauer: TimerIcon,
  feierabend: HouseIcon,
  /** Die Schicht, die von gestern herüberläuft. */
  nachtschicht: MoonStarsIcon,
  /** Ein Eintrag ohne Ende — nicht dasselbe wie „läuft gerade". */
  ohneEnde: InfinityIcon,

  // ── Die Zeiträume ────────────────────────────────────────────────────────
  tag: SunIcon,
  /* Woche und Jahr haben kein eigenes Kalenderblatt; das Raster steht für die
     Menge der Tage, die man auf einmal sieht: neun kleine Felder gegen vier
     große Viertel. */
  woche: GridNineIcon,
  monat: CalendarIcon,
  jahr: SquaresFourIcon,
  konto: ChartLineIcon,
  /** Der Sprung zurück in die Gegenwart. */
  jetzt: PushPinIcon,

  // ── Tagesarten ───────────────────────────────────────────────────────────
  arbeitstag: BriefcaseIcon,
  /* Der Bereich „Abwesenheit" braucht ein eigenes Zeichen und nicht das des
     Urlaubs: in einer Liste, die beides führt, stünde sonst zweimal derselbe
     Baum für zwei verschiedene Dinge. Der Pfeil aus dem Rahmen heraus sagt,
     was alle vier Arten teilen — an diesem Tag nicht am Platz. */
  abwesenheit: ArrowSquareOutIcon,
  urlaub: TreeIcon,
  krank: ThermometerIcon,
  feiertag: FlagIcon,
  freizeitausgleich: ArrowsClockwiseIcon,
  fortbildung: GraduationCapIcon,

  // ── Reisen und Spesen ────────────────────────────────────────────────────
  /* Das geneigte Flugzeug ist der Bereich und der ganz auswärtige Tag; Start
     und Landung stehen unten für die Richtung. Drei Zeichen einer Familie, in
     der die Bodenlinie den Unterschied trägt. */
  reise: AirplaneTiltIcon,
  anreise: AirplaneTakeoffIcon,
  abreise: AirplaneLandingIcon,
  /** Halber und voller Satz als halb bzw. ganz gefüllter Kreis. */
  satzHalb: CircleHalfIcon,
  satzVoll: CircleIcon,
  verpflegung: CoffeeIcon,
  geld: CreditCardIcon,
  beleg: ReceiptIcon,
  datei: PaperclipIcon,
  /* Ein Bett. Feierabend ist das eigene Dach, die Übernachtung ein fremdes
     Bett — die Unterscheidung braucht jetzt keinen Umweg über zwei Formen
     desselben Hauses mehr. */
  uebernachtung: BedIcon,
  /* Die Fahrt ist im Belegformular die Fahrtkostenzeile; das Auto sagt das
     schneller als ein Wegweiser, und die öffentliche Fahrt hat mit `ticket`
     ihre eigene Zeile. */
  fahrt: CarIcon,
  parken: MapPinIcon,
  ticket: TicketIcon,
  sonstiges: PuzzlePieceIcon,
  einreichen: UploadSimpleIcon,
  genehmigen: CheckSquareIcon,
  zurueckweisen: ProhibitIcon,
  zurueckziehen: ArrowUUpLeftIcon,
  pruefen: ListChecksIcon,

  // ── Verwaltung ───────────────────────────────────────────────────────────
  team: UsersThreeIcon,
  /* Der Teamkalender zeigt Menschen über Tagen — nicht denselben Gegenstand
     wie „Team" (wer ist gerade da) und nicht denselben wie „Monat" (mein
     Zeitraum). Das Klemmbrett ist der Belegungsplan: wer diese Woche da ist. */
  teamkalender: ClipboardTextIcon,
  mitarbeiter: AddressBookIcon,
  /* Das Protokoll ist das Journal des Datensatzes. Bewusst weder Liste
     (`pruefen`) noch Beleg (`beleg`): es wird nicht abgearbeitet und ist keine
     Quittung, sondern das, was hinterher nachgelesen wird. */
  protokoll: BookIcon,
  /* Das Siegel der Hashkette: die Zeile bestätigt sich selbst und ihre
     Vorgängerin. Kein Schloss — hier ist nichts zugesperrt, hier ist etwas
     bezeugt. Typicons hatte kein Siegel und trug ersatzweise ein Lesezeichen;
     Phosphor hat eines, und zwar mit dem Haken darin. */
  siegel: SealCheckIcon,
  /** Den Monat zumachen und weglegen. */
  abschluss: ArchiveIcon,
  berichte: ChartBarIcon,
  einstellungen: GearIcon,
  abmelden: SignOutIcon,
  rolleMitarbeiter: UserIcon,
  rolleVerwaltung: StarIcon,
  /* Die benannten Angaben der Freigabeseite: wer (Name), erreichbar wo
     (email, oben), eingestuft wie (Rolle und Rechte). `person` teilt das
     Zeichen mit rolleMitarbeiter wie arbeit/arbeitstag ihres. */
  person: UserIcon,
  rolle: TagIcon,
  passwort: KeyIcon,
  /* Die geteilten Einmalcodes der gemeinsamen Firmenkonten. Bewusst nicht der
     Schlüssel: `passwort` ist das persönliche Geheimnis einer Person, der
     Zugangscode die geteilte, ablaufende Ziffernfolge. */
  zugangscode: CodeIcon,
  /* Deaktivieren und Reaktivieren treffen immer eine Person — das Zeichen
     sagt das jetzt mit, statt ein allgemeines Verbots- bzw. Wiederholzeichen
     zu tragen. */
  deaktivieren: UserMinusIcon,
  reaktivieren: UserPlusIcon,
  /* Eine andere Hausanwendung steckt sich bei MedArbeiter an und holt sich
     die Anmeldung hier ab. Der Stecker, nicht der Schlüssel: verwaltet wird
     die Verbindung, nicht ein Geheimnis. */
  verbundeneApps: PlugIcon,
  summe: EqualsIcon,

  // ── Aktionen ─────────────────────────────────────────────────────────────
  hinzufuegen: PlusIcon,
  entfernen: TrashIcon,
  bearbeiten: PencilSimpleIcon,
  bestaetigen: CheckIcon,
  drucken: PrinterIcon,
  csv: FileCsvIcon,
  erneut: ArrowClockwiseIcon,
  suchen: MagnifyingGlassIcon,
  /** Einen QR-Code mit der Kamera lesen — nicht `suchen`: gesucht wird in Daten, gescannt in der Welt. */
  scannen: CameraIcon,
  /* Die App auf das Gerät holen. Der Pfeil nach unten ins Gerät ist das
     Zeichen, das jeder App-Laden benutzt — hier für den Hinweis, dass
     MedArbeiter sich installieren lässt. */
  installieren: DownloadSimpleIcon,
  /** Zusammenführen zweier Stempelungen — die Einstellung dazu. */
  zusammenfuehren: ArrowsMergeIcon,

  // ── Zustände und Hinweise ────────────────────────────────────────────────
  hinweis: InfoIcon,
  warnung: WarningIcon,
  fehler: XCircleIcon,
  gesperrt: LockIcon,
  entsperrt: LockOpenIcon,
  /** „So entsteht die Zahl" — Zeitkonto wie Verpflegungspauschale. */
  herleitung: CalculatorIcon,
  /* Die Richtung einer Zahl über die Zeit. Bewusst nicht dasselbe Zeichen wie
     `konto`: dort steht der Verlauf selbst, hier seine Neigung. */
  trend: ChartLineUpIcon,
  email: EnvelopeIcon,
  /* Ein Wort an einer Personenkarte. Bewusst nicht `email`: die Post verlässt
     das Haus, ein Kommentar bleibt darin und steht dort, wo er gemeint ist. */
  kommentar: ChatCircleTextIcon,

  // ── Schrittwerk ──────────────────────────────────────────────────────────
  zurueck: CaretLeftIcon,
  weiter: CaretRightIcon,
  /* Die Seitenleiste zur Zeichenspalte zusammenziehen und wieder auf. Dasselbe
     Zeichen wie `zurueck`/`weiter`, aber nicht dieselbe Bedeutung: hier bewegt
     sich die Leiste, dort der Zeitraum. */
  einklappen: CaretLeftIcon,
  ausklappen: CaretRightIcon,
  aufklappen: CaretDownIcon,
  /** Zu einem anderen Ding hin — nicht ein Zeitraum weiter. */
  hin: ArrowRightIcon,
  /** Der Weg zurück in der Hierarchie (Brotkrume). */
  hinauf: ArrowLeftIcon,
} as const satisfies Record<string, PhosphorZeichen>;

export type Sinn = keyof typeof SINNBILD;

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
  const Zeichen = SINNBILD[sinn];
  return (
    <Zeichen
      size={GROESSE[groesse]}
      color={TON[ton]}
      weight={GEWICHT[form]}
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
  const Grund = SINNBILD[sinn];
  const Gebacken: Zeichen = (props) => (
    <Grund {...props} weight={GEWICHT[form]} aria-hidden focusable={false} />
  );
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
