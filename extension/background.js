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

chrome.runtime.onMessage.addListener((nachricht, _absender, antworte) => {
  if (nachricht?.art === 'codes') codes(nachricht.host).then(antworte);
  else if (nachricht?.art === 'seite') seiteMerken(nachricht.id, nachricht.host).then(antworte);
  else return false;
  return true;
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
