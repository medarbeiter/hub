export const AVATAR_KEYS = [
  'vertrieb-akquise',
  'marketing',
  'geschaeftsfuehrer',
  'mercedes-amg-c-eo',
  'key-account-management',
  'pflegedienst',
  'krankenhaus',
  'headset-calling',
  'adler',
  'buchhaltung-controlling',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const AVATARE: ReadonlyArray<{key: AvatarKey; label: string; bild: string}> = [
  {key: 'vertrieb-akquise', label: 'Vertrieb & Akquise', bild: '/generated-avatars/01-vertrieb-akquise-fuchs.png'},
  {key: 'marketing', label: 'Marketing', bild: '/generated-avatars/02-marketing-pfau.png'},
  {key: 'geschaeftsfuehrer', label: 'Geschäftsführer', bild: '/generated-avatars/03-geschaeftsfuehrer-loewe.png'},
  {key: 'mercedes-amg-c-eo', label: 'Mercedes AMG · C EO', bild: '/generated-avatars/04-mercedes-amg-c-eo-panther.png'},
  {key: 'key-account-management', label: 'Key Account Management', bild: '/generated-avatars/05-key-account-oktopus.png'},
  {key: 'pflegedienst', label: 'Pflegedienst', bild: '/generated-avatars/06-pflegedienst-capybara.png'},
  {key: 'krankenhaus', label: 'Krankenhaus', bild: '/generated-avatars/07-krankenhaus-pinguin.png'},
  {key: 'headset-calling', label: 'Headset & Calling', bild: '/generated-avatars/08-headset-calling-papagei.png'},
  {key: 'adler', label: 'Adler', bild: '/generated-avatars/09-adler.png'},
  {key: 'buchhaltung-controlling', label: 'Buchhaltung & Controlling', bild: '/generated-avatars/10-buchhaltung-controlling-eule.png'},
];

export function istAvatar(value: string): value is AvatarKey {
  return (AVATAR_KEYS as readonly string[]).includes(value);
}

export function avatarLabel(key: AvatarKey): string {
  return AVATARE.find((avatar) => avatar.key === key)?.label ?? 'Vertrieb & Akquise';
}

export function avatarBild(key: AvatarKey): string {
  return AVATARE.find((avatar) => avatar.key === key)?.bild ?? AVATARE[0]!.bild;
}
