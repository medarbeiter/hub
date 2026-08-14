'use client';

import {
  Button,
  HStack,
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
  StatusDot,
  Text,
  VStack,
} from '@astryxdesign/core';
import Image from 'next/image';
import Link from 'next/link';
import {AbsendeKnopf} from './absende-knopf';
import {LinkPuls} from './verweis';
import {usePathname} from 'next/navigation';
import {useEffect, useState, useTransition, type ComponentProps, type ReactNode} from 'react';
import {logoutAction} from '@/app/actions';
import type {AvatarKey} from '@/lib/avatar';
import type {NavZaehler} from '@/lib/schnellzugriff';
import {fmtDuration, fmtMonth, fmtTime, monthOf} from '@/lib/format';
import {useClockOptional} from './clock-provider';
import {
  NavAktionen,
  NavEintrag,
  NavKunde,
  NavStand,
  NavVerweilen,
  NavZahl,
  NavZweig,
  type NavAktion,
} from './nav-ausklapp';
import {NavTagesstand} from './nav-tagesstand';
import {rolleLabel, type Recht, type Rolle} from '@/lib/rechte';
import {Sinnbild, gefuellt, umriss} from './sinnbilder';
import {TierAvatar} from './tier-avatar';

interface AppNavProps {
  name: string;
  role: Rolle;
  /** Wirksame Rechte der Sitzung — die Leiste zeigt nur, was der Rechteschnitt hergibt. */
  rechte: Recht[];
  avatar: AvatarKey;
  heute: string;
  zaehler: NavZaehler;
}

/** Wo der Zustand der Schiene überlebt. */
const SCHIENE_SCHLUESSEL = 'medarbeiter:leiste-eingeklappt';

/**
 * Die Dichte richtet sich nach der Länge der Liste, nicht nach dem Geschmack.
 *
 * Ein Mitarbeiter sieht fünf Einträge, die Verwaltung elf. Dieselbe Zeilenhöhe
 * für beide hieße: entweder schwimmen die fünf in einer hohen, fast leeren
 * Spalte, oder die elf stehen so gedrängt, dass die Gruppen darin nicht mehr
 * auseinanderzuhalten sind. Die kurze Liste bekommt deshalb Luft (`lg`), die
 * lange ihren dichteren Takt (`md`) — eine Grammatik, zwei Einstellungen.
 */
type Dichte = 'md' | 'lg';

/**
 * Jeder Verweis der Leiste meldet dieselbe Bewegung an: ein Wechsel des
 * Bereichs ist kein Schritt auf der Zeitachse und kein Zoom, sondern ein
 * ruhiges Überblenden. Ohne diese Anmeldung bliebe der Wechsel still — es
 * bewegt sich nur, was eine Art nennt (siehe components/seiten-wechsel.tsx).
 */
const NextLink = (props: ComponentProps<'a'>) => (
  <Link {...(props as ComponentProps<typeof Link>)} transitionTypes={['bereichswechsel']}>
    {/* Und er sagt, dass er arbeitet — der Bereichswechsel ist der längste Weg
        der Anwendung (neue Route, neue Daten), also der, an dem ein stiller
        Klick am ehesten ein zweites Mal getan wird. Siehe components/verweis.tsx. */}
    <LinkPuls />
    {props.children}
  </Link>
);

