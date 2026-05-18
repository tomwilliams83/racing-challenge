/**
 * Cron: Non-Picker Removal
 * Called by GitHub Actions once daily at 14:30 UK time (Tue–Sun)
 * Removes players who haven't submitted picks, 30+ mins after first race off
 */
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey:      process.env.VITE_FIREBASE_API_KEY,
      authDomain:  process.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      appId:       process.env.VITE_FIREBASE_APP_ID,
    });
  }
  return getDatabase();
}

function toArr(v) { return Array.isArray(v) ? v : v ? Object.values(v) : []; }

function normTime(raw) {
  const m = String(raw || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1]);
  const h24 = h < 10 ? h + 12 : h;
  return { h: h24, min: parseInt(m[2]) };
}

function firstRaceDate(races, day) {
  // Build a Date object for the first race using the challenge day
  const sorted = [...toArr(races)].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!sorted.length) return null;
  const t = normTime(sorted[0].time);
  if (!t) return null;
  // day is YYYY-MM-DD in London time
  const [yr, mo, dy] = day.split("-").map(Number);
  // Build UTC date — London is UTC or UTC+1, use noon UTC as safe base then set hours
  const d = new Date(Date.UTC(yr, mo - 1, dy, t.h - 1, t.min)); // approximate UTC
  return d;
}

export default async function handler(req, res) {
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db  = getDb();
  const log = [];
  const now = new Date();

  try {
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });

    const snap = await get(ref(db, "challenges"));
    if (!snap.exists()) return res.status(200).json({ log: ["No challenges"] });

    const challenges = Object.values(snap.val());
    let totalUpdated = 0;

    for (const ch of challenges) {
      const races = toArr(ch.selectedRaces);
      if (!races.length) continue;
      if (ch.day !== todayStr) continue; // today only
      if (races.every(r => r.resultIn)) continue; // already finished

      // Check first race has gone off with 30 min grace period
      const firstOff = firstRaceDate(races, ch.day);
      if (!firstOff) continue;
      const thirtyMinsAfter = new Date(firstOff.getTime() + 30 * 60 * 1000);
      if (now < thirtyMinsAfter) {
        log.push(`Challenge ${ch.code}: first race not yet 30 mins past — skipping`);
        continue;
      }

      const players = ch.players || {};
      const nonPickers = Object.values(players).filter(p => !p.picksSubmitted && !p.picks);
      if (!nonPickers.length) continue;

      nonPickers.forEach(p => {
        log.push(`Removing non-picker ${p.name || p.id} from challenge ${ch.code}`);
        delete players[p.id];
      });

      await set(ref(db, `challenges/${ch.code}`), { ...ch, players });
      totalUpdated++;
    }

    log.push(`Done — ${totalUpdated} challenge(s) updated`);
    return res.status(200).json({ ok: true, log });

  } catch (e) {
    console.error("cron-nonpickers error:", e.message);
    return res.status(500).json({ error: e.message, log });
  }
}
