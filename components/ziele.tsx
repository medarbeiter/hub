'use client';

import {Badge, Banner, Button, CheckboxInput, DialogHeader, Divider, HStack, MultiSelector, ProgressBar, Selector, StackItem, Text, TextInput, VStack} from '@astryxdesign/core';
import {useEffect, useState, useTransition, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {zielAnlegenAction, zielErledigenAction, zielLoeschenAction, zielSichtbarkeitAction, zielWiederholungAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {addDays, addMonths, daysInMonth, fmtDate, fmtDateRange, fmtDuration, fmtTime, isoToMin, mondayOf, monthOf} from '@/lib/format';
import type {GoalView} from '@/lib/ziele';
import {JE_LABEL, MESSUNGEN, TEAM_MESSUNGEN, vergleichLabel, WIEDERHOLUNG_LABEL, zielSatz, zielStand, type Je, type Messung, type Vergleich, type Wiederholung, type ZielRegel} from '@/lib/ziele-arten';
import {DatumFeld} from './datum-feld';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

/** Ein sichtbarer Feed holt neue Ereignisse; ein verdeckter Reiter macht keine Arbeit. */
export function TimelineLive() {
  const router = useRouter();
  useEffect(() => {
    const aktualisieren = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const takt = window.setInterval(aktualisieren, 30_000);
    window.addEventListener('focus', aktualisieren);
    document.addEventListener('visibilitychange', aktualisieren);
    return () => {
      window.clearInterval(takt);
      window.removeEventListener('focus', aktualisieren);
      document.removeEventListener('visibilitychange', aktualisieren);
    };
  }, [router]);
  return null;
}

export interface RollenWahl { schluessel: string; label: string }

export function ZielAnlegen({heute, clickup = false, rollen = [], wir = false}: {heute: string; clickup?: boolean; rollen?: RollenWahl[]; wir?: boolean}) {
  const [offen, setOffen] = useState(false);
  return <>
    <Button label="Neues Ziel" variant="primary" icon={<Sinnbild sinn="hinzufuegen" />} onClick={() => setOffen(true)} />
    <TafelDialog isOpen={offen} onOpenChange={setOffen} width={680}>
      <DialogHeader title="Dein nächstes Ziel" />
      {offen && <ZielFormular heute={heute} clickup={clickup} rollen={rollen} vorgabeWir={wir} fertig={() => setOffen(false)} />}
    </TafelDialog>
  </>;
}

type ZeitraumWahl = 'diese-woche' | 'jede-woche' | 'naechste-woche' | 'dieser-monat' | 'jeden-monat' | 'naechster-monat' | 'jahresende' | 'eigen';
const ZEITRAEUME: {value: ZeitraumWahl; label: string}[] = [
  {value: 'diese-woche', label: 'diese Woche'},
  {value: 'jede-woche', label: 'jede Woche'},
  {value: 'naechste-woche', label: 'nächste Woche'},
  {value: 'dieser-monat', label: 'in diesem Monat'},
  {value: 'jeden-monat', label: 'jeden Monat'},
  {value: 'naechster-monat', label: 'im nächsten Monat'},
  {value: 'jahresende', label: 'bis Jahresende'},
  {value: 'eigen', label: 'in einem eigenen Zeitraum'},
];
function zeitraumDaten(wahl: ZeitraumWahl, heute: string): [string, string] {
  const montag = mondayOf(heute);
  const monat = (m: string) => { const tage = daysInMonth(m); return [tage[0]!, tage[tage.length - 1]!] as [string, string]; };
  switch (wahl) {
    case 'diese-woche': case 'jede-woche': return [montag, addDays(montag, 6)];
    case 'naechste-woche': return [addDays(montag, 7), addDays(montag, 13)];
    case 'dieser-monat': case 'jeden-monat': return monat(monthOf(heute));
    case 'naechster-monat': return monat(addMonths(monthOf(heute), 1));
    case 'jahresende': return [heute, `${heute.slice(0, 4)}-12-31`];
    default: return [heute, addDays(heute, 6)];
  }
}
/** Ein Vorschlag je Messung, damit der Satz nie leer anfängt. */
const VORGABE: Record<Messung, number | null> = {arbeitszeit: 480, pausen: null, erfassung: null, anfang: 9 * 60, feierabend: 17 * 60, aufgaben: 20, clickupzeit: 20 * 60, frei: null};

/** Ein Baustein im Satz: eine Auswahl ohne sichtbares Etikett, in der Zeile stehend. */
function Baustein({label, value, onChange, options, isDisabled}: {label: string; value: string; onChange: (v: string) => void; options: {value: string; label: string}[]; isDisabled?: boolean}) {
  return <span className="ziel-baustein"><Selector label={label} isLabelHidden value={value} onChange={onChange} options={options} isDisabled={isDisabled} /></span>;
}

function ZielFormular({heute, clickup, rollen, vorgabeWir, fertig}: {heute: string; clickup: boolean; rollen: RollenWahl[]; vorgabeWir: boolean; fertig: () => void}) {
  const router = useRouter();
  const [wir, setWir] = useState(vorgabeWir);
  const [rollenWahl, setRollenWahl] = useState<string[]>([]);
  const [messung, setMessung] = useState<Messung>(vorgabeWir ? (clickup ? 'aufgaben' : 'frei') : 'arbeitszeit');
  const [vergleich, setVergleich] = useState<Vergleich>('min');
  const [je, setJe] = useState<Je>(vorgabeWir ? 'zeitraum' : 'tag');
  const [wert, setWert] = useState<string>(vorgabeWir && clickup ? '20' : '8');
  const [zeitraum, setZeitraum] = useState<ZeitraumWahl>('diese-woche');
  const [von, setVon] = useState(mondayOf(heute));
  const [bis, setBis] = useState(addDays(mondayOf(heute), 6));
  const [vorhaben, setVorhaben] = useState('');
  const [titel, setTitel] = useState('');
  const [oeffentlich, setOeffentlich] = useState(true);
  const [titelOffen, setTitelOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const m = MESSUNGEN[messung];
  const uhrzeit = m.einheit === 'uhrzeit';
  const wertMinuten: number | null = m.einheit === null ? null
    : uhrzeit ? isoToMin(wert)
    : wert.trim() === '' ? null
    : Math.round(Number(wert.trim().replace(',', '.')) * (messung === 'pausen' || m.einheit === 'anzahl' ? 1 : 60));
  const regel: ZielRegel = {messung, vergleich, je, wert: Number.isFinite(wertMinuten) ? wertMinuten : null};
  const satz = messung === 'frei' ? vorhaben : zielSatz(regel);
  const wiederholung: Wiederholung = zeitraum === 'jede-woche' ? 'woche' : zeitraum === 'jeden-monat' ? 'monat' : 'keine';

  function werWaehlen(wahl: string) {
    const team = wahl === 'wir';
    setWir(team);
    if (team && !TEAM_MESSUNGEN.includes(messung)) messungWaehlen(clickup ? 'aufgaben' : 'frei');
    else if (team && je === 'tag') jeWaehlen(MESSUNGEN[messung].je.find((j) => j !== 'tag') ?? 'zeitraum');
  }
  function messungWaehlen(wahl: string) {
    const neu = wahl as Messung;
    const vorgabe = VORGABE[neu];
    setMessung(neu);
    setVergleich(MESSUNGEN[neu].vergleiche[0] ?? 'min');
    setJe(MESSUNGEN[neu].je.find((j) => !wir || j !== 'tag') ?? 'tag');
    setWert(vorgabe === null ? '' : MESSUNGEN[neu].einheit === 'uhrzeit' ? fmtTime(vorgabe) : MESSUNGEN[neu].einheit === 'anzahl' ? String(vorgabe) : String(vorgabe / 60));
    setTitel('');
    setFehler(null);
  }
  function jeWaehlen(wahl: string) {
    const neu = wahl as Je;
    setJe(neu);
    if (neu === 'woche') { setVon(mondayOf(von)); setBis(addDays(mondayOf(bis), 6)); }
    if (neu !== 'tag' && wert === '8') setWert('40');
    if (neu === 'tag' && wert === '40') setWert('8');
  }
  function zeitraumWaehlen(wahl: string) {
    const neu = wahl as ZeitraumWahl;
    setZeitraum(neu);
    const [v, b] = zeitraumDaten(neu, heute);
    setVon(je === 'woche' ? mondayOf(v) : v);
    setBis(je === 'woche' ? addDays(mondayOf(b), 6) : b);
  }

  function speichern(event: FormEvent) {
    event.preventDefault();
    setFehler(null);
    startTransition(async () => {
      const antwort = await sicher(zielAnlegenAction)({...regel, titel: messung === 'frei' ? vorhaben : titel, von, bis, oeffentlich: oeffentlich || wir, wiederholung, team: wir, rollen: wir ? rollenWahl : []});
      if (antwort.error) {setFehler(antwort.error); return;}
      fertig();
      router.push('/timeline?ansicht=ziele');
      router.refresh();
    });
  }

  const messungen = (Object.keys(MESSUNGEN) as Messung[])
    .filter((value) => ((value !== 'aufgaben' && value !== 'clickupzeit') || clickup) && (!wir || TEAM_MESSUNGEN.includes(value)))
    .map((value) => ({value, label: value === 'frei' ? 'etwas Eigenes schaffen' : MESSUNGEN[value].verb}));
  const vergleiche = m.vergleiche.map((value) => ({value, label: vergleichLabel(messung, value)}));
  const haeufigkeiten = m.je.filter((value) => !wir || value !== 'tag').map((value) => ({value, label: JE_LABEL[value]}));

  return <form onSubmit={speichern} className="tafel-rumpf">
    <VStack gap={5} padding={6}>
      <VStack gap={3}>
        <Text type="supporting" color="secondary">Setz deinen Satz zusammen – jedes Wort mit Pfeil lässt sich tauschen.</Text>
        <div className="ziel-satz" role="group" aria-label="Dein Zielsatz">
          <Baustein label="Wer" value={wir ? 'wir' : 'ich'} onChange={werWaehlen} options={[{value: 'ich', label: 'Ich'}, {value: 'wir', label: 'Wir als Team'}]} isDisabled={pending} />
          {wir && rollen.length > 0 && <>
            <span>–</span>
            <span className="ziel-baustein"><MultiSelector label="Nur diese Rollen" isLabelHidden triggerDisplay="labels" placeholder="alle Rollen" value={rollenWahl} onChange={setRollenWahl} options={rollen.map((r) => ({value: r.schluessel, label: r.label}))} isDisabled={pending} /></span>
            <span>–</span>
          </>}
          <span>{wir ? 'möchten' : 'möchte'}</span>
          <Baustein label="Zeitraum" value={zeitraum} onChange={zeitraumWaehlen} options={ZEITRAEUME} isDisabled={pending} />
          {haeufigkeiten.length > 1 && <Baustein label="Wie oft" value={je} onChange={jeWaehlen} options={haeufigkeiten} isDisabled={pending} />}
          {haeufigkeiten.length === 1 && <span>{JE_LABEL[je]}</span>}
          {vergleiche.length > 0 && <Baustein label="Vergleich" value={vergleich} onChange={(v) => setVergleich(v as Vergleich)} options={vergleiche} isDisabled={pending} />}
          {m.einheit === 'dauer' && <>
            <span className="ziel-baustein"><TextInput label={messung === 'pausen' ? 'Minuten Pause' : 'Stunden'} isLabelHidden width={messung === 'pausen' ? 180 : 80} value={wert} onChange={setWert} placeholder={messung === 'pausen' ? 'wie vorgeschrieben' : '8'} isDisabled={pending} /></span>
            <span>{messung === 'pausen' ? 'Minuten' : 'Stunden'}</span>
          </>}
          {m.einheit === 'anzahl' && <span className="ziel-baustein"><TextInput label="Anzahl Aufgaben" isLabelHidden width={80} value={wert} onChange={setWert} placeholder="20" isDisabled={pending} /></span>}
          {uhrzeit && <>
            <span>um</span>
            <span className="ziel-baustein"><TextInput label="Uhrzeit" isLabelHidden width={96} value={wert} onChange={setWert} placeholder="09:00" isDisabled={pending} /></span>
            <span>Uhr</span>
          </>}
          {messung === 'frei' && <span className="ziel-baustein ziel-frei"><TextInput label="Dein Vorhaben" isLabelHidden width="100%" value={vorhaben} onChange={setVorhaben} placeholder="… das Lager neu sortieren" isDisabled={pending} /></span>}
          <Baustein label="Was" value={messung} onChange={messungWaehlen} options={messungen} isDisabled={pending} />
          <span>.</span>
        </div>
        <Text type="supporting" size="sm" color="secondary">{wir ? m.hinweis.replace('die dir in ClickUp zugewiesen sind', 'die jemandem aus dem Team in ClickUp zugewiesen sind').replace('Zählt die Zeit, die', 'Zählt die Zeit, die das ganze Team') : m.hinweis}</Text>
      </VStack>

      {(zeitraum === 'eigen' || je === 'woche') && (
        <HStack gap={3} wrap="wrap">
          <DatumFeld label={je === 'woche' ? 'Ab Montag' : 'Von'} value={von} onChange={(datum) => {
            const start = je === 'woche' ? mondayOf(datum) : datum;
            setVon(start);
            if (bis < (je === 'woche' ? addDays(start, 6) : start)) setBis(je === 'woche' ? addDays(start, 6) : start);
          }} />
          <DatumFeld label={je === 'woche' ? 'Bis Sonntag' : 'Bis'} value={bis} min={von} max={addDays(von, 365)} onChange={(datum) => setBis(je === 'woche' ? addDays(mondayOf(datum), 6) : datum)} />
        </HStack>
      )}

      <Divider />

      <HStack gap={4} vAlign="start" wrap="wrap">
        <StackItem size="fill">
          <VStack gap={1}>
            <HStack gap={1.5} vAlign="center" wrap="nowrap">
              <Sinnbild sinn="ziele" groesse="zeile" ton="sekundaer" />
              <Text type="body" weight="semibold">{(messung === 'frei' ? vorhaben : titel) || satz || 'Dein Ziel'}</Text>
            </HStack>
            <Text type="supporting" size="sm" color="secondary">
              {wir && `Teamziel · ${rollenWahl.length ? rollen.filter((r) => rollenWahl.includes(r.schluessel)).map((r) => r.label).join(', ') + ' zählen mit' : 'alle zählen mit'} · `}{fmtDateRange(von, bis)}{wiederholung !== 'keine' && ` · ${WIEDERHOLUNG_LABEL[wiederholung]}`} · {messung === 'frei' ? 'du bestätigst es selbst' : messung === 'aufgaben' || messung === 'clickupzeit' ? 'automatisch aus ClickUp gezählt' : 'automatisch aus der Zeiterfassung geprüft, Korrekturen zählen'}
            </Text>
          </VStack>
        </StackItem>
        {messung !== 'frei' && !titelOffen && (
          <Button size="sm" variant="ghost" label="Titel anpassen" icon={<Sinnbild sinn="bearbeiten" />} isDisabled={pending} onClick={() => setTitelOffen(true)} />
        )}
      </HStack>
      {messung !== 'frei' && titelOffen && (
        <TextInput label="Eigener Titel" value={titel} onChange={setTitel} placeholder={satz} description="Leer lassen heißt: der Satz oben ist der Titel." isDisabled={pending} />
      )}

      {!wir && <CheckboxInput label="Mit dem Team teilen" value={oeffentlich} onChange={setOeffentlich} isDisabled={pending} description="Ziel und Erfolg erscheinen in der Timeline und auf deinem Profil." />}
      {fehler && <Banner status="error" title={fehler} />}
      <HStack gap={2} justify="end">
        <Button label="Abbrechen" onClick={fertig} isDisabled={pending} />
        <Button label="Ziel setzen" type="submit" variant="primary" isLoading={pending} icon={<Sinnbild sinn="ziele" />} />
      </HStack>
    </VStack>
  </form>;
}

export function TeamZiele({ziele, viewerId, heute}: {ziele: GoalView[]; viewerId: number; heute: string}) {
  if (!ziele.length) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="team" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Noch kein Ziel für das Team gesetzt.
          </Text>
          <Text type="supporting" color="secondary">
            Ein Teamziel zählt alle zusammen – oder nur die Rollen, die du auswählst. Es ist für alle sichtbar; ändern kann es, wer es gesetzt hat.
          </Text>
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack gap={0}>
      <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2}>
        <StackItem size="fill">
          <Text type="label" size="sm" color="secondary">
            Ziel · Zeitraum · wer mitzählt
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
        {ziele.map((ziel) => (
          <ZielZeile key={ziel.id} ziel={ziel} heute={heute} eigene={ziel.user_id === viewerId} />
        ))}
      </VStack>
    </VStack>
  );
}

export function MeineZiele({ziele, heute}: {ziele: GoalView[]; heute: string}) {
  if (!ziele.length) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="ziele" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Noch kein Ziel gesetzt.
          </Text>
          <Text type="supporting" color="secondary">
            Ein Zeitziel misst die Zeiterfassung von selbst; ein eigenes Vorhaben schließt du selbst ab.
            Was du teilst, steht in der Timeline und auf deinem Teamprofil.
          </Text>
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack gap={0}>
      <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2}>
        <StackItem size="fill">
          <Text type="label" size="sm" color="secondary">
            Ziel · Zeitraum
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
        {ziele.map((ziel) => (
          <ZielZeile key={ziel.id} ziel={ziel} heute={heute} />
        ))}
      </VStack>
    </VStack>
  );
}

