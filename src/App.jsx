
import React, { useMemo, useState, useEffect } from 'react'
import { auth, db, messaging, config } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, addDoc, setDoc, doc, serverTimestamp, onSnapshot, where, query, deleteDoc, getDocs } from 'firebase/firestore'
import { getToken } from 'firebase/messaging'

// ---- Räume & Kapazitäten ----
const ROOMS = [
  { id: "coaching", name: "Coaching", capacityType: "persons", capacityPersons: 4 },
  { id: "meeting", name: "Meeting", capacityType: "persons", capacityPersons: 4 },
  { id: "ttl", name: "TTL", capacityType: "persons", capacityPersons: 4 },
  { id: "ttr", name: "TTR", capacityType: "persons", capacityPersons: 4 },
  { id: "input_r", name: "Input R", capacityType: "persons", capacityPersons: 4 },
  { id: "input_l", name: "Input L", capacityType: "persons", capacityPersons: 4 },
  { id: "welcome_2", name: "Welcome 2", capacityType: "groups", capacityGroups: 2, perGroupPersons: 4 },
  { id: "welcome_1", name: "Welcome 1", capacityType: "persons", capacityPersons: 4 },
  { id: "cafeteria", name: "Cafeteria", capacityType: "groups", capacityGroups: 2, perGroupPersons: 4 },
  { id: "terrasse", name: "Terrasse", capacityType: "groups", capacityGroups: 3, perGroupPersons: 4 },
]

const LEHRKRAEFTE = [
  { id: "lb-1", name: "Frau Keller", email: "keller@nssg.ch" },
  { id: "lb-2", name: "Herr Müller", email: "mueller@nssg.ch" },
  { id: "lb-3", name: "Frau Rossi", email: "rossi@nssg.ch" },
]
const TIME_SLOTS = [
  "08:30–08:55","09:00–09:25","09:30–09:55","10:00–10:25","10:30–10:55","11:00–11:25",
  "11:30–11:55","12:00–12:25","12:30–12:55","13:00–13:25","13:30–13:55","14:00–14:25",
  "14:30–14:55","15:00–15:25","15:30–15:55"
]

