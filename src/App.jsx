import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off } from "firebase/database";

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:       import.meta.env.VITE_FIREBASE_APP_ID,
};
const fbApp = initializeApp(firebaseConfig);
const db    = getDatabase(fbApp);

// Firebase stores arrays as objects with numeric keys — normalise on read
function toArr(val) {
  // Firebase converts arrays to {0:.., 1:..} objects — convert back
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val).sort((a,b) => Number(a)-Number(b)).map(k => val[k]).filter(Boolean);
}

function normaliseChallenge(data) {
  if (!data) return data;
  const ch = { ...data };
  // Normalise selectedRaces array + runners arrays + numeric positions + keep sp
  ch.selectedRaces = toArr(ch.selectedRaces).map(race => {
    if (!race) return null;
    const runners = toArr(race.runners).map(h => ({
      ...h,
      position: h.position != null && h.position !== "" ? parseInt(h.position) : null,
      sp: h.sp || null,
      spDec: h.spDec != null ? parseFloat(h.spDec) : null,
    }));
    return { ...race, runners };
  }).filter(Boolean);
  return ch;
}

async function dbGet(code) {
  try {
    const snap = await get(ref(db, `challenges/${code}`));
    return snap.exists() ? normaliseChallenge(snap.val()) : null;
  } catch { return null; }
}
async function dbSet(code, val) {
  try { await set(ref(db, `challenges/${code}`), val); } catch {}
}
function dbListen(code, cb) {
  const r = ref(db, `challenges/${code}`);
  onValue(r, snap => { if (snap.exists()) cb(normaliseChallenge(snap.val())); });
  return () => off(r);
}

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
  .course-accordion { border: 1.5px solid ${C.border}; border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: #fff; }
  .course-header { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; cursor: pointer; user-select: none; background: #fff; transition: background .15s; }
  .course-header:hover { background: ${C.bg}; }
  .course-header.has-sel { background: ${C.pinkBg}; border-bottom: 1.5px solid ${C.pink}; }
  .course-chevron { font-size: 11px; color: ${C.muted}; transition: transform .2s; }
  .course-chevron.open { transform: rotate(180deg); }
  .course-races { border-top: 1.5px solid ${C.border}; }
  .course-race-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px; cursor: pointer; border-bottom: 1px solid ${C.bg}; transition: background .15s; }
  .course-race-row:last-child { border-bottom: none; }
  .course-race-row:hover { background: ${C.bg}; }
  .course-race-row.sel { background: ${C.pinkBg}; }
  .race-row:hover { border-color: ${C.blue}; box-shadow: 0 3px 14px rgba(26,127,212,.1); transform: translateY(-1px); }
  .race-row.sel { border-color: ${C.pink}; background: ${C.pinkBg}; box-shadow: 0 3px 14px rgba(255,10,108,.12); }

  .horse-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; }
  @media(max-width:420px){ .horse-grid { grid-template-columns: 1fr; } }
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

  .home-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: stretch; }
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
  .hbtn.has-pick { border-color: ${C.pink}; background: ${C.pinkBg}; }

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
function calcSelectionReturn(sp, betType, position, ewTerms, isNap = false, spDec = null) {
  // Use pre-calculated decimal from API if available, otherwise parse fractional string
  const dec = spDec != null ? spDec : spToDecimal(sp);
  // Always parse position as integer — API returns strings
  const pos = (position !== null && position !== undefined) ? parseInt(position) : null;
  if (!dec) return { win: 0, place: 0, total: 0, staked: betType === "ew" ? (isNap ? 4 : 2) : (isNap ? 4 : 2) };
  const mult = isNap ? 2 : 1;
  if (betType === "win") {
    const staked = 2 * mult;
    const ret = pos === 1 ? +(staked * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret, staked };
  }
  if (!ewTerms) {
    const staked = 2 * mult;
    const ret = pos === 1 ? +(staked * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret, staked, winOnly: true };
  }
  const winStake   = 1 * mult;
  const placeStake = 1 * mult;
  const staked     = winStake + placeStake;
  const winRet     = pos === 1 ? +(winStake * dec).toFixed(2) : 0;
  const placeOdds  = +((dec - 1) / ewTerms.fraction + 1).toFixed(4);
  const placed     = pos !== null && pos >= 1 && pos <= ewTerms.places;
  const placeRet   = placed ? +(placeStake * placeOdds).toFixed(2) : 0;
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

// ─── DB (Firebase) — see top of file ────────────────────────────────────────

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt.substring(0, 160)}`);
  }
  return res.json();
}

// Complete list of UK & Irish racecourses — filters out international races
const UK_IRE_COURSES = [
  "aintree","ascot","bath","beverley","brighton","carlisle","cartmel","catterick",
  "cheltenham","chelmsford","chelmsford city","chepstow","chester","doncaster",
  "epsom","epsom downs","exeter","fakenham","ffos las","fontwell","fontwell park",
  "goodwood","great yarmouth","yarmouth","hamilton","hamilton park","haydock",
  "haydock park","hereford","hexham","huntingdon","kempton","kempton park",
  "leicester","lingfield","lingfield park","ludlow","market rasen","musselburgh",
  "newbury","newcastle","newmarket","newton abbot","nottingham","perth","plumpton",
  "pontefract","redcar","ripon","salisbury","sandown","sandown park","sedgefield",
  "southwell","stratford","taunton","thirsk","towcester","uttoxeter","warwick",
  "wetherby","wincanton","windsor","wolverhampton","worcester","york",
  "ayr","bangor","kelso",
  "ballinrobe","bellewstown","clonmel","cork","curragh","the curragh","dundalk",
  "fairyhouse","galway","gowran","gowran park","kilbeggan","killarney","laytown",
  "leopardstown","limerick","listowel","naas","navan","punchestown","roscommon",
  "sligo","thurles","tipperary","tramore","waterford","wexford",
  "down royal","downpatrick",
];
function isUKIrish(course) {
  const c = (course || "").toLowerCase().trim();
  return UK_IRE_COURSES.some(k => c.includes(k) || k.includes(c));
}

function parseRacecards(data) {
  const list = data.racecards || data.results || (Array.isArray(data) ? data : []);
  return list.filter(r => isUKIrish(r.course || r.venue || "")).map(r => {
    const isHandicap = /handicap/i.test(r.race_name || r.name || "");
    const runners = (r.runners || []).map(h => ({
      id:       h.horse_id || h.id || h.horse,
      name:     h.horse || h.name || "Unknown",
      number:   h.number || h.cloth || "",
      draw:     h.draw || "",
      jockey:   h.jockey || "",
      trainer:  h.trainer || "",
      form:     h.form || "",
      ofr:      h.ofr || "",
      ts:       h.ts || "",
      lbs:      h.lbs || "",
      headgear: h.headgear || "",
      age:      h.age || "",
      sex:      h.sex_code || h.sex || "",
      colour:   h.colour || "",
      lastRun:  h.last_run || "",
      sire:     h.sire || "",
      dam:      h.dam || "",
      sp: null, position: null, win: false,
    }));
    return {
      id: r.race_id || r.id || `${r.course}-${r.off}`,
      course: r.course || "Unknown",
      date: r.date || r.race_date || "",
      time: (t => {
        const mm = String(t || "").match(/(\d{1,2}):(\d{2})/);
        if (!mm) return t || "";
        const h = parseInt(mm[1]), mn = mm[2];
        return (h < 10 ? h + 12 : h) + ":" + mn;
      })(r.off_time || r.off || r.time),
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
function normTime(t) {
  // Convert any time to 24hr "HH:MM" for comparison
  // Handles: "2:30" (12hr AM/PM ambiguous), "14:30" (already 24hr)
  // Racing times are always afternoon/evening so hour < 10 means add 12
  if (!t) return "";
  const m = String(t).trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = parseInt(m[1]);
  const h24 = h < 10 ? h + 12 : h; // 1-9 -> 13-21, 10-23 unchanged
  return `${String(h24).padStart(2,"0")}:${m[2]}`;
}

function normCourse(c) {
  // Strip country suffixes e.g. "Wexford (IRE)" -> "wexford"
  return (c || "").replace(/[(][A-Z]{2,3}[)]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

function mergePositions(races, data) {
  const allResults = toArr(data.results || (Array.isArray(data) ? data : []));

  // Filter to UK/Irish results only — same whitelist as racecards
  const list = allResults.filter(r => isUKIrish(r.course || r.venue || "")).map(r => ({
    ...r,
    _course:  normCourse(r.course || r.venue || ""),
    // Results API uses 'off' field for time, not 'off_time'
    _time:    normTime(r.off || r.off_time || r.time || ""),
    // Capture the result date so we never match tomorrow's races against today's results
    _date:    r.date || r.race_date || "",
    runners:  toArr(r.runners),
  }));

  console.log(`mergePositions: ${races.length} challenge races, ${allResults.length} total API results, ${list.length} UK/Irish`);
  console.log("UK/Irish results:", list.map(r => `${r.course} ${r._time}`));

  function findResult(race) {
    const rCourse = normCourse(race.course);
    const rTime   = normTime(race.time);
    // 1. Direct ID match — still check date matches if both have dates
    let res = list.find(r => {
      if ((r.race_id || r.id) !== race.id) return false;
      // If result has a date, it must match the race date
      if (r._date && race.date && r._date !== race.date) return false;
      return true;
    });
    if (res) { console.log(`  ✅ ${race.course} ${race.time} matched by ID`); return res; }
    // 2. Course + time + date
    // Only block if BOTH sides have a date and they differ — missing date = no block
    const raceDate = race.date || "";
    res = list.find(r => {
      if (r._time !== rTime) return false;
      if (!(r._course.includes(rCourse) || rCourse.includes(r._course))) return false;
      if (r._date && raceDate && r._date !== raceDate) {
        console.log(`  ⚠️ Blocked ${race.course} ${race.time} — result date ${r._date} ≠ race date ${raceDate}`);
        return false;
      }
      return true;
    });
    if (res) { console.log(`  ✅ ${race.course} ${race.time} matched by course+time+date`); return res; }
    console.log(`  ❌ No match for ${race.course} ${race.time} (looking for course=${rCourse} time=${rTime} date=${race.date || "?"})`);
    if (list.length) console.log(`     Available: ${list.slice(0,5).map(r => `${r._course} ${r._time} ${r._date}`).join(", ")}`);
    return null;
  }

  // Strip country suffix e.g. "Horse Name (IRE)" -> "horsename"
  function stripName(n) {
    return (n || "").replace(/[(][A-Z]{2,3}[)]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  }

  return races.map(race => {
    const res = findResult(race);
    if (!res) return race;

    // Only mark resultIn if the result actually has finishing positions
    const hasPositions = res.runners && toArr(res.runners).some(r => r.position != null && r.position !== "");
    if (!hasPositions) {
      console.log(`  Skipping ${race.course} ${race.time} — result found but no positions yet`);
      return race;
    }

    // Log what names the results API is using for this race
    console.log(`  Result runners for ${race.course} ${race.time}:`, toArr(res.runners).slice(0,3).map(r => r.horse || r.name));

    const runners = race.runners.map(h => {
      const hName = stripName(h.name);
      const rh = toArr(res.runners).find(x =>
        (x.horse_id || x.id) === h.id ||
        stripName(x.horse || x.name || "") === hName
      );
      if (!rh) { console.log(`    No match: "${h.name}" (${hName})`); return h; }
      const pos = rh.position != null && rh.position !== "" ? parseInt(rh.position) : null;
      // Basic plan includes SP — capture it directly from results
      const sp     = rh.sp || rh.starting_price || h.sp || null;       // fractional string for display
      const spDec  = rh.sp_dec != null ? parseFloat(rh.sp_dec) : null; // decimal for calculation
      console.log(`    Matched: "${h.name}" -> pos ${pos} sp ${sp} sp_dec ${spDec}`);
      return { ...h, position: isNaN(pos) ? null : pos, win: pos === 1, sp, spDec };
    });
    // Use actual starters from results API — NRs are in res.non_runners string, not res.runners array
    const actualRan = toArr(res.runners).length;
    const ewRan = actualRan > 0 ? actualRan : runners.length;
    return { ...race, runners, ewTerms: getEWTerms(ewRan, race.isHandicap), resultIn: true };
  });
}

// applySPs removed — SPs now populated automatically from Basic API plan

// Sort races chronologically by time
function lbsToStone(lbs) {
  const n = parseInt(lbs);
  if (!n) return "";
  return `${Math.floor(n/14)}-${n%14}`;
}

function fmtHeadgear(hg) {
  if (!hg) return "";
  const map = { b:"Blinkers", p:"Cheekpieces", v:"Visor", h:"Hood",
                t:"Tongue Tie", e:"Eyeshield", c:"Crossed Noseband" };
  return hg.split("").map(c => map[c] || c).join(", ");
}

function sortRaces(races) {
  return [...races].sort((a, b) => {
    const ta = (a.time || "").replace(":", "").padStart(4, "0");
    const tb = (b.time || "").replace(":", "").padStart(4, "0");
    return ta.localeCompare(tb);
  });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
// ─── LOCK / NON-RUNNER HELPERS ───────────────────────────────────────────────
// Parse "HH:MM" time string into a Date object
// day can be: "today", "tomorrow", or a YYYY-MM-DD date string
function raceTimeToDate(timeStr, day) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hours = parseInt(m[1]), mins = parseInt(m[2]);
  if (hours < 10) hours += 12;
  // Resolve the date
  let ukDate;
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    // Already a YYYY-MM-DD date string — use directly
    ukDate = day;
  } else {
    const base = new Date();
    if (day === "tomorrow") base.setDate(base.getDate() + 1);
    ukDate = base.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  }
  const ukMidnight = new Date(`${ukDate}T00:00:00Z`);
  const ukOffsetMs = new Date(ukMidnight.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime()
                   - new Date(ukMidnight.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(ukMidnight.getTime() - ukOffsetMs + (hours * 60 + mins) * 60000);
}

// Is it past the first race off time?
function isChallengeLocked(ch) {
  const races = ch.selectedRaces || [];
  if (!races.length) return false;
  const sorted = [...races].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const firstOff = raceTimeToDate(sorted[0]?.time, ch.day);
  if (!firstOff) return false;
  return Date.now() >= firstOff.getTime();
}

// Can a player still change picks for a specific race? (before that race's off time)
function isRaceOpen(race, day) {
  const off = raceTimeToDate(race.time, day);
  if (!off) return false;
  return Date.now() < off.getTime();
}

function Loader() { return <div className="loader"><span/><span/><span/></div>; }
function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null; }

// ── ADD TO HOME SCREEN ───────────────────────────────────────────────────────
function useA2HS() {
  const [prompt, setPrompt] = useState(null);
  const [isIOS, setIsIOS]   = useState(false);
  const [shown,  setShown]  = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.navigator.standalone;
    setIsIOS(ios && !standalone);

    // Android/Chrome beforeinstallprompt
    const handler = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function trigger() {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setPrompt(null);
    }
    setShown(true);
  }

  const canShow = (prompt || isIOS) && !shown;
  return { canShow, isIOS, trigger, dismiss: () => setShown(true) };
}

function A2HSBanner() {
  const { canShow, isIOS, trigger, dismiss } = useA2HS();
  if (!canShow) return null;
  return (
    <div style={{ background: C.text, color: "#fff", borderRadius: 0,
      padding: "8px 16px", display: "flex", alignItems: "center", gap: 10,
      margin: "0 -16px", fontSize: 12 }}>
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        {isIOS
          ? <>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for quick access</>
          : <><strong>Add to Home Screen</strong> for quick access on race day</>
        }
      </div>
      {!isIOS && (
        <button onClick={trigger}
          style={{ background: C.pink, border: "none", color: "#fff", borderRadius: 6,
            padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          Add
        </button>
      )}
      <button onClick={dismiss}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)",
          fontSize: 16, cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}

// ── ABOUT MODAL ──────────────────────────────────────────────────────────────
function AboutModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div style={{ background: "rgba(0,0,0,.45)", position: "absolute", inset: 0 }} />
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
          position: "relative", zIndex: 1, maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,.15)", animation: "slideUp .25s ease" }}>
        <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/icons/logo-transparent.png" alt="StableMates" style={{ width: 80, height: 80, marginBottom: 8 }} />
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text }}>StableMates</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Free to play · No account needed</div>
        </div>
        {[
          { icon: "👥", title: "Racing is better with mates", desc: "Turn a Saturday card into a proper occasion. A shared leaderboard gives every race meaning — whether you're watching trackside, in the pub, or across three different sofas." },
          { icon: "🧠", title: "Sharpen your eye for a horse", desc: "Having a stake in every race forces you to study the form, weigh up the jockey, consider the going. Week by week you'll develop instincts that take real punters years to build." },
          { icon: "🍾", title: "All the thrill, none of the risk", desc: "StableMates gives you the rush of watching your pick come home at 10/1 — the anticipation, the heartbreak, the glory — completely free." },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{ display: "flex", gap: 14, marginBottom: 16, padding: "14px 16px",
            background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: C.mutedLt, textAlign: "center", marginTop: 8 }}>
          For entertainment purposes only · Please gamble responsibly<br/>
          <a href="/privacy" target="_blank" style={{ color: C.muted, fontSize: 12 }}>Privacy Policy</a>
        </div>
        <button onClick={onClose}
          style={{ width: "100%", padding: 14, background: C.pink, color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", marginTop: 20 }}>
          Let's Play 🐴
        </button>
      </div>
    </div>
  );
}

// ── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARDING_KEY = "sm_onboarded";

function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: "🏇",
      title: "Pick a winner in every race",
      desc: "Choose one horse per race. Go each-way if you want a place as well as a win. You have 2pts to stake on each race.",
    },
    {
      icon: "⭐",
      title: "Set your NAP",
      desc: "One race per challenge you can double your stake — your strongest fancy. Pick wisely, it can make or break your leaderboard position.",
    },
    {
      icon: "🏆",
      title: "Returns at Starting Price",
      desc: "All returns are calculated at the official SP — exactly how a bookmaker pays out. The leaderboard updates live as races finish.",
    },
    {
      icon: "🍾",
      title: "No money involved",
      desc: "StableMates is free to play. Points are virtual — all the thrill of backing a winner, none of the financial risk.",
    },
  ];

  const step_data = steps[step];
  const isLast = step === steps.length - 1;

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onDone();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", alignItems: "flex-end",
      background: "rgba(0,0,0,.5)" }} onClick={isLast ? finish : undefined}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "32px 24px 48px",
          width: "100%", maxHeight: "80vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,.2)", animation: "slideUp .25s ease" }}>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4,
              background: i === step ? C.pink : C.border, transition: "all .2s" }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{step_data.icon}</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: C.text, marginBottom: 12 }}>
            {step_data.title}
          </div>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.65, maxWidth: 360, margin: "0 auto" }}>
            {step_data.desc}
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, padding: 14, background: C.bg, border: `1.5px solid ${C.border}`,
                borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: C.muted }}>
              Back
            </button>
          )}
          <button onClick={isLast ? finish : () => setStep(s => s + 1)}
            style={{ flex: 2, padding: 14, background: C.pink, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit" }}>
            {isLast ? "Let's Play 🐴" : "Next →"}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button onClick={finish}
              style={{ background: "none", border: "none", color: C.mutedLt, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit" }}>
              Skip intro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeScreen({ onCreate, onJoin, openAbout }) {
  const [createName, setCreateName] = useState("");
  const [joinName,   setJoinName]   = useState("");
  const [joinCode,   setJoinCode]   = useState("");
  const [err,        setErr]        = useState("");

  async function handleJoin() {
    if (!joinName.trim() || joinCode.length < 5) return;
    const ch = await dbGet(joinCode.toUpperCase());
    if (!ch) { setErr("Challenge not found — check the code and try again."); return; }
    onJoin(ch, joinName.trim());
  }

  return (
    <div className="fade">
      <div className="home-grid" style={{ alignItems: "stretch" }}>
        <div className="card card-pink" style={{ display: "flex", flexDirection: "column" }}>
          <div className="eyebrow">Start a new game</div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14 }}>Create</div>
          <div className="field" style={{ flex: 1 }}>
            <label>Your name</label>
            <input className="inp" placeholder="e.g. Paddy" value={createName} onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createName.trim() && onCreate(createName.trim())} />
          </div>
          <button className="btn btn-pink" style={{ width: "100%", marginTop: "auto" }} disabled={!createName.trim()} onClick={() => onCreate(createName.trim())}>
            Create &amp; Get Code
          </button>
        </div>

        <div className="card card-blue" style={{ display: "flex", flexDirection: "column" }}>
          <div className="eyebrow">Join a friend's game</div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14 }}>Join</div>
          <div className="field">
            <label>Your name</label>
            <input className="inp" placeholder="e.g. Seamus" value={joinName} onChange={e => setJoinName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Challenge code</label>
            <input className="inp inp-code" placeholder="XXXXX" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5}
              onKeyDown={e => e.key === "Enter" && joinName.trim() && joinCode.length >= 5 && handleJoin()} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-blue" style={{ width: "100%", marginTop: "auto" }} disabled={!joinName.trim() || joinCode.length < 5} onClick={handleJoin}>
            Join Challenge
          </button>
        </div>
      </div>

      <p style={{ textAlign: "center", color: C.mutedLt, marginTop: 24, fontSize: 12, fontWeight: 500 }}>
        FOR ENTERTAINMENT PURPOSES ONLY · PLEASE GAMBLE RESPONSIBLY
      </p>
      <p style={{ textAlign: "center", marginTop: 6 }}>
        <a href="/privacy" target="_blank" style={{ color: C.mutedLt, fontSize: 12 }}>Privacy Policy</a>
      </p>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button onClick={() => openAbout && openAbout()}
          style={{ background: "none", border: "none", color: C.muted, fontSize: 13,
            cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
          What is StableMates?
        </button>
      </div>
    </div>
  );
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
// ── COURSE ACCORDION ─────────────────────────────────────────────────────────
function CourseAccordion({ racecards, selected, toggle, onSave }) {
  // Group races by course, preserving time order within each course
  const grouped = racecards.reduce((acc, r) => {
    (acc[r.course] = acc[r.course] || []).push(r);
    return acc;
  }, {});
  const courses = Object.keys(grouped).sort();

  // Track which courses are expanded — auto-open any with selections
  const [open, setOpen] = useState(() => new Set());

  function toggleCourse(course) {
    setOpen(prev => {
      const n = new Set(prev);
      n.has(course) ? n.delete(course) : n.add(course);
      return n;
    });
  }

  function selectAll(course, e) {
    e.stopPropagation();
    const races = grouped[course];
    const allSel = races.every(r => selected.has(r.id));
    races.forEach(r => {
      if (allSel) { if (selected.has(r.id)) toggle(r.id); }
      else        { if (!selected.has(r.id)) toggle(r.id); }
    });
  }

  return (
    <div className="fade">
      <p style={{ color: C.muted, marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
        Tap a course to expand — <strong style={{ color: C.pink }}>{selected.size} race{selected.size !== 1 ? "s" : ""} selected</strong>
      </p>

      {courses.map(course => {
        const races   = grouped[course];
        const selCount = races.filter(r => selected.has(r.id)).length;
        const allSel  = selCount === races.length;
        const isOpen  = open.has(course);

        return (
          <div key={course} className="course-accordion">
            <div className={`course-header${selCount > 0 ? " has-sel" : ""}`} onClick={() => toggleCourse(course)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: selCount > 0 ? C.pink : C.text }}>{course}</span>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{races.length} race{races.length !== 1 ? "s" : ""}</span>
                {selCount > 0 && (
                  <span className="badge b-pink" style={{ fontSize: 11, padding: "2px 8px" }}>
                    {selCount} selected
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isOpen && (
                  <button
                    style={{ fontSize: 12, color: allSel ? C.danger : C.blue, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                    onClick={e => selectAll(course, e)}>
                    {allSel ? "Deselect all" : "Select all"}
                  </button>
                )}
                <span className={`course-chevron${isOpen ? " open" : ""}`}>▼</span>
              </div>
            </div>

            {isOpen && (
              <div className="course-races">
                {races.map(r => {
                  const isSel = selected.has(r.id);
                  return (
                    <div key={r.id} className={`course-race-row${isSel ? " sel" : ""}`} onClick={() => toggle(r.id)}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isSel ? C.pink : C.text }}>
                          <span className="time-badge">{r.time}</span>
                          {r.name}
                          {r.isHandicap && <span style={{ fontSize: 11, color: C.muted, marginLeft: 6, fontWeight: 500 }}>HCP</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                          {r.runners.length} runners
                          {r.distance ? ` · ${r.distance}` : ""}
                          {r.going ? ` · ${r.going}` : ""}
                          {r.ewTerms ? ` · EW ${r.ewTerms.places} places` : " · Win only"}
                        </div>
                      </div>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{isSel ? "✅" : "⬜"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ textAlign: "center", marginTop: 22, marginBottom: 8 }}>
        <button className="btn btn-pink" disabled={selected.size === 0} onClick={onSave}>
          Save {selected.size} Race{selected.size !== 1 ? "s" : ""} →
        </button>
      </div>
    </div>
  );
}

function SetupScreen({ challenge, onSave, onBack }) {
  const [day,       setDay]       = useState("today");

  // Convert today/tomorrow to actual YYYY-MM-DD date for storage
  function resolveDate(d) {
    const base = new Date();
    if (d === "tomorrow") base.setDate(base.getDate() + 1);
    return base.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  }
  const [racecards, setRacecards] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [toast,     showToast]    = useToast();

  const [itvCard,   setItvCard]   = useState(null); // { raceIds, label }

  async function load() {
    setLoading(true); setError("");
    try {
      const data   = await apiGet(`/api/racecards?day=${day}`);
      const parsed = parseRacecards(data);
      setRacecards(parsed);
      if (!parsed.length) setError("No races found.");
      // Also fetch ITV card
      try {
        const itv = await apiGet('/api/itv');
        if (itv.raceIds?.length) setItvCard(itv);
      } catch {}
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function loadITVCard() {
    if (!itvCard?.raceIds?.length) return;
    const itvSet = new Set(itvCard.raceIds);
    // Select all races matching ITV race IDs
    setSelected(new Set(racecards.filter(r => itvSet.has(r.id)).map(r => r.id)));
    showToast(`${itvCard.label || "ITV Card"} loaded ✅`);
  }

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    const selectedRaces = racecards.filter(r => selected.has(r.id));
    const updated = { ...challenge, day: resolveDate(day), racecards, selectedRaceIds: [...selected], selectedRaces, status: "open" };
    await dbSet(updated.code, updated);
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
        {itvCard?.raceIds?.length > 0 && racecards.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-pink" onClick={loadITVCard} style={{ width: "100%" }}>
              📺 Load {itvCard.label || "ITV Card"}
            </button>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, textAlign: "center" }}>
              Pre-selects this week's ITV featured races
            </div>
          </div>
        )}
        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {loading && <Loader />}

      {racecards.length > 0 && (
        <CourseAccordion racecards={racecards} selected={selected} toggle={toggle} onSave={save} />
      )}
    </div>
  );
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────
function LobbyScreen({ challenge, playerId, onAction, onBack, deepLink }) {
  const [toast,  showToast] = useToast();
  const [ch,     setCh]     = useState(challenge);
  const isCreator           = ch.creatorId === playerId;
  const players             = Object.values(ch.players || {});

  useEffect(() => {
    return dbListen(ch.code, fresh => setCh(fresh));
  }, [ch.code]);

  function copy() {
    navigator.clipboard?.writeText(ch.code).catch(() => {});
    showToast("Code copied! 📋");
  }

  function copyLink() {
    if (deepLink) {
      navigator.clipboard?.writeText(deepLink).catch(() => {});
      showToast("Personal link copied! 🔗");
    }
  }

  async function lockAndOpen() {
    const updated = { ...ch, status: "selections" };
    await dbSet(ch.code, updated);
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
        {deepLink && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-outline btn-sm" onClick={copyLink}>
              🔗 Copy my personal rejoin link
            </button>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              Save this link — it takes you straight back in if you close the app
            </div>
          </div>
        )}
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

// ── RUNNER CARD (slide-up detail panel) ──────────────────────────────────────
function RunnerCard({ horse, onClose }) {
  if (!horse) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div style={{ background: "rgba(0,0,0,.45)", position: "absolute", inset: 0 }} />
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
          position: "relative", zIndex: 1, maxHeight: "80vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,.2)", animation: "slideUp .25s ease" }}>
        <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />

        {/* Header: silk + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>

          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
              {horse.number ? `${horse.number}. ` : ""}{horse.name}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {[horse.age && `${horse.age}yo`, horse.sex, horse.colour].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            ["Form",     horse.form     || "–"],
            ["Weight",   horse.lbs      ? lbsToStone(horse.lbs) : "–"],
            ["Draw",     horse.draw     || "–"],
            ["OR",       horse.ofr      || "–"],
            ["Last Run", horse.lastRun  ? `${horse.lastRun}d` : "–"],
            ["Headgear", horse.headgear || "–"],
          ].map(([label, val]) => (
            <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Jockey */}
        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Jockey</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{horse.jockey || "–"}</div>
        </div>

        {/* Trainer + form */}
        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Trainer</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{horse.trainer || "–"}</div>
        </div>

        {/* Breeding */}
        {(horse.sire || horse.dam) && (
          <div style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Breeding</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              {horse.sire && <span>By <strong style={{ color: C.text }}>{horse.sire}</strong></span>}
              {horse.dam && <span> · Dam: <strong style={{ color: C.text }}>{horse.dam}</strong></span>}
            </div>
          </div>
        )}

        {/* Previous runs — lazy loaded */}
        <PreviousRuns horseId={horse.id} horseName={horse.name} />

        <button onClick={onClose}
          style={{ width: "100%", padding: "14px", background: C.pink, color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
          Close
        </button>
      </div>
    </div>
  );
}

function PreviousRuns({ horseId, horseName }) {
  const [runs,    setRuns]    = useState(null);  // null = not loaded
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/horse-results?horseId=${horseId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Extract just this horse's runs from each race
      const parsed = (data.results || []).map(race => {
        const runner = (race.runners || []).find(r => r.horse_id === horseId);
        if (!runner) return null;
        return {
          date:    race.date,
          course:  race.course,
          dist:    race.dist_f || race.dist,
          going:   race.going,
          type:    race.type,
          class:   race.class,
          name:    race.race_name,
          pos:     runner.position,
          ran:     (race.runners || []).length,
          wgt:     runner.weight,
          or:      runner.or,
          sp:      runner.sp,
          hg:      runner.headgear,
          jockey:  runner.jockey,
          comment: runner.comment,
        };
      }).filter(Boolean);
      setRuns(parsed);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  const posColour = (pos) => {
    if (pos === "1") return C.win;
    if (pos === "2" || pos === "3") return C.place;
    return C.muted;
  };

  if (runs === null && !loading) return (
    <div style={{ marginTop: 8 }}>
      <button onClick={load}
        style={{ width: "100%", padding: "10px", background: C.bg, border: `1.5px solid ${C.border}`,
          borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.blue, cursor: "pointer", fontFamily: "inherit" }}>
        📋 Load Previous Runs
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "16px", color: C.muted, fontSize: 14 }}>Loading runs…</div>
  );

  if (error) return (
    <div style={{ padding: "10px", color: C.danger, fontSize: 13, background: "#fff5f5", borderRadius: 8 }}>
      Could not load runs: {error}
    </div>
  );

  if (!runs.length) return (
    <div style={{ padding: "10px", color: C.muted, fontSize: 13 }}>No previous runs found.</div>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
        Previous Runs ({runs.length})
      </div>
      {runs.map((run, i) => {
        const isWin = run.pos === "1";
        const isPlace = run.pos === "2" || run.pos === "3";
        return (
          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6,
            background: isWin ? "#f0fff4" : isPlace ? "#f5f0ff" : C.bg,
            border: `1.5px solid ${isWin ? C.win : isPlace ? C.place : C.border}` }}>
            {/* Row 1: date, course, class */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                {run.course}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {run.date}
              </div>
            </div>
            {/* Row 2: dist, going, type */}
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
              {[run.dist, run.going, run.type, run.class].filter(Boolean).join(" · ")}
            </div>
            {/* Row 3: stats grid */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: posColour(run.pos), minWidth: 40 }}>
                {run.pos}/{run.ran}
              </span>
              {run.sp && <span style={{ fontSize: 12, color: C.text }}>{run.sp}</span>}
              {run.or && run.or !== "–" && <span style={{ fontSize: 12, color: C.muted }}>OR {run.or}</span>}
              {run.wgt && <span style={{ fontSize: 12, color: C.muted }}>{run.wgt}</span>}
              {run.hg && <span style={{ fontSize: 12, color: C.muted }}>{run.hg.toUpperCase()}</span>}
              {run.jockey && <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "right" }}>{run.jockey}</span>}
            </div>
            {/* Row 4: comment if exists */}
            {run.comment && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 5, fontStyle: "italic", lineHeight: 1.4 }}>
                {run.comment}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PICKS ─────────────────────────────────────────────────────────────────────
function PicksScreen({ challenge, playerId, onSubmit, onBack, editMode = false }) {
  const player    = challenge.players?.[playerId];
  const races     = sortRaces(challenge.selectedRaces || []);
  const submitted = player?.picksSubmitted;
  const locked    = isChallengeLocked(challenge);

  const [picks,   setPicks]  = useState(player?.picks || {});
  const [napId,   setNapId]  = useState(player?.napRaceId || null);
  const [editing, setEditing] = useState(editMode || !submitted);
  const [saving,  setSaving] = useState(false);
  const [toast,   showToast] = useToast();
  const raceRefs = useRef({});

  // Which races can still be changed? (before their off time — for NR replacements)
  const openRaces = new Set(races.filter(r => isRaceOpen(r, challenge.day)).map(r => r.id));
  // NR races for this player — pick flagged as NR, OR picked horse marked as NR on runner list
  const nrRaces = new Set(races.filter(r => {
    const pick = picks[r.id];
    if (pick?.nonRunner) return true; // pick itself flagged (manual NR, pick cleared)
    const horse = r.runners.find(h => h.id === pick?.horseId);
    return horse?.nonRunner; // runner still in picks but flagged on runner
  }).map(r => r.id));

  const allPicked = races.every(r => picks[r.id]?.horseId && !picks[r.id]?.nonRunner);
  const canEdit   = !locked || nrRaces.size > 0; // can always edit NR races

  function pickHorse(raceId, hId) {
    // Only allow picking if: editing & (race not locked OR it's an NR race)
    if (!editing) return;
    if (locked && !nrRaces.has(raceId)) return;
    setPicks(p => ({ ...p, [raceId]: { horseId: hId, betType: p[raceId]?.betType || "win" } }));
  }
  function setBetType(raceId, betType) {
    if (!editing) return;
    if (locked && !nrRaces.has(raceId)) return;
    setPicks(p => ({ ...p, [raceId]: { ...p[raceId], betType } }));
  }
  function toggleNap(raceId) {
    if (!editing || (locked && !nrRaces.has(raceId))) return;
    setNapId(prev => prev === raceId ? null : raceId);
  }

  const [napWarning, setNapWarning] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState(null);

  async function save() {
    // Scroll to first unpicked race if not all picked
    if (!allPicked && !submitted) {
      const firstMissing = races.find(r => !picks[r.id]?.horseId);
      if (firstMissing && raceRefs.current[firstMissing.id]) {
        raceRefs.current[firstMissing.id].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    // Prompt for NAP if not set and not already submitted
    if (!napId && !submitted) {
      setNapWarning(true);
      return;
    }
    setNapWarning(false);
    setSaving(true);
    const fresh = (await dbGet(challenge.code)) || challenge;
    const updatedPlayer = { ...player, picks, napRaceId: napId, picksSubmitted: true };
    fresh.players[playerId] = updatedPlayer;
    await dbSet(fresh.code, fresh);
    setSaving(false);
    showToast(submitted ? "Picks updated! ✅" : "Picks locked in! 🏁");
    setTimeout(() => onSubmit(fresh, updatedPlayer), 700);
  }

  const isEditing = editing && (!locked || nrRaces.size > 0);

  return (
    <div style={{ paddingTop: 22 }} className="fade">
      <RunnerCard horse={selectedRunner} onClose={() => setSelectedRunner(null)} />
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">2pts win · 1pt e/w each part · NAP doubles your stake</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div className="sec-title" style={{ marginBottom: 0 }}>{player?.name}'s Picks</div>
        {submitted && !locked && (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(e => !e)}>
            {editing ? "Cancel" : "✏️ Change Picks"}
          </button>
        )}
      </div>

      {/* Lock status banner */}
      {locked && nrRaces.size === 0 && (
        <div className="card" style={{ background: "#fff3f3", borderColor: C.danger, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: C.danger }}>🔒 Selections Locked</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>The first race has gone off — no further changes allowed.</div>
        </div>
      )}

      {/* Non-runner alert */}
      {nrRaces.size > 0 && (
        <div className="card" style={{ background: "#fff8ee", borderColor: "#ffb700", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#b36000" }}>⚠️ Non-Runner Alert</div>
          <div style={{ fontSize: 13, color: "#b36000", marginTop: 4 }}>
            One or more of your selections is a non-runner. Pick a replacement before the race goes off,
            or your bet will default to 2pts on the SP favourite.
          </div>
        </div>
      )}

      {submitted && !editing && (
        <div className="badge b-green" style={{ fontSize: 14, padding: "8px 18px", marginBottom: 16, display: "inline-block" }}>
          ✅ Picks submitted — good luck!
        </div>
      )}

      {isEditing && (
        <div className="nap-banner">
          <div>
            <span className="nap-badge">NAP</span>
            <span style={{ fontWeight: 600, fontSize: 14, marginLeft: 8 }}>Your NAP</span>
            <span style={{ color: "#b36000", fontSize: 13, marginLeft: 6 }}>
              {napId ? `— ${races.find(r => r.id === napId)?.course || "selected"} (doubles your stake)` : "— pick a horse first, then mark one race as your NAP"}
            </span>
          </div>
          {napId && (
            <button className="btn-nap-off" onClick={() => setNapId(null)}>Clear NAP</button>
          )}
        </div>
      )}

      {races.map((race, i) => {
        const myPick     = picks[race.id];
        const pickedId   = myPick?.horseId;
        const betType    = myPick?.betType || "win";
        const ewAvail    = !!race.ewTerms;
        const isNap      = napId === race.id;
        const isNR       = nrRaces.has(race.id);
        const raceOpen   = openRaces.has(race.id);
        const canEditThis = isEditing && (!locked || isNR) && raceOpen;

        return (
          <div key={race.id} ref={el => raceRefs.current[race.id] = el} className="card" style={{ marginBottom: 12, opacity: locked && !isNR && !isEditing ? 0.85 : 1, ...(isNap ? { borderColor: "#ff8c00", boxShadow: "0 4px 18px rgba(255,140,0,.2)" } : {}), ...(isNR ? { borderColor: "#ffb700", background: "#fffbf0" } : {}), ...(!picks[race.id]?.horseId && !locked ? { borderColor: C.pink + "66" } : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <div>
                <div className="eyebrow">Race {i + 1} {isNR ? "⚠️ NON-RUNNER" : locked && !raceOpen ? "🔒" : ""}</div>
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
                {pickedId && canEditThis && (
                  <button className={isNap ? "btn-nap" : "btn-nap-off"} onClick={() => toggleNap(race.id)}>
                    {isNap ? "⭐ NAP" : "Set as NAP"}
                  </button>
                )}
                {!canEditThis && isNap && <span className="nap-badge">⭐ NAP</span>}
              </div>
            </div>

            {pickedId && ewAvail && canEditThis && (
              <div className="bet-toggle">
                <button className={betType === "win" ? "active-win" : ""} onClick={() => setBetType(race.id, "win")}>
                  Win — {isNap ? "4pts" : "2pts"}
                </button>
                <button className={betType === "ew" ? "active-ew" : ""} onClick={() => setBetType(race.id, "ew")}>
                  Each-Way — {isNap ? "2pts" : "1pt"} e/w
                </button>
              </div>
            )}

            {/* Show runner list only if editable, otherwise just show the pick */}
            {canEditThis ? (
              <div className="horse-grid">
                {race.runners.filter(h => !h.nonRunner).map(h => {
                  const isPicked = pickedId === h.id;
                  return (
                    <button key={h.id}
                      className={`hbtn${isPicked ? (betType === "ew" ? " ew-picked" : " win-picked") : ""}${isPicked && isNap ? " nap-outline" : ""}`}
                      onClick={() => pickHorse(race.id, h.id)}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ width: 28, height: 28, background: isPicked ? "rgba(255,255,255,.25)" : C.border,
                            borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: isPicked ? "#fff" : C.muted }}>
                            {h.number || "?"}
                          </span>
                        <span style={{ textAlign: "left", minWidth: 0 }}>
                          <span style={{ fontWeight: isPicked ? 600 : 400, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {h.name}
                          </span>
                          {h.jockey && <span style={{ display: "block", fontSize: 11, marginTop: 1,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isPicked ? "rgba(255,255,255,.75)" : C.muted }}>
                            <span style={{ opacity: .7 }}>J: </span><strong>{h.jockey}</strong>
                          </span>}
                          {h.trainer && <span style={{ display: "block", fontSize: 11, marginTop: 1,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isPicked ? "rgba(255,255,255,.75)" : C.muted }}>
                            <span style={{ opacity: .7 }}>T: </span><strong>{h.trainer}</strong>
                          </span>}
                        </span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0, marginLeft: 6 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedRunner(h); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                            fontSize: 13, opacity: .5, lineHeight: 1 }}>ℹ️</button>
                        {h.form && (
                          <span style={{ fontSize: 10, color: isPicked ? "rgba(255,255,255,.8)" : C.text, textAlign: "right" }}>
                            <span style={{ opacity: .6 }}>Form: </span><strong>{h.form}</strong>
                          </span>
                        )}
                        {h.lbs && (
                          <span style={{ fontSize: 10, color: isPicked ? "rgba(255,255,255,.65)" : C.muted, textAlign: "right" }}>
                            <span style={{ opacity: .6 }}>Wgt: </span><strong>{lbsToStone(h.lbs)}</strong>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              pickedId && (
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 6, padding: "8px 0" }}>
                  {race.runners.find(h => h.id === pickedId)?.name || "Unknown"}
                  <span style={{ fontWeight: 400, fontSize: 13, color: C.muted, marginLeft: 8 }}>
                    {betType === "ew" ? "Each-Way" : "Win"}
                  </span>
                </div>
              )
            )}

            {/* NR warning — show whether race is open or closed */}
            {isNR && raceOpen && (
              <div style={{ fontSize: 13, color: C.danger, marginTop: 8, fontWeight: 600,
                background: "#fff0f0", border: `1px solid ${C.danger}`, borderRadius: 8, padding: "8px 12px" }}>
                ⚠️ Your pick is a non-runner — please select a replacement before the race starts.
              </div>
            )}
            {isNR && !raceOpen && (
              <div style={{ fontSize: 13, color: "#b36000", marginTop: 8, fontWeight: 500 }}>
                ⏰ Deadline passed — defaulting to 2pts on SP favourite.
              </div>
            )}
          </div>
        );
      })}

      {isEditing && (
        <div style={{ textAlign: "center", marginTop: 20, marginBottom: 24 }}>
          {napWarning && (
            <div className="card" style={{ background: "#fff8ee", borderColor: "#ffb700", marginBottom: 14, textAlign: "left" }}>
              <div style={{ fontWeight: 700, color: "#b36000", marginBottom: 6 }}>⭐ You haven't set a NAP!</div>
              <div style={{ fontSize: 13, color: "#b36000", marginBottom: 12 }}>
                Your NAP doubles your stake on one race. Are you sure you want to submit without one?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setNapWarning(false)}>
                  Go back & pick NAP
                </button>
                <button className="btn btn-pink btn-sm" onClick={async () => { setNapWarning(false); setSaving(true); const fresh = (await dbGet(challenge.code)) || challenge; const updatedPlayer = { ...player, picks, napRaceId: null, picksSubmitted: true }; fresh.players[playerId] = updatedPlayer; await dbSet(fresh.code, fresh); setSaving(false); showToast("Picks locked in! 🏁"); setTimeout(() => onSubmit(fresh, updatedPlayer), 700); }}>
                  Submit without NAP
                </button>
              </div>
            </div>
          )}
          <button className="btn btn-pink"
            disabled={(!allPicked && !submitted) || saving}
            onClick={save}>
            {saving ? "Saving…" : submitted ? "Save Changes ✅" : allPicked ? "Submit Picks 🏁" : `${races.length - Object.values(picks).filter(p => p?.horseId).length} more to pick`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
// Parse "HH:MM" off time into today's Date object
function offTimeToDate(timeStr, day) { return raceTimeToDate(timeStr, day); }

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

// ── NR PANEL (collapsible, creator only) ─────────────────────────────────────
function NRPanel({ races, onToggle }) {
  const [open, setOpen] = useState(false);
  const nrCount = races.flatMap(r => r.runners).filter(h => h.nonRunner).length;
  return (
    <div style={{ marginTop: 20 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 13, fontWeight: 600, padding: 0 }}>
        <span style={{ fontSize: 11, transition: "transform .2s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
        Manage Non-Runners
        {nrCount > 0 && (
          <span style={{ background: "#fff0f0", color: C.danger, border: `1.5px solid ${C.danger}`,
            borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
            {nrCount} marked
          </span>
        )}
      </button>
      {open && (
        <div style={{ marginTop: 12 }} className="fade">
          {races.filter(r => !r.resultIn).map(race => (
            <div key={race.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                <span className="time-badge">{race.time}</span>{race.course}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {race.runners.map(h => (
                  <button key={h.id} onClick={() => onToggle(race.id, h.id)}
                    style={{
                      fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "1.5px solid",
                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                      borderColor: h.nonRunner ? C.danger : C.border,
                      background: h.nonRunner ? "#fff0f0" : "#fff",
                      color: h.nonRunner ? C.danger : C.muted,
                      textDecoration: h.nonRunner ? "line-through" : "none",
                    }}>
                    {h.nonRunner ? "✗ " : ""}{h.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsScreen({ challenge, playerId, isCreator, onBack }) {
  const [ch,         setCh]     = useState(challenge);
  const [tab,        setTab]    = useState(null);
  const [err,        setErr]    = useState("");
  const [toast,      showToast] = useToast();


  const races   = sortRaces(ch.selectedRaces || []);
  const players = Object.values(ch.players || {});
  // Picks are visible to all once the first race has gone off
  const isLocked = races.length > 0 && raceTimeToDate(races[0].time, "today") <= new Date();

  // Real-time listener — all players see updates instantly
  useEffect(() => {
    return dbListen(ch.code, fresh => setCh(fresh));
  }, [ch.code]);

  // Auto-detect non-runners by re-polling racecards every 3 mins before races run
  useEffect(() => {
    const unrunRaces = (ch.selectedRaces || []).filter(r => !r.resultIn && isRaceOpen(r, ch.day));
    if (!unrunRaces.length) return;
    let cancelled = false;
    const checkNRs = async () => {
      if (cancelled) return;
      try {
        // API only accepts 'today' or 'tomorrow' — derive from stored date
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const apiDay = ch.day === tomorrowStr ? "tomorrow" : "today";
        const data = await apiGet(`/api/racecards?day=${apiDay}`);
        const fresh = await dbGet(ch.code);
        if (!fresh || cancelled) return;
        const latestRaces = parseRacecards(data);
        let changed = false;
        fresh.selectedRaces = toArr(fresh.selectedRaces).map(race => {
          if (race.resultIn) return race;
          // Find matching race in latest racecard
          const latest = latestRaces.find(r =>
            r.id === race.id ||
            (normCourse(r.course) === normCourse(race.course) && normTime(r.time) === normTime(race.time))
          );
          if (!latest) return race;
          // Find runners present before but missing now — mark as NR
          const latestIds = new Set(latest.runners.map(h => h.id));
          const latestNames = new Set(latest.runners.map(h => h.name.toLowerCase().replace(/[^a-z]/g, "")));
          const updatedRunners = race.runners.map(h => {
            const stillPresent = latestIds.has(h.id) ||
              latestNames.has(h.name.toLowerCase().replace(/[^a-z]/g, ""));
            if (!stillPresent && !h.nonRunner) {
              changed = true;
              console.log(`NR detected: ${h.name} in ${race.course} ${race.time}`);
              return { ...h, nonRunner: true };
            }
            return h;
          });
          return { ...race, runners: updatedRunners };
        });
        if (changed) {
          // Clear picks for newly detected NR horses
          Object.values(fresh.players || {}).forEach(p => {
            toArr(fresh.selectedRaces).forEach(race => {
              const pick = p.picks?.[race.id];
              if (!pick?.horseId) return;
              const horse = race.runners.find(h => h.id === pick.horseId);
              if (horse?.nonRunner && !pick.nonRunner) {
                p.picks[race.id] = { ...pick, nonRunner: true };
              }
            });
          });
          await dbSet(fresh.code, fresh);
          if (!cancelled) {
            setCh(normaliseChallenge(fresh));
            showToast("⚠️ Non-runner detected — affected players notified");
          }
        }
      } catch (e) { console.warn("NR check error:", e.message); }
    };
    checkNRs();
    const interval = setInterval(checkNRs, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [ch.code]);

  // Auto-fetch results every 60s while any races are still pending
  useEffect(() => {
    const sorted = sortRaces(ch.selectedRaces || []);
    // Use the stored race date (YYYY-MM-DD) to check if races are today
    // If challenge day is in the future, don't poll — results won't exist yet
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    if (ch.day && ch.day > todayStr) return; // challenge is for a future date
    // Also check first race time — don't poll if no race has gone off yet
    const firstOff = sorted.length ? raceTimeToDate(sorted[0].time, ch.day || "today") : null;
    const now = new Date();
    if (firstOff && firstOff > now) return;
    const pendingRaces = (ch.selectedRaces || []).filter(r => !r.resultIn);
    if (!pendingRaces.length) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        const data  = await apiGet(`/api/results`);
        if (cancelled) return;
        const fresh = (await dbGet(ch.code)) || ch;
        if (cancelled) return;
        const updated  = mergePositions(fresh.selectedRaces || [], data);
        const newCount = updated.filter(r => r.resultIn).length;
        const oldCount = (fresh.selectedRaces || []).filter(r => r.resultIn).length;
        if (newCount > oldCount) {
          fresh.selectedRaces = updated;
          await dbSet(fresh.code, fresh);
          if (!cancelled) {
            setCh(prev => ({ ...prev, selectedRaces: updated }));
            showToast(`${newCount - oldCount} result${newCount - oldCount !== 1 ? "s" : ""} in — leaderboard updated! 🏆`);
          }
        }
      } catch (e) { console.warn("Auto-fetch error:", e.message); }
    };
    run();
    const interval = setInterval(run, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [ch.code]);

  function calcPlayer(p) {
    let totalReturn = 0, totalStaked = 0, wins = 0, places = 0;
    const detail = races.map(race => {
      const sel     = p.picks?.[race.id];
      const hId     = sel?.horseId;
      const betType = sel?.betType || "win";
      const isNap   = p.napRaceId === race.id;
      let horse     = race.runners.find(h => h.id === hId);

      // NR default: pick was cleared (nonRunner flag set, no horseId) and race has result
      // Default to 2pts win on the SP favourite (lowest sp_dec among finishers)
      let isNRDefault = false;
      if (!horse && sel?.nonRunner && race.resultIn) {
        const finishers = race.runners.filter(h => h.spDec != null && h.spDec > 0);
        if (finishers.length) {
          horse = finishers.reduce((fav, h) => h.spDec < fav.spDec ? h : fav, finishers[0]);
          isNRDefault = true;
        }
      }

      if (!horse) return { race, horse: null, betType, isNap, isNRDefault: false, ret: { total: 0, win: 0, place: 0, staked: isNap ? 4 : 2 } };

      // NR default is always 2pts win (no EW, no NAP multiplier)
      const effectiveBetType = isNRDefault ? "win" : betType;
      const effectiveNap     = isNRDefault ? false  : isNap;
      const ret = calcSelectionReturn(horse.sp, effectiveBetType, horse.position, race.ewTerms, effectiveNap, horse.spDec ?? null);

      // Only count staked and returns for races that have actually run
      if (race.resultIn) {
        totalReturn += ret.total;
        totalStaked += ret.staked;
      }
      if (horse.position === 1) wins++;
      else if (ret.place > 0) places++;
      return { race, horse, betType: effectiveBetType, isNap: effectiveNap, isNRDefault, ret };
    });
    return { totalReturn: +totalReturn.toFixed(2), totalStaked: +totalStaked.toFixed(2), wins, places, detail };
  }

  const ranked     = players.map(p => ({ ...p, ...calcPlayer(p) })).sort((a, b) => b.totalReturn - a.totalReturn);
  const me         = ranked.find(p => p.id === playerId);
  const hasResults = races.some(r => r.resultIn);

  // Save manually entered SPs
  // Mark/unmark a horse as non-runner — clears affected players' picks for that race
  async function toggleNonRunner(raceId, horseId) {
    const fresh = (await dbGet(ch.code)) || ch;
    fresh.selectedRaces = (fresh.selectedRaces || []).map(race => {
      if (race.id !== raceId) return race;
      const runners = race.runners.map(h =>
        h.id === horseId ? { ...h, nonRunner: !h.nonRunner } : h
      );
      return { ...race, runners };
    });
    // Clear picks for any player who had the NR horse
    const nrHorseIds = new Set(
      (fresh.selectedRaces.find(r => r.id === raceId)?.runners || [])
        .filter(h => h.nonRunner).map(h => h.id)
    );
    Object.values(fresh.players || {}).forEach(p => {
      const pick = p.picks?.[raceId];
      if (pick && nrHorseIds.has(pick.horseId)) {
        p.picks[raceId] = { ...pick, horseId: null, nonRunner: true };
      }
    });
    await dbSet(fresh.code, fresh);
    showToast("Non-runner updated");
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
        {pendingCount > 0 && (
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginTop: 4 }}>
            <span className="live-dot" />Checking results every 60s…
          </div>
        )}
      </div>

      {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

      {/* 1. YOUR RETURNS CARD */}
      {me && (
        <div className="card card-pink" style={{ marginBottom: 16, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your Returns · {me.name}</div>
          <div className="pts-big">{fmtPts(me.totalReturn)}</div>
          <div className="pts-sub">
            {me.wins} winner{me.wins !== 1 ? "s" : ""}
            {me.places > 0 ? ` · ${me.places} placed` : ""}
            {me.napRaceId ? " · NAP ⭐" : ""}
            {" "}· {me.totalStaked} pts staked
          </div>
          {me.totalStaked > 0 && (
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 600, color: me.totalReturn >= me.totalStaked ? C.win : C.danger }}>
              {me.totalReturn >= me.totalStaked
                ? `+${(me.totalReturn - me.totalStaked).toFixed(2)} pts profit 🎉`
                : `-${(me.totalStaked - me.totalReturn).toFixed(2)} pts`}
            </div>
          )}
        </div>
      )}

      {/* 2. LEADERBOARD */}
      <div style={{ marginBottom: 20 }}>
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
              {p.totalStaked > 0 && (
                <div style={{ fontSize: 13, fontWeight: 600, color: p.totalReturn >= p.totalStaked ? C.win : C.muted }}>
                  {p.totalReturn >= p.totalStaked ? `+${(p.totalReturn - p.totalStaked).toFixed(2)}` : `-${(p.totalStaked - p.totalReturn).toFixed(2)}`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 3. RACE CARD / MY PICKS TABS */}
      <div className="tabs">
        {[["card","📋 Race Card"],["mine","My Picks"]].map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? " on" : ""}`} onClick={() => setTab(tab === id ? null : id)}>{label}</button>
        ))}
      </div>

      {/* 5. NR MANAGEMENT — creator only, hidden behind toggle */}
      {isCreator && races.some(r => !r.resultIn) && (
        <NRPanel races={races} onToggle={toggleNonRunner} />
      )}

      {/* 6. PENDING MESSAGE — no results yet */}
      {!races.some(r => r.resultIn) && (
        <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
          <div style={{ color: C.muted, lineHeight: 1.65, fontWeight: 500 }}>
            Results and Starting Prices are loaded automatically — leaderboard updates within a minute of each race finishing.
          </div>
        </div>
      )}

      {tab === "card" && (
        <div className="fade">
          {races.map((race, i) => {
            const winner = race.runners.find(h => parseInt(h.position) === 1);

            // Build a map of horseId -> [players who picked it] for this race — only show once locked
            const pickerMap = {};
            if (isLocked) {
              players.forEach(p => {
                const pick = p.picks?.[race.id];
                if (!pick?.horseId) return;
                if (!pickerMap[pick.horseId]) pickerMap[pick.horseId] = [];
                pickerMap[pick.horseId].push({ name: p.name, betType: pick.betType || "win", isNap: p.napRaceId === race.id });
              });
            }

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
                    const pos     = parseInt(h.position);
                    const isWin   = pos === 1;
                    const isPlace = !isWin && pos && race.ewTerms && pos <= race.ewTerms.places;
                    const pickers = pickerMap[h.id] || [];
                    const hasPickers = pickers.length > 0;
                    return (
                      <button key={h.id} className={`hbtn${isWin ? " won" : isPlace ? " placed" : hasPickers ? " has-pick" : ""}`}
                        style={{ cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: hasPickers ? 700 : 400 }}>
                            {pos ? `${pos}. ` : ""}{h.name}{isPlace ? <span style={{ fontSize: 11, marginLeft: 4, opacity: .7 }}> P</span> : ""}
                          </span>
                          <span className="sp-chip">{h.sp ? fmtSP(h.sp) : "SP"}</span>
                        </span>
                        {hasPickers && (
                          <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                            {pickers.map((pk, pi) => (
                              <span key={pi} style={{
                                fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                                background: pk.isNap ? "#fff8ee" : pk.betType === "ew" ? "#eff8ff" : C.pinkBg,
                                color: pk.isNap ? "#b36000" : pk.betType === "ew" ? C.blue : C.pink,
                                border: `1px solid ${pk.isNap ? "#ffb700" : pk.betType === "ew" ? C.borderDk : C.pinkLt}`,
                              }}>
                                {pk.name}{pk.isNap ? " ⭐" : pk.betType === "ew" ? " EW" : ""}
                              </span>
                            ))}
                          </span>
                        )}
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
            const nameCol   = isWin ? C.win : isPlace ? C.place : isLoser ? C.danger : C.muted;

            // Outcome label + colour
            const outcome     = isPending ? null : isWin ? "WON" : isPlace ? "PLACED" : isLoser ? "LOST" : null;
            const outcomeCol  = isWin ? C.win : isPlace ? C.place : C.danger;
            const outcomeBg   = isWin ? "#f0fff4" : isPlace ? "#f5f0ff" : "#fff0f0";

            return (
              <div key={race.id} className="card" style={{ marginBottom: 10, borderLeft: `4px solid ${borderCol}`, padding: "16px 18px" }}>
                {/* Header row: race info + outcome badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="eyebrow" style={{ marginBottom: 0 }}>
                    <span className="time-badge">{race.time}</span>{race.course}
                    {isNap && <span className="nap-badge" style={{ marginLeft: 6 }}>NAP ⭐</span>}
                  </div>
                  {outcome && (
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, padding: "3px 10px", borderRadius: 20, background: outcomeBg, color: outcomeCol, border: `1.5px solid ${outcomeCol}` }}>
                      {outcome}
                    </span>
                  )}
                  {isPending && (
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>🕐 Pending</span>
                  )}
                </div>

                {/* Horse name + SP */}
                <div style={{ fontSize: 17, fontWeight: 700, color: nameCol, marginBottom: 6 }}>
                  {horse ? horse.name : "No selection"}
                  {horse?.sp && <span style={{ fontWeight: 400, fontSize: 14, color: C.muted, marginLeft: 8 }}>@ {fmtSP(horse.sp)}</span>}
                </div>
                {isNRDefault && (
                  <div style={{ fontSize: 12, color: "#b36000", background: "#fff8ee",
                    border: "1px solid #ffb700", borderRadius: 6, padding: "4px 10px",
                    display: "inline-block", marginBottom: 6 }}>
                    ⚠️ NR default — SP favourite (2pts win)
                  </div>
                )}

                {/* Bet type + returns row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 13, color: C.muted }}>
                    {betType === "ew" ? "Each-Way" : "Win"} · {ret.staked}pts staked
                    {betType === "ew" && race.ewTerms && <span> · {race.ewTerms.places} places 1/{race.ewTerms.fraction}</span>}
                    {betType === "ew" && race.resultIn && horse && (
                      <div style={{ marginTop: 3 }}>
                        Win: <span style={{ color: ret.win > 0 ? C.win : C.muted, fontWeight: 600 }}>{fmtPts(ret.win)}</span>
                        {" · "}Place: <span style={{ color: ret.place > 0 ? C.place : C.muted, fontWeight: 600 }}>{fmtPts(ret.place)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    {race.resultIn ? (
                      <>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 2 }}>Returns</div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 700,
                          color: ret.total > 0 ? C.win : isLoser ? C.danger : C.muted }}>
                          {fmtPts(ret.total)}
                        </div>
                        {ret.total > 0 && (
                          <div style={{ fontSize: 12, color: C.win, fontWeight: 600 }}>
                            +{(ret.total - ret.staked).toFixed(2)} profit
                          </div>
                        )}
                        {isLoser && (
                          <div style={{ fontSize: 12, color: C.danger, fontWeight: 600 }}>
                            -{ret.staked.toFixed(2)} pts
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: C.muted }}>—</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: `1.5px solid ${C.border}`, marginTop: 16, paddingTop: 14, textAlign: "right" }}>
            <div style={{ color: C.muted, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              Total staked: {me.totalStaked} pts{me.napRaceId ? " · NAP ⭐" : ""}
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: C.pink }}>
              {fmtPts(me.totalReturn)}
            </div>
            {me.totalStaked > 0 && (
              <div style={{ fontSize: 15, marginTop: 4, fontWeight: 600, color: me.totalReturn >= me.totalStaked ? C.win : C.danger }}>
                {me.totalReturn >= me.totalStaked
                  ? `+${(me.totalReturn - me.totalStaked).toFixed(2)} pts profit 🎉`
                  : `-${(me.totalStaked - me.totalReturn).toFixed(2)} pts`}
              </div>
            )}
            {me.totalStaked === 0 && (
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Awaiting results…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
// ─── SESSION PERSISTENCE ─────────────────────────────────────────────────────
const SESSION_KEY = "rc_session";
function saveSession(code, playerId, playerName) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, playerName, ts: Date.now() })); } catch {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export default function App() {
  const [screen,    setScreen]  = useState("home");
  const [ch,        setCh]      = useState(null);
  const [pid,       setPid]     = useState(null);
  const [player,    setPlayer]  = useState(null);
  const [rejoining, setRejoining] = useState(false);
  const [session,   setSession]  = useState(() => loadSession());
  const [showAbout,      setShowAbout]      = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );

  const isCreator = ch?.creatorId === pid;

  // Handle ?code=XXXXX&player=yyy deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get("code")?.toUpperCase();
    const player = params.get("player");
    if (code && player) {
      // Clear URL params without reloading
      window.history.replaceState({}, "", window.location.pathname);
      rejoinChallenge(code, player);
    }
  }, []);

  async function rejoinChallenge(code, playerId) {
    setRejoining(true);
    const fresh = await dbGet(code);
    if (fresh && fresh.players?.[playerId]) {
      const p = fresh.players[playerId];
      setCh(fresh); setPid(playerId); setPlayer(p);
      saveSession(code, playerId, p.name);
      setSession({ code, playerId, playerName: p.name });
      const dest = fresh.status === "open" ? "lobby"
                 : fresh.status === "selections" ? "picks"
                 : "results";
      setScreen(dest);
    }
    setRejoining(false);
  }

  async function handleCreate(name) {
    const code = genCode(5), playerId = genCode(8);
    const p = { id: playerId, name, picks: {}, picksSubmitted: false };
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const newCh = { code, creatorId: playerId, status: "open", day: today, players: { [playerId]: p }, selectedRaces: [], selectedRaceIds: [], racecards: [] };
    await dbSet(code, newCh);
    setCh(newCh); setPid(playerId); setPlayer(p);
    saveSession(code, playerId, name);
    setSession({ code, playerId, playerName: name });
    setScreen("setup");
  }

  async function handleJoin(existingCh, name) {
    const playerId = genCode(8);
    const p = { id: playerId, name, picks: {}, picksSubmitted: false };
    const fresh = (await dbGet(existingCh.code)) || existingCh;
    fresh.players[playerId] = p;
    await dbSet(fresh.code, fresh);
    setCh(fresh); setPid(playerId); setPlayer(p);
    saveSession(fresh.code, playerId, name);
    setSession({ code: fresh.code, playerId, playerName: name });
    setScreen(fresh.status === "selections" ? "picks" : "lobby");
  }

  function handleSetupSave(updated) { setCh(updated); setScreen("lobby"); }
  function handleLobbyAction(action, updated) { if (updated) setCh(updated); setScreen(action); }
  function handlePicksSubmit(updatedCh, updatedPlayer) { setCh(updatedCh); setPlayer(updatedPlayer); setScreen("results"); }

  function handleLeave() {
    clearSession(); setSession(null);
    setCh(null); setPid(null); setPlayer(null);
    setScreen("home");
  }

  // Deep link URL for sharing
  const deepLink = ch && pid
    ? `${window.location.origin}${window.location.pathname}?code=${ch.code}&player=${pid}`
    : null;

  const showCtx = screen !== "home" && ch;

  if (rejoining) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <Loader />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{GLOBAL_CSS}</style>

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
              <button className="btn btn-ghost btn-sm" onClick={handleLeave}>Leave</button>
            </div>
          </div>
        )}

        {screen === "home" && (
          <>
            {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
            {/* A2HS — small dark bar at top */}
            <A2HSBanner />

            {/* Logo — large, centred, tappable for About */}
            <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
              <img src="/icons/logo-transparent.png" alt="StableMates" onClick={() => setShowAbout(true)}
                style={{ width: "min(60vw, 240px)", height: "min(60vw, 240px)", display: "inline-block", cursor: "pointer" }} />
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowAbout(true)}
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  About StableMates
                </button>
              </div>
            </div>
            {/* Welcome back */}
            {session && (
              <div className="card" style={{ marginBottom: 16, textAlign: "center", borderColor: C.blue, background: "#f0f7ff" }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>👋 Welcome back, {session.playerName}!</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                  You were in challenge <span className="ctx-code">{session.code}</span>
                </div>
                <button className="btn btn-blue" onClick={() => rejoinChallenge(session.code, session.playerId)}>
                  Rejoin Challenge →
                </button>
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 10 }} onClick={() => { clearSession(); setSession(null); }}>
                  Not me
                </button>
              </div>
            )}

            {/* Start / Join panels */}
            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
            <HomeScreen onCreate={handleCreate} onJoin={handleJoin} openAbout={() => setShowAbout(true)} />
          </>
        )}
        {screen === "setup"   && ch && <SetupScreen   challenge={ch} onSave={handleSetupSave} onBack={() => setScreen("home")} />}
        {screen === "lobby"   && ch && <LobbyScreen   challenge={ch} playerId={pid} onAction={handleLobbyAction} onBack={() => setScreen("home")} deepLink={deepLink} />}
        {screen === "picks"   && ch && <PicksScreen   challenge={ch} playerId={pid} onSubmit={handlePicksSubmit} onBack={() => setScreen("lobby")} />}
        {screen === "results" && ch && <ResultsScreen challenge={ch} playerId={pid} isCreator={isCreator} onBack={() => setScreen("lobby")} />}
      </div>
    </div>
  );
}
