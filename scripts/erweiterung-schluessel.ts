// Erzeugt den Signierschlüssel der Browser-Erweiterung von Hand — für alle,
// die ihn lieber in der Umgebung (ERWEITERUNG_KEY) halten als in der Datei,
// die der Hub sonst beim ersten Aufruf unter data/ selbst anlegt
// (lib/erweiterung.ts). Die Kennung folgt aus dem Schlüssel: einmal gewählt,
// nie mehr wechseln.
import {createPrivateKey} from 'node:crypto';
import {erweiterungId, oeffentlicherSchluessel, schluesselErzeugen} from '../lib/erweiterung';

const b64 = schluesselErzeugen();
const privat = createPrivateKey({key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8'});
console.log(`ERWEITERUNG_KEY=${b64}`);
console.log(`# Kennung der Erweiterung: ${erweiterungId(oeffentlicherSchluessel(privat))}`);
