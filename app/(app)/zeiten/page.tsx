import {redirect} from 'next/navigation';

interface PageProps {
  searchParams: Promise<{monat?: string; tag?: string}>;
}

/** "Meine Zeiten" lives on / now (Monat view); old deep links keep working. */
export default async function ZeitenRedirect({searchParams}: PageProps) {
  const params = await searchParams;
  const search = new URLSearchParams({ansicht: 'monat'});
  if (params.monat) search.set('monat', params.monat);
  if (params.tag) search.set('tag', params.tag);
  redirect(`/?${search.toString()}`);
}
