// Minimal service worker: no offline caching yet, just registered so the
// browser considers the app installable. A real caching strategy is a
// later concern once there's actual content worth caching offline.
self.addEventListener("fetch", () => {});
