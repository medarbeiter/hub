import {redirect} from 'next/navigation';
export const metadata = {title: 'Zugang – MedArbeiter Hub'};

export default async function EinrichtungPage() {
  redirect('/login');
}
