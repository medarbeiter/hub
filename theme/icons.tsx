/**
 * @file icons.tsx
 * @input Uses @phosphor-icons/react (SSR entry), IconRegistry type
 * @output Exports neutralIconRegistry for the MedArbeiter theme
 * @position Icon configuration for the theme; consumed by medarbeiterTheme.ts
 *
 * Die eingebauten Zeichen von Astryx — die Häkchen in Checkboxen, die Chevrons
 * in Selector und Dialog, die Statuszeichen in Banner und Feldern. Sie kommen
 * aus derselben Familie wie das Vokabular in `components/sinnbilder.tsx`
 * (Phosphor), damit nicht zwei Zeichensprachen nebeneinander laufen: ein Chevron
 * im Selector und ein Chevron in der Bereichsleiste müssen identisch aussehen.
 *
 * `size: '1em'` lässt Astryx die Größe über die Schriftgröße steuern. Das
 * Gewicht ist hier durchgehend `bold` — dieselbe Wahl und dieselbe Begründung
 * wie bei der Form `umriss` im Vokabular (siehe Kopf von sinnbilder.tsx): auch
 * ein Häkchen in einer 14-px-Checkbox muss Masse tragen. Ausgewählt-Zustände
 * gibt es hier keine, deshalb bleibt es bei einem Gewicht.
 *
 * Der SSR-Eingang wie im Vokabular: kein `useContext`, damit das Modul aus
 * Server- wie Client-Komponenten importierbar bleibt.
 *
 * Die drei Lücken, die der vorige Satz (Typicons) hier offen ließ und die
 * ersatzweise besetzt waren, schließt Phosphor mit dem richtigen Zeichen:
 * `moreHorizontal` sind jetzt drei Punkte statt eines Menürasters, `eyeSlash`
 * ein durchgestrichenes Auge statt eines schwächeren, und `copy` das
 * Doppelblatt statt eines Klemmbretts.
 */

import type {IconRegistry} from '@astryxdesign/core/Icon';

import {
  ArrowDownIcon,
  ArrowSquareOutIcon,
  ArrowUpIcon,
  ArrowsDownUpIcon,
  CalendarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ChecksIcon,
  ClockIcon,
  ColumnsIcon,
  CopyIcon,
  DotsThreeIcon,
  EyeSlashIcon,
  FunnelIcon,
  InfoIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  StopIcon,
  WarningIcon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
} from '@phosphor-icons/react/ssr';

const iconProps = {
  size: '1em',
  weight: 'bold' as const,
  'aria-hidden': true as const,
  focusable: false as const,
};

export const neutralIconRegistry: IconRegistry = {
  close: <XIcon {...iconProps} />,
  chevronDown: <CaretDownIcon {...iconProps} />,
  chevronLeft: <CaretLeftIcon {...iconProps} />,
  chevronRight: <CaretRightIcon {...iconProps} />,
  check: <CheckIcon {...iconProps} />,
  /* Die vier Statuszeichen sind eine Familie: Kreis mit Haken, Kreis mit
     Kreuz, Dreieck, Kreis mit i — dieselben Zeichen wie `hinweis`, `warnung`
     und `fehler` im Vokabular. `close` bleibt daneben das nackte Kreuz: es ist
     eine Handlung, kein Zustand. */
  success: <CheckCircleIcon {...iconProps} />,
  error: <XCircleIcon {...iconProps} />,
  warning: <WarningIcon {...iconProps} />,
  info: <InfoIcon {...iconProps} />,
  calendar: <CalendarIcon {...iconProps} />,
  clock: <ClockIcon {...iconProps} />,
  externalLink: <ArrowSquareOutIcon {...iconProps} />,
  menu: <ListIcon {...iconProps} />,
  moreHorizontal: <DotsThreeIcon {...iconProps} />,
  search: <MagnifyingGlassIcon {...iconProps} />,
  arrowUp: <ArrowUpIcon {...iconProps} />,
  arrowDown: <ArrowDownIcon {...iconProps} />,
  arrowsUpDown: <ArrowsDownUpIcon {...iconProps} />,
  funnel: <FunnelIcon {...iconProps} />,
  eyeSlash: <EyeSlashIcon {...iconProps} />,
  viewColumns: <ColumnsIcon {...iconProps} />,
  copy: <CopyIcon {...iconProps} />,
  /* Der Doppelhaken heißt bei Astryx `checkDouble` und ist bei Phosphor
     tatsächlich einer — vorher trug ihn ersatzweise die angehakte Checkbox,
     die im Vokabular `genehmigen` bezeichnet. Die beiden sind damit nicht
     länger dasselbe Bild für zwei Dinge. */
  checkDouble: <ChecksIcon {...iconProps} />,
  wrench: <WrenchIcon {...iconProps} />,
  stop: <StopIcon {...iconProps} />,
  microphone: <MicrophoneIcon {...iconProps} />,
};
