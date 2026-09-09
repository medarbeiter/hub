import {Badge, Card, Divider, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {fmtDate, fmtDateRange, todayISO} from '@/lib/format';
import {personAngabeById} from '@/lib/users';
import {clickupAktualisieren} from '@/lib/clickup';
import {publicGoals, publicPerson} from '@/lib/ziele';
import {zielStand} from '@/lib/ziele-arten';
import {Sinnbild} from '@/components/sinnbilder';
import {Verweis} from '@/components/verweis';
import {TimelineLive} from '@/components/ziele';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

const SPALTE_STATUS = 128;

export default async function TeamprofilPage({params}: {params: Promise<{userId: string}>}) {
  const viewer = await requireUser();
  const {userId} = await params;
  if (!/^\d+$/.test(userId) || !Number.isSafeInteger(Number(userId))) notFound();
  const id = Number(userId);
  const person = publicPerson(id);
  const angabe = person && personAngabeById(id);
  if (!person || !angabe) notFound();
  const heute = todayISO();
  await clickupAktualisieren();
  const ziele = publicGoals(id, heute);
  const erreicht = ziele.filter((ziel) => ziel.erreicht).length;
  const selbst = viewer.id === id;

  return (
    <>
      <TimelineLive />
      <ZeitRahmen
        titel={person.name}
        person={angabe}
        figur={String(erreicht)}
        figurEinheit={`von ${ziele.length} geteilten ${ziele.length === 1 ? 'Ziel' : 'Zielen'} erreicht`}
        stand={person.eintritt ? `Im Team seit ${fmtDate(person.eintritt)}` : 'Teamprofil'}
        werkzeuge={
          <Verweis className="tafel-verweis" href="/timeline">
            <Text type="supporting" weight="semibold">
              ← Zur Timeline
            </Text>
          </Verweis>
        }
        belege={
          ziele.length === 0 ? (
            <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
              <Sinnbild sinn="ziele" groesse="leer" ton="sekundaer" />
              <VStack gap={2}>
                <Text type="body" color="secondary">
                  {selbst ? 'Du teilst noch kein Ziel.' : `${person.name} teilt noch kein Ziel.`}
                </Text>
                <Text type="supporting" color="secondary">
                  {selbst
                    ? 'Ein geteiltes Ziel steht hier und in der Timeline – mit Titel und Stand, nie mit Stunden.'
                    : 'Geteilte Ziele stehen hier mit Titel und Stand.'}
                </Text>
              </VStack>
            </HStack>
          ) : (
            <VStack gap={0}>
              <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2}>
                <StackItem size="fill">
                  <Text type="label" size="sm" color="secondary">
                    Geteiltes Ziel · Zeitraum
                  </Text>
                </StackItem>
                <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                  <Text type="label" size="sm" color="secondary">
                    Stand
                  </Text>
                </span>
              </HStack>
              <Divider />
              <VStack as="ol" gap={0} className="bahn-stapel">
                {ziele.map((ziel) => {
                  const stand = zielStand(ziel, heute);
                  return (
                    <VStack as="li" key={ziel.id} gap={0} className="bahn-reihe ziel-zeile" id={`ziel-${ziel.id}`}>
                      <HStack gap={3} vAlign="start" paddingInline={2} paddingBlock={3} wrap="nowrap">
                        <StackItem size="fill">
                          <VStack gap={0.5}>
                            <HStack gap={1.5} vAlign="center" wrap="nowrap">
                              <Sinnbild sinn={ziel.erreicht ? 'erfolg' : 'ziele'} groesse="zeile" ton="sekundaer" />
                              <Text type="body" weight="semibold">
                                {ziel.titel}
                              </Text>
                            </HStack>
                            <Text type="supporting" size="sm" color="secondary">
                              {fmtDateRange(ziel.von, ziel.bis)} · {ziel.regel} ·{' '}
                              {ziel.automatisch ? 'automatisch geprüft' : 'selbst bestätigt'}
                              {ziel.erreichtAm ? ` · erreicht am ${fmtDate(ziel.erreichtAm)}` : ''}
                            </Text>
                          </VStack>
                        </StackItem>
                        <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                          <Badge variant={stand.variant} label={stand.label} />
                        </span>
                      </HStack>
                      <Divider />
                    </VStack>
                  );
                })}
              </VStack>
            </VStack>
          )
        }
        kontext={
          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="mitarbeiter" groesse="gross" ton="sekundaer" />
                <Heading level={3}>Im Team</Heading>
              </HStack>
              {angabe.rolle && <Text type="supporting">{angabe.rolle}</Text>}
              {angabe.email && (
                <a className="tafel-verweis" href={`mailto:${angabe.email}`}>
                  <Text type="supporting">{angabe.email}</Text>
                </a>
              )}
              {selbst && (
                <>
                  <Divider />
                  <Verweis className="tafel-verweis" href="/timeline?ansicht=ziele">
                    <Text type="supporting" weight="semibold">
                      Deine Ziele verwalten →
                    </Text>
                  </Verweis>
                  <Verweis className="tafel-verweis" href="/profil">
                    <Text type="supporting" weight="semibold">
                      Profil bearbeiten →
                    </Text>
                  </Verweis>
                </>
              )}
            </VStack>
          </Card>
        }
      />
    </>
  );
}
