/// <reference types="react/canary" />

// `<ViewTransition>` gehört zu den Canary-Funktionen von React. Der App Router
// von Next liefert genau diesen React-Build aus (siehe
// node_modules/next/dist/compiled/react — sowohl der Client- als auch der
// react-server-Build exportieren `ViewTransition`), die installierten
// @types/react halten die Deklaration aber in einer eigenen Datei zurück.
// Diese Zeile holt sie herein; ohne sie kennt TypeScript den Export nicht,
// obwohl er zur Laufzeit da ist.
export {};
