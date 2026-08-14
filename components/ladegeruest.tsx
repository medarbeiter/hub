import {Card, HStack, Skeleton, StackItem, VStack} from '@astryxdesign/core';
import type {ReactNode} from 'react';

/**
 * Das Ladegerüst: die Form dessen, was kommt — kein Kreisel.
 *
 * Eine Route dieser Anwendung wird auf dem Server gerechnet (Zeitkonto,
 * Feiertage, Projektionen), und zwischen Klick und Bild liegt ein Moment. Was
 * in diesem Moment steht, entscheidet, ob der Sprung danach ein *Schärferwerden*
 * ist oder ein *Umbauen*. Ein Kreisel in der Mitte des Blattes ist immer ein
 * Umbauen: er hat die Größe des Inhalts nicht, also springt beim Eintreffen
 * alles an seinen Platz.
 *
 * Darum gibt es hier keine allgemeine Ladeanzeige, sondern **dasselbe Gerüst
 * wie der Rahmen**: `LadeRahmen` zeichnet Kopfband, Bühne, Belege und
 * Kontextspalte in genau den Klassen, die `zeit-rahmen.tsx` benutzt
 * (`.kopf-band`, `.zeit-blatt`, `.zeit-inhalt`, `.kontext-rail`), und die
 * Füllungen darunter haben die Maße der Sachen, die sie vertreten — die
 * Tagesspalte ist 76px breit, weil sie es im Bahnenstapel ist; die
 * Gitterzelle ist 62px hoch, weil `--gitter-zellhoehe` das sagt.
 *
 * Die Regel ist dieselbe wie beim Rahmen selbst: **eine Form, alle Routen.**
 * Eine neue Seite fügt hier keine neue Ladeanzeige hinzu, sie wählt aus den
 * vier Füllungen unten die, die ihrem Inhalt entspricht — Bahnen, Gitter,
 * Tafel oder Zeilen. Wer eine fünfte braucht, hat wahrscheinlich eine fünfte
 * Inhaltsform gebaut, und die gehört zuerst besprochen.
 *
 * Bewegung kommt keine dazu. Astryx' `Skeleton` pulsiert von selbst, gestaffelt
 * über `index`, und ist für `prefers-reduced-motion` dort bereits stillgelegt.
 */

interface LadeRahmenProps {
  /** Trägt die Seite eine Zeitraumleiste? Ohne Zeitraum steht dort nichts. */
  nav?: boolean;
  /** Trägt der Kopf rechts Marken oder Werkzeuge? */
  werkzeuge?: boolean;
  /** Zeit als Form — die Bühne. Seiten ohne Zeitachse lassen sie weg. */
  buehne?: ReactNode;
  /** Der Nachweis, als Zeilen. */
  belege?: ReactNode;
  /** Die Kontextspalte rechts. Fehlt sie, läuft das Blatt einspaltig. */
  kontext?: ReactNode;
}

/**
 * Der Rahmen als Gerüst — Klasse für Klasse derselbe wie `ZeitRahmen`, damit
 * die Spalten beim Eintreffen des Inhalts nicht springen.
 */
