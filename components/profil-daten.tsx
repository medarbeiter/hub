import {Text} from '@astryxdesign/core';
import {fmtDuration} from '@/lib/format';
import type {OnboardingProfil} from '@/lib/onboarding';

export function ProfilDaten({
  profil,
  variante = 'standard',
}: {
  profil: OnboardingProfil;
  variante?: 'standard' | 'pruefung';
}) {
  const land = profil.bundesland
    ? `${profil.bundesland}${profil.bundeslandQuelle === 'Unternehmen' ? ' · Firmenstandard' : ''}`
    : 'Nicht hinterlegt';

  return (
    <dl className="profil-daten" data-variante={variante}>
      <dt><Text type="supporting" color="secondary">Name</Text></dt>
      <dd><Text weight="medium">{profil.name}</Text></dd>
      <dt><Text type="supporting" color="secondary">E-Mail</Text></dt>
      <dd><Text weight="medium">{profil.email}</Text></dd>
      <dt><Text type="supporting" color="secondary">Rolle</Text></dt>
      <dd><Text weight="medium">{profil.rolle}</Text></dd>
      <dt><Text type="supporting" color="secondary">Sollzeit</Text></dt>
      <dd><Text weight="medium" hasTabularNumbers>{fmtDuration(profil.wochenMinuten)} Std. pro Woche</Text></dd>
      <dt><Text type="supporting" color="secondary">Urlaubsanspruch</Text></dt>
      <dd><Text weight="medium" hasTabularNumbers>{profil.urlaubstageJahr} Tage pro Jahr</Text></dd>
      <dt><Text type="supporting" color="secondary">Feiertagskalender</Text></dt>
      <dd><Text weight="medium">{land}</Text></dd>
    </dl>
  );
}
