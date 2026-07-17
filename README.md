# Jot

A single all-in-one inbox for reminders, Claude ideas, and quick notes —
one capture box instead of three separate iPhone apps.

Built with **no build step**: plain HTML/CSS/vanilla JS, no framework, no
bundler, no npm.

## Run it locally

```bash
cd jot
python3 -m http.server 5173
```

Open <http://localhost:5173>. (Service worker bits need `http://`, not
`file://`.)

## Using it

Two pages, switched via the floating pill at the top:

- **Capture** (home) — a rotating prompt ("What's on your mind?", "Quick
  thought?", …) and a single input. Type your thought and hit Enter — Jot
  guesses whether it's a **Reminder**, **Idea**, or **Note** from the text
  itself (no manual tagging needed) and shows a toast confirming the tag;
  tap the toast to cycle to a different tag if it guessed wrong.
- **Log** (list icon) — everything you've captured, searchable and
  filterable by type with live counts, grouped by day (or by due date when
  the Reminder filter is active — Today / Tomorrow / This week / Later /
  No due date, soonest first; done reminders sink to a Done group).
  Reminders get a checkmark to mark done (strikes through). Tap an item's
  text to edit it inline, or a reminder's time line to change/clear its due
  date and time. Swipe an item left to reveal delete; tap it to soft-delete
  (undo toast, or restore later from **Recently deleted** at the bottom of
  the list — kept 30 days before permanent removal).

### How the auto-tagging works

Entirely local pattern-matching, no server or API call:

- If the text contains a date/time ("**around 5PM**", "tomorrow at 9am",
  "in 30 minutes", "friday", "tonight", "noon"…) it's tagged **Reminder**
  with that due time parsed out, e.g. "charge my laptop around 5PM" →
  Reminder, due today 5:00 PM.
- Otherwise, reminder-ish verbs (call, buy, pay, renew, schedule, charge,
  appointment, deadline…) → **Reminder** with no due time; idea-ish words
  (idea, claude, build, app, feature, prototype…) → **Idea**; anything else
  → **Note**.
- It's a heuristic, not real AI — tap the capture toast to correct a wrong
  guess. See `classify.js`.

### Reminder notifications

Reminders with a parsed due time request notification permission and
schedule a local alert via the service worker. This fires reliably while
the app is open, backgrounded, or reopened after the due time passed (you
get a "missed reminder" catch-up alert). It will also fire when the app/
browser is fully closed, via real Web Push — see the separate
[`jot-push`](https://github.com/zvcodez/jot-push) backend, which this repo's
`push.js` talks to automatically once notification permission is granted.

Tap a reminder's time (or "add time" if it doesn't have one yet) in the Log
view to set or change its due date/time after the fact.

Everything saves instantly to **localStorage** — works offline, no login
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
├─ index.html      # the whole app: markup, styles, vanilla JS logic (both pages)
├─ classify.js      # local type classification + date/time parsing (no server)
├─ sync.js          # optional cross-device sync engine (GitHub Contents API)
├─ manifest.json    # PWA manifest (Add to Home Screen)
├─ sw.js            # service worker (offline app shell + notification display)
└─ icons/           # app icon (svg + 192/512 png)
```
