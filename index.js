// index.js — Guest Assistant (Via Leonina 71) — Multilingual + Native Voices
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // static (logo, favicon)

// ---------------- Base ----------------
const base = {
  apartment_id: 'LEONINA71',
  name: 'Via Leonina 71',
  address: 'Via Leonina 71, Rome, Italy',
  checkin_time: '15:00',
  checkout_time: '11:00',
  host_phone: '+39 335 5245756',
  apt_label: { en:'Apartment', it:'Appartamento', fr:'Appartement', de:'Apartment', es:'Apartamento' }
};

// ---------------- Contenuti localizzati ----------------
const APT_I18N = {
  en: {
    wifi_note: 'Router on the table. Turn it around to see SSID & password on the label.',
    wifi_ssid: 'See router label',
    wifi_password: 'See router label',
    water_note: 'Tap water is safe to drink. Hot water is always available. Important: do NOT touch the switch on the left side of the bathroom mirror (it controls the hot water system).',
    ac_note: 'Air conditioning is available. Please turn it OFF when you leave the apartment.',
    bathroom_amenities: 'Hairdryer, bath mat, toilet paper, hand soap.',
    towels_note: 'Per guest: 1 large + 1 medium + 1 small towel. Beds are prepared on arrival.',
    lighting_note: 'Kitchen lights: switch on the right side of the stairs (facing the kitchen). Terrace lights: switch inside on the right before exiting to the terrace.',
    kitchen_note: 'Kitchen is fully equipped. Electric hot plate: ALWAYS switch it off after use and never leave pots/pans unattended.',
    terrace_note: 'If you open the terrace umbrella, TIE it to the railing. Always close and untie it before leaving the apartment.',
    plants_note: 'If you like, you may water the plants once a day (except cacti).',
    front_door_access: 'Use the long key with the square end; pull the heavy door toward you and turn the key counter-clockwise to open.',
    building_code: '7171 + key symbol',
    intercom_note: '—',
    supermarkets: 'Carrefour Express (Via Urbana) • Mini-markets on Via Leonina.',
    pharmacies: 'Farmacia Cavour (Via Cavour 84) • Pharmacy on Via Panisperna 40.',
    atms: 'BNL ATM (Via Cavour 84) • UniCredit ATM (Piazza della Suburra 5).',
    laundry: 'Wash & Dry Laundromat — Via Cavour 194 (self-service).',
    luggage: 'Radical Storage locations around Termini and Largo Argentina (book online).',
    sims: 'Iliad — Via Cavour 196 • TIM/Vodafone — Via Nazionale.',
    transport: 'Metro B — Cavour station (≈5 min walk). Bus lines 75, 117, 84 on Via Cavour. Walking is ideal around Monti.',
    airports: 'Fiumicino: Metro B Cavour → Termini → Leonardo Express (≈32 min) or FL1 from Trastevere. Ciampino: bus to Termini → Metro B Cavour. Private transfer: Welcome Pickups.',
    taxi: 'Radio Taxi +39 06 3570 or FreeNow app.',
    emergency: 'EU Emergency 112 • Police 113 • Ambulance 118 • Fire 115 • English-speaking doctor +39 06 488 2371 • 24h vet +39 06 660 681',
    eat: 'La Carbonara • Ai Tre Scalini • Trattoria Vecchia Roma • Fafiuche Wine Bar • Al42 by Pasta Chef Monti • Broccoletti • Cuoco e Camicia.',
    drink: 'VinoRoma Wine Studio • La Bottega del Caffè (Piazza Madonna dei Monti) • Spritzeria Monti • Blackmarket Hall.',
    shop: 'Mercato Monti Vintage Market (Via Leonina 46, weekends) • Via Urbana & Via del Boschetto boutiques • Panisperna Libreria • Artisan leather & design stores in Monti.',
    visit: 'Piazza Madonna dei Monti • Santa Maria ai Monti • San Martino ai Monti • San Pietro in Vincoli (Michelangelo’s Moses) • Colle Oppio Park & Domus Aurea • Trajan’s Market & Forum.',
    hidden_gems: 'Sotterranei di San Martino ai Monti (guided tours) • Basilica di Santa Prassede (Chapel of St. Zeno) • Scalinata dei Borgia • Ancient Suburra streets (Via Cavour/Leonina/Panisperna) • Roman houses beneath Santa Pudenziana.',
    experiences: 'Aperitivo in Piazza Madonna dei Monti • Vintage browsing at Mercato Monti (weekends) • Rooftop/terrace photos at sunset • Stroll Via Urbana & Via dei Serpenti • Evening walk past the Roman Forum and Piazza Venezia.',
    romantic_walk: 'Start: Via Leonina 71 → Colosseum → Arch of Constantine → Via dei Fori Imperiali → Piazza del Campidoglio → Fatamorgana Monti gelato → La Bottega del Caffè → back to Via Leonina 71.',
    checkin_access: 'Front door: {front_door_access}. Building: code {building_code} (alternative to round key).',
    checkout_note: 'Before leaving: turn off lights/AC, close windows, leave keys on the table, gently close the door.'
  },
  it: { /* … (tutte le traduzioni come le hai già) … */ },
  fr: { /* … */ },
  de: { /* … */ },
  es: { /* … */ }
};

