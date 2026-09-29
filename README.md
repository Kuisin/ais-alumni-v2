# AIS Alumni — app

The AIS Alumni (AIS同窓会) member app: one [Expo](https://expo.dev) Router codebase for iOS, Android and — as the website moves over (see [docs/MIGRATION.md](docs/MIGRATION.md)) — the web.

The app's API is this repo's own server (Expo API routes, `/api/mobile/v1`; ais-alumni.kai-lab.net, staging ais-alumni-dev.kai-lab.net). The Next.js site in [Kuisin/ais-alumni-app](https://github.com/Kuisin/ais-alumni-app) (ais.kai-lab.net) still owns the schema and migrations, and scheduled jobs; the app no longer opens any of its pages. The API contract types (`src/contract`) and UI strings (`messages/`) are copied from it with `pnpm sync:server`.

## Quick start

```bash
pnpm install
pnpm start          # Expo Go: scan the QR code, or open exp://<your Mac's LAN IP>:8081
```

Without `EXPO_PUBLIC_API_URL` the app uses ais-alumni-dev.kai-lab.net (production data) in development and ais-alumni.kai-lab.net in release builds. Point it at a local server with `EXPO_PUBLIC_API_URL=http://<LAN IP>:3000 pnpm start`.

Push notifications and LINE / Google sign-in need a development build (`npx expo run:ios`) or an EAS build — not Expo Go.

See [AGENTS.md](AGENTS.md) for how the app is put together, conventions, testing (Simulator, Maestro, local push) and releases.
