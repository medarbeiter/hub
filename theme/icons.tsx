/**
 * @file icons.tsx
 * @input Uses react-icons/ti (Typicons), IconRegistry type
 * @output Exports neutralIconRegistry for the MedArbeiter theme
 * @position Icon configuration for the theme; consumed by medarbeiterTheme.ts
 *
 * Die eingebauten Zeichen von Astryx — die Häkchen in Checkboxen, die Chevrons
 * in Selector und Dialog, die Statuszeichen in Banner und Feldern. Sie kommen
 * aus derselben Familie wie das Vokabular in `components/sinnbilder.tsx`
 * (Typicons), damit nicht zwei Zeichensprachen nebeneinander laufen: ein Chevron
 * im Selector und ein Chevron in der Bereichsleiste müssen identisch aussehen.
 *
 * `size: '1em'` lässt Astryx die Größe über die Schriftgröße steuern. Eine
 * Strichstärke gibt es bei Typicons nicht — die Zeichen sind flächig und tragen
 * ihre Masse in jeder Größe (siehe Kopf von sinnbilder.tsx).
 *
 * Drei Lücken des Satzes, hier bewusst besetzt statt offen gelassen:
 *   moreHorizontal – Typicons hat keine drei Punkte; das Menüraster steht dafür,
 *                    in der Konturfassung, damit es sich von `menu` unterscheidet.
 *   eyeSlash       – kein durchgestrichenes Auge; die Konturfassung ist das
 *                    schwächere „nicht sichtbar".
 *   copy           – kein Doppelblatt; das Klemmbrett trägt dieselbe Handlung.
 */

import type {IconRegistry} from '@astryxdesign/core/Icon';

import {
  TiArrowDown,
  TiArrowSortedDown,
  TiArrowUnsorted,
  TiArrowUp,
  TiCalendar,
  TiChevronLeft,
  TiChevronRight,
  TiClipboard,
  TiExport,
  TiEyeOutline,
  TiFilter,
  TiInfoLarge,
  TiInputChecked,
  TiMediaStop,
  TiMicrophone,
  TiSpanner,
  TiThLarge,
  TiThMenu,
  TiThMenuOutline,
  TiTick,
  TiTickOutline,
  TiTime,
  TiTimes,
  TiWarning,
  TiZoom,
} from 'react-icons/ti';

const iconProps = {
  size: '1em',
  'aria-hidden': true as const,
  focusable: false as const,
};

export const neutralIconRegistry: IconRegistry = {
  close: <TiTimes {...iconProps} />,
  chevronDown: <TiArrowSortedDown {...iconProps} />,
  chevronLeft: <TiChevronLeft {...iconProps} />,
  chevronRight: <TiChevronRight {...iconProps} />,
  check: <TiTick {...iconProps} />,
  success: <TiTickOutline {...iconProps} />,
  error: <TiTimes {...iconProps} />,
  warning: <TiWarning {...iconProps} />,
  info: <TiInfoLarge {...iconProps} />,
  calendar: <TiCalendar {...iconProps} />,
  clock: <TiTime {...iconProps} />,
  externalLink: <TiExport {...iconProps} />,
  menu: <TiThMenu {...iconProps} />,
  moreHorizontal: <TiThMenuOutline {...iconProps} />,
  search: <TiZoom {...iconProps} />,
  arrowUp: <TiArrowUp {...iconProps} />,
  arrowDown: <TiArrowDown {...iconProps} />,
  arrowsUpDown: <TiArrowUnsorted {...iconProps} />,
  funnel: <TiFilter {...iconProps} />,
  eyeSlash: <TiEyeOutline {...iconProps} />,
  viewColumns: <TiThLarge {...iconProps} />,
  copy: <TiClipboard {...iconProps} />,
  checkDouble: <TiInputChecked {...iconProps} />,
  wrench: <TiSpanner {...iconProps} />,
  stop: <TiMediaStop {...iconProps} />,
  microphone: <TiMicrophone {...iconProps} />,
};