// ---------------- Template risposte per intent ----------------
const FAQ_TPL = {
  en: {
    wifi: `Wi-Fi: {wifi_note}\nNetwork: {wifi_ssid}. Password: {wifi_password}.`,
    checkin: `Check-in from ${base.checkin_time}.\n{checkin_access}\nNeed help? Call ${base.host_phone}.`,
    checkout: `{checkout_note}`,
    water: `{water_note}`,
    ac: `{ac_note}`,
    bathroom: `Bathroom: {bathroom_amenities}\nTowels: {towels_note}`,
    kitchen: `{kitchen_note}`,
    terrace: `Terrace: {terrace_note}\nPlants: {plants_note}\nLights: {lighting_note}`,
    services: `Supermarkets: {supermarkets}
Pharmacies: {pharmacies}
ATMs: {atms}
Laundry: {laundry}
Luggage: {luggage}
SIMs: {sims}`,
    transport: `{transport}
Airports: {airports}
Taxi: {taxi}`,
    eat:`{eat}`, drink:`{drink}`, shop:`{shop}`, visit:`{visit}`,
    hidden:`{hidden_gems}`,
    experience:`{experiences}\nRomantic route: {romantic_walk}`,
    daytrips:`Day trips: Ostia Antica (~40 min) • Tivoli (Villa d’Este & Hadrian’s Villa ~1h) • Castelli Romani.`,
    emergency:`{emergency}`
  },
  it: { /* … */ }, fr: { /* … */ }, de: { /* … */ }, es: { /* … */ }
};

// ---------------- Intent matching (keyword EN) ----------------
const INTENTS = [
  { key:'wifi', utter:['wifi','wi-fi','internet','password','router'] },
  { key:'checkin', utter:['check in','arrival','access','entrance','door','front door','building','code','intercom'] },
  { key:'checkout', utter:['check out','leave','departure'] },
  { key:'water', utter:['water','hot water','drinkable','tap','mirror switch','boiler'] },
  { key:'ac', utter:['ac','air conditioning','aircon','air conditioner'] },
  { key:'bathroom', utter:['bathroom','hairdryer','soap','towels','amenities'] },
  { key:'kitchen', utter:['kitchen','cook','cooking','stove','hot plate'] },
  { key:'terrace', utter:['terrace','umbrella','plants','balcony','light','lights'] },
  { key:'services', utter:['services','pharmacy','hospital','atm','sim','laundry','luggage','supermarket','groceries'] },
  { key:'transport', utter:['transport','tram','bus','taxi','airport','train','metro'] },
  { key:'eat', utter:['eat','restaurant','dinner','lunch','food'] },
  { key:'drink', utter:['drink','bar','wine','cocktail','aperitivo'] },
  { key:'shop', utter:['shop','market','shopping','boutique','vintage'] },
  { key:'visit', utter:['what to visit','see','sight','attraction','museum','moses','domus aurea'] },
  { key:'hidden', utter:['hidden','secret','gem','less-known','underground','suburra','pudenziana'] },
  { key:'experience', utter:['experience','walk','tour','itinerary','sunset','romantic'] },
  { key:'daytrips', utter:['day trips','day trip','tivoli','ostia','castelli','excursion','excursions'] },
  { key:'emergency', utter:['emergency','police','ambulance','fire','doctor','vet','help'] }
];

