'use client';

import {SideNav, SideNavHeading, SideNavItem, SideNavSection, Text, VStack} from '@astryxdesign/core';
import {CalendarDays, ChartNoAxesColumn, LockKeyhole, Sun, UserRoundCog, Users} from 'lucide-react';
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
      <SideNavSection title="Meine Zeit" isHeaderHidden={role !== 'verwaltung'}>
        <SideNavItem label="Heute" href="/" as={NextLink} icon={Sun} isSelected={pathname === '/'} />
        <SideNavItem
          label="Meine Zeiten"
          href="/zeiten"
          as={NextLink}
          icon={CalendarDays}
          isSelected={pathname.startsWith('/zeiten')}
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
        </SideNavSection>
      )}
    </SideNav>
  );
}