export function AppNav({name, role, rechte, avatar, heute, zaehler}: AppNavProps) {
  const pathname = usePathname();
  const clock = useClockOptional();
  const darf = (recht: Recht) => rechte.includes(recht);
  const heutigeAufsicht =
    darf('zeit.team') || darf('spesen.pruefen') || darf('abwesenheit.pruefen') || darf('abschluss.verwalten');
  const auswertung = darf('berichte.sehen') || darf('protokoll.alle');
  const stammdaten = darf('mitarbeiter.verwalten') || darf('einstellungen.verwalten') || darf('apps.verwalten');
  const dichte: Dichte = heutigeAufsicht || auswertung || stammdaten ? 'md' : 'lg';

  /**
   * Die Schiene: eingeklappt bleibt die Leiste als Zeichenspalte stehen.
   *
   * Astryx' eigener Einklappzustand trägt die Auszeichnung (Kurzhinweis am
   * Zeichen, Aufklapp als Überhang), also wird er hier nur gehalten und
   * gemerkt. Gelesen wird erst *nach* dem ersten Rendern: der Server kennt
   * keinen `localStorage`, und ein Zustand aus dem Speicher schon beim ersten
   * Rendern hieße, dass Server- und Browserbaum auseinanderfallen. Bis dahin
   * unterbindet `data-bereit="false"` die Breitenbewegung, damit die Leiste
   * nicht sichtbar zusammenfährt.
   */
  const [eingeklappt, setEingeklappt] = useState(false);
  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    try {
      setEingeklappt(window.localStorage.getItem(SCHIENE_SCHLUESSEL) === 'true');
    } catch {
      // Privater Modus, gesperrter Speicher: die Leiste bleibt offen.
    }
    setBereit(true);
  }, []);
  const schiene = (zu: boolean) => {
    setEingeklappt(zu);
    try {
      window.localStorage.setItem(SCHIENE_SCHLUESSEL, String(zu));
    } catch {
      // Nicht merken zu können ist kein Grund, nicht einzuklappen.
    }
  };

  /**
   * Immer höchstens einer offen. Ein Aufklappen schiebt die Einträge darunter
   * nach unten — bei mehreren zugleich würde die Leiste zu einer Liste, durch
   * die man scrollen muss, und der Ort eines Eintrags wäre nicht mehr stabil.
   *
   * `durchKlick` merkt sich, wodurch er offen ist: was das Verweilen geöffnet
   * hat, schließt das Weggehen auch wieder; was ein Klick auf das
   * Winkelzeichen geöffnet hat, bleibt stehen.
   */
  const [offen, setOffen] = useState<{id: string; durchKlick: boolean} | null>(null);

  /* In der Schiene klappt Astryx den Eintrag als Überhang auf und rendert
     seine Kinder dabei im ausgeklappten Zustand. Der Zweig muss dort also
     immer „offen" sein — sonst stünde sein Inhalt im Überhang zugeschnitten
     da, obwohl der Überhang nur existiert, weil jemand ihn geöffnet hat. */
  const istOffen = (id: string) => eingeklappt || offen?.id === id;
  const ausklapp = (id: string) => ({
    isCollapsed: offen?.id !== id,
    onCollapsedChange: (zu: boolean) => setOffen(zu ? null : {id, durchKlick: true}),
  });
  const verweilen = (id: string) => ({
    istOffen: offen?.id === id,
    oeffnen: () => setOffen({id, durchKlick: false}),
    schliessen: () =>
      setOffen((jetzt) => (jetzt?.id === id && !jetzt.durchKlick ? null : jetzt)),
    // In der Schiene öffnet Astryx' eigener Überhang; ein zweites Verweilen
    // daneben würde nur mit ihm ringen.
    aus: eingeklappt,
  });

  const monat = monthOf(heute);

  return (
    <SideNav
      data-bereit={bereit ? 'true' : 'false'}
      data-eingeklappt={eingeklappt ? 'true' : 'false'}
      collapsible={{
        isCollapsed: eingeklappt,
        onCollapsedChange: schiene,
        buttonLabel: eingeklappt ? 'Leiste ausklappen' : 'Leiste einklappen',
      }}
      header={
        // 40 px, nicht 28: die Marke ankert die Ecke der Anwendung und darf
        // nicht kleiner stehen als der Wortzug daneben — bei 28 px las sie
        // sich als Favicon neben dem eigenen Namen.
        <SideNavHeading
          heading="MedArbeiter"
          subheading="Hub"
          headingHref="/"
          icon={<Image src="/logo-mark.png" alt="" width={40} height={40} />}
        />
      }
      footer={
        <>
          <NavTagesstand kontoSaldoMin={zaehler.kontoSaldoMin} eingeklappt={eingeklappt} />
          <Kontozeile name={name} role={role} avatar={avatar} eingeklappt={eingeklappt} />
        </>
      }
    >
      {/* Umriss wenn nicht gewählt, gefüllt wenn gewählt: die Auswahl steht
          damit nicht nur in der Hinterlegung, sondern auch im Zeichen selbst.
          Dieselben Zeichen tragen die Seitentitel der jeweiligen Route — die
          Navigation und der Ort, an dem man ankommt, sprechen gleich.

          `collapsible` neben `href`: der Text navigiert wie immer, das
          Winkelzeichen am Ende klappt auf. Zwei Ziele, zwei Trefferflächen —
          und ein halbsekündiges Verweilen tut dasselbe wie das Zeichen. */}
      <SideNavSection title="Meine Zeit" isHeaderHidden>
        <NavVerweilen {...verweilen('zeit')} ruft={zaehler.korrekturen > 0}>
          <MeineZeitEintrag
            pathname={pathname}
            korrekturen={zaehler.korrekturen}
            clock={clock}
            dichte={dichte}
            ausklapp={ausklapp('zeit')}
            offen={istOffen('zeit')}
          />
        </NavVerweilen>

        <NavVerweilen
          {...verweilen('abwesenheit')}
          ruft={zaehler.abwesenheitEntwuerfe + zaehler.auFehlt > 0}
        >
          <SideNavItem
            label="Abwesenheit"
            href="/abwesenheit"
            as={NextLink}
            size={dichte}
            icon={umriss('abwesenheit')}
            selectedIcon={gefuellt('abwesenheit')}
            isSelected={pathname === '/abwesenheit'}
            endContent={<NavZahl wert={zaehler.abwesenheitEntwuerfe + zaehler.auFehlt} />}
            collapsible={ausklapp('abwesenheit')}
          >
            <NavZweig offen={istOffen('abwesenheit')}>
              {zaehler.auFehlt > 0 ? (
                <NavStand
                  ton="warning"
                  text={`${zaehler.auFehlt} ${zaehler.auFehlt === 1 ? 'Bescheinigung fehlt' : 'Bescheinigungen fehlen'}`}
                  zusatz="Ab dem dritten Krankheitstag fällig."
                />
              ) : zaehler.abwesenheitEntwuerfe > 0 ? (
                <NavStand
                  ton="warning"
                  text={`${zaehler.abwesenheitEntwuerfe} ${
                    zaehler.abwesenheitEntwuerfe === 1 ? 'Antrag wartet' : 'Anträge warten'
                  }`}
                  zusatz="Erfasst und noch nicht eingereicht."
                />
              ) : (
                <NavStand ton="neutral" text="Nichts offen" />
              )}
              {/* Nur ein Weg von hier — der Zweig ist eine Abkürzung, kein Ort:
                  erfassen kann man auch auf der Seite selbst. */}
              <NavAktionen
                aktionen={[
                  {sinn: 'hinzufuegen', label: 'Abwesenheit erfassen', href: `/abwesenheit?von=${heute}`},
                ]}
              />
            </NavZweig>
          </SideNavItem>
        </NavVerweilen>

        {/* Der Teamkalender steht in der persönlichen Reihe und nicht bei der
            Verwaltung: „wer ist nächste Woche da" ist die Frage eines
            Kollegen, nicht die einer Vorgesetzten. Was er zeigt, ist für alle
            dasselbe — nur der Grund einer Abwesenheit bleibt der Verwaltung
            und der betroffenen Person vorbehalten. */}
        <NavVerweilen {...verweilen('kalender')}>
          <SideNavItem
            label="Teamkalender"
            href="/kalender"
            as={NextLink}
            size={dichte}
            icon={umriss('teamkalender')}
            selectedIcon={gefuellt('teamkalender')}
            isSelected={pathname === '/kalender'}
            // Wer heute fehlt, ist Auskunft und keine Aufgabe: leiser Text
            // statt einer Marke.
            endContent={<NavKunde wert={zaehler.heuteAbwesend} wort="abwesend" />}
            collapsible={ausklapp('kalender')}
          >
            <NavZweig offen={istOffen('kalender')}>
              {zaehler.heuteAbwesend > 0 ? (
                <NavStand
                  ton="neutral"
                  text={`${zaehler.heuteAbwesend} heute abwesend`}
                  zusatz={
                    zaehler.abwesendDemnaechst > 0
                      ? `${zaehler.abwesendDemnaechst} in den nächsten 14 Tagen`
                      : undefined
                  }
                />
              ) : (
                <NavStand
                  ton="neutral"
                  text="Heute sind alle da"
                  zusatz={
                    zaehler.abwesendDemnaechst > 0
                      ? `${zaehler.abwesendDemnaechst} in den nächsten 14 Tagen`
                      : undefined
                  }
                />
              )}
            </NavZweig>
          </SideNavItem>
        </NavVerweilen>

        <NavVerweilen {...verweilen('spesen')} ruft={zaehler.entwuerfe > 0}>
          <SideNavItem
            label="Reisen & Spesen"
            href="/spesen"
            as={NextLink}
            size={dichte}
            icon={umriss('reise')}
            selectedIcon={gefuellt('reise')}
            isSelected={pathname === '/spesen'}
            endContent={<NavZahl wert={zaehler.entwuerfe} />}
            collapsible={ausklapp('spesen')}
          >
            <NavZweig offen={istOffen('spesen')}>
              {zaehler.entwuerfe > 0 ? (
                <NavStand
                  ton="warning"
                  text={`${zaehler.entwuerfe} ${zaehler.entwuerfe === 1 ? 'Entwurf wartet' : 'Entwürfe warten'}`}
                  zusatz="Vorbei und noch nicht eingereicht."
                />
              ) : (
                <NavStand ton="neutral" text="Nichts offen" />
              )}
              <NavAktionen
                aktionen={[{sinn: 'hinzufuegen', label: 'Reise erfassen', href: `/spesen?neu=${heute}`}]}
              />
            </NavZweig>
          </SideNavItem>
        </NavVerweilen>

        {/* Die Einmalcodes der gemeinsamen Firmenkonten — für alle, denn sie
            ersetzen das Handy, das dafür durchs Büro gereicht wurde. Ein
            schlichter Verweis ohne Zahl und ohne Zweig: wie viele Zugänge es
            gibt, fordert nichts, und den laufenden Code sagt nur die Seite
            selbst — in der Leiste wäre er beim Aufklappen schon abgelaufen. */}
        <SideNavItem
          label="Zugangscodes"
          href="/zugangscodes"
          as={NextLink}
          size={dichte}
          icon={umriss('zugangscode')}
          selectedIcon={gefuellt('zugangscode')}
          isSelected={pathname.startsWith('/zugangscodes')}
        />

        {/* Für einen Mitarbeiter ist das Protokoll die Auskunft über die
            eigenen Daten und steht deshalb hier; für die Verwaltung ist es ein
            Aufsichtswerkzeug und steht unten. Ein Eintrag, zwei Orte — nicht
            zweimal derselbe Eintrag. */}
        {!darf('protokoll.alle') && <ProtokollEintrag pathname={pathname} dichte={dichte} />}
      </SideNavSection>

      {/* Elf Einträge in einer Liste sind keine Liste mehr, sondern eine
          Wand — und die Verwaltungsseite hatte genau das: neun Einträge unter
          einer Überschrift, in der Reihenfolge, in der sie entstanden sind.
          Jetzt stehen sie in drei Gruppen, die drei verschiedene Fragen
          beantworten: was ist heute zu tun, was ist herauszugeben, was ist
          einzurichten. Nur die erste trägt eine sichtbare Überschrift; die
          beiden anderen trennt der Abstand. Ihre Namen stehen trotzdem im
          Baum (`isHeaderHidden`), damit eine Vorlesehilfe die Gruppen
          benennen kann — sie sind ja da, nur eben ungeschrieben. */}
      {(heutigeAufsicht || auswertung || stammdaten) && (
        <>
          {heutigeAufsicht && (
          <SideNavSection title="Verwaltung">
            {darf('zeit.team') && (
            <SideNavItem
              label="Team"
              href="/team"
              as={NextLink}
              size={dichte}
              icon={umriss('team')}
              selectedIcon={gefuellt('team')}
              isSelected={pathname.startsWith('/team')}
              // Wer gerade eingestempelt ist, fordert nichts — Auskunft.
              endContent={<NavKunde wert={zaehler.teamAktiv} wort="aktiv" />}
            />
            )}

            {darf('spesen.pruefen') && (
            <NavEintrag ruft={zaehler.zuPruefen > 0}>
              <SideNavItem
                label="Spesen prüfen"
                href="/spesen/pruefen"
                as={NextLink}
                size={dichte}
                icon={umriss('pruefen')}
                selectedIcon={gefuellt('pruefen')}
                isSelected={pathname.startsWith('/spesen/pruefen')}
                endContent={<NavZahl wert={zaehler.zuPruefen} />}
              />
            </NavEintrag>
            )}

            {darf('abwesenheit.pruefen') && (
            <NavVerweilen
              {...verweilen('abwesenheitPruefen')}
              ruft={zaehler.abwesenheitZuPruefen > 0}
            >
              <SideNavItem
                label="Abwesenheit prüfen"
                href="/abwesenheit/pruefen"
                as={NextLink}
                size={dichte}
                icon={umriss('abwesenheit')}
                selectedIcon={gefuellt('abwesenheit')}
                isSelected={pathname.startsWith('/abwesenheit/pruefen')}
                endContent={<NavZahl wert={zaehler.abwesenheitZuPruefen} />}
                collapsible={ausklapp('abwesenheitPruefen')}
              >
                <NavZweig offen={istOffen('abwesenheitPruefen')}>
                  {zaehler.abwesenheitZuPruefen > 0 ? (
                    <>
                      <NavStand
                        ton="warning"
                        text={`${zaehler.abwesenheitZuPruefen} ${
                          zaehler.abwesenheitZuPruefen === 1 ? 'Antrag wartet' : 'Anträge warten'
                        }`}
                        zusatz="Eingereicht und noch ohne Entscheidung."
                      />
                      <NavAktionen
                        aktionen={[
                          {
                            sinn: 'pruefen',
                            label: 'Jetzt entscheiden',
                            href: '/abwesenheit/pruefen?status=eingereicht',
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <NavStand ton="neutral" text="Nichts zu entscheiden" />
                  )}
                </NavZweig>
              </SideNavItem>
            </NavVerweilen>
            )}

            {darf('abschluss.verwalten') && (
            <NavEintrag ruft={zaehler.offeneAbschluesse > 0}>
              <SideNavItem
                label="Monatsabschluss"
                href="/abschluss"
                as={NextLink}
                size={dichte}
                icon={umriss('abschluss')}
                selectedIcon={gefuellt('abschluss')}
                isSelected={pathname.startsWith('/abschluss')}
                endContent={<NavZahl wert={zaehler.offeneAbschluesse} />}
              />
            </NavEintrag>
            )}
          </SideNavSection>
          )}

          {/* Was herausgeht: die Zahlen für die Lohnabrechnung und der
              Nachweis darüber, wer sie angefasst hat. Der Haarstrich über der
              Gruppe zieht dieselbe Naht wie über dem Tagesstand im Fuß — die
              drei Gruppen der Verwaltung sind durch Linien getrennt, nicht
              nur durch Abstand. */}
          {auswertung && (
          <SideNavSection title="Auswertung" isHeaderHidden className="verwaltung-trenner">
            {darf('berichte.sehen') && (
            <NavVerweilen {...verweilen('berichte')}>
              <SideNavItem
                label="Berichte"
                href="/berichte"
                as={NextLink}
                size={dichte}
                icon={umriss('berichte')}
                selectedIcon={gefuellt('berichte')}
                isSelected={pathname.startsWith('/berichte')}
                collapsible={ausklapp('berichte')}
              >
                <NavZweig offen={istOffen('berichte')}>
                  <NavStand ton="neutral" text={fmtMonth(monat)} zusatz="Ausgabe für die Lohnabrechnung." />
                  <NavAktionen
                    aktionen={[
                      {
                        sinn: 'csv',
                        // Derselbe Name wie der Knopf auf /berichte selbst —
                        // dieselbe Handlung heißt an beiden Stellen gleich.
                        label: 'CSV für Lohnabrechnung',
                        href: `/api/export?monat=${monat}`,
                        download: true,
                      },
                    ]}
                  />
                </NavZweig>
              </SideNavItem>
            </NavVerweilen>

            )}
            {darf('protokoll.alle') && <ProtokollEintrag pathname={pathname} dichte={dichte} />}
          </SideNavSection>
          )}

          {/* Was eingerichtet wird: selten angefasst, und deshalb ganz unten
              statt zwischen den täglichen Wegen. */}
          {stammdaten && (
          <SideNavSection title="Stammdaten" isHeaderHidden className="verwaltung-trenner">
            {darf('mitarbeiter.verwalten') && (
            <SideNavItem
              label="Mitarbeiter"
              href="/mitarbeiter"
              as={NextLink}
              size={dichte}
              icon={umriss('mitarbeiter')}
              selectedIcon={gefuellt('mitarbeiter')}
              isSelected={pathname.startsWith('/mitarbeiter')}
            />
            )}
            {darf('apps.verwalten') && (
            <SideNavItem
              label="Verbundene Apps"
              href="/apps"
              as={NextLink}
              size={dichte}
              icon={umriss('verbundeneApps')}
              selectedIcon={gefuellt('verbundeneApps')}
              isSelected={pathname.startsWith('/apps')}
            />
            )}
            {darf('einstellungen.verwalten') && (
            <SideNavItem
              label="Einstellungen"
              href="/einstellungen"
              as={NextLink}
              size={dichte}
              icon={umriss('einstellungen')}
              selectedIcon={gefuellt('einstellungen')}
              isSelected={pathname.startsWith('/einstellungen')}
            />
            )}
          </SideNavSection>
          )}
        </>
      )}
    </SideNav>
  );
}

/**
 * Das Protokoll — derselbe Eintrag an zwei Orten, weil er zwei Dinge ist.
 *
 * Für die Verwaltung: das Aufsichtswerkzeug über den ganzen Datensatz. Für
 * einen Mitarbeiter: die Auskunft darüber, wer die eigenen Zeiten angefasst
 * hat — Art. 15 DSGVO, und zugleich die Grundlage dafür, einer Korrektur
 * überhaupt widersprechen zu können. Beide Male dasselbe Zeichen und derselbe
 * Weg; welchen Ausschnitt jemand zu sehen bekommt, entscheidet ohnehin die
 * Abfrage (`sichtbarFuer`) und nicht die Leiste.
 *
 * Ohne Zahl: das Protokoll wächst mit jedem Tag, und eine Zahl daneben wäre
 * eine, die nie null wird und nie etwas fordert. Ohne Aufklapp aus demselben
 * Grund — es gäbe nichts zu melden, was nicht die Seite selbst besser sagt.
 */
function ProtokollEintrag({pathname, dichte}: {pathname: string; dichte: Dichte}) {
  return (
    <SideNavItem
      label="Protokoll"
      href="/protokoll"
      as={NextLink}
      size={dichte}
      icon={umriss('protokoll')}
      selectedIcon={gefuellt('protokoll')}
      isSelected={pathname.startsWith('/protokoll')}
    />
  );
}

/**
 * „Meine Zeit" trägt als einziger Eintrag einen laufenden Zustand: aufgeklappt
 * zeigt er den Stempelstand und die Handlung, die als Nächstes dran ist —
 * dieselbe Zustandskopplung wie in der Stempelleiste, aus derselben Quelle
 * (`useClock`). Es bleibt eine Abkürzung: die Leiste oben ist die immer
 * sichtbare Heimat des Stempelns und auf jeder Route da.
 */
function MeineZeitEintrag({
  pathname,
  korrekturen,
  clock,
  dichte,
  ausklapp,
  offen,
}: {
  pathname: string;
  korrekturen: number;
  clock: ReturnType<typeof useClockOptional>;
  dichte: Dichte;
  ausklapp: {isCollapsed: boolean; onCollapsedChange: (zu: boolean) => void};
  offen: boolean;
}) {
  const [läuft, starte] = useTransition();
  const status = clock?.status ?? 'aus';

  const stempeln = (was: 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln') => {
    if (!clock) return;
    starte(() => {
      void clock.stamp(was);
    });
  };

  /**
   * Dieselbe Rangfolge wie in der Stempelleiste — die goldene Handlung steht
   * hier wie dort zuerst, damit derselbe Zustand nicht an zwei Orten zwei
   * verschiedene „nächste Schritte" vorschlägt.
   */
  const aktionen: NavAktion[] = clock
    ? status === 'aus'
      ? [{sinn: 'einstempeln', label: 'Einstempeln', onClick: () => stempeln('einstempeln'), isDisabled: läuft}]
      : status === 'arbeit'
        ? [
            {sinn: 'ausstempeln', label: 'Ausstempeln', onClick: () => stempeln('ausstempeln'), isDisabled: läuft},
            {sinn: 'pause', label: 'Pause starten', onClick: () => stempeln('pause'), isDisabled: läuft},
          ]
        : [
            {sinn: 'arbeit', label: 'Pause beenden', onClick: () => stempeln('fortsetzen'), isDisabled: läuft},
            {sinn: 'ausstempeln', label: 'Ausstempeln', onClick: () => stempeln('ausstempeln'), isDisabled: läuft},
          ]
    : [];

  const korrekturSatz =
    korrekturen > 0
      ? `${korrekturen} ${korrekturen === 1 ? 'Tag braucht' : 'Tage brauchen'} eine Korrektur`
      : null;
  const zusatz = [clock ? `${fmtDuration(clock.summary.workedMin)} Std. heute` : null, korrekturSatz]
    .filter(Boolean)
    .join(' · ');
  const seit = clock?.since !== null && clock?.since !== undefined ? fmtTime(clock.since) : null;

  return (
    <SideNavItem
      label="Meine Zeit"
      href="/"
      as={NextLink}
      size={dichte}
      icon={umriss('monat')}
      selectedIcon={gefuellt('monat')}
      isSelected={pathname === '/' || pathname.startsWith('/zeiten')}
      collapsible={ausklapp}
      endContent={
        korrekturen > 0 ? (
          <NavZahl wert={korrekturen} />
        ) : status !== 'aus' ? (
          /* Ein Punkt, keine Marke: dass die Uhr läuft, ist ein Zustand und
             keine Aufgabe. Wie lange schon, sagt der Tagesstand über der
             Kontozeile — und auf „Meine Zeit" die Zahl im Kopf. Solange hier
             eine Dauer als farbige Marke stand, sagte die Leiste dieselbe Zahl
             ein drittes Mal und sah dabei aus wie ein Ruf. */
          <StatusDot
            variant={status === 'arbeit' ? 'accent' : 'warning'}
            label={status === 'arbeit' ? 'Eingestempelt' : 'In der Pause'}
            tooltip={status === 'arbeit' ? 'Eingestempelt' : 'In der Pause'}
            isPulsing
          />
        ) : null
      }
    >
      <NavZweig offen={offen}>
        {status === 'arbeit' ? (
          <NavStand
            ton="accent"
            pulsiert
            text={seit ? `Eingestempelt seit ${seit}` : 'Eingestempelt'}
            zusatz={zusatz || undefined}
          />
        ) : status === 'pause' ? (
          <NavStand
            ton="warning"
            pulsiert
            text={seit ? `Pause seit ${seit}` : 'Pause'}
            zusatz={zusatz || undefined}
          />
        ) : (
          <NavStand ton="neutral" text="Nicht eingestempelt" zusatz={zusatz || undefined} />
        )}
        <NavAktionen aktionen={aktionen} />
      </NavZweig>
    </SideNavItem>
  );
}

/**
 * Der Fuß der Leiste: eine Zeile statt eines Stapels.
 *
 * Vorher standen Name, Rolle und „Abmelden" als drei lose Zeilen untereinander
 * — viel Platz, wenig Aussage. Jetzt ist es eine Zeile mit derselben Grammatik
 * wie die Einträge darüber: Zeichen links, zwei Zeilen Text, eine Handlung
 * rechts. Der Abmeldeknopf trägt die Server-Aktion direkt am Formular, damit
 * das Abmelden auch ohne JavaScript funktioniert.
 *
 * Eingeklappt bleibt davon das Namenszeichen — zwei Buchstaben sagen in einer
 * Zeichenspalte immer noch, wer angemeldet ist — und darunter der
 * Abmeldeknopf, gestapelt statt nebeneinander. Das Abmelden darf die Schiene
 * nicht kosten: es ist die eine Handlung, die von jeder Seite aus erreichbar
 * bleiben muss.
 */
function Kontozeile({
  name,
  role,
  avatar,
  eingeklappt,
}: {
  name: string;
  role: Rolle;
  avatar: AvatarKey;
  eingeklappt: boolean;
}) {
  const abmelden = (
    <form action={logoutAction}>
      <AbsendeKnopf
        label="Abmelden"
        variant="ghost"
        size="sm"
        isIconOnly
        icon={<Sinnbild sinn="abmelden" />}
      />
    </form>
  );

  if (eingeklappt) {
    return (
      <VStack gap={1} paddingInline={2} paddingBlock={3} align="center">
        <NextLink
          href="/profil"
          className="kontozeile-profil kontozeile-profil-eng"
          title={`${name} · Persönliche Einstellungen`}
          aria-label="Persönliche Einstellungen öffnen"
        >
          <Namenszeichen avatar={avatar} />
        </NextLink>
        {abmelden}
      </VStack>
    );
  }

  return (
    <VStack paddingInline={2} paddingBlock={3}>
      <HStack
        className="kontozeile"
        gap={2}
        vAlign="center"
        wrap="nowrap"
        paddingInline={2}
        paddingBlock={1.5}
      >
        <NextLink
          href="/profil"
          className="kontozeile-profil"
          aria-label="Persönliche Einstellungen öffnen"
        >
          <Namenszeichen avatar={avatar} />
          <VStack gap={0}>
            <Text type="label" size="sm" weight="medium" maxLines={1}>
              {name}
            </Text>
            <Text type="supporting" size="sm" color="secondary" maxLines={1}>
              {rolleLabel(role)}
            </Text>
          </VStack>
          <Sinnbild sinn="einstellungen" ton="sekundaer" />
        </NextLink>
        {abmelden}
      </HStack>
    </VStack>
  );
}

/**
 * Die gewählte lokale Profilfigur im Fuß. Sie ist kein Foto und trägt keine
 * weitere Personenangabe; der Name daneben beziehungsweise die Beschriftung
 * des Links sagt weiterhin, wer angemeldet ist.
 */
function Namenszeichen({avatar}: {avatar: AvatarKey}) {
  return <TierAvatar avatar={avatar} />;
}
