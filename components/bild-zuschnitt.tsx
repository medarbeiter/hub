'use client';

import {Button, HStack, Slider, Text, VStack} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {zuschnitt} from '@/lib/zuschnitt';

/**
 * Der Zuschnitt vor dem Hochladen. Das Bild steht später überall im Haus als
 * rundes Quadrat (`Avatar` beschneidet mittig), und genau dieser Ausschnitt
 * wird hier gewählt, statt ihn dem Zufall der Bildmitte zu überlassen: bei
 * einem Hochformat traf sie sonst den Hals statt das Gesicht.
 *
 * Geschnitten wird im Browser, nicht auf dem Server: was hochgeht, ist bereits
 * das fertige Quadrat — kein zweites Bildformat in der Ablage, keine
 * Bildbibliothek im Server, und die Datei wird nebenbei klein. Der Server prüft
 * trotzdem weiter Typ und Größe; ein Client ist keine Grenze.
 *
 * Vorschau und Ausgabe rechnen aus demselben `zuschnitt()`, deshalb zeigt das
 * Fenster genau das, was ankommt. Der Mittelpunkt im State bleibt ungeklemmt —
 * geklemmt wird bei jeder Ableitung, sodass ein Herauszoomen den Ausschnitt von
 * selbst wieder ins Bild zieht.
 */
const AUSGABE_KANTE = 512;
const MAX_ZOOM = 4;

export function BildZuschnitt({
  datei,
  isPending,
  onFertig,
}: {
  datei: File;
  isPending: boolean;
  onFertig: (bild: File) => void;
}) {
  const [quelle, setQuelle] = useState<string | null>(null);
  const [mass, setMass] = useState<{breite: number; hoehe: number} | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mitte, setMitte] = useState({x: 0, y: 0});
  const bildRef = useRef<HTMLImageElement>(null);
  const fensterRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(datei);
    setQuelle(url);
    setMass(null);
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [datei]);

  if (!quelle) return null;

  const feld = mass ? zuschnitt(mass.breite, mass.hoehe, zoom, mitte.x, mitte.y) : null;

  const ziehen = (ev: React.PointerEvent) => {
    const fenster = fensterRef.current?.getBoundingClientRect();
    if (!feld || !fenster || ev.buttons !== 1) return;
    const proPixel = feld.seite / fenster.width;
    setMitte({x: feld.x - ev.movementX * proPixel, y: feld.y - ev.movementY * proPixel});
  };

  const schneiden = async () => {
    const bild = bildRef.current;
    if (!bild || !feld) return;
    const kante = Math.min(AUSGABE_KANTE, Math.round(feld.seite));
    const flaeche = document.createElement('canvas');
    flaeche.width = kante;
    flaeche.height = kante;
    const stift = flaeche.getContext('2d');
    if (!stift) return;
    // Weiß hinterlegt, weil die Ausgabe JPEG ist: ein durchsichtiges PNG liefe
    // sonst schwarz aus. (Rohes Weiß statt Token — das hier wird eine
    // Bilddatei, kein Bauteil der Oberfläche.)
    stift.fillStyle = '#ffffff';
    stift.fillRect(0, 0, kante, kante);
    const {seite, x, y} = feld;
    stift.drawImage(bild, x - seite / 2, y - seite / 2, seite, seite, 0, 0, kante, kante);
    const blob = await new Promise<Blob | null>((fertig) => flaeche.toBlob(fertig, 'image/jpeg', 0.9));
    if (!blob) return;
    // Der Name kommt ohnehin nie vom Client (lib/profilbild.ts vergibt eine UUID).
    onFertig(new File([blob], 'profilbild.jpg', {type: 'image/jpeg'}));
  };

  return (
    <VStack gap={1.5}>
      <figure
        ref={fensterRef}
        className="zuschnitt-fenster"
        onPointerDown={(ev) => ev.currentTarget.setPointerCapture(ev.pointerId)}
        onPointerMove={ziehen}
      >
        <img
          ref={bildRef}
          src={quelle}
          alt=""
          draggable={false}
          onLoad={(ev) => {
            const {naturalWidth: breite, naturalHeight: hoehe} = ev.currentTarget;
            setMass({breite, hoehe});
            setMitte({x: breite / 2, y: hoehe / 2});
          }}
          style={
            mass && feld
              ? {
                  inlineSize: `${(mass.breite / feld.seite) * 100}%`,
                  insetInlineStart: `${(0.5 - feld.x / feld.seite) * 100}%`,
                  insetBlockStart: `${(0.5 - feld.y / feld.seite) * 100}%`,
                }
              : {visibility: 'hidden'}
          }
        />
      </figure>

      <Text type="supporting" color="secondary">
        Ziehen verschiebt den Ausschnitt, der Regler vergrößert ihn.
      </Text>

      <Slider
        label="Vergrößerung"
        min={1}
        max={MAX_ZOOM}
        step={0.05}
        value={zoom}
        isDisabled={!mass}
        onChange={((neu: number) => setZoom(neu)) as (wert: number | [number, number]) => void}
        width={240}
      />

      <HStack justify="end">
        <Button
          label="Bild hochladen"
          variant="primary"
          isLoading={isPending}
          isDisabled={!mass}
          onClick={schneiden}
        />
      </HStack>
    </VStack>
  );
}
