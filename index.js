// --- Server & AI ---
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

// serve file statici dalla cartella corrente (logo, ecc.)
app.use(express.static('.'));

const apartments = JSON.parse(fs.readFileSync('./apartments.json', 'utf-8'));
const faqs = JSON.parse(fs.readFileSync('./faqs.json', 'utf-8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL  = process.env.OPENAI_MODEL  || 'gpt-4o-mini';
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// --- Helpers ---
function normalize(s){
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[\u2010-\u2015\u2212\u2043\u00ad]/g, '-') // trattini strani -> '-'
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
    'Rewrite the provided answer keeping facts identical, no inventions.',
    'Use the same language as the user and keep under 120 words unless steps are needed.'
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

// --- API ---
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

// --- UI (single file HTML with inline JS/CSS) ---
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

  /* HEADER */
  header{
    position:sticky;top:0;z-index:10;background:#fff;
    padding:10px 14px;border-bottom:1px solid #eaeaea;
    display:flex;align-items:center;gap:12px;flex-wrap:wrap
  }
  .h-left{display:flex;align-items:center;gap:10px;min-width:0}
  .brand{font-weight:700;color:#a33;white-space:nowrap}
  .brand img{height:40px;width:auto;display:block}
  .apt{margin-left:auto;font-size:14px;opacity:.85;white-space:nowrap}
  .controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #voiceBtn{
    padding:8px 10px;border:1px solid #ddd;background:#fff;border-radius:10px;
    cursor:pointer;font-size:14px
  }
  #voiceBtn[aria-pressed="true"]{background:#2b2118;color:#fff;border-color:#2b2118}
  #voiceSelect{padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#fff;font-size:14px;max-width:240px}

  main{flex:1;padding:12px}
  .msg{max-width:85%;line-height:1.4;border-radius:12px;padding:12px 14px;margin:8px 0;white-space:pre-wrap}
  .msg.wd{background:#fff;border:1px solid #e6e6e6}
  .msg.me{background:#eaf2ff;border:1px solid #cddfff;margin-left:auto}

  .quick{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .quick button{
    border:1px solid #d6c5b8;background:#fff;color:#333;padding:8px 12px;
    border-radius:14px;cursor:pointer;line-height:1;height:36px
  }
  .quick button:active{transform:translateY(1px)}

  footer{position:sticky;bottom:0;background:#fff;display:flex;gap:8px;padding:10px;border-top:1px solid #eaeaea}
  input{flex:1;padding:14px;border:1px solid #cbd5e1;border-radius:10px;outline:none}
  #sendBtn{padding:14px;border:1px solid #2b2118;background:#2b2118;color:#fff;border-radius:10px;cursor:pointer}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="h-left">
       <img src="logo-niceflatinrome.jpg" alt="NiceFlatInRome" class="brand" style="height:20px;" />
        <div class="brand">niceflatinrome.com</div>
      </div>
      <div class="apt">Apartment: ${apt}</div>
      <div class="controls">
        <button id="voiceBtn" aria-pressed="false" title="Toggle voice">🔊 Voice: Off</button>
        <select id="voiceSelect" title="Choose voice"></select>
      </div>
    </header>

    <main id="chat" aria-live="polite"></main>

    <footer>
      <input id="input" placeholder="Type a message… e.g., wifi, water, TV" autocomplete="off">
      <button id="sendBtn">Send</button>
    </footer>
  </div>

<script>
  const aptId  = new URLSearchParams(location.search).get('apt') || '${apt}';
  const chatEl = document.getElementById('chat');
  const input  = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');

  // --- Voice (TTS) with iOS warm-up + selectable voice ---
  let voiceOn = false;
  let voices = [];
  let pickedVoice = null;

  const voiceBtn = document.getElementById('voiceBtn');
  const voiceSelect = document.getElementById('voiceSelect');

  function populateSelect(){
    const sorted = [...voices].sort((a,b)=>{
      const ae = /en-/i.test(a.lang), be = /en-/i.test(b.lang);
      if (ae && !be) return -1;
      if (!ae && be) return 1;
      return (a.name||'').localeCompare(b.name||'');
    });
    voiceSelect.innerHTML = '';
    for (const v of sorted){
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = \`\${v.name} (\${v.lang})\`;
      voiceSelect.appendChild(opt);
    }
    const saved = localStorage.getItem('voiceName');
    if (saved && [...voiceSelect.options].some(o=>o.value===saved)){
      voiceSelect.value = saved;
      pickedVoice = voices.find(v=>v.name===saved) || null;
    } else {
      pickedVoice =
        voices.find(v => /en-(US|GB)/i.test(v.lang) && /siri|premium|enhanced/i.test(v.name)) ||
        voices.find(v => /en-(US|GB)/i.test(v.lang)) ||
        voices[0] || null;
      if (pickedVoice) voiceSelect.value = pickedVoice.name;
    }
  }

  function loadVoices(){
    voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
    populateSelect();
  }
  if ('speechSynthesis' in window){
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function warmUpSpeak(){
    try{
      const u = new SpeechSynthesisUtterance('Voice enabled.');
      if (pickedVoice) u.voice = pickedVoice;
      u.lang = pickedVoice?.lang || 'en-US';
      u.rate = 1; u.pitch = 1; u.volume = 1;
      const resumeHack = setInterval(()=>{
        if (speechSynthesis.speaking) speechSynthesis.resume(); else clearInterval(resumeHack);
      }, 200);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){ console.warn('Warm-up error', e); }
  }

  function speak(text){
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try{
      const u = new SpeechSynthesisUtterance(text);
      if (pickedVoice) u.voice = pickedVoice;
      u.lang = pickedVoice?.lang || 'en-US';
      u.rate = 1; u.pitch = 1; u.volume = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){ console.warn('TTS error', e); }
  }

  voiceBtn.addEventListener('click', () => {
    voiceOn = !voiceOn;
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
    voiceBtn.textContent = voiceOn ? '🔊 Voice: On' : '🔇 Voice: Off';
    if (voiceOn) warmUpSpeak();
  });

  voiceSelect.addEventListener('change', () => {
    const name = voiceSelect.value;
    pickedVoice = voices.find(v=>v.name===name) || null;
    localStorage.setItem('voiceName', name);
  });

  // --- UI helpers ---
  function add(type, txt){
    const d = document.createElement('div');
    d.className = 'msg ' + (type === 'me' ? 'me' : 'wd');
    d.textContent = txt;
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderWelcome(){
    add('wd', 'Welcome! I can help with Wi-Fi, water, TV, trash, check-in/out, restaurants, transport, airport. (Multilingual)');
    const q = document.createElement('div');
    q.className = 'quick';
    const items = ${JSON.stringify(quickButtons)};
    for (const it of items){
      const b = document.createElement('button');
      b.textContent = it;
      b.addEventListener('click', () => { input.value = it; send(); });
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
      const r = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ message: text, aptId })
      });
      const data = await r.json();
      const botText = data.text || 'Sorry, something went wrong.';
      add('wd', botText);
      speak(botText);
    }catch(e){
      add('wd', 'Network error. Please try again.');
    }
  }

  document.getElementById('sendBtn').addEventListener('click', send);
  document.getElementById('input').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  renderWelcome();
</script>
</body></html>`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
});

// --- Start ---
const port = process.env.PORT || 8787;
app.listen(port, () => console.log('Guest assistant up on http://localhost:' + port));
