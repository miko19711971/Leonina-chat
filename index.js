 // index.js — Guest Assistant (Via Leonina 71) — EN + Samantha voice

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (logo, favicon, etc.) from repo root
app.use(express.static('.'));

// ---------- Apartment data (Via Leonina 71) ----------
const apartment = {
  apartment_id: 'LEONINA71',
  name: 'Via Leonina 71',
  address: 'Via Leonina 71, Rome, Italy',
  checkin_time: '15:00',
  checkout_time: '11:00',

  // Wi‑Fi
  wifi_note:
    'Router on the table. Turn it around to see the SSID and password on the label.',
  wifi_ssid: 'See router label',
  wifi_password: 'See router label',

  // Inside the apartment / Water / AC / Bathroom / Towels / Lighting
  water_note:
    'Tap water is safe to drink. Hot water is always available. Important: please do NOT touch the switch on the left side of the bathroom mirror (it controls the hot water system).',
  ac_note:
    'Air conditioning is available. Please turn it OFF when you leave the apartment.',
  bathroom_amenities:
    'Hairdryer, bath mat, toilet paper, hand soap.',
  towels_note:
    'Per guest: 1 large towel + 1 medium towel + 1 small towel. Beds are prepared on arrival.',
  lighting_note:
    'Kitchen lights: switch on the right side of the stairs (facing the kitchen). Terrace lights: switch inside the apartment on the right before exiting to the terrace.',

  // Kitchen / Safety devices (electric)
  kitchen_note:
    'Kitchen is fully equipped. There is an electric hot plate: ALWAYS switch it off after use and never leave pots/pans unattended.',
  
  // Terrace / Safety
  terrace_note:
    'If you open the terrace umbrella, TIE it to the railing. Always close and untie it before leaving the apartment.',
  plants_note:
    'If you like, you may water the plants once a day (except cacti).',

  // Building & Access
  front_door_access:
    'Use the long key with the square end; pull the heavy door toward you and turn the key counter‑clockwise to open.',
  building_code:
    'Main door code (alternative to round key): 7171 + key symbol.',
  intercom_note: '—',

  // Assistance
  host_phone: '+39 335 5245756',

  // Services nearby
  supermarkets:
    'Carrefour Express (Via Urbana) • Mini‑markets on Via Leonina.',
  pharmacies:
    'Farmacia Cavour (Via Cavour 84) • Pharmacy on Via Panisperna 40.',
  atms:
    'BNL ATM (Via Cavour 84) • UniCredit ATM (Piazza della Suburra 5).',
  laundry:
    'Wash & Dry Laundromat — Via Cavour 194 (self‑service).',
  luggage:
    'Radical Storage locations around Termini and Largo Argentina (book online).',
  sims:
    'Iliad — Via Cavour 196 • TIM/Vodafone — Via Nazionale.',

  // Transport
  transport:
    'Metro B — Cavour station (≈5 min walk). Bus lines 75, 117, 84 on Via Cavour. Walking is ideal around Monti.',
  airports:
    'Fiumicino: Metro B Cavour → Termini → Leonardo Express (32 min) or FL1 from Trastevere. Ciampino: bus to Termini → Metro B Cavour. Private transfer: Welcome Pickups.',
  taxi: 'Radio Taxi +39 06 3570 (or use FreeNow app).',

  // Safety & useful numbers
  emergency:
    'EU Emergency 112 • Police 113 • Ambulance 118 • Fire 115 • English‑speaking doctor +39 06 488 2371 • 24h vet +39 06 660 681',

  // Eat / Drink / Shop
  eat: [
    'La Carbonara',
    'Ai Tre Scalini',
    'Trattoria Vecchia Roma',
    'Fafiuche Wine Bar',
    'Al42 by Pasta Chef Monti',
    'Broccoletti',
    'Cuoco e Camicia'
  ].join(' • '),

  drink:
    'VinoRoma Wine Studio • La Bottega del Caffè (Piazza Madonna dei Monti) • Spritzeria Monti • Blackmarket Hall.',
  shop:
    'Mercato Monti Vintage Market (Via Leonina 46, weekends) • Via Urbana & Via del Boschetto boutiques • Panisperna Libreria • Artisan leather & design stores in Monti.',

  // What to visit
  visit:
    'Piazza Madonna dei Monti • Santa Maria ai Monti • San Martino ai Monti • San Pietro in Vincoli (Michelangelo’s Moses) • Colle Oppio Park & Domus Aurea • Trajan’s Market & Forum.',

  // Hidden gems (Monti)
  hidden_gems:
    'Sotterranei di San Martino ai Monti (guided tours) • Basilica di Santa Prassede (Chapel of St. Zeno) • Scalinata dei Borgia • Ancient Suburra streets (Via Cavour/Leonina/Panisperna) • Roman houses beneath Santa Pudenziana.',

  // Experiences & walks
  experiences:
    'Aperitivo in Piazza Madonna dei Monti • Vintage browsing at Mercato Monti (weekends) • Rooftop/terrace photos at sunset • Stroll Via Urbana & Via dei Serpenti • Evening walk past the Roman Forum and Piazza Venezia.',
  romantic_walk:
    'Start Via Leonina 71 → Colosseum → Arch of Constantine (photo) → Via dei Fori Imperiali → Piazza del Campidoglio (view) → Fatamorgana Monti gelato → La Bottega del Caffè (piazza) → back to Via Leonina 71.',

  // Check‑in / Check‑out
  checkin_access:
    'Front door: {front_door_access}. Building: code 7171 + key symbol if you prefer not to use the round key.',
  checkout_note:
    'Before leaving: turn off lights/AC, close windows, leave keys on the table, gently close the door.'
};

