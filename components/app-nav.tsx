'use client';

import {SideNav, SideNavHeading, SideNavItem, SideNavSection, Text, VStack} from '@astryxdesign/core';
import {CalendarDays, ChartNoAxesColumn, LockKeyhole, Settings, UserRoundCog, Users} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ComponentProps} from 'react';
import {logoutAction} from '@/app/actions';
import {Button} from '@astryxdesign/core';

interface AppNavProps {
  name: string;
  role: 'mitarbeiter' | 'verwaltung';
}

const NextLink = (props: ComponentProps<'a'>) => <Link {...(props as ComponentProps<typeof Link>)} />;

export function AppNav({name, role}: AppNavProps) {
  const pathname = usePathname();

  return (
    <SideNav
      header={
        <SideNavHeading
          heading="MedArbeiter"
          subheading="Zeiterfassung"
          headingHref="/"
          icon={<Image src="/logo-mark.png" alt="" width={28} height={28} />}
        />
      }
      footer={
        <VStack gap={2} padding={3}>
          <Text type="supporting" color="secondary" maxLines={1}>
            {name}
          </Text>
          <form action={logoutAction}>
            <Button label="Abmelden" variant="ghost" size="sm" type="submit" />
          </form>
        </VStack>
      }
    >
      <SideNavSection title="Meine Zeit" isHeaderHidden>
        <SideNavItem
          label="Meine Zeit"
          href="/"
          as={NextLink}
          icon={CalendarDays}
          isSelected={pathname === '/' || pathname.startsWith('/zeiten')}
        />
      </SideNavSection>
      {role === 'verwaltung' && (
        <SideNavSection title="Verwaltung">
          <SideNavItem label="Team" href="/team" as={NextLink} icon={Users} isSelected={pathname.startsWith('/team')} />
          <SideNavItem
            label="Monatsabschluss"
            href="/abschluss"
            as={NextLink}
            icon={LockKeyhole}
            isSelected={pathname.startsWith('/abschluss')}
          />
          <SideNavItem
            label="Berichte"
            href="/berichte"
            as={NextLink}
            icon={ChartNoAxesColumn}
            isSelected={pathname.startsWith('/berichte')}
          />
          <SideNavItem
            label="Mitarbeiter"
            href="/mitarbeiter"
            as={NextLink}
            icon={UserRoundCog}
            isSelected={pathname.startsWith('/mitarbeiter')}
          />
          <SideNavItem
            label="Einstellungen"
            href="/einstellungen"
            as={NextLink}
            icon={Settings}
            isSelected={pathname.startsWith('/einstellungen')}
          />
        </SideNavSection>
      )}
    </SideNav>
  );
}
