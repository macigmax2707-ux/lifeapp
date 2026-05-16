const CACHE = "lifeapp-v1";
const ASSETS = ["/", "/index.html"];

// Install
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Fetch – network first, fallback to cache
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── ALARM SCHEDULER ──────────────────────────────────
// The main app posts messages here to schedule alarms
const scheduledAlarms = new Map();

self.addEventListener("message", e => {
  if (e.data?.type === "SCHEDULE_ALARMS") {
    // Clear old alarms
    scheduledAlarms.forEach(id => clearTimeout(id));
    scheduledAlarms.clear();

    const todos = e.data.todos || [];
    const now = new Date();

    todos.forEach(todo => {
      if (todo.done || !todo.notif || !todo.time) return;

      const [h, m] = todo.time.split(":").map(Number);
      const alarmTime = new Date();
      alarmTime.setHours(h, m, 0, 0);

      // If time already passed today, skip
      const diff = alarmTime - now;
      if (diff <= 0) return;

      const timeoutId = setTimeout(() => {
        self.registration.showNotification("⏰ Aufgabe fällig!", {
          body: todo.text + (todo.duration ? ` · ${todo.duration} Min geplant` : ""),
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `todo-${todo.id}`,
          data: { todoId: todo.id },
          actions: [
            { action: "done", title: "✓ Erledigt" },
            { action: "later", title: "Später" }
          ],
          requireInteraction: true,
        });
      }, diff);

      scheduledAlarms.set(todo.id, timeoutId);
    });
  }
});

// Handle notification click
self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "done") {
    // Post message to app
    self.clients.matchAll({ type: "window" }).then(clients => {
      clients.forEach(c => c.postMessage({
        type: "COMPLETE_TODO",
        todoId: e.notification.data?.todoId
      }));
    });
  }
  // Open app on click
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/");
    })
  );
});
