'use client';

import {
  HStack,
  Table,
  Text,
  VStack,
  pixel,
  proportional,
  useTableSortable,
  useTableSortableState,
  type TableColumn,
} from '@astryxdesign/core';
import {PersonZeichen} from './person-zeichen';
import {Verweis as Link} from './verweis';
import type {ReactNode} from 'react';
import {fmtDuration, fmtDurationSigned} from '@/lib/format';
import {Sinnbild} from './sinnbilder';
import type {PersonAngabe} from '@/lib/avatar';

/**
 * Eine Zeile der Personentafel.
 *
 * Zahlen kommen als Minuten herein und nicht als fertige Zeichenketten: sonst
 * sortierte „9:00" hinter „10:00", und genau das Sortieren war der Grund für
 * diese Tafel. Was gezeichnet wird, entsteht in `renderCell`.
 */
export interface PersonenZeile extends Record<string, unknown> {
  id: number;
  name: string;
  /**
   * Das Profilzeichen. Der Name bleibt daneben sichtbar — eine Tafel, die man
   * nach „wer weicht am weitesten ab" sortiert, wird an der Zeile gelesen, und
   * ein Bild allein wäre in einer sortierten Liste keine Kennung.
   */
  person?: PersonAngabe | null;
  /** Die zweite Zeile unter dem Namen — „40 Std./Woche". */
  unterzeile?: string | null;
  /** Macht den Namen zum Verweis. */
  href?: string | null;
  istMin?: number | null;
  sollMin?: number | null;
  saldoMin?: number | null;
  kontoMin?: number | null;
  /**
   * Die Ordnung, in der die Zustandsspalte sortiert — nicht das Zeichen selbst.
   * Auf dem Team-Blatt: eingestempelt vor Pause vor abwesend. So bleibt die
   * Auskunft „wer ist gerade da" die erste Lesart, ohne dass die Tabelle in
   * drei Gruppen zerfallen und damit unsortierbar werden müsste.
   */
  statusRang?: number;
  /** Vorgezeichnet von der Seite: StatusDot, Marken, Kleingrafik, Handlung. */
  status?: ReactNode;
  abwesend?: ReactNode;
  grafik?: ReactNode;
  marken?: ReactNode;
  handlung?: ReactNode;
}

/**
 * Das Spaltenvokabular. Jede Seite bestellt daraus — sie erfindet keine
 * eigenen Breiten mehr.
 *
 * Vor diesem Bau hatten Team, Monatsabschluss, Berichte und Mitarbeiter je ein
 * eigenes, von Hand aus `HStack` und festen Pixelbreiten gebautes Raster: 74
 * fest verdrahtete Spaltenbreiten in der Anwendung, „Ist/Soll/Saldo" auf dem
 * Monatsabschluss 90 px breit und auf den Berichten 100 px — dieselben drei
 * Zahlen, zwei Raster. Sortieren konnte keins davon, und die Lohnbuchhaltung
 * konnte deshalb nicht fragen, wer am weitesten abweicht.
 */
export type PersonenSpalte =
  | 'status'
  | 'name'
  | 'ist'
  | 'soll'
  | 'saldo'
  | 'konto'
  | 'abwesend'
  | 'grafik'
  | 'marken'
  | 'handlung';

type SortSchluessel = 'name' | 'istMin' | 'sollMin' | 'saldoMin' | 'kontoMin' | 'statusRang';

interface PersonenTafelProps {
  zeilen: PersonenZeile[];
  /** Welche Spalten dieses Blatt bestellt, in Lesereihenfolge. */
  spalten: PersonenSpalte[];
  /** Die Überschrift der Kleingrafik-Spalte — sie heißt je Blatt anders. */
  grafikKopf?: string;
  /** Wie breit die Kleingrafik sein darf. Eine Tagesbahn will mehr als ein Trend. */
  grafikBreite?: 'schmal' | 'weit';
  /** Die Überschrift der Handlungsspalte, wenn sie eine braucht. */
  handlungKopf?: string;
  /**
   * Wie breit die Handlungsspalte sein muss. Gemessen statt geschätzt: ein
   * einzelner Knopf braucht 142 px, die drei Geistknöpfe der Kontenverwaltung
   * („Bearbeiten · Passwort · Deaktivieren") 372 px — bei 142 fielen zwei
   * davon einfach aus der Zeile.
   */
  handlungBreite?: number;
  /**
   * Wonach das Blatt beim Öffnen sortiert. Der erste Eintrag führt, die
   * weiteren lösen Gleichstände auf. Ohne Angabe: alphabetisch.
   */
  ordnung?: Array<{sortKey: SortSchluessel; direction: 'ascending' | 'descending'}>;
  /** Was steht, wenn niemand da ist. */
  leer?: ReactNode;
}

