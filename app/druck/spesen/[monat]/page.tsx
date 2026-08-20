import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {fmtDate, fmtDateMitWochentag, fmtDuration, fmtEuro, fmtMonth, fmtTime} from '@/lib/format';
import {TAG_ART_LABEL} from '@/lib/pauschale';
import {BELEG_ART_LABEL, REISE_STATUS_LABEL, reisenForMonth} from '@/lib/spesen';
import {activeUsers} from '@/lib/time';
import {PrintToolbar} from '@/components/print-toolbar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{monat: string}>;
  searchParams: Promise<{mitarbeiter?: string}>;
}

/**
 * Print-optimierte Reisekostenabrechnung (ein Blatt je Mitarbeiter mit Reisen
 * im Monat; ?mitarbeiter=<id> schränkt auf eine Person ein). „Als PDF
 * speichern" über den Druckdialog des Browsers erzeugt die Abrechnungs-PDF —
 * mit der Tagesherleitung jeder Reise und **allen Belegbildern im Blatt**,
 * damit die Datei allein als Nachweis taugt.
 *
 * Dieselbe Zugangsgrenze wie /druck/[monat] und api/beleg/[id]: das eigene
 * Blatt bekommt jede angemeldete Person, alle Blätter nur, wer Spesen prüft.
 */
