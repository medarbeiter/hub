// Das Popup in der Symbolleiste: die Codes für die offene Seite zuerst, dann
// alle. Ein Klick kopiert den Code und trägt ihn ein, wenn die Seite ein Feld
// hat — und merkt dem Hub die Seite, wenn sie diesen Zugang noch nicht kannte.
const $ = (id) => document.getElementById(id);
let tab = null;
let host = '';
let antwort = null;
let timer = null;

const frag = (n) => new Promise((ok) => chrome.runtime.sendMessage(n, (a) => ok(a ?? {fehler: 'netz'})));

function zeile(c) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = c.dienst;
  if (c.konto) {
    const s = document.createElement('span');
    s.textContent = c.konto;
    name.append(s);
  }
  b.append(name);
  if (c.treffer >= 2) {
    const m = document.createElement('span');
    m.className = 'marke';
    m.textContent = 'diese Seite';
    b.append(m);
  }
  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = c.code ? `${c.code.slice(0, 3)} ${c.code.slice(3)}` : '—';
  b.append(code);
  b.onclick = () => waehlen(c);
  li.append(b);
  return li;
}

function render() {
  const liste = $('liste');
  const hinweis = $('hinweis');
  liste.innerHTML = '';
  hinweis.hidden = true;
  if (antwort.fehler === 'anmelden') {
    hinweis.hidden = false;
    hinweis.innerHTML = `Bitte zuerst am Hub anmelden: <a href="${antwort.hub}/zugangscodes" target="_blank">${antwort.hub}</a>`;
    return;
  }
  if (antwort.fehler) {
    hinweis.hidden = false;
    hinweis.textContent = `Der Hub ist nicht erreichbar (${antwort.hub}).`;
    return;
  }
  const f = $('suche').value.trim().toLowerCase();
  const codes = antwort.codes.filter((c) => !f || `${c.dienst} ${c.konto ?? ''}`.toLowerCase().includes(f));
  const passende = codes.filter((c) => c.treffer > 0);
  const andere = codes.filter((c) => c.treffer === 0);
  if (passende.length > 0 && andere.length > 0) {
    liste.insertAdjacentHTML('beforeend', '<li class="gruppe">Für diese Seite</li>');
    passende.forEach((c) => liste.append(zeile(c)));
    liste.insertAdjacentHTML('beforeend', '<li class="gruppe">Alle Zugänge</li>');
    andere.forEach((c) => liste.append(zeile(c)));
  } else {
    codes.forEach((c) => liste.append(zeile(c)));
  }
  if (codes.length === 0) {
    hinweis.hidden = false;
    hinweis.textContent = 'Nichts gefunden.';
  }
}

function takt() {
  clearInterval(timer);
  timer = setInterval(async () => {
    if (!antwort?.codes?.length) return;
    const rest = Math.min(...antwort.codes.map((c) => c.gueltigBisMs)) - (Date.now() - antwort.versatzMs);
    $('rest').textContent = `noch ${Math.max(0, Math.ceil(rest / 1000))} s gültig`;
    if (rest <= 0) await laden();
  }, 250);
}

async function laden() {
  antwort = await frag({art: 'codes', host});
  $('neu').href = `${antwort.hub}/zugangscodes`;
  render();
  takt();
}

async function waehlen(c) {
  const frisch = await frag({art: 'codes', host});
  const jetzt = frisch.codes?.find((x) => x.id === c.id) ?? c;
  if (!jetzt.code) return;
  await navigator.clipboard.writeText(jetzt.code).catch(() => {});
  let eingetragen = false;
  if (tab?.id) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, {art: 'fuellen', code: jetzt.code});
      eingetragen = Boolean(r?.eingetragen);
    } catch {}
  }
  // Nicht still merken: die Seite bekommt die Frage (content.js liest sie aus dem Speicher).
  if (host && c.treffer < 3) {
    const name = (x) => (x.konto ? `${x.dienst} (${x.konto})` : x.dienst);
    const weitere = (antwort.codes ?? [])
      .filter((x) => x.id !== c.id && x.treffer > 0 && x.treffer < 3 && x.dienst === c.dienst)
      .map((x) => ({id: x.id, name: name(x)}));
    chrome.storage.local.set({frage: {id: c.id, name: name(c), host, bis: Date.now() + 10 * 60_000, weitere}}).catch(() => {});
  }
  $('status').textContent = eingetragen ? 'Eingetragen und kopiert.' : 'Kopiert.';
  if (eingetragen) setTimeout(() => window.close(), 600);
}

// ── Pause ─────────────────────────────────────────────────────────────────
// Dieselbe Regel wie in content.js: aus, bis <Zeit>, oder je Domäne.
function basis(h) {
  const t = h.split('.');
  if (t.length <= 2) return h;
  return t.slice(t.at(-1).length === 2 && t.at(-2).length <= 3 ? -3 : -2).join('.');
}

async function pauseZeigen() {
  const {pause = {}} = await chrome.storage.local.get('pause');
  const stand = $('pause-stand');
  const knopf = $('pause-knopf');
  const hier = host && pause.seiten?.[basis(host)];
  let text = '';
  if (pause.aus) text = 'Ausgeschaltet.';
  else if (pause.bis && pause.bis > Date.now()) text = `Pausiert bis ${new Date(pause.bis).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} Uhr.`;
  else if (hier) text = `Auf ${basis(host)} aus.`;
  stand.textContent = text;
  $('pause').classList.toggle('aktiv', text !== '');
  knopf.textContent = text ? 'Fortsetzen' : 'Pausieren';
  knopf.onclick = text
    ? async () => {
        const naechste = {...pause, aus: false, bis: null};
        if (hier) naechste.seiten = Object.fromEntries(Object.entries(pause.seiten).filter(([k]) => k !== basis(host)));
        await chrome.storage.local.set({pause: naechste});
        $('pause-wahl').hidden = true;
        pauseZeigen();
      }
    : () => {
        $('pause-wahl').hidden = !$('pause-wahl').hidden;
      };
}

for (const b of document.querySelectorAll('#pause-wahl button')) {
  b.onclick = async () => {
    const {pause = {}} = await chrome.storage.local.get('pause');
    const art = b.dataset.pause;
    if (art === 'seite' && host) pause.seiten = {...(pause.seiten ?? {}), [basis(host)]: true};
    if (art === 'stunde') pause.bis = Date.now() + 3600_000;
    if (art === 'morgen') {
      const m = new Date();
      m.setDate(m.getDate() + 1);
      m.setHours(6, 0, 0, 0);
      pause.bis = m.getTime();
    }
    if (art === 'aus') pause.aus = true;
    await chrome.storage.local.set({pause});
    $('pause-wahl').hidden = true;
    pauseZeigen();
  };
}

$('suche').addEventListener('input', render);
$('optionen').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async () => {
  [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  try {
    const u = new URL(tab?.url ?? '');
    if (/^https?:$/.test(u.protocol)) host = u.hostname.replace(/^www\./, '');
  } catch {}
  $('seite').textContent = host;
  await pauseZeigen();
  await laden();
})();
