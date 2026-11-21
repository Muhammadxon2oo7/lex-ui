// Voice coverage: does every line the student will hear come back as audio? (court backend directly, no key needed)
// Usage: node tools/qa/voice-coverage.mjs [tools/voice/lines.json]    REMOTE=https://lex-api.e-investment.uz/api/v1
// Goal: FAIL 0 everywhere; court lines and case lines all 'hit' (pre-rendered).
import { readFileSync } from 'node:fs';
const B=process.env.REMOTE ?? 'https://lex-api.e-investment.uz/api/v1'; let cookie='';
const call=async(p,b)=>{const r=await fetch(B+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:b?JSON.stringify(b):undefined});const sc=r.headers.getSetCookie?.()??[];if(sc.length)cookie=sc.map(c=>c.split(';')[0]).join('; ');return r.json().catch(()=>null)};
const V={judge:'elder_m',secretary:'female',opponent:'female_alt',witness:'male',expert:'male'};
// one student asking for many lines hits the per-student limit: wait as the server asks (Retry-After), then ask again
const tts=async(text,voice)=>{for(let k=0;k<6;k++){const t=Date.now();const r=await fetch(B+'/voice/tts',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({text,voice})});await r.arrayBuffer();if(r.status!==429)return {s:r.status,hit:r.headers.get('x-tts-cache'),ms:Date.now()-t};limited++;await new Promise(z=>setTimeout(z,1000*Math.min(30,Number(r.headers.get('retry-after'))||5)));}return {s:429,hit:null,ms:0}};
let limited=0;
const lines=new Map();
for (const [sc,texts] of [['sud-ijara-davogar',[
 'Hurmatli sud, vakolatimni tasdiqlovchi ishonchnomani taqdim etaman.','Hurmatli sud, rad bildirmaymiz.','Hurmatli sud, huquqlarimiz tushunarli.','Hurmatli sud, iltimosnomamiz yoʻq.','Hurmatli sud, javobgar qarzdor.',
 'Hurmatli sud, daʼvo talablarini toʻliq quvvatlaymiz: 32-P-sonli ijara shartnomasi boʻyicha javobgar ijara haqini toʻlamagan, qarzni va shartnomadagi penyani undirishni soʻraymiz.',
 'Hurmatli sud, javobgar vakilidan soʻramoqchiman: obyektdan qancha muddat foydalandingiz?','Hurmatli sud, guvohni chaqirishni soʻrab iltimosnoma beraman.','Hurmatli sud, ishni keyinga qoldirishni soʻrayman.','Hurmatli sud, kelishuv bitimi tuzishni taklif qilamiz.',
 'Hurmatli sud, javobgar hisob-fakturalarni imzolagan, bu obyekt topshirilganini tasdiqlaydi.','Hurmatli sud, qoʻshimcha materiallarimiz yoʻq.','Hurmatli sud, daʼvoni toʻliq qanoatlantirishni soʻraymiz.']],
 ['sud-ijara-javobgar',['Hurmatli sud, vakolatimni tasdiqlovchi ishonchnomani taqdim etaman.','Hurmatli sud, rad bildirmaymiz.','Hurmatli sud, huquqlarimiz tushunarli.','Hurmatli sud, iltimosnomamiz yoʻq.','Hurmatli sud, daʼvoni tan olmaymiz, obyekt dalolatnoma bilan topshirilmagan.','Hurmatli sud, penyani kamaytirishni soʻraymiz.','Hurmatli sud, qoʻshimcha materiallarimiz yoʻq.','Hurmatli sud, daʼvoni rad etishni soʻraymiz.']]]) {
  cookie=''; const s=await call('/sessions',{scenarioId:sc,mode:'tutorial',level:'beginner'}); const id=s.snapshot.sessionId;
  for(const a of ['start','sit-at-desk','stand']) await call(`/sessions/${id}/interactions`,{clientActionId:crypto.randomUUID(),action:a});
  for(const t of texts){ await call(`/sessions/${id}/turns`,{clientTurnId:crypto.randomUUID(),text:t,inputMode:'text'}); }
  const snap=(await call(`/sessions/${id}`)).snapshot;
  for(const t of snap.turns) if(t.speaker==='npc'&&t.role) lines.set(V[t.role]+'\n'+t.text,{voice:V[t.role],text:t.text,role:t.role});
}
let hit=0,miss=0,fail=0; const bad=[];
for(const l of lines.values()){const r=await tts(l.text,l.voice); if(r.s!==200){fail++;bad.push(`[${l.role}] ${l.text.slice(0,90)}`)} else if(r.hit==='hit') hit++; else miss++;}
console.log('court lines',lines.size,'hit',hit,'miss(ok,rendered)',miss,'FAIL',fail); bad.slice(0,12).forEach(b=>console.log('  ✗',b));
const L=JSON.parse(readFileSync(process.argv[2] ?? 'tools/voice/lines.json','utf8')); const arr=Array.isArray(L)?L:L.items??L.lines;
let h2=0,f2=0; const bad2=[]; const codes={}; for(const l of arr){const r=await tts(l.text,l.voice); codes[r.s]=(codes[r.s]??0)+1; if(r.s!==200){f2++; bad2.push(`[${l.voice}] ${l.text.slice(0,90)}`)} else if(r.hit==='hit')h2++;}
console.log('case lines',arr.length,'hit',h2,'FAIL',f2,'status codes',JSON.stringify(codes),'rate-limited waits',limited);
bad2.slice(0,12).forEach(b=>console.log('  ✗',b));
