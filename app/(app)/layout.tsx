import {AppShell} from '@astryxdesign/core';
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
import {persoenlicheEinstellungen} from '@/lib/onboarding';
import {autoCloseForgotten, clockState, dayRecord, nowMinutes, todayISO} from '@/lib/time';

export default async function AppLayout({children}: {children: ReactNode}) {
  const user = await requireUser();
  const today = todayISO();
  const persoenlich = persoenlicheEinstellungen(user.id);

  // Sweep first so a provisionally closed entry shows up as "please confirm"
  // in the same render rather than one navigation later.
  autoCloseForgotten(user.id, today);

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
