/*
 * The web app's service worker: notifications only (Web Push — the server's
 * src/server/lib/push/web.ts sends { title, body, data, tag?, badge? }).
 * It caches nothing, so a new deployment is never held back by it.
 * Registered by src/app/+html.tsx; the page side is src/lib/web-push.ts.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

const windows = () =>
  self.clients.matchAll({ type: "window", includeUncontrolled: true });

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Not ours: still show something (browsers require a notification).
  }
  const data =
    payload.data && typeof payload.data === "object" ? payload.data : {};
  event.waitUntil(
    (async () => {
      // The home-screen icon's number.
      if (
        typeof payload.badge === "number" &&
        "setAppBadge" in self.navigator
      ) {
        await (payload.badge > 0
          ? self.navigator.setAppBadge(payload.badge)
          : self.navigator.clearAppBadge()
        ).catch(() => {});
      }
      // Open pages refresh their lists and badges.
      for (const client of await windows())
        client.postMessage({ type: "ais-push-received", data });
      await self.registration.showNotification(payload.title || "AIS同窓会", {
        body: payload.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/notification-badge.png",
        data,
        ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
      });
    })(),
  );
});

// A tap: an open page shows what it's about; otherwise the app opens there.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const client = (await windows()).find((c) => "focus" in c);
      if (client) {
        await client.focus().catch(() => {});
        client.postMessage({ type: "ais-push-open", data });
        return;
      }
      await self.clients.openWindow(
        `/?push=${encodeURIComponent(JSON.stringify(data))}`,
      );
    })(),
  );
});
