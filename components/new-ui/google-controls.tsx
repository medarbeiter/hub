'use client';

import {Alert, Button, Spinner} from '@heroui/react';
import {useEffect, useRef, useState} from 'react';
import {emailAusIdToken, mitGis} from '@/components/gis';
import {Fehlermeldung} from './auth-flow';

const KALENDER_BERECHTIGUNGEN =
  'openid email https://www.googleapis.com/auth/calendar.events';
const KNOPF_HOECHSTBREITE = 400;

function knopfbreite(element: HTMLDivElement) {
  return Math.floor(
    Math.min(KNOPF_HOECHSTBREITE, element.getBoundingClientRect().width || KNOPF_HOECHSTBREITE),
  );
}

/**
 * Googles eigener, personalisierter Knopf samt One-Tap-Hinweis. Er meldet an —
 * das Passwort bleibt der Grundweg, dies ist die Abkürzung.
 */
export function GoogleAnmeldeKnopf({clientId}: {clientId: string}) {
  const knopfRef = useRef<HTMLDivElement | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laeuft = useRef(false);

  useEffect(() => {
    const start = () => {
      if (!window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        callback: async (antwort) => {
          if (!antwort.credential || laeuft.current) return;
          laeuft.current = true;
          const anfrage = await fetch('/api/google/anmelden', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({credential: antwort.credential}),
          }).catch(() => null);
          const daten = anfrage
            ? ((await anfrage.json().catch(() => null)) as {
                ok?: boolean;
                ziel?: string;
                fehler?: string;
              } | null)
            : null;
          if (anfrage?.ok && daten?.ok && daten.ziel) {
            window.location.assign(daten.ziel === '/login' ? '/new/login' : daten.ziel);
            return;
          }
          laeuft.current = false;
          setFehler(
            daten?.fehler ??
              'Die Anmeldung über Google ist fehlgeschlagen. Bitte versuche es erneut.',
          );
        },
      });
      window.google.accounts.id.renderButton(knopfRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        locale: 'de',
        width: knopfbreite(knopfRef.current),
      });
      window.google.accounts.id.prompt();
    };

    const abbestellen = mitGis(start);
    return () => {
      abbestellen();
      window.google?.accounts.id.cancel();
    };
  }, [clientId]);

  return (
    <div className="flex flex-col gap-3">
      {fehler && <Fehlermeldung text={fehler} />}
      <div className="flex min-h-10 justify-center" ref={knopfRef} />
    </div>
  );
}

/**
 * Der Einrichtungsschritt: Googles Knopf verknüpft die Identität und holt im
 * selben Zug die Kalender-Freigabe im Popup. Der Weiterleitungs-Knopf bleibt
 * der Rückweg für Browser, in denen das GIS-Skript nicht lädt.
 */
export function GoogleVerknuepfung({
  clientId,
  konfiguriert,
  mock,
  email,
  hinweis,
  weiter,
  mockAbsenden,
  laeuft,
  gespeichert,
}: {
  clientId: string | null;
  konfiguriert: boolean;
  mock: boolean;
  email: string;
  hinweis: string | null;
  weiter: () => void;
  mockAbsenden: (payload: FormData) => void;
  laeuft: boolean;
  gespeichert: boolean;
}) {
  const knopfRef = useRef<HTMLDivElement | null>(null);
  const [fehler, setFehler] = useState<string | null>(hinweis);
  const [leiteWeiter, setLeiteWeiter] = useState(false);
  const offen = useRef(false);

  useEffect(() => {
    if (!konfiguriert || !clientId) return;
    let abgebrochen = false;

    const verbinden = (kennung?: string) => {
      if (offen.current || !window.google) return;
      offen.current = true;
      window.google.accounts.oauth2
        .initCodeClient({
          client_id: clientId,
          scope: KALENDER_BERECHTIGUNGEN,
          ux_mode: 'popup',
          hint: kennung,
          callback: async (antwort) => {
            offen.current = false;
            if (!antwort.code) {
              if (antwort.error && antwort.error !== 'access_denied') {
                setFehler('Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.');
              }
              return;
            }
            const anfrage = await fetch('/api/google/popup', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({code: antwort.code}),
            }).catch(() => null);
            const daten = anfrage
              ? ((await anfrage.json().catch(() => null)) as {
                  ok?: boolean;
                  fehler?: string;
                } | null)
              : null;
            if (anfrage?.ok && daten?.ok) {
              window.location.assign('/new/login?google=verbunden');
            } else {
              setFehler(
                daten?.fehler ??
                  'Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.',
              );
            }
          },
        })
        .requestCode();
    };

    const start = () => {
      if (abgebrochen || !window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        callback: (antwort) =>
          verbinden(antwort.credential ? emailAusIdToken(antwort.credential) : undefined),
      });
      window.google.accounts.id.renderButton(knopfRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        locale: 'de',
        width: knopfbreite(knopfRef.current),
      });
      window.google.accounts.id.prompt();
    };

    const abbestellen = mitGis(start);
    return () => {
      abgebrochen = true;
      abbestellen();
      window.google?.accounts.id.cancel();
    };
  }, [clientId, konfiguriert]);

  useEffect(() => {
    if (gespeichert) weiter();
  }, [gespeichert, weiter]);

  return (
    <div className="flex flex-col gap-5">
      {fehler && <Fehlermeldung text={fehler} />}

      <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-secondary px-5 py-4">
        <span className="text-xs text-muted">Firmen-E-Mail</span>
        <span className="text-sm font-medium">{email}</span>
      </div>

      {!konfiguriert && !mock && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Google ist noch nicht eingerichtet</Alert.Title>
            <Alert.Description>
              Bitte die Verwaltung, die Google-Zugangsdaten der Anwendung zu hinterlegen. Erst
              danach kannst du die Einrichtung abschließen.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {konfiguriert && clientId && <div className="flex min-h-10 justify-center" ref={knopfRef} />}

      {konfiguriert && (
        <Button
          fullWidth
          isPending={leiteWeiter}
          size="lg"
          type="button"
          variant={clientId ? 'ghost' : 'primary'}
          onPress={() => {
            setLeiteWeiter(true);
            window.location.assign('/api/google/start?zurueck=new-login');
          }}
        >
          {leiteWeiter && <Spinner color="current" size="sm" />}
          Über Weiterleitung verbinden
        </Button>
      )}

      {!konfiguriert && mock && (
        <form action={mockAbsenden}>
          <Button fullWidth isDisabled={gespeichert} isPending={laeuft} size="lg" type="submit">
            {laeuft && <Spinner color="current" size="sm" />}
            Verknüpfung simulieren (Entwicklung)
          </Button>
        </form>
      )}
    </div>
  );
}
