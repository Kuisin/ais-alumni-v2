# App Store submission (iOS)

The app: **AIS同窓会 / AIS Alumni**, bundle id `net.kailab.aisalumni`,
EAS project `@kaisei0807s/ais-alumni`. Release builds talk to
`https://ais-alumni.kai-lab.net` (eas.json `production`), i.e. this repo's
`main` — merge the release PR first so production has every endpoint.

## Steps (need the Apple Developer account)

1. **App Store Connect → Apps → +**: New app, iOS, name 「AIS同窓会」,
   primary language Japanese, bundle id `net.kailab.aisalumni` (register it
   under Certificates, Identifiers & Profiles if it isn't listed), SKU e.g.
   `ais-alumni`. (`eas submit` can also create it on first run.)
2. **Build**: `npx eas-cli build -p ios --profile production`. Sign in with
   the Apple ID when asked; let EAS create the distribution certificate,
   provisioning profile and the **push notification key** (say yes).
   The build number auto-increments (remote version source).
3. **Upload**: `npx eas-cli submit -p ios --latest`. To skip the prompts
   next time, add `ascAppId` (App Store Connect → App Information → Apple
   ID) and `appleTeamId` under `submit.production.ios` in eas.json.
4. **Listing**: `npx eas-cli metadata:push` uploads `store.config.json`
   (ja + en-US: name, subtitle, description, keywords, URLs, categories).
   `metadata:pull` brings edits made on the website back.
5. **Screenshots** (App Store Connect, per language): iPhone 6.9"
   (1320 × 2868) is required; iPad not needed (`supportsTablet: false`).
   Take them on the iPhone 17 Pro Max simulator with the demo account —
   no real members' names or photos in them.
6. **App Privacy** and **Age Rating**: answers below.
7. **App Review Information**: contact, demo account, notes below. Submit.

## App Privacy ("nutrition label")

Tracking: **No** (no ads, no third-party analytics in the app). Everything
below is **linked to the user**, purpose **App Functionality** only.

| Type | Data |
|---|---|
| Contact Info | Name, Email Address, Phone Number (optional) |
| User Content | Photos or Videos (profile photo, uploads), Emails or Text Messages (chat), Customer Support (お問い合わせ), Other User Content (posts, comments, ID documents for verification) |
| Identifiers | User ID; Device ID (push notification token) |
| Other Data | Date of birth, gender, school and work history, AIS enrolment |

Privacy policy URL: https://ais-alumni.kai-lab.net/privacy

## Age rating

User-generated content and messaging between users: **Yes** (members-only
directory, chat, news comments — with reporting, blocking and committee
moderation). Everything else (violence, gambling, mature themes, web
browsing…): **None / No**. Expected rating: 13+ (or 16+ per Apple's
calculation for messaging).

## App Review Information

- **Sign-in required**: yes. Reviewers can't receive the emailed code, so
  they need a demo account that doesn't depend on email — see "Demo
  account" below; until one exists, review will fail at sign-in.
- **Notes** (paste, adjust):

  > AIS Alumni is the members-only alumni network of Aichi International
  > School, run by the volunteer AIS Alumni Committee. New accounts are
  > reviewed by the committee before they can see the directory, so please
  > use the demo account below, which is already approved.
  > Sign in: under "Sign in with an email code", enter the demo email,
  > then the code given here.
  > Account deletion: Me (photo at the top left) → Settings → Danger zone
  > → Delete account (while registration is under review: "Delete
  > account…" at the bottom of the registration screens).
  > Blocking: a member's profile → menu → "Block…".
  > Reporting: in a chat, Chat info → "Report a problem"; on a member's
  > profile → menu → "Report a problem".
  > Camera: used only by event staff to scan QR tickets at check-in, and to
  > take a photo to upload.

## Things that can cause a rejection

- **Guideline 4.8 (Login Services)**: the app offers LINE sign-in, a
  third-party login. Apple then requires an equivalent privacy-focused
  option — in practice **Sign in with Apple**. Our own email-code sign-in
  may not be accepted as that option. Adding Sign in with Apple needs the
  capability on the App ID, a Services ID + key for the server, and
  `expo-apple-authentication`.
- **Demo account**: see above.
- **Guideline 1.2 (UGC)**: report, block and moderation exist; mention
  them in the notes (done above).
