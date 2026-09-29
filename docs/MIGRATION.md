# Moving web and native to this repo

Goal: one Expo codebase for the iOS / Android app **and** the website,
replacing the Next.js site's pages.

## Where things are today

| | Lives in | Notes |
|---|---|---|
| Native app | **here** (moved from ais-alumni-app `mobile/`) | Expo SDK 57, Expo Router |
| App API (`/api/mobile/v1`), LINE sign-in, notifications | **here** (Expo API routes, `src/server/`) | same database |
| Schema + migrations, scheduled jobs, LINE webhook, files | ais-alumni-app (Next.js) | Prisma, Supabase, Vercel |
| Website pages (public, member, admin) | ais-alumni-app (Next.js) | the app opens the ones it lacks in a web view |
| Contract types, UI strings | server, copied here | `pnpm sync:server` |

## Steps

1. **Native from here** (now). App changes happen in this repo; EAS
   project and builds from here. Remove `mobile/` from ais-alumni-app,
   leaving a pointer to this repo.
2. **Web build of the member area.** The screens already run on web
   (react-native-web). Still needed:
   - a web sign-in (bearer token in storage, or a cookie session);
   - native versions of what the app now opens in a web view (onboarding
     forms, settings sections, admin tools), or links to the old site for
     now;
   - static rendering for the public pages (landing, privacy) for search
     and link previews (`web.output: "static"`);
   - hosting (EAS Hosting or Vercel) and moving ais.kai-lab.net over.
3. **Backend.** Either keep ais-alumni-app as an API-only service (drop
   its pages), or move the API into this repo as Expo Router API routes
   (Prisma, Auth.js replacement, cron, LINE webhook, email, uploads).
   Recommended: keep the Next.js API first. It is proven and the database
   rules live there. Move it later if one deployment matters.

## Open decisions

- Backend: API-only Next.js (recommended first) vs. Expo API routes.
- Web hosting: EAS Hosting vs. Vercel.
- Admin tools: rebuilt here, or kept on the old site during the move.
