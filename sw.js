// Guarda o jogo no aparelho para abrir mesmo sem internet. Ao publicar versão nova, troque a VERSAO.
const VERSAO = "mercadinho-1.8.2";
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icone-192.png", "icone-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.pathname.includes("/baixar/")) return; // página de download e APK não vão pro cache
  if (u.origin === location.origin) {
    // rede primeiro (pega versão nova), cache se estiver sem internet
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSAO).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(VERSAO).then(k => k.put(e.request, c)); return res; })));
  }
});