function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function detectIntent(msg){
  const t = norm(msg); let best=null, scoreBest=0;
  for (const it of INTENTS){
    let s=0; for (const u of it.utter){ if (t.includes(norm(u))) s++; }
    if (s>scoreBest){ best=it; scoreBest=s; }
  }
  return best?.key || null;
}
function fill(tpl, dict){ return tpl.replace(/\{(\w+)\}/g,(_,k)=>dict[k] ?? `{${k}}`); }

// -------- OpenAI opzionale --------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
async function polishOptional(text, lang){
  if (!client) return text;
  const sys = `You are a helpful assistant. Keep the language as: ${lang}. Do not change facts. Max ~120 words unless steps are needed.`;
  try{
    const r = await client.responses.create({
      model: OPENAI_MODEL,
      input: [{ role:'system', content: sys }, { role:'user', content: text }]
    });
    return r.output_text || text;
  }catch{ return text; }
}

// ---------------- API ----------------
app.post('/api/message', async (req,res)=>{
  const { message='', lang='en' } = req.body || {};
  const L = (APT_I18N[lang] ? lang : 'en');
  const intent = detectIntent(message);

  let out = '';
  if (intent) {
    const tpl = FAQ_TPL[L][intent];
    out = fill(tpl, APT_I18N[L]);
  } else {
    const fallback = {
      en:'I did not find a direct answer. Try a button or use keywords (wifi, check in, kitchen, terrace, transport…).',
      it:'Non ho trovato una risposta diretta. Prova un pulsante o usa parole chiave (wifi, check in, cucina, terrazzo, trasporti…).',
      fr:"Je n’ai pas trouvé de réponse directe. Essayez un bouton ou des mots-clés (wifi, check in, cuisine, terrasse, transports…).",
      de:'Keine direkte Antwort gefunden. Nutze einen Button oder Stichwörter (WLAN, Check-in, Küche, Terrasse, Verkehr…).',
      es:'No encontré una respuesta directa. Prueba un botón o usa palabras clave (wifi, check in, cocina, terraza, transporte…).'
    }[L];
    out = fallback;
  }
  const text = await polishOptional(out, L);
  res.json({ text, intent });
});

