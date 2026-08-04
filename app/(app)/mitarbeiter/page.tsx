import {Heading, Text, VStack} from '@astryxdesign/core';
import {requireVerwaltung} from '@/lib/auth';
import {allUsers} from '@/lib/users';
import {UserManager} from '@/components/user-manager';

export const dynamic = 'force-dynamic';

export default async function MitarbeiterPage() {
  const actor = await requireVerwaltung();
  const users = allUsers();

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={0.5}>
        <Heading level={1}>Mitarbeiter</Heading>
        <Text type="supporting" color="secondary">
          {users.filter((u) => u.active === 1).length} aktive Konten · Startpasswörter werden einmalig angezeigt
        </Text>
      </VStack>
      <UserManager
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          weekly_minutes: u.weekly_minutes,
          active: u.active,
        }))}
        selfId={actor.id}
      />
    </VStack>
  );
}
