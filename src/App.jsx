import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off } from "firebase/database";
import {
  getAuth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile,
} from "firebase/auth";

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:       import.meta.env.VITE_FIREBASE_APP_ID,
};
const fbApp    = initializeApp(firebaseConfig);
const db       = getDatabase(fbApp);
const auth     = getAuth(fbApp);
const gProvider = new GoogleAuthProvider();

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

// ─── USER CHALLENGE INDEX ────────────────────────────────────────────────────
// Store list of challenge codes per user for history lookup
async function addChallengeToUserIndex(uid, code) {
  if (!uid) return;
  try {
    const r = ref(db, `userChallenges/${uid}/${code}`);
    await set(r, { code, joinedAt: Date.now() });
  } catch {}
}
async function getUserChallenges(uid) {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `userChallenges/${uid}`));
    if (!snap.exists()) return [];
    return Object.values(snap.val()).sort((a, b) => b.joinedAt - a.joinedAt);
  } catch { return []; }
}

// ─── STABLES DB ──────────────────────────────────────────────────────────────
function genStableCode() {
  return "S" + Math.random().toString(36).substring(2, 7).toUpperCase();
}
async function stableGet(code) {
  try {
    const snap = await get(ref(db, `stables/${code}`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}
async function stableSet(code, val) {
  try { await set(ref(db, `stables/${code}`), val); } catch {}
}
function stableListen(code, cb) {
  const r = ref(db, `stables/${code}`);
  onValue(r, snap => { if (snap.exists()) cb(snap.val()); });
  return () => off(r);
}
async function getUserStables(uid) {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `userStables/${uid}`));
    if (!snap.exists()) return [];
    return Object.values(snap.val());
  } catch { return []; }
}
async function addUserStable(uid, code, name) {
  if (!uid) return;
  try { await set(ref(db, `userStables/${uid}/${code}`), { code, name, joinedAt: Date.now() }); } catch {}
}
async function removeUserStable(uid, code) {
  if (!uid) return;
  try { await set(ref(db, `userStables/${uid}/${code}`), null); } catch {}
}
async function searchStablesByName(query) {
  if (!query?.trim()) return [];
  try {
    const snap = await get(ref(db, "stables"));
    if (!snap.exists()) return [];
    const q = query.toLowerCase().trim();
    return Object.values(snap.val()).filter(s =>
      s.name?.toLowerCase().includes(q)
    ).slice(0, 10);
  } catch { return []; }
}

// ─── USER PROFILE DB ─────────────────────────────────────────────────────────
async function userGet(uid) {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}
async function userSet(uid, data) {
  try { await set(ref(db, `users/${uid}`), data); } catch {}
}
function userListen(uid, cb) {
  const r = ref(db, `users/${uid}`);
  onValue(r, snap => { if (snap.exists()) cb(snap.val()); });
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

  .horse-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; overflow: hidden; }
  @media(max-width:420px){ .horse-grid { grid-template-columns: 1fr; } }
  .hbtn { background: ${C.bg}; border: 1.5px solid ${C.border}; border-radius: 10px; padding: 10px 13px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; width: 100%; min-width: 0; overflow: hidden; color: ${C.text}; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: all .15s; text-align: left; }
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
  // Prefer fractional string conversion (full precision) over API sp_dec (may be rounded)
  // Only fall back to spDec if we have no fractional string to parse
  const fromFractional = spToDecimal(sp);
  const dec = fromFractional != null ? fromFractional : spDec;
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

