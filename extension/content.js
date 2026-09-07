// Auf jeder Seite: erkennt das Feld für den Einmalcode, holt die passenden
// Codes vom Hub (über background.js) und trägt ein — von selbst, wenn genau
// ein Zugang zu dieser Seite gemerkt ist, sonst über eine kleine Auswahl am
// Feld. Gelernt wird nie still: nach dem Eintragen fragt eine kleine Tafel,
// ob der Zugang zu dieser Seite gehört — und weil die Seite nach dem Code
// meist sofort weiterlädt, liegt die Frage in chrome.storage und steht auf
// der nächsten Seite derselben Domäne wieder da, bis sie beantwortet ist.
(() => {
  if (window.__medarbeiterCodes) return;
  window.__medarbeiterCodes = true;

  const HOST = location.hostname.replace(/^www\./, '');

  // ── Felder erkennen ──────────────────────────────────────────────────────
  const OTP_WORT =
    /(otp|one[-_ ]?time|totp|2[-_ ]?fa|mfa|two[-_ ]?factor|zwei[-_ ]?faktor|verif|auth(enticat)?[-_ ]?(or|ion)?[-_ ]?code|security[-_ ]?code|sicherheitscode|passcode|einmal|best[aä]tigungscode|token|pin\b|code)/i;
  const TYPEN = new Set(['text', 'tel', 'number', 'password', '']);

  function sichtbar(el) {
    if (!el.isConnected || el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }

  function beschriftung(el) {
    const teile = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete, el.className];
    const lbl = el.getAttribute('aria-labelledby');
    if (lbl) for (const id of lbl.split(/\s+/)) teile.push(document.getElementById(id)?.textContent);
    for (const l of el.labels ?? []) teile.push(l.textContent);
    if (el.id) teile.push(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent);
    return teile.filter(Boolean).join(' ');
  }

  function istCodeFeld(el) {
    if (!(el instanceof HTMLInputElement) || !TYPEN.has(el.type) || !sichtbar(el)) return false;
    if (el.autocomplete === 'one-time-code') return true;
    if (/^(email|username|tel|cc-|new-password|current-password)/.test(el.autocomplete)) return false;
    const ml = Number(el.maxLength);
    if (el.inputMode === 'numeric' && ml >= 4 && ml <= 8) return true;
    return OTP_WORT.test(beschriftung(el));
  }

  /** Sechs Kästchen mit maxlength=1 nebeneinander sind ein Feld. */
  function ziffernGruppe(el) {
    if (Number(el.maxLength) !== 1) return null;
    const wurzel = el.form ?? el.parentElement?.parentElement ?? document.body;
    const alle = [...wurzel.querySelectorAll('input')].filter(
      (i) => Number(i.maxLength) === 1 && TYPEN.has(i.type) && sichtbar(i),
    );
    return alle.length >= 4 && alle.length <= 8 ? alle : null;
  }

  function feldFinden() {
    for (const el of document.querySelectorAll('input')) {
      const gruppe = ziffernGruppe(el);
      if (gruppe) return {eingaben: gruppe, anker: gruppe[0]};
      if (istCodeFeld(el)) return {eingaben: [el], anker: el};
    }
    const aktiv = document.activeElement;
    if (aktiv instanceof HTMLInputElement && TYPEN.has(aktiv.type) && sichtbar(aktiv) && Number(aktiv.maxLength) <= 8) {
      const gruppe = ziffernGruppe(aktiv);
      if (gruppe) return {eingaben: gruppe, anker: gruppe[0]};
    }
    return null;
  }

  // ── Eintragen ────────────────────────────────────────────────────────────
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

  function wertSetzen(el, wert) {
    el.focus();
    setzer.call(el, wert);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }

  function eintragen(feld, code) {
    const {eingaben} = feld;
    if (eingaben.length === 1) {
      wertSetzen(eingaben[0], code);
      return true;
    }
    // Kästchen: erst als Paste anbieten (viele verteilen die Ziffern selbst),
    // dann Ziffer für Ziffer, falls das nichts eingetragen hat.
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', code);
      eingaben[0].focus();
      eingaben[0].dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: dt}));
    } catch {}
    if (eingaben.every((e, i) => e.value === code[i])) return true;
    code.split('').forEach((z, i) => eingaben[i] && wertSetzen(eingaben[i], z));
    eingaben[Math.min(code.length, eingaben.length) - 1]?.focus();
    return true;
  }

  // ── Der Hub ──────────────────────────────────────────────────────────────
  // Nach einem Neuladen der Erweiterung lebt dieses Skript in der offenen
  // Seite weiter, hat aber keinen Draht mehr — sendMessage wirft dann. Das
  // ist kein Netzfehler, sondern ein „Seite neu laden".
  const frag = (nachricht) =>
    new Promise((ok) => {
      try {
        if (!chrome.runtime?.id) return ok({fehler: 'neu-laden'});
        chrome.runtime.sendMessage(nachricht, (a) => {
          void chrome.runtime.lastError;
          ok(a ?? {fehler: 'netz'});
        });
      } catch {
        ok({fehler: 'neu-laden'});
      }
    });
  // Wann der laufende Code kippt — aus jeder Antwort des Hubs gemerkt, damit
  // das Zeichen im Feld den Ring zeichnen kann, ohne selbst zu fragen.
  let ablauf = null; // {bisMs, periodeMs, versatzMs}
  const jetztServer = () => Date.now() - (ablauf?.versatzMs ?? 0);
  async function holen() {
    const antwort = await frag({art: 'codes', host: HOST});
    if (antwort.codes?.length) {
      const bisMs = Math.min(...antwort.codes.map((c) => c.gueltigBisMs));
      const periodeMs = Math.min(...antwort.codes.map((c) => c.periode)) * 1000;
      ablauf = {bisMs, periodeMs, versatzMs: antwort.versatzMs};
    }
    return antwort;
  }

  // ── Die Auswahl am Feld ──────────────────────────────────────────────────
  let wirt = null;
  let aktuellesFeld = null;
  let ablaufTimer = null;

  const CSS_TEXT = `
    :host { all: initial; }
    .tafel { position: fixed; z-index: 2147483647; width: 340px; overflow: hidden;
      background: #fff; color: #1c1917; border: 1px solid #d9d2c1; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(28,25,23,.18); font: 13px/1.4 system-ui, -apple-system, sans-serif; }
    .kopf { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f7f1e2; border-bottom: 1px solid #ece2c9; }
    .kopf b { flex: 1; font-weight: 600; }
    .kopf button, .fuss button { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; color: #67625a; }
    .kopf button:hover, .fuss button:hover { background: #ece2c9; }
    .hinweis { padding: 8px 10px; color: #67625a; }
    .suche { display: block; width: calc(100% - 20px); margin: 8px 10px 4px; padding: 6px 8px; border: 1px solid #d9d2c1; border-radius: 6px; font: inherit; box-sizing: border-box; }
    ul { list-style: none; margin: 0; padding: 4px 0; }
    .mehr { padding: 4px 10px 8px; color: #67625a; font-size: 12px; }
    li button { all: unset; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 7px 10px; cursor: pointer; }
    li button:hover, li button:focus-visible { background: #f7f1e2; outline: none; }
    .name { flex: 1; min-width: 0; }
    .name span { display: block; color: #67625a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code { font-variant-numeric: tabular-nums; font-size: 16px; letter-spacing: .08em; font-weight: 600; }
    .marke { font-size: 11px; color: #7c5f05; background: #f7f1e2; border: 1px solid #e1b025; border-radius: 999px; padding: 0 6px; }
    .fuss { display: flex; gap: 8px; justify-content: space-between; padding: 6px 10px; border-top: 1px solid #ece2c9; color: #67625a; font-size: 12px; }
    .erfolg { padding: 8px 10px; background: #edf5e6; color: #2f5a1a; }
    @keyframes herein { from { transform: translateY(6px); } to { transform: none; } }
    .code.neu { animation: herein .28s cubic-bezier(.2,.7,.2,1) both; }
    @media (prefers-reduced-motion: reduce) { .code.neu { animation: none; } }
  `;

  function schliessen() {
    wirt?.remove();
    wirt = null;
    clearTimeout(ablaufTimer);
  }

  function zeigen(feld, antwort, zustand) {
    schliessen();
    aktuellesFeld = feld;
    wirt = document.createElement('medarbeiter-zugangscodes');
    const schatten = wirt.attachShadow({mode: 'open'});
    const stil = document.createElement('style');
    stil.textContent = CSS_TEXT;
    const tafel = document.createElement('div');
    tafel.className = 'tafel';
    tafel.setAttribute('role', 'dialog');
    tafel.setAttribute('aria-label', 'MedArbeiter Zugangscodes');
    schatten.append(stil, tafel);
    document.documentElement.append(wirt);

    const r = feld.anker.getBoundingClientRect();
    tafel.style.top = `${Math.min(r.bottom + 6, innerHeight - 80)}px`;
    tafel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 370))}px`;

    let alle = false;
    let filter = '';

    const render = () => {
      tafel.innerHTML = '';
      const kopf = document.createElement('div');
      kopf.className = 'kopf';
      kopf.innerHTML = '<b>MedArbeiter Zugangscodes</b>';
      const zu = document.createElement('button');
      zu.textContent = '✕';
      zu.title = 'Schließen';
      zu.onclick = schliessen;
      kopf.append(zu);
      tafel.append(kopf);

      if (antwort.fehler === 'anmelden') {
        tafel.insertAdjacentHTML('beforeend', `<p class="hinweis">Bitte zuerst am Hub anmelden: <a href="${antwort.hub}" target="_blank">${antwort.hub}</a></p>`);
        return;
      }
      if (antwort.fehler === 'neu-laden') {
        tafel.insertAdjacentHTML('beforeend', '<p class="hinweis">Die Erweiterung wurde aktualisiert – bitte diese Seite neu laden.</p>');
        return;
      }
      if (antwort.fehler) {
        tafel.insertAdjacentHTML('beforeend', `<p class="hinweis">Der Hub ist gerade nicht erreichbar (${antwort.hub ?? 'Adresse in den Einstellungen der Erweiterung'}).</p>`);
        return;
      }
      if (zustand.eingetragen) {
        const e = document.createElement('p');
        e.className = 'erfolg';
        e.textContent = `Code für ${zustand.eingetragen} eingetragen.`;
        tafel.append(e);
      }

      const codes = antwort.codes ?? [];
      if (codes.length === 0) {
        tafel.insertAdjacentHTML('beforeend', `<p class="hinweis">Für dein Konto ist im Hub kein Zugangscode hinterlegt. <a href="${antwort.hub}/zugangscodes" target="_blank">Zugangscodes im Hub</a></p>`);
        return;
      }
      const passende = codes.filter((c) => c.treffer > 0);
      if (passende.length === 0 && !zustand.eingetragen) {
        const h = document.createElement('p');
        h.className = 'hinweis';
        h.textContent = `Für ${HOST} noch nichts gemerkt – wähle den richtigen Zugang.`;
        tafel.append(h);
      }
      const liste = alle || passende.length === 0 ? codes : passende;
      if (alle || passende.length === 0) {
        const s = document.createElement('input');
        s.className = 'suche';
        s.placeholder = 'Dienst oder Konto suchen …';
        s.value = filter;
        s.oninput = () => {
          filter = s.value;
          renderListe();
        };
        tafel.append(s);
        setTimeout(() => s.focus(), 0);
      }
      const ul = document.createElement('ul');
      tafel.append(ul);
      const renderListe = () => {
        ul.innerHTML = '';
        const f = filter.trim().toLowerCase();
        const treffer = liste.filter((c) => !f || `${c.dienst} ${c.konto ?? ''}`.toLowerCase().includes(f));
        const zeilen = treffer.slice(0, 6);
        if (zeilen.length === 0) ul.innerHTML = '<li class="hinweis">Nichts gefunden.</li>';
        for (const c of zeilen) {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.innerHTML = `<span class="name"></span><span class="code"></span>`;
          const name = b.querySelector('.name');
          name.textContent = c.dienst;
          if (c.konto) {
            const s = document.createElement('span');
            s.textContent = c.konto;
            name.append(s);
          }
          if (c.treffer >= 2) {
            const m = document.createElement('span');
            m.className = 'marke';
            m.textContent = 'diese Seite';
            b.insertBefore(m, b.lastElementChild);
          }
          const codeEl = b.querySelector('.code');
          codeEl.textContent = c.code ? `${c.code.slice(0, 3)} ${c.code.slice(3)}` : '—';
          if (zustand.gewechselt) codeEl.classList.add('neu');
          b.onclick = () => waehlen(c);
          li.append(b);
          ul.append(li);
        }
        if (treffer.length > zeilen.length) {
          const m = document.createElement('li');
          m.className = 'mehr';
          m.textContent = `${treffer.length - zeilen.length} weitere – zum Eingrenzen oben tippen.`;
          ul.append(m);
        }
      };
      renderListe();

      const fuss = document.createElement('div');
      fuss.className = 'fuss';
      console.debug('[MedArbeiter] Codes für', HOST, codes.map((c) => [c.dienst, c.treffer]));
      fuss.innerHTML = `<span class="rest"></span>`;
      restZeigen(fuss.querySelector('.rest'));
      if (!alle && passende.length > 0 && passende.length < codes.length) {
        const mehr = document.createElement('button');
        mehr.textContent = `Alle ${codes.length} anzeigen`;
        mehr.onclick = () => {
          alle = true;
          render();
        };
        fuss.append(mehr);
      }
      tafel.append(fuss);
    };
    try {
      render();
    } catch (e) {
      console.error('[MedArbeiter] Auswahl konnte nicht gezeichnet werden', e);
      tafel.innerHTML = `<p class="hinweis">Die Auswahl konnte nicht gezeichnet werden: ${String(e)}</p>`;
    }

    // Wenn der Code kippt, neu holen — die Ziffern in der Auswahl sollen stimmen.
    const naechster = Math.min(...(antwort.codes ?? []).map((c) => c.gueltigBisMs));
    if (Number.isFinite(naechster)) {
      ablaufTimer = setTimeout(async () => {
        if (!wirt) return;
        const frisch = await holen();
        if (wirt) zeigen(feld, frisch, {...zustand, gewechselt: true});
      }, Math.max(500, naechster - (Date.now() - antwort.versatzMs) + 300));
    }

    async function waehlen(c) {
      // Frisch holen: zwischen Anzeigen und Klicken kann der Code gekippt sein.
      const frisch = await holen();
      const jetzt = frisch.codes?.find((x) => x.id === c.id) ?? c;
      if (!jetzt.code) return;
      eintragen(feld, jetzt.code);
      // Ein Zugang, den die Seite noch nicht genau kannte: fragen, nicht raten.
      if (c.treffer < 3) frageStellen(c);
      schliessen();
    }
  }

  // ── Das Zeichen im Feld ──────────────────────────────────────────────────
  // Wie der Passwortmanager: ein kleines Zeichen am rechten Rand des Feldes,
  // das bleibt, solange das Feld da ist — die Auswahl darf man schließen, den
  // Weg zurück soll man sehen. Fest positioniert und bei Scrollen/Größe
  // nachgeführt, weil es in fremden Seiten keinen sicheren Platz im Layout gibt.
  let zeichen = null;
  let zeichenFeld = null;
  let zeichenKnopf = null;
  let ringTimer = null;
  const restSpannen = new Set();

  /** Eine Zeile „noch N s gültig", die mitläuft, solange sie im Dokument steht. */
  function restZeigen(el) {
    restSpannen.add(el);
    ringTick();
  }

  function ringTick() {
    if (zeichenFeld) {
      const a = zeichenFeld.eingaben[zeichenFeld.eingaben.length - 1];
      if (a.isConnected) {
        fremdeSuchen(a, a.getBoundingClientRect());
        zeichenLegen();
      }
    }
    if (!ablauf) return;
    let rest = ablauf.bisMs - jetztServer();
    if (rest <= 0) {
      // Der Code ist gekippt: Ring von vorn, kurzer Puls — die Auswahl holt sich
      // die neuen Ziffern über ihren eigenen Timer.
      ablauf.bisMs += Math.ceil(-rest / ablauf.periodeMs) * ablauf.periodeMs;
      rest = ablauf.bisMs - jetztServer();
      if (zeichenKnopf) {
        zeichenKnopf.classList.remove('wechsel');
        void zeichenKnopf.offsetWidth;
        zeichenKnopf.classList.add('wechsel');
      }
    }
    const sekunden = Math.max(0, Math.ceil(rest / 1000));
    const ring = zeichenKnopf?.querySelector('.ring');
    if (ring) {
      const U = 2 * Math.PI * 9;
      ring.setAttribute('stroke-dashoffset', (U * (1 - rest / ablauf.periodeMs)).toFixed(2));
      ring.classList.toggle('knapp', sekunden <= 5);
      zeichenKnopf.title = `MedArbeiter Zugangscode eintragen – noch ${sekunden} s gültig`;
    }
    for (const el of restSpannen) {
      if (!el.isConnected) restSpannen.delete(el);
      else el.textContent = `noch ${sekunden} s gültig`;
    }
  }

  function zeichenLegen() {
    if (!zeichen || !zeichenFeld) return;
    const anker = zeichenFeld.eingaben[zeichenFeld.eingaben.length - 1];
    if (!anker.isConnected || !sichtbar(anker)) {
      zeichen.style.display = 'none';
      return;
    }
    const r = anker.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const x = freieKante(anker, r);
    zeichen.style.display = '';
    zeichen.style.top = `${y - 11}px`;
    zeichen.style.left = `${x - 11}px`;
  }

  function zeichenZeigen(feld) {
    if (zeichenFeld && zeichenFeld.anker === feld.anker) return;
    zeichenEntfernen();
    zeichenFeld = feld;
    zeichen = document.createElement('medarbeiter-zugangscodes-zeichen');
    const schatten = zeichen.attachShadow({mode: 'closed'});
    const stil = document.createElement('style');
    stil.textContent = `
      :host { all: initial; position: fixed; z-index: 2147483646; }
      button { all: unset; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
        background: #e1b025; border: 1px solid #8f6e06; box-shadow: 0 1px 2px rgba(28,25,23,.25); transition: transform .12s ease; }
      button:hover, button:focus-visible { background: #f0c23a; transform: scale(1.08); outline: none; }
      button:active { transform: scale(.96); }
      svg { width: 22px; height: 22px; display: block; }
      .spur { fill: none; stroke: rgba(28,25,23,.18); stroke-width: 2; }
      .ring { fill: none; stroke: #1c1917; stroke-width: 2; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%;
        transition: stroke-dashoffset 1s linear, stroke .3s; }
      .ring.knapp { stroke: #b4380d; }
      @keyframes wechsel { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
      button.wechsel { animation: wechsel .5s cubic-bezier(.2,.7,.2,1); }
      @media (prefers-reduced-motion: reduce) { button.wechsel { animation: none; } .ring { transition: none; } button { transition: none; } }
    `;
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.title = 'MedArbeiter Zugangscode eintragen';
    knopf.setAttribute('aria-label', knopf.title);
    // Drei Punkte (ein Code, der gleich erscheint) in einem Ring, der abläuft
    // wie der CodeRing im Hub: dunkle Tinte auf Gold, die letzten fünf
    // Sekunden warnend orange, beim Kippen ein kurzer Puls.
    const U = (2 * Math.PI * 9).toFixed(2);
    knopf.innerHTML = `<svg viewBox="0 0 22 22" aria-hidden="true">
      <circle class="spur" cx="11" cy="11" r="9"/>
      <circle class="ring" cx="11" cy="11" r="9" stroke-dasharray="${U}" stroke-dashoffset="0"/>
      <g fill="#1c1917"><circle cx="7.2" cy="11" r="1.5"/><circle cx="11" cy="11" r="1.5"/><circle cx="14.8" cy="11" r="1.5"/></g>
    </svg>`;
    zeichenKnopf = knopf;
    // Schon beim Drücken, nicht erst beim Klick: eine Seite mit eigenem
    // Klick-Abfangen (Dialoge, Fokusfallen) kann den Klick schlucken, das
    // Drücken kommt immer an. mousedown ohne Wirkung, damit das Feld den
    // Fokus behält — wie beim Passwortmanager.
    knopf.addEventListener('mousedown', (e) => e.preventDefault());
    knopf.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.debug('[MedArbeiter] Zeichen gedrückt', wirt ? 'schließen' : 'öffnen');
      if (wirt) return schliessen();
      zeigen(feld, await holen(), {});
    });
    knopf.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    schatten.append(stil, knopf);
    document.documentElement.append(zeichen);
    fremdeSuchen(feld.eingaben[feld.eingaben.length - 1], feld.eingaben[feld.eingaben.length - 1].getBoundingClientRect());
    zeichenLegen();
    clearInterval(ringTimer);
    ringTimer = setInterval(ringTick, 1000);
    ringTick();
  }

  function zeichenEntfernen() {
    zeichen?.remove();
    zeichen = null;
    zeichenFeld = null;
    zeichenKnopf = null;
    clearInterval(ringTimer);
  }

  /**
   * Was rechts im Feld schon sitzt: das 1Password-Zeichen und seine
   * Verwandten sind eigene Elemente (com-1password-button, bit-…), oft ohne
   * Treffer für elementsFromPoint (pointer-events: none) — darum werden
   * Sonderelemente, deren Rechteck das Feld schneidet, direkt gesucht und
   * zusätzlich der Punkt selbst getestet. Zurück kommt die linkeste Kante,
   * links von der unser Zeichen frei ist.
   */
  let fremdeZeichen = []; // die Sonderelemente im Feld, einmal je Sekunde gesucht (ringTick), nicht je Scrollbild
  const zaehlt = (anker) => (el) => el !== zeichen && el !== wirt && el !== anker && !el.contains(anker) && !anker.contains(el);
  function fremdeSuchen(anker, r) {
    fremdeZeichen = [...document.querySelectorAll('*')].filter((el) => {
      if (!el.tagName.includes('-') || !zaehlt(anker)(el)) return false;
      const q = el.getBoundingClientRect();
      return q.width > 0 && q.width <= 80 && q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom;
    });
  }
  function freieKante(anker, r) {
    let kante = r.right;
    for (const el of fremdeZeichen) {
      const q = el.getBoundingClientRect();
      if (q.width > 0 && q.right > r.left && q.left < r.right) kante = Math.min(kante, q.left);
    }
    // Die Mitte des Zeichens so wählen, dass seine ganze Breite (22 px plus
    // Luft) frei ist — ein freier Punkt allein reicht nicht: das 1Password-
    // Zeichen ist ein fest positionierter Knopf in einem geschlossenen
    // Schatten, sein Wirt hat kein Rechteck, nur der Punkttest sieht ihn.
    const y = r.top + r.height / 2;
    const z = zaehlt(anker);
    const frei = (x) => [-13, -6, 0, 6, 13].every((d) => document.elementsFromPoint(x + d, y).filter(z).length === 0);
    for (let x = kante - 8 - 11; x - 11 > r.left + 40; x -= 4) {
      if (frei(x)) return x;
    }
    return kante - 8 - 11;
  }

  let legeTimer = null;
  const nachfuehren = () => {
    if (legeTimer) return;
    legeTimer = requestAnimationFrame(() => {
      legeTimer = null;
      zeichenLegen();
      if (wirt && aktuellesFeld) {
        const r = aktuellesFeld.anker.getBoundingClientRect();
        const tafel = wirt.shadowRoot?.querySelector('.tafel');
        if (tafel) {
          tafel.style.top = `${Math.min(r.bottom + 6, innerHeight - 80)}px`;
          tafel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 370))}px`;
        }
      }
    });
  };
  addEventListener('scroll', nachfuehren, true);
  addEventListener('resize', nachfuehren);

  // ── Die Frage nach dem Eintragen ─────────────────────────────────────────
  // „Gehört <Zugang> zu <Seite>?" — als Eintrag in chrome.storage.local, nicht
  // als Zustand dieser Seite: der Code löst meist sofort ein Weiterladen aus,
  // und die Frage soll das überleben. Jede Seite derselben Domäne zeigt sie,
  // bis jemand Ja oder Nein sagt; nach zehn Minuten verfällt sie.
  const FRAGE_TTL = 10 * 60_000;

  function basis(host) {
    const t = host.split('.');
    if (t.length <= 2) return host;
    const zweistufig = t.at(-1).length === 2 && t.at(-2).length <= 3;
    return t.slice(zweistufig ? -3 : -2).join('.');
  }

  function frageStellen(c) {
    const name = c.konto ? `${c.dienst} (${c.konto})` : c.dienst;
    chrome.storage.local.set({frage: {id: c.id, name, host: HOST, bis: Date.now() + FRAGE_TTL}}).catch(() => {});
  }

  let frageWirt = null;

  function frageSchliessen() {
    frageWirt?.remove();
    frageWirt = null;
  }

  function frageZeigen(frage) {
    if (window !== window.top) return; // einmal je Fenster, nicht je Frame
    frageSchliessen();
    frageWirt = document.createElement('medarbeiter-zugangscodes-frage');
    const schatten = frageWirt.attachShadow({mode: 'open'});
    const stil = document.createElement('style');
    stil.textContent = `
      :host { all: initial; }
      .tafel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px; background: #1c1917; color: #f5efe0;
        border-radius: 12px; box-shadow: 0 8px 24px rgba(28,25,23,.35); font: 13px/1.45 system-ui, -apple-system, sans-serif; padding: 12px 14px;
        animation: auf .25s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes auf { from { transform: translateY(12px); } to { transform: none; } }
      @media (prefers-reduced-motion: reduce) { .tafel { animation: none; } }
      b { display: block; font-weight: 600; margin-bottom: 2px; }
      p { margin: 0 0 10px; color: #d9d2c1; }
      .knoepfe { display: flex; gap: 8px; justify-content: flex-end; }
      button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
      .ja { background: #e1b025; color: #1c1917; border: 1px solid #8f6e06; }
      .ja:hover { background: #f0c23a; }
      .nein { color: #d9d2c1; border: 1px solid #67625a; }
      .nein:hover { background: #2a2622; }
      button:focus-visible { outline: 2px solid #e1b025; outline-offset: 2px; }
    `;
    const tafel = document.createElement('div');
    tafel.className = 'tafel';
    tafel.setAttribute('role', 'dialog');
    tafel.setAttribute('aria-label', 'Seite merken?');
    tafel.innerHTML = `<b>Seite merken?</b><p></p><div class="knoepfe"><button class="nein" type="button">Nein</button><button class="ja" type="button">Ja, merken</button></div>`;
    tafel.querySelector('p').textContent = `Der Code für ${frage.name} wurde auf ${frage.host} eingetragen. Soll er hier künftig zuerst vorgeschlagen werden?`;
    tafel.querySelector('.nein').onclick = () => {
      chrome.storage.local.remove('frage').catch(() => {});
      frageSchliessen();
    };
    tafel.querySelector('.ja').onclick = async () => {
      const antwort = await frag({art: 'seite', id: frage.id, host: frage.host});
      chrome.storage.local.remove('frage').catch(() => {});
      tafel.querySelector('.knoepfe').remove();
      tafel.querySelector('p').textContent = antwort.ok
        ? `Gemerkt – ${frage.name} wird auf ${frage.host} ab jetzt zuerst vorgeschlagen.`
        : `Konnte nicht gemerkt werden: ${antwort.fehler ?? 'der Hub antwortet nicht'}.`;
      setTimeout(frageSchliessen, antwort.ok ? 3500 : 8000);
    };
    schatten.append(stil, tafel);
    document.documentElement.append(frageWirt);
    setTimeout(() => tafel.querySelector('.ja').focus(), 50);
  }

  function fragePruefen(frage) {
    if (!frage) return frageSchliessen();
    if (frage.bis < Date.now()) {
      chrome.storage.local.remove('frage').catch(() => {});
      return frageSchliessen();
    }
    if (basis(frage.host) !== basis(HOST)) return;
    frageZeigen(frage);
  }

  chrome.storage.local.get('frage').then(({frage}) => fragePruefen(frage)).catch(() => {});
  chrome.storage.onChanged.addListener((aenderungen, bereich) => {
    if (bereich === 'local' && 'frage' in aenderungen) fragePruefen(aenderungen.frage.newValue);
  });

  // ── Ablauf ───────────────────────────────────────────────────────────────
  let behandelt = null;

  async function pruefen() {
    if (zeichenFeld && !zeichenFeld.anker.isConnected) {
      zeichenEntfernen();
      schliessen();
      behandelt = null;
    }
    const feld = feldFinden();
    if (!feld) return;
    if (behandelt === feld.anker) return;
    behandelt = feld.anker;
    console.debug('[MedArbeiter] Codefeld erkannt', feld.eingaben);
    zeichenZeigen(feld);

    const antwort = await holen();
    if (antwort.fehler) {
      // Kein Banner ohne Sitzung — das Zeichen im Feld bleibt, und ein Klick darauf sagt, was fehlt.
      console.debug('[MedArbeiter] Hub antwortet nicht:', antwort.fehler, antwort.hub);
      return;
    }
    const sicher = (antwort.codes ?? []).filter((c) => c.treffer >= 2);
    const zustand = {};
    if (sicher.length === 1 && sicher[0].code) {
      eintragen(feld, sicher[0].code);
      zustand.eingetragen = sicher[0].konto ? `${sicher[0].dienst} (${sicher[0].konto})` : sicher[0].dienst;
      if (sicher[0].treffer < 3) frageStellen(sicher[0]);
    }
    zeigen(feld, antwort, zustand);
  }

  let timer = null;
  const spaeter = () => {
    clearTimeout(timer);
    timer = setTimeout(pruefen, 350);
  };
  new MutationObserver(spaeter).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['type', 'class', 'style', 'hidden']});
  document.addEventListener('focusin', async (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    // Zurück im bekannten Feld: die Auswahl wieder anbieten, falls sie geschlossen wurde.
    if (zeichenFeld?.eingaben.includes(e.target)) {
      if (!wirt) zeigen(zeichenFeld, await holen(), {});
      return;
    }
    behandelt = null;
    spaeter();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && schliessen(), true);
  document.addEventListener('pointerdown', (e) => {
    if (wirt && e.target !== wirt && e.target !== zeichen && !aktuellesFeld?.eingaben.includes(e.target)) schliessen();
  }, true);
  spaeter();

  // Das Popup der Erweiterung will eintragen (und wissen, ob es ging).
  chrome.runtime.onMessage.addListener((n, _a, antworte) => {
    if (n?.art !== 'fuellen') return false;
    const feld = feldFinden();
    if (!feld) return antworte({eingetragen: false}), false;
    eintragen(feld, n.code);
    schliessen();
    antworte({eingetragen: true});
    return false;
  });
})();
