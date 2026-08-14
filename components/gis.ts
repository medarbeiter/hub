// Google Identity Services (GIS) — das gemeinsame Fundament der beiden
// Google-Bausteine: `google-knopf.tsx` (Kalender-Verknüpfung im Assistenten
// und auf dem Profil) und `google-anmeldung.tsx` (Anmeldung). Hier liegen die
// Typen des von Google nachgeladenen Skripts, der Lader und der
// E-Mail-Blick in ein ID-Token — einmal, damit sich zwei Deklarationen
// desselben `window.google` nie widersprechen können.

export const GSI_SRC = 'https://accounts.google.com/gsi/client';

export interface CredentialAntwort {
  credential?: string;
}

export interface CodeAntwort {
  code?: string;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (antwort: CredentialAntwort) => void;
            use_fedcm_for_prompt?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            el: HTMLElement,
            config: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill';
              locale?: string;
              width?: number;
            },
          ): void;
          prompt(): void;
          cancel(): void;
        };
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            hint?: string;
            callback: (antwort: CodeAntwort) => void;
          }): {requestCode(): void};
        };
      };
    };
  }
}

/**
 * Ruft `starte` auf, sobald das GIS-Skript da ist — sofort, wenn es schon
 * lädt oder geladen wurde. Gibt eine Abmeldung zurück, die den Lauschposten
 * wieder entfernt.
 */
export function mitGis(starte: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (window.google) {
    starte();
    return () => {};
  }
  let skript = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (!skript) {
    skript = document.createElement('script');
    skript.src = GSI_SRC;
    skript.async = true;
    document.head.appendChild(skript);
  }
  skript.addEventListener('load', starte);
  return () => skript.removeEventListener('load', starte);
}

/** Nur ein Blick, kein Nachweis: die E-Mail aus dem Payload eines ID-Tokens. */
export function emailAusIdToken(credential: string): string | undefined {
  const mitte = credential.split('.')[1];
  if (!mitte) return undefined;
  try {
    const payload = JSON.parse(atob(mitte.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.email === 'string' ? payload.email : undefined;
  } catch {
    return undefined;
  }
}
