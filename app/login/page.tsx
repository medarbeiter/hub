import {redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/auth';
import {LoginForm} from '@/components/login-form';

export const metadata = {title: 'Anmelden – MedArbeiter Zeiterfassung'};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');
  return <LoginForm />;
}
