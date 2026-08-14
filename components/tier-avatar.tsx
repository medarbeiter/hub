import Image from 'next/image';
import type {AvatarKey} from '@/lib/avatar';
import {avatarBild} from '@/lib/avatar';

export function TierAvatar({
  avatar,
  gross = false,
}: {
  avatar: AvatarKey;
  gross?: boolean;
}) {
  return (
    <Image
      aria-hidden
      alt=""
      className="tieravatar"
      data-gross={gross ? 'true' : 'false'}
      src={avatarBild(avatar)}
      width={1254}
      height={1254}
      sizes={gross ? '64px' : '28px'}
    />
  );
}
