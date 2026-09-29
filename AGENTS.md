# AIS Alumni — app (Expo: iOS, Android, web)

The AIS Alumni app, one Expo Router codebase for iOS, Android and the web
— and its own backend: the JSON API under `/api/mobile/v1` is Expo API
routes here (`src/app/api/mobile/v1/**/index+api.ts`, server code in
`src/server/`), deployed with the web app on Vercel (`web.output:
"server"`, `api/index.ts`). It shares the database with the website in
[Kuisin/ais-alumni-app](https://github.com/Kuisin/ais-alumni-app) ("the
server"/"the website" below), which still owns the schema and migrations,
stored files and scheduled jobs. The app never opens the website: what it
doesn't have natively yet (registration forms, profile editing, the rest of
settings, family/invites/vouching, creating news and events, check-in,
admin mode) is left out until it is built here. Tokens live in the shared database, so either
side accepts them.

`src/server/` came from the website's `src/lib` (Next.js APIs such as
`headers()` resolve to stand-ins in `src/server/shims`, see
metro.config.js). It is now this repo's copy: change it here. LINE sign-in
is implemented directly (`src/server/lib/mobile/oauth.ts`); the LINE Login
channel needs the callback
`https://<domain>/api/mobile/v1/auth/oauth/callback/line`.

Shared with the server, copied here: the API contract types
(`src/contract`, from the server's `src/lib/mobile/contract`) and the UI
strings the app uses (`messages/<locale>/<namespace>.json`). The server is
the source of truth for both — change them there, then `pnpm sync:server`
(SERVER_DIR: your checkout of the server, default `../ais-alumni-app`;
`--check` only reports differences).

## Expo has changed — do not trust your training data

This is Expo SDK 57 (React Native 0.86, React 19.2, Expo Router 57). APIs
you remember may be renamed, moved or removed. Before using an Expo, EAS or
React Native API, fetch the docs: https://docs.expo.dev/llms.txt (index;
append `.md` to any docs URL). Router notes that matter here:

- Import navigation from `expo-router` (`expo-router/react-navigation` for
  React Navigation APIs) — never from `@react-navigation/*`.
- Use `useRouter()` and complete hrefs; no `initialRouteName` (use
  `unstable_settings.anchor`); declare every tab in the tabs layout.
- Install packages with `pnpm expo install <pkg>` (SDK-compatible versions).
  Prefer packages available in Expo Go.

## Commands

```bash
pnpm install
pnpm start                 # Metro for Expo Go (`expo start --go`)
pnpm start:dev-client      # Metro for a development build (eas.json "development")
pnpm ios                   # Expo Go in the iOS Simulator (needs Xcode)
pnpm typecheck             # tsc --noEmit
pnpm lint                  # Biome
npx expo export --platform ios --output-dir /tmp/x   # bundle check
pnpm icons                 # regenerate the app and web icons from the logo
pnpm sync:server           # contract types + strings from the server checkout
```

`expo-dev-client` is installed (for development builds), so a bare
`expo start` serves a development-build bundle — Expo Go then fails with
"Cannot find native module …". Use `pnpm start` (`--go`) for Expo Go.

Point the app at a server with `EXPO_PUBLIC_API_URL`. Without it, Metro
(Expo Go, development builds) uses this repo's staging server
ais-alumni-dev.kai-lab.net — which shares the production database — and
release builds production, ais-alumni.kai-lab.net (`src/lib/config.ts`;
eas.json sets the same per profile). For a local website:
`EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000 pnpm start`. A phone on the
same Wi-Fi opens `exp://<Mac's LAN IP>:8081` in Expo Go; without an EAS
project id in the config Expo Go needs no sign-in (with one, run
`npx expo login` first).

## How it fits together

- **Sign-in** (`src/lib/auth.tsx`, `src/app/sign-in.tsx`): email code
  (`/auth/email/request` → `/auth/email/verify`), or Google / LINE through
  the system browser with PKCE (`/auth/oauth/start` → Auth.js → `/finish` →
  `aisalumni://auth?code=…` → `/auth/oauth/exchange`). The result is a
  bearer token (keychain, `expo-secure-store`); the server stores only its
  hash (`MobileSession`). `getCurrentUser()` on the server accepts it, so all
  existing authorization code applies unchanged. The mobile API accepts
  only this header, never the website's cookie (no CSRF); each Google /
  LINE code works once, and `finish` only answers a sign-in `start` began in
  the same browser.
