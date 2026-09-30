# Demo account content

What the App Review demo account sees in the app. Everything here is
**fictional**: never put real members' names, photos or messages in these
files, and use only `@example.com` email addresses.

このフォルダは App Review 用デモアカウントに表示する架空のデータです。実在の会員の情報は絶対に入れないでください。

Edit the JSON, then run **`pnpm demo:check`** before committing (CI runs
it too, on every push and pull request). It checks every file
(`../data.ts`): a typo, a missing field or an unknown id fails with a
message naming the file and field, e.g.
`data/news.json[1].posted.hoursAgo: Invalid input: expected number`.

The server checks the files the same way on the demo account's first
request; if they are broken, only the demo account gets an error
(`demo_data`) — other members are never affected.

## Files

| File | What it is |
| --- | --- |
| `me.json` | The demo user ("Reviewer App"): name, class, bio, education and work, tab badges, the signed-in device, the Home checklist |
| `members.json` | The other (fictional) members: names, role, class, bio, history, follower counts |
| `follows.json` | Who the demo user follows (`iFollow`), who follows them (`followMe`), and pending requests both ways |
| `news.json` | News posts, with reactions, comments, polls and date polls |
| `messages.json` | Messages sent to the demo user (News → messages) |
| `events.json` | Events and the demo user's reply (`myAnswer`) |
| `chats.json` | Chats and their messages |
| `notifications.json` | The notification list |
| `invites.json` | Invitations the demo user sent |
| `family.json` | The family page |
| `orgs.json` | Schools and companies (the history editor's search, and `me.json`'s history) |
| `school.json` | The class (学年) list: the latest class number, and the year Class 1 graduated |

## Ids

- Every item has an `id`; keep them unique within a file and don't rename
  them (links in notifications, e.g. `/app/news/demo-news-reunion`, use them).
- Members are referred to by their `id` from `members.json` (chat members
  and senders, comment authors, poll answers, follows, invites…). `"me"`
  means the demo user (in `from`, `authorId` and poll `answers`).
- Schools and companies in `me.json` refer to `orgs.json` ids.

## Times (always relative to now)

Dates are never written out, so the demo never goes stale.

- **In the past** — `{ "daysAgo": 2, "hoursAgo": 3, "minutesAgo": 10 }`
  (any of the three, added up). Used by `posted`, `sent`, `requested`,
  `created`, `confirmedByMe`, `signedIn`.
- **On a day, at a time (Japan time)** — `{ "inDays": 30, "time": "18:00" }`
  (`inDays` negative = in the past). Used by `starts`, `ends`,
  `rsvpCloses`, `checkedIn`, `deadline`.

An event is listed under "Past" once its `ends` (or `starts`) has passed.

## Text

`body` may be one string or a list of lines (joined with line breaks).
News and event bodies are Markdown (`**bold**`, `- lists`).