// ---------------- UI (single file) ----------------
app.get('/', (_req,res)=>{
  const BUTTON_KEYS = [
    'wifi','check in','check out','water','AC','bathroom','kitchen','terrace',
    'eat','drink','shop','visit','hidden gems','experience','day trips',
    'transport','services','emergency'
  ];

  const UI_I18N = {
    en:{ welcome:'Hi, I am Samantha, your virtual guide. Tap a button to get a quick answer.',
         placeholder:'Hi, I am Samantha, your virtual guide. Tap a button for a quick answer — or type here…',
         buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'water','AC':'AC','bathroom':'bathroom','kitchen':'kitchen','terrace':'terrace',
           eat:'eat', drink:'drink', shop:'shop', visit:'visit', 'hidden gems':'hidden gems', experience:'experience', 'day trips':'day trips',
           transport:'transport', services:'services', emergency:'emergency' },
         voice_on:'🔊 Voice: On', voice_off:'🔇 Voice: Off', apt_label: base.apt_label.en },
    it:{ welcome:'Ciao, sono Samantha, la tua guida virtuale. Tocca un pulsante per una risposta rapida.',
         placeholder:'Ciao, sono Samantha, la tua guida virtuale. Tocca un pulsante — oppure scrivi qui…',
         buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'acqua','AC':'aria condizionata','bathroom':'bagno','kitchen':'cucina','terrace':'terrazzo',
           eat:'mangiare', drink:'bere', shop:'shopping', visit:'visitare', 'hidden gems':'gemme nascoste', experience:'esperienze', 'day trips':'gite di un giorno',
           transport:'trasporti', services:'servizi', emergency:'emergenza' },
         voice_on:'🔊 Voce: On', voice_off:'🔇 Voce: Off', apt_label: base.apt_label.it },
    fr:{ welcome:'Bonjour, je suis Samantha, votre guide virtuel. Touchez un bouton pour une réponse rapide.',
         placeholder:'Bonjour, je suis Samantha, votre guide virtuel. Touchez un bouton — ou écrivez ici…',
         buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'eau','AC':'climatisation','bathroom':'salle de bain','kitchen':'cuisine','terrace':'terrasse',
           eat:'manger', drink:'boire', shop:'shopping', visit:'visiter', 'hidden gems':'trésors cachés', experience:'expériences', 'day trips':'excursions',
           transport:'transports', services:'services', emergency:'urgence' },
         voice_on:'🔊 Voix : Activée', voice_off:'🔇 Voix : Désactivée', apt_label: base.apt_label.fr },
    de:{ welcome:'Hallo, ich bin Samantha, dein virtueller Guide. Tippe auf einen Button für eine schnelle Antwort.',
         placeholder:'Hallo, ich bin Samantha, dein virtueller Guide. Tippe auf einen Button — oder schreibe hier…',
         buttons:{ wifi:'WLAN','check in':'check in','check out':'check out','water':'Wasser','AC':'Klimaanlage','bathroom':'Bad','kitchen':'Küche','terrace':'Terrasse',
           eat:'Essen', drink:'Trinken', shop:'Shopping', visit:'Sehenswürdigkeiten', 'hidden gems':'versteckte Juwelen', experience:'Erlebnisse', 'day trips':'Tagesausflüge',
           transport:'Verkehr', services:'Services', emergency:'Notfall' },
         voice_on:'🔊 Stimme: An', voice_off:'🔇 Stimme: Aus', apt_label: base.apt_label.de },
    es:{ welcome:'Hola, soy Samantha, tu guía virtual. Toca un botón para una respuesta rápida.',
         placeholder:'Hola, soy Samantha, tu guía virtual. Toca un botón — o escribe aquí…',
         buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'agua','AC':'aire acondicionado','bathroom':'baño','kitchen':'cocina','terrace':'terraza',
           eat:'comer', drink:'beber', shop:'compras', visit:'visitar', 'hidden gems':'joyas ocultas', experience:'experiencias', 'day trips':'excursiones',
           transport:'transporte', services:'servicios', emergency:'emergencia' },
         voice_on:'🔊 Voz: Activada', voice_off:'🔇 Voz: Desactivada', apt_label: base.apt_label.es }
  };

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
.controls{display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap}
.lang{display:flex;gap:6px;margin-left:auto}
.lang button{border:1px solid #ddd;background:#fff;padding:6px 8px;border-radius:10px;cursor:pointer;font-size:13px}
.lang button[aria-current="true"]{background:#2b2118;color:#fff;border-color:#2b2118}
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
</style></head>
<body>
<div class="wrap">
  <header>
    <div class="h-row">
      <div class="h-left">
        <img class="logo" src="logo-niceflatinrome.jpg" alt="NiceFlatInRome">
        <div class="brand">niceflatinrome.com</div>
      </div>
      <div class="apt"><span id="aptLabel">${base.apt_label.en}</span>: ${base.apartment_id}</div>
    </div>
    <div class="controls">
      <button id="voiceBtn" aria-pressed="false" title="Toggle voice">🔇 Voice: Off</button>
      <nav class="lang" aria-label="Language">
        <button data-lang="en" aria-current="true">EN</button>
        <button data-lang="it">IT</button>
        <button data-lang="fr">FR</button>
        <button data-lang="de">DE</button>
        <button data-lang="es">ES</button>
      </nav>
    </div>
  </header>

  <main id="chat" aria-live="polite"></main>

  <footer>
    <input id="input" placeholder="Hi, I am Samantha, your virtual guide. Tap a button for a quick answer — or type here…" autocomplete="off">
    <button id="sendBtn">Send</button>
  </footer>
</div>
<script>
const UI_I18N = ${JSON.stringify({
  en: { welcome:'Hi, I am Samantha, your virtual guide. Tap a button to get a quick answer.',
        placeholder:'Hi, I am Samantha, your virtual guide. Tap a button for a quick answer — or type here…',
        buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'water','AC':'AC','bathroom':'bathroom','kitchen':'kitchen','terrace':'terrace',
          eat:'eat', drink:'drink', shop:'shop', visit:'visit', 'hidden gems':'hidden gems', experience:'experience', 'day trips':'day trips',
          transport:'transport', services:'services', emergency:'emergency' },
        voice_on:'🔊 Voice: On', voice_off:'🔇 Voice: Off', apt_label: base.apt_label.en },
  it:{ welcome:'Ciao, sono Samantha, la tua guida virtuale. Tocca un pulsante per una risposta rapida.',
        placeholder:'Ciao, sono Samantha, la tua guida virtuale. Tocca un pulsante — oppure scrivi qui…',
        buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'acqua','AC':'aria condizionata','bathroom':'bagno','kitchen':'cucina','terrace':'terrazzo',
          eat:'mangiare', drink:'bere', shop:'shopping', visit:'visitare', 'hidden gems':'gemme nascoste', experience:'esperienze', 'day trips':'gite di un giorno',
          transport:'trasporti', services:'servizi', emergency:'emergenza' },
        voice_on:'🔊 Voce: On', voice_off:'🔇 Voce: Off', apt_label: base.apt_label.it },
  fr:{ welcome:'Bonjour, je suis Samantha, votre guide virtuel. Touchez un bouton pour une réponse rapide.',
        placeholder:'Bonjour, je suis Samantha, votre guide virtuel. Touchez un bouton — ou écrivez ici…',
        buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'eau','AC':'climatisation','bathroom':'salle de bain','kitchen':'cuisine','terrace':'terrasse',
          eat:'manger', drink:'boire', shop:'shopping', visit:'visiter', 'hidden gems':'trésors cachés', experience:'expériences', 'day trips':'excursions',
          transport:'transports', services:'services', emergency:'urgence' },
        voice_on:'🔊 Voix : Activée', voice_off:'🔇 Voix : Désactivée', apt_label: base.apt_label.fr },
  de:{ welcome:'Hallo, ich bin Samantha, dein virtueller Guide. Tippe auf einen Button für eine schnelle Antwort.',
        placeholder:'Hallo, ich bin Samantha, dein virtueller Guide. Tippe auf einen Button — oder schreibe hier…',
        buttons:{ wifi:'WLAN','check in':'check in','check out':'check out','water':'Wasser','AC':'Klimaanlage','bathroom':'Bad','kitchen':'Küche','terrace':'Terrasse',
          eat:'Essen', drink:'Trinken', shop:'Shopping', visit:'Sehenswürdigkeiten', 'hidden gems':'versteckte Juwelen', experience:'Erlebnisse', 'day trips':'Tagesausflüge',
          transport:'Verkehr', services:'Services', emergency:'Notfall' },
        voice_on:'🔊 Stimme: An', voice_off:'🔇 Stimme: Aus', apt_label: base.apt_label.de },
  es:{ welcome:'Hola, soy Samantha, tu guía virtual. Toca un botón para una respuesta rápida.',
        placeholder:'Hola, soy Samantha, tu guía virtual. Toca un botón — o escribe aquí…',
        buttons:{ wifi:'wifi','check in':'check in','check out':'check out','water':'agua','AC':'aire acondicionado','bathroom':'baño','kitchen':'cocina','terrace':'terraza',
          eat:'comer', drink:'beber', shop:'compras', visit:'visitar', 'hidden gems':'joyas ocultas', experience:'experiencias', 'day trips':'excursiones',
          transport:'transporte', services:'servicios', emergency:'emergencia' },
        voice_on:'🔊 Voz: Activada', voice_off:'🔇 Voz: Desactivada', apt_label: base.apt_label.es }
})};
const BUTTON_KEYS = ${JSON.stringify(['wifi','check in','check out','water','AC','bathroom','kitchen','terrace','eat','drink','shop','visit','hidden gems','experience','day trips','transport','services','emergency'])};

