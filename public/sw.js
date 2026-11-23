// Service worker do KAMIFY: dados sempre da rede; só guarda arquivos estáticos e uma tela offline.
const CACHE = "kamify-v3";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png", "/icons/apple-touch-icon.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // nunca cachear dados

  // páginas: rede primeiro; sem internet, mostra a tela offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // arquivos estáticos com hash do Next e ícones: cache primeiro
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return res;
          }),
      ),
    );
  }
});

// ---- notificações (PIX para recuperar) ----
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "KAMIFY", body: e.data ? e.data.text() : "" }; }
  const tarefas = [
    self.registration.showNotification(d.title || "KAMIFY", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || "kamify",
      renotify: true,
      data: { url: d.url || "/painel/vendas/recuperacao" },
    }),
  ];
  if (typeof d.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tarefas.push(self.navigator.setAppBadge(d.badge).catch(() => {}));
  }
  e.waitUntil(Promise.all(tarefas));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/painel/vendas/recuperacao";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
