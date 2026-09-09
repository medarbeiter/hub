import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {PersonZeichen} from '@/components/person-zeichen';
import {personAngabe} from '@/lib/avatar';
import {fmtDate} from '@/lib/format';
import {requireUser} from '@/lib/auth';
import {todayISO} from '@/lib/format';
import {clickupAktualisieren, clickupKonfiguriert} from '@/lib/clickup';
import {alleRollen} from '@/lib/rollen';
import {kommendeJahrestage, ownGoals, reaktionenFuer, teamGoals, teamTimeline, timelineBesuch} from '@/lib/ziele';
import {StatusLeiste} from '@/components/bereichs-leiste';
import {Sinnbild} from '@/components/sinnbilder';
import {TeamEreignisse} from '@/components/team-ereignisse';
import {Verweis} from '@/components/verweis';
import {MeineZiele, TeamZiele, TimelineLive, ZielAnlegen} from '@/components/ziele';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

export default async function TimelinePage({searchParams}: {searchParams: Promise<{ansicht?: string; seite?: string}>}) {
  const user = await requireUser();
  const query = await searchParams;
  const ansicht = query.ansicht === 'ziele' ? 'ziele' : query.ansicht === 'teamziele' ? 'teamziele' : 'team';
  const seite = /^\d{1,6}$/.test(query.seite ?? '') ? Math.max(1, Number(query.seite)) : 1;
  const heute = todayISO();
  await clickupAktualisieren();
  const ziele = ownGoals(user.id, heute);
  const teamZiele = ansicht === 'teamziele' ? teamGoals(heute) : [];
  const rollen = alleRollen().map(({schluessel, label}) => ({schluessel, label}));
  const feed = ansicht === 'team' ? teamTimeline(seite, heute, {viewerId: user.id, gesehenBis: timelineBesuch(user.id)}) : null;
  const reaktionen = feed ? reaktionenFuer(feed.events.map((e) => e.id), user.id) : {};
  const erreicht = ziele.filter((z) => z.erreicht).length;
  const inArbeit = ziele.filter((z) => !z.erreicht && z.von <= heute && z.bis >= heute);
  const geteilt = ziele.filter((z) => z.oeffentlich).length;
  const naechstes = inArbeit[0] ?? ziele.find((z) => !z.erreicht && z.von > heute);
  const demnaechst = kommendeJahrestage(heute);

  return (
    <>
      <TimelineLive />
      <ZeitRahmen
        titel="Timeline"
        figur={String(erreicht)}
        figurEinheit={erreicht === 1 ? 'Ziel erreicht' : 'Ziele erreicht'}
        stand={
          ansicht === 'team'
            ? 'Eintritte, Jubiläen, Geburtstage und geteilte Ziele – neueste zuerst, aktualisiert sich alle 30 Sekunden.'
            : ansicht === 'teamziele'
              ? `${teamZiele.filter((z) => !z.erreicht && z.bis >= heute).length} in Arbeit · ${teamZiele.filter((z) => z.erreicht).length} erreicht`
              : `${inArbeit.length} in Arbeit · ${geteilt} mit dem Team geteilt`
        }
        nav={
          <StatusLeiste
            aktiv={ansicht}
            tabs={[
              {value: 'team', label: 'Timeline', href: '/timeline', sinn: 'teamleben'},
              {value: 'ziele', label: 'Meine Ziele', href: '/timeline?ansicht=ziele', sinn: 'ziele'},
              {value: 'teamziele', label: 'Teamziele', href: '/timeline?ansicht=teamziele', sinn: 'team'},
            ]}
          />
        }
        werkzeuge={<ZielAnlegen heute={heute} clickup={clickupKonfiguriert()} rollen={rollen} wir={ansicht === 'teamziele'} />}
        belege={
          feed ? (
            <VStack gap={3}>
              <TeamEreignisse events={feed.events} reaktionen={reaktionen} />
              {(seite > 1 || feed.hasMore) && (
                <nav aria-label="Timeline durchblättern">
                  <HStack justify="between" gap={3} wrap="wrap" paddingInline={2}>
                    <span>
                      {seite > 1 && (
                        <Verweis className="tafel-verweis" href={`/timeline?seite=${seite - 1}`}>
                          <Text type="supporting" weight="semibold">
                            ← Neuere Ereignisse
                          </Text>
                        </Verweis>
                      )}
                    </span>
                    {feed.hasMore && (
                      <Verweis className="tafel-verweis" href={`/timeline?seite=${seite + 1}`}>
                        <Text type="supporting" weight="semibold">
                          Ältere Ereignisse →
                        </Text>
                      </Verweis>
                    )}
                  </HStack>
                </nav>
              )}
            </VStack>
          ) : ansicht === 'teamziele' ? (
            <TeamZiele ziele={teamZiele} viewerId={user.id} heute={heute} />
          ) : (
            <MeineZiele ziele={ziele} heute={heute} />
          )
        }
        kontext={
          <>
            <Card padding={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="ziele" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Dein nächster Schritt</Heading>
                </HStack>
                {naechstes ? (
                  <Text type="supporting">{naechstes.titel}</Text>
                ) : (
                  <Text type="supporting" color="secondary">
                    Kein Ziel in Arbeit. Ein Zeitziel misst die Zeiterfassung von selbst, ein eigenes Vorhaben
                    schließt du selbst ab.
                  </Text>
                )}
                <Verweis className="tafel-verweis" href={naechstes ? `/timeline?ansicht=ziele#ziel-${naechstes.id}` : '/timeline?ansicht=ziele'}>
                  <Text type="supporting" weight="semibold">
                    {naechstes ? 'Zum Fortschritt →' : 'Zu deinen Zielen →'}
                  </Text>
                </Verweis>
              </VStack>
            </Card>

            <Card padding={4}>
              <Collapsible
                defaultIsOpen={false}
                trigger={
                  <HStack gap={2} vAlign="center">
                    <Sinnbild sinn="geburtstag" groesse="gross" ton="sekundaer" />
                    <Heading level={3}>Demnächst</Heading>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {demnaechst.length}
                    </Text>
                  </HStack>
                }
              >
                {demnaechst.length ? (
                  <VStack gap={2} paddingBlock={2}>
                    {demnaechst.map((j) => (
                      <PersonZeichen
                        key={`${j.art}-${j.person.id}-${j.date}`}
                        person={personAngabe(j.person)}
                        groesse="zeile"
                        mitName
                        unterzeile={`${j.titel} · ${fmtDate(j.date)}`}
                      />
                    ))}
                  </VStack>
                ) : (
                  <Text type="supporting" color="secondary">
                    In den nächsten 60 Tagen steht kein Jubiläum und kein Geburtstag an.
                  </Text>
                )}
              </Collapsible>
            </Card>

            <Card padding={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Was hier steht</Heading>
                </HStack>
                <Text type="supporting" color="secondary">
                  Eintritte und Jubiläen kommen aus dem Eintrittsdatum, Geburtstage aus dem Personalstamm – ohne Alter. Ein Ziel erscheint nur, wenn seine
                  Besitzerin es teilt – und nur mit Titel und Stand, nie mit Stunden.
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Der Fortschritt wird jedes Mal aus der Zeiterfassung gelesen, nicht gespeichert: eine
                  Korrektur ändert ihn sofort.
                </Text>
                <Verweis className="tafel-verweis" href={`/profil/${user.id}`}>
                  <Text type="supporting" weight="semibold">
                    Dein Teamprofil →
                  </Text>
                </Verweis>
              </VStack>
            </Card>
          </>
        }
      />
    </>
  );
}
