import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";
import type { PropsWithChildren } from "react";

/** Registers public/sw.js (notifications; it caches nothing). */
const REGISTER_SW = `if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });`;

/**
 * The web app's HTML (web only, rendered on the server): Expo Router's
 * default document plus what makes it installable to the home screen —
 * the manifest (public/manifest.webmanifest), its colors and icon — and
 * the service worker that shows notifications.
 */
export default function Root({ children }: PropsWithChildren) {
  // What the renderer adds (SDK 58): metadata and CSS in <head>, and the
  // JavaScript bundles — without them the page never becomes the app.
  const { htmlAttributes, headNodes, bodyAttributes, bodyNodes } =
    useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant */}
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
