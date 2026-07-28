export function unregisterEventbotServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const eventbotScope = new URL(import.meta.env.BASE_URL, window.location.origin).href;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations
            .filter((registration) => registration.scope === eventbotScope)
            .map((registration) => registration.unregister()),
        ),
      )
      .catch(() => {});
  });
}