const chatEl = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');

// Lang init (?lang -> localStorage -> navigator)
const url = new URL(location);
let lang = (url.searchParams.get('lang') || localStorage.getItem('lang') || (navigator.language||'en').slice(0,2)).toLowerCase();
if(!UI_I18N[lang]) lang='en';
url.searchParams.set('lang', lang); history.replaceState(null,'',url);
localStorage.setItem('lang', lang);

// ---------- TTS ----------
let voiceOn = false, pick = null;
const VOICE_PREFS = { en:['Samantha','Google US English'], it:['Alice','Eloisa','Google italiano'], fr:['Amelie','Thomas','Google français'], de:['Anna','Markus','Google Deutsch'], es:['Monica','Jorge','Paulina','Google español'] };
function selectVoice(){
  if(!('speechSynthesis' in window)) return null;
  const all = speechSynthesis.getVoices()||[];
  const prefs = VOICE_PREFS[lang]||[];
  for(const name of prefs){ const v = all.find(v => (v.name||'').toLowerCase()===name.toLowerCase()); if(v) return v; }
  const byLang = all.find(v => (v.lang||'').toLowerCase().startsWith(lang)); return byLang || all[0] || null;
}
function refreshVoice(){ pick = selectVoice(); }
if('speechSynthesis' in window){ refreshVoice(); speechSynthesis.onvoiceschanged = refreshVoice; }
function warm(){ if(!('speechSynthesis' in window)) return; try{ speechSynthesis.cancel(); const dot=new SpeechSynthesisUtterance('.'); dot.volume=0.01; if(pick) dot.voice=pick; dot.lang=pick?.lang||lang; speechSynthesis.speak(dot);}catch{} }
function speak(t){ if(!voiceOn||!('speechSynthesis' in window)) return; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); if(pick) u.voice=pick; u.lang=pick?.lang||lang; speechSynthesis.speak(u);}catch{} }

