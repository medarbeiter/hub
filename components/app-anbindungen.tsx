'use client';

import {
  Badge,
  Banner,
  Button,
  Card,
  DialogHeader,
  Divider,
  HStack,
  Item,
  Text,
  TextArea,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {
  appAendernAction,
  appAktivAction,
  appAnlegenAction,
  appSecretErneuernAction,
  type ActionState,
  type AppAnbindungState,
} from '@/app/actions';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

/** Was der Server der Seite gibt — nie der Geheimnis-Hash. */
export interface AppZeile {
  id: number;
  client_id: string;
  name: string;
  redirect_uris: string[];
  aktiv: 0 | 1;
  created_at: string;
}

const ANLEGEN_INITIAL: AppAnbindungState = {error: null, secret: null};
const AENDERN_INITIAL: ActionState = {error: null};

/** Das einmal angezeigte Geheimnis, mit der App benannt, zu der es gehört. */
interface EinmalGeheimnis {
  name: string;
  clientId: string;
  secret: string;
}

function AppForm({zeile, onDone}: {zeile: AppZeile | null; onDone: (geheimnis: EinmalGeheimnis | null) => void}) {
  const [name, setName] = useState(zeile?.name ?? '');
  const [uris, setUris] = useState(zeile?.redirect_uris.join('\n') ?? '');
  const [anlegenState, anlegenAction, anlegenPending] = useActionState(appAnlegenAction, ANLEGEN_INITIAL);
  const [aendernState, aendernAction, aendernPending] = useActionState(appAendernAction, AENDERN_INITIAL);
  const state = zeile ? aendernState : anlegenState;
  const isPending = anlegenPending || aendernPending;

  const lastAnlegen = useRef(anlegenState);
  useEffect(() => {
    if (anlegenState !== lastAnlegen.current) {
      lastAnlegen.current = anlegenState;
      if (anlegenState.error === null && anlegenState.secret !== null) {
        onDone({name: name.trim(), clientId: '', secret: anlegenState.secret});
      }
    }
  }, [anlegenState, name, onDone]);
  const lastAendern = useRef(aendernState);
  useEffect(() => {
    if (aendernState !== lastAendern.current) {
      lastAendern.current = aendernState;
      if (aendernState.error === null) onDone(null);
    }
  }, [aendernState, onDone]);

  return (
    <form action={zeile ? aendernAction : anlegenAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        {zeile && <input type="hidden" name="appId" value={zeile.id} />}
        <TextInput
          label="Name der App"
          value={name}
          onChange={setName}
          htmlName="name"
          placeholder="z. B. Dienstplan"
          description="So heißt die Anbindung im Protokoll und in dieser Liste."
          width="100%"
        />
        <TextArea
          label="Weiterleitungs-URIs"
          value={uris}
          onChange={setUris}
          htmlName="redirectUris"
          placeholder={'https://dienstplan.firma.de/anmeldung/rueckkehr'}
          description="Eine je Zeile. Zurückgeleitet wird nur auf exakt diese Adressen – https, unverschlüsselt nur auf localhost."
          width="100%"
        />
        <HStack gap={2} justify="end">
          <Button
            label={zeile ? 'Speichern' : 'App anbinden'}
            variant="primary"
            type="submit"
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

/** Der Banner samt Kartendarstellung des einmalig gezeigten Geheimnisses — wie das Startpasswort. */
function GeheimnisDialog({geheimnis, onClose}: {geheimnis: EinmalGeheimnis | null; onClose: () => void}) {
  return (
    <TafelDialog
      isOpen={geheimnis !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="required"
      width={480}
    >
      <DialogHeader title="App-Geheimnis" subtitle={geheimnis?.name ?? ''} />
      <VStack gap={4} padding={4}>
        <Banner
          status="info"
          title="Dieses Geheimnis wird nur einmal angezeigt."
          description="Hinterlege es jetzt in der Konfiguration der App. Danach ist es nur noch als Prüfsumme gespeichert und kann lediglich erneuert werden."
        />
        {geheimnis?.clientId ? (
          <VStack gap={1}>
            <Text type="supporting" color="secondary" as="p">
              Client-ID
            </Text>
            <Card padding={4} variant="muted">
              <Text type="code" hasTabularNumbers justify="center" as="p">
                {geheimnis.clientId}
              </Text>
            </Card>
          </VStack>
        ) : null}
        <VStack gap={1}>
          <Text type="supporting" color="secondary" as="p">
            Client-Geheimnis
          </Text>
          <Card padding={4} variant="muted">
            <Text type="code" hasTabularNumbers justify="center" as="p">
              {geheimnis?.secret ?? ''}
            </Text>
          </Card>
        </VStack>
        <HStack justify="end">
          <Button label="Verstanden" variant="primary" onClick={onClose} />
        </HStack>
      </VStack>
    </TafelDialog>
  );
}

export function AppAnlegen() {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [geheimnis, setGeheimnis] = useState<EinmalGeheimnis | null>(null);
  return (
    <>
      <Button
        label="App anbinden"
        variant="primary"
        icon={<Sinnbild sinn="hinzufuegen" />}
        onClick={() => setOffen(true)}
      />
      <TafelDialog isOpen={offen} onOpenChange={setOffen} purpose="form" width={480}>
        <DialogHeader
          title="App anbinden"
          subtitle="Client-ID und Geheimnis entstehen beim Anlegen – das Geheimnis wird einmalig angezeigt."
        />
        {offen && (
          <AppForm
            zeile={null}
            onDone={(neu) => {
              setOffen(false);
              if (neu) setGeheimnis(neu);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>
      <GeheimnisDialog geheimnis={geheimnis} onClose={() => setGeheimnis(null)} />
    </>
  );
}

/**
 * Eine Zeile je Anbindung, die Pflege dahinter. Die Weiterleitungs-URIs
 * klappen in der Zeile auf statt in ein eigenes Blatt zu springen; das
 * Geheimnis taucht nirgends auf — es gibt nur „Erneuern", mit Rückfrage,
 * weil das alte damit sofort ungültig wird.
 */
export function AppAnbindungenTafel({zeilen}: {zeilen: AppZeile[]}) {
  const router = useRouter();
  const melde = useMelde();
  const [, startTransition] = useTransition();
  const [offenId, setOffenId] = useState<number | null>(null);
  const [bearbeiten, setBearbeiten] = useState<AppZeile | null>(null);
  const [erneuern, setErneuern] = useState<AppZeile | null>(null);
  const [geheimnis, setGeheimnis] = useState<EinmalGeheimnis | null>(null);

  const schalte = (zeile: AppZeile) =>
    startTransition(async () => {
      const result = await appAktivAction(zeile.id, zeile.aktiv !== 1);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      router.refresh();
    });

  const geheimnisErneuern = (zeile: AppZeile) =>
    startTransition(async () => {
      const result = await appSecretErneuernAction(zeile.id);
      setErneuern(null);
      if (result.error) {
        melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      } else if (result.secret) {
        setGeheimnis({name: zeile.name, clientId: zeile.client_id, secret: result.secret});
      }
      router.refresh();
    });

  if (zeilen.length === 0) {
    return (
      <HStack paddingBlock={4} paddingInline={1} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="verbundeneApps" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          Noch keine App angebunden. „App anbinden" erzeugt Client-ID und Geheimnis für die erste.
        </Text>
      </HStack>
    );
  }

  return (
    <VStack gap={0} role="list">
      {zeilen.map((zeile) => (
        <VStack key={zeile.id} gap={0} role="listitem">
          <Item
            label={zeile.name}
            description={zeile.client_id}
            density="spacious"
            startContent={<Sinnbild sinn="verbundeneApps" ton={zeile.aktiv === 1 ? 'erben' : 'sekundaer'} />}
            endContent={
              <HStack gap={3} vAlign="center" wrap="nowrap">
                {zeile.aktiv === 1 ? (
                  <Badge variant="success" label="Aktiv" />
                ) : (
                  <Badge variant="neutral" label="Gesperrt" icon={<Sinnbild sinn="gesperrt" groesse="zeile" />} />
                )}
                <HStack gap={1} vAlign="center" wrap="nowrap">
                  <Button
                    label={offenId === zeile.id ? 'Zuklappen' : 'Details'}
                    variant="ghost"
                    size="sm"
                    onClick={() => setOffenId(offenId === zeile.id ? null : zeile.id)}
                  />
                  <Button
                    label="Bearbeiten"
                    tooltip="Name und Weiterleitungs-URIs ändern"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn="bearbeiten" />}
                    onClick={() => setBearbeiten(zeile)}
                  />
                  <Button
                    label="Geheimnis erneuern"
                    tooltip="Neues Geheimnis ausstellen – das alte wird ungültig"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn="erneut" />}
                    onClick={() => setErneuern(zeile)}
                  />
                  <Button
                    label={zeile.aktiv === 1 ? 'Sperren' : 'Freigeben'}
                    tooltip={
                      zeile.aktiv === 1
                        ? 'Anmeldung über diese App sofort unterbinden'
                        : 'Anmeldung über diese App wieder erlauben'
                    }
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn={zeile.aktiv === 1 ? 'gesperrt' : 'entsperrt'} />}
                    onClick={() => schalte(zeile)}
                  />
                </HStack>
              </HStack>
            }
          />
          {offenId === zeile.id && (
            <VStack gap={1} paddingInline={4} paddingBlock={2}>
              <Text type="supporting" color="secondary" as="p">
                Weiterleitungs-URIs
              </Text>
              {zeile.redirect_uris.map((uri) => (
                <Text key={uri} type="code" as="p">
                  {uri}
                </Text>
              ))}
              <Text type="supporting" color="secondary" as="p">
                Angebunden am {zeile.created_at.slice(0, 10)}
              </Text>
            </VStack>
          )}
          <Divider />
        </VStack>
      ))}

      <TafelDialog
        isOpen={bearbeiten !== null}
        onOpenChange={(open) => {
          if (!open) setBearbeiten(null);
        }}
        purpose="form"
        width={480}
      >
        <DialogHeader title="App bearbeiten" subtitle={bearbeiten?.name ?? ''} />
        {bearbeiten && (
          <AppForm
            zeile={bearbeiten}
            onDone={() => {
              setBearbeiten(null);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={erneuern !== null}
        onOpenChange={(open) => {
          if (!open) setErneuern(null);
        }}
        purpose="required"
        width={440}
      >
        <DialogHeader title="Geheimnis erneuern?" subtitle={erneuern?.name ?? ''} />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Das bisherige Geheimnis wird sofort ungültig — die App kann sich erst wieder anmelden, wenn das neue
            dort hinterlegt ist.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setErneuern(null)} />
            <Button
              label="Erneuern"
              variant="primary"
              onClick={() => {
                if (erneuern) geheimnisErneuern(erneuern);
              }}
            />
          </HStack>
        </VStack>
      </TafelDialog>

      <GeheimnisDialog geheimnis={geheimnis} onClose={() => setGeheimnis(null)} />
    </VStack>
  );
}
