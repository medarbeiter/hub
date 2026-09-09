'use client';

import {Badge, Button, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Popover} from '@astryxdesign/core/Popover';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {reaktionAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {personAngabe} from '@/lib/avatar';
import {fmtDate, fmtWeekdayShort} from '@/lib/format';
import type {Reaktion, TimelineEvent} from '@/lib/ziele';
import {EMOJIS, SCHNELL_EMOJIS} from '@/lib/ziele-arten';
import {useMelde} from './melde';
import {PersonenReihe, PersonKarte, PersonZeichen} from './person-zeichen';
import {Sinnbild, type Sinn} from './sinnbilder';
import {Verweis} from './verweis';

/* Ein Zeichen je Ereignis — es steht vor der Überschrift und sagt, was sie
   sagt. Jubiläum und erreichtes Ziel tragen dasselbe Anerkennen. */
const SINN: Record<TimelineEvent['art'], Sinn> = {
  eintritt: 'teamleben',
  registrierung: 'teamleben',
  jubilaeum: 'erfolg',
  geburtstag: 'geburtstag',
  ziel_erstellt: 'ziele',
  ziel_erreicht: 'erfolg',
};

interface TeamEreignisseProps {
  events: TimelineEvent[];
  reaktionen: Record<string, Reaktion[]>;
}

/**
 * Der Strang: ein Tag je Zeile links, eine Linie, an der jedes Ereignis mit
 * dem Gesicht seiner Person hängt, und rechts der Beitrag — Name und Tag,
 * die Überschrift, der Satz darunter, die Reaktionen. Ereignisse desselben
 * Tages hängen an einem Datum. Das Gesicht **ist** der Knoten, wie im
 * Teamkalender das Gesicht die Marke ist: wer hier etwas erlebt hat, steht auf
 * der Achse, nicht neben ihr.
 */
export function TeamEreignisse({events, reaktionen}: TeamEreignisseProps) {
  if (!events.length) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="teamleben" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Noch kein Ereignis im Team.
          </Text>
          <Text type="supporting" color="secondary">
            Eintritte, Jubiläen und geteilte Ziele erscheinen hier, sobald es sie gibt. Ein Ziel, das du
            mit dem Team teilst, ist das erste.
          </Text>
        </VStack>
      </HStack>
    );
  }

  // Neu über gesehen, mit einer Schnittkante dazwischen — nur wenn es beides
  // gibt. Ohne Neues steht der Strang wie immer, ohne Gesehenes trägt jeder
  // Beitrag seine Marke und braucht keine Kante.
  const neue = events.filter((e) => e.neu);
  const gesehene = events.filter((e) => !e.neu);
  if (!neue.length || !gesehene.length) return <Strang events={events} reaktionen={reaktionen} />;
  return (
    <VStack gap={0}>
      <Strang events={neue} reaktionen={reaktionen} />
      <HStack gap={2} vAlign="center" wrap="nowrap" className="strang-kante" role="separator" aria-label="Bereits gesehen">
        <Sinnbild sinn="gesehen" groesse="zeile" ton="sekundaer" />
        <Text type="supporting" color="secondary" weight="medium">
          Bereits gesehen
        </Text>
      </HStack>
      <Strang events={gesehene} reaktionen={reaktionen} gesehen />
    </VStack>
  );
}