/** Ein Zeitwert in der Tafel: immer Ziffernbreite, immer rechtsbündig. */
function Zeitwert({min, ton}: {min: number | null | undefined; ton?: 'sekundaer' | 'saldo'}) {
  if (min === null || min === undefined) {
    return (
      <Text type="supporting" size="sm" color="disabled">
        –
      </Text>
    );
  }
  if (ton === 'saldo') {
    return (
      <Text type="body" size="sm" hasTabularNumbers color="inherit">
        <span style={{color: min >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
          {fmtDurationSigned(min)}
        </span>
      </Text>
    );
  }
  return (
    <Text type="body" size="sm" hasTabularNumbers color={ton === 'sekundaer' ? 'secondary' : 'primary'}>
      {fmtDuration(min)}
    </Text>
  );
}

/**
 * Die eine Tabelle für „eine Zeile je Person, Zahlen in Spalten".
 *
 * Auf der echten Astryx-`Table` und nicht auf `HStack`-Attrappen: damit
 * bekommt jede dieser Seiten Sortierung, einen klebenden Kopf und ein
 * Spaltenvokabular, das über Blattgrenzen hinweg gleich bleibt.
 */
export function PersonenTafel({
  zeilen,
  spalten,
  grafikKopf,
  grafikBreite = 'schmal',
  handlungKopf,
  handlungBreite = 142,
  ordnung,
  leer,
}: PersonenTafelProps) {
  const {sortedData, sortConfig} = useTableSortableState<PersonenZeile, SortSchluessel>({
    data: zeilen,
    defaultSort: ordnung ?? [{sortKey: 'name', direction: 'ascending'}],
    comparators: {
      name: (a, b) => a.name.localeCompare(b.name, 'de'),
      statusRang: (a, b) => (a.statusRang ?? 0) - (b.statusRang ?? 0),
      istMin: (a, b) => (a.istMin ?? 0) - (b.istMin ?? 0),
      sollMin: (a, b) => (a.sollMin ?? 0) - (b.sollMin ?? 0),
      saldoMin: (a, b) => (a.saldoMin ?? 0) - (b.saldoMin ?? 0),
      kontoMin: (a, b) => (a.kontoMin ?? 0) - (b.kontoMin ?? 0),
    },
  });
  const sortPlugin = useTableSortable<PersonenZeile, SortSchluessel>(sortConfig);

  if (zeilen.length === 0 && leer) return <>{leer}</>;

  const alle: Record<PersonenSpalte, TableColumn<PersonenZeile>> = {
    status: {
      key: 'statusRang',
      header: '',
      width: pixel(44),
      resizable: false,
      sortable: true,
      renderCell: (row) => <>{row.status}</>,
    },
    name: {
      key: 'name',
      header: 'Mitarbeiter',
      width: proportional(2),
      sortable: true,
      renderCell: (row) => (
        <PersonZeichen
          person={row.person ?? null}
          ersatzName={row.name}
          groesse="zeile"
          mitName
          unterzeile={row.unterzeile}
          href={row.href ?? undefined}
        />
      ),
    },
    ist: {
      key: 'istMin',
      header: 'Ist',
      width: pixel(92),
      align: 'end',
      sortable: true,
      renderCell: (row) => <Zeitwert min={row.istMin} />,
    },
    soll: {
      key: 'sollMin',
      header: 'Soll',
      width: pixel(92),
      align: 'end',
      sortable: true,
      renderCell: (row) => <Zeitwert min={row.sollMin} ton="sekundaer" />,
    },
    saldo: {
      key: 'saldoMin',
      header: 'Saldo',
      width: pixel(96),
      align: 'end',
      sortable: true,
      renderCell: (row) => <Zeitwert min={row.saldoMin} ton="saldo" />,
    },
    konto: {
      key: 'kontoMin',
      header: 'Zeitkonto',
      width: pixel(110),
      align: 'end',
      sortable: true,
      renderCell: (row) => <Zeitwert min={row.kontoMin} ton="saldo" />,
    },
    abwesend: {
      key: 'abwesend',
      header: 'Abwesend',
      width: pixel(180),
      renderCell: (row) => <>{row.abwesend}</>,
    },
    grafik: {
      key: 'grafik',
      header: grafikKopf ?? '',
      width: grafikBreite === 'weit' ? proportional(3) : pixel(120),
      resizable: false,
      renderCell: (row) => <>{row.grafik}</>,
    },
    marken: {
      key: 'marken',
      header: '',
      width: pixel(150),
      resizable: false,
      renderCell: (row) => <>{row.marken}</>,
    },
    handlung: {
      key: 'handlung',
      header: handlungKopf ?? '',
      width: pixel(handlungBreite),
      align: 'end',
      resizable: false,
      /* Ohne eigene Handlung, aber mit Ziel: der Weg in die Zeile steht am
         Zeilenende, wo er in einer Tabelle hingehört. Vorher war die ganze
         Zeile ein Verweis; das geht in einer echten Tabelle nicht mehr, also
         bekommt sie zwei Ziele — den Namen und diesen Pfeil. */
      renderCell: (row) =>
        row.handlung ? (
          <>{row.handlung}</>
        ) : row.href ? (
          <Link href={row.href} className="tafel-verweis" aria-label={`${row.name} öffnen`}>
            <HStack gap={1} vAlign="center" justify="end" wrap="nowrap">
              <Text type="label" size="sm" color="accent">
                Öffnen
              </Text>
              <Sinnbild sinn="weiter" groesse="zeile" ton="akzent" />
            </HStack>
          </Link>
        ) : null,
    },
  };

  return (
    <VStack className="tabelle-scroll personen-tafel">
      <Table<PersonenZeile>
        data={sortedData}
        idKey="id"
        density="compact"
        dividers="rows"
        hasHover
        textOverflow="truncate"
        verticalAlign="middle"
        rowCount={zeilen.length}
        plugins={{sort: sortPlugin}}
        columns={spalten.map((s) => alle[s])}
      />
    </VStack>
  );
}
