import Image from 'next/image';
import type {AvatarKey} from '@/lib/avatar';
import {avatarBild} from '@/lib/avatar';

/**
 * Das Profilzeichen einer Person: das eigene Foto, wenn eines hochgeladen ist,
 * sonst die Tierfigur aus dem lokalen Bildbogen. Der Rückfall ist der Grund,
 * warum `avatarKey` weiterhin verlangt wird — ein Konto steht nie ohne Zeichen
 * da, auch nicht direkt nach dem Entfernen eines Bildes.
 */
export function TierAvatar({
  avatar,
  eigenesBild = false,
  userId,
  gross = false,
}: {
  avatar: AvatarKey;
  /** Ob für diese Person ein eigenes Foto hinterlegt ist. */
  eigenesBild?: boolean;
  /** Nur nötig, wenn ein eigenes Foto geladen werden soll. */
  userId?: number;
  gross?: boolean;
}) {
  const foto = eigenesBild && userId !== undefined;
  return (
    <Image
      aria-hidden
      alt=""
      className="tieravatar"
      data-gross={gross ? 'true' : 'false'}
      src={foto ? `/api/avatar/${userId}` : avatarBild(avatar)}
      width={1254}
      height={1254}
      sizes={gross ? '64px' : '28px'}
      /* Ein hochgeladenes Bild kommt aus einem Route Handler, nicht aus dem
         Bildbogen: next/image dürfte es nicht optimieren (der Optimierer holt
         die URL ohne die Sitzung und bekäme 403). */
      unoptimized={foto}
    />
  );
}
