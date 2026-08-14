import {redirect} from 'next/navigation';

/**
 * The Zeitkonto is the fourth range of "Meine Zeit", not a page of its own.
 * The route stays so links shipped before the ranges were unified keep working.
 */
export default function ZeitkontoRedirect() {
  redirect('/?ansicht=konto');
}
