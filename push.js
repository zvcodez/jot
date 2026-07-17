// Real Web Push: makes reminders fire even when the app/browser is fully
// closed or the phone is locked, unlike the local setTimeout in index.html
// which only fires reliably while the tab is foregrounded (iOS throttles
// backgrounded timers to ~once/minute, and suspends them entirely once the
// tab is fully backgrounded/screen-locked for a while).
(() => {
  const API_BASE = 'https://jot-push.vercel.app';
  const VAPID_PUBLIC_KEY = 'BEl7DFtR_-HZixj8PozLH3G_43FDpyt85sIVzs80HsG8CQm96tjLxuZ6kX8ErSUg_9KURFPtQk0Yxpew6qbdxtg';
  const JOT_API_TOKEN = 'Hxt8LL1yPouhPvdt_mv5aUk3_E3RT86n';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function post(path, body) {
    try {
      await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Jot-Token': JOT_API_TOKEN },
        body: JSON.stringify(body),
      });
    } catch {
      // Offline or backend unreachable — local timer still covers the foregrounded case.
    }
  }

  let subscribed = false;
  async function ensureSubscribed() {
    if (subscribed || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await post('/api/subscribe', sub.toJSON());
      subscribed = true;
    } catch {
      // Push subscription failed (denied, unsupported, offline) — local timer is the fallback.
    }
  }

  function syncReminder(item) {
    if (item.type !== 'reminder') {
      post('/api/reminder', { id: item.id, dueAt: null, done: true, deletedAt: item.deletedAt || null });
      return;
    }
    ensureSubscribed();
    post('/api/reminder', {
      id: item.id, text: item.text, dueAt: item.dueAt,
      done: item.done, deletedAt: item.deletedAt || null, notified: item.notified,
    });
  }

  window.JotPush = { ensureSubscribed, syncReminder };
})();
