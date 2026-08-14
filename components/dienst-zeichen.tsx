/**
 * Markenzeichen für erkannte Dienste — die EINE Stelle, an der `react-icons/si`
 * (Simple Icons) importiert wird. Kein zweites Zeichenvokabular: `sinnbilder.tsx`
 * benennt Bedeutungen der Anwendung, hier stehen fremde Marken, und sie
 * erscheinen ausschließlich neben dem Dienstnamen eines Zugangscodes, den sie
 * schneller auffindbar machen. Immer dekorativ (`aria-hidden`), nie allein.
 *
 * Erkannt wird über Begriffe im Dienstnamen („Google Ads“ → Google), bewusst
 * gespeichert wird nichts. Die Zeichen kommen aus dem Paket statt von
 * cdn.simpleicons.org — selbst gehostet wie die Schriften, und der Browser
 * eines Mitarbeiters verrät keinem CDN, welche Dienste die Firma nutzt.
 * Fehlt eine Marke (Simple Icons entfernt geschützte Zeichen, etwa Microsoft
 * oder Slack), fällt die Zeile auf das Schlüssel-Sinnbild zurück.
 */

import type {IconType} from 'react-icons';
import {
  SiAnthropic,
  SiApple,
  SiAsana,
  SiBitbucket,
  SiClaude,
  SiCloudflare,
  SiConfluence,
  SiDatev,
  SiDeutschebahn,
  SiDeutschepost,
  SiDeutschetelekom,
  SiDhl,
  SiDigitalocean,
  SiDiscord,
  SiDropbox,
  SiEbay,
  SiEtsy,
  SiFacebook,
  SiFigma,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGoogle,
  SiHetzner,
  SiHubspot,
  SiInstagram,
  SiIntercom,
  SiIonos,
  SiJira,
  SiMailchimp,
  SiNetlify,
  SiNextcloud,
  SiNotion,
  SiO2,
  SiOvh,
  SiPaypal,
  SiPinterest,
  SiSap,
  SiShopify,
  SiShopware,
  SiSquarespace,
  SiStripe,
  SiTeamviewer,
  SiTelegram,
  SiTiktok,
  SiTrello,
  SiTwitch,
  SiVercel,
  SiVodafone,
  SiWhatsapp,
  SiWix,
  SiWordpress,
  SiX,
  SiXing,
  SiYoutube,
  SiZendesk,
  SiZoom,
} from 'react-icons/si';
import {Sinnbild} from './sinnbilder';

/**
 * Reihenfolge trägt Bedeutung: das erste Paar, dessen Begriff im Namen steckt,
 * gewinnt — „Gmail“ muss deshalb vor „Google“ stehen, „Deutsche Post“ vor
 * allem Kürzeren. Begriffe sind bewusst lang genug, dass sie nicht zufällig
 * in anderen Wörtern stecken („x“ allein wäre keiner; „Twitter“ zeigt X).
 */
const MARKEN: ReadonlyArray<readonly [string, IconType]> = [
  ['gmail', SiGmail],
  ['youtube', SiYoutube],
  ['google', SiGoogle],
  ['github', SiGithub],
  ['gitlab', SiGitlab],
  ['bitbucket', SiBitbucket],
  ['notion', SiNotion],
  ['figma', SiFigma],
  ['dropbox', SiDropbox],
  ['trello', SiTrello],
  ['asana', SiAsana],
  ['jira', SiJira],
  ['confluence', SiConfluence],
  ['zoom', SiZoom],
  ['paypal', SiPaypal],
  ['stripe', SiStripe],
  ['shopware', SiShopware],
  ['shopify', SiShopify],
  ['wordpress', SiWordpress],
  ['mailchimp', SiMailchimp],
  ['hubspot', SiHubspot],
  ['datev', SiDatev],
  ['sap', SiSap],
  ['facebook', SiFacebook],
  ['instagram', SiInstagram],
  ['twitter', SiX],
  ['xing', SiXing],
  ['tiktok', SiTiktok],
  ['pinterest', SiPinterest],
  ['discord', SiDiscord],
  ['twitch', SiTwitch],
  ['ebay', SiEbay],
  ['etsy', SiEtsy],
  ['apple', SiApple],
  ['icloud', SiApple],
  ['cloudflare', SiCloudflare],
  ['hetzner', SiHetzner],
  ['ionos', SiIonos],
  ['ovh', SiOvh],
  ['digitalocean', SiDigitalocean],
  ['netlify', SiNetlify],
  ['vercel', SiVercel],
  ['anthropic', SiAnthropic],
  ['claude', SiClaude],
  ['telegram', SiTelegram],
  ['whatsapp', SiWhatsapp],
  ['dhl', SiDhl],
  ['deutsche bahn', SiDeutschebahn],
  ['deutsche post', SiDeutschepost],
  ['telekom', SiDeutschetelekom],
  ['vodafone', SiVodafone],
  ['o2', SiO2],
  ['wix', SiWix],
  ['squarespace', SiSquarespace],
  ['zendesk', SiZendesk],
  ['intercom', SiIntercom],
  ['teamviewer', SiTeamviewer],
  ['nextcloud', SiNextcloud],
];

export function markeFuer(dienst: string): IconType | null {
  const name = dienst.toLowerCase();
  return MARKEN.find(([begriff]) => name.includes(begriff))?.[1] ?? null;
}

/**
 * Das Zeichen eines Dienstes: die erkannte Marke, sonst das Schlüssel-Sinnbild.
 * Dieselben Größen und Töne wie im Sinnbild-Vokabular, damit eine Zeile mit
 * Marke und eine ohne gleich schwer wiegen.
 */
export function DienstZeichen({dienst, groesse = 'gross'}: {dienst: string; groesse?: 'zeile' | 'normal' | 'gross'}) {
  const Marke = markeFuer(dienst);
  if (!Marke) return <Sinnbild sinn="zugangscode" groesse={groesse} ton="sekundaer" />;
  const px = groesse === 'zeile' ? 14 : groesse === 'normal' ? 16 : 20;
  return (
    <Marke
      size={px}
      color="var(--color-icon-secondary)"
      aria-hidden
      focusable={false}
      style={{flexShrink: 0}}
    />
  );
}
