import { useState, useEffect, useCallback } from "react";

// ─── EACH-WAY TERMS ──────────────────────────────────────────────────────────
function getEWTerms(numRunners, isHandicap) {
  if (numRunners <= 4) return null;
  if (numRunners <= 7) return { places: 2, fraction: 4 };
  if (numRunners <= 15) return { places: 3, fraction: 4 };
  return { places: isHandicap ? 4 : 3, fraction: 4 };
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:       "#0b1a0c",
  surface:  "#111f12",
  card:     "#162818",
  border:   "#284d2a",
  gold:     "#c9a84c",
  goldLt:   "#f0d070",
  goldDim:  "#7a6020",
  greenLt:  "#5adf5a",
  cream:    "#f0e8d0",
  muted:    "#6e9970",
  danger:   "#7a1818",
  dangerLt: "#e05555",
  win:      "#164e16",
  winLt:    "#80ff80",
  place:    "#0a3a5a",
  placeLt:  "#70d0ff",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.cream}; font-family: 'EB Garamond', Georgia, serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.goldDim}; border-radius: 3px; }
  .pf { font-family: 'Playfair Display', Georgia, serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 0 16px 100px; }
  .hdr { background: linear-gradient(180deg,#060f07 0%,${C.surface} 100%); border-bottom: 2px solid ${C.gold}; padding: 20px 0 16px; text-align: center; position: sticky; top: 0; z-index: 100; }
  .hdr-eye { font-size: 10px; letter-spacing: 5px; color: ${C.muted}; margin-bottom: 4px; }
  .hdr-title { font-family: 'Playfair Display', serif; font-size: clamp(22px,4vw,40px); font-weight: 900; color: ${C.goldLt}; letter-spacing: 2px; text-shadow: 0 2px 24px rgba(201,168,76,.35); }
  .hdr-sub { font-size: 11px; letter-spacing: 4px; color: ${C.muted}; margin-top: 5px; }
  .btn { font-family: 'EB Garamond', serif; font-size: 16px; border: none; cursor: pointer; border-radius: 7px; transition: all .18s; display: inline-flex; align-items: center; gap: 6px; }
  .btn:disabled { opacity: .38; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
  .btn-gold { background: linear-gradient(135deg,${C.gold},${C.goldLt}); color: #0b1a0c; font-weight: 700; padding: 12px 28px; letter-spacing: .5px; }
  .btn-gold:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(201,168,76,.38); }
  .btn-outline { background: transparent; border: 1px solid ${C.border}; color: ${C.muted}; padding: 9px 18px; }
  .btn-outline:hover { border-color: ${C.gold}; color: ${C.goldLt}; }
  .btn-sm { padding: 6px 14px; font-size: 14px; }
  .btn-ghost { background: transparent; border: none; color: ${C.muted}; padding: 6px 10px; font-size: 14px; cursor: pointer; }
  .btn-ghost:hover { color: ${C.goldLt}; }
  .card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; padding: 22px 24px; }
  .card + .card { margin-top: 14px; }
  .card-gold { border-color: ${C.gold}; box-shadow: 0 0 28px rgba(201,168,76,.1); }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 10px; letter-spacing: 3px; color: ${C.muted}; margin-bottom: 7px; }
  .inp { width: 100%; background: #090f09; border: 1px solid ${C.border}; border-radius: 7px; color: ${C.cream}; padding: 11px 14px; font-family: 'EB Garamond', serif; font-size: 17px; transition: border-color .15s; }
  .inp:focus { outline: none; border-color: ${C.gold}; }
  .inp::placeholder { color: ${C.goldDim}; opacity: .7; }
  .inp-code { letter-spacing: 6px; font-size: 22px; font-family: 'Playfair Display', serif; text-align: center; }
  .eyebrow { font-size: 10px; letter-spacing: 4px; color: ${C.muted}; margin-bottom: 5px; }
  .sec-title { font-family: 'Playfair Display', serif; font-size: 24px; color: ${C.goldLt}; font-weight: 700; margin-bottom: 18px; }
  .race-row { background: #0e1a0f; border: 1px solid ${C.border}; border-radius: 10px; padding: 15px 18px; margin-bottom: 9px; cursor: pointer; transition: border-color .18s, background .18s; }
  .race-row:hover { border-color: ${C.goldDim}; background: #132015; }
  .race-row.sel { border-color: ${C.gold}; background: #182a19; }
  .horse-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; }
  @media(max-width:500px){ .horse-grid { grid-template-columns: 1fr; } }
  .hbtn { background: #090f09; border: 1px solid ${C.border}; border-radius: 8px; padding: 10px 13px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; width: 100%; color: ${C.cream}; font-family: 'EB Garamond', serif; font-size: 15px; transition: all .15s; text-align: left; }
  .hbtn:hover { border-color: ${C.goldDim}; background: #132015; }
  .hbtn.win-picked { background: ${C.gold}; border-color: ${C.goldLt}; color: #0b1a0c; font-weight: 700; }
  .hbtn.ew-picked  { background: #1a3a5a; border-color: ${C.placeLt}; color: ${C.placeLt}; font-weight: 700; }
  .hbtn.won   { background: ${C.win}; border-color: ${C.winLt}; color: ${C.winLt}; }
  .hbtn.placed { background: ${C.place}; border-color: ${C.placeLt}; color: ${C.placeLt}; }
  .hbtn.lost  { opacity: .32; }
  .sp-chip { background: #0a120a; border: 1px solid ${C.border}; border-radius: 4px; padding: 2px 9px; font-size: 13px; color: ${C.gold}; min-width: 50px; text-align: center; white-space: nowrap; flex-shrink: 0; }
  .hbtn.win-picked .sp-chip { background: #7a5500; border-color: ${C.goldLt}; color: #fff; }
  .hbtn.ew-picked  .sp-chip { background: #0a2a4a; border-color: ${C.placeLt}; color: ${C.placeLt}; }
  .hbtn.won   .sp-chip { background: #0a280a; border-color: ${C.winLt}; color: ${C.winLt}; }
  .hbtn.placed .sp-chip { background: #0a1a2a; border-color: ${C.placeLt}; color: ${C.placeLt}; }
  .bet-toggle { display: flex; gap: 0; margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid ${C.border}; width: fit-content; }
  .bet-toggle button { padding: 7px 18px; background: #090f09; border: none; color: ${C.muted}; font-family: 'EB Garamond', serif; font-size: 14px; cursor: pointer; transition: all .15s; }
  .bet-toggle button.active-win { background: ${C.gold}; color: #0b1a0c; font-weight: 700; }
  .bet-toggle button.active-ew  { background: #1a3a5a; color: ${C.placeLt}; font-weight: 700; }
  .bet-toggle button:hover:not(.active-win):not(.active-ew) { background: #132015; color: ${C.cream}; }
  .ew-terms { display: inline-block; font-size: 12px; color: ${C.placeLt}; background: ${C.place}; border: 1px solid #1a5a8a; border-radius: 12px; padding: 2px 10px; margin-left: 8px; vertical-align: middle; }
  .lb-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: #0e1a0f; border: 1px solid ${C.border}; border-radius: 10px; margin-bottom: 8px; transition: all .25s; }
  .lb-row.p1 { border-color: ${C.gold}; background: #182a0a; box-shadow: 0 0 22px rgba(201,168,76,.13); }
  .lb-rank { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: ${C.muted}; width: 30px; text-align: center; }
  .lb-row.p1 .lb-rank { color: ${C.gold}; }
  .lb-pts { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: ${C.goldLt}; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid ${C.border}; margin-bottom: 22px; overflow-x: auto; }
  .tab { padding: 10px 18px; background: transparent; border: none; border-bottom: 2px solid transparent; color: ${C.muted}; font-family: 'EB Garamond', serif; font-size: 16px; cursor: pointer; margin-bottom: -1px; transition: all .18s; white-space: nowrap; }
  .tab.on { color: ${C.goldLt}; border-bottom-color: ${C.gold}; }
  .badge { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 12px; }
  .b-green { background: #0a280a; color: ${C.winLt}; border: 1px solid ${C.win}; }
  .b-gold  { background: #251900; color: ${C.gold}; border: 1px solid ${C.goldDim}; }
  .b-blue  { background: #0a1a2a; color: ${C.placeLt}; border: 1px solid #1a5a8a; }
  .b-grey  { background: #181818; color: ${C.muted}; border: 1px solid #2a2a2a; }
  .share-box { background: #090f09; border: 2px solid ${C.gold}; border-radius: 10px; padding: 18px 22px; display: flex; align-items: center; gap: 14px; max-width: 360px; margin: 16px auto; }
  .share-code { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: ${C.goldLt}; flex: 1; }
  .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: ${C.gold}; color: #0b1a0c; padding: 10px 26px; border-radius: 24px; font-weight: 700; font-size: 15px; z-index: 9999; animation: tIn .3s ease; pointer-events: none; white-space: nowrap; }
  @keyframes tIn { from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  .loader { display: flex; gap: 7px; justify-content: center; align-items: center; padding: 40px; }
  .loader span { width: 9px; height: 9px; background: ${C.gold}; border-radius: 50%; animation: lb .7s infinite alternate; }
  .loader span:nth-child(2) { animation-delay:.15s; }
  .loader span:nth-child(3) { animation-delay:.3s; }
  @keyframes lb { from{transform:translateY(0);opacity:.4} to{transform:translateY(-13px);opacity:1} }
  .pts-big { font-family: 'Playfair Display', serif; font-size: clamp(36px,8vw,60px); font-weight: 900; text-align: center; color: ${C.goldLt}; text-shadow: 0 0 36px rgba(240,208,112,.3); line-height: 1; }
  .pts-sub  { text-align: center; font-size: 13px; letter-spacing: 2px; color: ${C.muted}; margin-top: 6px; }
  hr { border: none; border-top: 1px solid ${C.border}; margin: 18px 0; }
  .ctx-strip { display: flex; justify-content: space-between; align-items: center; padding: 10px 0 14px; border-bottom: 1px solid ${C.border}; margin-bottom: 4px; flex-wrap: wrap; gap: 8px; }
  .ctx-code { font-family: 'Playfair Display', serif; letter-spacing: 4px; color: ${C.goldLt}; font-size: 18px; }
  .home-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media(max-width:540px){ .home-grid { grid-template-columns: 1fr; } }
  .err { color: ${C.dangerLt}; font-size: 14px; margin-top: 10px; padding: 10px 14px; background: #1a0808; border: 1px solid ${C.danger}; border-radius: 7px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${C.greenLt}; animation: pulse 1.4s infinite; margin-right: 6px; vertical-align: middle; }
  .fade { animation: fadeIn .4s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .stake-bar { background: #0e1a0f; border: 1px solid ${C.border}; border-radius: 8px; padding: 10px 14px; margin-top: 10px; font-size: 14px; color: ${C.muted}; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
  .stake-bar span { color: ${C.goldLt}; font-weight: 600; }
`;

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function genCode(len = 5) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}
function today() {
  return new Date().toISOString().substring(0, 10);
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
function calcSelectionReturn(sp, betType, position, ewTerms, stake = 2) {
  const dec = spToDecimal(sp);
  if (!dec) return { win: 0, place: 0, total: 0 };
  if (betType === "win") {
    const ret = position === 1 ? +(stake * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret };
  }
  if (!ewTerms) {
    const ret = position === 1 ? +(stake * dec).toFixed(2) : 0;
    return { win: ret, place: 0, total: ret, winOnly: true };
  }
  const winRet    = position === 1 ? +(stake * dec).toFixed(2) : 0;
  const placeOdds = +((dec - 1) / ewTerms.fraction + 1).toFixed(4);
  const placed    = position !== null && position >= 1 && position <= ewTerms.places;
  const placeRet  = placed ? +(stake * placeOdds).toFixed(2) : 0;
  return { win: winRet, place: placeRet, total: +(winRet + placeRet).toFixed(2) };
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

// ─── LOCAL STORAGE (challenges persist in browser) ────────────────────────────
// On a real multi-device app you'd use Firebase here.
// For now challenges are stored locally — all players must use the same device
// OR you add Firebase later (easy swap).
const DB_KEY = "rc_v3";
function dbGet(code) {
  try { return JSON.parse(localStorage.getItem(DB_KEY + ":" + code) || "null"); } catch { return null; }
}
function dbSet(code, val) {
  try { localStorage.setItem(DB_KEY + ":" + code, JSON.stringify(val)); } catch {}
}

// ─── API (calls our own Vercel proxy, no CORS issues) ─────────────────────────
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
      time: r.off || r.time || "",
      name: r.race_name || r.name || "Race",
      distance: r.distance_round || r.distance || "",
      going: r.going || "",
      isHandicap, runners,
      ewTerms: getEWTerms(runners.length, isHandicap),
      resultIn: false,
    };
  });
}

function mergeResults(races, data) {
  const list = data.results || (Array.isArray(data) ? data : []);
  const byId = {};
  list.forEach(r => { byId[r.race_id || r.id] = r; });
  return races.map(race => {
    const res = byId[race.id];
    if (!res) return race;
    const runners = race.runners.map(h => {
      const rh = (res.runners || []).find(x => (x.horse_id || x.id) === h.id || x.horse === h.name);
      if (!rh) return h;
      const position = rh.position ? parseInt(rh.position) : null;
      return { ...h, sp: rh.sp || rh.starting_price || null, position: isNaN(position) ? null : position, win: position === 1 };
    });
    return { ...race, runners, ewTerms: getEWTerms(runners.length, race.isHandicap), resultIn: true };
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
        <div style={{ fontSize: 52, marginBottom: 10 }}>🏇</div>
        <p style={{ color: C.muted, fontSize: 18, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
          Pick a winner — or go each-way — in each race. Stake 2 points per bet at Starting Price and see who banks the best returns.
        </p>
      </div>
      <div className="home-grid">
        <div className="card card-gold">
          <div className="eyebrow">START A NEW GAME</div>
          <div className="sec-title" style={{ fontSize: 20 }}>Create Challenge</div>
          <div className="field">
            <label>YOUR NAME</label>
            <input className="inp" placeholder="e.g. Paddy" value={createName} onChange={e => setCreateName(e.target.value)} />
          </div>
          <button className="btn btn-gold" style={{ width: "100%" }} disabled={!createName.trim()} onClick={() => onCreate(createName.trim())}>
            Create &amp; Get Code
          </button>
        </div>
        <div className="card">
          <div className="eyebrow">JOIN A FRIEND'S GAME</div>
          <div className="sec-title" style={{ fontSize: 20 }}>Join Challenge</div>
          <div className="field">
            <label>YOUR NAME</label>
            <input className="inp" placeholder="e.g. Seamus" value={joinName} onChange={e => setJoinName(e.target.value)} />
          </div>
          <div className="field">
            <label>CHALLENGE CODE</label>
            <input className="inp inp-code" placeholder="XXXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-gold" style={{ width: "100%", marginTop: 4 }} disabled={!joinName.trim() || joinCode.length < 5} onClick={handleJoin}>
            Join Challenge
          </button>
        </div>
      </div>
      <p style={{ textAlign: "center", color: C.muted, marginTop: 22, fontSize: 13 }}>
        For entertainment purposes only · Please gamble responsibly
      </p>
    </div>
  );
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
function SetupScreen({ challenge, onSave, onBack }) {
  const [date,      setDate]      = useState(challenge.date || today());
  const [racecards, setRacecards] = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [toast,     showToast]    = useToast();

  async function load() {
    setLoading(true); setError("");
    try {
      const data   = await apiGet(`/api/racecards?date=${date}`);
      const parsed = parseRacecards(data);
      setRacecards(parsed);
      if (!parsed.length) setError("No UK/Ireland races found for that date.");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function save() {
    const selectedRaces = racecards.filter(r => selected.has(r.id));
    const updated = { ...challenge, date, racecards, selectedRaceIds: [...selected], selectedRaces, status: "open" };
    dbSet(updated.code, updated);
    showToast("Challenge saved!");
    setTimeout(() => onSave(updated), 600);
  }

  return (
    <div style={{ paddingTop: 24 }} className="fade">
      <Toast msg={toast} />
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={onBack}>← Back</button>
      <div className="eyebrow">CHALLENGE SETUP</div>
      <div className="sec-title">Choose Your Races</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 160 }}>
            <label>RACE DATE</label>
            <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <button className="btn btn-gold" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Load Races"}
          </button>
        </div>
        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
      </div>
      {loading && <Loader />}
      {racecards.length > 0 && (
        <div className="fade">
          <p style={{ color: C.muted, marginBottom: 10, fontSize: 14 }}>
            Tap races to add them — <strong style={{ color: C.goldLt }}>{selected.size} selected</strong>
          </p>
          {racecards.map(r => (
            <div key={r.id} className={`race-row${selected.has(r.id) ? " sel" : ""}`} onClick={() => toggle(r.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="pf" style={{ fontSize: 17, color: selected.has(r.id) ? C.goldLt : C.cream }}>
                    {r.course} <span style={{ fontStyle: "italic", fontWeight: 400, fontSize: 15 }}>{r.time}</span>
                    {r.isHandicap && <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>HCP</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{r.name}{r.distance ? ` · ${r.distance}` : ""}{r.going ? ` · ${r.going}` : ""}</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                    {r.runners.length} runners · {r.ewTerms ? `EW: ${r.ewTerms.places} places 1/${r.ewTerms.fraction}` : "Win only"}
                  </div>
                </div>
                <span style={{ fontSize: 20 }}>{selected.has(r.id) ? "✅" : "⬜"}</span>
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button className="btn btn-gold" disabled={selected.size === 0} onClick={save}>
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

  // Poll localStorage for updates from other players
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
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎟️</div>
        <div className="eyebrow" style={{ display: "block" }}>YOUR CHALLENGE CODE</div>
        <div className="share-box">
          <div className="share-code">{ch.code}</div>
          <button className="btn btn-outline btn-sm" onClick={copy}>Copy</button>
        </div>
        <p style={{ color: C.muted, maxWidth: 380, margin: "0 auto", fontSize: 15, lineHeight: 1.6 }}>
          Share this code with friends. They visit this site and enter the code to join.
          {isCreator ? " Open selections when everyone's ready." : " The creator will open selections when everyone's in."}
        </p>
      </div>
      <div className="card" style={{ maxWidth: 440, margin: "0 auto 20px" }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.muted, marginBottom: 12 }}>
          <span className="live-dot" />PLAYERS
        </div>
        {players.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 17 }}>
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
          <button className="btn btn-gold" onClick={lockAndOpen}>Open Selections →</button>
        )}
        {ch.status === "selections" && (
          <button className="btn btn-gold" onClick={() => onAction("picks", ch)}>Make My Picks →</button>
        )}
        <button className="btn btn-ghost" onClick={() => onAction("results", ch)}>View Leaderboard</button>
      </div>
    </div>
  );
}

// ── PICKS ─────────────────────────────────────────────────────────────────────
function PicksScreen({ challenge, playerId, onSubmit, onBack }) {
  const player   = challenge.players?.[playerId];
  const races    = challenge.selectedRaces || [];
  const submitted = player?.picksSubmitted;
  const [picks,  setPicks]  = useState(player?.picks || {});
  const [saving, setSaving] = useState(false);
  const [toast,  showToast] = useToast();

  const allPicked  = races.every(r => picks[r.id]?.horseId);
  const totalStake = Object.values(picks).reduce((s, p) => s + (p.betType === "ew" ? 4 : 2), 0);

  function pickHorse(raceId, hId) {
    if (submitted) return;
    setPicks(p => ({ ...p, [raceId]: { horseId: hId, betType: p[raceId]?.betType || "win" } }));
  }
  function setBetType(raceId, betType) {
    if (submitted) return;
    setPicks(p => ({ ...p, [raceId]: { ...p[raceId], betType } }));
  }

  function submit() {
    setSaving(true);
    const fresh = dbGet(challenge.code) || challenge;
    const updatedPlayer = { ...player, picks, picksSubmitted: true };
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
      <div className="eyebrow">PICK YOUR SELECTIONS · 2 PTS WIN / 4 PTS EACH-WAY</div>
      <div className="sec-title">{player?.name}'s Picks</div>
      {submitted && <div className="badge b-green" style={{ fontSize: 14, padding: "7px 18px", marginBottom: 16, display: "inline-block" }}>✅ Picks submitted — good luck!</div>}

      {races.map((race, i) => {
        const myPick   = picks[race.id];
        const pickedId = myPick?.horseId;
        const betType  = myPick?.betType || "win";
        const ewAvail  = !!race.ewTerms;
        return (
          <div key={race.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div>
                <div className="eyebrow">RACE {i + 1}</div>
                <div className="pf" style={{ fontSize: 19, color: C.goldLt, marginTop: 2 }}>
                  {race.course} <span style={{ fontStyle: "italic", fontWeight: 400, fontSize: 15 }}>{race.time}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 13 }}>
                  {race.name}{race.distance ? ` · ${race.distance}` : ""}
                  {ewAvail
                    ? <span className="ew-terms">{race.ewTerms.places} places · 1/{race.ewTerms.fraction}</span>
                    : <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>(win only)</span>}
                </div>
              </div>
              {pickedId && <span className={`badge ${betType === "ew" ? "b-blue" : "b-gold"}`}>✓ {betType === "ew" ? "Each-Way" : "Win"}</span>}
            </div>
            {pickedId && ewAvail && !submitted && (
              <div className="bet-toggle">
                <button className={betType === "win" ? "active-win" : ""} onClick={() => setBetType(race.id, "win")}>Win (2pts)</button>
                <button className={betType === "ew"  ? "active-ew"  : ""} onClick={() => setBetType(race.id, "ew")}>Each-Way (4pts)</button>
              </div>
            )}
            <div className="horse-grid">
              {race.runners.map(h => {
                const isPicked = pickedId === h.id;
                return (
                  <button key={h.id} className={`hbtn${isPicked ? (betType === "ew" ? " ew-picked" : " win-picked") : ""}`} onClick={() => pickHorse(race.id, h.id)}>
                    <span style={{ textAlign: "left" }}>
                      <span>{h.number ? `${h.number}. ` : ""}{h.name}</span>
                      {h.jockey && <span style={{ display: "block", fontSize: 12, opacity: .65, marginTop: 1 }}>{h.jockey}</span>}
                    </span>
                    <span className="sp-chip">SP</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {Object.keys(picks).length > 0 && (
        <div className="stake-bar">
          <div>{Object.values(picks).filter(p => p.horseId).length} of {races.length} races picked</div>
          <div>Total stake: <span>{totalStake} pts</span></div>
        </div>
      )}
      {!submitted && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button className="btn btn-gold" disabled={!allPicked || saving} onClick={submit}>
            {saving ? "Saving…" : allPicked ? `Submit Picks 🏁 (${totalStake} pts)` : `${races.length - Object.values(picks).filter(p => p.horseId).length} more to pick`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function ResultsScreen({ challenge, playerId, isCreator, onBack }) {
  const [ch,         setCh]     = useState(challenge);
  const [tab,        setTab]    = useState("board");
  const [refreshing, setRef]    = useState(false);
  const [err,        setErr]    = useState("");
  const [toast,      showToast] = useToast();

  const races   = ch.selectedRaces || [];
  const players = Object.values(ch.players || {});

  useEffect(() => {
    const t = setInterval(() => {
      const fresh = dbGet(ch.code);
      if (fresh) setCh(fresh);
    }, 8000);
    return () => clearInterval(t);
  }, [ch.code]);

  function calcPlayer(p) {
    let totalStaked = 0, totalReturn = 0, wins = 0, places = 0;
    const detail = races.map(race => {
      const sel     = p.picks?.[race.id];
      const hId     = sel?.horseId;
      const betType = sel?.betType || "win";
      const horse   = race.runners.find(h => h.id === hId);
      if (!horse) return { race, horse: null, betType, ret: { total: 0, win: 0, place: 0 }, staked: 0 };
      const staked = betType === "ew" ? 4 : 2;
      totalStaked += staked;
      const ret = calcSelectionReturn(horse.sp, betType, horse.position, race.ewTerms, 2);
      totalReturn += ret.total;
      if (horse.position === 1) wins++;
      else if (ret.place > 0) places++;
      return { race, horse, betType, ret, staked };
    });
    return { totalStaked, totalReturn: +totalReturn.toFixed(2), wins, places, detail };
  }

  const ranked     = players.map(p => ({ ...p, ...calcPlayer(p) })).sort((a, b) => b.totalReturn - a.totalReturn);
  const me         = ranked.find(p => p.id === playerId);
  const hasResults = races.some(r => r.runners.some(h => h.sp));

  async function refresh() {
    setRef(true); setErr("");
    try {
      const data  = await apiGet(`/api/results?date=${ch.date}`);
      const fresh = dbGet(ch.code) || ch;
      fresh.selectedRaces = mergeResults(fresh.selectedRaces || races, data);
      dbSet(fresh.code, fresh);
      setCh({ ...fresh });
      showToast("Results updated! 🏆");
    } catch (e) { setErr(e.message); }
    setRef(false);
  }

  return (
    <div style={{ paddingTop: 22 }} className="fade">
      <Toast msg={toast} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 10 }} onClick={onBack}>← Back</button>
          <div className="eyebrow">RESULTS</div>
          <div className="sec-title" style={{ marginBottom: 0 }}>{ch.date} · {races.length} races</div>
        </div>
        {isCreator && (
          <button className="btn btn-gold btn-sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "🔄 Refresh SPs"}
          </button>
        )}
      </div>
      {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}
      {!hasResults && (
        <div className="card" style={{ textAlign: "center", marginBottom: 20, borderColor: C.goldDim }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ color: C.muted, lineHeight: 1.6 }}>
            {isCreator ? "Once races are run, hit 'Refresh SPs' to pull official Starting Prices." : "Waiting for the creator to load results after racing."}
          </div>
        </div>
      )}
      {me && (
        <div className="card card-gold" style={{ marginBottom: 20, textAlign: "center" }}>
          <div className="eyebrow" style={{ display: "block", marginBottom: 6 }}>YOUR RETURNS · {me.name}</div>
          <div className="pts-big">{fmtPts(me.totalReturn)}</div>
          <div className="pts-sub">{me.wins}W{me.places > 0 ? ` · ${me.places}P` : ""} · {me.totalStaked} pts staked</div>
          {hasResults && (
            <div style={{ marginTop: 10, fontSize: 16, color: me.totalReturn >= me.totalStaked ? C.winLt : C.dangerLt }}>
              {me.totalReturn >= me.totalStaked ? `+${(me.totalReturn - me.totalStaked).toFixed(2)} pts profit 🎉` : me.totalReturn === 0 ? "No returns — better luck next time" : `-${(me.totalStaked - me.totalReturn).toFixed(2)} pts`}
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
                <div style={{ fontSize: 18 }}>{p.name}{p.id === ch.creatorId ? " 👑" : ""}{p.id === playerId ? <span style={{ color: C.muted, fontSize: 13 }}> (you)</span> : ""}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{p.wins}W{p.places > 0 ? ` · ${p.places}P` : ""} · {p.totalStaked} pts staked{!p.picksSubmitted ? " · ⏳ pending" : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lb-pts">{fmtPts(p.totalReturn)}</div>
                {hasResults && <div style={{ fontSize: 13, color: p.totalReturn >= p.totalStaked ? C.winLt : C.muted }}>{p.totalReturn >= p.totalStaked ? `+${(p.totalReturn - p.totalStaked).toFixed(2)}` : p.totalReturn === 0 ? "—" : `-${(p.totalStaked - p.totalReturn).toFixed(2)}`}</div>}
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
                    <div className="eyebrow">RACE {i + 1}</div>
                    <div className="pf" style={{ fontSize: 18, color: C.goldLt }}>{race.course} {race.time}</div>
                    <div style={{ color: C.muted, fontSize: 13 }}>
                      {race.name}
                      {race.ewTerms ? <span className="ew-terms">{race.ewTerms.places} places · 1/{race.ewTerms.fraction}</span> : <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>Win only</span>}
                    </div>
                  </div>
                  {winner ? <span className="badge b-green">🏆 {winner.name}{winner.sp ? ` @ ${fmtSP(winner.sp)}` : ""}</span> : <span className="badge b-grey">Pending</span>}
                </div>
                <div className="horse-grid">
                  {race.runners.map(h => {
                    const isWin   = h.position === 1;
                    const isPlace = !isWin && h.position && race.ewTerms && h.position <= race.ewTerms.places;
                    return (
                      <button key={h.id} className={`hbtn${isWin ? " won" : isPlace ? " placed" : ""}`} style={{ cursor: "default" }}>
                        <span>{h.position ? `${h.position}. ` : ""}{h.name}{isPlace ? <span style={{ fontSize: 11, marginLeft: 4, opacity: .8 }}> P</span> : ""}</span>
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
          {me.detail.map(({ race, horse, betType, ret, staked }, i) => {
            const isWin   = horse?.position === 1;
            const isPlace = !isWin && ret.place > 0;
            const col     = isWin ? C.winLt : isPlace ? C.placeLt : horse ? C.dangerLt : C.border;
            return (
              <div key={race.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div className="eyebrow">RACE {i + 1} · {race.course} {race.time}</div>
                    <div className="pf" style={{ fontSize: 17, color: isWin ? C.winLt : isPlace ? C.placeLt : horse ? C.dangerLt : C.muted, marginTop: 4 }}>
                      {horse ? `${isWin ? "🏆" : isPlace ? "🔵" : "✗"} ${horse.name}` : "No selection"}
                      {horse?.sp ? <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, opacity: .8 }}>@ {fmtSP(horse.sp)}</span> : ""}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
                      {betType === "ew" ? "Each-Way" : "Win only"} · {staked} pts staked
                      {betType === "ew" && race.ewTerms && <span style={{ marginLeft: 6 }}>({race.ewTerms.places} places, 1/{race.ewTerms.fraction})</span>}
                    </div>
                    {betType === "ew" && hasResults && horse && (
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                        Win: <span style={{ color: ret.win > 0 ? C.winLt : C.muted }}>{fmtPts(ret.win)}</span>
                        {" · "}Place: <span style={{ color: ret.place > 0 ? C.placeLt : C.muted }}>{fmtPts(ret.place)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Returns</div>
                    <div className="pf" style={{ fontSize: 20, color: ret.total > 0 ? C.goldLt : C.muted }}>{hasResults ? fmtPts(ret.total) : "—"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <hr />
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.muted, fontSize: 13 }}>Total staked: {me.totalStaked} pts</div>
            <div className="pf" style={{ fontSize: 26, color: C.goldLt, marginTop: 4 }}>Returns: {fmtPts(me.totalReturn)}</div>
            {hasResults && (
              <div style={{ fontSize: 15, marginTop: 4, color: me.totalReturn >= me.totalStaked ? C.winLt : C.dangerLt }}>
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
    const newCh = { code, creatorId: playerId, status: "open", date: today(), players: { [playerId]: p }, selectedRaces: [], selectedRaceIds: [], racecards: [] };
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
        <div className="hdr-title">🏇 Racing Challenge</div>
        <div className="hdr-sub">PICK · COMPETE · COLLECT</div>
      </div>
      <div className="wrap">
        {showCtx && (
          <div className="ctx-strip">
            <div style={{ fontSize: 14, color: C.muted }}>
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
