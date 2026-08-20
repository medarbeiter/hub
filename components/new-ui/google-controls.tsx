'use client';

import {Banner, Button} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {mitGis} from '@/components/gis';

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
      {fehler && <Banner status="error" title={fehler} />}
      <div className="flex min-h-10 justify-center" ref={knopfRef} />
    </div>
  );
}

/**
 * Der Einrichtungsschritt: Googles Knopf verknüpft die Identität und führt
 * dann in denselben Weiterleitungs-Fluss wie der Knopf darunter — der bleibt
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
  const [leiteWeiter, setLeiteWeiter] = useState(false);
  const offen = useRef(false);

  useEffect(() => {
    if (!konfiguriert || !clientId) return;
    let abgebrochen = false;

    const start = () => {
      if (abgebrochen || !window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        // Identität ist bestätigt — die Kalender-Freigabe holt der
        // Weiterleitungs-Fluss, der die Sitzung ohnehin als `login_hint`
        // mitgibt. Ein Popup aus diesem asynchronen Rückruf heraus hätte
        // keine Benutzeraktivierung und würde geblockt.
        callback: () => {
          if (offen.current) return;
          offen.current = true;
          setLeiteWeiter(true);
          window.location.assign('/api/google/start?zurueck=new-login');
        },
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
      {hinweis && <Banner status="error" title={hinweis} />}

      <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-secondary px-5 py-4">
        <span className="text-xs text-muted">Firmen-E-Mail</span>
        <span className="text-sm font-medium">{email}</span>
      </div>

      {!konfiguriert && !mock && (
        <Banner
          description="Bitte die Verwaltung, die Google-Zugangsdaten der Anwendung zu hinterlegen. Erst danach kannst du die Einrichtung abschließen."
          status="warning"
          title="Google ist noch nicht eingerichtet"
        />
      )}

      {konfiguriert && clientId && <div className="flex min-h-10 justify-center" ref={knopfRef} />}

      {konfiguriert && (
        <Button
          isLoading={leiteWeiter}
          label="Über Weiterleitung verbinden"
          onClick={() => {
            setLeiteWeiter(true);
            window.location.assign('/api/google/start?zurueck=new-login');
          }}
          size="lg"
          type="button"
          variant={clientId ? 'ghost' : 'primary'}
          width="100%"
        />
      )}

      {!konfiguriert && mock && (
        <form action={mockAbsenden}>
          <Button
            isDisabled={gespeichert}
            isLoading={laeuft}
            label="Verknüpfung simulieren (Entwicklung)"
            size="lg"
            type="submit"
            variant="primary"
            width="100%"
          />
        </form>
      )}
    </div>
  );
}