document.getElementById('voiceBtn').addEventListener('click',e=>{
  voiceOn=!voiceOn; e.currentTarget.setAttribute('aria-pressed', String(voiceOn)); applyUI(); if(voiceOn) warm();
});
document.querySelector('.lang').addEventListener('click',e=>{
  const btn=e.target.closest('[data-lang]'); if(!btn) return;
  lang=btn.getAttribute('data-lang'); localStorage.setItem('lang',lang);
  const u=new URL(location); u.searchParams.set('lang',lang); history.replaceState(null,'',u);
  refreshVoice(); applyUI(); chatEl.innerHTML=''; welcome(); if(voiceOn) warm();
});

function applyUI(){
  const t = UI_I18N[lang] || UI_I18N.en;
  document.getElementById('aptLabel').textContent = t.apt_label;
  document.getElementById('voiceBtn').textContent = voiceOn ? t.voice_on : t.voice_off;
  input.placeholder = t.placeholder;
  document.querySelectorAll('.lang [data-lang]').forEach(b=> b.setAttribute('aria-current', b.getAttribute('data-lang')===lang ? 'true':'false'));
}
function add(type, txt){
  const d=document.createElement('div');
  d.className='msg '+(type==='me'?'me':'wd');
  d.textContent=txt;
  chatEl.appendChild(d);
  chatEl.scrollTop=chatEl.scrollHeight;
}
function welcome(){
  const t = UI_I18N[lang] || UI_I18N.en;
  add('wd', t.welcome);
  const q=document.createElement('div'); q.className='quick';
  for(const key of BUTTON_KEYS){
    const label = t.buttons[key] || key;
    const b=document.createElement('button'); b.textContent=label;
    b.onclick=()=>{ input.value=key; send(); };
    q.appendChild(b);
  }
  chatEl.appendChild(q);
}
async function send(){
  const text=(input.value||'').trim(); if(!text) return;
  add('me', text); input.value='';
  try{
    const r = await fetch('./api/message', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message:text, lang })
    });
    const data = await r.json();
    const bot = data.text || 'Sorry, something went wrong.';
    add('wd', bot); speak(bot);
  }catch{
    add('wd','Network error. Please try again.');
  }
}
sendBtn.addEventListener('click',send);
input.addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
applyUI(); welcome();
</script>
</body></html>`;
  res.setHeader('content-type','text/html; charset=utf-8');
  res.end(html);
});

// ---------------- Health Check ----------------
app.get('/healthz', (_req,res)=> res.status(200).send('ok'));

// ---------------- Start (Render) ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Guest Assistant running on port ${PORT}`);
});
