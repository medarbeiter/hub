'use client';

/**
 * Die Rollenverwaltung — der Abschnitt unter der Kontenliste auf /mitarbeiter.
 *
 * Sichtbar nur mit dem Recht `rollen.verwalten`. Zwei Regeln aus lib/rollen.ts
 * spiegeln sich hier in der Oberfläche: verhandelbar sind nur Rechte, die die
 * bearbeitende Person selbst trägt (alles andere steht als fester Hinweis
 * unter der Liste), und eine Rolle in Gebrauch bietet ihr Löschen gar nicht
 * erst an. Der Server prüft beides ein zweites Mal — ein Browser ist keine
 * Grenze.
 */
import {
  Badge,
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  DialogHeader,
  HStack,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {rolleLoeschenAction, rolleSpeichernAction, type ActionState} from '@/app/actions';
import {sicher, sicheresFormular} from '@/lib/aktion';
import {ALLE_RECHTE, RECHTE, STUFEN, STUFEN_REIHENFOLGE, hatRecht, istRecht, type Recht, type RollenEintrag} from '@/lib/rechte';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

export interface VerwalteteRolle extends RollenEintrag {
  /** Wie viele Konten (auch stillgelegte) die Rolle tragen — 0 macht sie löschbar. */
  konten: number;
}

interface RollenVerwaltungProps {
  rollen: VerwalteteRolle[];
  /** Die wirksamen Rechte der angemeldeten Person — nur die sind hier verhandelbar. */
  eigeneRechte: Recht[];
}

const INITIAL: ActionState = {error: null};

function RollenForm({
  rolle,
  eigeneRechte,
  onDone,
}: {
  rolle: VerwalteteRolle | null;
  eigeneRechte: Recht[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState(rolle?.label ?? '');
  // Fremde Rechte stehen nicht zur Wahl — der Server ließe sie ohnehin
  // unangetastet, aber ein Haken, der beim Speichern nichts täte, wäre gelogen.
  const waehlbar = ALLE_RECHTE.filter((recht) => eigeneRechte.includes(recht));
  const fest = (rolle?.rechte ?? []).filter((recht) => !eigeneRechte.includes(recht));
  const [rechte, setRechte] = useState<Recht[]>(
    (rolle?.rechte ?? []).filter((recht) => eigeneRechte.includes(recht)),
  );
  const [state, formAction, isPending] = useActionState(sicheresFormular(rolleSpeichernAction), INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <TextInput
          label="Name"
          value={label}
          onChange={setLabel}
          htmlName="label"
          placeholder="z. B. Buchhaltung"
          description={
            rolle
              ? 'Der Name lässt sich frei ändern; der Verweis der Konten auf die Rolle bleibt bestehen.'
              : 'Aus dem Namen entsteht der feste Schlüssel der Rolle.'
          }
        />
        {STUFEN_REIHENFOLGE.map((stufe) => {
          const gruppe = waehlbar.filter((recht) => RECHTE[recht].stufe === stufe);
          if (gruppe.length === 0) return null;
          return (
            <CheckboxList
              key={stufe}
              label={STUFEN[stufe].label}
              description={STUFEN[stufe].beschreibung}
              value={rechte.filter((recht) => RECHTE[recht].stufe === stufe)}
              onChange={(values) =>
                setRechte((alt) => [
                  ...alt.filter((recht) => RECHTE[recht].stufe !== stufe),
                  ...values.filter(istRecht),
                ])
              }
              density="compact"
              hasDividers
            >
              {gruppe.map((recht) => (
                <CheckboxListItem
                  key={recht}
                  value={recht}
                  label={RECHTE[recht].label}
                  description={RECHTE[recht].beschreibung}
                />
              ))}
            </CheckboxList>
          );
        })}
        {fest.length > 0 && (
          <Banner
            status="info"
            title="Rechte, die du selbst nicht trägst, bleiben unverändert."
            description={fest.map((recht) => RECHTE[recht].label).join(', ')}
          />
        )}
        {rolle && <input type="hidden" name="schluessel" value={rolle.schluessel} />}
        {rechte.map((recht) => (
          <input key={recht} type="hidden" name="rechte" value={recht} />
        ))}
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
          <Button
            label={rolle ? 'Speichern' : 'Rolle anlegen'}
            variant="primary"
            type="submit"
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

export function RollenVerwaltung({rollen, eigeneRechte}: RollenVerwaltungProps) {
  const [editing, setEditing] = useState<VerwalteteRolle | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VerwalteteRolle | null>(null);
  const [isPending, startTransition] = useTransition();
  const melde = useMelde();
  const router = useRouter();

  const loeschen = (rolle: VerwalteteRolle) =>
    startTransition(async () => {
      const result = await sicher(rolleLoeschenAction)(rolle.schluessel);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      setConfirmDelete(null);
      router.refresh();
    });

  return (
    <VStack gap={2}>
      <Text type="label" color="secondary">
        Rollen
      </Text>
      <Text type="supporting" size="sm" color="secondary" as="p">
        Jede Rolle ist ein Rechtebündel. Eine Änderung wirkt sofort auf alle Konten, die die Rolle
        tragen; eine Rolle in Gebrauch lässt sich nicht löschen.
      </Text>
      <VStack gap={0}>
        {rollen.map((rolle) => (
          <HStack key={rolle.schluessel} gap={2} vAlign="center" justify="between" paddingBlock={2} wrap="wrap">
            <VStack gap={0}>
              <Text weight="medium">{rolle.label}</Text>
              <Text type="supporting" size="sm" color="secondary">
                {rolle.rechte.includes('*')
                  ? 'Alle Rechte'
                  : rolle.rechte.length === 1 ? '1 Recht' : `${rolle.rechte.length} Rechte`}
                {' · '}
                {rolle.konten === 1 ? '1 Konto' : `${rolle.konten} Konten`}
              </Text>
            </VStack>
            <HStack gap={1} justify="end" vAlign="center" wrap="nowrap">
              {hatRecht({role: rolle.schluessel, rechte: rolle.rechte}, 'mitarbeiter.verwalten') && (
                <Badge
                  variant="info"
                  label="Benutzerverwaltung"
                  icon={<Sinnbild sinn="rolleVerwaltung" groesse="zeile" />}
                />
              )}
              <Button
                label="Bearbeiten"
                variant="ghost"
                size="sm"
                icon={<Sinnbild sinn="bearbeiten" />}
                onClick={() => {
                  setEditing(rolle);
                  setFormOpen(true);
                }}
              />
              <Button
                label="Löschen"
                variant="ghost"
                size="sm"
                icon={<Sinnbild sinn="entfernen" />}
                isDisabled={rolle.konten > 0 || rollen.length <= 1}
                tooltip={
                  rolle.konten > 0
                    ? 'Diese Rolle ist Konten zugewiesen. Zuerst dort eine andere Rolle wählen.'
                    : rollen.length <= 1
                      ? 'Die letzte Rolle kann nicht gelöscht werden.'
                      : undefined
                }
                onClick={() => setConfirmDelete(rolle)}
              />
            </HStack>
          </HStack>
        ))}
      </VStack>
      <span>
        <Button
          label="Rolle anlegen"
          variant="secondary"
          icon={<Sinnbild sinn="hinzufuegen" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </span>

      <TafelDialog isOpen={isFormOpen} onOpenChange={setFormOpen} purpose="form" width={440}>
        <DialogHeader
          title={editing ? 'Rolle bearbeiten' : 'Rolle anlegen'}
          subtitle={
            editing
              ? editing.konten === 1
                ? `${editing.label} · gilt für 1 Konto`
                : `${editing.label} · gilt für ${editing.konten} Konten`
              : 'Ein neues Rechtebündel — Konten erhalten es in der Mitarbeiterverwaltung.'
          }
        />
        {isFormOpen && (
          <RollenForm
            rolle={editing}
            eigeneRechte={eigeneRechte}
            onDone={() => {
              setFormOpen(false);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader title="Rolle löschen" subtitle={confirmDelete?.label ?? ''} />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Die Rolle wird entfernt. Kein Konto trägt sie mehr; Protokollzeilen behalten den alten
            Namen. Das lässt sich nicht rückgängig machen — eine neue Rolle mit demselben Namen ist
            aber jederzeit möglich.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setConfirmDelete(null)} />
            <Button
              label="Löschen"
              variant="destructive"
              isLoading={isPending}
              icon={<Sinnbild sinn="entfernen" />}
              onClick={() => confirmDelete && loeschen(confirmDelete)}
            />
          </HStack>
        </VStack>
      </TafelDialog>
    </VStack>
  );
}