- **Account state** (`GET /me`): not-yet-approved accounts see
  `src/app/onboarding.tsx` (where the application stands); ACTIVE members
  get the tabs under `src/app/(member)`.
- **Links** (`src/lib/links.ts`): website paths and URLs in content and
  notifications map to the matching app screen (`hrefFor`); ones without
  one are left out, never opened in a browser or web view.
- **Realtime** (`src/lib/realtime.tsx`): the website's signal-only Supabase
  Broadcast channels; topics come from `/me` (and room responses).
- **Notifications** (`src/lib/push-core.ts`, `src/lib/push.tsx`; server:
  `src/lib/push`, `docs/notifications.md`): with notifications on,
  the device's Expo push token is registered (`PUT /push`) and the server
  sends every notification there instead of LINE / email. push-core runs
  without React (imported first by the root layout): it keeps a chat's
  banner quiet while that chat is open, runs the quick actions (chat reply /
  mark read, follow request accept / decline) and queues taps until the app
  can navigate. push.tsx registers the token, names the Android channels and
  actions, opens tapped notifications (recording the read receipt) and keeps
  the icon badge equal to the tab bar's. The お知らせ list is
  `src/app/(member)/notifications.tsx`; settings, the Home prompt and chat
  levels are in `src/features/notifications`. Push needs a development or
  store build — Expo Go can't receive it.
