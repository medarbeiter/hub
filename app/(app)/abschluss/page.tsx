import {Badge, Banner, HStack, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireRecht} from '@/lib/auth';
import {personAngabe} from '@/lib/avatar';
import {addMonths, monthOf, todayISO} from '@/lib/format';
import {activeUsers, monthRecord} from '@/lib/time';
import {eingereichteImMonat} from '@/lib/spesen';
import {offeneAntraegeImMonat} from '@/lib/abwesenheit';
import {MonatLeiste} from '@/components/bereichs-leiste';
import {LockAllButton} from '@/components/lock-all-button';
import {LockButton} from '@/components/lock-button';
import {PersonenTafel, type PersonenZeile} from '@/components/personen-tafel';
import {Sinnbild} from '@/components/sinnbilder';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{monat?: string}>;
}

export default async function AbschlussPage({searchParams}: PageProps) {
  await requireRecht('abschluss.verwalten');
  const params = await searchParams;
  const currentMonth = monthOf(todayISO());
  // Default to the previous month — that's the one being closed.
  const month = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : addMonths(currentMonth, -1);
  const isCurrentOrFuture = month >= currentMonth;

  const rows = activeUsers().map((u) => ({
    user: u,
    record: monthRecord(u, month),
    offeneReisen: eingereichteImMonat(u.id, month),
    // Derselbe Block wie bei einer eingereichten Reise (lockMonth prüft
    // beides) — die Seite hatte dafür bisher weder Banner noch Spalte, also
    // erfuhr eine Verwaltung erst beim Klick auf „Abschließen“, warum es
    // nicht ging, statt vorher wie bei den Reisen.
    offeneAntraege: offeneAntraegeImMonat(u.id, month),
  }));
  const lockedCount = rows.filter((r) => r.record.locked).length;
  const openCount = rows.reduce((sum, r) => sum + r.record.openSegments, 0);
  const reisenCount = rows.reduce((sum, r) => sum + r.offeneReisen, 0);
  const antraegeCount = rows.reduce((sum, r) => sum + r.offeneAntraege, 0);

  const zeilen: PersonenZeile[] = rows.map(({user, record, offeneReisen, offeneAntraege}) => ({
    id: user.id,
    name: user.name,
    person: personAngabe(user),
    unterzeile: `${Math.round(user.weekly_minutes / 60)} Std./Woche`,
    istMin: record.workedMin,
    sollMin: record.sollMin,
    saldoMin: record.workedMin - record.sollMin,
    /* Die drei Hindernisse, an denen ein Abschluss scheitert, stehen als
       Marken beieinander statt in drei eigenen Zahlenspalten: sie sind fast
       immer leer, und drei leere Spalten sind drei leere Spalten. */
    marken: (
      <HStack gap={1} wrap="wrap" justify="end">
        {record.openSegments > 0 && (
          <Link href={`/team/${user.id}`} className="tafel-verweis">
            <Badge
              variant="warning"
              label={`${record.openSegments} offen`}
              icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
            />
          </Link>
        )}
        {offeneReisen > 0 && (
          <Link href="/spesen/pruefen" className="tafel-verweis">
            <Badge
              variant="warning"
              label={`${offeneReisen} ${offeneReisen === 1 ? 'Reise' : 'Reisen'}`}
              icon={<Sinnbild sinn="reise" groesse="zeile" />}
            />
          </Link>
        )}
        {offeneAntraege > 0 && (
          <Link href="/abwesenheit/pruefen" className="tafel-verweis">
            <Badge
              variant="warning"
              label={`${offeneAntraege} ${offeneAntraege === 1 ? 'Antrag' : 'Anträge'}`}
              icon={<Sinnbild sinn="abwesenheit" groesse="zeile" />}
            />
          </Link>
        )}
        {record.locked && (
          <Badge
            variant="info"
            label="Abgeschlossen"
            icon={<Sinnbild sinn="gesperrt" groesse="zeile" />}
          />
        )}
      </HStack>
    ),
    handlung: (
      <LockButton
        userId={user.id}
        month={month}
        isLocked={record.locked}
        disabledReason={
          isCurrentOrFuture
            ? 'Der laufende Monat kann noch nicht abgeschlossen werden.'
            : record.openSegments > 0
              ? 'Offene Einträge müssen zuerst korrigiert werden.'
              : offeneReisen > 0
                ? 'Eingereichte Reisen müssen zuerst geprüft werden.'
                : offeneAntraege > 0
                  ? 'Eingereichte Abwesenheitsanträge müssen zuerst entschieden werden.'
                  : undefined
        }
      />
    ),
  }));

  return (
    <ZeitRahmen
      titel="Monatsabschluss"
      sinn="abschluss"
      figur={String(lockedCount)}
      figurEinheit={`von ${rows.length} abgeschlossen`}
      stand={
        isCurrentOrFuture
          ? 'Der laufende Monat wird erst nach seinem Ende abgeschlossen.'
          : lockedCount === rows.length
            ? 'Der Monat ist vollständig abgeschlossen und schreibgeschützt.'
            : `${rows.length - lockedCount} ${rows.length - lockedCount === 1 ? 'Blatt steht' : 'Blätter stehen'} noch offen.`
      }
      figurMeta={
        <>
          {openCount > 0 && (
            <Badge
              variant="warning"
              label={`${openCount} ${openCount === 1 ? 'offener Eintrag' : 'offene Einträge'}`}
              icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
            />
          )}
          {reisenCount > 0 && (
            <Badge
              variant="warning"
              label={`${reisenCount} ${reisenCount === 1 ? 'offene Reise' : 'offene Reisen'}`}
              icon={<Sinnbild sinn="reise" groesse="zeile" />}
            />
          )}
          {antraegeCount > 0 && (
            <Badge
              variant="warning"
              label={`${antraegeCount} ${antraegeCount === 1 ? 'offener Antrag' : 'offene Anträge'}`}
              icon={<Sinnbild sinn="abwesenheit" groesse="zeile" />}
            />
          )}
        </>
      }
      werkzeuge={
        !isCurrentOrFuture ? (
          <LockAllButton
            month={month}
            lockableCount={
              rows.filter(
                (r) =>
                  !r.record.locked &&
                  r.record.openSegments === 0 &&
                  r.offeneReisen === 0 &&
                  r.offeneAntraege === 0,
              ).length
            }
          />
        ) : null
      }
      nav={<MonatLeiste route="/abschluss" monat={month} today={todayISO()} />}
      banner={
        <>
          {!isCurrentOrFuture && openCount > 0 && (
            <Banner
              status="warning"
              title={`${openCount} ${openCount === 1 ? 'offener Eintrag' : 'offene Einträge'} in diesem Monat`}
              description="Monate mit offenen Einträgen können nicht abgeschlossen werden. Öffne den betroffenen Tag und trage das Ende nach."
            />
          )}
          {!isCurrentOrFuture && reisenCount > 0 && (
            <Banner
              status="warning"
              title={`${reisenCount} eingereichte ${reisenCount === 1 ? 'Reise wartet' : 'Reisen warten'} auf Prüfung`}
              description="Eine eingereichte Spesenabrechnung wird durch den Abschluss eingefroren, bevor jemand sie gesehen hat. Prüfe sie zuerst unter „Spesen prüfen“."
            />
          )}
          {!isCurrentOrFuture && antraegeCount > 0 && (
            <Banner
              status="warning"
              title={`${antraegeCount} eingereichte ${antraegeCount === 1 ? 'Abwesenheitsantrag wartet' : 'Abwesenheitsanträge warten'} auf Entscheidung`}
              description="Ein eingereichter Urlaubs- oder Ausgleichsantrag bindet den Anspruch erst mit der Entscheidung. Entscheide zuerst unter „Abwesenheit prüfen“."
            />
          )}
        </>
      }
      belege={
        <VStack gap={4}>
          <PersonenTafel
            zeilen={zeilen}
            spalten={['name', 'ist', 'soll', 'saldo', 'marken', 'handlung']}
          />

          <Text type="supporting" color="secondary">
            Abgeschlossene Monate sind schreibgeschützt und bilden die Grundlage für die Lohnabrechnung –
            für die Arbeitszeiten wie für die Spesenabrechnungen desselben Monats. Jede
            Spaltenüberschrift sortiert.
          </Text>
        </VStack>
      }
    />
  );
}
