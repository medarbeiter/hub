'use client';

import {Button} from '@astryxdesign/core';
import type {ComponentProps} from 'react';
import {useFormStatus} from 'react-dom';

/**
 * Ein Absendeknopf, der von selbst weiß, dass er gerade absendet.
 *
 * Überall sonst in dieser Anwendung hält ein `useActionState` oder ein
 * `useTransition` den Zustand, und der Knopf bekommt ihn als `isLoading`
 * gereicht. Reine Formulare ohne eigenen Aktionszustand nutzen diesen Knopf,
 * wenn sie am Ende ohnehin umleiten; es gibt nichts, worin ein Zustand wohnen
 * könnte.
 *
 * `useFormStatus` ist genau dafür da: es liest den Zustand des Formulars, in
 * dem der Knopf *steht*. Darum muss der Knopf eine eigene Komponente sein und
 * darf nicht im selben Bauteil wie das `<form>` stehen — sonst läge er
 * oberhalb dessen, was er lesen will, und meldete für immer „bereit".
 *
 * Die Abmeldung ist der Weg, an dem ein zweiter Klick am teuersten ist: die
 * Sitzung ist beim ersten schon fort, und der zweite läuft ins Leere.
 */
export function AbsendeKnopf(props: Omit<ComponentProps<typeof Button>, 'type' | 'isLoading'>) {
  const {pending} = useFormStatus();
  return <Button {...props} type="submit" isLoading={pending} />;
}
