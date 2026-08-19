import {describe, expect, test} from 'bun:test';
import {avatarQuelle, personAngabe} from '../lib/avatar';

describe('avatarQuelle', () => {
  test('ohne eigenes Foto steht die Tierfigur', () => {
    expect(avatarQuelle({id: 7, avatar_key: 'adler', avatar_datei: null})).toBe('/avatare/09-adler.png');
  });

  test('ein ersetztes Foto bekommt eine andere Adresse', () => {
    const vorher = avatarQuelle({id: 7, avatar_datei: 'aaaaaaaa-1111-4111-8111-111111111111.jpg'});
    const nachher = avatarQuelle({id: 7, avatar_datei: 'bbbbbbbb-2222-4222-8222-222222222222.jpg'});
    expect(vorher).toStartWith('/api/avatar/7?v=');
    expect(nachher).not.toBe(vorher);
  });

  test('personAngabe trägt dieselbe Adresse weiter', () => {
    const person = personAngabe({id: 7, name: 'Nina', avatar_datei: 'cccccccc-3333-4333-8333-333333333333.png'});
    expect(person.bild).toBe(avatarQuelle({id: 7, avatar_datei: 'cccccccc-3333-4333-8333-333333333333.png'}));
  });
});
