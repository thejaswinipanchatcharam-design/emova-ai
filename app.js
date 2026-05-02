// ── EMOTION CONFIG ──────────────────────────────────────────
const EMOTIONS = {
  joy:      { color:'#f59e0b', label:'Joy',      tag:'e-joy' },
  love:     { color:'#f472b6', label:'Love',     tag:'e-love' },
  sadness:  { color:'#60a5fa', label:'Sadness',  tag:'e-sad' },
  anger:    { color:'#ef4444', label:'Anger',    tag:'e-anger' },
  fear:     { color:'#a78bfa', label:'Fear',     tag:'e-fear' },
  stressed: { color:'#fb7185', label:'Stressed', tag:'e-stress' },
  excited:  { color:'#fbbf24', label:'Excited',  tag:'e-excited' },
  neutral:  { color:'#6366f1', label:'Neutral',  tag:'e-neutral' },
};

const EMOTION_COLORS = {
  joy:'#f59e0b', love:'#ec4899', sadness:'#3b82f6',
  anger:'#ef4444', fear:'#8b5cf6', stressed:'#ef4444',
  excited:'#f59e0b', neutral:'#6366f1',
};

// ── STATE ────────────────────────────────────────────────────
let history = [];
let sessionActive = false;
let isLoading = false;
let isRecording = false;
let recognition = null;

// ── EMOTION DETECTION (keyword-based) ───────────────────────
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (/happy|joy|great|wonderful|amazing|awesome|glad|elated|😊|😄|சந்தோஷம்|खुशी/.test(t)) return 'joy';
  if (/love|miss|crush|adore|heart|💕|❤️|அன்பு|प्यार/.test(t)) return 'love';
  if (/excited|thrilled|pumped|can't wait|🔥|உற்சாகம்|उत्साह/.test(t)) return 'excited';
  if (/stress|overwhelm|exhaust|burnout|pressure|too much|😓|தகர்|तनाव/.test(t)) return 'stressed';
  if (/sad|cry|tears|depress|lonely|alone|hopeless|😢|😭|சோகம்|दुख/.test(t)) return 'sadness';
  if (/angry|anger|furious|hate|frustrated|mad|😡|🤬|கோபம்|गुस्सा/.test(t)) return 'anger';
  if (/scared|fear|anxious|anxiety|worried|panic|nervous|😰|பயம்|डर/.test(t)) return 'fear';
  return 'neutral';
}

function getIntensity(text) {
  let score = 0.5;
  if (/very|extremely|really|so much|totally|romba|மிகவும்|बहुत/i.test(text)) score += 0.25;
  if ((text.match(/!/g)||[]).length > 1) score += 0.1;
  if (text === text.toUpperCase() && text.length > 4) score += 0.15;
  return Math.min(score, 0.97);
}

// ── UI HELPERS ───────────────────────────────────────────────
function setAura(emotionKey) {
  const color = EMOTION_COLORS[emotionKey] || '#8b5cf6';
  document.documentElement.style.setProperty('--aura', color);
}

function updateEmotionBar(emotionKey, intensity) {
  const e = EMOTIONS[emotionKey] || EMOTIONS.neutral;
  document.getElementById('emotion-bar').style.display = 'flex';
  const nameEl = document.getElementById('emotion-name');
  nameEl.textContent = e.label;
  nameEl.style.color = e.color;
  document.getElementById('emotion-fill').style.width = (intensity * 100) + '%';
  document.getElementById('emotion-fill').style.background = e.color;
  document.getElementById('emotion-pct').textContent = Math.round(intensity * 100) + '%';
}

function showChatScreen() {
  document.getElementById('welcome').style.display = 'none';
  const chat = document.getElementById('chat');
  chat.style.display = 'flex';
  document.getElementById('end-btn').style.display = 'block';
  sessionActive = true;
}

