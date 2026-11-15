// buildPack: produce a single self-contained offline HTML study pack.
// Everything (text, styles, script, quiz) is inlined - the file works with no
// network, which is the whole point: study on a plane, a bus, a dead zone.
import { readingStats, glossaryCandidates } from './words.mjs';

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Split into readable chunks of ~120-180 words at sentence boundaries.
function chunkText(text) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) || [text];
  const chunks = [];
  let cur = '', curWords = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).length;
    if (curWords + w > 170 && curWords >= 90) { chunks.push(cur.trim()); cur = s; curWords = w; }
    else { cur += s; curWords += w; }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

// Rule-based quiz: find sentences containing glossary words, blank the word.
function buildQuiz(text, glossary) {
  const questions = [];
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [];
  for (const g of glossary) {
    if (questions.length >= 5) break;
    const re = new RegExp(`\\b${g.word.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const sentence = sentences.find(s => re.test(s) && s.split(/\s+/).length > 8 && s.length < 260);
    if (!sentence) continue;
    const blanked = sentence.replace(re, '_____');
    // distractors: other glossary words, else generic
    const others = glossary.filter(o => o.word.toLowerCase() !== g.word.toLowerCase()).map(o => o.word);
    while (others.length < 3) others.push(['topic', 'detail', 'example', 'summary'][others.length]);
    const options = [g.word, ...others.slice(0, 3)].sort(() => Math.random() - 0.5);
    questions.push({ sentence: blanked.trim(), options, answer: g.word });
  }
  return questions;
}

export function buildPack({ title, text, fromUrl }) {
  const stats = readingStats(text);
  const chunks = chunkText(text);
  const glossary = glossaryCandidates(text, 12);
  const quiz = buildQuiz(text, glossary);

  const data = JSON.stringify({ title, fromUrl, chunks, glossary, quiz, stats })
    .replace(/<\/script/gi, '<\\/script');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - PocketPack</title>
<style>
:root{--bg:#fdfbf7;--fg:#1c1c1c;--accent:#2b5ea7;--card:#ffffff;--line:#e3ddd0;}
*{box-sizing:border-box}
body{margin:0;font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--fg);line-height:1.75;font-size:19px}
body.dyslexic{font-family:'Comic Sans MS','Chalkboard SE',sans-serif;letter-spacing:.06em;word-spacing:.12em;line-height:2.05}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:.6rem 1rem;z-index:10}
.bar{max-width:46rem;margin:0 auto;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
h1{font-size:1.15rem;margin:0;flex:1 1 100%}
.controls{display:flex;flex-wrap:wrap;gap:.4rem}
button{font:inherit;font-size:.85rem;padding:.35rem .8rem;border:1px solid var(--line);border-radius:999px;background:var(--card);cursor:pointer}
button:hover{border-color:var(--accent)}
button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
main{max-width:46rem;margin:0 auto;padding:1.2rem 1rem 4rem}
.meta{font-size:.8rem;color:#666;margin-bottom:1.5rem}
.chunk{display:none}
.chunk.active{display:block;animation:fade .25s}
@keyframes fade{from{opacity:0}to{opacity:1}}
.chunk p{margin:0 0 1.1rem}
.nav{display:flex;justify-content:space-between;align-items:center;margin:1.6rem 0;gap:.6rem}
.prog{font-size:.8rem;color:#666}
section.panel{display:none;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.2rem 1.4rem;margin-bottom:1rem}
section.panel.active{display:block}
h2{font-size:1.05rem;margin:0 0 .8rem}
mark{background:#fff3a3;padding:0 .1em;border-radius:2px}
.gw{border-bottom:2px dotted var(--accent);cursor:help}
.quiz-opt{display:block;width:100%;text-align:left;margin:.35rem 0;border-radius:8px;padding:.55rem .9rem}
.quiz-opt.correct{background:#d7f5dd;border-color:#3a9e4f}
.quiz-opt.wrong{background:#fbdede;border-color:#c0453e}
.feedback{font-size:.9rem;margin-top:.5rem}
.big-text{font-size:22px}
@media(prefers-color-scheme:dark){:root{--bg:#16161a;--fg:#e8e4dc;--card:#1f1f24;--line:#33333a;--accent:#7aa2e3}mark{background:#6b5d1f}}
</style>
</head>
<body>
<header><div class="bar">
<h1 id="ptitle"></h1>
<div class="controls">
<button id="bRead" title="Read the current chunk aloud">&#9654; Read aloud</button>
<button id="bFont" title="Dyslexia-friendly font and spacing">Aa Dyslexia font</button>
<button id="bSize" title="Bigger text">A+</button>
<button id="bGloss" title="Hard words in this text">Glossary</button>
<button id="bQuiz" title="Test yourself">Quiz</button>
</div></div></header>
<main>
<div class="meta" id="pmeta"></div>
<section class="panel" id="glossPanel"><h2>Glossary - hard words in this text</h2><div id="glossBody"></div></section>
<section class="panel" id="quizPanel"><h2>Quick self-quiz</h2><div id="quizBody"></div></section>
<div id="chunks"></div>
<div class="nav">
<button id="bPrev">&larr; Previous part</button>
<span class="prog" id="prog"></span>
<button id="bNext">Next part &rarr;</button>
</div>
</main>
<script id="pack-data" type="application/json">${data}</script>
<script>
const D = JSON.parse(document.getElementById('pack-data').textContent);
let idx = 0, speaking = false, bigText = false;
const $ = id => document.getElementById(id);
document.title = D.title + ' - PocketPack';
$('ptitle').textContent = D.title;
$('pmeta').textContent = '~' + D.stats.words + ' words - ' + D.chunks.length + ' parts - about ' + D.stats.minutes + ' min to read' + (D.fromUrl ? ' - source: ' + D.fromUrl : '') + ' - works fully offline';

const glossWords = D.glossary.map(g => g.word.toLowerCase());
function markHard(text){
  let out = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  for (const g of D.glossary){
    const re = new RegExp('\\\\b(' + g.word.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&') + ')\\\\b','gi');
    out = out.replace(re, '<span class="gw" title="Hard word - see Glossary">$1</span>');
  }
  return out;
}
function render(){
  const box = $('chunks'); box.innerHTML = '';
  D.chunks.forEach((c,i)=>{
    const d = document.createElement('div');
    d.className = 'chunk' + (i===idx?' active':'');
    d.innerHTML = '<p>' + markHard(c).replace(/\\n{2,}/g,'</p><p>').replace(/\\n/g,'<br>') + '</p>';
    box.appendChild(d);
  });
  $('prog').textContent = 'Part ' + (idx+1) + ' of ' + D.chunks.length;
  $('bPrev').disabled = idx===0; $('bNext').disabled = idx===D.chunks.length-1;
  window.scrollTo({top:0,behavior:'smooth'});
}
function show(panel){
  for (const id of ['glossPanel','quizPanel']) $(id).classList.toggle('active', id===panel && !$(id).classList.contains('active'));
}
$('bPrev').onclick = ()=>{ if(idx>0){idx--; render(); stopSpeech();} };
$('bNext').onclick = ()=>{ if(idx<D.chunks.length-1){idx++; render(); stopSpeech();} };
$('bFont').onclick = e=>{ document.body.classList.toggle('dyslexic'); e.target.classList.toggle('on'); };
$('bSize').onclick = e=>{ bigText=!bigText; document.body.classList.toggle('big-text',bigText); e.target.classList.toggle('on'); };
function stopSpeech(){ if(window.speechSynthesis){ speechSynthesis.cancel(); speaking=false; $('bRead').innerHTML='&#9654; Read aloud'; } }
$('bRead').onclick = ()=>{
  if(!window.speechSynthesis){ alert('Read-aloud is not available in this browser.'); return; }
  if(speaking){ stopSpeech(); return; }
  const u = new SpeechSynthesisUtterance(D.chunks[idx]);
  u.rate = 0.95;
  u.onend = ()=>{ speaking=false; $('bRead').innerHTML='&#9654; Read aloud'; };
  speechSynthesis.speak(u); speaking=true; $('bRead').innerHTML='&#9632; Stop';
};
$('bGloss').onclick = ()=>{
  const b = $('glossBody');
  if(!b.dataset.done){
    b.innerHTML = D.glossary.length
      ? '<p style="font-size:.85rem;color:#666">These longer, less common words appear in the text. Look them up before or while reading - the pack works offline, so keep a dictionary tab or app handy if you can.</p><ul>' +
        D.glossary.map(g=>'<li><strong>'+g.word+'</strong> - appears '+g.count+'x</li>').join('') + '</ul>'
      : '<p>No unusually hard words found - nice accessible read.</p>';
    b.dataset.done = '1';
  }
  show('glossPanel');
};
$('bQuiz').onclick = ()=>{
  const b = $('quizBody');
  if(!b.dataset.done){
    if(!D.quiz.length){ b.innerHTML = '<p>Could not build quiz questions from this text.</p>'; }
    else {
      b.innerHTML = D.quiz.map((q,i)=>
        '<div style="margin-bottom:1.2rem"><p><strong>'+(i+1)+'.</strong> '+q.sentence.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>'+
        q.options.map(o=>'<button class="quiz-opt" data-q="'+i+'" data-o="'+o.replace(/"/g,'&quot;')+'">'+o+'</button>').join('')+
        '<div class="feedback" id="fb'+i+'"></div></div>').join('');
      b.addEventListener('click', e=>{
        const btn = e.target.closest('.quiz-opt'); if(!btn) return;
        const q = D.quiz[+btn.dataset.q], fb = $('fb'+btn.dataset.q);
        const ok = btn.dataset.o === q.answer;
        btn.classList.add(ok?'correct':'wrong');
        fb.textContent = ok ? 'Correct - well done.' : 'Not quite - the answer is "' + q.answer + '". Re-read that part if it helps.';
      });
    }
    b.dataset.done='1';
  }
  show('quizPanel');
};
render();
</script>
</body>
</html>`;

  return { title, html, stats: { ...stats, chunks: chunks.length, glossary: glossary.length, quiz: quiz.length, bytes: Buffer.byteLength(html) } };
}
