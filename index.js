// --- Server & AI ---
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const apartments = JSON.parse(fs.readFileSync('./apartments.json', 'utf-8'));
const faqs = JSON.parse(fs.readFileSync('./faqs.json', 'utf-8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// --- Helpers ---
function normalize(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    // normalizza vari tipi di trattini (– — - ecc.) in trattino semplice
    .replace(/[\u2010-\u2015\u2212\u2043\u00ad]/g, '-')
    // comprime spazi multipli
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntent(message) {
  const text = normalize(message || '');
  let best = null, bestScore = 0;
  for (const f of faqs) {
    let score = 0;
    for (const u of f.utterances) {
      const uNorm = normalize(u);
      if (uNorm && text.includes(uNorm)) score++;
    }
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}

function fillTemplate(tpl, apt) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (apt[k] ?? `{${k}}`));
}

async function polish(raw, userMessage, apt) {
  if (!client) return raw; // senza chiave API, restituiamo il testo grezzo
  const instructions = [
    'You are a concise multilingual guest assistant for a vacation rental.',
    'Rewrite the provided answer keeping facts identical, no inventions.',
    'Use the same language as the user, keep under 120 words unless steps are needed.',
    'If fallback, ask one clarifying question.'
  ].join(' ');
  try {
    const resp = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'user', content: `User message: [${userMessage || ''}]` },
        { role: 'developer', content: `Apartment data (JSON): ${JSON.stringify(apt)}` },
        { role: 'system', content: `Raw answer to polish:\n${raw}` }
      ],
      instructions
    });
    return resp.output_text || raw;
  } catch (e) {
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
  let raw =
    matched ? fillTemplate(matched.answer_template, apt)
            : 'I did not find a direct answer. Try: wifi, water, TV, trash, check in, check out, restaurants, transport, airport, emergency.';
  const text = await polish(raw, message, apt);
  res.json({ text, intent: matched?.intent || null });
});

// --- UI (single file HTML con inline JS/CSS) ---
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
  header{position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:12px}
  .brand{font-weight:700;color:#a33;text-transform:lowercase}
  .apt{margin-left:auto;font-size:14px;opacity:.8}
  main{flex:1;padding:12px}
  .msg{max-width:85%;line-height:1.35;border-radius:12px;padding:10px 12px;margin:8px 0;white-space:pre-wrap}
  .msg.wd{background:#fff;border:1px solid #e0e0e0}
  .msg.me{background:#e8f0fe;border:1px solid #c5d5ff;margin-left:auto}
  .quick{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .quick button{border:1px solid #d6c5b8;background:#fff;color:#333;padding:6px 10px;border-radius:12px;cursor:pointer}
  footer{position:sticky;bottom:0;background:#fff;display:flex;gap:8px;padding:10px;border-top:1px solid #e0e0e0}
  input{flex:1;padding:12px;border:1px solid #cbd5e1;border-radius:10px;outline:none}
  #sendBtn{padding:12px 14px;border:1px solid #2b2118;background:#2b2118;color:#fff;border-radius:10px;cursor:pointer}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">niceflatinrome.com</div>
      <div class="apt">Apartment: ${apt}</div>
    </header>
    <main id="chat" aria-live="polite"></main>
    <footer>
      <input id="input" placeholder="Type a message… e.g., wifi, water, TV" autocomplete="off">
      <button id="sendBtn">Send</button>
    </footer>
  </div>
<script>
  const aptId = new URLSearchParams(location.search).get('apt') || '${apt}';

  function add(type, txt){
    const w = document.getElementById('chat');
    const d = document.createElement('div');
    d.className = 'msg ' + (type === 'me' ? 'me' : 'wd');
    d.textContent = txt;
    w.appendChild(d);
    w.scrollTop = w.scrollHeight;
  }

  function quick(items){
    const q = document.createElement('div');
    q.className = 'quick';
    for(const it of items){
      const b = document.createElement('button');
      b.textContent = it;
      b.addEventListener('click', () => {
        input.value = it; send();
      });
      q.appendChild(b);
    }
    return q.outerHTML;
  }

  // Messaggio di benvenuto + bottoni rapidi
  const welcome = "Welcome! I can help with Wi-Fi, water, TV, trash, check-in/out, restaurants, transport, airport. (Multilingual)";
  document.getElementById('chat').innerHTML =
    '<div class="msg wd">'+welcome+'</div>' +
    ${JSON.stringify(quickButtons)}; // placeholder

  // Sostituiamo il placeholder con l'HTML generato
  (function(){
    const c = document.getElementById('chat');
    const tmp = document.createElement('div');
    tmp.innerHTML = ${JSON.stringify('<div class="quick"></div>')};
    c.appendChild(tmp.firstChild);
    document.querySelector('.quick').outerHTML = (function(){
      const el = document.createElement('div');
      el.innerHTML = quick(${JSON.stringify(quickButtons)});
      return el.firstChild.outerHTML;
    })();
  })();

  const input = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');

  async function send(){
    const text = input.value.trim();
    if(!text) return;
    add('me', text);
    input.value = '';
    try{
      const r = await fetch('/api/message', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:text, aptId })
      });
      const data = await r.json();
      add('wd', data.text || 'Sorry, something went wrong.');
    }catch(e){
      add('wd', 'Network error. Please try again.');
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if(e.key==='Enter') send(); });
</script>
</body></html>`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
});

// --- Start ---
const port = process.env.PORT || 8787;
app.listen(port, () => console.log('Guest assistant up on http://localhost:'+port));