// ---------- FAQ (keyword → template) ----------
const faqs = [
  { intent: 'wifi', utterances: ['wifi','wi-fi','internet','password','router'],
    answer_template: `Wi‑Fi: {wifi_note}\nNetwork: {wifi_ssid}. Password: {wifi_password}.` },

  { intent: 'check in', utterances: ['check in','arrival','access','entrance','door','front door','building','code','intercom'],
    answer_template: `Check‑in from {checkin_time}.\nAccess: {front_door_access}\nBuilding code: {building_code}\nNeed help? Call {host_phone}.` },

  { intent: 'check out', utterances: ['check out','leave','departure'],
    answer_template: `{checkout_note}` },

  { intent: 'water', utterances: ['water','hot water','drinkable','tap','mirror switch','boiler'],
    answer_template: `{water_note}` },

  { intent: 'ac', utterances: ['ac','air conditioning','aircon','air conditioner'],
    answer_template: `{ac_note}` },

  { intent: 'bathroom', utterances: ['bathroom','hairdryer','soap','towels','amenities'],
    answer_template: `Bathroom: {bathroom_amenities}\nTowels: {towels_note}` },

  { intent: 'kitchen', utterances: ['kitchen','cook','cooking','stove','hot plate'],
    answer_template: `{kitchen_note}` },

  { intent: 'terrace', utterances: ['terrace','umbrella','plants','balcony','light'],
    answer_template: `Terrace: {terrace_note}\nPlants: {plants_note}\nLights: {lighting_note}` },

  { intent: 'services', utterances: ['pharmacy','hospital','atm','sim','laundry','luggage','supermarket','groceries'],
    answer_template:
`Supermarkets: {supermarkets}
Pharmacies: {pharmacies}
ATMs: {atms}
Laundry: {laundry}
Luggage storage: {luggage}
SIMs: {sims}` },

  { intent: 'transport', utterances: ['transport','tram','bus','taxi','airport','train','metro'],
    answer_template: `{transport}\nAirports: {airports}\nTaxi: {taxi}` },

  { intent: 'eat', utterances: ['eat','restaurant','dinner','lunch','food'],
    answer_template: `{eat}` },

  { intent: 'drink', utterances: ['drink','bar','wine','cocktail','aperitivo'],
    answer_template: `{drink}` },

  { intent: 'shop', utterances: ['shop','market','shopping','boutique','vintage'],
    answer_template: `{shop}` },

  { intent: 'visit', utterances: ['what to visit','see','sight','attraction','museum','moses','domus aurea'],
    answer_template: `{visit}` },

  { intent: 'hidden gems', utterances: ['hidden','secret','gem','less-known','underground','suburra','pudenziana'],
    answer_template: `{hidden_gems}` },

  { intent: 'experience', utterances: ['experience','walk','tour','itinerary','sunset','romantic'],
    answer_template: `{experiences}\nRomantic route: {romantic_walk}` },

  { intent: 'day trips', utterances: ['day trip','tivoli','ostia','castelli','excursion'],
    answer_template: `Ostia Antica (~40 min) • Tivoli (Villa d’Este & Hadrian’s Villa ~1h) • Castelli Romani (Frascati/Castel Gandolfo).` },

  { intent: 'emergency', utterances: ['emergency','police','ambulance','fire','doctor','vet','help'],
    answer_template: `{emergency}` }
];