function Strang({events, reaktionen, gesehen = false}: TeamEreignisseProps & {gesehen?: boolean}) {
  const tage: Array<{datum: string; ereignisse: TimelineEvent[]}> = [];
  for (const ereignis of events) {
    const letzter = tage[tage.length - 1];
    if (letzter?.datum === ereignis.date) letzter.ereignisse.push(ereignis);
    else tage.push({datum: ereignis.date, ereignisse: [ereignis]});
  }

  return (
    <ol className={gesehen ? 'strang strang-gesehen' : 'strang'} aria-label={gesehen ? 'Bereits gesehene Ereignisse' : 'Ereignisse im Team, neueste zuerst'}>
      {tage.map((tag) => (
        <li key={tag.datum} className="strang-tag">
          <time dateTime={tag.datum} className="strang-datum">
            <VStack gap={0}>
              <Text type="supporting" size="sm" hasTabularNumbers>
                {fmtWeekdayShort(tag.datum)}
              </Text>
              <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                {fmtDate(tag.datum)}
              </Text>
            </VStack>
          </time>
          <ol className="strang-ereignisse">
            {tag.ereignisse.map((ereignis) => (
              <Beitrag key={ereignis.id} ereignis={ereignis} reaktionen={reaktionen[ereignis.id] ?? []} gesehen={gesehen} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function Beitrag({ereignis, reaktionen, gesehen}: {ereignis: TimelineEvent; reaktionen: Reaktion[]; gesehen: boolean}) {
  const person = personAngabe(ereignis.person);
  const profil = `/profil/${ereignis.person.id}`;
  const [karte, setKarte] = useState(false);

  return (
    <li className="strang-ereignis">
      {/* Das Gesicht auf der Linie und der Name daneben sind **ein** Knopf:
          beide öffnen die Personenkarte. Das Zeichen zeichnet darum nur
          (`karte={false}`) — sonst stünde ein Knopf im Knopf. */}
      <span className="strang-punkt">
        <PersonZeichen person={person} groesse="karte" karte={false} ohneBlase />
      </span>
      <article className="strang-beitrag" aria-labelledby={`${ereignis.id}-titel`}>
        <VStack gap={3}>
          <VStack gap={1}>
            <span className="strang-kopf">
              <button type="button" className="strang-person" onClick={() => setKarte(true)}>
                <Text type="label" weight="semibold">
                  {ereignis.person.name}
                </Text>
              </button>
              {ereignis.neu && <Badge variant="info" label="Neu" />}
            </span>
            <HStack gap={2} vAlign="center" wrap="nowrap">
              <Sinnbild sinn={SINN[ereignis.art]} groesse="gross" ton="sekundaer" />
              {/* Farbe über die Klasse, nicht die Prop: der gesehene Titel kehrt beim Zeigen zurück (globals.css). */}
              <Heading level={3} id={`${ereignis.id}-titel`} className={gesehen ? 'strang-titel strang-titel-gesehen' : 'strang-titel'}>
                {ereignis.titel}
              </Heading>
            </HStack>
            <Text type="body" color="secondary">
              {ereignis.beschreibung}
            </Text>
            {ereignis.goalId !== undefined && (
              <Verweis className="tafel-verweis" href={`${profil}#ziel-${ereignis.goalId}`}>
                <Text type="supporting" weight="semibold">
                  Ziel ansehen →
                </Text>
              </Verweis>
            )}
          </VStack>
          <ReaktionsLeiste ereignis={ereignis.id} reaktionen={reaktionen} />
        </VStack>
      </article>
      <PersonKarte person={person} isOpen={karte} onOpenChange={setKarte} blattHref={profil} blattText="Zum Teamprofil" />
    </li>
  );
}

/**
 * Was unter einem Beitrag steht: je Emoji ein Zähler mit den Gesichtern, die
 * es gegeben haben; dahinter die Schnellreaktionen, die noch niemand gegeben
 * hat, und zuletzt die ganze Auswahl im Aufklapper. Eine Reaktion ist kein
 * Eingriff in den Datensatz — sie schlägt leise fehl, als Meldung, und die
 * Seite holt sich den Stand danach neu.
 */
function ReaktionsLeiste({ereignis, reaktionen}: {ereignis: string; reaktionen: Reaktion[]}) {
  const router = useRouter();
  const melde = useMelde();
  const [pending, startTransition] = useTransition();
  const [laufend, setLaufend] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState(false);
  const gegeben = reaktionen.filter((r) => r.anzahl > 0);
  const schnell = SCHNELL_EMOJIS.filter((e) => !gegeben.some((r) => r.art === e));

  function umschalten(emoji: string) {
    setAuswahl(false);
    setLaufend(emoji);
    startTransition(async () => {
      const antwort = await sicher(reaktionAction)(ereignis, emoji);
      setLaufend(null);
      if (antwort.error) melde({ton: 'fehler', titel: 'Reaktion nicht gespeichert', text: antwort.error});
      else router.refresh();
    });
  }

  return (
    <HStack gap={2} vAlign="center" wrap="wrap" role="group" aria-label="Reaktionen">
      {gegeben.map((r) => (
        <span key={r.art} className="reaktion-chip" data-eigene={r.eigene || undefined}>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={r.eigene}
            aria-label={`${r.art} ${r.anzahl} – ${r.eigene ? 'eigene Reaktion zurücknehmen' : 'auch so reagieren'}`}
            icon={<span className="reaktion-emoji" aria-hidden>{r.art}</span>}
            label={String(r.anzahl)}
            isLoading={pending && laufend === r.art}
            isDisabled={pending && laufend !== r.art}
            onClick={() => umschalten(r.art)}
          />
          <span className="reaktion-gesichter">
            <PersonenReihe
              personen={r.personen.map(personAngabe)}
              groesse="winzig"
              max={3}
              beschriftung={`${r.anzahl} mal ${r.art}`}
            />
          </span>
        </span>
      ))}
      {schnell.map((emoji) => (
        <Button
          key={emoji}
          size="sm"
          variant="ghost"
          isIconOnly
          icon={<span className="reaktion-emoji" aria-hidden>{emoji}</span>}
          label={`Mit ${emoji} reagieren`}
          isLoading={pending && laufend === emoji}
          isDisabled={pending && laufend !== emoji}
          onClick={() => umschalten(emoji)}
        />
      ))}
      <Popover
        isOpen={auswahl}
        onOpenChange={setAuswahl}
        placement="above"
        alignment="start"
        label="Reaktion wählen"
        width={280}
        content={
          <div className="emoji-raster" role="group" aria-label="Alle Reaktionen">
            {EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                size="sm"
                variant="ghost"
                isIconOnly
                icon={<span className="reaktion-emoji" aria-hidden>{emoji}</span>}
                label={`Mit ${emoji} reagieren`}
                onClick={() => umschalten(emoji)}
              />
            ))}
          </div>
        }
      >
        <Button size="sm" variant="ghost" isIconOnly icon={<Sinnbild sinn="hinzufuegen" form="umriss" />} label="Weitere Reaktion" isDisabled={pending} />
      </Popover>
    </HStack>
  );
}
