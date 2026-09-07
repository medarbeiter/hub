import {HUB_STANDARD, hubUrl} from './hub.js';

const feld = document.getElementById('hub');
hubUrl().then((u) => (feld.value = u));
document.getElementById('speichern').onclick = async () => {
  const wert = feld.value.trim().replace(/\/+$/, '') || HUB_STANDARD;
  try {
    new URL(wert);
  } catch {
    document.getElementById('stand').textContent = 'Das ist keine Adresse.';
    return;
  }
  await chrome.storage.sync.set({hub: wert});
  document.getElementById('stand').textContent = `Gespeichert: ${wert}`;
};