// ---------- OpenAI polish (force EN) ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function detectIntent(msg){
  const t = norm(msg); let best=null, scoreBest=0;
  for (const f of faqs){
    let s=0;
    for (const u of f.utterances){ if (t.includes(norm(u))) s++; }
    if (s>scoreBest){ best=f; scoreBest=s; }
  }
  return scoreBest>0 ? best : null;
}
function fill(tpl, obj){ return tpl.replace(/\{(\w+)\}/g,(_,k)=>obj[k] ?? `{${k}}`); }

async function polishEN(raw, userMsg){
  if (!client) return raw;
  const sys = 'You are a concise hotel/apartment assistant. ALWAYS answer in clear English. Keep facts as given; do not invent. Max ~120 words unless steps are needed.';
  try{
    const r = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role:'system', content: sys },
        { role:'developer', content: `Apartment data: ${JSON.stringify(apartment)}` },
        { role:'user', content: `Guest asked: ${userMsg}\nDraft answer:\n${raw}` }
      ]
    });
    return r.output_text || raw;
  }catch{
    return raw;
  }
}

// ---------- API ----------
app.post('/api/message', async (req,res)=>{
  const { message='' } = req.body || {};
  const m = detectIntent(message);
  let raw = m ? fill(m.answer_template, apartment)
              : 'I did not find a direct answer. Please use a quick button (wifi, check in, transport, eat, visit…).';
  const text = await polishEN(raw, message);
  res.json({ text, intent: m?.intent || null });
});

