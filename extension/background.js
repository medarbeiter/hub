// Der eine Draht zum Hub. Der Inhalt einer Seite spricht nie selbst mit dem
// Hub — er fragt hier, und hier läuft die Anfrage mit der Sitzung, die der
// Browser für den Hub ohnehin trägt (credentials: include; Chrome nimmt
// Erweiterungen mit Host-Berechtigung von SameSite aus). Kein eigenes Token:
// wer am Hub angemeldet ist, sieht seine Codes, wer nicht, sieht nichts.
import {hubUrl} from './hub.js';

async function codes(host) {
  const hub = await hubUrl();
  try {
    const antwort = await fetch(`${hub}/api/zugangscodes?host=${encodeURIComponent(host || '')}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (antwort.status === 403) return {fehler: 'anmelden', hub};
    if (!antwort.ok) return {fehler: 'netz', hub};
    const daten = await antwort.json();
    // Der Uhrversatz zwischen Browser und Server, damit der Ablauf stimmt.
    return {...daten, versatzMs: Date.now() - daten.jetztMs, hub};
  } catch {
    return {fehler: 'netz', hub};
  }
}

async function seiteMerken(id, host) {
  const hub = await hubUrl();
  try {
    const antwort = await fetch(`${hub}/api/zugangscodes`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id, host}),
    });
    return antwort.ok ? {ok: true} : {fehler: await antwort.text()};
  } catch {
    return {fehler: 'netz'};
  }
}

// Ein Bild von einer Einrichtungsseite: steckt ein otpauth-Link darin? Der
// Inhalt schickt Daten-URLs (selbst gerastert) oder die Adresse eines fremden
// Bildes, das nur von hier aus – mit Host-Berechtigung – geladen werden kann.
// jsQR kommt erst, wenn das erste Bild kommt: die meisten Seiten haben keins.
let jsQR = null;
async function qrLesen(bild) {
  try {
    const bitmap = await createImageBitmap(await (await fetch(bild)).blob());
    const mass = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * mass);
    const h = Math.round(bitmap.height * mass);
    const leinwand = new OffscreenCanvas(w, h);
    const stift = leinwand.getContext('2d', {willReadFrequently: true});
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, w, h);
    stift.drawImage(bitmap, 0, 0, w, h);
    const daten = stift.getImageData(0, 0, w, h);
    jsQR ??= (await import('./jsqr.js')).default;
    const text = jsQR(daten.data, w, h)?.data ?? '';
    return {otpauth: /^otpauth:\/\//i.test(text) ? text : null};
  } catch {
    return {otpauth: null};
  }
}

async function zugangAnlegen({otpauth, secret, dienst, konto, host}) {
  const hub = await hubUrl();
  try {
    const antwort = await fetch(`${hub}/api/zugangscodes`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({otpauth, secret, dienst, konto, host}),
    });
    return antwort.ok ? await antwort.json() : {fehler: await antwort.text()};
  } catch {
    return {fehler: 'Der Hub ist nicht erreichbar.'};
  }
}

chrome.runtime.onMessage.addListener((nachricht, _absender, antworte) => {
  if (nachricht?.art === 'codes') codes(nachricht.host).then(antworte);
  else if (nachricht?.art === 'seite') seiteMerken(nachricht.id, nachricht.host).then(antworte);
  else if (nachricht?.art === 'qr') qrLesen(nachricht.bild).then(antworte);
  else if (nachricht?.art === 'anlegen') zugangAnlegen(nachricht).then(antworte);
  else return false;
  return true;
});

// Anmelden oder Abmelden am Hub – in irgendeinem Tab – sagt es jeder Seite:
// die Auswahl am Feld muss nicht neu geladen werden, sie fragt einfach neu.
// Das Sitzungs-Cookie wird nur beim Anmelden gesetzt und beim Abmelden
// gelöscht, also ist jede Änderung daran genau dieses Ereignis.
chrome.cookies.onChanged.addListener(({cookie}) => {
  if (cookie.name !== 'medarbeiter_session') return;
  chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) if (t.id) chrome.tabs.sendMessage(t.id, {art: 'sitzung'}).catch(() => {});
  });
});

// ── Aktuell bleiben ────────────────────────────────────────────────────────
// Über die Richtlinie installiert, fragt Chrome die update_url des Hubs alle
// paar Stunden von selbst. Beim Start und einmal am Tag bitten wir ausdrücklich
// darum, und eine gefundene Version wird sofort geladen statt erst beim
// nächsten Browserstart.
const pruefen = () => chrome.runtime.requestUpdateCheck?.().catch(() => {});
chrome.runtime.onStartup.addListener(pruefen);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('update', {periodInMinutes: 24 * 60});
  pruefen();
});
chrome.alarms.onAlarm.addListener((a) => a.name === 'update' && pruefen());
chrome.runtime.onUpdateAvailable.addListener(() => chrome.runtime.reload());

// Die Seite /erweiterung im Hub fragt: bist du da, welche Version? Nur
// Herkünfte aus externally_connectable im Manifest kommen hier überhaupt an.
chrome.runtime.onMessageExternal.addListener((n, _a, antworte) => {
  if (n?.art === 'da') antworte({version: chrome.runtime.getManifest().version});
});
