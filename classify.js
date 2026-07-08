// Local, offline classification: no server, no API key. Detects a date/time
// in the text (forcing type=reminder) and otherwise scores keywords to guess
// Reminder / Idea / Note. Good-enough heuristic, not true NLP — the capture
// toast lets you tap to correct a wrong guess.
(() => {
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function extractDateTime(text, now) {
    now = now || new Date();
    const lower = text.toLowerCase();

    let m = lower.match(/\bin\s+(a|an|\d+)\s*(minute|min|hour|hr)s?\b/);
    if (m) {
      const n = (m[1] === 'a' || m[1] === 'an') ? 1 : parseInt(m[1], 10);
      const unitMs = /min/.test(m[2]) ? 60000 : 3600000;
      return { date: new Date(now.getTime() + n * unitMs), matchedText: m[0] };
    }

    let dayOffset = null;
    let isTonight = false;
    if (/\btomorrow\b|\btmrw\b/.test(lower)) {
      dayOffset = 1;
    } else if (/\btonight\b/.test(lower)) {
      dayOffset = 0; isTonight = true;
    } else if (/\btoday\b/.test(lower)) {
      dayOffset = 0;
    } else {
      const wd = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
      if (wd) {
        const targetDow = WEEKDAYS.indexOf(wd[2]);
        const curDow = now.getDay();
        let diff = (targetDow - curDow + 7) % 7;
        if (diff === 0 && wd[1]) diff = 7;
        dayOffset = diff;
      }
    }

    let hh = null;
    let mm = 0;
    const tm = lower.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/);
    if (tm) {
      hh = parseInt(tm[1], 10) % 12;
      if (tm[3] === 'pm') hh += 12;
      mm = tm[2] ? parseInt(tm[2], 10) : 0;
    } else if (/\bnoon\b/.test(lower)) {
      hh = 12;
    } else if (/\bmidnight\b/.test(lower)) {
      hh = 0;
    } else if (/\bthis morning\b|\bin the morning\b/.test(lower)) {
      hh = 9;
    } else if (/\bthis afternoon\b|\bin the afternoon\b/.test(lower)) {
      hh = 15;
    } else if (/\bthis evening\b|\bin the evening\b/.test(lower)) {
      hh = 18;
    } else {
      const tm24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (tm24) { hh = parseInt(tm24[1], 10); mm = parseInt(tm24[2], 10); }
    }

    if (hh === null && dayOffset === null) return null;
    if (hh === null) hh = isTonight ? 20 : 9;
    if (dayOffset === null) dayOffset = 0;

    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hh, mm, 0, 0);
    if (dayOffset === 0 && target.getTime() <= now.getTime() && !/\btoday\b/.test(lower)) {
      target = new Date(target.getTime() + 86400000);
    }
    return { date: target, matchedText: tm ? tm[0] : (m ? m[0] : '') };
  }

  const REMINDER_RE = /\b(remind|remember|don't forget|call|text|email|pick up|buy|pay|renew|submit|schedule|book|cancel|return|charge|water|take|drop off|appointment|deadline|due|check in|follow up|send|meet|meeting)\b/i;
  const IDEA_RE = /\b(idea|claude|build|app|feature|prototype|what if|automate|ai should|explore|could build|project)\b/i;

  function classify(text, now) {
    const dt = extractDateTime(text, now);
    if (dt) return { type: 'reminder', dueAt: dt.date.toISOString() };
    if (REMINDER_RE.test(text)) return { type: 'reminder', dueAt: null };
    if (IDEA_RE.test(text)) return { type: 'idea', dueAt: null };
    return { type: 'note', dueAt: null };
  }

  function formatDue(iso, now) {
    now = now || new Date();
    const d = new Date(iso);
    const sameDay = d.toDateString() === now.toDateString();
    const tmrw = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const isTmrw = d.toDateString() === tmrw.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Today · ${time}`;
    if (isTmrw) return `Tomorrow · ${time}`;
    return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
  }

  window.JotEngine = { classify, extractDateTime, formatDue };
})();
