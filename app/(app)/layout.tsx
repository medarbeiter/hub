import {AppShell} from '@astryxdesign/core';
import {after} from 'next/server';
import type {ReactNode} from 'react';
import {requireUser} from '@/lib/auth';
import {AppHinweis} from '@/components/app-hinweis';
import {AppNav} from '@/components/app-nav';
import {AttentionToast} from '@/components/attention-toast';
import {ClockBar} from '@/components/clock-bar';
import {ClockProvider} from '@/components/clock-provider';
import {KopfSichtProvider} from '@/components/kopf-deckung';
import {SprungmarkeDeutsch} from '@/components/sprungmarke';
import {attentionIssues, correctionQueue, excusedDays} from '@/lib/attention';
import {navZaehler} from '@/lib/schnellzugriff';
import {erinnerungslaufFaellig} from '@/lib/erinnerungen';
import {persoenlicheEinstellungen} from '@/lib/onboarding';
import {fmtDate} from '@/lib/format';
import {protokolliere} from '@/lib/protokoll';
import {autoCloseForgotten, clockState, dayRecord, fmtTime, nowMinutes, todayISO} from '@/lib/time';

export default async function AppLayout({children}: {children: ReactNode}) {
  const user = await requireUser();
  const today = todayISO();
  const persoenlich = persoenlicheEinstellungen(user.id);

  // Sweep first so a provisionally closed entry shows up as "please confirm"
  // in the same render rather than one navigation later.
  //
  // Und jede so gesetzte Kante kommt ins Protokoll. Sie war bis dahin die
  // einzige Stelle, an der ein Ende in den Datensatz geriet, ohne dass
  // irgendwo stand, woher es kam: nicht gestempelt, nicht eingetragen,
  // sondern geraten. Wer den Nachweis liest, muss die drei auseinanderhalten
  // können — deshalb trägt die Zeile `erfassung: 'automatisch'`.
  for (const eintrag of autoCloseForgotten(user.id, today)) {
    protokolliere({
      akteur: null,
      akteurName: 'MedArbeiter',
      aktion: 'eintrag.automatisch-geschlossen',
      gegenstand: `Arbeit am ${fmtDate(eintrag.date)}, ${fmtTime(eintrag.startMin)}–${fmtTime(eintrag.endMin)}`,
      betroffen: {id: user.id, name: user.name},
      datum: eintrag.date,
      vorher: {Ende: 'offen'},
      nachher: {Ende: fmtTime(eintrag.endMin), Stand: 'vorläufig, noch zu bestätigen'},
    });
  }

  // Was liegen geblieben ist, mahnt sich selbst an — nach der Auslieferung
  // dieser Seite, damit niemand auf einen Mailserver wartet. Dieses Haus
  // betreibt keinen Cron; der erste Aufruf des Tages ist der Auslöser, und
  // `erinnerungslaufFaellig` bremst ihn auf höchstens einen Lauf je Stunde.
  after(() => erinnerungslaufFaellig());

  const record = dayRecord(user, today);
  const clock = clockState(user.id);
  const issues = attentionIssues(user, {today, isExcused: excusedDays(user, today)});

  const queue = correctionQueue(issues);

  /**
   * Die Uhr umschließt jetzt die ganze Schale, nicht nur ihren Inhalt.
   *
   * Vorher stand `ClockProvider` innerhalb von `AppShell`, und die
   * Seitenleiste kam als `sideNav`-Prop von außen — sie lag damit außerhalb
   * des Kontexts und konnte den Stempelstand nicht lesen. Da AppShell das
   * Element aber in seinem eigenen Baum rendert und React-Kontext an der
   * Renderstelle hängt, nicht an der Erzeugungsstelle, genügt es, den Anbieter
   * eine Ebene höher zu ziehen: Leiste und Inhalt sehen dieselbe Uhr, ohne
   * dass irgendetwas doppelt geladen wird.
   *
   * Aus demselben Grund liegt `KopfSichtProvider` hier: die Stempelleiste
   * steht innerhalb der Schale, der Kopf des Inhalts ebenfalls, und die Leiste
   * muss lesen können, was der Kopf gerade schon sagt.
   */
  return (
    <ClockProvider
      today={today}
      initialNowMin={nowMinutes()}
      segments={record.segments}
      status={clock.status}
      since={clock.since}
      sinceYesterday={clock.sinceYesterday ?? false}
      sollMin={record.sollMin}
    >
      <KopfSichtProvider>
        <AppShell
          sideNav={
            <AppNav
              name={user.name}
              role={user.role}
              rechte={user.rechte ?? []}
              avatar={persoenlich.avatar}
              eigenesBild={Boolean(user.avatar_datei)}
              userId={user.id}
              heute={today}
              zaehler={navZaehler(user, queue.length)}
            />
          }
          height="auto"
          contentPadding={0}
        >
          <SprungmarkeDeutsch />
          <ClockBar />
          {/* Zeichnet nichts an dieser Stelle: die Aufmerksamkeitsmeldung
              erscheint als Meldung unten rechts und lässt den Platz zwischen
              Stempelleiste und Seitenkopf frei. Sie steht trotzdem hier, weil
              hier die Daten liegen, aus denen sie sich stellt. */}
          {persoenlich.hinweiseZuOffenenTagen && issues.length > 0 && (
            <AttentionToast issues={issues} queue={queue} />
          )}
          {/* Der Installationshinweis bleibt ein Band im Fluss — er ist ein
              Angebot, keine Meldung, und darf die eine Stelle für Meldungen
              nicht besetzen. */}
          <AppHinweis />
          {/* Bereichswechsel bleiben absichtlich still. Die Bewegung gehört
              den Dingen im Blatt — Zahl, Zeitblöcke und zusammengehörige
              Bahnen — nicht dem ganzen Bildschirm. So bleibt die Schale der
              feste Bezugspunkt, auch wenn jemand schnell durch Zeiträume
              blättert. */}
          {children}
        </AppShell>
      </KopfSichtProvider>
    </ClockProvider>
  );
}