const cls = (...x) => x.filter(Boolean).join(' ')
const todayISO = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }
const toCSV = (rows) => { if (!rows.length) return ""; const headers = Object.keys(rows[0]); const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`; return headers.join(',')+'\n'+rows.map(r=>headers.map(h=>esc(r[h])).join(',')).join('\n') }
const download = (filename, text) => { const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000) }

function useAuthUser(){ const [u,setU]=useState(null); useEffect(()=> onAuthStateChanged(auth,setU),[]); return u }
function useUserDoc(uid){
  const [docState, setDocState] = useState(null);
  useEffect(()=>{
    if(!uid){ setDocState(null); return }
    const unsub = onSnapshot(doc(db,'users',uid), s => setDocState(s.exists()? { id: uid, ...s.data() } : null))
    return () => unsub()
  },[uid])
  return docState
}
function useRealtime(date){
  const [requests, setRequests] = useState([]); const [bookings, setBookings] = useState([])
  useEffect(()=>{
    const unsub1 = onSnapshot(query(collection(db,'requests'), where('date','==',date)), s=> setRequests(s.docs.map(d=>({id:d.id, ...d.data()}))))
    const unsub2 = onSnapshot(query(collection(db,'bookings'), where('date','==',date)), s=> setBookings(s.docs.map(d=>({id:d.id, ...d.data()}))))
    return () => {unsub1(); unsub2();}
  },[date])
  return { requests, bookings }
}

// ---- Kapazitäts-Logik ----
function roomById(id){ return ROOMS.find(r=>r.id===id) }
function groupSizeFromMembers(members, includeRequester=true){ const base = members?.filter(Boolean).length || 0; return includeRequester? base+1 : base }
function personCapacityUsed(approvedRequests, groupRequests){
  // Summe Personen in approved Einzel/Gruppe
  let used = 0
  for (const r of approvedRequests){
    if (r.kind === 'einzeln') used += 1
    else used += Math.max(1, (r.groupMembers?.length||0) + 1)
  }
  return used
}
function groupsCapacityUsed(approvedRequests){
  // Jede genehmigte Anfrage (einzeln oder gruppe) nutzt 1 Gruppe
  return approvedRequests.length
}

export default function App(){
  const [tab, setTab] = useState('lernpartner')
  const u = useAuthUser()
  const udoc = useUserDoc(u?.uid) // enthält role: 'learner'|'teacher'|'admin', level: 'beginner'|'advancer'|'master'

  const role = udoc?.role || 'guest'
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header tab={tab} setTab={setTab} u={u} role={role} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab==='lernpartner' && <LernpartnerView u={u} udoc={udoc} />}
        {tab==='lernbegleiter' && (role==='teacher' || role==='admin' ? <LernbegleiterView u={u} /> : <TeacherLogin />)}
        {tab==='admin' && role==='admin' && <AdminPanel />}
        {tab==='info' && <Info />}
      </main>
      <Footer />
    </div>
  )
}

function Header({tab,setTab,u,role}){
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">N</div>
          <div className="font-semibold">NSSG Reservierung</div>
        </div>
        <nav className="flex items-center gap-2">
          {['lernpartner','lernbegleiter','info'].map(k=>(
            <button key={k} onClick={()=>setTab(k)} className={cls("rounded-xl px-4 py-2 text-sm transition", tab===k?"bg-slate-900 text-white shadow":"bg-white text-slate-700 hover:bg-slate-100 border")}>
              {k[0].toUpperCase()+k.slice(1)}
            </button>
          ))}
          {role==='admin' && <button onClick={()=>setTab('admin')} className={cls("rounded-xl px-4 py-2 text-sm transition", tab==='admin'?"bg-slate-900 text-white shadow":"bg-white text-slate-700 hover:bg-slate-100 border")}>Admin</button>}
          {u && <button onClick={()=>signOut(auth)} className="ml-2 rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Abmelden</button>}
        </nav>
      </div>
    </header>
  )
}
function Footer(){
  return (
    <footer className="mt-10 border-t bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} NSSG · Raumreservierung</span>
        <span>Vorschau-Deploy: Vercel (dist)</span>
      </div>
    </footer>
  )
}

// ---- Lernpartner View (mit Auto-Approval für Advancer/Master, Kapazität) ----
function LernpartnerView({u, udoc}){
  const [date, setDate] = useState(todayISO())
  const [roomId, setRoomId] = useState(ROOMS[0].id)
  const [slotSel, setSlotSel] = useState([])
  const [kind, setKind] = useState('einzeln')
  const [reason, setReason] = useState('')
  const [task, setTask] = useState('')
  const [groupMembers, setGroupMembers] = useState('') // Namen
  const [groupEmails, setGroupEmails] = useState('')   # noqa
  const [teacherId, setTeacherId] = useState(LEHRKRAEFTE[0].id)
  const [learnerName, setLearnerName] = useState('')
  const [msg, setMsg] = useState(null)
  const { requests, bookings } = useRealtime(date)

  const myRequestsToday = useMemo(()=> (u ? requests.filter(r=>r.uid===u.uid) : requests.filter(r=>r.learnerName===learnerName)), [requests,u,learnerName])
  const toggleSlot = (s)=> setSlotSel(p=> p.includes(s)? p.filter(x=>x!==s) : (p.length<2?[...p,s]:p))

  async function enablePush(){
    if (!u){ alert('Bitte zuerst einloggen.'); return }
    if (!messaging){ alert('Push wird vom Browser nicht unterstützt.'); return }
    const permission = await Notification.requestPermission()
    if (permission!=='granted'){ alert('Benachrichtigungen verweigert'); return }
    const token = await getToken(messaging, { vapidKey: config.vapidKey })
    if (!token){ alert('Kein Token erhalten'); return }
    await setDoc(doc(db,'users',u.uid), { fcmTokens: { [token]: true } }, { merge: true })
    alert('Push aktiviert 👍')
  }

  function capacityOkForSlot(slot, requestSize){
    const room = roomById(roomId)
    // teacher bookings block whole room
    const hasBooking = bookings.some(b=> b.roomId===roomId && b.slot===slot)
    if (hasBooking) return false
    const approvedHere = requests.filter(r=> r.roomId===roomId && r.slot===slot && r.status==='approved')
    if (room.capacityType === 'persons'){
      const used = personCapacityUsed(approvedHere)
      return (used + requestSize) <= (room.capacityPersons||0)
    } else {
      // groups capacity
      const used = groupsCapacityUsed(approvedHere)
      return (used + 1) <= (room.capacityGroups||0) && requestSize <= (room.perGroupPersons||0)
    }
  }

  async function fetchLevelsByEmails(emails){
    const clean = emails.map(e=>e.trim()).filter(Boolean)
    if (clean.length===0) return []
    // Firestore 'in' supports up to 10 values
    const chunks = [clean.slice(0,10)]
    const results = []
    for (const arr of chunks){
      const q = query(collection(db,'users'), where('email','in', arr))
      const snap = await getDocs(q)
      for (const d of snap.docs){ results.push(d.data().level || 'beginner') }
    }
    // unknown emails -> treat as beginner
    const missing = clean.length - results.length
    for (let i=0;i<missing;i++) results.push('beginner')
    return results
  }

  async function submit(){
    if (!learnerName.trim()) return setMsg({type:'error',text:'Bitte Name angeben.'})
    if (!slotSel.length) return setMsg({type:'error',text:'Mindestens einen Zeitslot wählen (max. 2).'})
    if (!reason.trim() || !task.trim()) return setMsg({type:'error',text:'Grund und Aufgabenstellung ausfüllen.'})
    if (kind==='gruppe' && !groupMembers.trim()) return setMsg({type:'error',text:'Bitte Gruppenmitglieder angeben.'})
    if (myRequestsToday.length + slotSel.length > 2) return setMsg({type:'error',text:'Maximal 2 Slots pro Tag.'})

    const requesterLevel = (udoc?.level || 'beginner').toLowerCase()
    const size = kind==='einzeln' ? 1 : Math.max(1, groupMembers.split(',').map(x=>x.trim()).filter(Boolean).length + 1)

    // For groups, check member levels via emails if provided
    let allAdvanced = requesterLevel!=='beginner'
    if (kind==='gruppe'){
      const emails = groupEmails.split(',').map(x=>x.trim()).filter(Boolean)
      const levels = await fetchLevelsByEmails(emails)
      allAdvanced = allAdvanced && levels.every(l => (l||'beginner')!=='beginner')
    }

    for (const s of slotSel){
      const capOK = capacityOkForSlot(s, size)
      if (!capOK) { setMsg({type:'error',text:`Kapazität überschritten oder belegt für Slot ${s}.`}); return }
    }

    const autoApprove = (kind==='einzeln' && requesterLevel!=='beginner') || (kind==='gruppe' && allAdvanced)
    for (const s of slotSel){
      await addDoc(collection(db,'requests'),{
        date, slot:s, roomId, uid: u?.uid || null, email: u?.email || null,
        learnerName: learnerName.trim(), kind, reason: reason.trim(), task: task.trim(),
        groupMembers: kind==='gruppe'? groupMembers.split(',').map(x=>x.trim()).filter(Boolean):[],
        groupEmails: kind==='gruppe'? groupEmails.split(',').map(x=>x.trim()).filter(Boolean):[],
        teacherId, status: autoApprove ? 'approved' : 'pending', createdAt: serverTimestamp(),
      })
    }
    setMsg({type:'success', text: autoApprove ? 'Direkt gebucht ✅' : 'Anfrage gesendet (Warten auf Bestätigung).'}); setSlotSel([])
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Raumanfrage stellen</h2>
        {u && <div className="mb-3"><button onClick={enablePush} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">🔔 Push‑Benachrichtigungen aktivieren</button></div>}
        <div className="grid gap-4">
          <div className="grid gap-2"><label className="text-sm">Name</label><input value={learnerName} onChange={e=>setLearnerName(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Vor- und Nachname" /></div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-2"><label className="text-sm">Datum</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded-xl border px-3 py-2" /></div>
            <div className="grid gap-2"><label className="text-sm">Raum</label><select value={roomId} onChange={e=>setRoomId(e.target.value)} className="rounded-xl border px-3 py-2">{ROOMS.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div className="grid gap-2"><label className="text-sm">Lehrkraft</label><select value={teacherId} onChange={e=>setTeacherId(e.target.value)} className="rounded-xl border px-3 py-2">{LEHRKRAEFTE.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">{TIME_SLOTS.map(s=>(
            <button key={s} onClick={()=>toggleSlot(s)} className={cls("rounded-xl border px-3 py-2 text-sm text-left", slotSel.includes(s)?"bg-slate-900 text-white":"bg-white hover:bg-slate-50")}>{s}</button>
          ))}</div>
          <div className="text-xs text-slate-500">Maximal 2 Zeitslots pro Tag</div>
          <div className="flex gap-2">
            <button className={cls("rounded-xl px-3 py-2 text-sm border", kind==='einzeln'?"bg-slate-900 text-white":"bg-white")} onClick={()=>setKind('einzeln')}>Einzeln</button>
            <button className={cls("rounded-xl px-3 py-2 text-sm border", kind==='gruppe'?"bg-slate-900 text-white":"bg-white")} onClick={()=>setKind('gruppe')}>Gruppe</button>
          </div>
          <div className="grid gap-2"><label className="text-sm">Grund</label><input value={reason} onChange={e=>setReason(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="z.B. konzentriertes Arbeiten" /></div>
          <div className="grid gap-2"><label className="text-sm">Aufgabenstellung</label><textarea value={task} onChange={e=>setTask(e.target.value)} className="rounded-xl border px-3 py-2" rows="3" placeholder="Was willst du bearbeiten?" /></div>
          {kind==='gruppe' && (<>
            <div className="grid gap-2"><label className="text-sm">Mit wem (Namen, Komma-getrennt)</label><input value={groupMembers} onChange={e=>setGroupMembers(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Name1, Name2, ..." /></div>
            <div className="grid gap-2"><label className="text-sm">E‑Mails der Gruppenmitglieder (optional, Komma-getrennt) – für Auto‑Freigabe</label><input value={groupEmails} onChange={e=>setGroupEmails(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="a@nssg.ch, b@nssg.ch, ..." /></div>
          </>)}
          {msg && (<div className={cls("rounded-xl px-3 py-2 text-sm", msg.type==='error'?"bg-red-50 text-red-700 border border-red-200":"bg-emerald-50 text-emerald-700 border border-emerald-200")}>{msg.text}</div>)}
          <button onClick={submit} className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-2 text-white shadow hover:shadow-md">{(udoc?.level||'beginner')!=='beginner' ? 'Buchen / Anfragen' : 'Anfrage senden'}</button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Kalenderansicht (Lesen)</h2>
        <CalendarGrid date={date} roomId={roomId} />
      </section>
    </div>
  )
}

function TeacherLogin(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState(null)
  async function submit(){ setErr(null); try { await signInWithEmailAndPassword(auth,email,password) } catch(e){ setErr("Login fehlgeschlagen.") } }
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Anmeldung (Lernbegleiter)</h2>
      <div className="grid gap-3">
        <input className="rounded-xl border px-3 py-2" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder="Passwort" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <button onClick={submit} className="rounded-xl bg-slate-900 px-4 py-2 text-white">Anmelden</button>
      </div>
    </div>
  )
}

function LernbegleiterView({u}){
  const [date,setDate]=useState(todayISO()); const [roomId,setRoomId]=useState(ROOMS[0].id)
  const { requests, bookings } = useRealtime(date)
  const pending = useMemo(()=> requests.filter(r=> r.status==='pending'), [requests])

  async function decide(id, status){ await setDoc(doc(db,'requests',id), { status }, { merge:true }) }
  async function createBooking(slot){
    const title = window.prompt("Titel/Grundlage für Eintrag")
    if(!title) return
    await addDoc(collection(db,'bookings'),{ date, slot, roomId, title, createdAt: serverTimestamp(), createdBy: u?.uid || null })
  }
  async function removeBooking(id){ await deleteDoc(doc(db,'bookings',id)) }

  function exportCSV(scope='day'){
    const rows=[]; const addReq=r=>rows.push({type:'request',status:r.status,date:r.date,slot:r.slot,room:ROOMS.find(x=>x.id===r.roomId)?.name||r.roomId,learner:r.learnerName,kind:r.kind,group:(r.groupMembers||[]).join(';'),reason:r.reason,task:r.task,teacher:r.teacherId})
    const addBook=b=>rows.push({type:'booking',status:'fixed',date:b.date,slot:b.slot,room:ROOMS.find(x=>x.id===b.roomId)?.name||b.roomId,learner:'-',kind:'-',group:'-',reason:b.title,task:'-',teacher:b.createdBy})
    if(scope==='day'){ requests.filter(r=>r.date===date).forEach(addReq); bookings.filter(b=>b.date===date).forEach(addBook); download(`export_${date}.csv`, toCSV(rows)) }
    else { const start=new Date(date); for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10); requests.filter(r=>r.date===iso).forEach(addReq); bookings.filter(b=>b.date===iso).forEach(addBook) } download(`export_week_from_${date}.csv`, toCSV(rows)) }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Offene Anfragen</h2>
        </div>
        <div className="grid gap-3">
          {pending.length===0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Keine offenen Anfragen.</div>}
          {pending.map(r=>(
            <div key={r.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{r.learnerName} · {r.kind==='gruppe'?'Gruppe':'Einzeln'}</div>
                  <div className="text-sm text-slate-600">{r.date} · {r.slot} · {ROOMS.find(x=>x.id===r.roomId)?.name}</div>
                  <div className="mt-1 text-sm text-slate-700">Grund: {r.reason}</div>
                  <div className="text-sm text-slate-700">Aufgabe: {r.task}</div>
                  {r.kind==='gruppe' && r.groupMembers?.length>0 && <div className="text-xs text-slate-500">Mit: {r.groupMembers.join(', ')}</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>decide(r.id,'approved')} className="rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700">Genehmigen</button>
                  <button onClick={()=>decide(r.id,'rejected')} className="rounded-xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-700">Ablehnen</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1"><label className="text-sm">Datum</label><input type="date" className="rounded-xl border px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} /></div>
          <div className="grid gap-1"><label className="text-sm">Raum</label><select value={roomId} onChange={e=>setRoomId(e.target.value)} className="rounded-xl border px-3 py-2">{ROOMS.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div className="ml-auto flex gap-2"><button onClick={()=>exportCSV('day')} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">CSV (Tag)</button><button onClick={()=>exportCSV('week')} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">CSV (Woche)</button></div>
        </div>
        <CalendarGrid date={date} roomId={roomId} />
      </section>
    </div>
  )
}

// ---- Kalender ----
function CalendarGrid({date, roomId}){
  const { requests, bookings } = useRealtime(date)
  const approved = requests.filter(r=>r.roomId===roomId && r.status==='approved')
  const pending = requests.filter(r=>r.roomId===roomId && r.status==='pending')
  const fixed = bookings.filter(b=>b.roomId===roomId)

  const slotStatus = (slot)=> {
    const b = fixed.find(x=>x.slot===slot); if (b) return {type:'booking', item:b}
    const a = approved.find(x=>x.slot===slot); if (a) return {type:'approved', item:a}
    const p = pending.find(x=>x.slot===slot); if (p) return {type:'pending', item:p}
    return {type:'free', item:null}
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm text-slate-600">Kalender für <span className="font-medium">{roomById(roomId)?.name}</span> am <span className="font-medium">{date}</span></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TIME_SLOTS.map(s=>{
          const st = slotStatus(s)
          return (
            <div key={s} className={cls("rounded-xl border p-3", st.type==='free'?"bg-white": st.type==='booking'?"bg-slate-900 text-white": st.type==='approved'?"bg-emerald-50 border-emerald-200":"bg-amber-50 border-amber-200")}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{s}</span>
              </div>
              {st.type==='free' && <div className="text-xs text-slate-500">Frei</div>}
              {st.type==='booking' && <div className="text-sm font-medium">Fix: {st.item.title}</div>}
              {st.type==='approved' && <div><div className="text-sm font-medium">Genehmigt: {st.item.learnerName}</div></div>}
              {st.type==='pending' && <div><div className="text-sm font-medium">Anfrage: {st.item.learnerName}</div><div className="text-xs opacity-80">Status: ausstehend</div></div>}
            </div>
          )
        })}
      </div>
      <div className="text-xs text-slate-500">Legende: Fixe Einträge (dunkel), genehmigt (grün), ausstehend (gelb).</div>
    </div>
  )
}

// ---- Admin Panel: Rollen (level) setzen ----
function AdminPanel(){
  const [email, setEmail] = useState('')
  const [level, setLevel] = useState('beginner')
  const [status, setStatus] = useState(null)

  async function save(){
    setStatus(null)
    try {
      // Suche Nutzer per E-Mail
      const q = query(collection(db,'users'), where('email','==', email.trim()))
      const snap = await getDocs(q)
      if (snap.empty){ setStatus('Kein Nutzer mit dieser E‑Mail gefunden. (Nutzer muss sich mindestens einmal eingeloggt haben oder per Seed angelegt werden.)'); return }
      const ref = doc(db, 'users', snap.docs[0].id)
      await setDoc(ref, { level }, { merge: true })
      setStatus('Rolle (Level) aktualisiert.')
    } catch (e){
      setStatus('Fehler beim Speichern.')
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm max-w-xl">
      <h2 className="mb-4 text-lg font-semibold">Admin · Lernpartner‑Level ändern</h2>
      <div className="grid gap-3">
        <input className="rounded-xl border px-3 py-2" placeholder="E‑Mail des Lernpartners" value={email} onChange={e=>setEmail(e.target.value)} />
        <div className="flex gap-2">
          {['beginner','advancer','master'].map(l=>(
            <button key={l} onClick={()=>setLevel(l)} className={cls("rounded-xl px-3 py-2 text-sm border", level===l?"bg-slate-900 text-white":"bg-white")}>{l}</button>
          ))}
        </div>
        <button onClick={save} className="rounded-xl bg-slate-900 px-4 py-2 text-white">Speichern</button>
        {status && <div className="text-sm text-slate-700">{status}</div>}
      </div>
      <p className="mt-3 text-xs text-slate-500">Hinweis: Standard ist <b>beginner</b>. Nur <b>advancer</b> & <b>master</b> können – sofern Kapazität frei ist – <b>ohne Bestätigung</b> buchen. Wenn in einer Gruppe <b>mindestens ein Beginner</b> ist (oder unbekannt), ist eine Bestätigung nötig.</p>
    </section>
  )
}

function Info(){
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">Info</h2>
      <ul className="ml-5 list-disc space-y-1 text-sm text-slate-700">
        <li>Räume & Kapazitäten: Coaching/Meeting/TTL/TTR/Input R/Input L (je 4 Personen); Welcome 2 (2×4), Welcome 1 (4), Cafeteria (2×4), Terrasse (3×4).</li>
        <li>Level: <b>beginner</b> (Standard), <b>advancer</b>, <b>master</b>. Admin kann Level im Admin‑Tab ändern.</li>
        <li>Auto‑Freigabe: Advancer/Master (Einzel) → direkt, sofern Kapazität frei. Gruppen: nur direkt, wenn alle Mitglieder Advancer/Master sind (per E‑Mail geprüft), sonst Anfrage.</li>
        <li>Lehrkraft‑Buchungen blockieren den Slot vollständig.</li>
      </ul>
    </div>
  )
}
