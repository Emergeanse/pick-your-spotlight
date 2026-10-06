/*
 * Notifications sur le téléphone — chargé par le service worker de Pick
 * (vite.config.ts, workbox.importScripts).
 *
 * Le serveur (fonction send-push) envoie { title, body, url, tag }. On
 * l'affiche, et un appui ouvre la page concernée : dans une fenêtre de Pick
 * déjà ouverte s'il y en a une, sinon dans une nouvelle.
 */
self.addEventListener("push", (event) => {
  let contenu = {};
  try {
    contenu = event.data ? event.data.json() : {};
  } catch {
    contenu = { body: event.data ? event.data.text() : "" };
  }

  const titre = contenu.title || "Pick";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: contenu.body || "",
      icon: "/icons/pick-logo-192.png",
      badge: "/icons/pick-logo-192.png",
      tag: contenu.tag,
      renotify: Boolean(contenu.tag),
      data: { url: contenu.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL((event.notification.data && event.notification.data.url) || "/app", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if (new URL(fenetre.url).origin === self.location.origin && "focus" in fenetre) {
          return fenetre.navigate(cible).then((f) => (f || fenetre).focus());
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
