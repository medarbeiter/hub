import {Badge, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {personAngabe} from '@/lib/avatar';
import {eigeneRechte, gesamtVokabular} from '@/lib/eigene-rechte';
import {hatRecht} from '@/lib/rechte';
import {alleRollen, kontenMitRolle, wirksameRechte} from '@/lib/rollen';
import {allUsers} from '@/lib/users';
import {RechteVerwaltung} from '@/components/rechte-verwaltung';
import {RollenVerwaltung} from '@/components/rollen-verwaltung';
import {UserManager} from '@/components/user-manager';
import {Sinnbild} from '@/components/sinnbilder';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

export default async function MitarbeiterPage() {
  const actor = await requireRecht('mitarbeiter.verwalten');
  const users = allUsers();
  const rollen = alleRollen();
  const vokabular = gesamtVokabular();
  const aktive = users.filter((u) => u.active === 1);
  const stillgelegt = users.length - aktive.length;
  const verwalter = aktive.filter(
    (u) => wirksameRechte(u.role, u.extra_rechte).includes('mitarbeiter.verwalten'),
  ).length;

  return (
    <ZeitRahmen
      titel="Mitarbeiter"
      sinn="mitarbeiter"
      figur={String(aktive.length)}
      figurEinheit="aktive Konten"
      stand={`${verwalter} davon mit Benutzerverwaltung · Startpasswörter werden einmalig angezeigt`}
      figurMeta={
        stillgelegt > 0 ? (
          <Badge
            variant="neutral"
            label={stillgelegt === 1 ? '1 stillgelegt' : `${stillgelegt} stillgelegt`}
            icon={<Sinnbild sinn="deaktivieren" groesse="zeile" />}
          />
        ) : null
      }
      belege={
        <VStack gap={6}>
          <UserManager
            darfVollzugriff={hatRecht(actor, '*')}
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              person: personAngabe(u),
              email: u.email,
              role: u.role,
              weekly_minutes: u.weekly_minutes,
              active: u.active,
              bundesland: u.bundesland ?? null,
              urlaubstage_jahr: u.urlaubstage_jahr,
              extra_rechte: u.extra_rechte,
            }))}
            selfId={actor.id}
            rollen={rollen}
            vokabular={vokabular}
          />
          {hatRecht(actor, 'rollen.verwalten') && (
            <RollenVerwaltung
              rollen={rollen.map((r) => ({...r, konten: kontenMitRolle(r.schluessel)}))}
              vokabular={vokabular}
              eigeneRechte={actor.rechte ?? []}
            />
          )}
          {hatRecht(actor, 'rechte.verwalten') && <RechteVerwaltung rechte={eigeneRechte()} />}
        </VStack>
      }
    />
  );
}
