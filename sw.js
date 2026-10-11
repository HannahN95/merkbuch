// Merkbuch: hält die App offline verfügbar und holt Updates, sobald Internet da ist.
// Die Daten der App (Personen, Notizen, Bilder) liegen NICHT hier, sondern im Speicher des Browsers und bleiben bei Updates unberührt.
const CACHE = "merkbuch-app-1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Eigene Dateien: zuerst das Netz (damit Updates sofort ankommen), ohne Netz oder nach 4 Sekunden die gespeicherte Fassung.
function networkFirst(request) {
  return caches.open(CACHE).then((cache) => {
    const fromNet = fetch(request, { cache: "no-cache" }).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    });
    const fromCache = () => cache.match(request, { ignoreSearch: true }).then((hit) => hit || cache.match("./index.html"));
    const slow = new Promise((resolve) => setTimeout(resolve, 4000)).then(fromCache).then((hit) => hit || fromNet);
    return Promise.race([fromNet.catch(fromCache), slow]);
  });
}
// Fremde Dateien (Schrift): gespeicherte Fassung sofort, im Hintergrund auffrischen.
function cacheFirst(request) {
  return caches.open(CACHE).then((cache) => cache.match(request).then((hit) => {
    const fresh = fetch(request).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()); return res; });
    return hit || fresh;
  }));
}
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(cacheFirst(req));
});
