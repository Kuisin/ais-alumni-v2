/**
 * `pnpm demo:check` (also run in CI): parse and cross-check the App Review
 * demo's content (src/server/lib/demo/data/*.json) the way the server does
 * on the demo account's first request — so a bad edit fails here, not in
 * front of the reviewer.
 */
import { demoData } from "../src/server/lib/demo/data";

try {
  const d = demoData();
  console.log(
    `Demo data OK: ${d.members.length} members, ${d.news.length} news posts, ${d.events.length} events, ${d.chats.length} chats, ${d.notifications.length} notifications.`,
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
