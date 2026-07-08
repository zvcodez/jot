# Jot

A single all-in-one inbox for reminders, Claude ideas, and quick notes —
one capture box instead of three separate iPhone apps.

Built with **no build step**: plain HTML/CSS/vanilla JS, no framework, no
bundler, no npm. Same buildless philosophy as [neil-ai-hub](../neil-ai-hub).

## Run it locally

```bash
cd jot
python3 -m http.server 5173
```

Open <http://localhost:5173>. (Service worker / ES module bits need `http://`,
not `file://`.)

## Using it

- Type in the bottom bar, tap **Reminder / Idea / Note** to save with that tag
  (or just hit Enter — defaults to whichever tag you last used).
- Filter chips at the top switch between All / Reminders / Ideas / Notes, each
  with a live count. The search box filters by text.
- Reminders get a checkmark to mark done (strikes through). Any item can be
  deleted with the ✕.
- Everything saves instantly to **localStorage** — works offline, no login
  needed for single-device use.

## Cross-device sync (optional)

Tap the cloud icon (top right) to turn on sync. Unlike quickly bolting sync
onto the app's own repo, **Jot's data never lives in this (public,
Pages-hosted) code repo** — it's stored as `data/items.json` in a *separate,
private* GitHub repo (`zvcodez/jot-data`) via the GitHub Contents API.

Setup (once):
1. Create a **private** GitHub repo named `jot-data` (empty is fine).
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   scoped to **only** that repo, with **Repository permissions → Contents:
   Read and write**.
3. Tap the cloud icon in Jot, paste the token, **Enable sync**.
4. Repeat step 3 on every device you want synced (phone + Mac) — same token.

Push is debounced (~1.5s after you stop typing/tapping), pull happens on
focus and every 60s. Conflicts resolve last-write-wins by timestamp.

## Add to iPhone Home Screen

Once deployed to a real URL (see below), open it in **Safari** → Share →
**Add to Home Screen**. It opens full-screen, no browser chrome, like a
native app.

## Deploy

Static files only — deploy anywhere. To match the rest of this project
collection (GitHub Pages, free, matches `neil-ai-hub`):

```bash
cd jot
git init && git add -A && git commit -m "Jot"
git branch -M main
git remote add origin https://github.com/zvcodez/jot.git
git push -u origin main
```

Then **Settings → Pages → Build from branch → `main` / root**. Live at
`https://zvcodez.github.io/jot/`.

This repo (`jot`) is just app code and can stay **public** — it holds no
personal data. Your actual items live in the separate **private**
`jot-data` repo described above.

## Project structure

```
jot/
├─ index.html      # the whole app: markup, styles, vanilla JS logic
├─ sync.js          # optional cross-device sync engine (GitHub Contents API)
├─ manifest.json    # PWA manifest (Add to Home Screen)
├─ sw.js            # service worker (offline app shell)
└─ icons/           # app icon (svg + 192/512 png)
```