function addMessage(role, text, emotionKey) {
  const chat = document.getElementById('chat');

  // typing indicator
  if (role === 'typing') {
    const d = document.createElement('div');
    d.className = 'msg ai'; d.id = 'typing';
    d.innerHTML = `<div class="avatar">✦</div>
      <div class="typing">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>`;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return;
  }

  document.getElementById('typing')?.remove();

  const d = document.createElement('div');
  d.className = `msg ${role}`;

  if (role === 'user') {
    const e = EMOTIONS[emotionKey];
    const tag = (e && emotionKey !== 'neutral')
      ? `<div class="emotion-tag" style="color:${e.color};background:${e.color}18">${e.label}</div>` : '';
    d.innerHTML = `
      <div class="avatar">Y</div>
      <div>
        <div class="bubble">${safe(text)}</div>
        ${tag}
      </div>`;
  } else {
    d.innerHTML = `
      <div class="avatar">✦</div>
      <div class="bubble">${text.replace(/\n/g,'<br>')}</div>`;
  }

  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function safe(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── SEND MESSAGE ─────────────────────────────────────────────
async function sendMessage(override) {
  const input = document.getElementById('user-input');
  const text = (override || input.value).trim();
  if (!text || isLoading) return;

  if (!sessionActive) showChatScreen();

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;

  const emotion = detectEmotion(text);
  const intensity = getIntensity(text);
  setAura(emotion);
  updateEmotionBar(emotion, intensity);
  addMessage('user', text, emotion);
  history.push({ role: 'user', content: text });

  isLoading = true;
  addMessage('typing');

  try {
    const reply = await callAI(text, emotion);
    addMessage('ai', reply);
    history.push({ role: 'assistant', content: reply });
  } catch (err) {
    addMessage('ai', "I'm here with you. Please share again — I'm listening.");
    console.error(err);
  }
  isLoading = false;
}

// ── AI CALL (Anthropic API) ──────────────────────────────────
async function callAI(userText, emotion) {
  const emotionLabel = EMOTIONS[emotion]?.label || 'Neutral';

  const system = `You are Aura — a warm, private emotional companion AI.

WHO YOU ARE:
- Not a therapist. A caring friend who listens without judgment.
- You hold space for ALL emotions: joy, sadness, anger, stress, love, excitement — everything.
- Never give unsolicited advice. Reflect, validate, ask one gentle question.

LANGUAGE RULE (MOST IMPORTANT):
Detect what language the user writes in and reply in THAT EXACT LANGUAGE.
Tamil → reply Tamil. Hindi → reply Hindi. English → reply English. Mixed → match their mix.

DETECTED EMOTION: ${emotionLabel}

PRIVACY: Never ask names, locations, or personal details.

STYLE:
- Short and warm (3–5 sentences).
- Acknowledge their emotion genuinely first.
- Do NOT start with "I understand" or "I hear you".
- End with one gentle open question.
- Never say "as an AI".

SAFETY: If someone mentions self-harm or suicide, respond with warmth and gently mention:
iCall India: 9152987821 or Vandrevala Foundation: 1860-2662-345`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system,
      messages: history.slice(-10),
    })
  });

  if (!res.ok) throw new Error('API failed');
  const data = await res.json();
  return data.content?.[0]?.text || "I'm here with you.";
}

// ── VOICE / MIC ──────────────────────────────────────────────
function toggleMic() {
  isRecording ? stopMic() : startMic();
}

function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Use Chrome browser for voice feature.'); return; }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'ta-IN';

  isRecording = true;
  document.getElementById('mic-btn').classList.add('recording');

  recognition.onresult = e => {
    const t = Array.from(e.results).map(r => r[0].transcript).join('');
    const input = document.getElementById('user-input');
    input.value = t;
    document.getElementById('send-btn').disabled = !t.trim();
    autoResize(input);
  };

  recognition.onend = () => {
    stopMic();
    const val = document.getElementById('user-input').value.trim();
    if (val) sendMessage();
  };

  recognition.onerror = () => stopMic();
  recognition.start();
}

function stopMic() {
  isRecording = false;
  document.getElementById('mic-btn').classList.remove('recording');
  recognition?.stop();
}

// ── SESSION MANAGEMENT (PRIVACY CORE) ────────────────────────
function endSession() {
  // Wipe all data — nothing stored anywhere
  history = [];
  sessionActive = false;

  document.getElementById('chat').innerHTML = '';
  document.getElementById('chat').style.display = 'none';
  document.getElementById('emotion-bar').style.display = 'none';
  document.getElementById('end-btn').style.display = 'none';
  document.getElementById('end-screen').style.display = 'flex';
  document.getElementById('input-area').style.display = 'none';
}

function newSession() {
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('welcome').style.display = 'flex';
  document.getElementById('input-area').style.display = 'block';
  document.getElementById('user-input').value = '';
  document.getElementById('send-btn').disabled = true;
  document.documentElement.style.setProperty('--aura', '#8b5cf6');
}

// ── INPUT HELPERS ─────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  document.getElementById('send-btn').disabled = !el.value.trim();
}

function quickSend(text) {
  document.getElementById('user-input').value = text;
  document.getElementById('send-btn').disabled = false;
  sendMessage();
}

// Clear everything if tab closes (privacy)
window.addEventListener('beforeunload', () => { history = []; });