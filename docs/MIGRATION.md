# Moving web and native to this repo

Goal: one Expo codebase for the iOS / Android app **and** the website,
replacing the Next.js site (Kuisin/ais-alumni-app).

## Where things are today

| | Lives in | Notes |
|---|---|---|
| Native app (iOS / Android) | **here** | Expo SDK 57, Expo Router |
| Web app | **here** (ais-alumni.kai-lab.net, staging ais-alumni-dev) | same screens via react-native-web, `web.output: "server"` on Vercel |
| Every page: public (landing, privacy, support, handover, invite), onboarding, member, admin mode | **here** | native screens; the app never opens the old website |
| App API (`/api/mobile/v1`), sign-in (email code, LINE), uploads, files, notifications | **here** (Expo API routes, `src/server/`) | same database; the website's own server actions are reused in `src/server/app/actions` |
| Contract types, UI strings | **here** | |
| Schema + migrations | **here** (`prisma/migrations`, applied by the Vercel build) | baselined as `0_init`; the old website must no longer run migrations |
| Scheduled jobs (`/api/cron`), LINE webhook (`/api/line/webhook`), rich-menu preview, short links in emails / LINE (`/n/…`) | **here**, same paths (`src/server/lib/jobs`, `src/app/n`); still also in ais-alumni-app until the domain moves | the jobs claim tasks in `CronRun` exactly like the website, so both running at once never double-send |
| The website's pages (`/ja`, `/en`, `/app/…`) | **here**: 307 to `/moved?from=<path>` (`src/server/lib/moved.ts`) | |

## Known differences from the website

- Uploads go through the API, so one file is capped at Vercel's 4.5 MB
  request limit (the website allowed 10 MB). Photos are compressed first.
- Google sign-in isn't offered (the website has no Google credentials
  configured either).
- No desktop QR code for LINE linking; no universal / app links yet, so a
  shared https link opens the web app (the app opens `aisalumni://…`).
- The LINE rich-menu image is drawn with satori + resvg (wasm from
  jsdelivr, fonts from Google Fonts) instead of `next/og`.

## Remaining steps

1. **Move the domain.** Point ais.kai-lab.net at this project (or redirect
   it to ais-alumni.kai-lab.net) once the web app has been checked with
   real accounts. Update the LINE Login callback and Official Account
   links, `APP_URL`, and the notification links then.
2. **Switch the backend over** (the routes are here): point the Supabase
   pg_cron job at this domain (`pnpm cron:setup --url …` in the website's
   checkout) and the LINE Messaging API webhook URL at
   `https://<domain>/api/line/webhook`, then retire ais-alumni-app.
   `/n/…` links open this web app's screens (Home when there is none).
3. **Universal / app links** (apple-app-site-association, assetlinks) so
   https links open the installed app.