const SPALTE_STATUS = 128;

function ZielZeile({ziel, heute, eigene = true}: {ziel: GoalView; heute: string; eigene?: boolean}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState(false);
  const [pending, startTransition] = useTransition();
  const automatisch = ziel.messung !== 'frei';
  const stand = zielStand(ziel, heute);
  const fmt = (n: number) => (ziel.einheit === 'Minuten' ? fmtDuration(n) : String(n));
  const einheit = ziel.einheit === 'Minuten' ? 'Std.' : ziel.einheit === 'Aufgaben' ? (ziel.ziel === 1 ? 'Aufgabe' : 'Aufgaben') : ziel.einheit === 'Wochen' ? (ziel.ziel === 1 ? 'Woche' : 'Wochen') : ziel.ziel === 1 ? 'Tag' : 'Tagen';
  const fortschritt = `${fmt(ziel.fortschritt)} von ${fmt(ziel.ziel)} ${einheit}`;

  function handeln(aktion: () => Promise<{error: string | null}>) {
    setFehler(null);
    startTransition(async () => {
      const antwort = await sicher(aktion)();
      if (antwort.error) setFehler(antwort.error);
      else {
        setLoeschen(false);
        router.refresh();
      }
    });
  }

  return (
    <VStack as="li" gap={0} className="bahn-reihe ziel-zeile" id={`ziel-${ziel.id}`}>
      <HStack gap={3} vAlign="start" paddingInline={2} paddingBlock={3} wrap="nowrap">
        <StackItem size="fill">
          <VStack gap={2}>
            <VStack gap={0.5}>
              <HStack gap={1.5} vAlign="center" wrap="nowrap">
                <Sinnbild sinn={ziel.erreicht ? 'erfolg' : 'ziele'} groesse="zeile" ton="sekundaer" />
                <Text type="body" weight="semibold">
                  {ziel.titel}
                </Text>
              </HStack>
              <Text type="supporting" size="sm" color="secondary">
                {ziel.team && ziel.ersteller ? `Teamziel von ${ziel.ersteller} · ${ziel.rollenLabels?.length ? ziel.rollenLabels.join(', ') : 'alle'} zählen mit · ` : ''}{fmtDateRange(ziel.von, ziel.bis)} · {ziel.regel} · {automatisch ? 'automatisch geprüft' : 'selbst bestätigt'}{!ziel.team && ` · ${ziel.oeffentlich ? 'im Team sichtbar' : 'privat'}`}{ziel.wiederholung !== 'keine' && ` · ${WIEDERHOLUNG_LABEL[ziel.wiederholung]}`}
              </Text>
            </VStack>
            {automatisch && ziel.ziel > 0 && (
              <VStack gap={1}>
                <ProgressBar label={`Fortschritt: ${ziel.titel}`} isLabelHidden value={Math.min(ziel.fortschritt, ziel.ziel)} max={ziel.ziel} variant={ziel.erreicht ? 'success' : 'neutral'} />
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {fortschritt}
                </Text>
              </VStack>
            )}
            {automatisch && ziel.ziel === 0 && (
              <Text type="supporting" size="sm" color="secondary">
                In diesem Zeitraum liegt kein Arbeitstag mit Soll.
              </Text>
            )}
            {ziel.erreicht && ziel.erreichtAm && (
              <Text type="supporting" size="sm" color="secondary">
                Erreicht am {fmtDate(ziel.erreichtAm)}.
              </Text>
            )}
            {stand.label === 'Nicht erreicht' && automatisch && (
              <Text type="supporting" size="sm" color="secondary">
                Nachgetragene oder korrigierte Zeiten zählen weiter.
              </Text>
            )}
            {eigene && <HStack gap={1} wrap="wrap">
              {!automatisch && (
                <Button size="sm" variant="ghost" label={ziel.erreicht ? 'Wieder öffnen' : 'Als erreicht markieren'} icon={<Sinnbild sinn={ziel.erreicht ? 'erneut' : 'erfolg'} />} isDisabled={pending} onClick={() => handeln(() => zielErledigenAction(ziel.id, !ziel.erreicht))} />
              )}
              {!ziel.team && <Button size="sm" variant="ghost" label={ziel.oeffentlich ? 'Privat stellen' : 'Mit dem Team teilen'} isDisabled={pending} onClick={() => handeln(() => zielSichtbarkeitAction(ziel.id, !ziel.oeffentlich))} />}
              {ziel.wiederholung !== 'keine' && ziel.bis >= heute && (
                <Button size="sm" variant="ghost" label="Wiederholung beenden" icon={<Sinnbild sinn="erneut" />} isDisabled={pending} onClick={() => handeln(() => zielWiederholungAction(ziel.id, 'keine'))} />
              )}
              {!loeschen && <Button size="sm" variant="ghost" label="Löschen" icon={<Sinnbild sinn="entfernen" />} isDisabled={pending} onClick={() => setLoeschen(true)} />}
            </HStack>}
            {loeschen && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="supporting">Ziel samt seinen Timeline-Einträgen löschen?</Text>
                <Button label="Behalten" size="sm" isDisabled={pending} onClick={() => setLoeschen(false)} />
                <Button label="Ziel löschen" size="sm" variant="destructive" isLoading={pending} onClick={() => handeln(() => zielLoeschenAction(ziel.id))} />
              </HStack>
            )}
            {fehler && <Banner status="error" title={fehler} />}
          </VStack>
        </StackItem>
        <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
          <Badge variant={stand.variant} label={stand.label} />
        </span>
      </HStack>
      <Divider />
    </VStack>
  );
}
