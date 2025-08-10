
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

function detectIntent(message){
  const text = (message || '').toLowerCase();
  let best = null, bestScore = 0;
  for (const f of faqs){
    let score = 0;
    for (const u of f.utterances) if (text.includes(u.toLowerCase())) score++;
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
    'Use the same language as the user, keep under 120 words unless steps are needed.',
    'If fallback, ask one clarifying question.'
  ].join(' ');
  try{
    const resp = await client.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [
        { role: 'user', content: `User message: [${userMessage || ''}]` },
        { role: 'developer', content: `Apartment data (JSON): ${JSON.stringify(apt)}` },
        { role: 'system', content: `Raw answer to polish:\n${raw}` }
      ]
    });
    return resp.output_text || raw;
  }catch(e){
    console.error(e);
    return raw;
  }
}

// API
app.post('/api/message', async (req, res) => {
  const { message, aptId='LEONINA71' } = req.body || {};
  if (!apartments[aptId]) return res.status(400).json({ error: 'Invalid aptId' });
  const apt = apartments[aptId];
  const matched = detectIntent(message);
  let raw = matched ? fillTemplate(matched.answer_template, apt)
                    : 'I did not find a direct answer. Try: wifi, water, TV, trash, check in, check out.';
  const text = await polish(raw, message, apt);
  res.json({ text, intent: matched?.intent || null });
});

// UI (single file HTML with inline JS/CSS)
app.get('/', (req, res) => {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guest Help — Via Leonina 71</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf8f3;color:#2b2118}
header{position:sticky;top:0;background:#efe6da;padding:12px 16px;border-bottom:1px solid #e0d6c8;display:flex;justify-content:space-between}
.brand{font-weight:700}.apt{opacity:.8}
main{padding:16px;min-height:calc(100vh - 140px)}
.chat{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.msg{padding:12px 14px;border-radius:14px;max-width:85%;line-height:1.35;white-space:pre-wrap}
.msg.user{align-self:flex-end;background:#e7f0ff}.msg.bot{align-self:flex-start;background:#fff;border:1px solid #efe6da}
.composer{position:sticky;bottom:0;display:flex;gap:8px;padding:12px 16px;background:#efe6da;border-top:1px solid #e0d6c8}
.composer input{flex:1;padding:10px 12px;border-radius:10px;border:1px solid #d5c8b8;outline:none}
.composer button{padding:10px 16px;border-radius:10px;border:1px solid #2b2118;background:#2b2118;color:#fff;cursor:pointer}
.quick{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.quick button{border:1px dashed #c9b9a5;background:transparent;padding:6px 10px;border-radius:12px;cursor:pointer}
</style></head>
<body>
<header><div class="brand">niceflatinrome.com</div><div class="apt">Apartment: LEONINA71</div></header>
<main><div id="chat" class="chat"></div></main>
<footer class="composer"><input id="input" placeholder="Type a message… e.g., wifi, water, TV" autocomplete="off">
<button id="sendBtn">Send</button></footer>
<script>
const chat=document.getElementById('chat');const input=document.getElementById('input');const sendBtn=document.getElementById('sendBtn');
function add(t,w='bot'){const d=document.createElement('div');d.className='msg '+w;d.textContent=t;chat.appendChild(d);chat.scrollTop=chat.scrollHeight}
function quick(items){const w=document.createElement('div');w.className='quick';for(const it of items){const b=document.createElement('button');b.textContent=it;b.onclick=()=>{input.value=it;send()};w.appendChild(b)}chat.appendChild(w)}
add('Welcome! I can help with Wi‑Fi, water, TV, trash, check‑in/out. (Multilingual)');quick(['wifi','water','TV','trash','check in','check out','restaurants','drinks','shopping','what to visit','hidden gems','emergency']);
sendBtn.addEventListener('click',send);input.addEventListener('keydown',e=>{if(e.key==='Enter')send()});
async function send(){const text=input.value.trim();if(!text)return;add(text,'user');input.value='';try{const r=await fetch('/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,aptId:'LEONINA71'})});const data=await r.json();if(data.error)throw new Error(data.error);add(data.text||'Ok.')}catch(e){add('Sorry, temporary issue. Please try again later.')}}
</script></body></html>`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.send(html);
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log('Guest assistant up on http://localhost:'+port));