// ---------- UI (single file) ----------
app.get('/', (_req,res)=>{
  const buttons = [
    'wifi','check in','check out','water','AC','bathroom','kitchen','terrace',
    'eat','drink','shop','visit','hidden gems','experience','day trips',
    'transport','services','emergency'
  ];
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guest Help — Via Leonina 71</title>
<link rel="icon" type="image/png" href="logo-niceflatinrome.jpg">
<style>
*{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f6}
.wrap{max-width:760px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #e0e0e0;padding:10px 14px}
.h-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.h-left{display:flex;align-items:center;gap:10px}
.brand{font-weight:700;color:#a33}
.apt{margin-left:auto;opacity:.75}
img.logo{height:36px;width:auto;display:block}
.controls{display:flex;gap:8px;margin-top:8px}
#voiceBtn{padding:8px 10px;border:1px solid #ddd;background:#fff;border-radius:10px;cursor:pointer;font-size:14px}
#voiceBtn[aria-pressed="true"]{background:#2b2118;color:#fff;border-color:#2b2118}
main{flex:1;padding:12px}
.msg{max-width:85%;line-height:1.35;border-radius:12px;padding:10px 12px;margin:8px 0;white-space:pre-wrap}
.msg.wd{background:#fff;border:1px solid #e0e0e0}
.msg.me{background:#e8f0fe;border:1px solid #c5d5ff;margin-left:auto}
.quick{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.quick button{border:1px solid #d6c5b8;background:#fff;color:#333;padding:6px 10px;border-radius:12px;cursor:pointer}
.quick button:active{transform:translateY(1px)}
footer{position:sticky;bottom:0;background:#fff;display:flex;gap:8px;padding:10px;border-top:1px solid #e0e0e0}
input{flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:10px;outline:none}
#sendBtn{padding:12px 14px;border:1px solid #2b2118;background:#2b2118;color:#fff;border-radius:10px;cursor:pointer}
.welcome{margin:10px 0 0 0; font-size:14px; opacity:.9}
</style></head>
<body>
<div class="wrap">
  <header>
    <div class="h-row">
      <div class="h-left">
        <img class="logo" src="logo-niceflatinrome.jpg" alt="NiceFlatInRome">
        <div class="brand">niceflatinrome.com</div>
      </div>
      <div class="apt">Apartment: LEONINA71</div>
    </div>
    <div class="controls">
      <button id="voiceBtn" aria-pressed="false" title="Toggle voice">🔇 Voice: Off</button>
    </div>
  </header>

  <main id="chat" aria-live="polite"></main>

  <footer>
    <input id="input" placeholder="Type a message… e.g., wifi, transport, eat" autocomplete="off">
    <button id="sendBtn">Send</button>
  </footer>
</div>
<script>
const chatEl = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');

// Voice (Samantha – EN only). Do NOT prepend the name inside the spoken answer.
let voiceOn = false, pick = null;
function pickSamantha(){
  const all = window.speechSynthesis ? (speechSynthesis.getVoices()||[]) : [];
  const en = all.filter(v=>/en-/i.test(v.lang));
  pick = en.find(v=>/samantha/i.test(v.name)) || en[0] || all[0] || null;
}
if ('speechSynthesis' in window){
  pickSamantha(); window.speechSynthesis.onvoiceschanged = pickSamantha;
}
function warm(){ try{ const u=new SpeechSynthesisUtterance('Voice enabled.'); if(pick) u.voice=pick; u.lang='en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} }
function speak(t){ if(!voiceOn||!('speechSynthesis'in window))return; try{ const u=new SpeechSynthesisUtterance(t); if(pick) u.voice=pick; u.lang='en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} }

document.getElementById('voiceBtn').addEventListener('click',e=>{
  voiceOn=!voiceOn; e.currentTarget.setAttribute('aria-pressed',String(voiceOn));
  e.currentTarget.textContent = voiceOn ? '🔊 Voice: On' : '🔇 Voice: Off';
  if (voiceOn) warm();
});

function add(type, txt){
  const d=document.createElement('div');
  d.className='msg '+(type==='me'?'me':'wd');
  d.textContent=txt;
  chatEl.appendChild(d);
  chatEl.scrollTop=chatEl.scrollHeight;
}
function welcome(){
  add('wd','I’m Samantha, your virtual guide. Tap a button to get a quick answer.');
  const q=document.createElement('div'); q.className='quick';
  const items=${JSON.stringify(buttons)};
  for(const it of items){
    const b=document.createElement('button'); b.textContent=it;
    b.onclick=()=>{ input.value=it; send(); };
    q.appendChild(b);
  }
  chatEl.appendChild(q);
}

async function send(){
  const text=(input.value||'').trim(); if(!text) return;
  add('me',text); input.value='';
  try{
    const r=await fetch('/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
    const data=await r.json(); const bot=data.text||'Sorry, something went wrong.';
    add('wd',bot); speak(bot);
  }catch{
    add('wd','Network error. Please try again.');
  }
}
sendBtn.addEventListener('click',send);
input.addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
welcome();
</script>
</body></html>`;
  res.setHeader('content-type','text/html; charset=utf-8');
  res.end(html);
});

// ---------- Start ----------
const port = process.env.PORT || 8787;
app.listen(port, ()=>console.log('Guest assistant up on http://localhost:'+port));
