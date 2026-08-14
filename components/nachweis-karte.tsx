import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {fmtMonth} from '@/lib/format';
import {Sinnbild} from './sinnbilder';

/**
 * Der Weg zum Arbeitszeitnachweis — für die Verwaltung auf dem Blatt einer
 * Person, für Mitarbeitende auf dem eigenen Zeitkonto.
 *
 * Vorher stand diese Karte nur unter `/team/[userId]`, und `/druck` verlangte
 * die Verwaltungsrolle: Mitarbeitende hatten keinen Weg zum Nachweis ihrer
 * eigenen Zeiten. Jetzt teilen sich beide Seiten dieselbe Karte — damit der
 * Nachweis überall gleich heißt und gleich aussieht.
 */
export function NachweisKarte({
  userId,
  month,
  name,
}: {
  userId: number;
  month: string;
  /** Nur gesetzt, wenn die Karte über eine andere Person spricht. */
  name?: string;
}) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="drucken" groesse="gross" ton="sekundaer" />
          <Heading level={3}>Arbeitszeitnachweis</Heading>
        </HStack>
        <Text type="supporting" color="secondary">
          {name ? `Druckansicht für ${name}` : 'Druckansicht'} – über den Druckdialog als PDF
          speichern.
        </Text>
        <Link
          href={`/druck/${month}?mitarbeiter=${userId}`}
          target="_blank"
          style={{color: 'var(--color-text-accent)', textDecoration: 'none'}}
        >
          <HStack gap={1} vAlign="center">
            <Text type="label" color="inherit">
              Monat {fmtMonth(month)} drucken
            </Text>
            <Sinnbild sinn="hin" groesse="zeile" />
          </HStack>
        </Link>
      </VStack>
    </Card>
  );
}
