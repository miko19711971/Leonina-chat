// --- Server & AI ---
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

// serve file statici (logo ecc.) dalla root del repo
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

  /* HEADER */
  header{
    position:sticky;top:0;z-index:10;background:#fff;
    padding:10px 14px;border-bottom:1px solid #eaeaea;
    display:flex;align-items:center;gap:12px;flex-wrap:wrap
  }
  .h-left{display:flex;align-items:center;gap:10px;min-width:0}
  .brand{font-weight:700;color:#a33;white-space:nowrap}
  .apt{margin-left:auto;font-size:14px;opacity:.85;white-space:nowrap}
  #voiceBtn{
    padding:8px 10px;border:1px solid #ddd;background:#fff;border-radius:10px;
    cursor:pointer;font-size:14px
  }
  #voiceBtn[aria-pressed="true"]{background:#2b2118;color:#fff;border-color:#2b2118}

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

  /* Logo size */
  .logo{height:24px;width:auto;display:block}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="h-left">
        <img id="logo" class="logo" src="/logo-niceflatinrome.png" alt="NiceFlatInRome">
        <div class="brand">niceflatinrome.com</div>
      </div>
      <div class="apt">Apartment: ${apt}</div>
      <button id="voiceBtn" aria-pressed="false" title="Toggle voice">🔇 Voice: Off</button>
    </header>

    <main id="chat" aria-live="polite"></main>

    <footer>
      <input id="input" placeholder="Type a message… e.g., wifi, water, TV" autocomplete="off">
      <button id="sendBtn">Send</button>
    </footer>
  </div>

<script>
  const aptId   = new URLSearchParams(location.search).get('apt') || '${apt}';
  const chatEl  = document.getElementById('chat');
  const input   = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');

  // --- Fix logo: prova più nomi, altrimenti nascondi ---
  (function(){
    const img = document.getElementById('logo');
    const candidates = ['/logo-niceflatinrome.png','/logo-niceflatinrome.jpg','/logo.png','/logo.jpg'];
    let idx = 0;
    img.onerror = () => {
      idx++;
      if (idx < candidates.length){
        img.src = candidates[idx];
      } else {
        img.style.display = 'none'; // niente punto interrogativo
      }
    };
    img.src = candidates[0];
  })();

  // --- Voice (Samantha only / English US) ---
  let voiceOn = false;
  let voices = [];
  let pickedVoice = null;

  function chooseSamantha(){
    // 1) Samantha, 2) qualunque en-US/GB, 3) prima disponibile
    pickedVoice =
      voices.find(v => /samantha/i.test(v.name)) ||
      voices.find(v => /en-(us|gb)/i.test(v.lang)) ||
      voices[0] || null;
  }

  function loadVoices(){
    voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
    chooseSamantha();
  }

  if ('speechSynthesis' in window){
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => { loadVoices(); };
  }

  const voiceBtn = document.getElementById('voiceBtn');

  function warmUpSpeak(){
    try{
      const u = new SpeechSynthesisUtterance('Voice enabled.');
      if (pickedVoice) u.voice = pickedVoice;
      u.lang = 'en-US';
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
      u.lang = 'en-US'; // fisso
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

  // --- Chat UI ---
  function add(type, txt){
    const d = document.createElement('div');
    d.className = 'msg ' + (type === 'me' ? 'me' : 'wd');
    d.textContent = txt;
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderWelcome(){
    add('wd', 'Welcome! I can help with Wi-Fi, water, TV, trash, check-in/out, restaurants, transport, airport.');
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
      const r = await fetch('/api/message',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:text, aptId })
      });
      const data = await r.json();
      const botText = data.text || 'Sorry, something went wrong.';
      add('wd', botText);
      speak(botText);
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
