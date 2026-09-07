// Gemeinsam für Hintergrund, Popup und Einstellungen: wo der Hub steht.
export const HUB_STANDARD = 'https://hub.med-arbeiter.de';

export async function hubUrl() {
  const {hub} = await chrome.storage.sync.get('hub');
  return (hub || HUB_STANDARD).replace(/\/+$/, '');
}
