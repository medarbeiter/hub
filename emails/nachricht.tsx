/**
 * Die eine Vorlage, in die jede Nachricht dieser Anwendung gegossen wird.
 *
 * Dieselbe Beziehung, die `components/monatsgitter.tsx` zu seinen Zellinhalten
 * hat und `components/pruef-stapel.tsx` zu seinen beiden Warteschlangen: eine
 * Form, austauschbare Nutzlast. Eine neue Nachricht ist ein neuer
 * `MailInhalt` in `lib/benachrichtigungen.ts` — nie eine zweite Vorlage. Acht
 * fast gleiche Dateien wären acht Stellen, an denen die Fußzeile, die
 * Abmeldezeile und der Kopfbalken auseinanderlaufen könnten.
 *
 * Der Aufbau folgt dem Rahmen der Anwendung (`components/zeit-rahmen.tsx`):
 * Kopf mit dem Namen des Hauses, darunter die Aussage, darunter die Tatsachen
 * als Tabelle, dann der Weg zurück. Was die Anwendung „Kopf / Bühne /
 * Belege" nennt, heißt hier Kopf / Aussage / Angaben.
 *
 * Zwei Eigenheiten des Mediums, die den Code erklären:
 *
 *   1. **Tabellen statt Flächen.** Outlook rendert über Word und kennt kein
 *      Flexbox. React Emails `Section`/`Row`/`Column` sind Tabellen — deshalb
 *      liegen die Angaben in `Row`s und nicht in einer Liste.
 *   2. **Hex statt Token.** Siehe den Kopfkommentar in ./farben.ts.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components';
import type {MailInhalt} from '../lib/mail-arten';
import {MAILFARBEN as F, TON_FARBEN} from './farben';

/* Poppins und Figtree liegen selbst gehostet beim Browser und sind im
   Posteingang nicht zu haben. Statt sie über eine Google-Fonts-Adresse
   nachzuladen — was der Anwendung ohnehin verboten ist und dem Postfach des
   Empfängers einen Fremdaufruf unterschöbe — steht hier genau die
   Rückfallkette, die auch das Theme angibt. */
const SCHRIFT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface NachrichtProps extends MailInhalt {
  /** Die Anrede — der Vorname reicht, es ist ein Haus mit einem Dutzend Leuten. */
  anrede: string;
  /** Basisadresse der Anwendung ohne Schrägstrich; ohne sie trägt die Nachricht keinen Knopf. */
  basisUrl: string | null;
  /** Ob die Fußzeile auf die Abbestellung hinweisen darf (Zugangspost darf nicht abbestellt werden). */
  abwaehlbar: boolean;
}

