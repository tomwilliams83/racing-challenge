export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(200).send(getHtml());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StableMates — Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #eef6fd; font-family: 'DM Sans', sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;
    const C = {
      bg:"#eef6fd", card:"#fff", border:"#bdd9f5",
      pink:"#ff007f", pinkLt:"#ff4dab", pinkDk:"#cc0066", pinkBg:"#fff0f8",
      blue:"#1a7fd4", blueLt:"#4aa8f0", blueDk:"#0d5fa8", blueBg:"#eff8ff",
      text:"#0d2d4a", muted:"#5a8aaa", mutedLt:"#a8c8e0", danger:"#ff3b30"
    };

    const UK = ["aintree","ascot","bath","beverley","brighton","carlisle","cartmel","catterick","cheltenham","chelmsford","chelmsford city","chepstow","chester","doncaster","epsom","epsom downs","exeter","fakenham","ffos las","fontwell","fontwell park","goodwood","great yarmouth","yarmouth","hamilton","hamilton park","haydock","haydock park","hereford","hexham","huntingdon","kempton","kempton park","leicester","lingfield","lingfield park","ludlow","market rasen","musselburgh","newbury","newcastle","newmarket","newton abbot","nottingham","perth","plumpton","pontefract","redcar","ripon","salisbury","sandown","sandown park","sedgefield","southwell","stratford","taunton","thirsk","towcester","uttoxeter","warwick","wetherby","wincanton","windsor","wolverhampton","worcester","york","ayr","bangor","kelso","ballinrobe","bellewstown","clonmel","cork","curragh","the curragh","dundalk","fairyhouse","galway","gowran","gowran park","kilbeggan","killarney","laytown","leopardstown","limerick","listowel","naas","navan","punchestown","roscommon","sligo","thurles","tipperary","tramore","waterford","wexford","down royal","downpatrick"];
    const isUK = c => { const s=(c||"").toLowerCase().trim(); return UK.some(k=>s.includes(k)||k.includes(s)); };
    const getEW = n => n<=4?null:n<=7?{places:2,fraction:4}:n<=15?{places:3,fraction:4}:{places:4,fraction:4};

    function parseCards(data) {
      return (data.racecards||[]).filter(r=>isUK(r.course||"")).map(r=>{
        const isH=/handicap/i.test(r.race_name||"");
        const raw=r.off_time||r.off||r.time||"";
        const mm=String(raw).match(/(\\d{1,2}):(\\d{2})/);
        const time=mm?(parseInt(mm[1])<10?parseInt(mm[1])+12:parseInt(mm[1]))+":"+mm[2]:raw;
        return {id:r.race_id||r.id, course:r.course||"Unknown", time, name:r.race_name||"Race",
          distance:r.distance_round||"", going:r.going||"", isHandicap:isH,
          runners:(r.runners||[]).length, ewTerms:getEW((r.runners||[]).length)};
      }).sort((a,b)=>a.time.localeCompare(b.time));
    }

    function Toast({msg}){return msg?<div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:C.text,color:"#fff",padding:"12px 26px",borderRadius:24,fontWeight:600,fontSize:15,zIndex:9999,whiteSpace:"nowrap"}}>{msg}</div>:null;}
    function Loader(){return <div style={{display:"flex",gap:8,justifyContent:"center",padding:40}}><span style={{width:10,height:10,borderRadius:"50%",background:C.pink,display:"inline-block"}}/><span style={{width:10,height:10,borderRadius:"50%",background:C.blue,display:"inline-block"}}/><span style={{width:10,height:10,borderRadius:"50%",background:C.pink,display:"inline-block"}}/></div>;}

    function Accordion({racecards, selected, toggle}) {
      const grouped = racecards.reduce((a,r)=>{(a[r.course]=a[r.course]||[]).push(r);return a;},{});
      const courses = Object.keys(grouped).sort();
      const [open, setOpen] = useState(new Set());
      const tog = c => setOpen(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});
      const selAll = (course,e) => {
        e.stopPropagation();
        const races=grouped[course]; const all=races.every(r=>selected.has(r.id));
        races.forEach(r=>{if(all){if(selected.has(r.id))toggle(r.id);}else{if(!selected.has(r.id))toggle(r.id);}});
      };
      return (
        <div>
          <p style={{color:C.muted,marginBottom:12,fontSize:14,fontWeight:500}}>
            Tap a course to expand — <strong style={{color:C.pink}}>{selected.size} race{selected.size!==1?"s":""} selected</strong>
          </p>
          {courses.map(course => {
            const races=grouped[course]; const sc=races.filter(r=>selected.has(r.id)).length; const isO=open.has(course);
            return (
              <div key={course} style={{border:\`1.5px solid \${sc>0?C.pink:C.border}\`,borderRadius:12,marginBottom:10,overflow:"hidden",background:"#fff"}}>
                <div onClick={()=>tog(course)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",cursor:"pointer",background:sc>0?C.pinkBg:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,fontWeight:700,color:sc>0?C.pink:C.text}}>{course}</span>
                    <span style={{fontSize:12,color:C.muted}}>{races.length} race{races.length!==1?"s":""}</span>
                    {sc>0 && <span style={{background:C.pinkBg,color:C.pink,border:\`1.5px solid \${C.pinkLt}\`,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}}>{sc} selected</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {isO && <button style={{fontSize:12,color:sc===races.length?C.danger:C.blue,fontWeight:600,background:"none",border:"none",cursor:"pointer"}} onClick={e=>selAll(course,e)}>{sc===races.length?"Deselect all":"Select all"}</button>}
                    <span style={{fontSize:11,color:C.muted,display:"inline-block",transform:isO?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                  </div>
                </div>
                {isO && <div style={{borderTop:\`1.5px solid \${C.border}\`}}>
                  {races.map(r => {
                    const iS=selected.has(r.id);
                    return (
                      <div key={r.id} onClick={()=>toggle(r.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",cursor:"pointer",borderBottom:\`1px solid \${C.bg}\`,background:iS?C.pinkBg:"#fff"}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:iS?C.pink:C.text}}>
                            <span style={{background:C.pink,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700,marginRight:8}}>{r.time}</span>
                            {r.name}
                            {r.isHandicap && <span style={{fontSize:11,color:C.muted,marginLeft:6}}>HCP</span>}
                          </div>
                          <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                            {r.runners} runners{r.distance?\` · \${r.distance}\`:""}
                            {r.going?\` · \${r.going}\`:""}
                            {r.ewTerms?\` · EW \${r.ewTerms.places} places\`:" · Win only"}
                          </div>
                        </div>
                        <span style={{fontSize:20}}>{iS?"✅":"⬜"}</span>
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      );
    }

    function Admin() {
      const [step, setStep]       = useState("auth");
      const [key, setKey]         = useState("");
      const [authErr, setAuthErr] = useState("");
      const [day, setDay]         = useState("today");
      const [label, setLabel]     = useState("");
      const [cards, setCards]     = useState([]);
      const [selected, setSelected] = useState(new Set());
      const [loading, setLoading] = useState(false);
      const [saving, setSaving]   = useState(false);
      const [err, setErr]         = useState("");
      const [toast, setToast]     = useState(null);
      const [current, setCurrent] = useState(null);

      const showToast = m => { setToast(m); setTimeout(()=>setToast(null), 2500); };
      const toggle = id => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});

      async function auth() {
        if (!key.trim()) return setAuthErr("Enter your admin key");
        try {
          const res = await fetch('/api/itv', { headers: { Authorization: \`Bearer \${key}\` } });
          if (res.status === 401) return setAuthErr("Invalid admin key");
          const data = await res.json();
          setCurrent(data); setStep("setup");
          if (data.label) setLabel(data.label);
        } catch(e) { setAuthErr(e.message); }
      }

      async function load() {
        setLoading(true); setErr("");
        try {
          const res = await fetch(\`/api/racecards?day=\${day}\`);
          const data = await res.json();
          const parsed = parseCards(data);
          setCards(parsed);
          if (current?.raceIds?.length) {
            const cs = new Set(current.raceIds);
            setSelected(new Set(parsed.filter(r=>cs.has(r.id)).map(r=>r.id)));
          }
          if (!parsed.length) setErr("No UK/Irish races found.");
        } catch(e) { setErr(e.message); }
        setLoading(false);
      }

      async function save() {
        if (!label.trim()) return setErr("Add a label before saving");
        if (selected.size === 0) return setErr("Select at least one race");
        setSaving(true);
        try {
          const raceMeta = cards.filter(r=>selected.has(r.id)).map(r=>({course:r.course,time:r.time}));
          const res = await fetch('/api/itv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${key}\` },
            body: JSON.stringify({ raceIds: [...selected], label: label.trim(), raceMeta })
          });
          if (!res.ok) throw new Error("Save failed");
          showToast(\`✅ Saved — \${selected.size} races\`);
          setStep("done");
        } catch(e) { setErr(e.message); }
        setSaving(false);
      }

      async function clearCard() {
        if (!confirm("Clear the current ITV card?")) return;
        await fetch('/api/itv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${key}\` },
          body: JSON.stringify({ raceIds: [], label: '', raceMeta: [] })
        });
        showToast("ITV card cleared");
        setCurrent(null); setLabel(""); setSelected(new Set()); setCards([]); setStep("setup");
      }

      const inp = { width:"100%", background:C.bg, border:\`1.5px solid \${C.border}\`, borderRadius:10, color:C.text, padding:"11px 14px", fontFamily:"DM Sans, sans-serif", fontSize:15 };
      const btn = (bg,color="white") => ({ fontFamily:"DM Sans, sans-serif", fontSize:15, fontWeight:600, border:"none", cursor:"pointer", borderRadius:10, padding:"12px 24px", background:bg, color, width:"100%" });
      const card = { background:"#fff", border:\`1.5px solid \${C.border}\`, borderRadius:16, padding:20, marginBottom:14 };

      if (step === "auth") return (
        <div style={{paddingTop:48}}>
          <Toast msg={toast}/>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:52,marginBottom:12}}>🔑</div>
            <div style={{fontFamily:"DM Serif Display, serif",fontSize:24,color:C.text,marginBottom:8}}>Admin Access</div>
            <p style={{color:C.muted,fontSize:15}}>Enter your admin key to manage the main card</p>
          </div>
          <div style={card}>
            <label style={{display:"block",fontSize:11,letterSpacing:2,color:C.muted,marginBottom:7,fontWeight:600,textTransform:"uppercase"}}>Admin Key</label>
            <input style={{...inp,marginBottom:12}} type="password" placeholder="Enter key…" value={key}
              onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&auth()}/>
            {authErr && <div style={{color:C.danger,fontSize:14,marginBottom:10,padding:"10px 14px",background:"#fff5f5",border:"1.5px solid #ffb3b3",borderRadius:10}}>{authErr}</div>}
            <button style={btn(C.blue)} onClick={auth} disabled={!key.trim()}>Continue →</button>
          </div>
        </div>
      );

      if (step === "done") return (
        <div style={{paddingTop:48,textAlign:"center"}}>
          <Toast msg={toast}/>
          <div style={{fontSize:64,marginBottom:16}}>✅</div>
          <div style={{fontFamily:"DM Serif Display, serif",fontSize:24,color:C.text,marginBottom:8}}>Card Saved!</div>
          <p style={{color:C.muted,marginBottom:8}}><strong>{label}</strong></p>
          <p style={{color:C.muted,marginBottom:32}}>{selected.size} races pre-selected for the main challenge</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button style={{...btn("#fff",C.muted),border:\`1.5px solid \${C.border}\`,width:"auto",padding:"12px 24px"}}
              onClick={()=>{setStep("setup");setCards([]);setSelected(new Set());}}>Set another card</button>
            <button style={{...btn("#fff",C.danger),border:\`1.5px solid \${C.danger}\`,width:"auto",padding:"12px 24px"}}
              onClick={clearCard}>Clear card</button>
          </div>
        </div>
      );

      return (
        <div style={{paddingTop:24}}>
          <Toast msg={toast}/>
          {current?.raceIds?.length > 0 && (
            <div style={{...card,background:C.blueBg,borderColor:C.blue,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,letterSpacing:3,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Current Main Card</div>
                <div style={{fontWeight:600,color:C.text}}>{current.label||"(unlabelled)"}</div>
                <div style={{fontSize:13,color:C.muted}}>{current.raceIds.length} races set</div>
              </div>
              <button style={{...btn("#fff",C.danger),border:\`1.5px solid \${C.danger}\`,width:"auto",padding:"8px 16px",fontSize:13}}
                onClick={clearCard}>Clear</button>
            </div>
          )}

          <div style={{fontSize:10,letterSpacing:3,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Main Card Setup</div>
          <div style={{fontFamily:"DM Serif Display, serif",fontSize:24,color:C.text,marginBottom:16}}>Set Featured Races</div>

          <div style={card}>
            <label style={{display:"block",fontSize:11,letterSpacing:2,color:C.muted,marginBottom:7,fontWeight:600,textTransform:"uppercase"}}>Card Label</label>
            <input style={{...inp,marginBottom:16}} placeholder="e.g. ITV7 — Saturday 26 Apr 2025"
              value={label} onChange={e=>setLabel(e.target.value)}/>
            <label style={{display:"block",fontSize:11,letterSpacing:2,color:C.muted,marginBottom:7,fontWeight:600,textTransform:"uppercase"}}>Race day</label>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {["today","tomorrow"].map(d => (
                <button key={d} onClick={()=>setDay(d)}
                  style={{flex:1,padding:11,background:day===d?C.pink:C.bg,border:\`1.5px solid \${day===d?C.pinkDk:C.border}\`,borderRadius:12,color:day===d?"#fff":C.muted,fontFamily:"DM Sans, sans-serif",fontSize:15,fontWeight:600,cursor:"pointer"}}>
                  {d.charAt(0).toUpperCase()+d.slice(1)}
                </button>
              ))}
            </div>
            <button style={btn(C.blue)} onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Load Races"}
            </button>
            {err && <div style={{color:C.danger,fontSize:14,marginTop:10,padding:"10px 14px",background:"#fff5f5",border:"1.5px solid #ffb3b3",borderRadius:10}}>{err}</div>}
          </div>

          {loading && <Loader/>}

          {cards.length > 0 && (
            <div>
              <Accordion racecards={cards} selected={selected} toggle={toggle}/>
              <div style={{marginTop:20}}>
                <button style={btn(C.pink)} disabled={selected.size===0||saving||!label.trim()} onClick={save}>
                  {saving ? "Saving…" : \`💾 Save \${selected.size} Race\${selected.size!==1?"s":""} as Main Card\`}
                </button>
                {!label.trim() && selected.size > 0 && (
                  <p style={{color:C.muted,fontSize:13,marginTop:8,textAlign:"center"}}>Add a label before saving</p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.Fragment>
        <div style={{background:"#1a7fd4",padding:"18px 0",textAlign:"center",position:"sticky",top:0,zIndex:100}}>
          <div style={{fontFamily:"DM Serif Display, serif",fontSize:26,color:"#fff"}}>🐴 StableMates Admin</div>
          <div style={{fontSize:10,letterSpacing:3,color:"rgba(255,255,255,.5)",marginTop:3,fontWeight:600}}>MAIN CARD MANAGER</div>
        </div>
        <div style={{maxWidth:600,margin:"0 auto",padding:"0 16px 80px"}}><Admin/></div>
      </React.Fragment>
    );
  </script>
</body>
</html>`;
}
