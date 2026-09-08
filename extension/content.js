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
  // Drei Stufen, damit ein Farbwähler oder eine Postleitzahl nie ein Codefeld
  // ist: (1) ein Wort, das *nur* ein Einmalcode trägt, genügt allein;
  // (2) ein Wort, das gegen ein Codefeld spricht, schließt es aus, egal was
  // sonst dasteht; (3) das Schwache — „code", „pin", ein numerisches Feld
  // mit 4–8 Stellen — zählt nur, wenn die Seite selbst von Bestätigung,
  // Anmeldung in zwei Schritten oder einem Einmalcode spricht.
  const OTP_STARK =
    /(otp|one[-_ ]?time|totp|2[-_ ]?fa\b|\bmfa|two[-_ ]?factor|zwei[-_ ]?faktor|authenticat|verif(y|ication|izier)|security[-_ ]?code|sicherheitscode|best[aä]tigungscode|einmal|passcode|login[-_ ]?code|anmeldecode)/i;
  const OTP_SCHWACH = /(\bcode\b|\bpin\b|token)/i;
  const KEIN_CODE =
    /(plz|postleitzahl|postal|\bzip\b|post[-_ ]?code|colou?r|farbe|\bhex\b|hausnummer|house|street|stra[sß]e|iban|\bbic\b|steuer|\btax\b|\bvat\b|ust[-_ ]?id|kunden|customer|\border\b|bestell|artikel|\bsku\b|promo|coupon|gutschein|rabatt|discount|voucher|referral|invite|einladung|tracking|sendung|\bdate\b|datum|\byear\b|jahr|month|monat|\bday\b|cvc|cvv|\bcard\b|karte|kredit|credit|search|\bsuche?\b|price|preis|betrag|amount|menge|quantity|\bqty\b|anzahl|telefonnummer|phone[-_ ]?number|mobile[-_ ]?number|handynummer|rufnummer|\bfax\b|\bage\b|captcha|geburt|birth|kennzeichen|\bplate\b|\bort\b|\bcity\b|stadt|country|\bland\b|vorwahl|durchwahl|\broom\b|zimmer|\bseat\b|\bfloor\b|etage|weight|gewicht|\bsize\b|gr[oö][sß]e|width|height|breite|h[oö]he|percent|prozent|\bscore\b|punkte|\bslug\b|hostname|domain)/i;
  const SEITEN_HINWEIS =
    /authenticat|2[-_ ]?fa\b|two[-_ ]?factor|zwei[-_ ]?faktor|\bmfa\b|totp|einmal|one[-_ ]?time|verif|best[aä]tigungscode|sicherheitscode|security code|\bcode\b/i;
  const TYPEN = new Set(['text', 'tel', 'number', 'password', '']);
  const FREMDE_AUTOCOMPLETE = /^(email|username|tel|cc-|new-password|current-password|postal-code|address|street|country|bday|name|given-name|family-name|organization)/;

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

  /** Spricht die Seite von einem Code? Einmal je Suchlauf gerechnet — innerText kostet Layout. */
  let hinweisStand = null;
  const seitenHinweis = () => (hinweisStand ??= SEITEN_HINWEIS.test(document.body?.innerText ?? ''));

  function istCodeFeld(el) {
    if (!(el instanceof HTMLInputElement) || !TYPEN.has(el.type) || !sichtbar(el)) return false;
    if (el.autocomplete === 'one-time-code') return true;
    if (FREMDE_AUTOCOMPLETE.test(el.autocomplete)) return false;
    const text = beschriftung(el);
    if (KEIN_CODE.test(text)) return false;
    if (OTP_STARK.test(text)) return true;
    const ml = Number(el.maxLength);
    const numerisch = (el.inputMode === 'numeric' || el.type === 'number' || /^\[?0-9/.test(el.pattern ?? '')) && ml >= 4 && ml <= 8;
    return (numerisch || OTP_SCHWACH.test(text)) && seitenHinweis();
  }

  /** Sechs Kästchen mit maxlength=1 nebeneinander sind ein Feld — wenn die Seite von einem Code spricht. */
  function ziffernGruppe(el) {
    if (Number(el.maxLength) !== 1) return null;
    const wurzel = el.form ?? el.parentElement?.parentElement ?? document.body;
    const alle = [...wurzel.querySelectorAll('input')].filter(
      (i) => Number(i.maxLength) === 1 && TYPEN.has(i.type) && sichtbar(i),
    );
    if (alle.length < 4 || alle.length > 8) return null;
    if (alle.some((i) => KEIN_CODE.test(beschriftung(i)))) return null;
    const stark = alle.some((i) => i.autocomplete === 'one-time-code' || OTP_STARK.test(beschriftung(i)));
    return stark || seitenHinweis() ? alle : null;
  }

  function feldFinden() {
    hinweisStand = null;
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
      absenden(feld, code);
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
    if (!eingaben.every((e, i) => e.value === code[i])) {
      code.split('').forEach((z, i) => eingaben[i] && wertSetzen(eingaben[i], z));
      eingaben[Math.min(code.length, eingaben.length) - 1]?.focus();
    }
    absenden(feld, code);
    return true;
  }

  // ── Absenden ─────────────────────────────────────────────────────────────
  // Nach dem Eintragen den Knopf drücken, den ein Mensch jetzt drücken würde:
  // im Formular des Feldes (sonst im nächsten Container mit einem Knopf) der
  // sichtbare, nicht gesperrte Knopf, dessen Beschriftung nach Bestätigen
  // klingt — sonst der Submit-Knopf. Kurz gewartet, weil viele Seiten den
  // Knopf erst freigeben, wenn ihr Framework die Eingabe verarbeitet hat; und
  // wer bei sechs Ziffern von selbst weiterlädt, hat dann kein Feld mehr —
  // dann wird nichts gedrückt, ein zweites Absenden wäre ein Fehler.
  const ABSENDE_WORT = /verif|best[aä]tig|weiter|continue|next|submit|senden|\bsend\b|confirm|anmeld|log ?in|sign ?in|einloggen|\bok\b|fertig|done|pr[üu]fen|\bcheck\b|fortfahren|absenden|\benter\b|authenticat|proceed/i;
  const KEIN_ABSENDEN = /zur[üu]ck|abbrech|cancel|\bback\b|resend|erneut|neu senden|another|andere|hilfe|help|schlie[ßs]|close|skip|überspringen|later|später/i;

  function absendeKnopf(feld) {
    const anker = feld.anker;
    const text = (b) => `${b.textContent} ${b.value ?? ''} ${b.getAttribute('aria-label') ?? ''}`.trim();
    let kandidaten = anker.form ? [...anker.form.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')] : [];
    for (let el = anker.parentElement; kandidaten.length === 0 && el && el !== document.body; el = el.parentElement) {
      kandidaten = [...el.querySelectorAll('button, input[type="submit"], [role="button"]')];
    }
    const brauchbar = kandidaten.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !KEIN_ABSENDEN.test(text(b));
    });
    return brauchbar.find((b) => ABSENDE_WORT.test(text(b))) ?? brauchbar.find((b) => b.type === 'submit') ?? null;
  }

  function absenden(feld, code) {
    setTimeout(() => {
      const {eingaben, anker} = feld;
      if (!anker.isConnected || anker.disabled) return; // die Seite ist schon weiter
      const voll = eingaben.length === 1 ? eingaben[0].value === code : eingaben.every((e, i) => e.value === code[i]);
      if (!voll) return;
      const knopf = absendeKnopf(feld);
      if (knopf) {
        console.debug('[MedArbeiter] Absenden über', knopf);
        knopf.click();
        return;
      }
      // Kein Knopf, aber ein Formular, in dem sonst nichts mehr fehlt: wie die Eingabetaste.
      const form = anker.form;
      if (!form || !form.requestSubmit) return;
      const offen = [...form.querySelectorAll('input, select, textarea')].some(
        (e) => !eingaben.includes(e) && e.required && !e.disabled && e.type !== 'hidden' && !e.value,
      );
      if (!offen) form.requestSubmit();
    }, 300);
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

  /** Eine Tafel im Shadow-DOM, gestylt aus tafel.css – derselben Datei wie das Popup der Symbolleiste. */
  function tafelBauen(tag, label, klasse = '') {
    const wirt = document.createElement(tag);
    const schatten = wirt.attachShadow({mode: 'open'});
    const stil = document.createElement('link');
    stil.rel = 'stylesheet';
    stil.href = chrome.runtime.getURL('tafel.css');
    const tafel = document.createElement('div');
    tafel.className = `tafel ${klasse}`.trim();
    tafel.setAttribute('role', 'dialog');
    tafel.setAttribute('aria-label', label);
    // Erst zeigen, wenn das Stylesheet da ist – sonst stünde einen Moment rohes HTML am Seitenende.
    wirt.style.visibility = 'hidden';
    const bereit = new Promise((ok) => {
      stil.onload = stil.onerror = ok;
      setTimeout(ok, 300);
    }).then(() => wirt.style.removeProperty('visibility'));
    schatten.append(stil, tafel);
    document.documentElement.append(wirt);
    return {wirt, tafel, bereit};
  }

  /** Der Kopf jeder Tafel: Logo, Titel, optional die Seite, ✕. */
  function kopfBauen(titel, zu, seite) {
    const kopf = document.createElement('div');
    kopf.className = 'kopf';
    kopf.innerHTML = '<img alt=""><b></b><span class="seite"></span><button type="button" title="Schließen" aria-label="Schließen">✕</button>';
    kopf.querySelector('img').src = chrome.runtime.getURL('icons/48.png');
    kopf.querySelector('b').textContent = titel;
    kopf.querySelector('.seite').textContent = seite ?? '';
    kopf.querySelector('button').onclick = zu;
    return kopf;
  }

  /** Die Auswahl unter ihr Feld legen, im Fenster gehalten. */
  function tafelLegen(tafel, anker) {
    const r = anker.getBoundingClientRect();
    tafel.style.top = `${Math.min(r.bottom + 6, innerHeight - 80)}px`;
    tafel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 368))}px`;
  }

  function schliessen() {
    wirt?.remove();
    wirt = null;
    clearTimeout(ablaufTimer);
  }

  let letzterZustand = {};

  function zeigen(feld, antwort, zustand) {
    schliessen();
    aktuellesFeld = feld;
    letzterZustand = zustand;
    const t = tafelBauen('medarbeiter-zugangscodes', 'MedArbeiter Zugangscodes');
    wirt = t.wirt;
    const tafel = t.tafel;
    tafelLegen(tafel, feld.anker);

    let alle = false;
    let filter = '';

    const render = () => {
      tafel.innerHTML = '';
      tafel.append(kopfBauen('Zugangscodes', schliessen, HOST));

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
      const erk = zustand.erkannt ?? erkannt;
      const liste = (alle || passende.length === 0 ? codes : passende).slice().sort((a, b) => erk.has(b.id) - erk.has(a.id));
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
          if (erk.has(c.id) || c.treffer >= 2) {
            const m = document.createElement('span');
            m.className = 'marke';
            m.textContent = erk.has(c.id) ? 'dieses Konto' : 'diese Seite';
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
      fuss.innerHTML = `<span class="rest"></span><span class="fuss-knoepfe"></span>`;
      restZeigen(fuss.querySelector('.rest'));
      const knoepfe = fuss.querySelector('.fuss-knoepfe');
      const aus = document.createElement('button');
      aus.textContent = 'Hier aus';
      aus.title = `Auf ${basis(HOST)} nicht mehr anbieten (im Popup wieder einschaltbar)`;
      aus.className = 'leise';
      aus.onclick = hierAus;
      knoepfe.append(aus);
      if (!alle && passende.length > 0 && passende.length < codes.length) {
        const mehr = document.createElement('button');
        mehr.textContent = `Alle ${codes.length} anzeigen`;
        mehr.onclick = () => {
          alle = true;
          render();
        };
        knoepfe.append(mehr);
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
      if (c.treffer < 3) frageStellen(c, frisch.codes ?? []);
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
        zeichenLegen(true);
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

  // Beim Scrollen springt das Zeichen mit dem Feld (sonst zöge es nach); rückt
  // es dagegen einem fremden Zeichen aus dem Weg, gleitet es hin — ein
  // Zeichen, das ohne Grund an eine andere Stelle springt, sieht nach Fehler aus.
  function zeichenLegen(gleiten = false) {
    if (!zeichen || !zeichenFeld) return;
    zeichen.classList.toggle('gleitet', gleiten && zeichen.style.display !== 'none' && zeichen.style.left !== '');
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
      :host(.gleitet) { transition: top .25s cubic-bezier(.2,.7,.2,1), left .25s cubic-bezier(.2,.7,.2,1); }
      @media (prefers-reduced-motion: reduce) { :host(.gleitet) { transition: none; } }
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
        const tafel = wirt.shadowRoot?.querySelector('.tafel');
        if (tafel) tafelLegen(tafel, aktuellesFeld.anker);
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

  const zugangName = (c) => (c.konto ? `${c.dienst} (${c.konto})` : c.dienst);

  /** Fragen — und die Geschwister gleich mit anbieten: dieselbe Seite, andere Konten desselben Dienstes. */
  function frageStellen(c, codes = []) {
    const weitere = codes
      .filter((x) => x.id !== c.id && x.treffer > 0 && x.treffer < 3 && x.dienst === c.dienst)
      .map((x) => ({id: x.id, name: zugangName(x)}));
    chrome.storage.local.set({frage: {id: c.id, name: zugangName(c), host: HOST, bis: Date.now() + FRAGE_TTL, weitere}}).catch(() => {});
  }

  let frageWirt = null;

  function frageSchliessen() {
    frageWirt?.remove();
    frageWirt = null;
  }

  function frageZeigen(frage) {
    if (window !== window.top) return; // einmal je Fenster, nicht je Frame
    frageSchliessen();
    const nein = () => {
      chrome.storage.local.remove('frage').catch(() => {});
      frageSchliessen();
    };
    const t = tafelBauen('medarbeiter-zugangscodes-frage', 'Diese Seite merken?', 'frage');
    frageWirt = t.wirt;
    const tafel = t.tafel;
    tafel.append(kopfBauen('Diese Seite merken?', nein));
    tafel.insertAdjacentHTML('beforeend', `
      <div class="rumpf">
        <dl><dt>Zugang</dt><dd class="zugang"></dd><dt>Seite</dt><dd class="seite"></dd></dl>
        <ul class="wahl" hidden></ul>
        <p>Dann steht dieser Code hier beim nächsten Mal zuerst.</p>
        <div class="knoepfe"><button class="nein" type="button">Nein</button><button class="ja" type="button">Ja, merken</button></div>
      </div>`);
    tafel.querySelector('.zugang').textContent = frage.name;
    tafel.querySelector('.zugang').title = frage.name;
    tafel.querySelector('dd.seite').textContent = frage.host;
    // Weitere Konten desselben Dienstes: einmal fragen, mehrere merken.
    const wahl = tafel.querySelector('.wahl');
    const weitere = frage.weitere ?? [];
    if (weitere.length > 0) {
      wahl.hidden = false;
      wahl.insertAdjacentHTML('beforeend', '<li class="wahl-titel">Auch für diese Konten merken:</li>');
      for (const w of weitere) {
        const li = document.createElement('li');
        li.innerHTML = '<label><input type="checkbox"><span></span></label>';
        li.querySelector('input').value = String(w.id);
        li.querySelector('span').textContent = w.name;
        wahl.append(li);
      }
    }
    tafel.querySelector('.nein').onclick = nein;
    tafel.querySelector('.ja').onclick = async () => {
      const ids = [frage.id, ...[...wahl.querySelectorAll('input:checked')].map((i) => Number(i.value))];
      const antworten = await Promise.all(ids.map((id) => frag({art: 'seite', id, host: frage.host})));
      chrome.storage.local.remove('frage').catch(() => {});
      tafel.querySelector('.knoepfe').remove();
      wahl.remove();
      const p = tafel.querySelector('.rumpf p');
      p.className = 'ergebnis';
      const fehl = antworten.find((a) => !a.ok);
      p.textContent = fehl
        ? `Nicht gemerkt: ${fehl.fehler ?? 'der Hub antwortet nicht'}.`
        : ids.length > 1 ? `✓ Gemerkt für ${ids.length} Zugänge.` : '✓ Gemerkt.';
      setTimeout(frageSchliessen, fehl ? 8000 : 2500);
    };
    t.bereit.then(() => tafel.querySelector('.ja')?.focus());
  }

  function fragePruefen(frage) {
    if (!frage || pausiert()) return frageSchliessen();
    if (frage.bis < Date.now()) {
      chrome.storage.local.remove('frage').catch(() => {});
      return frageSchliessen();
    }
    if (basis(frage.host) !== basis(HOST)) return;
    frageZeigen(frage);
  }

  chrome.storage.onChanged.addListener((aenderungen, bereich) => {
    if (bereich !== 'local') return;
    if ('pause' in aenderungen) pauseSetzen(aenderungen.pause.newValue);
    if ('frage' in aenderungen) fragePruefen(aenderungen.frage.newValue);
  });

  // ── Einen neuen Zugang erkennen ──────────────────────────────────────────
  // Eine Einrichtungsseite zeigt den QR-Code (ein otpauth-Link) und daneben
  // meist den Schlüssel als Text. Beides wird erkannt und als Angebot gezeigt:
  // „Zugang im Hub speichern?" — nie still, nie ohne Hub-Sitzung. Ein Nein
  // gilt einen Tag (chrome.storage.local, ohne das Geheimnis).
  const geprueft = new Set();
  let angebotWirt = null;
  const HINWEIS_WORT = /authenticat|2fa|two[-_ ]?factor|zwei[-_ ]?faktor|mfa|totp|einmalcode|one[-_ ]?time|qr/i;
  // ponytail: Heuristik – 16–64 Base32-Zeichen, gern in Vierergruppen, mit mindestens einer Ziffer;
  // dazu muss die Seite von Authenticator/2FA sprechen. Ein Wort ohne Ziffer fällt durch.
  const B32_TEXT = /^(?:[A-Z2-7]{4}[ -]?){4,16}[A-Z2-7]{0,3}=*$/i;

  function quadratisch(el) {
    const r = el.getBoundingClientRect();
    return r.width >= 100 && r.width <= 640 && Math.abs(r.width - r.height) < r.width * 0.15;
  }

  /** Ein Bild als PNG-Daten-URL — oder seine Adresse, wenn die Leinwand fremd wäre. */
  async function rastern(el) {
    try {
      if (el instanceof HTMLCanvasElement) return el.toDataURL('image/png');
      const leinwand = document.createElement('canvas');
      const stift = leinwand.getContext('2d');
      const male = (bild, w, h) => {
        leinwand.width = w;
        leinwand.height = h;
        stift.fillStyle = '#fff'; // ein durchsichtiger QR-Code hat sonst keinen Kontrast
        stift.fillRect(0, 0, w, h);
        stift.drawImage(bild, 0, 0, w, h);
        return leinwand.toDataURL('image/png');
      };
      if (el instanceof HTMLImageElement) {
        if (!el.complete || el.naturalWidth === 0) return null;
        try {
          return male(el, el.naturalWidth, el.naturalHeight);
        } catch {
          return el.currentSrc || el.src; // fremde Herkunft: der Hintergrund holt sie selbst
        }
      }
      if (el instanceof SVGSVGElement) {
        const r = el.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        const kopie = el.cloneNode(true);
        kopie.setAttribute('width', w);
        kopie.setAttribute('height', h);
        const bild = new Image();
        bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(kopie))}`;
        await bild.decode();
        return male(bild, w, h);
      }
    } catch {}
    return null;
  }

  function otpauthName(uri) {
    try {
      const u = new URL(uri);
      const label = decodeURIComponent(u.pathname.replace(/^\//, ''));
      const [vorn, hinten] = label.includes(':') ? label.split(/:(.*)/s) : ['', label];
      return {dienst: u.searchParams.get('issuer') || vorn.trim(), konto: (hinten ?? '').trim()};
    } catch {
      return {dienst: '', konto: ''};
    }
  }

  async function zugangSuchen() {
    if (angebotWirt || pausiert()) return;
    const link = document.querySelector('a[href^="otpauth://"]');
    if (link) return anbieten({otpauth: link.getAttribute('href')});
    for (const el of [...document.querySelectorAll('img, canvas, svg')].filter(quadratisch).slice(0, 6)) {
      const bild = await rastern(el);
      if (!bild || geprueft.has(bild)) continue;
      geprueft.add(bild);
      const a = await frag({art: 'qr', bild});
      if (a.otpauth) return anbieten({otpauth: a.otpauth});
    }
    if (!HINWEIS_WORT.test(document.body?.innerText ?? '')) return;
    for (const el of document.querySelectorAll('code, kbd, samp, pre, strong, b, span, p, td, div, input[readonly], input[disabled]')) {
      const eingabe = el instanceof HTMLInputElement;
      if (!eingabe && el.children.length > 0) continue;
      const text = (eingabe ? el.value : el.textContent).trim();
      if (text.length < 16 || text.length > 80 || !B32_TEXT.test(text) || !/[2-7]/.test(text)) continue;
      if (el.getBoundingClientRect().width === 0) continue;
      const secret = text.replace(/[\s-]/g, '').toUpperCase();
      if (geprueft.has(secret)) continue;
      geprueft.add(secret);
      return anbieten({secret});
    }
  }

  async function anbieten(fund) {
    const name = fund.otpauth ? otpauthName(fund.otpauth) : {dienst: '', konto: ''};
    const dienst = name.dienst || basis(HOST).split('.')[0].replace(/^./, (z) => z.toUpperCase());
    const schluessel = `${HOST}|${dienst}|${name.konto}`;
    const {verworfen = {}} = await chrome.storage.local.get('verworfen').catch(() => ({}));
    if ((verworfen[schluessel] ?? 0) > Date.now()) return;
    const antwort = await holen();
    if (antwort.fehler) return; // ohne Sitzung nichts Sichtbares auf fremden Seiten
    angebotZeigen({...fund, dienst, konto: name.konto, schluessel, hub: antwort.hub});
  }

  function angebotZeigen(angebot) {
    if (angebotWirt) return;
    const t = tafelBauen('medarbeiter-zugangscodes-angebot', 'Zugang im Hub speichern?', 'frage');
    angebotWirt = t.wirt;
    const tafel = t.tafel;
    const zu = () => {
      angebotWirt?.remove();
      angebotWirt = null;
    };
    const nein = () => {
      chrome.storage.local.get('verworfen').then(({verworfen = {}}) => {
        verworfen[angebot.schluessel] = Date.now() + 24 * 3600_000;
        return chrome.storage.local.set({verworfen});
      }).catch(() => {});
      zu();
    };
    tafel.append(kopfBauen('Zugang im Hub speichern?', nein));
    tafel.insertAdjacentHTML('beforeend', `
      <div class="rumpf">
        <p>Diese Seite zeigt ${angebot.otpauth ? 'einen QR-Code' : 'einen Schlüssel'} für einen neuen Einmalcode.</p>
        <label class="feld">Dienst<input class="dienst" autocomplete="off"></label>
        <label class="feld">Konto<input class="konto" autocomplete="off" placeholder="z. B. die E-Mail-Adresse"></label>
        <dl><dt>Seite</dt><dd class="seite"></dd></dl>
        <p class="fehler" hidden></p>
        <div class="knoepfe"><button class="nein" type="button">Nein</button><button class="ja" type="button">Im Hub speichern</button></div>
      </div>`);
    tafel.querySelector('.dienst').value = angebot.dienst;
    tafel.querySelector('.konto').value = angebot.konto;
    tafel.querySelector('dd.seite').textContent = HOST;
    tafel.querySelector('.nein').onclick = nein;
    const ja = tafel.querySelector('.ja');
    ja.onclick = async () => {
      const dienst = tafel.querySelector('.dienst').value.trim();
      const konto = tafel.querySelector('.konto').value.trim();
      const fehler = tafel.querySelector('.fehler');
      if (!dienst) {
        fehler.hidden = false;
        fehler.textContent = 'Bitte den Dienst benennen.';
        return;
      }
      ja.disabled = true;
      const a = await frag({art: 'anlegen', otpauth: angebot.otpauth, secret: angebot.secret, dienst, konto, host: HOST});
      ja.disabled = false;
      if (!a.ok) {
        fehler.hidden = false;
        fehler.textContent = a.fehler ?? 'Der Hub antwortet nicht.';
        return;
      }
      tafel.querySelector('.rumpf').innerHTML = '<p class="ergebnis">✓ Gespeichert.</p><p class="hinweis"><a target="_blank"></a></p>';
      const link = tafel.querySelector('a');
      link.href = `${angebot.hub}/zugangscodes`;
      link.textContent = 'Zugangscodes im Hub';
      // Die Seite fragt jetzt meist den ersten Code ab — den kennt der Hub schon.
      behandelt = null;
      spaeter();
      setTimeout(zu, 4000);
    };
    t.bereit.then(() => tafel.querySelector('.dienst').focus());
  }

  let scanTimer = null;
  const scanSpaeter = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => zugangSuchen().catch(() => {}), 800);
  };
  document.addEventListener('load', scanSpaeter, true); // ein Bild, das erst später fertig ist

  // ── Pause ────────────────────────────────────────────────────────────────
  // Aus, für eine Weile, oder auf dieser Seite nie: ein Eintrag `pause` in
  // chrome.storage.local — {aus, bis, seiten: {domäne: true}} — gesetzt vom
  // Popup oder vom „Hier aus"-Knopf der Auswahl. Solange er greift, gibt es
  // kein Zeichen, keine Auswahl, keine Frage und keinen Blick auf QR-Codes.
  let pause = {};
  const pausiert = () => Boolean(pause.aus || (pause.bis && pause.bis > Date.now()) || pause.seiten?.[basis(HOST)]);
  function pauseSetzen(p) {
    pause = p ?? {};
    if (!pausiert()) {
      behandelt = null;
      spaeter();
      scanSpaeter();
      return;
    }
    zeichenEntfernen();
    schliessen();
    frageSchliessen();
    angebotWirt?.remove();
    angebotWirt = null;
    behandelt = null;
  }
  function hierAus() {
    chrome.storage.local.get('pause').then(({pause: p = {}}) => {
      p.seiten = {...(p.seiten ?? {}), [basis(HOST)]: true};
      return chrome.storage.local.set({pause: p});
    }).catch(() => {});
  }

  // ── Das Konto erkennen ───────────────────────────────────────────────────
  // Ein Dienst, mehrere Konten (TikTok, Instagram, Google …): „diese Seite"
  // reicht dann nicht, gefragt ist *welches* Konto gerade angemeldet wird.
  // Drei Quellen, alle ohne Server: der Seitentext (Handle, E-Mail, Name auf
  // der Codeseite), die Werte sichtbarer Eingabefelder, und was zuletzt in ein
  // Benutzer-/E-Mail-Feld derselben Domäne getippt wurde — denn die Codeseite
  // kommt meist nach einem Weiterladen, in dem der Name schon wieder weg ist.
  // Gemerkt wird das Getippte zehn Minuten in chrome.storage.local, je Domäne.
  const KONTO_FELD = /user|login|e-?mail|phone|tel\b|konto|benutzer|handle|account|anmeld|nutzer/i;
  let merkTimer = null;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !['text', 'email', 'tel', ''].includes(el.type)) return;
    if (el.type !== 'email' && !KONTO_FELD.test(beschriftung(el))) return;
    if (zeichenFeld?.eingaben.includes(el)) return;
    clearTimeout(merkTimer);
    merkTimer = setTimeout(() => {
      const wert = el.value.trim();
      if (wert.length < 3) return;
      chrome.storage.local.get('konten').then(({konten = {}}) => {
        for (const [k, v] of Object.entries(konten)) if (v.bis < Date.now()) delete konten[k];
        konten[basis(HOST)] = {wert, bis: Date.now() + FRAGE_TTL};
        return chrome.storage.local.set({konten});
      }).catch(() => {});
    }, 400);
  }, true);

  async function gemerktesKonto() {
    const {konten = {}} = await chrome.storage.local.get('konten').catch(() => ({}));
    const k = konten[basis(HOST)];
    return k && k.bis > Date.now() ? k.wert : '';
  }

  /** Die Zugänge, deren Konto auf dieser Seite vorkommt. */
  async function kontoTreffer(codes) {
    const text = [
      document.body?.innerText ?? '',
      ...[...document.querySelectorAll('input')].map((i) => (i.type === 'password' ? '' : i.value)),
      await gemerktesKonto(),
    ]
      .join('\n')
      .toLowerCase();
    return codes.filter((c) => {
      const k = (c.konto ?? '').trim().toLowerCase().replace(/^@/, '');
      // ponytail: Teilstring ab vier Zeichen – „info" träfe zu oft, eine E-Mail oder ein Handle nie zufällig.
      return k.length >= 4 && text.includes(k);
    });
  }

  let erkannt = new Set();

  // ── Ablauf ───────────────────────────────────────────────────────────────
  let behandelt = null;

  async function pruefen() {
    if (pausiert()) return;
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
    const codes = antwort.codes ?? [];
    const sicher = codes.filter((c) => c.treffer >= 2);
    const passende = codes.filter((c) => c.treffer > 0);
    // Erst das Konto, dann die Seite: unter mehreren Zugängen desselben Dienstes
    // entscheidet, wessen Konto auf der Seite steht; ohne Konto genügt genau einer.
    const gefunden = await kontoTreffer(sicher.length > 0 ? sicher : passende);
    erkannt = new Set(gefunden.map((c) => c.id));
    const wahl = gefunden.length === 1 ? gefunden[0] : sicher.length === 1 ? sicher[0] : null;
    const zustand = {erkannt};
    if (wahl?.code) {
      eintragen(feld, wahl.code);
      zustand.eingetragen = wahl.konto ? `${wahl.dienst} (${wahl.konto})` : wahl.dienst;
      if (wahl.treffer < 3) frageStellen(wahl, codes);
    }
    zeigen(feld, antwort, zustand);
  }

  let timer = null;
  const spaeter = () => {
    clearTimeout(timer);
    timer = setTimeout(pruefen, 350);
  };
  new MutationObserver(() => {
    spaeter();
    scanSpaeter();
  }).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['type', 'class', 'style', 'hidden', 'src']});
  const zeichenNachziehen = () => setTimeout(() => zeichenFeld && ringTick(), 60);
  document.addEventListener('focusout', zeichenNachziehen);
  document.addEventListener('focusin', async (e) => {
    zeichenNachziehen();
    if (!(e.target instanceof HTMLInputElement)) return;
    // Zurück im bekannten Feld: die Auswahl wieder anbieten, falls sie geschlossen wurde.
    if (zeichenFeld?.eingaben.includes(e.target)) {
      // Das Eintragen selbst fokussiert das Feld: bis die Antwort da ist, hat
      // pruefen() die Auswahl meist schon gezeichnet — dann nicht überschreiben.
      if (wirt) return;
      const antwort = await holen();
      if (!wirt) zeigen(zeichenFeld, antwort, letzterZustand);
      return;
    }
    behandelt = null;
    spaeter();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && schliessen(), true);
  document.addEventListener('pointerdown', (e) => {
    if (wirt && e.target !== wirt && e.target !== zeichen && !aktuellesFeld?.eingaben.includes(e.target)) schliessen();
  }, true);
  // Erst die Pause lesen, dann loslegen — und die liegen gebliebene Frage.
  chrome.storage.local.get(['pause', 'frage']).then(({pause: p, frage}) => {
    pause = p ?? {};
    if (pausiert()) return;
    spaeter();
    scanSpaeter();
    fragePruefen(frage);
  }).catch(() => {
    spaeter();
    scanSpaeter();
  });

  // Das Popup der Erweiterung will eintragen (und wissen, ob es ging) — oder
  // die Sitzung am Hub hat gewechselt: dann von vorn, als wäre das Feld neu.
  chrome.runtime.onMessage.addListener((n, _a, antworte) => {
    if (n?.art === 'sitzung') {
      schliessen();
      behandelt = null;
      spaeter();
      return false;
    }
    if (n?.art !== 'fuellen') return false;
    const feld = feldFinden();
    if (!feld) return antworte({eingetragen: false}), false;
    eintragen(feld, n.code);
    schliessen();
    antworte({eingetragen: true});
    return false;
  });
})();
