# App Store assets — AIS同窓会 / AIS Alumni

Everything App Store Connect asks for, ready to paste or upload. Build and
submission steps: [docs/APP_STORE.md](../docs/APP_STORE.md). The listing text
is also in [store.config.json](../store.config.json) (`npx eas-cli metadata:push`
uploads it; keep both in step).

## App

| | |
|---|---|
| Bundle ID | `net.kailab.aisalumni` |
| SKU (suggested) | `ais-alumni` |
| Primary language | Japanese (日本語) · also English (U.S.) |
| Primary / secondary category | Social Networking / Education |
| Price | Free |
| Copyright | 2026 AIS Alumni Committee |
| Devices | iPhone only (no iPad screenshots needed) |
| App icon | [`ios/icon-1024.png`](ios/icon-1024.png) (1024 × 1024, no transparency — already in the build) |

## Screenshots (iPhone 6.9", 1320 × 2868)

Upload in this order (App Store Connect → the version → iPhone 6.9" Display):

- Japanese: [`ios/screenshots/ja/`](ios/screenshots/ja/)
- English (U.S.): [`ios/screenshots/en-US/`](ios/screenshots/en-US/)
- Without headline or frame: [`ios/screenshots/plain/`](ios/screenshots/plain/)
- The same set at 1206 × 2622, for the iPhone 6.1" / 6.3" Display slot when
  App Store Connect asks for it:
  [`ios/screenshots/6.3-inch/`](ios/screenshots/6.3-inch/) (`ja`, `en-US`)

| File | Headline (ja) | Headline (en) | Shows |
|---|---|---|---|
| 1-home | AIS の仲間と、もう一度つながる | Stay connected with the AIS community | Home: upcoming events, latest news, follow requests |
| 2-event | イベントの出欠も受付もアプリで | RSVP and check in with your phone | Event with the member's QR check-in ticket |
| 3-directory | 同級生や先生を名簿から探す | Find classmates and teachers | Member directory search |
| 4-news | 委員会からのニュースをいち早く | News from the alumni committee | A news post with reactions and comments |
| 5-chat | 学年のグループや 1 対 1 でチャット | Chat with your class, or one-to-one | Class group chat |
| 6-me | 公開する情報は自分で決められる | You choose what you share | My profile and account menu |

All names, photos, events, news and messages in them are fictional demo
data (a private test database), never real members. Apple scales the 6.9"
set for smaller iPhones; the 6.3" copies are that set resized
(`sips -z 2622 1206`).

## Header and Search Results (creative assets)

App Store Connect → the version → Product Page Information → Header and
Search Results, per language (iOS 27's product page header and the image
shown in search results; optional — without them search shows screenshots).

| Slot | Japanese | English (U.S.) | Size |
|---|---|---|---|
| Header | [`ios/creative/ja/header.png`](ios/creative/ja/header.png) | [`ios/creative/en-US/header.png`](ios/creative/en-US/header.png) | 3840 × 1646 (21:9) |
| Search Results | [`ios/creative/ja/search-results.png`](ios/creative/ja/search-results.png) | [`ios/creative/en-US/search-results.png`](ios/creative/en-US/search-results.png) | 3840 × 2560 (3:2) |

Rebuilt from the frameless screenshots with
`node scripts/store-creative-assets.mjs`.

## Listing text

### Japanese (日本語)

| Field | Value |
|---|---|
| Name (30) | AIS同窓会 |
| Subtitle (30) | 愛知インターナショナルスクール同窓会 |
| Promotional text (170) | AIS の卒業生・保護者・教職員をつなぐ同窓会アプリ。 |
| Keywords (100) | `AIS,同窓会,愛知インターナショナルスクール,卒業生,名簿,イベント,Alumni,Aichi` |
| Support URL | https://ais-alumni.kai-lab.net/support |
| Marketing URL | https://ais-alumni.kai-lab.net |
| Privacy policy URL | https://ais-alumni.kai-lab.net/privacy |
| What's New | 最初のリリースです。 |

**Description**

```
愛知インターナショナルスクール（AIS）の卒業生・元生徒、保護者、教職員のための同窓会アプリです。AIS同窓会委員会（卒業生による有志の団体）が運営しています。学校の公式サービスではありません。

■ 同級生や先生を探す
会員名簿から検索し、フォローすると連絡先を共有できます。公開する情報は自分で選べます。

■ 同窓会・イベント
ワンタップで出欠を登録。受付では QR コードのチケットを使えます。

■ 委員会からのニュース
AIS同窓会委員会からの最新情報をアプリの通知、LINE またはメールでお届けします。

■ チャット
つながった会員と 1 対 1 やグループで連絡できます。不適切な投稿は通報・ブロックできます。

■ 会員限定
新しいアカウントは、名簿を閲覧できるようになる前に委員会が在籍を確認します。

ログインはメールで届く確認コード、または LINE で行えます。アカウントはアプリの「設定」からいつでも削除できます。
```

### English (U.S.)

| Field | Value |
|---|---|
| Name (30) | AIS Alumni |
| Subtitle (30) | Aichi International School |
| Promotional text (170) | The alumni network of Aichi International School, in your pocket. |
| Keywords (100) | `AIS,alumni,Aichi International School,reunion,directory,classmates,events,school` |
| Support URL | https://ais-alumni.kai-lab.net/support |
| Marketing URL | https://ais-alumni.kai-lab.net |
| Privacy policy URL | https://ais-alumni.kai-lab.net/privacy |
| What's New | First release. |

**Description**

```
The alumni app of Aichi International School (AIS) — for former students, parents, teachers and staff. Run by the AIS Alumni Committee, a volunteer group of AIS graduates; not an official service of the school.

• Find classmates and teachers
Search the member directory and follow people to share contact details. You choose what you share.

• Reunions and events
RSVP in one tap and check in with a QR ticket.

• News from the committee
Updates from the AIS Alumni Committee as app notifications, on LINE or by email.

• Chat
Message the members you're connected with, one-to-one or in groups. Report or block anyone who posts something inappropriate.

• Members only
New accounts are checked by the committee before they can see the directory.

Sign in with a code sent to your email, or with LINE. You can delete your account at any time in Settings.
```

## App Privacy

Data used to track you: **No**. Everything below: **linked to the user**,
purpose **App Functionality**.

| Category | Data types |
|---|---|
| Contact Info | Name · Email Address · Phone Number (optional) |
| User Content | Photos or Videos · Emails or Text Messages (chat) · Customer Support · Other User Content (posts, comments, verification documents) |
| Identifiers | User ID · Device ID (push token) |
| Other Data | Date of birth, gender, school / work history, AIS enrolment |

## Age rating

Messaging and user-generated content: **Yes** (members-only, with report,
block and committee moderation). All other content questions: **None / No**.
Unrestricted web access: **No**.

## App Review information

- Contact: your name, phone and email.
- Sign-in required: **Yes** — a demo account the reviewer can use without
  receiving email is still needed (see docs/APP_STORE.md).
- Notes: see docs/APP_STORE.md ("App Review Information").
