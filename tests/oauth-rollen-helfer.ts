/**
 * Die Routen-Handler als benannte Exporte für tests/oauth.test.ts — beide
 * Dateien exportieren `GET`, unter einem Namen geht das nicht.
 */
export {GET as rollenKatalog} from '../app/api/oauth/roles/route';
export {GET as userinfo} from '../app/api/oauth/userinfo/route';
export {KONKRETE_RECHTE} from '../lib/rechte';
