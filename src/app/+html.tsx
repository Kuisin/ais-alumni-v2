import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";
import type { PropsWithChildren } from "react";
import { SMART_APP_BANNER } from "@/lib/app-store";

/** Registers public/sw.js (notifications; it caches nothing). */
const REGISTER_SW = `if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });`;

/**
 * Safari's Smart App Banner, with this page as its `app-argument`: 「開く」
 * then opens the same screen in the app. Written while <head> is parsed, so
 * Safari reads the tag complete. Not on pages the app sends back to the
 * browser (donations) or that are about getting the app.
 */
const SMART_APP_BANNER_TAG = `(function () { if (/^\\/(donate|install|moved)(\\/|$)/.test(location.pathname)) return; var c = ${JSON.stringify(SMART_APP_BANNER)} + ", app-argument=" + location.href; document.write('<meta name="apple-itunes-app" content="' + c.replace(/"/g, "&quot;").replace(/</g, "&lt;") + '">'); })();`;

/**
 * The web app's HTML (web only, rendered on the server): Expo Router's
 * default document plus what makes it installable to the home screen —
 * the manifest (public/manifest.webmanifest), its colors and icon — the
 * service worker that shows notifications, and Safari's banner for the
 * iPhone app on the App Store (src/lib/app-store.ts).
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
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant */}
        <script dangerouslySetInnerHTML={{ __html: SMART_APP_BANNER_TAG }} />
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
