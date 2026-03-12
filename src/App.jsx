import { useState, useEffect, useCallback } from "react";

// ─── EACH-WAY TERMS ──────────────────────────────────────────────────────────
function getEWTerms(numRunners, isHandicap) {
  if (numRunners <= 4) return null;
  if (numRunners <= 7) return { places: 2, fraction: 4 };
  if (numRunners <= 15) return { places: 3, fraction: 4 };
  return { places: 4, fraction: 4 };
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#eef6fd",
  surface:     "#f5faff",
  card:        "#ffffff",
  border:      "#bdd9f5",
  borderDk:    "#7ab8e8",
  pink:        "#ff007f",
  pinkLt:      "#ff4dab",
  pinkDk:      "#cc0066",
  pinkBg:      "#fff0f8",
  blue:        "#1a7fd4",
  blueLt:      "#4aa8f0",
  blueDk:      "#0d5fa8",
  blueBg:      "#eff8ff",
  text:        "#0d2d4a",
  muted:       "#5a8aaa",
  mutedLt:     "#a8c8e0",
  win:         "#00b86b",
  winLt:       "#e6fff4",
  winBorder:   "#00b86b",
  place:       "#7c3aed",
  placeLt:     "#ede9fe",
  placeBorder: "#7c3aed",
  danger:      "#ff3b30",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.blueLt}; border-radius: 3px; }
  .serif { font-family: 'DM Serif Display', serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 0 16px 100px; }

  .hdr { background: linear-gradient(135deg, ${C.blue} 0%, ${C.blueDk} 100%); padding: 20px 0 18px; text-align: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 20px rgba(13,95,168,.25); }
  .hdr-eye { font-size: 10px; letter-spacing: 5px; color: rgba(255,255,255,.55); margin-bottom: 4px; font-weight: 600; }
  .hdr-title { font-family: 'DM Serif Display', serif; font-size: clamp(24px,4vw,42px); color: #fff; letter-spacing: 1px; }
  .hdr-pink { color: ${C.pink}; }
  .hdr-sub { font-size: 11px; letter-spacing: 4px; color: rgba(255,255,255,.5); margin-top: 5px; font-weight: 500; }

  .btn { font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; border: none; cursor: pointer; border-radius: 10px; transition: all .18s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .btn:disabled { opacity: .38; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
  .btn-pink { background: linear-gradient(135deg, ${C.pink}, ${C.pinkLt}); color: #fff; padding: 12px 28px; box-shadow: 0 4px 16px rgba(255,10,108,.4); }
  .btn-pink:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(255,10,108,.5); }
  .btn-blue { background: linear-gradient(135deg, ${C.blue}, ${C.blueLt}); color: #fff; padding: 12px 28px; box-shadow: 0 4px 14px rgba(26,127,212,.3); }
  .btn-blue:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(26,127,212,.4); }
  .btn-outline { background: #fff; border: 1.5px solid ${C.border}; color: ${C.muted}; padding: 9px 18px; }
  .btn-outline:hover { border-color: ${C.blue}; color: ${C.blue}; }
  .btn-sm { padding: 6px 14px; font-size: 13px; }
  .btn-ghost { background: transparent; border: none; color: ${C.muted}; padding: 6px 10px; font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; }
  .btn-ghost:hover { color: ${C.pink}; }

  .card { background: ${C.card}; border: 1.5px solid ${C.border}; border-radius: 16px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(26,127,212,.05); }
  .card + .card { margin-top: 14px; }
  .card-pink { border-color: ${C.pink}; box-shadow: 0 4px 20px rgba(255,10,108,.1); }
  .card-blue { border-color: ${C.blue}; box-shadow: 0 4px 20px rgba(26,127,212,.1); }

  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 11px; letter-spacing: 2px; color: ${C.muted}; margin-bottom: 7px; font-weight: 600; text-transform: uppercase; }
  .inp { width: 100%; background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 10px; color: ${C.text}; padding: 11px 14px; font-family: 'DM Sans', sans-serif; font-size: 16px; transition: border-color .15s; }
  .inp:focus { outline: none; border-color: ${C.pink}; background: #fff; box-shadow: 0 0 0 3px rgba(255,10,108,.08); }
  .inp::placeholder { color: ${C.mutedLt}; }
  .inp-code { letter-spacing: 8px; font-size: 24px; font-family: 'DM Serif Display', serif; text-align: center; }

  .eyebrow { font-size: 10px; letter-spacing: 3px; color: ${C.muted}; margin-bottom: 5px; font-weight: 600; text-transform: uppercase; display: block; }
  .sec-title { font-family: 'DM Serif Display', serif; font-size: 26px; color: ${C.text}; margin-bottom: 18px; }

  .race-row { background: #fff; border: 1.5px solid ${C.border}; border-radius: 12px; padding: 15px 18px; margin-bottom: 9px; cursor: pointer; transition: all .18s; }
  .race-row:hover { border-color: ${C.blue}; box-shadow: 0 3px 14px rgba(26,127,212,.1); transform: translateY(-1px); }
  .race-row.sel { border-color: ${C.pink}; background: ${C.pinkBg}; box-shadow: 0 3px 14px rgba(255,10,108,.12); }

  .horse-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; }
  @media(max-width:500px){ .horse-grid { grid-template-columns: 1fr; } }
  .hbtn { background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 10px; padding: 10px 13px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; width: 100%; color: ${C.text}; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: all .15s; text-align: left; }
  .hbtn:hover { border-color: ${C.pink}; background: ${C.pinkBg}; }
  .hbtn.win-picked { background: ${C.pink}; border-color: ${C.pinkDk}; color: #fff; font-weight: 600; box-shadow: 0 3px 10px rgba(255,10,108,.35); }
  .hbtn.ew-picked  { background: ${C.place}; border-color: #5b21b6; color: #fff; font-weight: 600; }
  .hbtn.won        { background: ${C.winLt}; border-color: ${C.winBorder}; color: #007a47; font-weight: 600; }
  .hbtn.placed     { background: ${C.placeLt}; border-color: ${C.placeBorder}; color: #5b21b6; font-weight: 600; }
  .hbtn.lost       { opacity: .32; }
  .sp-chip { background: #fff; border: 1.5px solid ${C.border}; border-radius: 6px; padding: 2px 8px; font-size: 12px; color: ${C.blue}; min-width: 44px; text-align: center; white-space: nowrap; flex-shrink: 0; font-weight: 700; }
  .hbtn.win-picked .sp-chip { background: rgba(255,255,255,.25); border-color: rgba(255,255,255,.45); color: #fff; }
  .hbtn.ew-picked  .sp-chip { background: rgba(255,255,255,.2);  border-color: rgba(255,255,255,.35); color: #fff; }
  .hbtn.won   .sp-chip { background: #fff; border-color: ${C.winBorder}; color: ${C.win}; }
  .hbtn.placed .sp-chip { background: #fff; border-color: ${C.placeBorder}; color: ${C.place}; }

  .bet-toggle { display: flex; gap: 8px; margin-top: 12px; }
  .bet-toggle button { padding: 7px 16px; background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 20px; color: ${C.muted}; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
  .bet-toggle button.active-win { background: ${C.pink}; border-color: ${C.pinkDk}; color: #fff; box-shadow: 0 2px 10px rgba(255,10,108,.35); }
  .bet-toggle button.active-ew  { background: ${C.place}; border-color: #5b21b6; color: #fff; box-shadow: 0 2px 8px rgba(124,58,237,.3); }
  .bet-toggle button:hover:not(.active-win):not(.active-ew) { border-color: ${C.pink}; color: ${C.pink}; }

  .ew-terms { display: inline-block; font-size: 11px; color: ${C.place}; background: ${C.placeLt}; border: 1px solid #c4b5fd; border-radius: 20px; padding: 2px 10px; margin-left: 8px; vertical-align: middle; font-weight: 600; }

  .lb-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: #fff; border: 1.5px solid ${C.border}; border-radius: 12px; margin-bottom: 8px; transition: all .2s; }
  .lb-row.p1 { border-color: ${C.pink}; background: ${C.pinkBg}; box-shadow: 0 4px 18px rgba(255,10,108,.12); }
  .lb-rank { font-family: 'DM Serif Display', serif; font-size: 22px; color: ${C.mutedLt}; width: 30px; text-align: center; }
  .lb-row.p1 .lb-rank { color: ${C.pink}; }
  .lb-pts { font-family: 'DM Serif Display', serif; font-size: 22px; color: ${C.text}; }
  .lb-row.p1 .lb-pts { color: ${C.pink}; }

  .tabs { display: flex; gap: 0; border-bottom: 2px solid ${C.border}; margin-bottom: 22px; overflow-x: auto; }
  .tab { padding: 10px 20px; background: transparent; border: none; border-bottom: 2px solid transparent; color: ${C.muted}; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: -2px; transition: all .18s; white-space: nowrap; }
  .tab.on { color: ${C.pink}; border-bottom-color: ${C.pink}; }

  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .b-green  { background: ${C.winLt}; color: #007a47; border: 1.5px solid ${C.winBorder}; }
  .b-pink   { background: ${C.pinkBg}; color: ${C.pink}; border: 1.5px solid ${C.pinkLt}; }
  .b-purple { background: ${C.placeLt}; color: ${C.place}; border: 1.5px solid #c4b5fd; }
  .b-grey   { background: #f0f4f8; color: ${C.muted}; border: 1.5px solid ${C.border}; }
  .b-blue   { background: ${C.blueBg}; color: ${C.blue}; border: 1.5px solid ${C.blueLt}; }

  .share-box { background: linear-gradient(135deg, ${C.pink}, ${C.pinkDk}); border-radius: 16px; padding: 20px 24px; display: flex; align-items: center; gap: 14px; max-width: 340px; margin: 16px auto; box-shadow: 0 6px 24px rgba(255,10,108,.35); }
  .share-code { font-family: 'DM Serif Display', serif; font-size: 34px; letter-spacing: 8px; color: #fff; flex: 1; }

  .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: ${C.text}; color: #fff; padding: 12px 26px; border-radius: 24px; font-weight: 600; font-size: 15px; z-index: 9999; animation: tIn .3s ease; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,.2); }
  @keyframes tIn { from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  .loader { display: flex; gap: 8px; justify-content: center; align-items: center; padding: 40px; }
  .loader span { width: 10px; height: 10px; border-radius: 50%; animation: lb .7s infinite alternate; }
  .loader span:nth-child(1) { background: ${C.pink}; }
  .loader span:nth-child(2) { background: ${C.blue}; animation-delay:.15s; }
  .loader span:nth-child(3) { background: ${C.pink}; animation-delay:.3s; }
  @keyframes lb { from{transform:translateY(0);opacity:.4} to{transform:translateY(-13px);opacity:1} }

  .pts-big { font-family: 'DM Serif Display', serif; font-size: clamp(40px,8vw,64px); text-align: center; color: ${C.pink}; line-height: 1; }
  .pts-sub  { text-align: center; font-size: 13px; letter-spacing: 1px; color: ${C.muted}; margin-top: 6px; font-weight: 500; }

  hr { border: none; border-top: 1.5px solid ${C.border}; margin: 18px 0; }

  .ctx-strip { display: flex; justify-content: space-between; align-items: center; padding: 10px 0 14px; border-bottom: 1.5px solid ${C.border}; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
  .ctx-code { font-family: 'DM Serif Display', serif; letter-spacing: 5px; color: ${C.pink}; font-size: 20px; }

  .home-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media(max-width:540px){ .home-grid { grid-template-columns: 1fr; } }

  .err { color: ${C.danger}; font-size: 14px; margin-top: 10px; padding: 10px 14px; background: #fff5f5; border: 1.5px solid #ffb3b3; border-radius: 10px; font-weight: 500; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${C.win}; animation: pulse 1.4s infinite; margin-right: 6px; vertical-align: middle; }

  .fade { animation: fadeIn .35s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

  .day-toggle { display: flex; gap: 10px; }
  .day-btn { flex: 1; padding: 12px; background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 12px; color: ${C.muted}; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all .18s; text-align: center; }
  .day-btn.active { background: ${C.pink}; border-color: ${C.pinkDk}; color: #fff; box-shadow: 0 4px 14px rgba(255,10,108,.35); }
  .day-btn:hover:not(.active) { border-color: ${C.pink}; color: ${C.pink}; }

  .time-badge { display: inline-block; background: ${C.pink}; color: #fff; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; margin-right: 8px; letter-spacing: .5px; }

  .nap-badge { display: inline-block; background: linear-gradient(135deg, #ff8c00, #ffb700); color: #fff; border-radius: 6px; padding: 2px 9px; font-size: 12px; font-weight: 800; letter-spacing: 1px; margin-left: 6px; box-shadow: 0 2px 8px rgba(255,140,0,.35); vertical-align: middle; }
  .nap-banner { background: #fff8ee; border: 1.5px solid #ffb700; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .btn-nap     { background: linear-gradient(135deg, #ff8c00, #ffb700); color: #fff; padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'DM Sans',sans-serif; box-shadow: 0 2px 10px rgba(255,140,0,.35); letter-spacing: .5px; transition: all .15s; }
  .btn-nap:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(255,140,0,.45); }
  .btn-nap-off { background: ${C.bg}; border: 1.5px solid ${C.border}; color: ${C.muted}; padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; transition: all .15s; }
  .btn-nap-off:hover { border-color: #ff8c00; color: #ff8c00; }
  .hbtn.nap-outline { outline: 3px solid #ff8c00; outline-offset: 2px; }

  .sp-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  @media(max-width:500px){ .sp-entry-grid { grid-template-columns: 1fr; } }
  .sp-row { display: flex; align-items: center; gap: 8px; background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 10px; padding: 8px 12px; }
  .sp-row.winner { border-color: ${C.win}; background: ${C.winLt}; }
  .sp-row.placed { border-color: ${C.placeBorder}; background: ${C.placeLt}; }
  .sp-horse { flex: 1; font-size: 14px; font-weight: 600; }
  .sp-inp { width: 80px; background: #fff; border: 1.5px solid ${C.border}; border-radius: 7px; padding: 5px 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; text-align: center; color: ${C.text}; flex-shrink: 0; }
  .sp-inp:focus { outline: none; border-color: ${C.pink}; }
  .sp-inp::placeholder { color: ${C.mutedLt}; font-weight: 400; }
  .pos-badge { display: inline-block; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 700; text-align: center; line-height: 24px; flex-shrink: 0; }
  .pos-1 { background: #ffd700; color: #7a5500; }
  .pos-2 { background: #c0c0c0; color: #444; }
  .pos-3 { background: #cd7f32; color: #fff; }
  .pos-n { background: ${C.border}; color: ${C.muted}; }
  .sp-section { background: #fff8ee; border: 1.5px solid #ffb700; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
`;

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function genCode(len = 5) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}
function spToDecimal(sp) {
  if (!sp) return null;
  const s = String(sp).trim().toLowerCase();
  if (s === "evs" || s === "1/1") return 2.0;
  if (s.includes("/")) {
    const [n, d] = s.split("/").map(Number);
    if (!d || isNaN(n) || isNaN(d)) return null;
    return +(n / d + 1).toFixed(4);
  }
  const f = parseFloat(s);
  return isNaN(f) ? null : f;
}

// Win = 2pts (NAP = 4pts). EW = 1pt win + 1pt place (NAP = 2pt win + 2pt place).
function calcSelectionReturn(sp, betType, position, ewTerms, isNap = false) {
  const dec = spToDecimal(sp);
  if (!dec) return { win: 0, place: 0, total: 0, staked: betType === "ew" ? (isNap ? 4 : 2) : (isNap ? 4 : 2) };
  const mult = isNap ? 2 : 1; // NAP doubles the stake
  if (betType === "win") {
    const staked = 2 * mult;
    const ret = position === 1 ? +(staked * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret, staked };
  }
  if (!ewTerms) {
    const staked = 2 * mult;
    const ret = position === 1 ? +(staked * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret, staked, winOnly: true };
  }
  const winStake  = 1 * mult;
  const placeStake = 1 * mult;
  const staked    = winStake + placeStake;
  const winRet    = position === 1 ? +(winStake * dec).toFixed(2) : 0;
  const placeOdds = +((dec - 1) / ewTerms.fraction + 1).toFixed(4);
  const placed    = position !== null && position >= 1 && position <= ewTerms.places;
  const placeRet  = placed ? +(placeStake * placeOdds).toFixed(2) : 0;
  return { win: winRet, place: placeRet, total: +(winRet + placeRet).toFixed(2), staked };
}

function fmtPts(v) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2) + " pts";
}
function fmtSP(sp) { return sp ? String(sp) : "SP"; }

function useToast() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m, dur = 2200) => {
    setMsg(m); setTimeout(() => setMsg(null), dur);
  }, []);
  return [msg, show];
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
const DB_KEY = "rc_v4";
function dbGet(code) {
  try { return JSON.parse(localStorage.getItem(DB_KEY + ":" + code) || "null"); } catch { return null; }
}
function dbSet(code, val) {
  try { localStorage.setItem(DB_KEY + ":" + code, JSON.stringify(val)); } catch {}
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt.substring(0, 160)}`);
  }
  return res.json();
}

function parseRacecards(data) {
  const list = data.racecards || data.results || (Array.isArray(data) ? data : []);
  return list.map(r => {
    const isHandicap = /handicap/i.test(r.race_name || r.name || "");
    const runners = (r.runners || []).map(h => ({
      id: h.horse_id || h.id || h.horse,
      name: h.horse || h.name || "Unknown",
      number: h.number || h.cloth || "",
      jockey: h.jockey || "",
      sp: null, position: null, win: false,
    }));
    return {
      id: r.race_id || r.id || `${r.course}-${r.off}`,
      course: r.course || "Unknown",
      time: r.off_time || r.off || r.time || "",
      name: r.race_name || r.name || "Race",
      distance: r.distance_round || r.distance || "",
      going: r.going || "",
      isHandicap, runners,
      ewTerms: getEWTerms(runners.length, isHandicap),
      resultIn: false,
    };
  });
}

// Merge positions only from API (no SP available on free plan)
function mergePositions(races, data) {
  const list = data.results || (Array.isArray(data) ? data : []);
  const byId = {};
  list.forEach(r => { byId[r.race_id || r.id] = r; });
  return races.map(race => {
    const res = byId[race.id];
    if (!res) return race;
    const runners = race.runners.map(h => {
      const rh = (res.runners || []).find(x =>
        (x.horse_id || x.id) === h.id || 
        (x.horse || x.name || '').toLowerCase() === h.name.toLowerCase()
      );
      if (!rh) return h;
      const position = rh.position ? parseInt(rh.position) : null;
      return { ...h, position: isNaN(position) ? null : position, win: position === 1 };
    });
    return { ...race, runners, ewTerms: getEWTerms(runners.length, race.isHandicap), resultIn: true };
  });
}

// Apply manually entered SPs to races
function applySPs(races, spMap) {
  // spMap: { raceId: { horseId: "5/1", ... } }
  return races.map(race => {
    const raceSpMap = spMap[race.id];
    if (!raceSpMap) return race;
    const runners = race.runners.map(h => ({
      ...h,
      sp: raceSpMap[h.id] !== undefined ? raceSpMap[h.id] : h.sp,
    }));
    return { ...race, runners };
  });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Loader() { return <div className="loader"><span/><span/><span/></div>; }
function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null; }

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeScreen({ onCreate, onJoin }) {
  const [createName, setCreateName] = useState("");
  const [joinName,   setJoinName]   = useState("");
  const [joinCode,   setJoinCode]   = useState("");
  const [err,        setErr]        = useState("");

  function handleJoin() {
    if (!joinName.trim() || joinCode.length < 5) return;
    const ch = dbGet(joinCode.toUpperCase());
    if (!ch) { setErr("Challenge not found — check the code and try again."); return; }
    onJoin(ch, joinName.trim());
  }

  return (
    <div style={{ paddingTop: 36 }} className="fade">
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 58, marginBottom: 12 }}>🏇</div>
        <h1 className="serif" style={{ fontSize: "clamp(28px,5vw,46px)", color: C.text, marginBottom: 12 }}>
          Racing <span style={{ color: C.pink }}>Challenge</span>
        </h1>
        <p style={{ color: C.muted, fontSize: 17, maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>
          Pick a winner — or go each-way — in each race and see who banks the best returns at Starting Price.
        </p>
      </div>

      <div className="home-grid">
        <div className="card card-pink">
          <div className="eyebrow">Start a new game</div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14 }}>Create Challenge</div>
          <div className="field">
            <label>Your name</label>
            <input className="inp" placeholder="e.g. Paddy" value={createName} onChange={e => setCreateName(e.target.value)} />
          </div>
          <button className="btn btn-pink" style={{ width: "100%" }} disabled={!createName.trim()} onClick={() => onCreate(createName.trim())}>
            Create &amp; Get Code
          </button>
        </div>

        <div className="card card-blue">
          <div className="eyebrow">Join a friend's game</div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14 }}>Join Challenge</div>
          <div className="field">
            <label>Your name</label>
            <input className="inp" placeholder="e.g. Seamus" value={joinName} onChange={e => setJoinName(e.target.value)} />
          </div>
          <div className="field">
            <label>Challenge code</label>
            <input className="inp inp-code" placeholder="XXXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-blue" style={{ width: "100%", marginTop: 4 }} disabled={!joinName.trim() || joinCode.length < 5} onClick={handleJoin}>
            Join Challenge
          </button>
        </div>
      </div>

      <p style={{ textAlign: "center", color: C.mutedLt, marginTop: 24, fontSize: 12, fontWeight: 500 }}>
        FOR ENTERTAINMENT PURPOSES ONLY · PLEASE GAMBLE RESPONSIBLY
      </p>
    </div>
  );
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
function SetupScreen({ challenge, onSave, onBack }) {
  const [day,       setDay]       = useState("today");
  const [racecards, setRacecards] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [toast,     showToast]    = useToast();

  async function load() {
    setLoading(true); setError("");
    try {
      const data   = await apiGet(`/api/racecards?day=${day}`);
      const parsed = parseRacecards(data);
      setRacecards(parsed);
      if (!parsed.length) setError("No races found.");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function save() {
    const selectedRaces = racecards.filter(r => selected.has(r.id));
    const updated = { ...challenge, day, racecards, selectedRaceIds: [...selected], selectedRaces, status: "open" };
    dbSet(updated.code, updated);
    showToast("Challenge saved!");
    setTimeout(() => onSave(updated), 600);
  }

  return (
    <div style={{ paddingTop: 24 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">Challenge Setup</div>
      <div className="sec-title">Choose Your Races</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Race day</label>
          <div className="day-toggle">
            <button className={`day-btn${day === "today" ? " active" : ""}`} onClick={() => setDay("today")}>Today</button>
            <button className={`day-btn${day === "tomorrow" ? " active" : ""}`} onClick={() => setDay("tomorrow")}>Tomorrow</button>
          </div>
        </div>
        <button className="btn btn-blue" onClick={load} disabled={loading} style={{ width: "100%" }}>
          {loading ? "Loading…" : "Load Races"}
        </button>
        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {loading && <Loader />}

      {racecards.length > 0 && (
        <div className="fade">
          <p style={{ color: C.muted, marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
            Tap to select races — <strong style={{ color: C.pink }}>{selected.size} selected</strong>
          </p>
          {racecards.map(r => (
            <div key={r.id} className={`race-row${selected.has(r.id) ? " sel" : ""}`} onClick={() => toggle(r.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: selected.has(r.id) ? C.pink : C.text }}>
                    <span className="time-badge">{r.time}</span>{r.course}
                    {r.isHandicap && <span style={{ fontSize: 11, color: C.muted, marginLeft: 6, fontWeight: 500 }}>HCP</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{r.name}{r.distance ? ` · ${r.distance}` : ""}{r.going ? ` · ${r.going}` : ""}</div>
                  <div style={{ color: C.mutedLt, fontSize: 12, marginTop: 2 }}>
                    {r.runners.length} runners · {r.ewTerms ? `EW: ${r.ewTerms.places} places 1/${r.ewTerms.fraction}` : "Win only"}
                  </div>
                </div>
                <span style={{ fontSize: 22 }}>{selected.has(r.id) ? "✅" : "⬜"}</span>
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button className="btn btn-pink" disabled={selected.size === 0} onClick={save}>
              Save {selected.size} Race{selected.size !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────
function LobbyScreen({ challenge, playerId, onAction, onBack }) {
  const [toast,  showToast] = useToast();
  const [ch,     setCh]     = useState(challenge);
  const isCreator           = ch.creatorId === playerId;
  const players             = Object.values(ch.players || {});

  useEffect(() => {
    const t = setInterval(() => {
      const fresh = dbGet(ch.code);
      if (fresh) setCh(fresh);
    }, 3000);
    return () => clearInterval(t);
  }, [ch.code]);

  function copy() {
    navigator.clipboard?.writeText(ch.code).catch(() => {});
    showToast("Code copied! 📋");
  }

  function lockAndOpen() {
    const updated = { ...ch, status: "selections" };
    dbSet(ch.code, updated);
    setCh(updated);
    onAction("picks", updated);
  }

  return (
    <div style={{ paddingTop: 32 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎟️</div>
        <div className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Challenge Code</div>
        <div className="share-box">
          <div className="share-code">{ch.code}</div>
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.25)", border: "1.5px solid rgba(255,255,255,.45)", color: "#fff", borderRadius: 8 }} onClick={copy}>Copy</button>
        </div>
        <p style={{ color: C.muted, maxWidth: 380, margin: "0 auto", fontSize: 15, lineHeight: 1.65 }}>
          Share this code with friends. They visit this site and enter the code to join.
          {isCreator ? " Open selections when everyone's ready." : " The creator will open selections when everyone's in."}
        </p>
      </div>

      <div className="card card-blue" style={{ maxWidth: 440, margin: "0 auto 20px" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, marginBottom: 12, fontWeight: 600, textTransform: "uppercase" }}>
          <span className="live-dot" />Players · live
        </div>
        {players.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1.5px solid ${C.border}` }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              {p.name}{p.id === ch.creatorId ? " 👑" : ""}
              {p.id === playerId ? <span style={{ color: C.muted, fontSize: 13 }}> (you)</span> : ""}
            </span>
            <span className={`badge ${p.picksSubmitted ? "b-green" : "b-grey"}`}>
              {p.picksSubmitted ? "Ready ✓" : "Waiting…"}
            </span>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        {isCreator && ch.status === "open" && (
          <button className="btn btn-pink" onClick={lockAndOpen}>Open Selections →</button>
        )}
        {ch.status === "selections" && (
          <button className="btn btn-pink" onClick={() => onAction("picks", ch)}>Make My Picks →</button>
        )}
        <button className="btn btn-ghost" onClick={() => onAction("results", ch)}>View Leaderboard</button>
      </div>
    </div>
  );
}

// ── PICKS ─────────────────────────────────────────────────────────────────────
function PicksScreen({ challenge, playerId, onSubmit, onBack }) {
  const player    = challenge.players?.[playerId];
  const races     = challenge.selectedRaces || [];
  const submitted = player?.picksSubmitted;
  const [picks,   setPicks]  = useState(player?.picks || {});
  const [napId,   setNapId]  = useState(player?.napRaceId || null);
  const [saving,  setSaving] = useState(false);
  const [toast,   showToast] = useToast();

  const allPicked = races.every(r => picks[r.id]?.horseId);

  function pickHorse(raceId, hId) {
    if (submitted) return;
    setPicks(p => ({ ...p, [raceId]: { horseId: hId, betType: p[raceId]?.betType || "win" } }));
  }
  function setBetType(raceId, betType) {
    if (submitted) return;
    setPicks(p => ({ ...p, [raceId]: { ...p[raceId], betType } }));
  }
  function toggleNap(raceId) {
    if (submitted) return;
    setNapId(prev => prev === raceId ? null : raceId);
  }

  function submit() {
    setSaving(true);
    const fresh = dbGet(challenge.code) || challenge;
    const updatedPlayer = { ...player, picks, napRaceId: napId, picksSubmitted: true };
    fresh.players[playerId] = updatedPlayer;
    dbSet(fresh.code, fresh);
    setSaving(false);
    showToast("Picks locked in! 🏁");
    setTimeout(() => onSubmit(fresh, updatedPlayer), 700);
  }

  return (
    <div style={{ paddingTop: 22 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">2pts win · 1pt e/w each part · NAP doubles your stake</div>
      <div className="sec-title">{player?.name}'s Picks</div>

      {submitted && (
        <div className="badge b-green" style={{ fontSize: 14, padding: "8px 18px", marginBottom: 16, display: "inline-block" }}>
          ✅ Picks submitted — good luck!
        </div>
      )}

      {!submitted && (
        <div className="nap-banner">
          <div>
            <span className="nap-badge">NAP</span>
            <span style={{ fontWeight: 600, fontSize: 14, marginLeft: 8 }}>Your NAP</span>
            <span style={{ color: "#b36000", fontSize: 13, marginLeft: 6 }}>
              {napId ? `— ${races.find(r => r.id === napId)?.course || "selected"} (doubles your stake)` : "— pick a horse first, then mark one race as your NAP"}
            </span>
          </div>
          {napId && !submitted && (
            <button className="btn-nap-off" onClick={() => setNapId(null)}>Clear NAP</button>
          )}
        </div>
      )}

      {races.map((race, i) => {
        const myPick   = picks[race.id];
        const pickedId = myPick?.horseId;
        const betType  = myPick?.betType || "win";
        const ewAvail  = !!race.ewTerms;
        const isNap    = napId === race.id;

        return (
          <div key={race.id} className="card" style={{ marginBottom: 12, ...(isNap ? { borderColor: "#ff8c00", boxShadow: "0 4px 18px rgba(255,140,0,.2)" } : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <div>
                <div className="eyebrow">Race {i + 1}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>
                  <span className="time-badge">{race.time}</span>{race.course}
                  {isNap && <span className="nap-badge">NAP</span>}
                </div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
                  {race.name}{race.distance ? ` · ${race.distance}` : ""}
                  {ewAvail
                    ? <span className="ew-terms">{race.ewTerms.places} places · 1/{race.ewTerms.fraction}</span>
                    : <span style={{ color: C.mutedLt, fontSize: 12, marginLeft: 8 }}>Win only</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                {pickedId && <span className={`badge ${betType === "ew" ? "b-purple" : "b-pink"}`}>✓ {betType === "ew" ? "1pt e/w" : "Win 2pts"}{isNap ? " ×2" : ""}</span>}
                {pickedId && !submitted && (
                  <button className={isNap ? "btn-nap" : "btn-nap-off"} onClick={() => toggleNap(race.id)}>
                    {isNap ? "⭐ NAP" : "Set as NAP"}
                  </button>
                )}
                {submitted && isNap && <span className="nap-badge">NAP</span>}
              </div>
            </div>

            {pickedId && ewAvail && !submitted && (
              <div className="bet-toggle">
                <button className={betType === "win" ? "active-win" : ""} onClick={() => setBetType(race.id, "win")}>
                  Win — {isNap ? "4pts" : "2pts"}
                </button>
                <button className={betType === "ew" ? "active-ew" : ""} onClick={() => setBetType(race.id, "ew")}>
                  Each-Way — {isNap ? "2pts" : "1pt"} e/w
                </button>
              </div>
            )}

            <div className="horse-grid">
              {race.runners.map(h => {
                const isPicked = pickedId === h.id;
                return (
                  <button key={h.id}
                    className={`hbtn${isPicked ? (betType === "ew" ? " ew-picked" : " win-picked") : ""}${isPicked && isNap ? " nap-outline" : ""}`}
                    onClick={() => pickHorse(race.id, h.id)}>
                    <span style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: isPicked ? 600 : 400 }}>{h.number ? `${h.number}. ` : ""}{h.name}</span>
                      {h.jockey && <span style={{ display: "block", fontSize: 11, opacity: .6, marginTop: 1 }}>{h.jockey}</span>}
                    </span>
                    <span className="sp-chip">SP</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button className="btn btn-pink" disabled={!allPicked || saving} onClick={submit}>
            {saving ? "Saving…" : allPicked ? "Submit Picks 🏁" : `${races.length - Object.values(picks).filter(p => p?.horseId).length} more to pick`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
// Parse "HH:MM" off time into today's Date object
function offTimeToDate(timeStr, day) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const base = day === "tomorrow"
    ? new Date(Date.now() + 86400000)
    : new Date();
  base.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  return base;
}

// Return ms until the next scheduled fetch for a race, or null if all done
function msUntilNextFetch(offTime, day, resultIn) {
  if (resultIn) return null; // already have result
  const off = offTimeToDate(offTime, day);
  if (!off) return null;
  const now = Date.now();
  const delaysMs = [10, 12, 14, 16].map(m => m * 60 * 1000);
  for (const d of delaysMs) {
    const t = off.getTime() + d;
    if (t > now) return t - now; // next future trigger
  }
  return null; // all four windows have passed
}

function ResultsScreen({ challenge, playerId, isCreator, onBack }) {
  const [ch,         setCh]     = useState(challenge);
  const [tab,        setTab]    = useState("board");
  const [refreshing, setRef]    = useState(false);
  const [err,        setErr]    = useState("");
  const [toast,      showToast] = useToast();
  // spInputs: { raceId: { horseId: "5/1" } } — creator's manual SP entries
  const [spInputs,   setSpInputs] = useState({});

  const races   = ch.selectedRaces || [];
  const players = Object.values(ch.players || {});

  // Poll localStorage for changes from other users
  useEffect(() => {
    const t = setInterval(() => {
      const fresh = dbGet(ch.code);
      if (fresh) setCh(fresh);
    }, 8000);
    return () => clearInterval(t);
  }, [ch.code]);

  function calcPlayer(p) {
    let totalReturn = 0, totalStaked = 0, wins = 0, places = 0;
    const detail = races.map(race => {
      const sel     = p.picks?.[race.id];
      const hId     = sel?.horseId;
      const betType = sel?.betType || "win";
      const isNap   = p.napRaceId === race.id;
      const horse   = race.runners.find(h => h.id === hId);
      if (!horse) return { race, horse: null, betType, isNap, ret: { total: 0, win: 0, place: 0, staked: isNap ? 4 : 2 } };
      const ret = calcSelectionReturn(horse.sp, betType, horse.position, race.ewTerms, isNap);
      totalReturn += ret.total;
      totalStaked += ret.staked;
      if (horse.position === 1) wins++;
      else if (ret.place > 0) places++;
      return { race, horse, betType, isNap, ret };
    });
    return { totalReturn: +totalReturn.toFixed(2), totalStaked: +totalStaked.toFixed(2), wins, places, detail };
  }

  const ranked     = players.map(p => ({ ...p, ...calcPlayer(p) })).sort((a, b) => b.totalReturn - a.totalReturn);
  const me         = ranked.find(p => p.id === playerId);
  const hasResults = races.some(r => r.runners.some(h => h.sp));

  // Pull positions from API (no SPs available on free plan)
  async function fetchPositions() {
    setRef(true); setErr("");
    try {
      const data  = await apiGet(`/api/results`);
      const fresh = dbGet(ch.code) || ch;
      fresh.selectedRaces = mergePositions(fresh.selectedRaces || races, data);
      dbSet(fresh.code, fresh);
      setCh({ ...fresh });
      showToast("Positions loaded — please enter SPs below 📝");
    } catch (e) { setErr(e.message); }
    setRef(false);
  }

  // Save manually entered SPs
  function saveSPs() {
    const fresh = dbGet(ch.code) || ch;
    fresh.selectedRaces = applySPs(fresh.selectedRaces || races, spInputs);
    dbSet(fresh.code, fresh);
    setCh({ ...fresh });
    showToast("SPs saved! 🏆");
    setSpInputs({});
  }

  function setSpInput(raceId, horseId, val) {
    setSpInputs(prev => ({
      ...prev,
      [raceId]: { ...(prev[raceId] || {}), [horseId]: val }
    }));
  }

  // For each race, which horses need an SP entered?
  // = winner always + any placed horses (for EW bets)
  function getSpNeeded(race) {
    if (!race.resultIn) return [];
    const maxPlace = race.ewTerms?.places || 1;
    return race.runners
      .filter(h => h.position && h.position >= 1 && h.position <= maxPlace)
      .sort((a, b) => a.position - b.position);
  }

  // Show a human-readable countdown to next auto-fetch
  function fmtNextFetch(ms) {
    if (!ms || ms <= 0) return null;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins > 0) return `~${mins}m`;
    return `${secs}s`;
  }
  const pendingCount = races.filter(r => !r.resultIn).length;

  return (
    <div style={{ paddingTop: 22 }} className="fade">
      <Toast msg={toast} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 10 }} onClick={onBack}>← Back</button>
          <div className="eyebrow">Results</div>
          <div className="sec-title" style={{ marginBottom: 0 }}>{races.length} races · 2pts per race</div>
        </div>
        {isCreator && (
          <button className="btn btn-blue btn-sm" onClick={fetchPositions} disabled={refreshing}>
            {refreshing ? "Loading…" : "🏁 Load Results"}
          </button>
        )}
      </div>

      {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

      {/* SP Entry section — shown to creator once positions are loaded */}
      {isCreator && races.some(r => r.resultIn) && (
        <div className="sp-section">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            📝 Enter Starting Prices
          </div>
          <div style={{ color: "#b36000", fontSize: 13, marginBottom: 14 }}>
            Enter the SP for the winner (and placed horses where EW bets were taken). Use fractional format e.g. <strong>5/1</strong>, <strong>11/4</strong>, or <strong>Evs</strong>.
          </div>
          {races.filter(r => r.resultIn).map(race => {
            const needed = getSpNeeded(race);
            if (!needed.length) return null;
            return (
              <div key={race.id} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  <span className="time-badge">{race.time}</span>{race.course}
                </div>
                {needed.map(h => {
                  const posClass = h.position === 1 ? "winner" : "placed";
                  const posLabel = h.position === 1 ? "1" : h.position === 2 ? "2" : h.position === 3 ? "3" : String(h.position);
                  const posCircle = h.position <= 3 ? `pos-${h.position}` : "pos-n";
                  const currentSP = h.sp || (spInputs[race.id]?.[h.id] ?? "");
                  return (
                    <div key={h.id} className={`sp-row ${posClass}`} style={{ marginBottom: 6 }}>
                      <span className={`pos-badge ${posCircle}`}>{posLabel}</span>
                      <span className="sp-horse">{h.name}</span>
                      {h.sp
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: C.win }}>✓ {h.sp}</span>
                        : <input
                            className="sp-inp"
                            placeholder="e.g. 5/1"
                            value={spInputs[race.id]?.[h.id] || ""}
                            onChange={e => setSpInput(race.id, h.id, e.target.value)}
                          />
                      }
                    </div>
                  );
                })}
              </div>
            );
          })}
          {races.some(r => r.resultIn) && (
            <button className="btn btn-pink" style={{ marginTop: 4 }} onClick={saveSPs}
              disabled={!races.filter(r => r.resultIn).some(race =>
                getSpNeeded(race).some(h => !h.sp && spInputs[race.id]?.[h.id])
              )}>
              Save SPs &amp; Calculate Returns
            </button>
          )}
        </div>
      )}

      {!races.some(r => r.resultIn) && (
        <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
          <div style={{ color: C.muted, lineHeight: 1.65, fontWeight: 500 }}>
            {isCreator
              ? "Once races are run, hit 'Load Results' to pull finishing positions, then enter SPs manually."
              : "Waiting for the organiser to load results and enter SPs."}
          </div>
        </div>
      )}

      {me && (
        <div className="card card-pink" style={{ marginBottom: 20, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your Returns · {me.name}</div>
          <div className="pts-big">{fmtPts(me.totalReturn)}</div>
          <div className="pts-sub">
            {me.wins} winner{me.wins !== 1 ? "s" : ""}
            {me.places > 0 ? ` · ${me.places} placed` : ""}
            {me.napRaceId ? " · NAP ⭐" : ""}
            {" "}· {me.totalStaked} pts staked
          </div>
          {hasResults && (
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 600, color: me.totalReturn >= me.totalStaked ? C.win : C.danger }}>
              {me.totalReturn >= me.totalStaked
                ? `+${(me.totalReturn - me.totalStaked).toFixed(2)} pts profit 🎉`
                : me.totalReturn === 0 ? "No returns — better luck next time"
                : `-${(me.totalStaked - me.totalReturn).toFixed(2)} pts`}
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        {[["board","🏆 Leaderboard"],["card","📋 Race Card"],["mine","My Picks"]].map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "board" && (
        <div className="fade">
          {ranked.map((p, i) => (
            <div key={p.id} className={`lb-row${i === 0 ? " p1" : ""}`}>
              <div className="lb-rank">{i === 0 ? "🏆" : i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {p.name}{p.id === ch.creatorId ? " 👑" : ""}
                  {p.id === playerId ? <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}> (you)</span> : ""}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                  {p.wins}W{p.places > 0 ? ` · ${p.places}P` : ""}{p.napRaceId ? " · NAP ⭐" : ""} · {p.totalStaked} pts staked
                  {!p.picksSubmitted ? " · ⏳ pending" : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lb-pts">{fmtPts(p.totalReturn)}</div>
                {hasResults && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: p.totalReturn >= p.totalStaked ? C.win : C.muted }}>
                    {p.totalReturn >= p.totalStaked ? `+${(p.totalReturn - p.totalStaked).toFixed(2)}` : p.totalReturn === 0 ? "—" : `-${(p.totalStaked - p.totalReturn).toFixed(2)}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "card" && (
        <div className="fade">
          {races.map((race, i) => {
            const winner = race.runners.find(h => h.position === 1);
            return (
              <div key={race.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div className="eyebrow">Race {i + 1}</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>
                      <span className="time-badge">{race.time}</span>{race.course}
                    </div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                      {race.name}
                      {race.ewTerms ? <span className="ew-terms">{race.ewTerms.places} places · 1/{race.ewTerms.fraction}</span> : <span style={{ color: C.mutedLt, fontSize: 12, marginLeft: 8 }}>Win only</span>}
                    </div>
                  </div>
                  {winner
                    ? <span className="badge b-green">🏆 {winner.name}{winner.sp ? ` @ ${fmtSP(winner.sp)}` : ""}</span>
                    : <span className="badge b-grey">Pending</span>}
                </div>
                <div className="horse-grid">
                  {race.runners.map(h => {
                    const isWin   = h.position === 1;
                    const isPlace = !isWin && h.position && race.ewTerms && h.position <= race.ewTerms.places;
                    return (
                      <button key={h.id} className={`hbtn${isWin ? " won" : isPlace ? " placed" : ""}`} style={{ cursor: "default" }}>
                        <span>{h.position ? `${h.position}. ` : ""}{h.name}{isPlace ? <span style={{ fontSize: 11, marginLeft: 4, opacity: .7 }}> P</span> : ""}</span>
                        <span className="sp-chip">{fmtSP(h.sp)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "mine" && me && (
        <div className="fade">
          {me.detail.map(({ race, horse, betType, isNap, ret }, i) => {
            const isWin     = horse?.position === 1;
            const isPlace   = !isWin && ret.place > 0;
            const isPending = horse && !race.resultIn;
            const isLoser   = horse && race.resultIn && !isWin && !isPlace;
            const borderCol = isWin ? C.win : isPlace ? C.place : isLoser ? C.danger : C.border;
            const icon      = isPending ? "🕐" : isWin ? "🏆" : isPlace ? "🟣" : isLoser ? "✗" : "";
            const nameCol   = isWin ? C.win : isPlace ? C.place : isLoser ? C.danger : C.muted;
            return (
              <div key={race.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${borderCol}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div className="eyebrow">Race {i + 1} · {race.course} {race.time}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: nameCol, marginTop: 4 }}>
                      {horse ? `${icon} ${horse.name}` : "No selection"}
                      {horse?.sp ? <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, opacity: .75 }}>@ {fmtSP(horse.sp)}</span> : ""}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
                      {betType === "ew" ? "Each-Way — 1pt e/w" : "Win only"} · {ret.staked} pts staked{isNap ? " (NAP ⭐)" : ""}
                      {betType === "ew" && race.ewTerms && <span style={{ marginLeft: 6 }}>({race.ewTerms.places} places, 1/{race.ewTerms.fraction})</span>}
                    </div>
                    {betType === "ew" && hasResults && horse && (
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
                        Win: <span style={{ color: ret.win > 0 ? C.win : C.muted, fontWeight: 600 }}>{fmtPts(ret.win)}</span>
                        {" · "}Place: <span style={{ color: ret.place > 0 ? C.place : C.muted, fontWeight: 600 }}>{fmtPts(ret.place)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Returns</div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: ret.total > 0 ? C.pink : C.muted }}>
                      {hasResults ? fmtPts(ret.total) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <hr />
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.muted, fontSize: 13, fontWeight: 500 }}>Total staked: {me.totalStaked} pts{me.napRaceId ? " (incl. NAP ⭐)" : ""}</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: C.pink, marginTop: 4 }}>
              Returns: {fmtPts(me.totalReturn)}
            </div>
            {hasResults && (
              <div style={{ fontSize: 15, marginTop: 4, fontWeight: 600, color: me.totalReturn >= me.totalStaked ? C.win : C.danger }}>
                {me.totalReturn >= me.totalStaked ? `Profit: +${(me.totalReturn - me.totalStaked).toFixed(2)} pts` : `Loss: -${(me.totalStaked - me.totalReturn).toFixed(2)} pts`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [ch,     setCh]     = useState(null);
  const [pid,    setPid]    = useState(null);
  const [player, setPlayer] = useState(null);

  const isCreator = ch?.creatorId === pid;

  function handleCreate(name) {
    const code = genCode(5), playerId = genCode(8);
    const p = { id: playerId, name, picks: {}, picksSubmitted: false };
    const newCh = { code, creatorId: playerId, status: "open", day: "today", players: { [playerId]: p }, selectedRaces: [], selectedRaceIds: [], racecards: [] };
    dbSet(code, newCh);
    setCh(newCh); setPid(playerId); setPlayer(p);
    setScreen("setup");
  }

  function handleJoin(existingCh, name) {
    const playerId = genCode(8);
    const p = { id: playerId, name, picks: {}, picksSubmitted: false };
    const fresh = dbGet(existingCh.code) || existingCh;
    fresh.players[playerId] = p;
    dbSet(fresh.code, fresh);
    setCh(fresh); setPid(playerId); setPlayer(p);
    setScreen(fresh.status === "selections" ? "picks" : "lobby");
  }

  function handleSetupSave(updated) { setCh(updated); setScreen("lobby"); }
  function handleLobbyAction(action, updated) { if (updated) setCh(updated); setScreen(action); }
  function handlePicksSubmit(updatedCh, updatedPlayer) { setCh(updatedCh); setPlayer(updatedPlayer); setScreen("results"); }

  const showCtx = screen !== "home" && ch;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{GLOBAL_CSS}</style>

      <div className="hdr">
        <div className="hdr-eye">THE RACING CHALLENGE</div>
        <div className="hdr-title">🏇 Racing <span className="hdr-pink">Challenge</span></div>
        <div className="hdr-sub">PICK · COMPETE · COLLECT</div>
      </div>

      <div className="wrap">
        {showCtx && (
          <div className="ctx-strip">
            <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>
              Code <span className="ctx-code">{ch.code}</span>
              {player && <span style={{ marginLeft: 10 }}>· {player.name}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {screen !== "lobby"   && <button className="btn btn-ghost btn-sm" onClick={() => setScreen("lobby")}>Lobby</button>}
              {screen !== "picks"   && ch?.status === "selections" && <button className="btn btn-ghost btn-sm" onClick={() => setScreen("picks")}>My Picks</button>}
              {screen !== "results" && <button className="btn btn-ghost btn-sm" onClick={() => setScreen("results")}>Results</button>}
            </div>
          </div>
        )}

        {screen === "home"    && <HomeScreen    onCreate={handleCreate} onJoin={handleJoin} />}
        {screen === "setup"   && ch && <SetupScreen   challenge={ch} onSave={handleSetupSave} onBack={() => setScreen("home")} />}
        {screen === "lobby"   && ch && <LobbyScreen   challenge={ch} playerId={pid} onAction={handleLobbyAction} onBack={() => setScreen("home")} />}
        {screen === "picks"   && ch && <PicksScreen   challenge={ch} playerId={pid} onSubmit={handlePicksSubmit} onBack={() => setScreen("lobby")} />}
        {screen === "results" && ch && <ResultsScreen challenge={ch} playerId={pid} isCreator={isCreator} onBack={() => setScreen("lobby")} />}
      </div>
    </div>
  );
}