export default async function SpesenDruckPage({params, searchParams}: PageProps) {
  const user = await requireUser();
  const {monat} = await params;
  const query = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(monat)) notFound();

  const filterId = query.mitarbeiter ? Number(query.mitarbeiter) : null;
  const istPruefer = hatRecht(user, 'spesen.pruefen');
  if (!istPruefer && filterId !== user.id) notFound();

  const blaetter = activeUsers()
    .filter((u) => filterId === null || u.id === filterId)
    .map((u) => ({user: u, reisen: reisenForMonth(u.id, monat)}))
    // Ohne Filter fällt weg, wer im Monat nicht gereist ist; das gezielt
    // angefragte Blatt bleibt und sagt selbst, dass es leer ist.
    .filter((b) => filterId !== null || b.reisen.length > 0);
  if (blaetter.length === 0 && filterId !== null) notFound();

  return (
    <main style={{background: 'white', color: '#1c1917', fontFamily: 'Figtree, sans-serif'}}>
      <style>{`
        @media print {
          .druck-toolbar { display: none; }
          .druck-blatt { break-after: page; }
          .druck-beleg-bild { break-inside: avoid; }
        }
        .druck-blatt { max-width: 720px; margin: 0 auto; padding: 40px 24px; }
        .druck-tabelle { width: 100%; border-collapse: collapse; font-size: 13px; }
        .druck-tabelle th { text-align: left; font-weight: 600; border-bottom: 2px solid #1c1917; padding: 6px 8px; }
        .druck-tabelle td { border-bottom: 1px solid #d8d2c6; padding: 5px 8px; font-variant-numeric: tabular-nums; }
        .druck-tabelle td.num, .druck-tabelle th.num { text-align: right; }
        .druck-summe td { font-weight: 600; border-top: 2px solid #1c1917; border-bottom: none; }
        .druck-reise { border: 1px solid #d8d2c6; border-radius: 6px; padding: 16px; margin-top: 20px; }
        .druck-beleg-bild { margin: 16px 0 0; }
        .druck-beleg-bild img { max-width: 100%; max-height: 820px; border: 1px solid #d8d2c6; display: block; }
        .druck-beleg-bild figcaption { font-size: 12px; margin-bottom: 4px; }
      `}</style>
      <PrintToolbar />
      {blaetter.map(({user: u, reisen}) => {
        const summe = reisen.reduce((s, r) => s + r.rechnung.summeCent, 0);
        return (
          <section key={u.id} className="druck-blatt">
            <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16}}>
              <div>
                <h1 style={{fontFamily: 'Poppins, sans-serif', fontSize: 20, margin: 0}}>
                  Reisekostenabrechnung – {fmtMonth(monat)}
                </h1>
                <p style={{margin: '4px 0 0', fontSize: 14}}>
                  {u.name} · {reisen.length} {reisen.length === 1 ? 'Reise' : 'Reisen'} ·{' '}
                  {fmtEuro(summe)} erstattungsfähig
                </p>
              </div>
              <p style={{fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 16, margin: 0}}>MedArbeiter</p>
            </header>

            {reisen.length === 0 && <p style={{fontSize: 14}}>Keine Reise in diesem Monat erfasst.</p>}

            {reisen.map(({reise, belege, rechnung, stufe}) => (
              <article key={reise.id} className="druck-reise">
                <h2 style={{fontFamily: 'Poppins, sans-serif', fontSize: 15, margin: 0}}>
                  {reise.zweck}
                  {reise.ziel ? ` – ${reise.ziel}` : ''}
                </h2>
                <p style={{margin: '4px 0 12px', fontSize: 13}}>
                  {fmtDate(reise.start_date)} {fmtTime(reise.start_min)} Uhr bis {fmtDate(reise.end_date)}{' '}
                  {fmtTime(reise.end_min)} Uhr · {REISE_STATUS_LABEL[reise.status]}
                  {reise.entschieden_at ? ` am ${fmtDate(reise.entschieden_at.slice(0, 10))}` : ''} · Sätze{' '}
                  {fmtEuro(stufe.halbCent)} / {fmtEuro(stufe.vollCent)}
                </p>

                <table className="druck-tabelle">
                  <thead>
                    <tr>
                      <th>Reisetag</th>
                      <th>Art</th>
                      <th>Abwesenheit</th>
                      <th className="num">Std.</th>
                      <th>Herleitung</th>
                      <th className="num">Pauschale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rechnung.tage.map((tag) => (
                      <tr key={tag.datum}>
                        <td>{fmtDateMitWochentag(tag.datum)}</td>
                        <td>{TAG_ART_LABEL[tag.art]}</td>
                        <td>
                          {fmtTime(tag.vonMin)}–{fmtTime(tag.bisMin)} Uhr
                        </td>
                        <td className="num">{fmtDuration(tag.abwesenheitMin)}</td>
                        <td>{tag.grund}</td>
                        <td className="num">{fmtEuro(tag.satzCent)}</td>
                      </tr>
                    ))}
                    <tr className="druck-summe">
                      <td colSpan={3}>Pauschale ({rechnung.tage.length}{' '}
                        {rechnung.tage.length === 1 ? 'Reisetag' : 'Reisetage'})</td>
                      <td className="num">{fmtDuration(rechnung.abwesenheitMin)}</td>
                      <td />
                      <td className="num">{fmtEuro(rechnung.pauschaleCent)}</td>
                    </tr>
                  </tbody>
                </table>

                {belege.length > 0 && (
                  <table className="druck-tabelle" style={{marginTop: 16}}>
                    <thead>
                      <tr>
                        <th>Beleg</th>
                        <th>Datum</th>
                        <th>Beschreibung</th>
                        <th>Datei</th>
                        <th className="num">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {belege.map((b, i) => (
                        <tr key={b.id}>
                          <td>
                            {i + 1} – {BELEG_ART_LABEL[b.art]}
                          </td>
                          <td>{fmtDate(b.datum)}</td>
                          <td>{b.beschreibung ?? ''}</td>
                          <td>{b.datei_name ?? (b.datei ? `Beleg ${b.id}` : 'ohne Datei')}</td>
                          <td className="num">{fmtEuro(b.betrag_cent)}</td>
                        </tr>
                      ))}
                      <tr className="druck-summe">
                        <td colSpan={4}>Belege gesamt</td>
                        <td className="num">{fmtEuro(rechnung.belegeCent)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                <p style={{marginTop: 12, fontSize: 14, fontWeight: 600, textAlign: 'right'}}>
                  Summe der Reise: {fmtEuro(rechnung.summeCent)}
                </p>

                {/* Die Belegdateien selbst, damit das gedruckte Blatt der
                    vollständige Nachweis ist. Ein PDF-Beleg lässt sich nicht
                    als Bild einbetten — er wird benannt und bleibt über den
                    Link abrufbar. */}
                {belege
                  .filter((b) => b.datei !== null)
                  .map((b) =>
                    b.datei_typ?.startsWith('image/') ? (
                      <figure key={b.id} className="druck-beleg-bild">
                        <figcaption>
                          Beleg {belege.indexOf(b) + 1} – {BELEG_ART_LABEL[b.art]}, {fmtDate(b.datum)},{' '}
                          {fmtEuro(b.betrag_cent)}
                          {b.datei_name ? ` (${b.datei_name})` : ''}
                        </figcaption>
                        {/* Über denselben Handler wie am Bildschirm — die
                            Datei liegt außerhalb von public/ und bleibt es. */}
                        <img src={`/api/beleg/${b.id}`} alt={`Beleg: ${BELEG_ART_LABEL[b.art]} vom ${fmtDate(b.datum)}`} />
                      </figure>
                    ) : (
                      <p key={b.id} className="druck-beleg-bild" style={{fontSize: 12}}>
                        Beleg {belege.indexOf(b) + 1} – {BELEG_ART_LABEL[b.art]}, {fmtDate(b.datum)},{' '}
                        {fmtEuro(b.betrag_cent)}: liegt als PDF vor (
                        <a href={`/api/beleg/${b.id}`}>{b.datei_name ?? `Beleg ${b.id}`}</a>) und ist der
                        Abrechnung separat beizulegen.
                      </p>
                    ),
                  )}
              </article>
            ))}

            {reisen.length > 0 && (
              <footer style={{marginTop: 48, display: 'flex', gap: 48, fontSize: 12}}>
                <div style={{flex: 1, borderTop: '1px solid #1c1917', paddingTop: 6}}>Datum, Unterschrift Mitarbeiter</div>
                <div style={{flex: 1, borderTop: '1px solid #1c1917', paddingTop: 6}}>Datum, Unterschrift Verwaltung</div>
              </footer>
            )}
          </section>
        );
      })}
    </main>
  );
}