export function Nachricht({
  anrede,
  basisUrl,
  abwaehlbar,
  betreff,
  titel,
  vorspann,
  ton,
  angaben,
  hinweis,
  ziel,
  nachsatz,
}: NachrichtProps) {
  const farbe = TON_FARBEN[ton];
  const url = ziel && basisUrl ? `${basisUrl}${ziel.pfad}` : null;

  return (
    <Html lang="de" dir="ltr">
      <Head />
      {/* Die Vorschauzeile im Posteingang — sonst zöge der Client sich die
          Anrede heran und jede Nachricht sähe gleich aus. */}
      <Preview>{vorspann}</Preview>
      <Body style={{backgroundColor: F.papier, margin: 0, padding: '24px 0', fontFamily: SCHRIFT}}>
        <Container style={{maxWidth: '560px', margin: '0 auto', padding: '0 16px'}}>
          {/* Der Kopfbalken. Der Streifen trägt den Ton, der Name das Haus —
              das Gold darunter ist Fläche und sagt für sich nichts, genau wie
              die Goldwäsche der Stempelleiste in der Anwendung. */}
          <Section style={{backgroundColor: farbe.streifen, height: '4px', lineHeight: '4px', fontSize: '1px'}}>
            &nbsp;
          </Section>
          <Section
            style={{
              backgroundColor: F.goldWaesche,
              borderLeft: `1px solid ${F.kante}`,
              borderRight: `1px solid ${F.kante}`,
              padding: '16px 24px',
            }}
          >
            {/* Das Logo braucht eine absolute Adresse — ein Posteingang kennt
                kein `/logo.png`. Ohne basisUrl bleibt der Schriftzug als Text. */}
            {basisUrl ? (
              <Img
                src={`${basisUrl}/logo.png`}
                alt="MedArbeiter Hub"
                width="154"
                height="28"
                style={{display: 'block'}}
              />
            ) : (
              <Text style={{margin: 0, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: F.bronze, fontWeight: 600}}>
                MedArbeiter Hub
              </Text>
            )}
          </Section>

          <Section
            style={{
              backgroundColor: F.weiss,
              border: `1px solid ${F.kante}`,
              borderTop: 'none',
              padding: '24px',
            }}
          >
            <Heading
              as="h1"
              style={{margin: '0 0 4px', fontSize: '20px', lineHeight: '28px', color: F.ink, fontWeight: 600}}
            >
              {titel}
            </Heading>
            {/* Der Betreff steht schon in der Kopfzeile des Postfachs. Im
                Körper darf er nur noch einmal auftauchen, wenn er mehr sagt
                als die Überschrift — sonst liest man dasselbe zweimal. */}
            {betreff.trim() !== titel.trim() && (
              <Text style={{margin: '0 0 16px', fontSize: '14px', color: F.stein}}>{betreff}</Text>
            )}

            <Text style={{margin: '0 0 8px', fontSize: '15px', lineHeight: '24px', color: F.ink}}>
              Hallo {anrede},
            </Text>
            <Text style={{margin: '0 0 20px', fontSize: '15px', lineHeight: '24px', color: F.ink}}>{vorspann}</Text>

            {angaben.length > 0 && (
              <Section
                style={{
                  backgroundColor: F.pergament,
                  border: `1px solid ${F.kante}`,
                  borderRadius: '6px',
                  padding: '4px 16px',
                  marginBottom: '20px',
                }}
              >
                {angaben.map((angabe, i) => (
                  <Row key={angabe.label} style={i > 0 ? {borderTop: `1px solid ${F.kante}`} : undefined}>
                    {/* Feste Breite, kein Prozentwert: React Email macht aus
                        jeder `Row` eine eigene Tabelle, also teilen sich die
                        Zeilen keine Spaltenbreite. 40 % ergäben je Zeile eine
                        andere Kante — gemessen und deshalb in Pixeln. */}
                    <Column
                      style={{
                        padding: '8px 12px 8px 0',
                        fontSize: '14px',
                        color: F.stein,
                        verticalAlign: 'top',
                        width: '170px',
                      }}
                    >
                      {angabe.label}
                    </Column>
                    {/* Zahlen laufen im Haus tabellarisch — auch hier, damit
                        zwei Beträge untereinander an derselben Stelle brechen. */}
                    <Column
                      style={{
                        padding: '8px 0',
                        fontSize: angabe.betont ? '16px' : '14px',
                        color: F.ink,
                        fontWeight: angabe.betont ? 700 : 500,
                        fontVariantNumeric: 'tabular-nums',
                        verticalAlign: 'top',
                      }}
                    >
                      {angabe.wert}
                    </Column>
                  </Row>
                ))}
              </Section>
            )}

            {hinweis && (
              <Section
                style={{
                  backgroundColor: farbe.flaeche,
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                }}
              >
                <Text style={{margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: farbe.tinte}}>
                  {hinweis.titel}
                </Text>
                <Text style={{margin: 0, fontSize: '15px', lineHeight: '22px', color: F.ink}}>{hinweis.text}</Text>
              </Section>
            )}

            {url && ziel && (
              /* Kein <Button> aus der Bibliothek: der setzt padding auf ein
                 <a>, und Outlook rechnet das nicht. Eine Tabellenzelle mit
                 Hintergrund ist die Form, die überall ankommt. Die Hausregel
                 „Gold braucht eine Kante" gilt auch hier — die Fläche allein
                 hebt sich nicht genug vom Weiß ab. */
              <Section style={{marginBottom: '20px'}}>
                <Row>
                  <Column
                    style={{
                      backgroundColor: F.gold,
                      border: `1px solid ${F.bronze}`,
                      borderRadius: '999px',
                      padding: '11px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <Link
                      href={url}
                      style={{color: F.aufGold, fontSize: '15px', fontWeight: 600, textDecoration: 'none'}}
                    >
                      {ziel.label}
                    </Link>
                  </Column>
                </Row>
              </Section>
            )}

            {nachsatz && (
              <Text style={{margin: '0 0 4px', fontSize: '14px', lineHeight: '22px', color: F.stein}}>{nachsatz}</Text>
            )}
          </Section>

          <Hr style={{borderColor: F.kante, margin: '20px 0 12px'}} />
          <Text style={{margin: 0, fontSize: '12px', lineHeight: '18px', color: F.stein}}>
            Diese Nachricht kommt automatisch aus dem MedArbeiter Hub, der Zeiterfassung des Hauses.
            {url ? ' Antworten auf diese Adresse liest niemand – der Weg zurück führt über den Knopf oben.' : ''}
          </Text>
          {abwaehlbar && (
            <Text style={{margin: '6px 0 0', fontSize: '12px', lineHeight: '18px', color: F.stein}}>
              Solche Hinweise lassen sich unter{' '}
              {basisUrl ? (
                <Link href={`${basisUrl}/profil`} style={{color: F.bronze}}>
                  Profil → Persönliche Einstellungen
                </Link>
              ) : (
                'Profil → Persönliche Einstellungen'
              )}{' '}
              abbestellen.
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export default Nachricht;
