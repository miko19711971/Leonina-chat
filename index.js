// --- Server & AI ---
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

// serve file statici (logo ecc.)
app.use(express.static('.'));

const apartments = JSON.parse(fs.readFileSync('./apartments.json', 'utf-8'));
const faqs       = JSON.parse(fs.readFileSync('./faqs.json', 'utf-8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// --- Helpers ---
function normalize(s){
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[\u2010-\u2015\u2212\u2043\u00ad]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntent(message){
  const text = normalize(message || '');
  let best = null, bestScore = 0;
  for (const f of faqs){
    let score = 0;
    for (const u of f.utterances){
      if (u && text.includes(normalize(u))) score++;
    }
    if (score > bestScore){ best = f; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}

function fillTemplate(tpl, apt){
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (apt[k] ?? `{${k}}`));
}

async function polish(raw, userMessage, apt){
  if (!client) return raw;
  const instructions = [
    'You are a concise multilingual guest assistant for a vacation rental.',
    'Rewrite the provided answer keeping facts identical; do not invent.',
    'Use the same language as the user; keep under 120 words unless steps are needed.'
  ].join(' ');
  try{
    const resp = await client.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [
        { role: 'user',      content: `User message: ${userMessage || ''}` },
        { role: 'developer', content: `Apartment data (JSON): ${JSON.stringify(apt)}` },
        { role: 'system',    content: `Raw answer to polish:\n${raw}` }
      ]
    });
    return resp.output_text || raw;
  }catch(e){
    console.error(e);
    return raw;
  }
}

// --- API: main message ---
app.post('/api/message', async (req, res) => {
  const { message, aptId = 'LEONINA71' } = req.body || {};
  if (!apartments[aptId]) return res.status(400).json({ error: 'Invalid aptId' });
  const apt = apartments[aptId];

  const matched = detectIntent(message);
  let raw = matched
    ? fillTemplate(matched.answer_template, apt)
    : 'I did not find a direct answer. Please rephrase or tap a quick button above.';

  const text = await polish(raw, message, apt);
  res.json({ text, intent: matched?.intent || null });
});

// --- API: translate for TTS ---
const LANG_NAME = {
  'en-US': 'English',
  'it-IT': 'Italian',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
};

app.post('/api/translate', async (req, res) => {
  const { text, targetLang = 'en-US' } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
  const langName = LANG_NAME[targetLang] || 'English';

  // Fallback: no API → return original text
  if (!client) return res.json({ text });

  try{
    const instructions = `Translate the user's text into ${langName}. Preserve meaning, tone and formatting. Keep it concise, no preamble, no quotes.`;
    const resp = await client.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [{ role: 'user', content: text }]
    });
    const out = resp.output_text?.trim() || text;
    res.json({ text: out });
  }catch(e){
    console.error('translate error', e);
    res.json({ text }); // fallback on error
  }
});