- **Strings** (`src/lib/i18n.tsx`): the website's `messages/<locale>/*.json`
  (synced) through use-intl (next-intl's core), so both say the same thing.
  App-only strings: `messages/<locale>/mobile.json` (also kept in the
  server, like the rest).

## Conventions

**Server (in Kuisin/ais-alumni-app)**

- One route file per endpoint: `src/app/api/mobile/v1/<feature>/…/route.ts`,
  wrapped in `mobileRoute()` (`src/lib/mobile/http.ts`) — it resolves the
  member, requires ACTIVE by default, and maps errors to `{ error: code }`.
  Throw `ApiError(status, code)` / `notFound()` / `invalid()`; parse bodies
  with `readJson(request, zodSchema)`.
- Loaders and mutations in `src/lib/mobile/<feature>.ts`. Reuse the website's
  lib code for every access and visibility rule (`src/lib/authz`,
  `news-visibility`, `photoFor`, the server actions' checks…) — never write a
  second version of a rule. Calling a server action from a route is fine
  (it sees the bearer session); build its `FormData` / arguments as the form
  would.
- Response types in `src/lib/mobile/contract/<feature>.ts`: pure types, no
  imports (the app imports them type-only as `@contract/<feature>`, synced
  to `src/contract`). Change them additively — installed apps update
  slowly.
- Server-composed text (sender labels, localized titles) uses the member's
  locale (`ctx.locale`). The app sends `X-NEXT-INTL-LOCALE`, so implicit
  `getTranslations()` calls match too.

**App**

- Screens: tabs in `src/app/(member)/(tabs)/<tab>.tsx`; pushed screens in
  `src/app/(member)/<feature>/…`. Set titles with
  `<Stack.Screen options={{ title }} />`. Keep `src/lib/links.ts` in step.
- Feature code in `src/features/<feature>/` (components, `api.ts` hooks).
  Shared primitives in `src/ui` (`Text`, `Button`, `Card`, `ListRow`,
  `Screen`, `QueryState`, `Markdown`, …) — use them; always `Text` from
  `@/ui`, theme tokens instead of literal colors, 44 pt touch targets,
  accessibility roles and labels. Icons: `lucide-react-native` (same set as
  the website).
- Data: TanStack Query. Keys start with the feature: `["news", …]`,
  `["events", …]`, `["chat", "list"]`, `["chat", "room", id]`,
  `["directory", …]`, `["members", id]`, `["follows"]`, `["home"]`,
  `["settings"]`; `ME_KEY` (`["me"]`) holds the account and badges —
  invalidate it after anything that changes a badge.
- Dates: `formatDateTime` / `formatDate` from `@/lib/format` (Japan time,
  like the website).
- Website-only screens: `router.push(webHref("/app/…"))`; website paths in
  general: `hrefFor(path)` (native screen if there is one).

## Testing locally (no simulator needed)

1. Server: `pnpm dev -p 3187` in your server checkout, with a local database.
2. App (web build, for screenshots): `EXPO_PUBLIC_API_URL=http://localhost:3187 npx expo start --web --port 8087`.
3. A session token for a local member: `pnpm exec tsx --env-file=.env scripts/mobile-dev-token.ts hanako@example.com` (in the server checkout; refuses non-local databases) — for `curl -H "Authorization: Bearer …" localhost:3187/api/mobile/v1/me`.
4. Screenshot a screen signed in: `node scripts/preview.mjs --email hanako@example.com --path /news --out /tmp/news.png` (`--click`, `--fill "selector=>value"`, `--full`, `--signed-out`; uses SERVER_DIR for tokens and playwright-core's Chromium).

The web build runs with web security off; check native-only behavior
(sign-in with LINE / Google, keychain) in Expo Go or a development build.

## Testing on the iOS Simulator (Xcode)

```bash
UDID=$(scripts/sim-setup.sh)      # simulator + Expo Go, prompts pre-approved
EXPO_PUBLIC_API_URL=http://localhost:3187 pnpm start   # Expo Go mode, :8081
xcrun simctl openurl $UDID exp://127.0.0.1:8081
```

UI automation with [Maestro](https://maestro.dev) (needs Java 17+):
`UDID=$UDID APP_URL=exp://127.0.0.1:8081 maestro/signin.sh hanako@example.com`
signs in through the UI (code from the server's local dev mailbox,
SERVER_DIR), then
`maestro --device $UDID test -e APP_ID=host.exp.Exponent -e APP_URL=exp://127.0.0.1:8081 maestro/tour.yaml`
visits every tab. Selectors: tabs are "Name, tab, n of 5" (マイページ is the header's top-left photo, "Me…");
cards are one pressable (match `.*title.*`); the header back button has id
`BackButton`; Maestro's `back` is Android-only.

**Development build** (native modules, push notifications, LINE / Google
sign-in): `npx expo run:ios` (needs CocoaPods). `plugins/` fixes the
generated project for Xcode 27 (the UIScene life cycle iOS 27 requires) and
for folders whose path has spaces. Then `pnpm start:dev-client` and open the
app from its icon, or pick the server in its launcher. Maestro against it:
add `APP_ID=net.kailab.aisalumni` and
`APP_URL="aisalumni://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"`.

**Push notifications locally**: run the server with `EXPO_PUSH_OUTBOX=1`,
which writes pushes to its `.data/dev-push/` and accepts the development
tokens a build without an EAS project registers, then
`UDID=$UDID node scripts/sim-push.mjs` delivers them to the
Simulator as APNs would (taps, badges, categories). Turn notifications on in
the app (Home card or 設定 → アプリの通知) and send a test from settings.

Things only a native run shows (all hit while building this): Hermes has no
`Intl.PluralRules` (polyfilled in src/lib/intl-polyfills.ts — without it
plural messages show their key), keyboards covering buttons, and Expo Go
failing on development-build bundles.

## Builds and release (EAS)

`eas.json` has `development` (dev client, ais-alumni-dev), `preview`
(internal, ais-alumni-dev) and `production` (ais-alumni.kai-lab.net)
profiles — this repo's own server. First time:
`npx eas-cli@latest init` (adds the project id), then
`npx eas-cli@latest build --profile preview --platform all`.
Google / LINE sign-in need the `aisalumni://` scheme, so they work in
development / preview / production builds, not in Expo Go against a
deployed server (Expo Go works with email codes, or with a local server).

Push notifications need the EAS project id (`EAS_PROJECT_ID`, or paste it
into app.config.ts) and credentials: `npx eas-cli@latest credentials` sets up
the APNs key (paid Apple Developer account) and the FCM v1 service account
(Firebase project, for Android). If "enhanced push security" is on, set
`EXPO_ACCESS_TOKEN` on the server (Vercel env).
