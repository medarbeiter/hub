// Auf jeder Seite: erkennt das Feld für den Einmalcode, holt die passenden
// Codes vom Hub (über background.js) und trägt ein — von selbst, wenn genau
// ein Zugang zu dieser Seite gemerkt ist, sonst über eine kleine Auswahl am
// Feld. Wer dort einen anderen Zugang wählt als den vorgeschlagenen, bringt
// dem Hub bei, dass dieser Zugang zu dieser Seite gehört.
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
  const frag = (nachricht) => new Promise((ok) => chrome.runtime.sendMessage(nachricht, (a) => ok(a ?? {fehler: 'netz'})));
  const holen = () => frag({art: 'codes', host: HOST});
  const merken = (id) => frag({art: 'seite', id, host: HOST});

  // ── Die Auswahl am Feld ──────────────────────────────────────────────────
  let wirt = null;
  let aktuellesFeld = null;
  let ablaufTimer = null;

  const CSS_TEXT = `
    :host { all: initial; }
    .tafel { position: fixed; z-index: 2147483647; min-width: 280px; max-width: 360px; max-height: 60vh; overflow: auto;
      background: #fff; color: #1c1917; border: 1px solid #d9d2c1; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(28,25,23,.18); font: 13px/1.4 system-ui, -apple-system, sans-serif; }
    .kopf { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f7f1e2; border-bottom: 1px solid #ece2c9; }
    .kopf b { flex: 1; font-weight: 600; }
    .kopf button, .fuss button { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; color: #67625a; }
    .kopf button:hover, .fuss button:hover { background: #ece2c9; }
    .hinweis { padding: 8px 10px; color: #67625a; }
    .suche { display: block; width: calc(100% - 20px); margin: 8px 10px 4px; padding: 6px 8px; border: 1px solid #d9d2c1; border-radius: 6px; font: inherit; box-sizing: border-box; }
    ul { list-style: none; margin: 0; padding: 4px 0; }
    li button { all: unset; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 7px 10px; cursor: pointer; }
    li button:hover, li button:focus-visible { background: #f7f1e2; outline: none; }
    .name { flex: 1; min-width: 0; }
    .name span { display: block; color: #67625a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code { font-variant-numeric: tabular-nums; font-size: 16px; letter-spacing: .08em; font-weight: 600; }
    .marke { font-size: 11px; color: #7c5f05; background: #f7f1e2; border: 1px solid #e1b025; border-radius: 999px; padding: 0 6px; }
    .fuss { display: flex; gap: 8px; justify-content: space-between; padding: 6px 10px; border-top: 1px solid #ece2c9; color: #67625a; font-size: 12px; }
    .erfolg { padding: 8px 10px; background: #edf5e6; color: #2f5a1a; }
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
      if (antwort.fehler) {
        tafel.insertAdjacentHTML('beforeend', '<p class="hinweis">Der Hub ist gerade nicht erreichbar.</p>');
        return;
      }
      if (zustand.eingetragen) {
        const e = document.createElement('p');
        e.className = 'erfolg';
        e.textContent = `Code für ${zustand.eingetragen} eingetragen.`;
        tafel.append(e);
      }

      const codes = antwort.codes ?? [];
      const passende = codes.filter((c) => c.treffer > 0);
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
        const zeilen = liste.filter((c) => !f || `${c.dienst} ${c.konto ?? ''}`.toLowerCase().includes(f)).slice(0, 40);
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
          b.querySelector('.code').textContent = c.code ? `${c.code.slice(0, 3)} ${c.code.slice(3)}` : '—';
          b.onclick = () => waehlen(c);
          li.append(b);
          ul.append(li);
        }
      };
      renderListe();

      const fuss = document.createElement('div');
      fuss.className = 'fuss';
      const rest = Math.max(0, Math.round((Math.min(...codes.map((c) => c.gueltigBisMs)) - (Date.now() - antwort.versatzMs)) / 1000));
      fuss.innerHTML = `<span>noch ${rest} s gültig</span>`;
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
    render();

    // Wenn der Code kippt, neu holen — die Ziffern in der Auswahl sollen stimmen.
    const naechster = Math.min(...(antwort.codes ?? []).map((c) => c.gueltigBisMs));
    if (Number.isFinite(naechster)) {
      ablaufTimer = setTimeout(async () => {
        if (!wirt) return;
        const frisch = await holen();
        if (wirt) zeigen(feld, frisch, zustand);
      }, Math.max(500, naechster - (Date.now() - antwort.versatzMs) + 300));
    }

    async function waehlen(c) {
      // Frisch holen: zwischen Anzeigen und Klicken kann der Code gekippt sein.
      const frisch = await holen();
      const jetzt = frisch.codes?.find((x) => x.id === c.id) ?? c;
      if (!jetzt.code) return;
      eintragen(feld, jetzt.code);
      // Ein Zugang, den die Seite nicht kannte, gehört ab jetzt zu ihr.
      if (c.treffer < 3) merken(c.id);
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

  function zeichenLegen() {
    if (!zeichen || !zeichenFeld) return;
    const anker = zeichenFeld.eingaben[zeichenFeld.eingaben.length - 1];
    if (!anker.isConnected || !sichtbar(anker)) {
      zeichen.style.display = 'none';
      return;
    }
    const r = anker.getBoundingClientRect();
    zeichen.style.display = '';
    zeichen.style.top = `${r.top + (r.height - 22) / 2}px`;
    zeichen.style.left = `${r.right - 30}px`;
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
      button { all: unset; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
        background: #fff; border: 1px solid #e1b025; box-shadow: 0 1px 3px rgba(28,25,23,.18); }
      button:hover, button:focus-visible { background: #f7f1e2; outline: none; }
      img { width: 16px; height: 16px; display: block; }
    `;
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.title = 'MedArbeiter Zugangscode eintragen';
    knopf.setAttribute('aria-label', knopf.title);
    const bild = document.createElement('img');
    bild.src = chrome.runtime.getURL('icons/48.png');
    bild.alt = '';
    knopf.append(bild);
    knopf.addEventListener('pointerdown', (e) => e.stopPropagation());
    knopf.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wirt) return schliessen();
      zeigen(feld, await holen(), {});
    });
    schatten.append(stil, knopf);
    document.documentElement.append(zeichen);
    zeichenLegen();
  }

  function zeichenEntfernen() {
    zeichen?.remove();
    zeichen = null;
    zeichenFeld = null;
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