// --- UI (single-file HTML+JS) ---
app.get('/', (req, res) => {
  const apt = (req.query.apt || 'LEONINA71').toString();
  const quickButtons = [
    'wifi','water','TV','trash','check in','check out',
    'restaurants','what to visit','transport','airport','emergency'
  ];

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guest Help – Via Leonina 71</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f6}
  .wrap{max-width:760px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
  header{position:sticky;top:0;background:#fff;padding:10px 14px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .h-left{display:flex;align-items:center;gap:8px}
  .brand{font-weight:700;color:#a33}
  img.brand{height:40px}
  .apt{margin-left:auto;font-size:14px;opacity:.85}
  .controls{display:flex;gap:8px;width:100%}
  #voiceBtn{padding:8px 10px;border:1px solid #ddd;background:#fff;border-radius:10px;cursor:pointer;font-size:14px}
  #voiceBtn[aria-pressed="true"]{background:#2b2118;color:#fff;border-color:#2b2118}
  select{padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;font-size:14px}
  main{flex:1;padding:12px}
  .msg{max-width:85%;line-height:1.35;border-radius:12px;padding:10px 12px;margin:8px 0;white-space:pre-wrap}
  .msg.wd{background:#fff;border:1px solid #e0e0e0}
  .msg.me{background:#e8f0fe;border:1px solid #c5d5ff;margin-left:auto}
  .quick{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .quick button{border:1px solid #d6c5b8;background:#fff;color:#333;padding:8px 12px;border-radius:12px;cursor:pointer;line-height:1;height:36px}
  .quick button:active{transform:translateY(1px)}
  footer{position:sticky;bottom:0;background:#fff;display:flex;gap:8px;padding:10px;border-top:1px solid #e0e0e0}
  input{flex:1;padding:14px;border:1px solid #cbd5e1;border-radius:10px;outline:none}
  #sendBtn{padding:14px;border:1px solid #2b2118;background:#2b2118;color:#fff;border-radius:10px;cursor:pointer}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="h-left">
      <img src="logo-niceflatinrome.png" alt="NiceFlatInRome" class="brand" />
      <div class="brand">niceflatinrome.com</div>
    </div>
    <div class="apt">Apartment: ${apt}</div>

    <div class="controls">
      <button id="voiceBtn" aria-pressed="false" title="Toggle voice">🔇 Voice: Off</button>
      <select id="voiceSelect" title="Voice"></select>
      <select id="langSelect" title="Language">
        <option value="en-US" selected>English</option>
        <option value="it-IT">Italiano</option>
        <option value="es-ES">Español</option>
        <option value="fr-FR">Français</option>
        <option value="de-DE">Deutsch</option>
      </select>
    </div>
  </header>

  <main id="chat" aria-live="polite"></main>

  <footer>
    <input id="input" placeholder="Type a message… e.g., wifi, water, TV" autocomplete="off">
    <button id="sendBtn">Send</button>
  </footer>
</div>

<script>
  // --- DOM
  const aptId   = new URLSearchParams(location.search).get('apt') || '${apt}';
  const chatEl  = document.getElementById('chat');
  const input   = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const voiceBtn    = document.getElementById('voiceBtn');
  const voiceSelect = document.getElementById('voiceSelect');
  const langSelect  = document.getElementById('langSelect');

  // --- Voice state
  let voiceOn = false;
  let voices = [];
  let pickedVoice = null;

  // preferenze salvate
  let ttsLang  = localStorage.getItem('ttsLang')  || 'en-US';
  let ttsGender = localStorage.getItem('ttsGender') || 'female'; // female|male
  langSelect.value = ttsLang;

  // nomi preferiti (fallback intelligenti)
  const PREFERRED = {
    'en-US': { female: ['Samantha','Victoria','Karen'], male: ['Alex','Daniel','Fred'] },
    'it-IT': { female: ['Alice','Federica'],           male: ['Luca'] },
    'es-ES': { female: ['Monica','Paulina'],           male: ['Diego','Jorge'] },
    'fr-FR': { female: ['Amelie','Virginie'],          male: ['Thomas'] },
    'de-DE': { female: ['Anna','Petra'],               male: ['Markus','Yannick'] }
  };

  function getCandidatesByLang(lang){
    const pref = PREFERRED[lang] || { female:[], male:[] };
    const inLang = (v)=> v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]);
    const pool = voices.filter(inLang);

    function pickByNames(names){
      for (const n of names){
        const found = pool.find(v => (v.name||'').toLowerCase().includes(n.toLowerCase()));
        if (found) return found;
      }
      return null;
    }

    const female = pickByNames(pref.female) || pool[0] || null;
    const male   = pickByNames(pref.male)   || pool.find(v=>v!==female) || pool[0] || null;

    return { female, male, pool };
  }

  function populateVoiceSelect(){
    voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
    voiceSelect.innerHTML = '';
    const cand = getCandidatesByLang(ttsLang);

    const opts = [];
    if (cand.female) opts.push({key:'female', label:'Female', v:cand.female});
    if (cand.male)   opts.push({key:'male',   label:'Male',   v:cand.male});

    for (const o of opts){
      const option = document.createElement('option');
      option.value = o.key;
      option.textContent = o.label;
      voiceSelect.appendChild(option);
    }

    if (![...voiceSelect.options].some(o=>o.value===ttsGender)){
      ttsGender = 'female';
    }
    voiceSelect.value = ttsGender;

    pickedVoice = (ttsGender === 'male' ? cand.male : cand.female) || cand.pool[0] || null;
    if (pickedVoice){
      localStorage.setItem('voiceName', pickedVoice.name || '');
    }
  }

  if ('speechSynthesis' in window){
    populateVoiceSelect();
    window.speechSynthesis.onvoiceschanged = populateVoiceSelect;
  }

  function warmUpSpeak(){
    try{
      const u = new SpeechSynthesisUtterance('Voice enabled.');
      if (pickedVoice) u.voice = pickedVoice;
      u.lang = pickedVoice?.lang || ttsLang;
      u.rate = 1; u.pitch = 1; u.volume = 1;
      const resumeHack = setInterval(()=>{
        if (speechSynthesis.speaking) speechSynthesis.resume(); else clearInterval(resumeHack);
      }, 200);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){ console.warn('Warm-up error', e); }
  }

  // --- Translate then speak ---
  async function translateForTTS(text){
    // semplice euristica: se lingua del testo già combacia con ttsLang, niente traduzione
    const s = (text||'').toLowerCase();
    const langPrefix = ttsLang.split('-')[0];
    const looksIT = /[àèéìòù]/.test(s) || /\b(il|la|che|per|grazie|ciao)\b/.test(s);
    const looksES = /\b(el|la|que|para|gracias|hola)\b/.test(s);
    const looksFR = /\b(le|la|que|pour|merci|bonjour)\b/.test(s);
    const looksDE = /\b(der|die|das|und|danke|hallo)\b/.test(s);
    const detected =
      looksIT ? 'it' :
      looksES ? 'es' :
      looksFR ? 'fr' :
      looksDE ? 'de' : 'en';

    if ((detected === 'it' && langPrefix === 'it') ||
        (detected === 'es' && langPrefix === 'es') ||
        (detected === 'fr' && langPrefix === 'fr') ||
        (detected === 'de' && langPrefix === 'de') ||
        (detected === 'en' && (langPrefix === 'en')))
      return text;

    try{
      const r = await fetch('/api/translate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text, targetLang: ttsLang })
      });
      const data = await r.json();
      return data.text || text;
    }catch(e){
      console.warn('translate failed', e);
      return text; // fallback
    }
  }

  function speak(text){
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try{
      const u = new SpeechSynthesisUtterance(text);
      if (pickedVoice) u.voice = pickedVoice;
      u.lang = pickedVoice?.lang || ttsLang;
      u.rate = 1; u.pitch = 1; u.volume = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){ console.warn('TTS error', e); }
  }

  // UI events
  voiceBtn.addEventListener('click', () => {
    voiceOn = !voiceOn;
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.textContent = voiceOn ? '🔊 Voice: On' : '🔇 Voice: Off';
    if (voiceOn) warmUpSpeak();
  });

  voiceSelect.addEventListener('change', () => {
    const val = voiceSelect.value; // female|male
    localStorage.setItem('ttsGender', val);
    // ricostruisci per aggiornare pickedVoice
    const saved = ttsLang; // conserva
    ttsGender = val;
    populateVoiceSelect();
    ttsLang = saved;
  });

  langSelect.addEventListener('change', () => {
    ttsLang = langSelect.value;          // en-US | it-IT | es-ES | fr-FR | de-DE
    localStorage.setItem('ttsLang', ttsLang);
    populateVoiceSelect();
  });

  // Chat helpers
  function add(type, txt){
    const d = document.createElement('div');
    d.className = 'msg ' + (type === 'me' ? 'me' : 'wd');
    d.textContent = txt;
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderWelcome(){
    add('wd','Welcome! I can help with Wi-Fi, water, TV, trash, check-in/out, restaurants, transport, airport. (Multilingual)');
    const q = document.createElement('div');
    q.className = 'quick';
    const items = ${JSON.stringify(quickButtons)};
    for (const it of items){
      const b = document.createElement('button');
      b.textContent = it;
      b.addEventListener('click', ()=>{ input.value = it; send(); });
      q.appendChild(b);
    }
    chatEl.appendChild(q);
  }

  async function send(){
    const text = (input.value || '').trim();
    if (!text) return;
    add('me', text);
    input.value = '';
    try{
      const r = await fetch('/api/message',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:text, aptId })
      });
      const data = await r.json();
      const botText = data.text || 'Sorry, something went wrong.';
      add('wd', botText);

      // TRADUCI PRIMA, POI PARLA
      const speakText = await translateForTTS(botText);
      speak(speakText);
    }catch(e){
      add('wd','Network error. Please try again.');
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  renderWelcome();
</script>
</body></html>`;

  res.setHeader('content-type','text/html; charset=utf-8');
  res.end(html);
});

// --- Start ---
const port = process.env.PORT || 8787;
app.listen(port, () => console.log('Guest assistant up on http://localhost:' + port));
