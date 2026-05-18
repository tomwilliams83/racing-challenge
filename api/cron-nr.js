/**
 * Cron: Non-Runner Detection
 * Called by GitHub Actions every 20 mins on race days (Tue–Sun, 11:00–18:00 UK)
 * Checks all active challenges for NRs and clears affected picks
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
  if (!m) return "";
  const h = parseInt(m[1]);
  return `${String(h < 10 ? h + 12 : h).padStart(2, "0")}:${m[2]}`;
}

async function fetchRacecards(day) {
  const user = process.env.RACING_API_USER;
  const pass = process.env.RACING_API_PASS;
  const url  = `https://api.theracingapi.com/v1/racecards?day=${day}`;
  const res  = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") }
  });
  if (!res.ok) throw new Error(`Racecards API ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  // Validate cron secret
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = getDb();
  const log = [];

  try {
    const todayStr    = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

    // Fetch both today and tomorrow racecards — challenges may be for either
    const [todayData, tomorrowData] = await Promise.all([
      fetchRacecards("today").catch(() => ({ racecards: [] })),
      fetchRacecards("tomorrow").catch(() => ({ racecards: [] })),
    ]);

    // Build runner maps keyed by horse_id for fast lookup
    function buildMap(data) {
      const map = {};
      toArr(data.racecards).forEach(race => {
        toArr(race.runners).forEach(h => {
          if (h.horse_id) map[h.horse_id] = h;
        });
      });
      return map;
    }
    const todayMap    = buildMap(todayData);
    const tomorrowMap = buildMap(tomorrowData);

    // Load all active challenges
    const snap = await get(ref(db, "challenges"));
    if (!snap.exists()) return res.status(200).json({ log: ["No challenges found"] });

    const challenges = Object.values(snap.val());
    let totalChanged = 0;

    for (const ch of challenges) {
      const races = toArr(ch.selectedRaces);
      if (!races.length) continue;

      // Only process challenges for today or tomorrow
      if (ch.day !== todayStr && ch.day !== tomorrowStr) continue;

      // Skip fully completed challenges
      if (races.every(r => r.resultIn)) continue;

      const runnerMap = ch.day === tomorrowStr ? tomorrowMap : todayMap;
      let changed = false;

      const updatedRaces = races.map(race => {
        if (race.resultIn) return race;
        const updatedRunners = toArr(race.runners).map(h => {
          const apiRunner = runnerMap[h.id];
          const isNR = apiRunner && (apiRunner.number === "NR" || apiRunner.jockey === "NON-RUNNER");
          if (isNR && !h.nonRunner) {
            changed = true;
            log.push(`NR: ${h.name} in ${race.course} ${race.time} (challenge ${ch.code})`);
            return { ...h, nonRunner: true };
          }
          return h;
        });
        return { ...race, runners: updatedRunners };
      });

      if (changed) {
        // Clear picks for NR horses
        const players = ch.players || {};
        Object.values(players).forEach(p => {
          updatedRaces.forEach(race => {
            const pick = p.picks?.[race.id];
            if (!pick?.horseId) return;
            const horse = toArr(race.runners).find(h => h.id === pick.horseId);
            if (horse?.nonRunner && !pick.nonRunner) {
              p.picks[race.id] = { ...pick, horseId: null, nonRunner: true };
              log.push(`  Cleared pick for ${p.name || p.id} in ${race.course} ${race.time}`);
            }
          });
        });

        await set(ref(db, `challenges/${ch.code}`), {
          ...ch,
          selectedRaces: updatedRaces,
          players,
        });
        totalChanged++;
      }
    }

    log.push(`Done — ${totalChanged} challenge(s) updated`);
    return res.status(200).json({ ok: true, log });

  } catch (e) {
    console.error("cron-nr error:", e.message);
    return res.status(500).json({ error: e.message, log });
  }
}