// ── STABLES SCREEN ───────────────────────────────────────────────────────────
function StablesScreen({ authUser, onBack, onCreateChallenge, directStableCode }) {
  const [view,        setView]        = useState(directStableCode ? "manage" : "list");
  const [myStables,   setMyStables]   = useState([]);
  const [activeStable, setActiveStable] = useState(directStableCode ? { code: directStableCode } : null);
  const [loading,     setLoading]     = useState(true);
  const [toast,       showToast]      = useToast();

  useEffect(() => {
    if (!authUser?.uid) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const list = await getUserStables(authUser.uid);
      if (cancelled) return;
      const details = await Promise.all(list.map(({ code }) => stableGet(code)));
      if (!cancelled) {
        setMyStables(details.filter(Boolean));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser?.uid]);

  if (view === "create") return (
    <CreateStable authUser={authUser}
      onCreated={async stable => {
        setMyStables(prev => [...prev, stable]);
        setActiveStable(stable);
        setView("manage");
      }}
      onBack={() => setView("list")} />
  );

  if (view === "find") return (
    <FindStableScreen authUser={authUser} onBack={() => setView("list")} />
  );

  if (view === "manage" && activeStable) return (
    <ManageStable
      authUser={authUser}
      stableCode={activeStable.code}
      onBack={() => { setView("list"); setActiveStable(null); }}
      onUpdated={updated => setActiveStable(updated)}
      showToast={showToast}
      onCreateChallenge={(stableCode) => onCreateChallenge && onCreateChallenge(stableCode)}
    />
  );

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">Your Stables</div>
      <div className="sec-title" style={{ marginBottom: 20 }}>Stables</div>

      {loading ? <div className="loader"><span/><span/><span/></div> : (
        <>
          {!myStables.length && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No stables yet</div>
              <div style={{ fontSize: 14, marginBottom: 24 }}>Create a stable or ask a friend to send you an invite link</div>
            </div>
          )}

          {myStables.map(stable => {
            const memberCount = Object.values(stable.members || {}).filter(m => m.status === "active").length;
            const isCreator = stable.creatorUid === authUser.uid;
            const pendingCount = Object.values(stable.members || {}).filter(m => m.status === "pending").length;
            return (
              <div key={stable.code} className="card" style={{ marginBottom: 12, cursor: "pointer" }}
                onClick={() => { setActiveStable(stable); setView("manage"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.text, marginBottom: 4 }}>
                      {stable.name}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted }}>
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                      {isCreator ? " · 👑 You created this" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {pendingCount > 0 && isCreator && (
                      <span style={{ background: C.pink, color: "#fff", borderRadius: 20,
                        padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                        {pendingCount} pending
                      </span>
                    )}
                    <span style={{ fontSize: 20, color: C.muted }}>→</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn btn-pink" style={{ flex: 1 }}
              onClick={() => setView("create")}>
              + Create
            </button>
            <button className="btn btn-blue" style={{ flex: 1 }}
              onClick={() => setView("find")}>
              🔍 Find a Stable
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateStable({ authUser, onCreated, onBack }) {
  const [name,  setName]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  async function create() {
    if (!name.trim()) return setErr("Give your stable a name");
    setBusy(true);
    const code = genStableCode();
    const stable = {
      code,
      name: name.trim(),
      creatorUid: authUser.uid,
      createdAt: Date.now(),
      members: {
        [authUser.uid]: {
          uid: authUser.uid,
          name: authUser.displayName || authUser.email,
          status: "active",
          joinedAt: Date.now(),
        }
      },
      challenges: {},
      pendingRequests: {},
    };
    await stableSet(code, stable);
    await addUserStable(authUser.uid, code, name.trim());
    // Earn Stable Master badge
    const profile = await userGet(authUser.uid);
    const earned = new Set(profile?.earnedBadges || []);
    if (!earned.has("stable_master")) {
      earned.add("stable_master");
      await userSet(authUser.uid, { ...profile, earnedBadges: [...earned] });
    }
    onCreated(stable);
  }

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">New Stable</div>
      <div className="sec-title">Create a Stable</div>
      <div className="card">
        <div className="field">
          <label>Stable Name</label>
          <input className="inp" placeholder="e.g. The Cheltenham Crew"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()} />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-pink" style={{ width: "100%", marginTop: 8 }}
          disabled={!name.trim() || busy} onClick={create}>
          {busy ? "Creating…" : "Create Stable 🏠"}
        </button>
      </div>
    </div>
  );
}

// Shows the open/live challenge for a stable directly on the stable screen
function ActiveStableChallenge({ stable, authUser, onCreateChallenge }) {
  const [liveChallenge, setLiveChallenge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const chs = Object.values(stable.challenges || {});
      for (const ref of chs) {
        const ch = await dbGet(ref.code);
        if (!ch || cancelled) continue;
        const races = sortRaces(ch.selectedRaces || []);
        // Skip challenges with no races — abandoned/test
        if (!races.length) continue;
        const allDone = races.every(r => r.resultIn);
        if (allDone || ch.status === "complete") continue;
        // Skip dead challenges — no picks and first race already gone off
        const anyPicks = Object.values(ch.players || {}).some(p => p.picksSubmitted);
        if (!anyPicks) {
          const firstOff = raceTimeToDate(races[0].time, ch.day || "today");
          if (firstOff && firstOff < new Date()) continue;
        }
        if (!cancelled) setLiveChallenge(normaliseChallenge(ch));
        break;
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [stable.code]);

  if (loading) return null;

  if (!liveChallenge) return (
    <div className="card" style={{ marginBottom: 16, textAlign: "center",
      borderStyle: "dashed", borderColor: C.border }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>No active challenge</div>
      <button className="btn btn-pink btn-sm" onClick={onCreateChallenge}>
        + Create Challenge
      </button>
    </div>
  );

  const races = sortRaces(liveChallenge.selectedRaces || []);
  const locked = isChallengeLocked(liveChallenge);
  const players = Object.values(liveChallenge.players || {});
  const submitted = players.filter(p => p.picksSubmitted).length;
  const myPlayer = liveChallenge.players?.[authUser?.uid];

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: C.pink, background: C.pinkBg }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.pink, fontWeight: 600,
        textTransform: "uppercase", marginBottom: 6 }}>
        {locked ? "🏇 Live Challenge" : "📋 Open Challenge"}
        {liveChallenge.isCanned ? " · 📺 Official" : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: C.text }}>
          {races.length ? `${races.length} race${races.length !== 1 ? "s" : ""}` : "Setting up…"}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {submitted}/{players.length} picks in
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontFamily: "monospace" }}>
        Code: {liveChallenge.code}
      </div>
      {myPlayer ? (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
          {myPlayer.picksSubmitted ? "✅ Your picks are in" : locked ? "⏳ Locked" : "⏰ Picks needed"}
        </div>
      ) : null}
      <button className="btn btn-pink btn-sm" style={{ width: "100%" }}
        onClick={() => onCreateChallenge(liveChallenge.code)}>
        {myPlayer ? "Go to Challenge →" : "Enter Challenge →"}
      </button>
    </div>
  );
}

function ManageStable({ authUser, stableCode, onBack, onUpdated, showToast, onCreateChallenge }) {
  const [stable,       setStable]       = useState(null);
  const [tab,          setTab]          = useState("league");
  const [loading,      setLoading]      = useState(true);
  const [selMember,    setSelMember]    = useState(null);
  const [yearFilter,   setYearFilter]   = useState("all");
  const [profileNames, setProfileNames] = useState({});
  const [memberSilks,  setMemberSilks]  = useState({});

  useEffect(() => {
    setLoading(true);
    const unsub = stableListen(stableCode, async fresh => {
      setStable(fresh);
      if (onUpdated) onUpdated(fresh);
      setLoading(false);
      const members = Object.values(fresh.members || {});
      const names = {}, silksMap = {};
      await Promise.all(members.map(async m => {
        const profile = await userGet(m.uid);
        names[m.uid] = profile?.name || m.name;
        if (profile?.silks) silksMap[m.uid] = profile.silks;
      }));
      setProfileNames(names);
      setMemberSilks(silksMap);
    });
    return unsub;
  }, [stableCode]);

  async function approveRequest(uid) {
    const fresh = await stableGet(stableCode);
    const req = fresh.pendingRequests?.[uid];
    if (!req) return;
    fresh.members = fresh.members || {};
    fresh.members[uid] = { uid, name: req.name, status: "active", joinedAt: Date.now() };
    delete fresh.pendingRequests[uid];
    await stableSet(stableCode, fresh);
    await addUserStable(uid, stableCode, fresh.name);

    // Auto-join any open challenge on this stable
    const openChs = Object.values(fresh.challenges || {});
    for (const chRef of openChs) {
      const ch = await dbGet(chRef.code);
      if (!ch) continue;
      const races = sortRaces(ch.selectedRaces || []);
      const allDone = races.length > 0 && races.every(r => r.resultIn);
      if (allDone || ch.status === "complete") continue;
      if (isChallengeLocked(ch)) continue; // don't add after lock
      if (ch.players?.[uid]) continue; // already in
      ch.players[uid] = { id: uid, name: req.name, picks: {}, picksSubmitted: false, uid };
      await dbSet(chRef.code, ch);
      await addChallengeToUserIndex(uid, chRef.code);
    }

    showToast(`${req.name} approved ✅`);
  }

  async function declineRequest(uid) {
    const fresh = await stableGet(stableCode);
    if (fresh.pendingRequests?.[uid]) {
      delete fresh.pendingRequests[uid];
      await stableSet(stableCode, fresh);
    }
    showToast("Request declined");
  }

  async function leaveStable() {
    if (!confirm(`Leave ${stable?.name}? Your stats will stay but you'll be marked as a past member.`)) return;
    const fresh = await stableGet(stableCode);
    if (fresh.members?.[authUser.uid]) {
      fresh.members[authUser.uid] = { ...fresh.members[authUser.uid], status: "left", leftAt: Date.now() };
      await stableSet(stableCode, fresh);
    }
    await removeUserStable(authUser.uid, stableCode);
    onBack();
  }

  async function deleteStable() {
    if (!confirm(`Delete ${stable?.name}? This cannot be undone — all members will lose access.`)) return;
    if (!confirm(`Are you sure? "${stable?.name}" will be permanently deleted.`)) return;
    try {
      // Remove from all members' userStables
      const members = Object.values(stable.members || {});
      await Promise.all(members.map(m => removeUserStable(m.uid, stableCode)));
      // Delete the stable itself
      await set(ref(db, `stables/${stableCode}`), null);
      showToast("Stable deleted");
      onBack();
    } catch(e) { showToast("Failed to delete stable"); }
  }

  async function copyInviteLink() {
    try { await navigator.clipboard.writeText(stable?.code || stableCode); } catch {}
    showToast("Stable code copied! 🔗");
  }

  if (loading || !stable) return <div className="loader"><span/><span/><span/></div>;

  const isCreator = stable.creatorUid === authUser.uid;
  const activeMembers = Object.values(stable.members || {}).filter(m => m.status === "active" || m.status === "left");
  const pendingRequests = Object.values(stable.pendingRequests || {});

  // Build league table from stable challenges
  const stableChallenges = Object.values(stable.challenges || {});
  const years = [...new Set(stableChallenges.map(c => c.day?.substring(0, 4)).filter(Boolean))].sort().reverse();

  // Calculate member stats from stable challenges
  const memberStats = {};
  activeMembers.forEach(m => { memberStats[m.uid] = { wins: 0, seconds: 0, thirds: 0, entered: 0 }; });

  stableChallenges.forEach(({ code, day }) => {
    if (yearFilter !== "all" && day?.substring(0, 4) !== yearFilter) return;
    // We need to calculate results per challenge — stored as summary on stable
    const summary = stable.challengeSummaries?.[code];
    if (!summary) return;
    Object.entries(summary.positions || {}).forEach(([uid, pos]) => {
      if (!memberStats[uid]) return;
      memberStats[uid].entered++;
      if (pos === 1) memberStats[uid].wins++;
      else if (pos === 2) memberStats[uid].seconds++;
      else if (pos === 3) memberStats[uid].thirds++;
    });
  });

  const ranked = activeMembers
    .map(m => ({ ...m, ...(memberStats[m.uid] || { wins: 0, seconds: 0, thirds: 0, entered: 0 }) }))
    .sort((a, b) => b.wins - a.wins || b.seconds - a.seconds || b.thirds - a.thirds);

  const posEmoji = (i, m) => {
    if (m.status === "left") return "👻";
    return i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
  };

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
        {isCreator && (
          <button onClick={deleteStable}
            style={{ background: "none", border: "none", color: C.danger, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            Delete stable
          </button>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow">Stable</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: C.text }}>{stable.name}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 14 }}>
          {activeMembers.filter(m => m.status === "active").length} members
          {isCreator ? " · 👑 You created this" : ""}
        </div>
        {/* Stable code — share this to invite people */}
        <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 12,
          padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 600,
              textTransform: "uppercase", marginBottom: 4 }}>Stable Code — share to invite</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28,
              letterSpacing: 6, color: C.pink }}>{stable.code}</div>
          </div>
          <button onClick={copyInviteLink}
            style={{ background: C.pink, border: "none", color: "#fff", borderRadius: 8,
              padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit" }}>
            Copy
          </button>
        </div>
      </div>

      {/* Create Challenge button */}
      {isCreator && (
        <button className="btn btn-pink" style={{ width: "100%", marginBottom: 16 }}
          onClick={() => onCreateChallenge && onCreateChallenge(stableCode)}>
          🏇 Create Challenge for this Stable
        </button>
      )}

      {/* Pending requests badge */}
      {isCreator && pendingRequests.length > 0 && (
        <div className="card" style={{ background: "#fff8ee", borderColor: "#ffb700", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#b36000", marginBottom: 8 }}>
            ⏳ {pendingRequests.length} pending request{pendingRequests.length !== 1 ? "s" : ""}
          </div>
          {pendingRequests.map(req => (
            <div key={req.uid} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600 }}>{req.name}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ color: C.danger, borderColor: C.danger }}
                  onClick={() => declineRequest(req.uid)}>Decline</button>
                <button className="btn btn-pink btn-sm" onClick={() => approveRequest(req.uid)}>Approve</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active challenge card */}
      <ActiveStableChallenge stable={stable} authUser={authUser} onCreateChallenge={onCreateChallenge} />

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[["league","🏆 League"],["records","🎖️ Records"],["members","👥 Members"]].map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* LEAGUE TABLE */}
      {tab === "league" && (
        <div className="fade">
          {/* Year filter */}
          {years.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", ...years].map(y => (
                <button key={y} onClick={() => setYearFilter(y)}
                  style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.border}`,
                    background: yearFilter === y ? C.pink : "#fff", color: yearFilter === y ? "#fff" : C.muted,
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {y === "all" ? "All Time" : y}
                </button>
              ))}
            </div>
          )}

          {ranked.map((m, i) => (
            <div key={m.uid} className={`lb-row${i === 0 && m.status !== "left" ? " p1" : ""}`}
              style={{ cursor: m.status === "active" && m.uid !== authUser.uid ? "pointer" : "default",
                opacity: m.status === "left" ? 0.6 : 1 }}
              onClick={() => m.status === "active" && m.uid !== authUser.uid && setSelMember(m)}>
              <div className="lb-rank" style={{ fontSize: 18 }}>{posEmoji(i, m)}</div>
              <SilkAvatar silks={memberSilks[m.uid]} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {profileNames[m.uid] || m.name}
                  {m.uid === authUser.uid && <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}> (you)</span>}
                  {m.status === "left" && <span style={{ color: C.muted, fontSize: 12 }}> · left</span>}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {m.entered} challenge{m.entered !== 1 ? "s" : ""}
                  {m.seconds > 0 ? ` · ${m.seconds} × 🥈` : ""}
                  {m.thirds > 0 ? ` · ${m.thirds} × 🥉` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: i === 0 && m.status !== "left" ? C.pink : C.text }}>
                  {m.wins}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>win{m.wins !== 1 ? "s" : ""}</div>
              </div>
            </div>
          ))}

          {!ranked.length && (
            <div style={{ textAlign: "center", padding: 32, color: C.muted }}>
              No challenge results yet
            </div>
          )}
        </div>
      )}

      {/* RECORDS */}
      {tab === "records" && (
        <StableRecords stable={stable} activeMembers={activeMembers} />
      )}

      {/* MEMBERS */}
      {tab === "members" && (
        <div className="fade">
          {activeMembers.map(m => (
            <div key={m.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderBottom: `1px solid ${C.border}`, opacity: m.status === "left" ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SilkAvatar silks={memberSilks[m.uid]} size={36} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {m.status === "left" ? "👻 " : ""}{profileNames[m.uid] || m.name}
                    {m.uid === stable.creatorUid ? " 👑" : ""}
                    {m.uid === authUser.uid ? <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}> (you)</span> : ""}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {m.status === "left" ? "Left the stable" : `Joined ${new Date(m.joinedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                  </div>
                </div>
              </div>
              {m.uid === authUser.uid && m.uid !== stable.creatorUid && (
                <button onClick={leaveStable}
                  style={{ fontSize: 12, color: C.danger, background: "none", border: `1px solid ${C.danger}`,
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  Leave
                </button>
              )}
              {m.status === "active" && m.uid !== authUser.uid && (
                <button onClick={() => setSelMember(m)}
                  style={{ fontSize: 12, color: C.blue, background: "none", border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  View →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Member profile slide-up */}
      {selMember && (
        <MemberProfilePanel
          member={selMember}
          stable={stable}
          onClose={() => setSelMember(null)}
        />
      )}
    </div>
  );
}

function StableRecords({ stable, activeMembers }) {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function compute() {
      const chCodes = Object.keys(stable.challenges || {});
      const challenges = await Promise.all(chCodes.map(code => dbGet(code)));
      if (cancelled) return;

      // Records to find
      let mostDonuts    = null; // { name, count }
      let highestScore  = null; // { name, score, code, day }
      let biggestWinner = null; // { name, horse, sp, dec, code }
      let biggestPlace  = null; // { name, horse, sp, dec, code }

      const donutCounts = {};
      const memberNames = {};
      activeMembers.forEach(m => { memberNames[m.uid] = m.name; });

      challenges.filter(Boolean).forEach(ch => {
        const races = toArr(ch.selectedRaces || []);
        const hasResults = races.some(r => r.resultIn);
        if (!hasResults) return;

        Object.values(ch.players || {}).forEach(p => {
          const uid = p.uid || p.id;
          if (!memberNames[uid]) return;
          const name = memberNames[uid];

          let chReturn = 0, chStaked = 0;
          races.forEach(race => {
            if (!race.resultIn) return;
            const pick = p.picks?.[race.id];
            if (!pick?.horseId) return;
            const horse = race.runners?.find(h => h.id === pick.horseId);
            if (!horse) return;
            const isNap = p.napRaceId === race.id;
            const ret = calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, isNap, horse.spDec);
            chReturn += ret.total;
            chStaked += ret.staked;

            // Biggest priced winner
            if (horse.position === 1 && horse.sp) {
              const dec = horse.spDec || spToDecimal(horse.sp);
              if (dec && (!biggestWinner || dec > biggestWinner.dec)) {
                biggestWinner = { name, horse: horse.name, sp: horse.sp, dec, day: ch.day };
              }
            }
            // Biggest priced placed horse (non-winner)
            if (horse.position > 1 && race.ewTerms && horse.position <= race.ewTerms.places && horse.sp) {
              const dec = horse.spDec || spToDecimal(horse.sp);
              if (dec && (!biggestPlace || dec > biggestPlace.dec)) {
                biggestPlace = { name, horse: horse.name, sp: horse.sp, dec, day: ch.day };
              }
            }
          });

          // Donut
          if (chReturn === 0 && chStaked > 0) {
            donutCounts[uid] = (donutCounts[uid] || 0) + 1;
          }

          // Highest score
          if (!highestScore || chReturn > highestScore.score) {
            highestScore = { name, score: +chReturn.toFixed(2), day: ch.day };
          }
        });
      });

      // Most donuts
      const donutEntries = Object.entries(donutCounts);
      if (donutEntries.length) {
        const [topUid, topCount] = donutEntries.sort((a, b) => b[1] - a[1])[0];
        mostDonuts = { name: memberNames[topUid] || "Unknown", count: topCount };
      }

      if (!cancelled) {
        setRecords({ mostDonuts, highestScore, biggestWinner, biggestPlace });
        setLoading(false);
      }
    }
    compute();
    return () => { cancelled = true; };
  }, [stable.code]);

  if (loading) return <div className="loader"><span/><span/><span/></div>;

  const items = [
    records.highestScore && {
      icon: "⭐", title: "Highest Ever Score",
      value: `${records.highestScore.score} pts`,
      sub: `${records.highestScore.name} · ${records.highestScore.day}`,
    },
    records.biggestWinner && {
      icon: "🚀", title: "Biggest Priced Winner",
      value: records.biggestWinner.sp,
      sub: `${records.biggestWinner.horse} · ${records.biggestWinner.name} · ${records.biggestWinner.day}`,
    },
    records.biggestPlace && {
      icon: "🎯", title: "Biggest Priced Placed Horse",
      value: records.biggestPlace.sp,
      sub: `${records.biggestPlace.horse} · ${records.biggestPlace.name} · ${records.biggestPlace.day}`,
    },
    records.mostDonuts && {
      icon: "🍩", title: "Most Donuts",
      value: `${records.mostDonuts.count}`,
      sub: records.mostDonuts.name,
    },
  ].filter(Boolean);

  if (!items.length) return (
    <div style={{ textAlign: "center", padding: 40, color: C.muted }} className="fade">
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎖️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>No records yet</div>
      <div style={{ fontSize: 14 }}>Records will appear once challenges have been completed</div>
    </div>
  );

  return (
    <div className="fade">
      {items.map(({ icon, title, value, sub }) => (
        <div key={title} style={{ background: "#fff", border: `1.5px solid ${C.border}`,
          borderRadius: 14, padding: "16px 18px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 36, flexShrink: 0 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 4 }}>{title}</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: C.text }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberProfilePanel({ member, stable, onClose }) {
  const [profile,  setProfile]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const prof = await userGet(member.uid);
      const chalList = await getUserChallenges(member.uid);
      const details = await Promise.all(
        chalList.slice(0, 20).map(async ({ code, joinedAt }) => {
          const ch = await dbGet(code);
          return ch ? { ...ch, joinedAt } : null;
        })
      );
      if (!cancelled) {
        setProfile(prof);
        setHistory(details.filter(Boolean));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [member.uid]);

  const badges = history.length ? computeBadges(member.uid, history) : [];

  // Quick stats
  let entered = 0, won = 0, totalReturn = 0, totalStaked = 0;
  history.forEach(ch => {
    const player = ch.players?.[member.uid];
    if (!player) return;
    const races = toArr(ch.selectedRaces || []);
    const submittedCount = Object.values(ch.players || {}).filter(p => p.picksSubmitted).length;
    if (!ch.isCanned || submittedCount < 5) return;
    entered++;
    const hasResults = races.some(r => r.resultIn);
    if (!hasResults) return;
    let chReturn = 0, chStaked = 0;
    races.forEach(race => {
      if (!race.resultIn) return;
      const pick = player.picks?.[race.id];
      if (!pick?.horseId) return;
      const horse = race.runners?.find(h => h.id === pick.horseId);
      if (!horse) return;
      const ret = calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, player.napRaceId === race.id, horse.spDec);
      chReturn += ret.total; chStaked += ret.staked;
    });
    totalReturn += chReturn; totalStaked += chStaked;
    const ranked = Object.values(ch.players || {}).map(p => {
      let r = 0;
      races.forEach(race => {
        if (!race.resultIn) return;
        const pick = p.picks?.[race.id];
        if (!pick?.horseId) return;
        const horse = race.runners?.find(h => h.id === pick.horseId);
        if (!horse) return;
        r += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, p.napRaceId === race.id, horse.spDec).total;
      });
      return { id: p.id, total: r };
    }).sort((a, b) => b.total - a.total);
    if (ranked[0]?.id === member.uid) won++;
  });
  const pnl = +(totalReturn - totalStaked).toFixed(2);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div style={{ background: "rgba(0,0,0,.45)", position: "absolute", inset: 0 }} />
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
          position: "relative", zIndex: 1, maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,.15)", animation: "slideUp .25s ease" }}>
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.blue,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {(member.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>{member.name}</div>
            <div style={{ fontSize: 13, color: C.muted }}>Member of {stable.name}</div>
          </div>
        </div>

        {loading ? <div className="loader"><span/><span/><span/></div> : (
          <>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Challenges", value: entered },
                { label: "Wins", value: won },
                { label: "Win Rate", value: entered ? `${Math.round(won/entered*100)}%` : "0%" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "'DM Serif Display', serif" }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: pnl >= 0 ? "#f0fff4" : "#fff5f5",
              border: `1.5px solid ${pnl >= 0 ? C.win : C.danger}`, borderRadius: 10,
              padding: "10px 14px", display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Overall P&L</span>
              <span style={{ fontWeight: 700, color: pnl >= 0 ? C.win : C.danger }}>
                {pnl >= 0 ? "+" : ""}{pnl} pts
              </span>
            </div>

            {/* Badges */}
            {badges.length > 0 && (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 600,
                  textTransform: "uppercase", marginBottom: 10 }}>Badges</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {badges.map(key => {
                    const b = BADGE_DEFS[key];
                    if (!b) return null;
                    return (
                      <div key={key} title={b.desc}
                        style={{ background: "#fff", border: `1.5px solid ${C.pink}`,
                          borderRadius: 10, padding: "8px 12px", textAlign: "center",
                          fontSize: 24 }}>
                        {b.icon}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={onClose}
          style={{ width: "100%", padding: 14, background: C.pink, color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", marginTop: 20 }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ── FIND & JOIN STABLE ───────────────────────────────────────────────────────
function FindStableScreen({ authUser, onBack }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(new Set());
  const [toast,   showToast]  = useToast();

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    // Try direct code lookup first (stable codes start with S)
    const upper = query.trim().toUpperCase();
    if (upper.startsWith("S") && upper.length >= 5) {
      const direct = await stableGet(upper);
      if (direct) { setResults([direct]); setLoading(false); return; }
    }
    // Fall back to name search
    const found = await searchStablesByName(query);
    setResults(found);
    setLoading(false);
  }

  async function requestJoin(stable) {
    const fresh = await stableGet(stable.code);
    if (!fresh) return;
    if (fresh.members?.[authUser.uid]?.status === "active") {
      showToast("You're already a member"); return;
    }
    fresh.pendingRequests = fresh.pendingRequests || {};
    fresh.pendingRequests[authUser.uid] = {
      uid: authUser.uid,
      name: authUser.displayName || authUser.email,
      requestedAt: Date.now(),
    };
    await stableSet(stable.code, fresh);
    setRequested(prev => new Set([...prev, stable.code]));
    showToast(`Request sent to ${stable.name} ✅`);
  }

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">Find a Stable</div>
      <div className="sec-title">Search Stables</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" placeholder="Enter stable code or name…" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            style={{ flex: 1 }} />
          <button className="btn btn-blue" onClick={search} disabled={!query.trim() || loading}>
            {loading ? "…" : "Search"}
          </button>
        </div>
      </div>

      {results.map(stable => {
        const memberCount = Object.values(stable.members || {}).filter(m => m.status === "active").length;
        const isMember = stable.members?.[authUser.uid]?.status === "active";
        const isPending = stable.pendingRequests?.[authUser.uid] || requested.has(stable.code);
        return (
          <div key={stable.code} className="card" style={{ marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{stable.name}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{memberCount} member{memberCount !== 1 ? "s" : ""}</div>
            </div>
            {isMember ? (
              <span className="badge b-green">Member ✓</span>
            ) : isPending ? (
              <span className="badge b-grey">Requested ⏳</span>
            ) : (
              <button className="btn btn-pink btn-sm" onClick={() => requestJoin(stable)}>
                Request to join
              </button>
            )}
          </div>
        );
      })}

      {results.length === 0 && query && !loading && (
        <div style={{ textAlign: "center", padding: 32, color: C.muted }}>
          No stables found matching "{query}"
        </div>
      )}
    </div>
  );
}

// ── BADGE DEFINITIONS (top-level so App + ProfileScreen can both use) ───────
const BADGE_DEFS = {
  first_challenge: { icon: "🎟️", label: "First Challenge",  desc: "Entered your first StableMates challenge" },
  winner:          { icon: "🏆", label: "Challenge Winner",  desc: "Won a StableMates challenge" },
  podium:          { icon: "🥈", label: "Podium",            desc: "Finished 2nd or 3rd in a challenge" },
  donut:           { icon: "🍩", label: "Donut",             desc: "Scored zero in a challenge" },
  twenty_to_one:   { icon: "🎯", label: "20/1 Winner",       desc: "Backed a winner at 20/1 or bigger" },
  fifty_to_one:    { icon: "🚀", label: "50/1 Winner",       desc: "Backed a winner at 50/1 or bigger" },
  century:         { icon: "💯", label: "Century",           desc: "Backed a winner at 100/1 or bigger" },
  veteran:         { icon: "🎪", label: "Veteran",           desc: "Entered 10 challenges" },
  seasoned:        { icon: "🏟️", label: "Seasoned",          desc: "Entered 25 challenges" },
  legend:          { icon: "🌟", label: "Legend",            desc: "Entered 50 challenges" },
  hat_trick:       { icon: "🔥", label: "Hat Trick",         desc: "Entered 3 challenges in a row" },
  in_the_black:    { icon: "📈", label: "In The Black",      desc: "Turned a profit in 3 challenges in a row" },
  stable_master:   { icon: "🏠", label: "Stable Master",     desc: "Created a Stable" },
};

// ── BADGE CELEBRATION ────────────────────────────────────────────────────────
const CONFETTI_COLOURS = ["#ff007f","#1a7fd4","#ffb700","#00b86b","#7c3aed","#ff4dab","#4aa8f0"];

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
    isRect: Math.random() > 0.5,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 800, overflow: "hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.left}%`,
          top: -20,
          width: p.isRect ? p.size * 0.6 : p.size,
          height: p.size,
          background: p.colour,
          borderRadius: p.isRect ? 2 : "50%",
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          transform: `rotate(${p.rotation}deg)`,
          opacity: 0.9,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function BadgeCelebrationModal({ badges, badgeDefs, onDismiss }) {
  const [idx, setIdx] = useState(0);
  if (!badges?.length) return null;
  const badge = badgeDefs[badges[idx]];
  if (!badge) { onDismiss(); return null; }
  const isLast = idx === badges.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(13,45,74,0.92)", padding: 24 }}>
      <Confetti />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
        maxWidth: 360, width: "100%" }}>

        {/* Badge count */}
        {badges.length > 1 && (
          <div style={{ fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,.5)",
            fontWeight: 600, marginBottom: 16, textTransform: "uppercase" }}>
            Badge {idx + 1} of {badges.length}
          </div>
        )}

        {/* Badge icon */}
        <div style={{ fontSize: 96, marginBottom: 24, animation: "badgePop .5s ease",
          filter: "drop-shadow(0 8px 24px rgba(255,0,127,.4))" }}>
          {badge.icon}
        </div>

        {/* Badge name */}
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32,
          color: "#fff", marginBottom: 12, lineHeight: 1.2 }}>
          {badge.label}
        </div>

        {/* Badge description */}
        <div style={{ fontSize: 16, color: "rgba(255,255,255,.7)", marginBottom: 40,
          lineHeight: 1.6, maxWidth: 280 }}>
          {badge.desc}
        </div>

        {/* Share + Dismiss buttons */}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={async () => {
            const text = `${badge.icon} I just earned the "${badge.label}" badge on StableMates! 🐴`;
            if (navigator.share) {
              try { await navigator.share({ title: "StableMates Badge", text }); } catch {}
            } else {
              try { await navigator.clipboard.writeText(text); } catch {}
            }
          }} style={{ flex: 1, padding: "16px 12px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,.3)",
            background: "rgba(255,255,255,.12)", color: "#fff", fontFamily: "inherit",
            fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Share 📤
          </button>
          <button onClick={() => {
            if (isLast) { onDismiss(); }
            else { setIdx(i => i + 1); }
          }} className="btn btn-pink" style={{ flex: 2, fontSize: 18, padding: "16px 24px" }}>
            {isLast ? "Cheers! 🥂" : `Next Badge →`}
          </button>
        </div>

        {badges.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
            {badges.map((_, i) => (
              <div key={i} style={{ width: i === idx ? 20 : 8, height: 8, borderRadius: 4,
                background: i <= idx ? "#fff" : "rgba(255,255,255,.3)", transition: "all .2s" }} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes badgePop { from{transform:scale(0.3);opacity:0} 70%{transform:scale(1.15)} to{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}

// ── AUTH SCREENS ─────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode,     setMode]     = useState("login"); // login | register | reset
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [err,      setErr]      = useState("");
  const [msg,      setMsg]      = useState("");
  const [busy,     setBusy]     = useState(false);

  async function handleGoogle() {
    setBusy(true); setErr("");
    try {
      const result = await signInWithPopup(auth, gProvider);
      await ensureUserProfile(result.user);
      onAuth(result.user);
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }

  async function handleEmail() {
    if (!email.trim()) return setErr("Please enter your email");
    if (!password)     return setErr("Please enter your password");
    if (mode === "register" && !name.trim()) return setErr("Please enter your name");
    setBusy(true); setErr("");
    try {
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(result.user, { displayName: name.trim() });
        await ensureUserProfile(result.user, name.trim());
        onAuth(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(result.user);
        onAuth(result.user);
      }
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }

  async function handleReset() {
    if (!email.trim()) return setErr("Enter your email address first");
    setBusy(true); setErr("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg("Password reset email sent — check your inbox");
      setMode("login");
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }

  function friendlyError(e) {
    const code = e.code || "";
    if (code.includes("email-already"))   return "An account with this email already exists";
    if (code.includes("wrong-password"))  return "Incorrect password";
    if (code.includes("user-not-found"))  return "No account found with this email";
    if (code.includes("weak-password"))   return "Password must be at least 6 characters";
    if (code.includes("invalid-email"))   return "Please enter a valid email address";
    if (code.includes("popup-closed"))    return "Sign-in cancelled";
    if (code.includes("network"))         return "Network error — check your connection";
    return "Something went wrong — please try again";
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <img src="/icons/logo-transparent.png" alt="StableMates"
          style={{ width: 120, height: 120, marginBottom: 16 }} />
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: C.text }}>
          Stable<span style={{ color: C.pink }}>Mates</span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          {mode === "register" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to play"}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Google Sign In */}
        {mode !== "reset" && (
          <>
            <button onClick={handleGoogle} disabled={busy}
              style={{ width: "100%", padding: "13px 20px", borderRadius: 12, border: `1.5px solid ${C.border}`,
                background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
                color: C.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 12, color: C.mutedLt, fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
          </>
        )}

        {/* Email form */}
        <div className="card" style={{ padding: 20 }}>
          {mode === "register" && (
            <div className="field">
              <label>Your name</label>
              <input className="inp" placeholder="e.g. Tom" value={name}
                onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Email address</label>
            <input className="inp" type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (mode === "reset" ? handleReset() : handleEmail())} />
          </div>
          {mode !== "reset" && (
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Password</label>
              <input className="inp" type="password" placeholder="Min 6 characters" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleEmail()} />
            </div>
          )}

          {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ color: C.win, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{msg}</div>}

          <button onClick={mode === "reset" ? handleReset : handleEmail}
            disabled={busy}
            className="btn btn-pink" style={{ width: "100%", marginTop: 4 }}>
            {busy ? "Please wait…" : mode === "register" ? "Create Account" : mode === "reset" ? "Send Reset Email" : "Sign In"}
          </button>
        </div>

        {/* Mode switchers */}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.muted }}>
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("register"); setErr(""); setMsg(""); }}
                style={{ background: "none", border: "none", color: C.blue, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                Create an account
              </button>
              {" · "}
              <button onClick={() => { setMode("reset"); setErr(""); setMsg(""); }}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13 }}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "register" && (
            <button onClick={() => { setMode("login"); setErr(""); }}
              style={{ background: "none", border: "none", color: C.blue, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              Already have an account? Sign in
            </button>
          )}
          {mode === "reset" && (
            <button onClick={() => { setMode("login"); setErr(""); }}
              style={{ background: "none", border: "none", color: C.blue, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              Back to sign in
            </button>
          )}
        </div>

        {/* Guest option */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button onClick={() => onAuth(null)}
            style={{ background: "none", border: "none", color: C.mutedLt, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13 }}>
            Continue as guest →
          </button>
          <div style={{ fontSize: 11, color: C.mutedLt, marginTop: 4 }}>
            Guests can join challenges but won't have stats or stables
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure user profile exists in Firebase DB
async function ensureUserProfile(firebaseUser, displayName = null) {
  const uid = firebaseUser.uid;
  const existing = await userGet(uid);
  if (!existing) {
    const name = displayName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Player";
    await userSet(uid, {
      uid,
      name,
      email: firebaseUser.email || null,
      photoURL: firebaseUser.photoURL || null,
      createdAt: Date.now(),
      challengesEntered: 0,
      challengesWon: 0,
      badges: [],
    });
  }
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeScreen({ onCreate, onJoin, openAbout, authUser }) {
  const [createName, setCreateName] = useState(authUser?.displayName || "");
  const [joinName,   setJoinName]   = useState(authUser?.displayName || "");
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>Start a new game</div>
            <img src="/icons/logo-transparent.png" alt="" style={{ width: 28, height: 28, opacity: 0.18, flexShrink: 0 }} />
          </div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14, marginTop: 6 }}>Create</div>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>Join a friend's game</div>
            <img src="/icons/logo-transparent.png" alt="" style={{ width: 28, height: 28, opacity: 0.18, flexShrink: 0 }} />
          </div>
          <div className="sec-title" style={{ fontSize: 20, marginBottom: 14, marginTop: 6 }}>Join</div>
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
  const [usedItvCard, setUsedItvCard] = useState(false);
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
    // Try direct ID match first, then fall back to course+time match
    let matched = racecards.filter(r => itvSet.has(r.id));
    if (matched.length === 0 && itvCard.raceMeta?.length) {
      // Match by course+time if IDs differ (e.g. tomorrow card loaded today)
      matched = racecards.filter(r =>
        itvCard.raceMeta.some(m => m.course === r.course && m.time === r.time)
      );
    }
    if (!matched.length) {
      showToast("No matching races found — check the day selected");
      return;
    }
    setSelected(new Set(matched.map(r => r.id)));
    setUsedItvCard(true);
    showToast(`${itvCard.label || "ITV Card"} loaded ✅`);
  }

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    const selectedRaces = racecards.filter(r => selected.has(r.id));
    const updated = { ...challenge, day: resolveDate(day), racecards,
      selectedRaceIds: [...selected], selectedRaces, status: "open",
      isCanned: usedItvCard, // mark as official canned challenge for badges/stats
      itvLabel: usedItvCard ? (itvCard?.label || null) : null,
    };
    await dbSet(updated.code, updated);
    showToast("Challenge saved!");
    setTimeout(() => onSave(updated), 600);
  }

  const [mode, setMode] = useState(null); // null=choose, "main"=main challenge, "custom"=pick your own

  // If no ITV card available, go straight to custom
  const effectiveMode = !itvCard?.raceIds?.length ? "custom" : mode;

  async function startMainChallenge() {
    setMode("main");
    setLoading(true); setError("");
    try {
      const data = await apiGet(`/api/racecards?day=${day}`);
      const parsed = parseRacecards(data);
      setRacecards(parsed);
      if (!parsed.length) { setError("No races found for this day."); setLoading(false); return; }
      // Auto-select ITV card races
      const itvSet = new Set(itvCard.raceIds);
      let matched = parsed.filter(r => itvSet.has(r.id));
      if (!matched.length && itvCard.raceMeta?.length) {
        matched = parsed.filter(r => itvCard.raceMeta.some(m => m.course === r.course && m.time === r.time));
      }
      if (matched.length) {
        setSelected(new Set(matched.map(r => r.id)));
        setUsedItvCard(true);
      } else {
        setError("Couldn't match the main card races — please use 'Pick Your Own'");
        setMode(null);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop: 24 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">Challenge Setup</div>
      <div className="sec-title">Set Up Your Challenge</div>

      {/* Day selector — always visible */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Race day</label>
          <div className="day-toggle">
            <button className={`day-btn${day === "today" ? " active" : ""}`} onClick={() => { setDay("today"); setMode(null); setRacecards([]); setSelected(new Set()); }}>Today</button>
            <button className={`day-btn${day === "tomorrow" ? " active" : ""}`} onClick={() => { setDay("tomorrow"); setMode(null); setRacecards([]); setSelected(new Set()); }}>Tomorrow</button>
          </div>
        </div>
      </div>

      {/* Mode chooser — shown when ITV card available and no mode chosen */}
      {!effectiveMode && (
        <div className="fade">
          {itvCard?.label && (
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 12 }}>
              📺 <strong style={{ color: C.text }}>{itvCard.label}</strong> is set as the main challenge
            </div>
          )}
          <button className="btn btn-pink" style={{ width: "100%", marginBottom: 10, padding: "16px" }}
            onClick={startMainChallenge}>
            📺 Main Challenge
          </button>
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 16 }}>
            Uses the pre-selected featured race card
          </div>
          <button className="btn btn-outline" style={{ width: "100%" }}
            onClick={() => setMode("custom")}>
            Pick Your Own Races
          </button>
        </div>
      )}

      {/* Custom race picker */}
      {effectiveMode === "custom" && (
        <div className="fade">
          <div className="card" style={{ marginBottom: 14 }}>
            <button className="btn btn-blue" onClick={load} disabled={loading} style={{ width: "100%" }}>
              {loading ? "Loading…" : "Load Races"}
            </button>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
          </div>
          {loading && <Loader />}
          {racecards.length > 0 && (
            <CourseAccordion racecards={racecards} selected={selected} toggle={toggle} onSave={save} />
          )}
        </div>
      )}

      {/* Main challenge — auto-selected, just confirm */}
      {effectiveMode === "main" && !loading && racecards.length > 0 && selected.size > 0 && (
        <div className="fade">
          {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="card" style={{ marginBottom: 14, borderColor: C.pink, background: C.pinkBg }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📺 {itvCard?.label || "Main Challenge"}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
              {selected.size} race{selected.size !== 1 ? "s" : ""} selected
            </div>
            {[...selected].map(id => {
              const r = racecards.find(rc => rc.id === id);
              return r ? (
                <div key={id} style={{ fontSize: 13, padding: "4px 0", borderTop: `1px solid ${C.border}` }}>
                  <span className="time-badge">{r.time}</span>{r.course}
                </div>
              ) : null;
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setMode(null); setRacecards([]); setSelected(new Set()); }}>
              ← Back
            </button>
            <button className="btn btn-pink" style={{ flex: 2 }} onClick={save}>
              Save Challenge →
            </button>
          </div>
        </div>
      )}

      {loading && <Loader />}
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
    return dbListen(ch.code, fresh => setCh(normaliseChallenge(fresh)));
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

  const [editing, setEditing] = useState(
    editMode || !submitted || Object.values(player?.picks || {}).some(p => p?.nonRunner)
  );
  const [saving,        setSaving]       = useState(false);
  const [napWarning,    setNapWarning]   = useState(false);
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [toast,         showToast]       = useToast();
  const raceRefs = useRef({});

  // Sync picks from challenge prop when NRs are marked externally
  useEffect(() => {
    const freshPlayer = challenge.players?.[playerId];
    if (freshPlayer?.picks) {
      setPicks(freshPlayer.picks);
      if (freshPlayer.napRaceId) setNapId(freshPlayer.napRaceId);
    }
  }, [challenge]);



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

  async function pickHorse(raceId, hId) {
    // Only allow picking if: editing & (race not locked OR it's an NR race)
    if (!editing) return;
    if (locked && !nrRaces.has(raceId)) return;
    const newPick = { horseId: hId, betType: picks[raceId]?.betType || "win" };
    setPicks(p => ({ ...p, [raceId]: newPick }));
    // If replacing an NR, write to Firebase immediately so banner clears
    if (nrRaces.has(raceId)) {
      const fresh = (await dbGet(challenge.code)) || challenge;
      if (fresh.players?.[playerId]) {
        // Explicitly remove nonRunner flag from the pick
        const cleanPick = { horseId: hId, betType: picks[raceId]?.betType || "win" };
        fresh.players[playerId].picks = { ...fresh.players[playerId].picks, [raceId]: cleanPick };
        await dbSet(fresh.code, fresh);
      }
    }
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
        {submitted && (!locked || nrRaces.size > 0) && (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(e => !e)}>
            {editing ? "Cancel" : nrRaces.size > 0 ? "⚠️ Replace Non-Runner" : "✏️ Change Picks"}
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
        // Recalculate EW terms based on actual non-NR runners
        const activeRunners = race.runners.filter(h => !h.nonRunner && h.number !== 'NR');
        const liveEwTerms = getEWTerms(activeRunners.length, race.isHandicap);
        const ewAvail    = !!liveEwTerms;
        const isNap      = napId === race.id;
        const isNR       = nrRaces.has(race.id);
        const raceOpen   = openRaces.has(race.id);
        // NR races stay editable until the result comes in, even after off time
        const canEditThis = isEditing && (!locked || isNR) && raceOpen;

        return (
          <div key={race.id} ref={el => raceRefs.current[race.id] = el} data-race-id={race.id} className="card" style={{ marginBottom: 12, opacity: locked && !isNR && !isEditing ? 0.85 : 1, ...(isNap ? { borderColor: "#ff8c00", boxShadow: "0 4px 18px rgba(255,140,0,.2)" } : {}), ...(isNR ? { borderColor: C.danger, background: "#fff0f0" } : {}), ...(!picks[race.id]?.horseId && !locked ? { borderColor: C.pink + "66" } : {}) }}>
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
                    ? <span className="ew-terms">{liveEwTerms.places} places · 1/{liveEwTerms.fraction}</span>
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
                {race.runners.filter(h => !h.nonRunner && h.number !== "NR").map(h => {
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
                ⏰ Race resulted — defaulting to 2pts on SP favourite.
              </div>
            )}
          </div>
        );
      })}

      {isEditing && (
        <div style={{ textAlign: "center", marginTop: 20, marginBottom: 24 }}>
          {napWarning && (
            <div className="card" style={{ background: "#fff8ee", borderColor: "#ffb700", marginBottom: 14, textAlign: "left" }}>
              <div style={{ fontWeight: 700, color: "#b36000", marginBottom: 6 }}>⭐ You need to set a NAP!</div>
              <div style={{ fontSize: 13, color: "#b36000", marginBottom: 12 }}>
                Pick your strongest fancy and mark it as your NAP before submitting.
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setNapWarning(false)}>
                Go back &amp; pick NAP
              </button>
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
  const [ch,          setCh]        = useState(challenge);
  const [tab,         setTab]       = useState(null);
  const [err,         setErr]       = useState("");
  const [toast,       showToast]    = useToast();
  const [playerSilks, setPlayerSilks] = useState({});

  // Load silks for all players
  useEffect(() => {
    const players = Object.values(challenge.players || {});
    Promise.all(players.map(async p => {
      const uid = p.uid || p.id;
      const profile = await userGet(uid);
      return [uid, profile?.silks || null];
    })).then(entries => {
      setPlayerSilks(Object.fromEntries(entries.filter(([,s]) => s)));
    });
  }, [challenge.code]);


  const races   = sortRaces(ch.selectedRaces || []);
  const players = Object.values(ch.players || {});
  // Picks are visible to all once the first race has gone off
  const isLocked = races.length > 0 && raceTimeToDate(races[0].time, ch.day || "today") <= new Date();

  // Real-time listener — all players see updates instantly
  useEffect(() => {
    return dbListen(ch.code, fresh => setCh(normaliseChallenge(fresh)));
  }, [ch.code]);

  // Auto-detect non-runners by re-polling racecards every 3 mins before races run
  useEffect(() => {
    const unrunRaces = (ch.selectedRaces || []).filter(r => !r.resultIn && isRaceOpen(r, ch.day));
    if (!unrunRaces.length) return;
    let cancelled = false;
    const checkNRs = async () => {
      if (cancelled) return;
      try {
        const todayStr    = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const apiDay = ch.day === tomorrowStr ? "tomorrow" : "today";
        const data = await apiGet(`/api/racecards?day=${apiDay}`);
        const fresh = await dbGet(ch.code);
        if (!fresh || cancelled) return;

        // Build a lookup of all runners from the API racecard by horse_id
        // NRs are identified by number === "NR" or jockey === "NON-RUNNER"
        const apiRunnerMap = {};
        (data.racecards || []).forEach(race => {
          (race.runners || []).forEach(h => {
            if (h.horse_id) apiRunnerMap[h.horse_id] = h;
          });
        });

        let changed = false;
        fresh.selectedRaces = toArr(fresh.selectedRaces).map(race => {
          if (race.resultIn) return race;
          const updatedRunners = race.runners.map(h => {
            const apiRunner = apiRunnerMap[h.id];
            const isNR = apiRunner && (apiRunner.number === "NR" || apiRunner.jockey === "NON-RUNNER");
            if (isNR && !h.nonRunner) {
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
                p.picks[race.id] = { ...pick, horseId: null, nonRunner: true };
              }
            });
          });
          await dbSet(fresh.code, fresh);
          if (!cancelled) {
            setCh(normaliseChallenge(fresh));
            showToast("⚠️ Non-runner detected — affected picks cleared");
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
          // Find lowest SP, then break ties by lowest cloth number
          const lowestSP = Math.min(...finishers.map(h => h.spDec));
          const jointFavs = finishers.filter(h => h.spDec === lowestSP);
          horse = jointFavs.reduce((pick, h) => {
            const hNum = parseInt(h.number) || 999;
            const pickNum = parseInt(pick.number) || 999;
            return hNum < pickNum ? h : pick;
          }, jointFavs[0]);
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
    setCh(normaliseChallenge(fresh));
    showToast("⚠️ Non-runner marked — affected picks cleared");
  }

  const pendingCount = races.filter(r => !r.resultIn).length;

  return (
    <div style={{ paddingTop: 22 }} className="fade">
      <Toast msg={toast} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 10 }} onClick={onBack}>← Back</button>
          <div className="eyebrow">
            Results
            {ch.stableCode && <span style={{ marginLeft: 8, color: C.blue }}>· 🏠 Stable Challenge</span>}
            {ch.isCanned && <span style={{ marginLeft: 8, color: C.pink }}>· 📺 Official</span>}
          </div>
          <div className="sec-title" style={{ marginBottom: 0 }}>{races.length} races · 2pts per race</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {pendingCount > 0 && (
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginTop: 4 }}>
              <span className="live-dot" />Checking results every 60s…
            </div>
          )}
          {ch.status === "open" && isCreator && (
            <button className="btn btn-pink btn-sm" onClick={async () => {
              const updated = { ...ch, status: "selections" };
              await dbSet(ch.code, updated);
              setCh(normaliseChallenge(updated));
            }}>
              Open Selections →
            </button>
          )}
        </div>
      </div>

      {/* Pre-selections waiting state */}
      {ch.status === "open" && (
        <div className="card" style={{ marginBottom: 16, textAlign: "center", borderColor: C.blue, background: "#f0f7ff" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎟️</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: C.text, marginBottom: 4 }}>
            Waiting for selections to open
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Share code <span style={{ fontFamily: "monospace", fontWeight: 700, color: C.pink }}>{ch.code}</span> with friends to invite them
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => {
            navigator.clipboard?.writeText(ch.code).catch(() => {});
          }}>Copy Code</button>
        </div>
      )}

      {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

      {/* 1. YOUR RETURNS CARD */}
      {me && (
        <div className="card card-pink" style={{ marginBottom: 16, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your Returns · {me.name}</div>
          <div className="pts-big">{fmtPts(me.totalReturn)}</div>
          <div className="pts-sub">
            {me.wins} winner{me.wins !== 1 ? "s" : ""}
            {me.places > 0 ? ` · ${me.places} placed` : ""}
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
            <SilkAvatar silks={playerSilks[p.uid || p.id]} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {p.name}{p.id === ch.creatorId ? " 👑" : ""}
                {p.id === playerId ? <span style={{ color: C.muted, fontSize: 13, fontWeight: 400 }}> (you)</span> : ""}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                {p.wins}W{p.places > 0 ? ` · ${p.places}P` : ""} · {p.totalStaked} pts staked
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
                                {pk.name}{pk.isNap ? ` ⭐ ${pk.betType === "ew" ? "EW" : "Win"}` : pk.betType === "ew" ? " EW" : ""}
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
          {me.detail.map(({ race, horse, betType, isNap, isNRDefault, ret }, i) => {
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
              Total staked: {me.totalStaked} pts
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

// ── BADGE COMPUTATION ────────────────────────────────────────────────────────
function computeBadges(uid, history) {
  const BADGES = new Set();
  if (!uid || !history?.length) return [...BADGES];
  const chResults = [];

  history.forEach(ch => {
    const player = ch.players?.[uid];
    if (!player) return;
    const races = toArr(ch.selectedRaces || []);
    BADGES.add("first_challenge");
    const submittedCount = Object.values(ch.players || {}).filter(p => p.picksSubmitted).length;
    const isQualifying = !!ch.isCanned && submittedCount >= 5;
    const hasResults = races.some(r => r.resultIn);
    if (!hasResults) return;

    let chReturn = 0, chStaked = 0;
    races.forEach(race => {
      if (!race.resultIn) return;
      const pick = player.picks?.[race.id];
      if (!pick?.horseId) return;
      const horse = race.runners?.find(h => h.id === pick.horseId);
      if (!horse) return;
      const isNap = player.napRaceId === race.id;
      const ret = calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, isNap, horse.spDec);
      chReturn += ret.total;
      chStaked += ret.staked;
      if (horse.position === 1 && isQualifying) {
        const dec = horse.spDec || spToDecimal(horse.sp);
        if (dec >= 101) BADGES.add("century");
        else if (dec >= 51) BADGES.add("fifty_to_one");
        else if (dec >= 21) BADGES.add("twenty_to_one");
      }
    });
    if (chReturn === 0 && chStaked > 0 && isQualifying) BADGES.add("donut");

    if (!isQualifying) {
      chResults.push({ joinedAt: ch.joinedAt || 0, profit: +(chReturn - chStaked).toFixed(2) });
      return;
    }

    const players = Object.values(ch.players || {});
    const ranked = players.map(p => {
      let r = 0;
      races.forEach(race => {
        if (!race.resultIn) return;
        const pick = p.picks?.[race.id];
        if (!pick?.horseId) return;
        const horse = race.runners?.find(h => h.id === pick.horseId);
        if (!horse) return;
        r += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, p.napRaceId === race.id, horse.spDec).total;
      });
      return { id: p.id, total: r };
    }).sort((a, b) => b.total - a.total);

    const myPos = ranked.findIndex(p => p.id === uid) + 1;
    if (myPos === 1) BADGES.add("winner");
    if (myPos === 2 || myPos === 3) BADGES.add("podium");

    chResults.push({ joinedAt: ch.joinedAt || 0, profit: +(chReturn - chStaked).toFixed(2) });
  });

  const total = chResults.length;
  if (total >= 10) BADGES.add("veteran");
  if (total >= 25) BADGES.add("seasoned");
  if (total >= 50) BADGES.add("legend");

  const sorted = [...chResults].sort((a, b) => a.joinedAt - b.joinedAt);
  let consec = 1, profitConsec = 1;
  for (let i = 1; i < sorted.length; i++) {
    const dayGap = (sorted[i].joinedAt - sorted[i-1].joinedAt) / 86400000;
    consec = dayGap <= 14 ? consec + 1 : 1;
    profitConsec = (sorted[i].profit > 0 && sorted[i-1].profit > 0) ? profitConsec + 1 : (sorted[i].profit > 0 ? 1 : 0);
    if (consec >= 3) BADGES.add("hat_trick");
    if (profitConsec >= 3) BADGES.add("in_the_black");
  }

  return [...BADGES];
}

// ── PROFILE HEADER (with display name editing) ───────────────────────────────
// ── SILKS ────────────────────────────────────────────────────────────────────
const BHA_COLOURS = [
  {name:"White",hex:"#F8F8F8"},{name:"Black",hex:"#1a1a1a"},
  {name:"Dark Blue",hex:"#0d2d6e"},{name:"Royal Blue",hex:"#1a5eb8"},
  {name:"Light Blue",hex:"#5ba3d9"},{name:"Dark Green",hex:"#1a5c2a"},
  {name:"Emerald",hex:"#2ecc71"},{name:"Yellow",hex:"#f9e04b"},
  {name:"Gold",hex:"#d4a017"},{name:"Orange",hex:"#e8730a"},
  {name:"Red",hex:"#cc1e1e"},{name:"Maroon",hex:"#6b0f0f"},
  {name:"Brown",hex:"#7b4a1e"},{name:"Pink",hex:"#ff007f"},
  {name:"Purple",hex:"#6b21a8"},{name:"Grey",hex:"#8a8a8a"},
  {name:"Mauve",hex:"#c084cc"},{name:"Straw",hex:"#e8d5a0"},
];
const SILK_BODY_P  = ["Plain","Star","Hoops","Stripes","Halved","Quartered","Sash","Cross Belts","Check","Spots","Diamonds","Diabolo","Stars","Chevron","Epaulettes","Seams"];
const SILK_SLEEVE_P = ["Plain","Hooped","Striped","Spots","Stars","Chevron","Armlets","Seams"];
const SILK_CAP_P   = ["Plain","Quartered","Hooped","Spots","Stars","Peak"];
const DEFAULT_SILKS = { body:"Plain", sleeve:"Plain", cap:"Plain", col1:"#F8F8F8", col2:"#F8F8F8", sleeveCol:"#F8F8F8", capCol:"#1a1a1a" };

// SVG path definitions
const SK = {
  HEAD: "M75,75 Q73,42 100,32 Q127,22 132,48 Q137,68 122,78 Q108,88 88,84 Q75,82 75,75 Z",
  NECK: "M90,76 L88,92 Q100,98 112,92 L110,76 Q100,82 90,76 Z",
  BODY: "M52,92 Q36,100 34,122 L30,240 Q30,252 44,254 L156,254 Q170,252 168,240 L162,122 Q160,100 144,92 Q124,84 100,83 Q76,84 52,92 Z",
  LARM: "M36,94 Q14,96 2,112 L-14,252 Q-16,264 -2,268 L20,272 Q34,274 38,260 L52,116 Q54,102 48,94 Z",
  RARM: "M160,94 Q182,96 194,112 L210,248 Q214,260 200,264 L178,270 Q164,272 160,258 L144,116 Q142,102 148,94 Z",
  HELM: "M60,76 Q58,24 100,16 Q142,24 140,76 Q132,90 100,93 Q68,90 60,76 Z",
  PEAK: "M60,76 Q74,90 100,93 Q126,90 140,76 Q128,86 100,89 Q72,86 60,76 Z",
};

function silkBodyPat(c2, bp) {
  switch(bp) {
    case "Star":     { let pts=""; for(let i=0;i<5;i++){const a=Math.PI*2*i/5-Math.PI/2,b=a+Math.PI/5;pts+=`${97+52*Math.cos(a)},${173+52*Math.sin(a)} ${97+22*Math.cos(b)},${173+22*Math.sin(b)} `;} return `<polygon points="${pts}" fill="${c2}"/>`; }
    case "Hoops":    { let r=""; for(let y=92;y<254;y+=20) r+=`<rect x="25" y="${y}" width="155" height="10" fill="${c2}"/>`; return r; }
    case "Stripes":  { let r=""; for(let x=28;x<172;x+=16) r+=`<rect x="${x}" y="80" width="8" height="180" fill="${c2}"/>`;  return r; }
    case "Halved":   return `<rect x="100" y="80" width="75" height="180" fill="${c2}"/>`;
    case "Quartered":return `<rect x="100" y="80" width="75" height="87" fill="${c2}"/><rect x="28" y="167" width="72" height="93" fill="${c2}"/>`;
    case "Sash":     return `<polygon points="34,92 82,92 172,254 124,254" fill="${c2}"/>`;
    case "Cross Belts": return `<polygon points="34,92 70,92 172,254 136,254" fill="${c2}"/><polygon points="166,92 130,92 30,254 66,254" fill="${c2}"/>`;
    case "Check":    { let r=""; for(let y=92;y<254;y+=18) for(let x=30;x<170;x+=18) if((Math.floor((y-92)/18)+Math.floor((x-30)/18))%2) r+=`<rect x="${x}" y="${y}" width="18" height="18" fill="${c2}"/>`; return r; }
    case "Spots":    return [[72,126],[122,126],[97,162],[72,198],[122,198],[97,232]].map(([cx,cy])=>`<circle cx="${cx}" cy="${cy}" r="12" fill="${c2}"/>`).join("");
    case "Diamonds": return [[97,124],[70,162],[124,162],[97,198],[70,232],[124,232]].map(([cx,cy])=>`<polygon points="${cx},${cy-15} ${cx+13},${cy} ${cx},${cy+15} ${cx-13},${cy}" fill="${c2}"/>`).join("");
    case "Diabolo":  return `<polygon points="30,92 170,92 97,173" fill="${c2}"/><polygon points="30,254 170,254 97,173" fill="${c2}"/>`;
    case "Stars":    return [[97,122],[68,164],[126,164],[78,206],[116,206]].map(([cx,cy])=>{let p="";for(let i=0;i<5;i++){const a=Math.PI*2*i/5-Math.PI/2,b=a+Math.PI/5;p+=`${cx+14*Math.cos(a)},${cy+14*Math.sin(a)} ${cx+5.5*Math.cos(b)},${cy+5.5*Math.sin(b)} `;}return`<polygon points="${p}" fill="${c2}"/>`;}).join("");
    case "Chevron":  return [148,176,204].map(y=>`<polygon points="30,${y-13} 97,${y+9} 170,${y-13} 170,${y} 97,${y+22} 30,${y}" fill="${c2}"/>`).join("");
    case "Epaulettes": return `<rect x="30" y="92" width="50" height="32" fill="${c2}"/><rect x="118" y="92" width="52" height="32" fill="${c2}"/>`;
    case "Seams":    return `<line x1="97" y1="92" x2="97" y2="254" stroke="${c2}" stroke-width="5"/><line x1="30" y1="173" x2="170" y2="173" stroke="${c2}" stroke-width="5"/>`;
    default: return "";
  }
}

function silkSleevePat(c2, sp, side) {
  const L = side === "left";
  switch(sp) {
    case "Hooped":  { let r=""; for(let y=94;y<272;y+=22) r+=`<rect x="-20" y="${y}" width="240" height="11" fill="${c2}"/>`; return r; }
    case "Striped": { let r=""; for(let i=0;i<10;i++) r+=`<rect x="${-20+i*16}" y="0" width="8" height="320" fill="${c2}"/>`; return r; }
    case "Spots":   return (L?[[18,138],[6,178],[18,218]]:[[178,138],[190,178],[178,218]]).map(([cx,cy])=>`<circle cx="${cx}" cy="${cy}" r="9" fill="${c2}"/>`).join("");
    case "Stars":   return (L?[[12,145],[8,188]]:[[184,145],[188,188]]).map(([cx,cy])=>{let p="";for(let i=0;i<5;i++){const a=Math.PI*2*i/5-Math.PI/2,b=a+Math.PI/5;p+=`${cx+10*Math.cos(a)},${cy+10*Math.sin(a)} ${cx+4*Math.cos(b)},${cy+4*Math.sin(b)} `;}return`<polygon points="${p}" fill="${c2}"/>`;}).join("");
    case "Chevron": return [148,176,204].map(y=>L?`<polygon points="-18,${y-10} 40,${y+5} 40,${y+13} -18,${y}" fill="${c2}"/>` : `<polygon points="214,${y-10} 156,${y+5} 156,${y+13} 214,${y}" fill="${c2}"/>`).join("");
    case "Armlets": return [148,172].map(y=>`<rect x="-20" y="${y}" width="240" height="9" fill="${c2}"/>`).join("");
    case "Seams":   return L ? `<line x1="24" y1="94" x2="-10" y2="268" stroke="${c2}" stroke-width="4"/>` : `<line x1="172" y1="94" x2="206" y2="264" stroke="${c2}" stroke-width="4"/>`;
    default: return "";
  }
}

function silkHelmetPat(capCol, cp, col1, col2) {
  const cc2 = capCol === col1 ? col2 : col1;
  const cl = (html) => `<g clip-path="url(#helmClip)">${html}</g>`;
  switch(cp) {
    case "Quartered": return cl(`<rect x="100" y="12" width="48" height="82" fill="${cc2}"/><rect x="52" y="46" width="48" height="48" fill="${cc2}"/>`);
    case "Hooped":    return cl([24,40,56].map(y=>`<rect x="40" y="${y}" width="122" height="10" fill="${cc2}"/>`).join(""));
    case "Spots":     return cl([[100,36],[78,58],[122,58],[100,76]].map(([cx,cy])=>`<circle cx="${cx}" cy="${cy}" r="9" fill="${cc2}"/>`).join(""));
    case "Stars":     return cl([[100,38],[78,62],[122,62]].map(([cx,cy])=>{let p="";for(let i=0;i<5;i++){const a=Math.PI*2*i/5-Math.PI/2,b=a+Math.PI/5;p+=`${cx+10*Math.cos(a)},${cy+10*Math.sin(a)} ${cx+4*Math.cos(b)},${cy+4*Math.sin(b)} `;}return`<polygon points="${p}" fill="${cc2}"/>`;}).join(""));
    case "Peak":      return cl(`<rect x="64" y="76" width="74" height="15" fill="${cc2}"/>`);
    default: return "";
  }
}

// Render silks as an SVG string — used in preview and leaderboard
function renderSilkSVG(silks, size = 200) {
  const s = silks || DEFAULT_SILKS;
  const c1 = s.col1, c2 = s.col2, cap = s.capCol;
  const SKIN = "#F2E4D5", INK = "#2a2a2a", SW = 2;
  const scale = size / 240;

  const cl = (content, id) => `<g clip-path="url(#${id})">${content}</g>`;

  let o = `<defs>
    <clipPath id="bodyClip"><path d="${SK.BODY}"/></clipPath>
    <clipPath id="larmClip"><path d="${SK.LARM}"/></clipPath>
    <clipPath id="rarmClip"><path d="${SK.RARM}"/></clipPath>
    <clipPath id="helmClip"><path d="${SK.HELM}"/></clipPath>
  </defs>`;

  const sc = s.sleeveCol || c1; // sleeve base colour, defaults to primary

  // Body
  o += `<path d="${SK.BODY}" fill="${c1}"/>`;
  o += cl(silkBodyPat(c2, s.body), "bodyClip");
  [116,144,172,200].forEach(y => o += `<circle cx="96" cy="${y}" r="3.5" fill="${INK}" opacity="0.3"/>`);
  o += `<path d="${SK.BODY}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;

  // Left arm
  o += `<path d="${SK.LARM}" fill="${sc}"/>`;
  o += cl(silkSleevePat(c2, s.sleeve, "left"), "larmClip");
  o += `<path d="${SK.LARM}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;

  // Right arm
  o += `<path d="${SK.RARM}" fill="${sc}"/>`;
  o += cl(silkSleevePat(c2, s.sleeve, "right"), "rarmClip");
  o += `<path d="${SK.RARM}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;

  // Neck + head
  o += `<path d="${SK.NECK}" fill="${SKIN}" stroke="${INK}" stroke-width="1.5"/>`;
  o += `<path d="${SK.HEAD}" fill="${SKIN}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;

  // Helmet
  o += `<path d="${SK.HELM}" fill="${cap}"/>`;
  o += silkHelmetPat(cap, s.cap, c1, c2);
  o += `<path d="${SK.HELM}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;
  o += `<path d="${SK.PEAK}" fill="${cap}" stroke="${INK}" stroke-width="${SW}"/>`;
  o += `<circle cx="100" cy="17" r="5" fill="${cap}" stroke="${INK}" stroke-width="1.5"/>`;
  o += `<circle cx="100" cy="17" r="2" fill="${INK}" opacity="0.35"/>`;
  o += `<line x1="100" y1="17" x2="100" y2="90" stroke="${INK}" stroke-width="1" opacity="0.18"/>`;
  o += `<path d="M63,60 Q100,66 137,60" fill="none" stroke="#ffffff80" stroke-width="5"/>`;
  o += `<path d="M63,60 Q100,66 137,60" fill="none" stroke="${INK}" stroke-width="1" opacity="0.25"/>`;
  o += `<path d="M70,80 Q70,96 100,99 Q130,96 130,80" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;

  return o;
}

// Small silk avatar for leaderboard/stable — just renders an inline SVG
function SilkAvatar({ silks, size = 40 }) {
  const svgContent = renderSilkSVG(silks || DEFAULT_SILKS);
  return (
    <svg width={size} height={size} viewBox="-25 0 250 300"
      style={{ flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svgContent }} />
  );
}

// Full silks designer component
function SilksDesigner({ authUser, initialSilks, onSave, onBack }) {
  const [silks, setSilks] = useState(initialSilks || DEFAULT_SILKS);
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState("body"); // body | sleeve | cap | colours

  async function handleSave() {
    setSaving(true);
    try {
      const profile = await userGet(authUser.uid);
      await userSet(authUser.uid, { ...profile, silks });
      showToast("Silks saved! 🎨");
      setTimeout(() => onSave(silks), 800);
    } catch(e) { showToast("Failed to save"); }
    setSaving(false);
  }

  const svgContent = renderSilkSVG(silks);
  const colName = hex => BHA_COLOURS.find(c => c.hex === hex)?.name || "";
  const desc = [colName(silks.col1), silks.body !== "Plain" ? silks.body.toLowerCase() : null, silks.sleeve !== "Plain" ? `${silks.sleeve.toLowerCase()} sleeves` : null, `${colName(silks.capCol)}${silks.cap !== "Plain" ? " " + silks.cap.toLowerCase() : ""} cap`].filter(Boolean).join(", ");

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">Your Silks</div>
      <div className="sec-title" style={{ marginBottom: 16 }}>Design Your Silks</div>

      {/* Preview */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <svg width="200" height="260" viewBox="-25 0 250 290" style={{ display: "block", margin: "0 auto" }}
          dangerouslySetInnerHTML={{ __html: svgContent }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{desc}</div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[["body","Body"],["sleeve","Sleeves"],["cap","Cap"],["colours","Colours"],["sleevecolour","Sleeve Colour"]].map(([id,label]) => (
          <button key={id} className={`tab${tab===id?" on":""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "body" && (
        <div className="fade">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SILK_BODY_P.map(p => (
              <button key={p} onClick={() => setSilks(s => ({...s, body: p}))}
                style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${silks.body===p ? C.blue : C.border}`,
                  background: silks.body===p ? C.blueBg : "#fff", color: silks.body===p ? C.blue : C.text,
                  fontFamily: "inherit", fontSize: 13, fontWeight: silks.body===p ? 600 : 400, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "sleeve" && (
        <div className="fade">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SILK_SLEEVE_P.map(p => (
              <button key={p} onClick={() => setSilks(s => ({...s, sleeve: p}))}
                style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${silks.sleeve===p ? C.blue : C.border}`,
                  background: silks.sleeve===p ? C.blueBg : "#fff", color: silks.sleeve===p ? C.blue : C.text,
                  fontFamily: "inherit", fontSize: 13, fontWeight: silks.sleeve===p ? 600 : 400, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "cap" && (
        <div className="fade">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SILK_CAP_P.map(p => (
              <button key={p} onClick={() => setSilks(s => ({...s, cap: p}))}
                style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${silks.cap===p ? C.blue : C.border}`,
                  background: silks.cap===p ? C.blueBg : "#fff", color: silks.cap===p ? C.blue : C.text,
                  fontFamily: "inherit", fontSize: 13, fontWeight: silks.cap===p ? 600 : 400, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "sleevecolour" && (
        <div className="fade">
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Choose a different base colour for the sleeves. Defaults to primary colour if not set.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {BHA_COLOURS.map(col => (
              <div key={col.hex} title={col.name} onClick={() => setSilks(s => ({...s, sleeveCol: col.hex}))}
                style={{ width: 30, height: 30, borderRadius: "50%", background: col.hex, cursor: "pointer",
                  border: (silks.sleeveCol||silks.col1) === col.hex ? `3px solid ${C.text}` : col.hex === "#F8F8F8" ? "2px solid #ccc" : "2px solid transparent",
                  transform: (silks.sleeveCol||silks.col1) === col.hex ? "scale(1.2)" : "scale(1)", transition: "all 0.15s" }} />
            ))}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setSilks(s => ({...s, sleeveCol: s.col1}))}>
            Reset to primary colour
          </button>
        </div>
      )}

      {tab === "colours" && (
        <div className="fade">
          {[["Primary colour", "col1"], ["Secondary colour", "col2"], ["Cap colour", "capCol"]].map(([label, key]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 600,
                textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {BHA_COLOURS.map(col => (
                  <div key={col.hex} title={col.name} onClick={() => setSilks(s => ({...s, [key]: col.hex}))}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: col.hex, cursor: "pointer",
                      border: silks[key] === col.hex ? `3px solid ${C.text}` : col.hex === "#F8F8F8" ? "2px solid #ccc" : "2px solid transparent",
                      transform: silks[key] === col.hex ? "scale(1.2)" : "scale(1)", transition: "all 0.15s" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-pink" style={{ width: "100%", marginTop: 24 }}
        disabled={saving} onClick={handleSave}>
        {saving ? "Saving…" : "Save Silks 🎨"}
      </button>
    </div>
  );
}

function ProfileHeader({ authUser, profile, onDesignSilks }) {
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(authUser?.displayName || "");
  const [saving,  setSaving]  = useState(false);
  const [toast,   showToast]  = useToast();

  async function saveName() {
    if (!name.trim() || name.trim() === authUser.displayName) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateProfile(authUser, { displayName: name.trim() });
      const p = await userGet(authUser.uid);
      if (p) await userSet(authUser.uid, { ...p, name: name.trim() });
      showToast("Name updated ✅");
      setEditing(false);
    } catch (e) { showToast("Failed to update name"); }
    setSaving(false);
  }

  return (
    <div style={{ marginBottom: 24, background: "#fff", borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
      <Toast msg={toast} />

      {/* Silk hero — prominent display, tappable to design */}
      <div onClick={onDesignSilks} style={{ cursor: "pointer", background: C.bg,
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: "16px 0 8px", borderBottom: `1px solid ${C.border}` }}>
        <svg width="160" height="200" viewBox="-25 0 250 290" style={{ display: "block" }}
          dangerouslySetInnerHTML={{ __html: renderSilkSVG(profile?.silks || { ...DEFAULT_SILKS, col1: "#F8F8F8", col2: "#F8F8F8", sleeveCol: "#F8F8F8", capCol: "#F8F8F8" }) }} />
      </div>

      {/* Name + email + edit button */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
              <input className="inp" value={name} onChange={e => setName(e.target.value)}
                style={{ fontSize: 15, padding: "6px 10px", flex: 1 }}
                onKeyDown={e => e.key === "Enter" && saveName()} autoFocus />
              <button className="btn btn-pink btn-sm" disabled={saving} onClick={saveName}>
                {saving ? "…" : "Save"}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>✕</button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.text, flex: 1 }}>
                {authUser.displayName || "Anonymous"}
              </div>
              <button onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", color: C.mutedLt, cursor: "pointer",
                  fontSize: 13, padding: 0, lineHeight: 1 }}>✏️</button>
            </>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{authUser.email}</div>
        <button onClick={onDesignSilks}
          style={{ width: "100%", padding: "8px 0", background: "none",
            border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13,
            color: C.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
          🎨 {profile?.silks ? "Edit silks" : "Design your silks"}
        </button>
      </div>
    </div>
  );
}

// ── PROFILE SCREEN ───────────────────────────────────────────────────────────
function ProfileScreen({ authUser, onBack, onRejoin }) {
  const [profile,    setProfile]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("stats"); // stats | history | badges
  const [showSilks,  setShowSilks]  = useState(false);

  useEffect(() => {
    if (!authUser?.uid) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const prof = await userGet(authUser.uid);
      const chalList = await getUserChallenges(authUser.uid);
      // Fetch each challenge to get results
      const details = await Promise.all(
        chalList.slice(0, 20).map(async ({ code, joinedAt }) => {
          const ch = await dbGet(code);
          if (!ch) return null;
          return { ...ch, joinedAt }; // attach joinedAt from index
        })
      );
      if (!cancelled) {
        setProfile(prof);
        setHistory(details.filter(Boolean));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser?.uid]);

  // Calculate stats from challenge history
  const stats = useMemo(() => {
    if (!history.length) return null;
    const uid = authUser.uid;
    let entered = 0, won = 0, totalReturn = 0, totalStaked = 0;
    let bestReturn = 0, bestChallenge = null;
    const chResults = [];
    const BADGES = new Set();

    history.forEach(ch => {
      const player = ch.players?.[uid];
      if (!player) return;
      const races = toArr(ch.selectedRaces || []);
      // First challenge badge — any challenge counts
      if (!BADGES.has("first_challenge")) BADGES.add("first_challenge");
      // Only canned challenges with 5+ players who submitted picks count for badges and stats
      const submittedCount = Object.values(ch.players || {}).filter(p => p.picksSubmitted).length;
      const isQualifying = !!ch.isCanned && submittedCount >= 5;
      if (isQualifying) entered++;
      const hasResults = races.some(r => r.resultIn);
      if (!hasResults || !isQualifying) return;

      // Calculate this player's return
      let chReturn = 0, chStaked = 0, wins = 0;
      races.forEach(race => {
        if (!race.resultIn) return;
        const pick = player.picks?.[race.id];
        if (!pick?.horseId) return;
        const horse = race.runners?.find(h => h.id === pick.horseId);
        if (!horse) return;
        const isNap = player.napRaceId === race.id;
        const ret = calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, isNap, horse.spDec);
        chReturn += ret.total;
        chStaked += ret.staked;
        if (horse.position === 1) {
          wins++;
          // Price badges
          const dec = horse.spDec || spToDecimal(horse.sp);
          if (dec >= 101) BADGES.add("century");
          else if (dec >= 51) BADGES.add("fifty_to_one");
          else if (dec >= 21) BADGES.add("twenty_to_one");
        }
        // Donut badge — scored 0
        if (chReturn === 0 && chStaked > 0) BADGES.add("donut");
      });

      totalReturn += chReturn;
      totalStaked += chStaked;

      // Check if won challenge
      const players = Object.values(ch.players || {});
      const ranked = players.map(p => {
        let r = 0;
        races.forEach(race => {
          if (!race.resultIn) return;
          const pick = p.picks?.[race.id];
          if (!pick?.horseId) return;
          const horse = race.runners?.find(h => h.id === pick.horseId);
          if (!horse) return;
          const isNap = p.napRaceId === race.id;
          r += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, isNap, horse.spDec).total;
        });
        return { id: p.id, total: r };
      }).sort((a, b) => b.total - a.total);

      const myPos = ranked.findIndex(p => p.id === uid) + 1;
      if (myPos === 1) { won++; BADGES.add("winner"); }
      if (myPos === 2 || myPos === 3) BADGES.add("podium");

      if (chReturn > bestReturn) {
        bestReturn = chReturn;
        bestChallenge = ch;
      }

      chResults.push({ joinedAt: ch.joinedAt || 0, profit: +(chReturn - chStaked).toFixed(2) });
    });

    // Milestone badges
    if (entered >= 10) BADGES.add("veteran");
    if (entered >= 25) BADGES.add("seasoned");
    if (entered >= 50) BADGES.add("legend");

    // Streak badges — sort chronologically
    const sorted = [...chResults].sort((a, b) => a.joinedAt - b.joinedAt);
    let consec = 1, profitConsec = 1;
    for (let i = 1; i < sorted.length; i++) {
      const dayGap = (sorted[i].joinedAt - sorted[i-1].joinedAt) / (86400000);
      consec = dayGap <= 14 ? consec + 1 : 1;
      profitConsec = (sorted[i].profit > 0 && sorted[i-1].profit > 0) ? profitConsec + 1 : (sorted[i].profit > 0 ? 1 : 0);
      if (consec >= 3) BADGES.add("hat_trick");
      if (profitConsec >= 3) BADGES.add("in_the_black");
    }

    return { entered, won, totalReturn: +totalReturn.toFixed(2), totalStaked: +totalStaked.toFixed(2),
      bestReturn: +bestReturn.toFixed(2), badges: computeBadges(uid, history) };
  }, [history, authUser?.uid]);

  // Use global BADGE_DEFS

  const pnl = stats ? +(stats.totalReturn - stats.totalStaked).toFixed(2) : 0;

  if (showSilks) return (
    <SilksDesigner
      authUser={authUser}
      initialSilks={profile?.silks}
      onSave={silks => { setProfile(p => ({...p, silks})); setShowSilks(false); }}
      onBack={() => setShowSilks(false)}
    />
  );

  return (
    <div style={{ paddingTop: 16 }} className="fade">
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Back</button>

      {/* Header */}
      <ProfileHeader authUser={authUser} profile={profile} onDesignSilks={() => setShowSilks(true)} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["stats", "history", "badges"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `1.5px solid ${C.border}`,
              background: activeTab === tab ? C.pink : "#fff", color: activeTab === tab ? "#fff" : C.muted,
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
              textTransform: "capitalize" }}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader"><span/><span/><span/></div>
      ) : (
        <>
          {/* STATS TAB */}
          {activeTab === "stats" && (
            <div className="fade">
              {!stats ? (
                <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏇</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No challenges yet</div>
                  <div style={{ fontSize: 14 }}>Join or create a challenge to start building your stats</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Challenges", value: stats.entered, icon: "🎟️" },
                    { label: "Wins", value: stats.won, icon: "🏆" },
                    { label: "Win Rate", value: stats.entered ? `${Math.round(stats.won/stats.entered*100)}%` : "0%", icon: "📊" },
                    { label: "Best Score", value: `${stats.bestReturn} pts`, icon: "⭐" },
                    { label: "Total Staked", value: `${stats.totalStaked} pts`, icon: "💰" },
                    { label: "Total Return", value: `${stats.totalReturn} pts`, icon: "💵" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} style={{ background: "#fff", border: `1.5px solid ${C.border}`,
                      borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Serif Display', serif" }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                  {/* P&L card spanning full width */}
                  <div style={{ gridColumn: "1 / -1", background: pnl >= 0 ? "#f0fff4" : "#fff5f5",
                    border: `1.5px solid ${pnl >= 0 ? C.win : C.danger}`, borderRadius: 12, padding: "14px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Overall P&L</div>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Serif Display', serif",
                        color: pnl >= 0 ? C.win : C.danger }}>
                        {pnl >= 0 ? "+" : ""}{pnl} pts
                      </div>
                    </div>
                    <div style={{ fontSize: 36 }}>{pnl >= 0 ? "🟢" : "🔴"}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="fade">
              {!history.length ? (
                <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No history yet</div>
                  <div style={{ fontSize: 14 }}>Your past challenges will appear here</div>
                </div>
              ) : (
                history.map(ch => {
                  const uid = authUser.uid;
                  const player = ch.players?.[uid];
                  if (!player) return null;
                  const races = toArr(ch.selectedRaces || []);
                  const hasResults = races.some(r => r.resultIn);
                  let chReturn = 0, chStaked = 0;
                  races.forEach(race => {
                    if (!race.resultIn) return;
                    const pick = player.picks?.[race.id];
                    if (!pick?.horseId) return;
                    const horse = race.runners?.find(h => h.id === pick.horseId);
                    if (!horse) return;
                    const isNap = player.napRaceId === race.id;
                    const ret = calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, isNap, horse.spDec);
                    chReturn += ret.total;
                    chStaked += ret.staked;
                  });
                  chReturn = +chReturn.toFixed(2);
                  const chPnl = +(chReturn - chStaked).toFixed(2);

                  // Position in challenge
                  const players = Object.values(ch.players || {});
                  const ranked = players.map(p => {
                    let r = 0;
                    races.forEach(race => {
                      if (!race.resultIn) return;
                      const pick = p.picks?.[race.id];
                      if (!pick?.horseId) return;
                      const horse = race.runners?.find(h => h.id === pick.horseId);
                      if (!horse) return;
                      r += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, race.ewTerms, p.napRaceId === race.id, horse.spDec).total;
                    });
                    return { id: p.id, total: r };
                  }).sort((a, b) => b.total - a.total);
                  const pos = ranked.findIndex(p => p.id === uid) + 1;

                  return (
                    <div key={ch.code} style={{ background: "#fff", border: `1.5px solid ${C.border}`,
                      borderRadius: 12, padding: "14px 16px", marginBottom: 10,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>
                          {hasResults ? (pos === 1 ? "🏆 " : pos === 2 ? "🥈 " : pos === 3 ? "🥉 " : `${pos}th · `) : "⏳ "}
                          {ch.day}
                        </div>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          {(() => {
                            const submitted = Object.values(ch.players || {}).filter(p => p.picksSubmitted).length;
                            const isOfficial = ch.isCanned && submitted >= 5;
                            const isNotOfficial = !ch.isCanned || submitted < 5;
                            return <span style={{ color: isOfficial ? C.pink : C.mutedLt, fontWeight: 600, marginRight: 6, fontSize: 11 }}>
                              {isOfficial ? "📺 Official" : "📋 Not Official"}
                            </span>;
                          })()}
                          Code: <span className="ctx-code">{ch.code}</span>
                          {" · "}{Object.keys(ch.players || {}).length} players
                          {" · "}{races.length} races
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {hasResults && (
                          <>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18,
                              color: C.text }}>{chReturn} pts</div>
                            <div style={{ fontSize: 12, fontWeight: 600,
                              color: chPnl >= 0 ? C.win : C.danger }}>
                              {chPnl >= 0 ? "+" : ""}{chPnl}
                            </div>
                          </>
                        )}
                        <button onClick={() => onRejoin(ch.code, uid)}
                          style={{ marginTop: 6, background: "none", border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: "3px 10px", fontSize: 12, color: C.muted,
                            cursor: "pointer", fontFamily: "inherit" }}>
                          View →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* BADGES TAB */}
          {activeTab === "badges" && (
            <div className="fade">
              {(!stats?.badges?.length) ? (
                <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎖️</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No badges yet</div>
                  <div style={{ fontSize: 14 }}>Badges are earned by playing — keep competing to unlock them!</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {Object.entries(BADGE_DEFS)
                    .filter(([key]) => stats?.badges?.includes(key))
                    .map(([key, badge]) => (
                      <div key={key} style={{ background: "#fff", border: `1.5px solid ${C.pink}`,
                        borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>{badge.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>
                          {badge.label}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
                          {badge.desc}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: C.pink, fontWeight: 600 }}>
                          ✓ Earned
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ACTIVE CHALLENGES LIST ────────────────────────────────────────────────────
function ActiveChallengesList({ challenges, pastChallenges = [], loading, uid, onEnter }) {
  const [showPast, setShowPast] = useState(false);

  if (loading) return (
    <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "14px" }}>
      <div style={{ fontSize: 13, color: C.mutedLt }}>Loading your challenges…</div>
    </div>
  );
  if (!challenges.length && !pastChallenges.length) return null;

  function ChallengeCard({ ch }) {
    const player = ch.players?.[uid];
    const races = sortRaces(ch.selectedRaces || []);
    const allDone = races.length > 0 && races.every(r => r.resultIn);
    const locked = isChallengeLocked(ch);
    const hasPicks = player?.picksSubmitted;
    const players = Object.values(ch.players || {});

    let posText = null;
    if (locked && races.some(r => r.resultIn)) {
      const scored = players.map(p => {
        let total = 0;
        races.forEach(r => {
          if (!r.resultIn) return;
          const pick = p.picks?.[r.id];
          if (!pick?.horseId) return;
          const horse = r.runners?.find(h => h.id === pick.horseId);
          if (!horse) return;
          total += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, r.ewTerms, p.napRaceId === r.id, horse.spDec).total;
        });
        return { id: p.id, total };
      }).sort((a, b) => b.total - a.total);
      const pos = scored.findIndex(p => p.id === uid) + 1;
      const n = scored.length;
      posText = pos === 1 ? `🏆 1st of ${n}` : pos === 2 ? `🥈 2nd of ${n}` : pos === 3 ? `🥉 3rd of ${n}` : `${pos}th of ${n}`;
    }

    let status, tone;
    if (allDone) {
      status = `${posText || "Complete"} — tap to see results`;
      tone = C.muted;
    } else if (!locked) {
      status = hasPicks ? "✅ Picks in — waiting for race day" : "⏰ Get your picks in!";
      tone = hasPicks ? C.blue : C.pink;
    } else {
      status = posText ? `🏇 ${posText} — live` : hasPicks ? "🏇 Race day — live!" : "⏳ Locked";
      tone = posText?.startsWith("🏆") ? C.pink : C.blue;
    }

    const border = tone === C.pink ? C.pink : allDone ? C.border : C.border;
    const bg = tone === C.pink ? C.pinkBg : "#fff";

    return (
      <div onClick={() => onEnter(ch)} className="card"
        style={{ marginBottom: 10, cursor: "pointer", borderColor: border, background: bg,
          opacity: allDone ? 0.85 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 2 }}>
              {ch.stableCode ? "🏠 Stable Challenge" : "Challenge"}
              {ch.isCanned ? " · 📺 Official" : ""}
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: C.text }}>
              {races.length} race{races.length !== 1 ? "s" : ""}
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
                {players.length} player{players.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.mutedLt, fontFamily: "monospace" }}>{ch.code}</div>
        </div>
        <div style={{ fontSize: 13, color: tone, fontWeight: 600 }}>{status}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {challenges.length > 0 && (
        <>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: 600,
            textTransform: "uppercase", marginBottom: 8 }}>Your Active Challenges</div>
          {challenges.map(ch => <ChallengeCard key={ch.code} ch={ch} />)}
        </>
      )}

      {pastChallenges.length > 0 && (
        <div style={{ marginTop: challenges.length ? 8 : 0 }}>
          <button onClick={() => setShowPast(p => !p)}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 11, letterSpacing: 2, color: C.mutedLt, fontWeight: 600,
              textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            Past Challenges ({pastChallenges.length})
            <span style={{ fontSize: 10, display: "inline-block",
              transform: showPast ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
          </button>
          {showPast && pastChallenges.map(ch => <ChallengeCard key={ch.code} ch={ch} />)}
        </div>
      )}
    </div>
  );
}

// ── WELCOME BACK CARD ─────────────────────────────────────────────────────────
function WelcomeBackCard({ session, onRejoin, onDismiss }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ch = await dbGet(session.code);
        if (!ch || cancelled) return;
        const races = sortRaces(ch.selectedRaces || []);
        const player = ch.players?.[session.playerId];
        const now = new Date();
        const firstRace = races[0];
        const firstOff = firstRace ? raceTimeToDate(firstRace.time, ch.day || "today") : null;
        const started = firstOff && firstOff <= now;
        const hasPicks = player?.picksSubmitted;

        if (!started) {
          if (!hasPicks) {
            setStatus({ emoji: "⏰", msg: "Get your picks in before the first race!", tone: "pink" });
          } else {
            setStatus({ emoji: "✅", msg: "Picks locked in — good luck!", tone: "blue" });
          }
        } else {
          const players = Object.values(ch.players || {});
          const scored = players.map(p => {
            let total = 0;
            races.forEach(r => {
              if (!r.resultIn) return;
              const pick = p.picks?.[r.id];
              if (!pick?.horseId) return;
              const horse = r.runners?.find(h => h.id === pick.horseId);
              if (!horse) return;
              total += calcSelectionReturn(horse.sp, pick.betType || "win", horse.position, r.ewTerms, p.napRaceId === r.id, horse.spDec).total;
            });
            return { id: p.id, total };
          }).sort((a, b) => b.total - a.total);
          const pos = scored.findIndex(p => p.id === session.playerId) + 1;
          const total = scored.length;
          const posStr = pos === 1 ? "1st 🏆" : pos === 2 ? "2nd 🥈" : pos === 3 ? "3rd 🥉" : `${pos}th`;
          const allDone = races.length > 0 && races.every(r => r.resultIn);
          if (allDone) {
            setStatus({ emoji: pos === 1 ? "🏆" : "🏁", msg: `Challenge over — you finished ${posStr} of ${total}`, tone: "blue" });
          } else {
            setStatus({ emoji: "🏇", msg: `You're in ${posStr} of ${total} — race day is live!`, tone: pos <= 3 ? "pink" : "blue" });
          }
        }
      } catch(e) {
        setStatus({ emoji: "👋", msg: "Tap to rejoin your challenge", tone: "blue" });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session.code]);

  const tone   = status?.tone === "pink" ? C.pink : C.blue;
  const bg     = status?.tone === "pink" ? C.pinkBg : "#f0f7ff";
  const border = status?.tone === "pink" ? C.pink : C.blue;

  return (
    <div className="card" style={{ marginBottom: 16, textAlign: "center", borderColor: border, background: bg }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
        👋 Welcome back, {session.playerName}!
      </div>
      <div style={{ fontSize: 14, color: status ? tone : C.muted, fontWeight: status ? 600 : 400, marginBottom: 14 }}>
        {status ? `${status.emoji} ${status.msg}` : "Loading your challenge…"}
      </div>
      <button className="btn btn-blue" onClick={onRejoin}>Rejoin Challenge →</button>
      <button className="btn btn-outline btn-sm" style={{ marginLeft: 10 }} onClick={onDismiss}>Not me</button>
    </div>
  );
}

// ── HOME HUB PANELS ──────────────────────────────────────────────────────────
function HomeHubPanels({ authUser, onProfile, onStables, onStable, onSignIn, onSignOut }) {
  const [profile,    setProfile]    = useState(null);
  const [myStables,  setMyStables]  = useState([]);
  const [wins,       setWins]       = useState(0);
  const [loaded,     setLoaded]     = useState(false);

  useEffect(() => {
    if (!authUser?.uid) { setLoaded(true); return; }
    let cancelled = false;
    async function load() {
      const prof = await userGet(authUser.uid);
      const stableList = await getUserStables(authUser.uid);
      const stableDetails = await Promise.all(stableList.map(({code}) => stableGet(code)));

      // Count wins from challenge history
      const chalList = await getUserChallenges(authUser.uid);
      const challenges = await Promise.all(chalList.slice(0,20).map(async ({code,joinedAt}) => {
        const ch = await dbGet(code);
        return ch ? {...ch, joinedAt} : null;
      }));
      const badges = computeBadges(authUser.uid, challenges.filter(Boolean));
      const winCount = challenges.filter(Boolean).reduce((acc, ch) => {
        const races = toArr(ch.selectedRaces || []);
        if (!races.some(r => r.resultIn)) return acc;
        const players = Object.values(ch.players || {});
        const ranked = players.map(p => {
          let r = 0;
          races.forEach(race => {
            if (!race.resultIn) return;
            const pick = p.picks?.[race.id];
            if (!pick?.horseId) return;
            const horse = race.runners?.find(h => h.id === pick.horseId);
            if (!horse) return;
            r += calcSelectionReturn(horse.sp, pick.betType||"win", horse.position, race.ewTerms, p.napRaceId===race.id, horse.spDec).total;
          });
          return {id: p.id, total: r};
        }).sort((a,b) => b.total - a.total);
        return ranked[0]?.id === authUser.uid ? acc + 1 : acc;
      }, 0);

      if (!cancelled) {
        setProfile(prof);
        setMyStables(stableDetails.filter(Boolean));
        setWins(winCount);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser?.uid]);

  if (!authUser) {
    // Guest strip
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 0", marginBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.mutedLt }}>Playing as guest</div>
        <button onClick={onSignIn}
          style={{ background: "none", border: "none", color: C.blue, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          Sign in →
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="home-grid">

        {/* Profile panel */}
        <div className="card" style={{ padding: "14px", display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>Your Profile</div>
            <img src="/icons/logo-transparent.png" alt="" style={{ width: 28, height: 28, opacity: 0.18, flexShrink: 0 }} />
          </div>
          <svg width="64" height="78" viewBox="-25 0 250 290" style={{ display: "block", margin: "8px auto 6px", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: loaded ? renderSilkSVG(profile?.silks || {...DEFAULT_SILKS, col1:"#F8F8F8", col2:"#F8F8F8", sleeveCol:"#F8F8F8", capCol:"#F8F8F8"}) : "" }} />
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: C.text, marginBottom: 4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
            {authUser.displayName || "Anonymous"}
          </div>
          {wins > 0 && (
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 4 }}>
              🏆 {wins} win{wins !== 1 ? "s" : ""}
            </div>
          )}
          <button onClick={onProfile} className="btn btn-pink" style={{ width: "100%", marginTop: "auto" }}>
            View Profile
          </button>
        </div>

        {/* Stables panel */}
        <div className="card" style={{ padding: "14px", display: "flex", flexDirection: "column", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 4 }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>Your Stables</div>
            <img src="/icons/logo-transparent.png" alt="" style={{ width: 28, height: 28, opacity: 0.18, flexShrink: 0 }} />
          </div>
          <div style={{ marginBottom: 10, marginTop: 0, flex: 1 }}>
            {!loaded ? <div style={{ fontSize: 12, color: C.mutedLt }}>Loading…</div>
            : myStables.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>No stables yet</div>
            : myStables.slice(0, 3).map(s => (
              <button key={s.code} onClick={() => onStable && onStable(s.code)} className="btn btn-blue"
                style={{ width: "100%", marginBottom: 6, fontSize: 13, padding: "12px 12px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.name}
              </button>
            ))}
            {loaded && myStables.length > 3 && (
              <div style={{ fontSize: 11, color: C.muted }}>+{myStables.length - 3} more</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            <button onClick={onStables} className="btn btn-pink" style={{ flex: 1 }}>
              + Create
            </button>
            <button onClick={onStables} className="btn btn-pink" style={{ flex: 1 }}>
              🔍 Find
            </button>
          </div>
        </div>
      </div>

      {/* Sign out link */}
      <div style={{ textAlign: "right", marginTop: 6 }}>
        <button onClick={onSignOut}
          style={{ background: "none", border: "none", color: C.mutedLt, fontSize: 11,
            cursor: "pointer", fontFamily: "inherit" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [authUser,  setAuthUser]  = useState(undefined); // undefined = loading, null = guest
  const [showProfile, setShowProfile] = useState(false);
  const [showStables, setShowStables] = useState(false);
  const [directStableCode, setDirectStableCode] = useState(null);
  const [newBadges,   setNewBadges]   = useState([]); // badges to celebrate
  const [stableNotifs, setStableNotifs] = useState([]); // pending stable challenges
  const [screen,    setScreen]  = useState("home");
  const [ch,        setCh]      = useState(null);
  const [pid,       setPid]     = useState(null);
  const [player,    setPlayer]  = useState(null);
  const [rejoining, setRejoining] = useState(false);
  const [session,   setSession]  = useState(() => loadSession());
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [pastChallenges,   setPastChallenges]   = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [showAbout,      setShowAbout]      = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );
  const [toast,          showToast]         = useToast();

  // Load all challenges for logged-in user — split into active and past
  async function loadActiveChallenges(uid) {
    if (!uid) { setActiveChallenges([]); setPastChallenges([]); return; }
    setChallengesLoading(true);
    try {
      const list = await getUserChallenges(uid);
      const challenges = await Promise.all(list.map(async ({ code }) => {
        const ch = await dbGet(code);
        return ch ? normaliseChallenge(ch) : null;
      }));
      const active = [], past = [];
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
      challenges.forEach(ch => {
        if (!ch) return;
        const races = sortRaces(ch.selectedRaces || []);
        // Exclude challenges with no races selected — abandoned/test
        if (!races.length) return;
        const allDone = races.every(r => r.resultIn);
        if (allDone) {
          // Only show in past if someone actually played
          const anyPastPicks = Object.values(ch.players || {}).some(p => p.picksSubmitted);
          if (anyPastPicks) past.push(ch);
          return;
        }
        // Exclude dead challenges — races selected, nobody picked, first race already gone off
        const anyPicks = Object.values(ch.players || {}).some(p => p.picksSubmitted);
        if (!anyPicks && races.length) {
          const firstOff = raceTimeToDate(races[0].time, ch.day || "today");
          if (firstOff && firstOff < new Date()) return; // first race gone off, no picks — dead
        }
        // Move to past if day is more than 2 days ago — stale/unresolved challenge
        if (ch.day) {
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          const twoDaysAgoStr = twoDaysAgo.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
          if (ch.day < twoDaysAgoStr) {
            if (anyPicks) past.push(ch);
            return;
          }
        }
        active.push(ch);
      });
      // Sort past most recent first
      past.sort((a, b) => {
        const aDate = sortRaces(a.selectedRaces || []).slice(-1)[0]?.time || "";
        const bDate = sortRaces(b.selectedRaces || []).slice(-1)[0]?.time || "";
        return bDate.localeCompare(aDate);
      });
      setActiveChallenges(active);
      setPastChallenges(past);
    } catch(e) { console.warn("loadActiveChallenges error:", e.message); }
    setChallengesLoading(false);
  }

  // Firebase Auth listener — fires once on mount, then on auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        await ensureUserProfile(user);
        setAuthUser(user);
        loadActiveChallenges(user.uid);
      } else {
        setAuthUser(null);
        setActiveChallenges([]);
      }
    });
    return unsub;
  }, []);

  // Check for new badges — call after results or on home screen load
  async function checkForNewBadges(uid, currentBadges) {
    if (!uid) return;
    try {
      const profile = await userGet(uid);
      const earnedBefore = new Set(profile?.earnedBadges || []);
      const newOnes = currentBadges.filter(b => !earnedBefore.has(b));
      if (newOnes.length) {
        // Save new badges to profile
        await userSet(uid, { ...profile, earnedBadges: [...earnedBefore, ...newOnes] });
        setNewBadges(newOnes);
      }
    } catch (e) { console.warn("Badge check error:", e.message); }
  }

  // Backstop — check for new badges on home screen when logged in
  useEffect(() => {
    if (!authUser?.uid || screen !== "home") return;
    let cancelled = false;
    async function run() {
      try {
        const chalList = await getUserChallenges(authUser.uid);
        const details = await Promise.all(
          chalList.slice(0, 20).map(async ({ code, joinedAt }) => {
            const ch = await dbGet(code);
            return ch ? { ...ch, joinedAt } : null;
          })
        );
        if (cancelled) return;
        const badges = computeBadges(authUser.uid, details.filter(Boolean));
        await checkForNewBadges(authUser.uid, badges);
      } catch (e) { console.warn("Backstop badge check error:", e.message); }
    }
    run();
    return () => { cancelled = true; };
  }, [authUser?.uid, screen]);

  const isCreator = ch?.creatorId === pid;

  // Handle deep links — ?code=XXXXX&player=yyy
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    window.history.replaceState({}, "", window.location.pathname);
    const code   = params.get("code")?.toUpperCase();
    const player = params.get("player");
    if (code && player) rejoinChallenge(code, player);
  }, []);

  // Check for stable challenge notifications on home screen
  useEffect(() => {
    if (!authUser?.uid || screen !== "home") return;
    let cancelled = false;
    async function checkStableNotifs() {
      const stables = await getUserStables(authUser.uid);
      const notifs = [];
      for (const { code } of stables) {
        const stable = await stableGet(code);
        if (!stable) continue;
        for (const [chCode, chInfo] of Object.entries(stable.challenges || {})) {
          // Show notification if player hasn't joined this challenge yet
          if (chInfo.creatorUid === authUser.uid) continue; // skip own challenges
          const ch = await dbGet(chCode);
          if (!ch || ch.players?.[authUser.uid]) continue; // already joined
          if (ch.status !== "selections" && ch.status !== "open") continue;
          notifs.push({ stableName: stable.name, stableCode: code, chCode, chInfo });
        }
      }
      if (!cancelled) setStableNotifs(notifs);
    }
    checkStableNotifs();
    return () => { cancelled = true; };
  }, [authUser?.uid, screen]);

  // NR check at App level — fires whenever ch changes, regardless of screen
  useEffect(() => {
    if (!ch?.code || !ch?.selectedRaces) return;
    const unrun = toArr(ch.selectedRaces).filter(r => !r.resultIn);
    if (!unrun.length) return;
    let cancelled = false;
    const checkNRs = async () => {
      if (cancelled) return;
      try {
        const todayStr    = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
        const apiDay = ch.day === tomorrowStr ? "tomorrow" : "today";
        const data = await apiGet(`/api/racecards?day=${apiDay}`);
        const fresh = await dbGet(ch.code);
        if (!fresh || cancelled) return;
        const apiRunnerMap = {};
        (data.racecards || []).forEach(race => {
          (race.runners || []).forEach(h => {
            if (h.horse_id) apiRunnerMap[h.horse_id] = h;
          });
        });
        let changed = false;
        fresh.selectedRaces = toArr(fresh.selectedRaces).map(race => {
          if (race.resultIn) return race;
          const updatedRunners = race.runners.map(h => {
            const apiRunner = apiRunnerMap[h.id];
            const isNR = apiRunner && (apiRunner.number === "NR" || apiRunner.jockey === "NON-RUNNER");
            if (isNR && !h.nonRunner) {
              changed = true;
              console.log(`NR detected: ${h.name} in ${race.course} ${race.time}`);
              return { ...h, nonRunner: true };
            }
            return h;
          });
          return { ...race, runners: updatedRunners };
        });
        if (changed) {
          Object.values(fresh.players || {}).forEach(p => {
            toArr(fresh.selectedRaces).forEach(race => {
              const pick = p.picks?.[race.id];
              if (!pick?.horseId) return;
              const horse = race.runners.find(h => h.id === pick.horseId);
              if (horse?.nonRunner && !pick.nonRunner) {
                p.picks[race.id] = { ...pick, horseId: null, nonRunner: true };
              }
            });
          });
          await dbSet(fresh.code, fresh);
          if (!cancelled) {
            setCh(normaliseChallenge(fresh));
            showToast("⚠️ Non-runner detected — affected picks cleared");
          }
        }
      } catch (e) { console.warn("App NR check error:", e.message); }
    };

    checkNRs();
    const interval = setInterval(checkNRs, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [ch?.code]);

  async function rejoinChallenge(code, playerId) {
    setRejoining(true);
    const fresh = await dbGet(code);
    if (fresh && fresh.players?.[playerId]) {
      const p = fresh.players[playerId];
      setCh(normaliseChallenge(fresh)); setPid(playerId); setPlayer(p);
      saveSession(code, playerId, p.name);
      setSession({ code, playerId, playerName: p.name });
      const myPlayer = fresh.players?.[playerId];
      const dest = fresh.status === "open" ? "results"
                 : fresh.status === "selections" && !myPlayer?.picksSubmitted ? "picks"
                 : "results";
      setScreen(dest);
    }
    setRejoining(false);
  }

  async function handleCreate(name) {
    const playerId = authUser?.uid || genCode(8);
    const code = genCode(5);
    const displayName = authUser?.displayName || name;
    const p = { id: playerId, name: displayName, picks: {}, picksSubmitted: false,
      uid: authUser?.uid || null };
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

    // Auto-add active stable members as players
    let players = { [playerId]: p };
    let stableCodes = [];
    if (authUser?.uid) {
      const stables = await getUserStables(authUser.uid);
      stableCodes = stables.map(s => s.code);
      for (const { code: sc } of stables) {
        const stable = await stableGet(sc);
        if (!stable) continue;
        Object.values(stable.members || {}).forEach(m => {
          if (m.status !== "active" || m.uid === authUser.uid) return;
          players[m.uid] = { id: m.uid, name: m.name, picks: {}, picksSubmitted: false, uid: m.uid };
        });
      }
    }

    const newCh = { code, creatorId: playerId, creatorUid: authUser?.uid || null,
      status: "open", day: today, players,
      selectedRaces: [], selectedRaceIds: [], racecards: [],
      stableCodes: stableCodes.length ? stableCodes : null,
      stableCode: stableCodes.length === 1 ? stableCodes[0] : null }; // primary stable for display
    await dbSet(code, newCh);
    await addChallengeToUserIndex(authUser?.uid, code);

    // Register challenge on each stable
    for (const sc of stableCodes) {
      const stable = await stableGet(sc);
      if (!stable) continue;
      stable.challenges = stable.challenges || {};
      stable.challenges[code] = { code, day: today, creatorUid: authUser.uid };
      await stableSet(sc, stable);
    }

    setCh(newCh); setPid(playerId); setPlayer(p);
    saveSession(code, playerId, displayName);
    setSession({ code, playerId, playerName: displayName });
    if (authUser?.uid) loadActiveChallenges(authUser.uid);
    setScreen("setup");
  }

  async function handleJoin(existingCh, name) {
    const playerId = authUser?.uid || genCode(8);
    const displayName = authUser?.displayName || name;
    const p = { id: playerId, name: displayName, picks: {}, picksSubmitted: false,
      uid: authUser?.uid || null };
    const fresh = (await dbGet(existingCh.code)) || existingCh;
    fresh.players[playerId] = p;
    await dbSet(fresh.code, fresh);
    await addChallengeToUserIndex(authUser?.uid, fresh.code);
    setCh(normaliseChallenge(fresh)); setPid(playerId); setPlayer(p);
    saveSession(fresh.code, playerId, displayName);
    setSession({ code: fresh.code, playerId, playerName: displayName });
    if (authUser?.uid) loadActiveChallenges(authUser.uid);
    setScreen(fresh.status === "selections" ? "picks" : "results");
  }

  function handleSetupSave(updated) { setCh(updated); setScreen("results"); }
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

  // Auth loading state
  if (authUser === undefined) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="loader"><span/><span/><span/></div>
    </div>
  );

  // Auth screen — shown if not logged in and not guest
  // authUser === null means either guest or not logged in — we use showAuthScreen to distinguish
  const showAuthScreen = authUser === null && !sessionStorage.getItem("sm_guest");
  if (showAuthScreen) return (
    <AuthScreen onAuth={user => {
      if (user) {
        setAuthUser(user);
      } else {
        sessionStorage.setItem("sm_guest", "1");
        setAuthUser(null);
      }
    }} />
  );

  if (rejoining) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <Loader />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{GLOBAL_CSS}</style>
      <Toast msg={toast} />

      {newBadges.length > 0 && (
        <BadgeCelebrationModal
          badges={newBadges}
          badgeDefs={BADGE_DEFS}
          onDismiss={() => setNewBadges([])}
        />
      )}

      <div className="wrap">
        {showCtx && (
          <div className="ctx-strip">
            <div style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>
              Code <span className="ctx-code">{ch.code}</span>
              {player && <span style={{ marginLeft: 10 }}>· {player.name}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {screen !== "picks"   && ch?.status === "selections" && <button className="btn btn-ghost btn-sm" onClick={() => setScreen("picks")}>My Picks</button>}
              {screen !== "results" && <button className="btn btn-ghost btn-sm" onClick={() => setScreen("results")}>Leaderboard</button>}
              <button className="btn btn-ghost btn-sm" onClick={handleLeave}>Leave</button>
            </div>
          </div>
        )}

        {/* NR Banner — shows on any screen when current player has unresolved NR */}
        {screen !== "home" && ch && pid && (() => {
          const player = ch.players?.[pid];
          const races = sortRaces(ch.selectedRaces || []);
          const hasNR = races.some(r => {
            if (r.resultIn) return false;
            if (!isRaceOpen(r, ch.day)) return false; // past off time — no longer actionable
            const pick = player?.picks?.[r.id];
            if (pick?.nonRunner) return true;
            const horse = r.runners?.find(h => h.id === pick?.horseId);
            return horse?.nonRunner;
          });
          if (!hasNR) return null;
          const nrRaceIds = races.filter(r => {
            if (r.resultIn) return false;
            const pick = player?.picks?.[r.id];
            if (pick?.nonRunner) return true;
            const horse = r.runners?.find(h => h.id === pick?.horseId);
            return horse?.nonRunner;
          }).map(r => r.id);
          return (
            <div style={{ background: C.pink, color: "#fff", padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10, margin: "0 -16px 12px",
              cursor: "pointer" }}
              onClick={() => {
                setScreen("picks");
                // After navigation, scroll to first NR race
                setTimeout(() => {
                  const el = document.querySelector(`[data-race-id="${nrRaceIds[0]}"]`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 150);
              }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {nrRaceIds.length === 1 ? "Non-runner in your picks" : `${nrRaceIds.length} non-runners in your picks`}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Tap to make a replacement selection</div>
              </div>
              <span style={{ fontSize: 14, opacity: 0.8 }}>→</span>
            </div>
          );
        })()}

        {!showProfile && !showStables && screen === "home" && (
          <>
            {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
            {/* A2HS — small dark bar at top */}
            <A2HSBanner />

            {/* Logo — large, centred, tappable for About */}
            <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
              <img src="/icons/logo-transparent.png" alt="StableMates" onClick={() => setShowAbout(true)}
                style={{ width: "min(60vw, 240px)", height: "min(60vw, 240px)", display: "inline-block", cursor: "pointer" }} />
              <div style={{ marginTop: 6, marginBottom: 2 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17,
                  color: C.text, letterSpacing: "0.01em", fontStyle: "italic" }}>
                  Pick nags, win brags
                </div>
              </div>
              <div style={{ marginTop: 6 }}>
                <button onClick={() => setShowAbout(true)}
                  style={{ background: "none", border: "none", color: C.muted, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  About StableMates
                </button>
              </div>
            </div>

            {/* Active challenges — loaded from Firebase for auth users */}
            {authUser && (
              <ActiveChallengesList
                challenges={activeChallenges}
                pastChallenges={pastChallenges}
                loading={challengesLoading}
                uid={authUser.uid}
                onEnter={async (ch) => {
                  // Always fetch fresh from Firebase — cached version may be stale
                  const fresh = await dbGet(ch.code);
                  const live = fresh ? normaliseChallenge(fresh) : ch;
                  const myPlayer = live.players?.[authUser.uid];
                  setCh(live); setPid(authUser.uid); setPlayer(myPlayer);
                  saveSession(live.code, authUser.uid, myPlayer?.name || authUser.displayName);
                  setSession({ code: live.code, playerId: authUser.uid, playerName: myPlayer?.name || authUser.displayName });
                  const myPicks = myPlayer?.picksSubmitted;
                  const dest = live.status === "selections" && !myPicks ? "picks" : "results";
                  setScreen(dest);
                }}
              />
            )}

            {/* Legacy session for guests */}
            {!authUser && session && (
              <WelcomeBackCard
                session={session}
                onRejoin={() => rejoinChallenge(session.code, session.playerId)}
                onDismiss={() => { clearSession(); setSession(null); }}
              />
            )}

            {/* Profile + Stables hub panels */}
            <HomeHubPanels
              authUser={authUser}
              onProfile={() => setShowProfile(true)}
              onStables={() => setShowStables(true)}
              onStable={code => { setDirectStableCode(code); setShowStables(true); }}
              onSignIn={() => { sessionStorage.removeItem("sm_guest"); setAuthUser(undefined); }}
              onSignOut={async () => { await signOut(auth); sessionStorage.removeItem("sm_guest"); setAuthUser(null); }}
            />

            {/* Stable challenge notifications */}
            {stableNotifs.map(notif => (
              <div key={notif.chCode} style={{ background: C.blue, color: "#fff",
                padding: "12px 16px", borderRadius: 12, marginBottom: 10,
                display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🏠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    You've been added to a challenge in {notif.stableName}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Make your picks before the first race goes off
                  </div>
                </div>
                <button onClick={async () => {
                  const fresh = await dbGet(notif.chCode);
                  if (fresh) {
                    setCh(normaliseChallenge(fresh));
                    setPid(authUser.uid);
                    setPlayer(fresh.players[authUser.uid]);
                    saveSession(notif.chCode, authUser.uid, authUser.displayName || authUser.email);
                    setSession({ code: notif.chCode, playerId: authUser.uid, playerName: authUser.displayName || authUser.email });
                    await addChallengeToUserIndex(authUser.uid, notif.chCode);
                    setScreen("picks");
                  }
                }} style={{ background: "rgba(255,255,255,.25)", border: "none", color: "#fff",
                  borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  Pick now →
                </button>
              </div>
            ))}

            {/* Start / Join panels */}
            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
            <HomeScreen onCreate={handleCreate} onJoin={handleJoin} openAbout={() => setShowAbout(true)} authUser={authUser} />
          </>
        )}
        {showStables && authUser ? (
          <StablesScreen authUser={authUser} directStableCode={directStableCode} onBack={() => { setShowStables(false); setDirectStableCode(null); }}
            onCreateChallenge={async (stableCodeOrChallengeCode) => {
              // If passed a challenge code (entering existing), rejoin it
              if (stableCodeOrChallengeCode && stableCodeOrChallengeCode.length === 5 && !stableCodeOrChallengeCode.startsWith("S")) {
                await rejoinChallenge(stableCodeOrChallengeCode, authUser.uid);
                setShowStables(false);
                return;
              }

              // Otherwise create a new challenge linked to this stable
              const stableCode = stableCodeOrChallengeCode;
              const playerId = authUser.uid;
              const code = genCode(5);
              const displayName = authUser.displayName || authUser.email;
              const p = { id: playerId, name: displayName, picks: {}, picksSubmitted: false, uid: authUser.uid };
              const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

              const stable = await stableGet(stableCode);
              if (stable) {
                // Check for existing genuinely open challenge
                const openChs = Object.values(stable.challenges || {});
                let warned = false;
                for (const chRef of openChs) {
                  if (warned) break;
                  const existingCh = await dbGet(chRef.code);
                  if (!existingCh) continue;
                  const races = sortRaces(existingCh.selectedRaces || []);
                  if (!races.length) continue; // no races — abandoned
                  const allDone = races.every(r => r.resultIn);
                  if (allDone || existingCh.status === "complete") continue;
                  // Skip dead — no picks and first race already gone off
                  const anyPicks = Object.values(existingCh.players || {}).some(p => p.picksSubmitted);
                  if (!anyPicks) {
                    const firstOff = raceTimeToDate(races[0].time, existingCh.day || "today");
                    if (firstOff && firstOff < new Date()) continue;
                  }
                  const proceed = confirm(`"${stable.name}" already has an open challenge. Create a new one anyway?`);
                  if (!proceed) return;
                  warned = true;
                }
              }

              let players = { [playerId]: p };
              if (stable) {
                Object.values(stable.members || {}).forEach(m => {
                  if (m.status !== "active" || m.uid === authUser.uid) return;
                  players[m.uid] = { id: m.uid, name: m.name, picks: {}, picksSubmitted: false, uid: m.uid };
                });
                stable.challenges = stable.challenges || {};
                stable.challenges[code] = { code, day: today, creatorUid: authUser.uid };
                await stableSet(stableCode, stable);
              }

              const newCh = { code, creatorId: playerId, creatorUid: authUser.uid,
                status: "open", day: today, players,
                selectedRaces: [], selectedRaceIds: [], racecards: [],
                stableCodes: [stableCode], stableCode };
              await dbSet(code, newCh);
              await addChallengeToUserIndex(authUser.uid, code);
              setCh(newCh); setPid(playerId); setPlayer(p);
              saveSession(code, playerId, displayName);
              setSession({ code, playerId, playerName: displayName });
              if (authUser?.uid) loadActiveChallenges(authUser.uid);
              setShowStables(false);
              setScreen("setup");
            }}
          />
        ) : showProfile && authUser ? (
          <ProfileScreen
            authUser={authUser}
            onBack={() => setShowProfile(false)}
            onRejoin={async (code, playerId) => {
              setShowProfile(false);
              const fresh = await dbGet(code);
              if (fresh && fresh.players?.[playerId]) {
                setCh(normaliseChallenge(fresh));
                setPid(playerId);
                setPlayer(fresh.players[playerId]);
                setScreen("results");
              }
            }}
          />
        ) : (
          <>
            {screen === "setup"   && ch && <SetupScreen   challenge={ch} onSave={handleSetupSave} onBack={() => setScreen("home")} />}
            {screen === "picks"   && ch && <PicksScreen   challenge={ch} playerId={pid} onSubmit={handlePicksSubmit} onBack={() => setScreen("results")} />}
            {screen === "results" && ch && <ResultsScreen challenge={ch} playerId={pid} isCreator={isCreator} onBack={handleLeave} />}
          </>
        )}
      </div>
    </div>
  );
}
