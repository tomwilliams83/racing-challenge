/**
 * Cron: Results Processing
 * Called by GitHub Actions every 30 mins on race days (Tue–Sun, 14:00–20:00 UK)
 * Fetches finishing positions + SPs, settles all active challenges
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
function normCourse(c) {
  return (c || "").replace(/[(][A-Z]{2,3}[)]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}
function stripName(n) {
  return (n || "").replace(/[(][A-Z]{2,3}[)]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}
function spToDecimal(sp) {
  if (!sp) return null;
  const s = String(sp).trim();
  if (s === "EVS" || s === "evs") return 2.0;
  const m = s.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (!m) return parseFloat(s) || null;
  return +((parseFloat(m[1]) / parseFloat(m[2])) + 1).toFixed(4);
}
function getEWTerms(n, isHandicap) {
  if (n <= 4) return null;
  if (n <= 7) return { places: 2, fraction: 4 };
  if (n <= 15) return { places: 3, fraction: 4 };
  return { places: 4, fraction: 4 };
}

const UK_IRE = [
  "aintree","ascot","bath","beverley","brighton","carlisle","cartmel","catterick",
  "cheltenham","chelmsford","chepstow","chester","doncaster","epsom","exeter",
  "fakenham","ffos las","fontwell","goodwood","yarmouth","hamilton","haydock",
  "hereford","hexham","huntingdon","kempton","leicester","lingfield","ludlow",
  "market rasen","musselburgh","newbury","newcastle","newmarket","newton abbot",
  "nottingham","perth","plumpton","pontefract","redcar","ripon","salisbury",
  "sandown","sedgefield","southwell","stratford","taunton","thirsk","towcester",
  "uttoxeter","warwick","wetherby","wincanton","windsor","wolverhampton",
  "worcester","york","ayr","bangor","kelso","ballinrobe","bellewstown","clonmel",
  "cork","curragh","dundalk","fairyhouse","galway","gowran","kilbeggan",
  "killarney","leopardstown","limerick","listowel","naas","navan","punchestown",
  "roscommon","sligo","thurles","tipperary","tramore","waterford","wexford",
  "down royal","downpatrick",
];
function isUKIrish(c) {
  const n = normCourse(c);
  return UK_IRE.some(k => n.includes(k) || k.includes(n));
}

async function fetchResults() {
  const user = process.env.RACING_API_USER;
  const pass = process.env.RACING_API_PASS;
  const res  = await fetch("https://api.theracingapi.com/v1/results/today", {
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") }
  });
  if (!res.ok) throw new Error(`Results API ${res.status}`);
  return res.json();
}

function mergePositions(races, data) {
  const allResults = toArr(data.results || (Array.isArray(data) ? data : []));
  const list = allResults
    .filter(r => isUKIrish(r.course || r.venue || ""))
    .map(r => ({
      ...r,
      _course:  normCourse(r.course || r.venue || ""),
      _time:    normTime(r.off || r.off_time || r.time || ""),
      _date:    r.date || r.race_date || "",
      runners:  toArr(r.runners),
    }));

  function findResult(race) {
    const rCourse = normCourse(race.course);
    const rTime   = normTime(race.time);
    let res = list.find(r => {
      if ((r.race_id || r.id) !== race.id) return false;
      if (r._date && race.date && r._date !== race.date) return false;
      return true;
    });
    if (res) return res;
    const raceDate = race.date || "";
    return list.find(r => {
      if (r._time !== rTime) return false;
      if (!(r._course.includes(rCourse) || rCourse.includes(r._course))) return false;
      if (r._date && raceDate && r._date !== raceDate) return false;
      return true;
    }) || null;
  }

  return races.map(race => {
    if (race.resultIn) return race;
    const res = findResult(race);
    if (!res) return race;
    const hasPositions = res.runners && toArr(res.runners).some(r => r.position != null && r.position !== "");
    if (!hasPositions) return race;
    const runners = toArr(race.runners).map(h => {
      const hName = stripName(h.name);
      const rh = toArr(res.runners).find(x =>
        (x.horse_id || x.id) === h.id ||
        stripName(x.horse || x.name || "") === hName
      );
      if (!rh) return h;
      const pos    = rh.position != null && rh.position !== "" ? parseInt(rh.position) : null;
      const sp     = rh.sp || rh.starting_price || h.sp || null;
      const spDec  = rh.sp_dec != null ? parseFloat(rh.sp_dec) : null;
      return { ...h, position: isNaN(pos) ? null : pos, win: pos === 1, sp, spDec };
    });
    const actualRan = toArr(res.runners).length;
    const ewRan = actualRan > 0 ? actualRan : runners.length;
    return { ...race, runners, ewTerms: getEWTerms(ewRan, race.isHandicap), resultIn: true, resultAt: Date.now() };
  });
}

// NR default: unresolved NR pick → 2pts win on SP favourite
function applyNRDefaults(races, players) {
  const log = [];
  races.forEach(race => {
    if (!race.resultIn) return;
    const finishers = toArr(race.runners).filter(h => h.spDec != null && h.spDec > 0);
    if (!finishers.length) return;
    const lowestSP  = Math.min(...finishers.map(h => h.spDec));
    const favs      = finishers.filter(h => h.spDec === lowestSP);
    const favourite = favs.sort((a, b) => (a.number || 0) - (b.number || 0))[0];
    if (!favourite) return;

    Object.values(players).forEach(p => {
      const pick = p.picks?.[race.id];
      if (!pick?.nonRunner) return; // only apply to NR picks
      if (pick.nrDefaultApplied) return; // already done
      log.push(`NR default: ${p.name || p.id} → ${favourite.name} in ${race.course} ${race.time}`);
      p.picks[race.id] = {
        ...pick,
        horseId:        favourite.id,
        nrDefaultApplied: true,
        betType:        "win",
      };
    });
  });
  return log;
}

export default async function handler(req, res) {
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db  = getDb();
  const log = [];

  try {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

    // Fetch results once — reuse for all challenges
    log.push("Fetching results from API…");
    const resultsData = await fetchResults();
    log.push(`Got ${toArr(resultsData.results || []).length} results`);

    // Load all active challenges
    const snap = await get(ref(db, "challenges"));
    if (!snap.exists()) return res.status(200).json({ log: ["No challenges"] });

    const challenges = Object.values(snap.val());
    let totalUpdated = 0;

    for (const ch of challenges) {
      const races = toArr(ch.selectedRaces);
      if (!races.length) continue;
      if (ch.day !== todayStr) continue; // results only for today
      if (races.every(r => r.resultIn)) continue; // already done

      const updatedRaces = mergePositions(races, resultsData);
      const newlySettled = updatedRaces.filter((r, i) => r.resultIn && !races[i].resultIn);

      if (!newlySettled.length) continue;

      log.push(`Challenge ${ch.code}: ${newlySettled.length} new result(s) — ${newlySettled.map(r => `${r.course} ${r.time}`).join(", ")}`);

      // Apply NR defaults for newly settled races
      const players = ch.players || {};
      const nrLog = applyNRDefaults(updatedRaces, players);
      nrLog.forEach(l => log.push("  " + l));

      await set(ref(db, `challenges/${ch.code}`), {
        ...ch,
        selectedRaces: updatedRaces,
        players,
      });
      totalUpdated++;
    }

    log.push(`Done — ${totalUpdated} challenge(s) updated`);
    return res.status(200).json({ ok: true, log });

  } catch (e) {
    console.error("cron-results error:", e.message);
    return res.status(500).json({ error: e.message, log });
  }
}