export function LadeRahmen({nav = true, werkzeuge = false, buehne, belege, kontext}: LadeRahmenProps) {
  return (
    <VStack gap={0} aria-label="Inhalt wird geladen" aria-busy>
      <VStack className="kopf-band" gap={0}>
        <VStack className="zeit-blatt kopf-blatt" gap={4} paddingInline={5} paddingBlock={5}>
          <HStack justify="between" vAlign="end" gap={4} wrap="wrap">
            <VStack gap={2}>
              {/* Überschrift, die eine Zahl, die Standzeile — die drei Zeilen,
                  die jeder Kopf dieser Anwendung führt. */}
              <Skeleton width={220} height={20} index={0} />
              <Skeleton width={280} height={44} index={1} />
              <Skeleton width={320} height={16} index={2} />
            </VStack>
            {werkzeuge && (
              <VStack gap={3} align="end">
                <Skeleton width={140} height={24} index={2} />
                <Skeleton width={180} height={32} index={3} />
              </VStack>
            )}
          </HStack>
          {nav && (
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Skeleton width={280} height={32} index={3} />
              <StackItem size="fill" />
              <Skeleton width={180} height={28} index={4} />
            </HStack>
          )}
        </VStack>
      </VStack>

      <VStack className="zeit-blatt" gap={5} paddingInline={5} paddingBlock={5}>
        <VStack className={kontext ? 'zeit-inhalt' : 'zeit-inhalt einspaltig'} gap={0}>
          <VStack gap={4}>
            {buehne}
            {belege}
          </VStack>
          {kontext && (
            <VStack gap={4} className="kontext-rail">
              {kontext}
            </VStack>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}

/**
 * Das blanke Blatt ohne Kopfband — für die drei Seiten, die (noch) keinen
 * `ZeitRahmen` tragen: Einstellungen und die beiden Team-Unterseiten. Sie
 * beginnen mit einem Rückverweis und einer Überschrift auf weißem Grund, ohne
 * Goldstreifen darüber, und ihr Gerüst muss dasselbe tun — sonst blitzt beim
 * Laden ein Kopfband auf, das die Seite danach nicht hat.
 */
export function LadeBlatt({
  zurueck = false,
  figur = false,
  nav = false,
  children,
}: {
  /** Steht oben ein „Zurück zu …"-Verweis? */
  zurueck?: boolean;
  /** Steht unter der Überschrift die eine große Zahl? */
  figur?: boolean;
  /** Steht darunter eine Tagesleiste? */
  nav?: boolean;
  children?: ReactNode;
}) {
  return (
    <VStack className="zeit-blatt" gap={5} padding={5} aria-label="Inhalt wird geladen" aria-busy>
      <VStack gap={2}>
        {zurueck && <Skeleton width={150} height={14} index={0} />}
        <Skeleton width={260} height={32} index={0} />
        {figur && <Skeleton width={200} height={44} index={1} />}
        <Skeleton width={340} height={14} index={1} />
        {nav && <Skeleton width={280} height={32} index={2} />}
      </VStack>
      {children}
    </VStack>
  );
}

/**
 * Bahnen auf einer gemeinsamen Achse: Tagesspalte links, Strecke in der Mitte,
 * Summe rechts. Die Maße sind die des Bahnenstapels, damit der Inhalt an
 * dieselbe Stelle fällt.
 */
export function BahnenGeruest({anzahl = 5}: {anzahl?: number}) {
  return (
    <VStack gap={2}>
      {Array.from({length: anzahl}, (_, i) => (
        <HStack key={i} gap={3} vAlign="center" paddingBlock={2}>
          <Skeleton width={76} height={16} index={i} />
          <StackItem size="fill">
            <Skeleton width="100%" height={26} index={i} />
          </StackItem>
          <Skeleton width={72} height={16} index={i} />
        </HStack>
      ))}
    </VStack>
  );
}

/**
 * Das Monatsgitter: volle Mo–So-Wochen mit ihrer KW-Spalte. `--gitter-zellhoehe`
 * ist derselbe Wert, den `monatsgitter.tsx` setzt (62px), also steht der
 * Kalender nach dem Laden Zeile für Zeile dort, wo das Gerüst stand.
 */
export function GitterGeruest({wochen = 5, zellhoehe = 62}: {wochen?: number; zellhoehe?: number}) {
  return (
    <VStack gap={2}>
      <HStack gap={1}>
        <Skeleton width={34} height={14} index={0} />
        {Array.from({length: 7}, (_, t) => (
          <StackItem key={t} size="fill">
            <Skeleton width="100%" height={14} index={t} />
          </StackItem>
        ))}
      </HStack>
      {Array.from({length: wochen}, (_, w) => (
        <HStack key={w} gap={1}>
          <Skeleton width={34} height={zellhoehe} index={w} />
          {Array.from({length: 7}, (_, t) => (
            <StackItem key={t} size="fill">
              <Skeleton width="100%" height={zellhoehe} index={w + t} />
            </StackItem>
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

/**
 * Die Personentafel: eine Zeile je Person, Zahlen in Spalten. Die Kopfzeile
 * steht mit, weil sie in der fertigen Tafel auch steht — ohne sie rutschte der
 * ganze Block beim Eintreffen um eine Zeilenhöhe nach unten.
 */
export function TafelGeruest({zeilen = 6, spalten = 4}: {zeilen?: number; spalten?: number}) {
  return (
    <Card padding={0}>
      <VStack gap={0}>
        <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={3}>
          <StackItem size="fill">
            <Skeleton width={120} height={14} index={0} />
          </StackItem>
          {Array.from({length: spalten}, (_, s) => (
            <Skeleton key={s} width={72} height={14} index={s} />
          ))}
        </HStack>
        {Array.from({length: zeilen}, (_, z) => (
          <HStack key={z} gap={4} vAlign="center" paddingInline={4} paddingBlock={3}>
            <StackItem size="fill">
              <VStack gap={1}>
                <Skeleton width={160} height={16} index={z} />
                <Skeleton width={110} height={12} index={z} />
              </VStack>
            </StackItem>
            {Array.from({length: spalten}, (_, s) => (
              <Skeleton key={s} width={72} height={16} index={z + s} />
            ))}
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

/**
 * Ein Stapel aufklappbarer Zeilen: Protokoll, Prüf-Warteschlangen, Reisen.
 * Zugeklappt ist jede Zeile gleich hoch — genau deshalb ist sie als Gerüst
 * ehrlich, während eine Vorschau des aufgeklappten Zustands lügen würde.
 */
export function ZeilenGeruest({zeilen = 6}: {zeilen?: number}) {
  return (
    <VStack gap={2}>
      {Array.from({length: zeilen}, (_, z) => (
        <Card key={z} padding={0}>
          <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={3}>
            <Skeleton width={28} height={28} radius="rounded" index={z} />
            <StackItem size="fill">
              <VStack gap={1}>
                <Skeleton width="42%" height={16} index={z} />
                <Skeleton width="26%" height={12} index={z} />
              </VStack>
            </StackItem>
            <Skeleton width={84} height={20} index={z} />
            <Skeleton width={20} height={20} index={z} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

/**
 * Ein Formular: Karten mit Feldern. Für die beiden Seiten, die keinen Zeitraum
 * haben und nichts zeichnen — Einstellungen und Profil.
 */
export function FormularGeruest({gruppen = 3, felder = 3}: {gruppen?: number; felder?: number}) {
  return (
    <VStack gap={4}>
      {Array.from({length: gruppen}, (_, g) => (
        <Card key={g}>
          <VStack gap={4}>
            <Skeleton width={200} height={18} index={g} />
            {Array.from({length: felder}, (_, f) => (
              <VStack key={f} gap={1.5}>
                <Skeleton width={140} height={12} index={g + f} />
                <Skeleton width="100%" height={40} index={g + f} />
              </VStack>
            ))}
          </VStack>
        </Card>
      ))}
      <HStack>
        <Skeleton width={160} height={40} index={gruppen} />
      </HStack>
    </VStack>
  );
}

/**
 * Die Kontextspalte: der nächstweitere Zeitraum und das Zeitkonto, beide als
 * Karte. Zwei Blöcke, weil dort immer zwei stehen.
 */
export function KontextGeruest({karten = [132, 96]}: {karten?: number[]}) {
  return (
    <>
      {karten.map((h, i) => (
        <Skeleton key={i} width="100%" height={h} index={i} />
      ))}
    </>
  );
}
