/**
 * The iPhone app on the App Store (App Store Connect's Apple ID for the
 * app, eas.json submit.production.ios.ascAppId). No React Native here: the
 * server's /config and the web page's <head> (src/app/+html.tsx) use it too.
 */
export const APP_STORE_ID = "6817619381";

/** The App Store page; the server's APP_STORE_URL overrides it in /config. */
export const APP_STORE_URL = `https://apps.apple.com/jp/app/id${APP_STORE_ID}`;

/**
 * Safari's Smart App Banner (`<meta name="apple-itunes-app">`): 「開く」 when
 * the app is installed, else 「入手」. `app-argument` is the page's URL, which
 * the app receives like a universal link (src/app/+native-intent.tsx).
 */
export const SMART_APP_BANNER = `app-id=${APP_STORE_ID}`;

/** The app's URL scheme (app.config.ts `scheme`). */
export const APP_SCHEME = "aisalumni";
