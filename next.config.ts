import type {NextConfig} from 'next';

const nextConfig = {
  output: 'standalone',
  experimental: {
    /*
     * Server Actions nehmen standardmäßig nur 1 MB an. Das ist weniger als
     * jede der drei Dateien, die diese Anwendung tatsächlich annimmt: Belege
     * und Arbeitsunfähigkeitsbescheinigungen dürfen 10 MB groß sein, ein
     * Profilbild 5 MB — ein Foto aus einem Telefon reißt die Grenze also
     * regelmäßig, und zwar mit einem unverständlichen „Unerwarteter Fehler"
     * statt mit der Meldung, die die Prüfung im Server bereitstellt.
     *
     * 12 MB: die größte erlaubte Datei (10 MB) plus Luft für die übrigen
     * Formularfelder und den Mehraufwand der Kodierung.
     */
    serverActions: {bodySizeLimit: '12mb'},
  },
} satisfies NextConfig;

export default nextConfig;
