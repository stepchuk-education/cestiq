/* CestIQ — main app. Loaded by boot.js after DATA (bank + content) and Store are ready. */
(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const dev = $('#dev');
const ST = Store, P = () => ST.S.profile;
const BANK = DATA.bank, SEC = {}; BANK.sections.forEach(s => SEC[s.id] = s);
const TOP = {}; BANK.topics.forEach(t => TOP[t.id] = t);
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');

/* ---------- i18n ---------- */
let L = P().lang || 'ua';
const t = (k, vars) => {
  let s = S[L][k] ?? S.ua[k] ?? k;
  if (typeof s === 'string') {
    s = s.replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, f, m) => P().gender === 'm' ? m : f);
    if (L === 'ua' && P().gender === 'm') s = s.replace('готова', 'готовий').replace('Готова', 'Готовий');
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
  }
  return s;
};
const trOf = g => L === 'en' ? g.en : g.ua;
const nameOf = o => L === 'sk' ? o.sk : (L === 'en' ? o.en : o.ua);
function applyI18n(anim) {
  const run = () => {
    $$('[data-i]').forEach(e => e.innerHTML = t(e.dataset.i));
    $$('[data-al]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.al)); e.title = t(e.dataset.al); });
    $('#dq').placeholder = t('search'); $('#langCode').textContent = L.toUpperCase();
    $$('.lang .pop button').forEach(b => b.classList.toggle('on', b.dataset.l === L));
    document.documentElement.lang = L === 'ua' ? 'uk' : L;
    renderCats(); renderTerms(); renderHome(false); renderBento();
    if (cur === 'cards') buildDeck();
    if (TABS.includes(cur)) requestAnimationFrame(() => moveInd(cur));
  };
  if (!anim) return run();
  dev.classList.add('fadeT'); setTimeout(() => { run(); dev.classList.remove('fadeT'); }, 230);
}
function setLang(l) { L = l; P().lang = l; ST.save(); applyI18n(true); }
$('#langBtn').onclick = e => { e.stopPropagation(); $('#lang').classList.toggle('open'); vib(6); };
$$('.lang .pop button').forEach(b => b.onclick = e => { e.stopPropagation(); $('#lang').classList.remove('open'); vib(10); setLang(b.dataset.l); });
document.addEventListener('click', () => $('#lang').classList.remove('open'));

/* ---------- toast & sheets ---------- */
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1900); }
function openSheet(html, onClose) {
  const sh = $('#psheet'); sh.innerHTML = '<div class="grab"></div>' + html; sh.classList.add('on'); $('#scrim').classList.add('on');
  $('#scrim').onclick = () => { closeSheet(); onClose && onClose(); };
  return sh;
}
function closeSheet() { $('#psheet').classList.remove('on'); $('#scrim').classList.remove('on'); }
function confirmDlg(msg, yes) {
  const sh = openSheet(`<p class="dlg">${esc(msg)}</p><div class="duo2"><button class="cta ghost" data-no>${t('cancel')}</button><button class="cta" data-yes>${t('ok')}</button></div>`);
  sh.querySelector('[data-no]').onclick = closeSheet; sh.querySelector('[data-yes]').onclick = () => { closeSheet(); yes(); };
}

/* ---------- phases ---------- */
const PH = ['#F0492B', '#FF7A1A', '#17B47A'];
const phaseOf = v => ST.phaseOf(v);
let IQ = ST.cestiq();
function count(el, from, to, dur, dec = 0, onStep) { const t0 = performance.now(); const st = n => { const k = Math.min(1, (n - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e; el.textContent = fmt(v, dec); if (onStep) onStep(v); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }

/* ---------- views ---------- */
let cur = null; const TABS = ['home', 'topics', 'cards', 'dict'];
function show(id) {
  if (id === cur) return;
  dockGo(id === 'home');
  window.SCN && SCN.pause(!['home', 'intro'].includes(id));
  $('#mute').style.display = ['home', 'intro'].includes(id) ? 'grid' : 'none';
  if (cur) $('#' + cur).classList.remove('on');
  $('#' + id).classList.add('on'); cur = id;
  const tab = TABS.includes(id); $('#tabs').classList.toggle('hide', !tab); $('#bfade').classList.toggle('hide', !tab);
  if (tab) moveInd(id);
  $('#pill').style.opacity = 0; removeTip();
  if (id === 'cards') buildDeck();
  if (id === 'topics') { renderBento(); animateBento(); }
  if (id === 'dict') { renderCats(); renderTerms(); }
  if (id === 'home') renderHome(false);
}
function dockGo(on) { $('#tabs').classList.toggle('docked', on); $('#start').classList.toggle('on', on);[120, 300, 500].forEach(d => setTimeout(() => cur && TABS.includes(cur) && moveInd(cur), d)); }
function moveInd(id) { const b = $(`[data-tab="${id}"]`); $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); const ind = $('#ind'); ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; }
$$('[data-tab]').forEach(b => b.onclick = () => { vib(8); show(b.dataset.tab); });

/* ---------- scene bridge ---------- */
const scn = () => window.SCN;
let lastTick = -1;
function animateGauge(from, to, dur = 1300) { count($('#gnum'), from, to, dur, 0, v => { const tk = Math.floor(v / 5); if (tk !== lastTick) { lastTick = tk; vib(3); } }); scn() && scn().drive(to, dur + 400); $('#pillnum').textContent = Math.round(to); }
function applyPhase(v, flood) {
  const i = phaseOf(v); document.documentElement.style.setProperty('--a', PH[i]);
  $('#status span').textContent = t('ph' + i) + (i === 1 ? ` · ${t('to_gr')} ${Math.ceil(90 - v)}` : i === 0 ? ` · ${t('to_or')} ${Math.ceil(25 - v)}` : '');
  scn() && scn().setPhase(i, flood); if (flood) vib([20, 40, 20]);
}
function rollDigits(el, n, h) { const s = String(n); el.innerHTML = [...s].map(() => `<span>${[...Array(10)].map((_, k) => `<i>${k}</i>`).join('')}</span>`).join(''); requestAnimationFrame(() => requestAnimationFrame(() => [...s].forEach((c, i) => el.children[i].style.transform = `translateY(${-h * +c}px)`))); }

/* ---------- engine sound (synthesised) ---------- */
let AC = null, idleNodes = null, crankNodes = null;
const muted = () => !P().sound;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function noiseBuf(a) { const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function crankStart() {
  if (muted()) return; const a = ac(); if (!a) return;
  const src = a.createBufferSource(); src.buffer = noiseBuf(a); src.loop = true; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 1.2;
  const g = a.createGain(); g.gain.value = 0; const lfo = a.createOscillator(); lfo.frequency.value = 11; const lg = a.createGain(); lg.gain.value = .16; lfo.connect(lg); lg.connect(g.gain);
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = 34; const og = a.createGain(); og.gain.value = .05; o.connect(og); og.connect(a.destination);
  src.connect(bp); bp.connect(g); g.connect(a.destination); src.start(); lfo.start(); o.start(); crankNodes = [src, lfo, o];
}
function crankStop() { if (!crankNodes) return; crankNodes.forEach(n => { try { n.stop(AC.currentTime + .05); } catch (e) { } }); crankNodes = null; }
function engineCatch() {
  if (muted()) return; const a = ac(); if (!a) return; const now = a.currentTime;
  const shaper = a.createWaveShaper(); const cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 3); } shaper.curve = cv;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, now); lp.frequency.linearRampToValueAtTime(900, now + .35); lp.frequency.exponentialRampToValueAtTime(260, now + 1.6);
  const g = a.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.32, now + .08); g.gain.linearRampToValueAtTime(.2, now + .6); g.gain.linearRampToValueAtTime(.07, now + 1.8);
  const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
  [o1, o2].forEach((o, k) => { o.frequency.setValueAtTime(38, now); o.frequency.linearRampToValueAtTime(k ? 118 : 112, now + .32); o.frequency.exponentialRampToValueAtTime(k ? 33 : 31, now + 1.4); });
  const n = a.createBufferSource(); n.buffer = noiseBuf(a); n.loop = true; const nf = a.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500; const ng = a.createGain(); ng.gain.value = .25; n.connect(nf); nf.connect(ng); ng.connect(shaper);
  o1.connect(shaper); o2.connect(shaper); shaper.connect(lp); lp.connect(g); g.connect(a.destination);[o1, o2, n].forEach(x => x.start(now));
  idleNodes = { stop: tt => { g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime); g.gain.linearRampToValueAtTime(0, a.currentTime + tt);[o1, o2, n].forEach(x => x.stop(a.currentTime + tt + .05)); } };
  setTimeout(() => { if (idleNodes) { idleNodes.stop(1.4); idleNodes = null; } }, 2400);
}
function syncMute() { $('#mute').classList.toggle('off', muted()); }
$('#mute').onclick = () => { P().sound = !P().sound; ST.save(); syncMute(); if (muted()) { crankStop(); if (idleNodes) { idleNodes.stop(.3); idleNodes = null; } } };

/* ---------- onboarding (first launch) ---------- */
const OB = { step: 0 };
function renderOnb() {
  const p = P(), s = OB.step;
  const dots = `<div class="obdots">${[0, 1, 2, 3].map(i => `<i class="${i <= s ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (s === 0) body = `<div class="lbl">CestIQ</div><h1 class="obh">${t('ob_hi')}</h1><p class="obp">${t('ob_sub')}</p>
    <div class="lbl" style="margin-top:28px">${t('ob_lang')}</div><p class="obp sm">${t('ob_lang_d')}</p>
    <div class="obopts">${[['ua', 'Українська'], ['sk', 'Slovenčina'], ['en', 'English']].map(([k, n]) => `<button class="obo ${L === k ? 'on' : ''}" data-l="${k}"><b>${k.toUpperCase()}</b>${n}</button>`).join('')}</div>`;
  if (s === 1) body = `<h1 class="obh">${t('ob_name')}</h1><input class="obin" id="obName" maxlength="24" placeholder="${t('ob_name_ph')}" value="${esc(p.name)}" autocomplete="given-name">
    ${L === 'ua' ? `<div class="lbl" style="margin-top:22px">${t('gender')}</div><div class="obopts row"><button class="obo ${p.gender === 'f' ? 'on' : ''}" data-g="f">${t('g_f')}</button><button class="obo ${p.gender === 'm' ? 'on' : ''}" data-g="m">${t('g_m')}</button></div>` : ''}`;
  if (s === 2) body = `<h1 class="obh">${t('ob_exam')}</h1><input class="obin" type="date" id="obDate" value="${p.examDate || ''}" min="${new Date().toISOString().slice(0, 10)}">
    <button class="obo ${!p.examDate ? 'on' : ''}" id="obNoDate" style="margin-top:12px">${t('ob_noexam')}</button>`;
  if (s === 3) { const pl = ST.plan(); body = `<h1 class="obh">${t('ob_min')}</h1><p class="obp sm">${t('ob_min_d')}</p>
    <div class="obopts">${[15, 20, 30, 45, 60].map(m => `<button class="obo ${p.minutes === m ? 'on' : ''}" data-m="${m}"><b>${m}</b>${t('min')}</button>`).join('')}</div>
    <p class="obplan">${t('ob_plan', { w: pl.weeks, n: pl.newPerDay })}</p>`; }
  $('#onbPad').innerHTML = `${dots}<div class="obbody">${body}</div><div class="obnav">${s ? `<button class="cta ghost" id="obBack">${t('back')}</button>` : '<span></span>'}<button class="cta" id="obNext">${s < 3 ? t('ob_next') : t('ob_go')}<b>→</b></button></div>`;
  $$('#onbPad [data-l]').forEach(b => b.onclick = () => { L = b.dataset.l; p.lang = L; ST.save(); applyI18n(false); renderOnb(); });
  $$('#onbPad [data-g]').forEach(b => b.onclick = () => { p.gender = b.dataset.g; ST.save(); renderOnb(); });
  $$('#onbPad [data-m]').forEach(b => b.onclick = () => { p.minutes = +b.dataset.m; ST.save(); renderOnb(); });
  const nm = $('#obName'); if (nm) nm.oninput = () => { p.name = nm.value.trim(); ST.save(); };
  const dt = $('#obDate'); if (dt) dt.onchange = () => { p.examDate = dt.value || null; ST.save(); renderOnb(); };
  const nd = $('#obNoDate'); if (nd) nd.onclick = () => { p.examDate = null; ST.save(); renderOnb(); };
  const bk = $('#obBack'); if (bk) bk.onclick = () => { OB.step--; renderOnb(); };
  $('#obNext').onclick = () => { vib(8); if (OB.step < 3) { OB.step++; renderOnb(); } else { p.onboarded = true; ST.save(true); startIntro(); } };
}

/* ---------- INTRO: hold-to-start ---------- */
let introDone = false;
function startIntro() {
  show('intro'); applyI18n(false);
  document.documentElement.style.setProperty('--a', PH[phaseOf(IQ)]);
}
(function () {
  const el = $('#intro'), btn = $('#startbtn'), ring = $('#ring'), greet = el.querySelector('.greet');
  const C = 414.7, HOLD = 1100; let t0 = null, raf = null, vt = null;
  function tick() { const k = Math.min(1, (performance.now() - t0) / HOLD); ring.style.strokeDashoffset = C * (1 - k); if (k >= 1) { fire(); return; } raf = requestAnimationFrame(tick); }
  function down(e) { if (introDone) return; e.preventDefault(); btn.setPointerCapture && btn.setPointerCapture(e.pointerId); btn.classList.add('down'); t0 = performance.now(); crankStart(); scn() && scn().engine(true); let n = 0; vt = setInterval(() => { vib(12 + n * 2); n++; }, 110); raf = requestAnimationFrame(tick); }
  function up() { if (introDone || t0 == null) return; cancelAnimationFrame(raf); clearInterval(vt); crankStop(); scn() && scn().engine(false); btn.classList.remove('down'); t0 = null; ring.style.transition = 'stroke-dashoffset .4s'; ring.style.strokeDashoffset = C; setTimeout(() => ring.style.transition = '', 420); }
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
  function fire() {
    introDone = true; clearInterval(vt); crankStop(); engineCatch(); vib([30, 40, 18]); setTimeout(() => scn() && scn().engine(false), 650);
    btn.classList.remove('down'); btn.classList.add('on');
    IQ = ST.cestiq(); applyPhase(IQ, false); scn() && scn().lightOn(true);
    setTimeout(() => {
      greet.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-40px)' }], { duration: 500, fill: 'forwards' });
      $('.startwrap').animate([{ opacity: 1, transform: 'translateX(-50%)' }, { opacity: 0, transform: 'translateX(-50%) scale(.6)' }], { duration: 500, fill: 'forwards', easing: 'cubic-bezier(.4,0,.2,1)' });
    }, 350);
    setTimeout(() => { scn() && scn().drive(IQ, 2600); }, 700);
    setTimeout(() => {
      el.style.pointerEvents = 'none'; el.style.opacity = 0;
      show('home'); scn() && scn().lane && scn().lane(1, 2600);
      count($('#gnum'), 0, IQ, 1600, 0); rollDigits($('#odo'), ST.streak(), 18);
      [...$('#homeStag').children].forEach((c, i) => c.style.transitionDelay = (i * 110) + 'ms');
      setTimeout(() => $('#homeStag').classList.add('in'), 900);
    }, 1400);
  }
})();

/* ---------- HOME ---------- */
function wordOfDay() {
  const pool = DATA.gloss.filter(g => (L === 'sk' ? g.core_sk : g.core_x) && g.ex);
  return pool[ST.today() % pool.length];
}
function renderHome(anim) {
  IQ = ST.cestiq();
  $('#uname').textContent = P().name || 'CestIQ';
  if (cur === 'home' || anim) { applyPhase(IQ, false); $('#gnum').textContent = Math.round(IQ); }
  $('#pillnum').textContent = Math.round(IQ);
  const tp = ST.todayPlan();
  $('#rMin').textContent = P().minutes;
  const first = tp.neu[0];
  $('#st1s').textContent = tp.neu.length ? t('stop_new_n', { n: tp.neu.length, t: nameOf(TOP[first.t]) }) : t('stop_new_0');
  $('#st2s').textContent = tp.rev.length ? t('stop_rev_n', { n: tp.rev.length }) : t('stop_rev_0');
  $('#st1m').textContent = Math.max(1, Math.round(tp.neu.length * 30 / 60));
  $('#st2m').textContent = Math.max(tp.rev.length ? 1 : 0, Math.round(tp.rev.length * 11 / 60));
  $('#st1').classList.toggle('cur', !!tp.neu.length); $('#st2').classList.toggle('cur', !tp.neu.length && !!tp.rev.length); $('#st3').classList.toggle('cur', !tp.neu.length && !tp.rev.length);
  if (P().examDate) { const d = Math.max(0, Math.ceil((new Date(P().examDate) - new Date()) / 864e5)); $('#mockDays').innerHTML = `${d} <span style="font-size:16px">${t('days')}</span>`; $('#mockSub').textContent = t('mock_s'); }
  else { $('#mockDays').innerHTML = '40 <span style="font-size:16px">' + (L === 'en' ? 'q.' : L === 'sk' ? 'ot.' : 'пит.') + '</span>'; $('#mockSub').textContent = t('mock_none'); }
  const w = wordOfDay(); if (w) { $('#wodSk').textContent = w.sk; $('#wodTr').textContent = L === 'sk' ? (w.def || '').split(/[,;.]/)[0] : trOf(w); $('#wod').dataset.sk = w.sk; }
  if (cur === 'home') rollDigits($('#odo'), ST.streak(), 18);
}
$('#homePad').addEventListener('scroll', e => { const s = e.target.scrollTop, k = Math.min(1, s / 240); $('#hero').style.opacity = 1 - k * 1.2; const pill = $('#pill'); pill.style.opacity = k > .85 ? 1 : 0; pill.style.transform = `translate(-50%,${k > .85 ? 0 : -30}px)`; });
$('#wod').onclick = () => { vib(8); show('dict'); openTermBySk($('#wod').dataset.sk); };
$('#mock').onclick = () => { vib(8); examIntro(); };
$('#who').onclick = () => { vib(6); openSettings(); };
$('#start').onclick = () => { vib(10); startDaily(); };

/* ---------- TOPICS (living blocks) ---------- */
const SIZES = ['xl', 't2', '', '', 'w', '', '', '', '', ''];
function renderBento() {
  const act = ST.activity();
  const any = Object.values(act).some(v => v > 0);
  const sorted = [...BANK.sections].filter(s => (ST.SECQ[s.id] || []).length).sort((a, b) => (act[b.id] - act[a.id]) || (a.id - b.id));
  $('#bento').innerHTML = sorted.map((s, r) => {
    const a = act[s.id] || 0, v = Math.round(ST.sectionScore(s.id) * 100), pc = Math.round(Math.pow(a, 1.3) * 82);
    const tag = any && r === 0 ? `<span class="tag hot">● ${t('focus')}</span>` : any && r === 1 && a > .15 ? `<span class="tag">↗ ${t('related')}</span>` : '';
    return `<button class="tile ${SIZES[r] || ''} ${any && r === 0 ? 'focus' : ''}" data-s="${s.id}" style="--p:${pc}%"><div><div class="n">${String(s.id).padStart(2, '0')}${tag}</div><div class="nm">${esc(nameOf(s))}</div></div><div><div class="v">${v}<small>/100</small></div><div class="bar"><i style="width:${v}%"></i></div></div></button>`;
  }).join('');
}
function animateBento() { $$('#bento .tile').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(18px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60 + i * 45, easing: 'cubic-bezier(.2,.9,.3,1.1)', fill: 'backwards' })); }
document.addEventListener('click', e => { const tl = e.target.closest('#bento .tile'); if (tl) openSection(tl); });
function openSection(tile) {
  vib(10); const sid = +tile.dataset.s, s = SEC[sid], r = tile.getBoundingClientRect(), D = dev.getBoundingClientRect();
  const ex = document.createElement('div'); ex.className = 'expand'; const cs = getComputedStyle(tile); ex.style.background = cs.backgroundColor; ex.style.color = cs.color;
  Object.assign(ex.style, { left: r.left - D.left + 'px', top: r.top - D.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '22px' });
  const tops = BANK.topics.filter(tp => tp.s === sid).map(tp => ({ tp, st: ST.topicStats(tp.id) })).filter(x => x.st.n);
  const v = Math.round(ST.sectionScore(sid) * 100);
  ex.innerHTML = `<div class="xin"><button class="lbl" id="xback" style="color:inherit;opacity:.7">${t('back_t')}</button>
   <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px"><div><div class="lbl" style="color:inherit;opacity:.6">${String(sid).padStart(2, '0')}${L !== 'sk' ? ' · ' + esc(s.sk) : ''}</div><div style="font:800 30px/1.05 IT;letter-spacing:-.03em;margin-top:6px;max-width:250px">${esc(nameOf(s))}</div></div><div style="font:800 52px/1 IT;letter-spacing:-.05em">${v}</div></div>
   <div class="lbl" style="color:inherit;opacity:.6;margin-top:24px">${t('lessons')}</div>
   <div class="lessons">${tops.map(({ tp, st }) => `<button class="lesson" data-t="${tp.id}" style="opacity:0"><span class="led ${st.mastered >= st.n ? '' : st.learned ? 'half' : 'off'}"></span><div style="flex:1;font-weight:650;text-align:left">${esc(nameOf(tp))}<div class="mono" style="font-size:11px;opacity:.6;margin-top:2px">${st.learned}/${st.n}${st.mastered >= st.n ? ' · ' + t('passed') : ''}</div></div><span style="opacity:.5">→</span></button>`).join('')}</div>
   <button class="cta xcta" id="xlearn">${t('learn')}<b>→</b></button></div>`;
  dev.appendChild(ex); $('#tabs').classList.add('hide'); tile.style.visibility = 'hidden';
  ex.animate([{ left: ex.style.left, top: ex.style.top, width: ex.style.width, height: ex.style.height, borderRadius: '22px' }, { left: '0px', top: '0px', width: D.width + 'px', height: D.height + 'px', borderRadius: getComputedStyle(dev).borderRadius }], { duration: 560, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' })
    .onfinish = () => { ex.querySelector('.xin').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' }); ex.querySelectorAll('.lesson').forEach((l, i) => l.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: 80 + i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' })); };
  const close = (after) => {
    ex.querySelector('.xin').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }); const r2 = tile.getBoundingClientRect();
    ex.animate([{ left: '0px', top: '0px', width: D.width + 'px', height: D.height + 'px' }, { left: r2.left - D.left + 'px', top: r2.top - D.top + 'px', width: r2.width + 'px', height: r2.height + 'px', borderRadius: '22px' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' }).onfinish = () => { tile.style.visibility = ''; ex.remove(); if (!after) $('#tabs').classList.remove('hide'); };
  };
  ex.querySelector('#xback').onclick = () => close();
  ex.querySelectorAll('.lesson').forEach(b => b.onclick = () => { ex.remove(); tile.style.visibility = ''; startTopic({ topic: b.dataset.t }); });
  ex.querySelector('#xlearn').onclick = () => { ex.remove(); tile.style.visibility = ''; startTopic({ section: sid }); };
}

/* ---------- glossary, lexicon, word popover ---------- */
const GL = DATA.gloss, LEX = DATA.lex, PHR = DATA.phrases, EXPL = DATA.expl, CHIP = DATA.chip || {}, SITS = DATA.sits || {};
const rxSrc = g => g.re.replace(/\((?!\?)/g, '(?:');
const GLI = GL.map(g => ({ ...g, rx: new RegExp('^(?:' + rxSrc(g) + ')', 'iu') })).sort((a, b) => b.re.length - a.re.length);
const GENERIC = new Set(['cest', 'jazd', 'vozidl', 'vodič', 'smie|smú', 'nesmie|nesmú', 'povinn', 'premávk', 'motorov', 'rýchlos', 'značk', 'vpravo|vľavo', 'svetel', 'jazdn(ý|ého|om|ých|é) pruh|pruh']);
const MW = { get o() { return ST.S.myWords; }, has: k => !!ST.S.myWords[k], get: k => ST.S.myWords[k], set(k, v) { ST.S.myWords[k] = v; ST.save(); }, del(k) { delete ST.S.myWords[k]; ST.save(); }, get size() { return Object.keys(ST.S.myWords).length; } };
const glFind = w => GLI.find(g => !GENERIC.has(g.re) && g.rx.test(w));
function hlText(text, trap = []) {
  const lo = text.toLowerCase(), marks = new Array(text.length).fill(false), phr = new Array(text.length).fill(false);
  PHR.forEach(p => { const m = new RegExp(p[0], 'i').exec(text); if (m) for (let k = m.index; k < m.index + m[0].length; k++) phr[k] = true; });
  trap.forEach(tp => { const i = lo.indexOf(tp.toLowerCase()); if (i >= 0) for (let k = i; k < i + tp.length; k++) marks[k] = true; });
  let pos = 0, used = 0; const seen = new Set();
  return text.split(/(\s+)/).map(tok => {
    const st = pos; pos += tok.length; if (/^\s+$/.test(tok)) return tok;
    const w = tok.replace(/[.,:;?!„“"()]/g, ''); let g = null;
    if (used < 3) { g = glFind(w); if (g && !seen.has(g.id)) { seen.add(g.id); used++; } else g = null; }
    const mid = st + Math.floor(tok.length / 2), isNum = /^\d/.test(w);
    const tap = !isNum && (L === 'sk' ? !!(g && g.def) : (g || LEX[w.toLowerCase()] || phr[mid]));
    return `<span class="w${marks[mid] ? ' trap' : ''}"><span class="${tap ? 'tw' : ''}${g && (L !== 'sk' || g.def) ? ' gl' : ''}" data-w="${esc(w.toLowerCase())}"${g ? ` data-g="${g.id}"` : ''}>${esc(tok)}</span></span>`;
  }).join('');
}
function resolveSk(x) {
  const k = String(x).toLowerCase().trim();
  if (L === 'sk') { const g = GL.find(g => g.sk.toLowerCase() === k && g.def); return g ? { sk: g.sk, def: g.def, ex: g.ex } : null; }
  if (CHIP[k]) return { sk: x, tr: L === 'en' ? CHIP[k][1] : CHIP[k][0] };
  const g = GL.find(g => g.sk.toLowerCase() === k); if (g) return { sk: g.sk, tr: trOf(g), ex: g.ex };
  const ph = PHR.find(p => p[1].toLowerCase() === k); if (ph) return { sk: ph[1], tr: L === 'en' ? ph[3] : ph[2] };
  return null;
}
const chips = txt => txt.replace(/\[\[(.+?)\]\]/g, (_, x) => /^\d/.test(x) ? esc(x) : resolveSk(x) ? `<span class="chipk tw" data-sk="${esc(x)}">${esc(x)}</span>` : `<span class="skx">${esc(x)}</span>`);
function entryFor(el) {
  const sk = el.dataset.sk, w = el.dataset.w;
  if (sk) return resolveSk(sk);
  if (el.dataset.g) { const g = GL.find(x => x.id === +el.dataset.g); if (L === 'sk') return g.def ? { sk: g.sk, def: g.def, ex: g.ex } : null; return { sk: g.sk, tr: trOf(g), ex: g.ex }; }
  if (L === 'sk') return null;
  const ctx = (el.closest('.qtext') || {}).textContent || '';
  const ph = PHR.find(p => { const m = new RegExp(p[0], 'i').exec(ctx); return m && m[0].toLowerCase().split(/\s+/).includes(w); });
  if (ph) return { sk: ph[1], tr: L === 'en' ? ph[3] : ph[2] };
  const lx = LEX[(w || '').toLowerCase()]; if (lx) return { sk: w, tr: L === 'en' ? lx[2] : lx[1], base: lx[0] };
  return null;
}
let tipEl = null; function removeTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
document.addEventListener('click', e => {
  const el = e.target.closest('.tw'); if (!el) { if (!e.target.closest('.tip')) removeTip(); return; }
  const en = entryFor(el); if (!en) { removeTip(); return; }
  e.stopPropagation(); removeTip(); vib(6); const r = el.getBoundingClientRect(), D = dev.getBoundingClientRect();
  const key = (en.base || en.sk).toLowerCase(), saved = MW.has(key);
  tipEl = document.createElement('div'); tipEl.className = 'tip';
  tipEl.innerHTML = L === 'sk' ? `<b>${esc(en.base || en.sk)}</b><div class="tdef">${esc(en.def || '')}</div><button class="tadd ${saved ? 'on' : ''}">${saved ? t('in_my') : t('add_my')}</button>`
    : `<b>${esc(en.sk)}</b>${en.base && en.base.toLowerCase() !== en.sk.toLowerCase() ? `<span class="tbase">← ${esc(en.base)}</span>` : ''}<div class="ttr">${esc(en.tr)}</div><button class="tadd ${saved ? 'on' : ''}">${saved ? t('in_my') : t('add_my')}</button>`;
  dev.appendChild(tipEl);
  tipEl.querySelector('.tadd').onclick = ev => {
    ev.stopPropagation(); const b = ev.currentTarget;
    if (MW.has(key)) { MW.del(key); b.classList.remove('on'); b.textContent = t('add_my'); }
    else { MW.set(key, { sk: en.base || en.sk, tr: L === 'sk' ? (en.def || '') : en.tr, ex: en.ex || ctxSentence(el), lang: L }); b.classList.add('on'); b.textContent = t('in_my'); vib([8, 30, 8]); pulseDictTab(); }
  };
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight; let x = r.left - D.left + r.width / 2 - tw / 2; x = Math.max(12, Math.min(D.width - tw - 12, x)); let y = r.top - D.top - th - 12; if (y < 60) { y = r.bottom - D.top + 12; tipEl.classList.add('below'); }
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.style.setProperty('--x', (r.left - D.left + r.width / 2 - x) + 'px');
}, true);
function ctxSentence(el) { const q = el.closest('.qtext'); return q ? q.textContent.trim() : ''; }
function pulseDictTab() { const b = $('[data-tab="dict"]'); b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' }); }
function fillSheet(q) {
  const X = EXPL[q.id]; const lang = L === 'sk' ? 'sk' : L === 'en' ? 'en' : 'ua'; const x = X && X[lang];
  if (!x) {
    $('#sTitle').textContent = t('remember'); $('#sAttn').style.display = 'none';
    $('#srule').innerHTML = `<span class="qtext plain">${hlText(q.q)}</span> <b class="ans">${esc(q.a)}</b>`;
    $('.sheet details').style.display = 'none'; return;
  }
  $('#sAttn').style.display = '';
  $('#sTitle').textContent = x.t;
  $('#sKey').innerHTML = resolveSk(x.k) ? `<span class="chipk tw big" data-sk="${esc(x.k)}">${esc(x.k)}</span>` : `<span class="chipk big">${esc(x.k)}</span>`;
  $('#sNote').innerHTML = chips(x.n); $('#srule').innerHTML = chips(x.x); $('#sOff').innerHTML = `${esc(q.q)} <b>${esc(q.a)}</b>`;
  $('.sheet details').open = false; $('.sheet details').style.display = L === 'sk' ? 'none' : 'block';
}

/* ---------- media of a question ---------- */
function mediaHTML(q, live) {
  if (SITS[q.id] && live) return `<div class="sit" id="sit"></div>`;
  if (q.sign) return `<div class="sign3d" id="qsign"><img class="b" src="${q.sign}" alt=""><img class="f" src="${q.sign}" alt=""></div>`;
  if (q.img) return `<img src="${q.img}" id="qimg" class="qimg" alt="">`;
  return '';
}
function animateMedia(first) {
  const sg = $('#qsign'); if (sg) sg.animate([{ transform: 'perspective(700px) rotateX(0) rotateY(0) scale(.85)', opacity: 0 }, { transform: 'perspective(700px) rotateX(16deg) rotateY(-10deg) scale(1.03)', opacity: 1, offset: .6 }, { transform: 'perspective(700px) rotateX(10deg) rotateY(-6deg)', opacity: 1 }], { duration: 900, delay: 100, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  const im = $('#qimg'); if (im) im.animate([{ clipPath: 'inset(50% 50% 50% 50% round 14px)', transform: 'scale(.92)' }, { clipPath: 'inset(0 0 0 0 round 14px)', transform: 'none' }], { duration: 650, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
}

/* ---------- SESSIONS (daily route, topic, practice) ---------- */
let SS = null, sitH = null, streakN = 0, dashPos = 0, lastAnsT = 0;
const optionsFor = q => { const w = q.d.h.length >= 2 ? shuffle(q.d.h.slice(0, 3)).slice(0, 2) : q.d.h.slice(0, 1); return shuffle([q.a, ...w]); };
function buildSteps(neu, rev) {
  const steps = [], rq = [...rev];
  for (let i = 0; i < neu.length; i += 4) {
    const blk = neu.slice(i, i + 4);
    blk.forEach(q => steps.push({ type: 'learn', q }));
    shuffle(blk).forEach(q => steps.push({ type: 'q', q, src: 'new' }));
    rq.splice(0, 5).forEach(q => steps.push({ type: 'q', q, src: 'rev' }));
  }
  rq.forEach(q => steps.push({ type: 'q', q, src: 'rev' }));
  return steps;
}
function startDaily() {
  const tp = ST.todayPlan(); let steps = buildSteps(tp.neu, tp.rev);
  if (!steps.length) {   // nothing due: practise the weakest seen questions
    const seen = ST.Q.filter(q => ST.S.cards[q.id]).sort((a, b) => ST.recall(ST.S.cards[a.id]) - ST.recall(ST.S.cards[b.id]));
    steps = seen.length ? seen.slice(0, 10).map(q => ({ type: 'q', q, src: 'rev' })) : buildSteps(ST.newList().slice(0, 8), []);
  }
  runSession(steps, 'daily');
}
function startTopic({ topic, section }) {
  const pool = ST.Q.filter(q => topic ? q.t === topic : q.s === section);
  const unseen = ST.ORDER.filter(q => (topic ? q.t === topic : q.s === section) && !ST.S.cards[q.id]).slice(0, 8);
  let steps;
  if (unseen.length) steps = buildSteps(unseen, []);
  else { toast(t('nothing_new')); steps = shuffle(pool).slice(0, 10).map(q => ({ type: 'q', q, src: 'rev' })); }
  runSession(steps, 'topic');
}
function runSession(steps, kind) {
  SS = { steps, i: 0, kind, iq0: ST.cestiq(), total: steps.filter(s => s.type === 'q').length, learnTotal: steps.filter(s => s.type === 'learn').length, learnN: 0, done: 0, requeued: new Set() };
  streakN = 0; $('#combo').classList.remove('on'); $('#road').classList.remove('hot');
  $('#qiq').textContent = fmt(SS.iq0); lastAnsT = Date.now();
  show('quiz'); nextStep(true);
}
$('#qx').onclick = () => { if (sitH) { sitH.destroy(); sitH = null; } $('#sheet').classList.remove('on'); show('home'); };
function road() { $('#rfill').style.width = (SS.total ? SS.done / SS.total * 100 : 0) + '%'; dashPos += 140; $('#rdash').style.backgroundPosition = `${dashPos}px 0`; }
function nextStep(first) {
  if (sitH) { const h = sitH; sitH = null; setTimeout(() => h.destroy(), 400); }
  const s = SS.steps[SS.i];
  if (!s) return finishSession();
  road(); removeTip();
  if (s.type === 'learn') renderLearn(s.q, first); else renderQ(s.q, s.src, first);
}
function headNum(label, n, total) {
  $('#qnum').innerHTML = `<span style="margin-right:6px;font-family:JB">${label}</span><div class="qnum" id="qd" style="display:flex"></div><span style="margin-left:4px;color:var(--mut)">/ ${String(total).padStart(2, '0')}</span>`;
  rollDigits($('#qd'), String(Math.min(total, n)).padStart(2, '0'), 15);
}
function renderLearn(q, first) {
  SS.learnN = (SS.learnN || 0) + 1; headNum(t('learn_new').toUpperCase(), SS.learnN, SS.learnTotal);
  $('#qwrap').innerHTML = `<div class="qcard learncard" id="qc" style="${first ? '' : 'transform:translateX(60px);opacity:0'}">${mediaHTML(q, false)}<div class="lbl" style="margin-bottom:10px">${esc(nameOf(TOP[q.t]))}</div>
    <div class="qtext" id="qt">${hlText(q.q)}</div><div class="learnans">→ ${esc(q.a)}</div>${L !== 'sk' ? `<p class="dhint" style="margin-top:12px">${t('tap_hint')}</p>` : ''}</div>
    <button class="cta" id="gotit" style="margin-top:16px">${t('got_it')}<b>→</b></button>`;
  $('#qpad').scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => { const qc = $('#qc'); qc.style.transform = ''; qc.style.opacity = 1; animateMedia(first); $$('#qt .w').forEach((w, i) => w.style.transitionDelay = 150 + i * 18 + 'ms'); $('#qt').classList.add('in'); }));
  $('#gotit').onclick = () => { vib(8); ST.addTime((Date.now() - lastAnsT) / 1000); lastAnsT = Date.now(); leaveCard(() => { SS.i++; nextStep(false); }); };
}
function leaveCard(cb) {
  const qc = $('#qc'); if (qc) { qc.style.transform = 'translateX(-60px)'; qc.style.opacity = 0; }
  $$('.opt,#gotit').forEach((o, i) => { o.style.transition = 'opacity .3s,transform .4s'; o.style.transitionDelay = i * 40 + 'ms'; o.style.opacity = 0; o.style.transform = 'translateX(-40px)'; });
  setTimeout(cb, 380);
}
function renderQ(q, src, first) {
  headNum(t('q').toUpperCase(), SS.done + 1, SS.total);
  const opts = optionsFor(q);
  $('#qwrap').innerHTML = `<div class="qcard" id="qc" style="${first ? '' : 'transform:translateX(60px);opacity:0'}">${mediaHTML(q, true)}<div class="lbl" style="margin-bottom:10px">${esc(nameOf(SEC[q.s]))}${src === 'rev' ? ' · ↻' : ''}</div><div class="qtext" id="qt">${hlText(q.q, (EXPL[q.id] || {}).trap || [])}</div></div>
    <div class="opts">${opts.map((o, i) => `<button class="opt" data-ok="${o === q.a}" style="opacity:0;transform:translateY(16px)"><span class="k">${'ABC'[i]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>`;
  $('#qpad').scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const qc = $('#qc'); qc.style.transform = ''; qc.style.opacity = 1;
    if (SITS[q.id] && window.SIT) { sitH = SIT.mount($('#sit'), SITS[q.id]); $('#sit').animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    animateMedia(first);
    $$('#qt .w').forEach((w, i) => w.style.transitionDelay = (first ? 150 : 250) + i * 22 + 'ms'); $('#qt').classList.add('in');
    const n = $$('#qt .w').length; $$('.opt').forEach((o, i) => { o.style.transition = 'opacity .45s,transform .6s cubic-bezier(.2,.9,.3,1)'; o.style.transitionDelay = (300 + n * 22 + i * 80) + 'ms'; o.style.opacity = 1; o.style.transform = ''; });
    setTimeout(() => $$('.opt').forEach(o => { o.style.transition = ''; o.style.transitionDelay = ''; }), 1400);
  }));
  let answered = false;
  $$('.opt').forEach(b => {
    b.addEventListener('pointerdown', () => { if (answered) return; b.classList.add('press'); vib(5); });
    b.addEventListener('pointerleave', () => b.classList.remove('press'));
    b.addEventListener('pointerup', e => { if (answered) return; b.classList.remove('press'); answered = true; answer(q, b, e); });
  });
}
function answer(q, b, e) {
  const ok = b.dataset.ok === 'true'; const right = $$('.opt').find(o => o.dataset.ok === 'true'); removeTip(); $('#qt').classList.add('reveal');
  const firstTry = !SS.requeued.has(q.id); if (firstTry) SS.done++;
  const before = ST.cestiq(); ST.grade(q.id, ok ? 2 : 0); ST.addTime((Date.now() - lastAnsT) / 1000); lastAnsT = Date.now(); const after = ST.cestiq();
  if (ok) {
    const r = b.getBoundingClientRect(), x = (e && e.clientX ? e.clientX : r.left + r.width / 2) - r.left, y = (e && e.clientY ? e.clientY : r.top + r.height / 2) - r.top, R = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
    const c = document.createElement('span'); c.className = 'fillc'; Object.assign(c.style, { width: R * 2 + 'px', height: R * 2 + 'px', left: x - R + 'px', top: y - R + 'px' }); b.appendChild(c);
    c.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    b.classList.add('ok'); $$('.opt').forEach(o => o !== b && o.classList.add('dim')); vib(12); flyPlus(b, before, after); streakN++;
    if (streakN >= 3) { $('#combo').textContent = `🔥 ${streakN} ${t('combo')}`; $('#combo').classList.add('on'); $('#road').classList.add('hot'); }
    const go = () => leaveCard(() => { SS.i++; nextStep(false); });
    if (sitH) sitH.play(SITS[q.id].order).then(() => setTimeout(go, 700)); else setTimeout(go, 1300);
  } else {
    streakN = 0; $('#combo').classList.remove('on'); $('#road').classList.remove('hot'); b.classList.add('bad'); vib([25, 40, 25]);
    $('#qiq').textContent = fmt(after);
    if (!SS.requeued.has(q.id)) { SS.requeued.add(q.id); SS.steps.splice(Math.min(SS.steps.length, SS.i + 4), 0, { type: 'q', q, src: 'rev' }); }
    setTimeout(() => { right.classList.add('ok'); $$('.opt').forEach(o => o !== b && o !== right && o.classList.add('dim')); }, 250);
    fillSheet(q);
    if (sitH) setTimeout(() => sitH.play(SITS[q.id].order).then(() => $('#sheet').classList.add('on')), 500); else setTimeout(() => $('#sheet').classList.add('on'), 550);
  }
}
$('#snext').onclick = () => { $('#sheet').classList.remove('on'); setTimeout(() => leaveCard(() => { SS.i++; nextStep(false); }), 250); };
function flyPlus(b, before, after) {
  const d = after - before; if (d <= 0) { $('#qiq').textContent = fmt(after); return; }
  const r = b.getBoundingClientRect(), c = $('#qchip').getBoundingClientRect(), D = dev.getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'plus'; p.textContent = '+' + fmt(d, d < .1 ? 2 : 1); dev.appendChild(p);
  const x0 = r.right - D.left - 70, y0 = r.top - D.top + r.height / 2 - 14, x1 = c.left - D.left + c.width / 2 - 24, y1 = c.top - D.top;
  p.animate([{ transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 }, { transform: `translate(${x0}px,${y0 - 26}px) scale(1.1)`, opacity: 1, offset: .25 }, { transform: `translate(${(x0 + x1) / 2 + 30}px,${(y0 + y1) / 2 - 40}px) scale(1)`, opacity: 1, offset: .6 }, { transform: `translate(${x1}px,${y1}px) scale(.5)`, opacity: .2 }], { duration: 950, easing: 'cubic-bezier(.45,0,.2,1)' })
    .onfinish = () => { p.remove(); count($('#qiq'), before, after, 350, 1); const ch = $('#qchip'); ch.classList.remove('bump'); void ch.offsetWidth; ch.classList.add('bump'); vib(6); };
}
function finishSession() {
  road(); show('done'); const iq = ST.cestiq(), d = iq - SS.iq0;
  $('#dfrom').textContent = fmt(SS.iq0); count($('#dto'), SS.iq0, iq, 1400, 1);
  $('#dsub').textContent = d > 0.005 ? `+${fmt(d, d < .1 ? 2 : 1)} ${t('plus_cestiq')}${iq < 90 ? ` · ${t('left_green')} ${fmt(90 - iq)}` : ''}` : '';
}
$('#dhome').onclick = () => { const from = SS ? SS.iq0 : IQ; show('home'); $('#homePad').scrollTop = 0; const to = ST.cestiq(); animateGauge(from, to, 900); applyPhase(to, phaseOf(to) !== phaseOf(from)); };
$('#dwords').onclick = () => { deckMode = 'words'; $$('#cseg button').forEach(x => x.classList.toggle('on', x.dataset.m === 'words')); $('#cseg').classList.add('r'); show('cards'); };

/* ---------- MOCK EXAM ---------- */
let EX = null;
function examIntro() {
  const last = ST.S.exams.slice(-3).reverse();
  $('#epad').innerHTML = `<div class="qtop"><button class="exx" style="font-size:20px;width:28px">✕</button><div style="flex:1"></div></div>
   <div class="lbl" style="margin-top:26px">${t('mock')}</div><div class="h1">${t('exam_title')}</div><p class="obp" style="margin-top:12px">${t('exam_rules')}</p>
   <div class="eblue">${BANK.sections.map(s => `<div><span>${esc(nameOf(s))}</span><b>${s.exam[0]} × ${s.exam[1]}</b></div>`).join('')}</div>
   ${last.length ? `<div class="lbl" style="margin-top:22px">✓</div>${last.map(x => `<div class="ehist ${x.pass ? 'ok' : ''}"><b>${x.score}</b>/100<span>${new Date(x.d).toLocaleDateString()}</span></div>`).join('')}` : ''}
   <button class="cta" id="estart" style="margin-top:22px">${t('exam_start')}<b>→</b></button>`;
  show('exam'); $('.exx').onclick = () => show('home'); $('#estart').onclick = runExam;
}
function runExam() {
  const items = [];
  for (const s of BANK.sections) shuffle(ST.SECQ[s.id] || []).slice(0, s.exam[0]).forEach(q => items.push({ q, pts: s.exam[1], opts: optionsFor(q), ans: -1 }));
  EX = { items, i: 0, end: Date.now() + 30 * 60e3, t0: Date.now(), timer: null };
  EX.timer = setInterval(() => { const left = (EX.end - Date.now()) / 1000; if (left <= 0) return submitExam(); const el = $('#etm'); if (el) { el.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; el.classList.toggle('late', left < 300); } }, 1000);
  renderExamQ();
}
function renderExamQ() {
  const it = EX.items[EX.i], q = it.q, n = EX.items.length;
  $('#epad').innerHTML = `<div class="qtop"><button class="exx" style="font-size:20px;width:28px">✕</button><span class="chip" id="etm">30:00</span><div style="flex:1"></div><button class="chip egrid">${EX.i + 1}/${n}</button></div>
   <div class="qcard" style="margin-top:16px">${mediaHTML(q, false)}<div class="lbl" style="margin-bottom:10px">${esc(nameOf(SEC[q.s]))} · ${it.pts} b</div><div class="qtext in">${hlText(q.q)}</div></div>
   <div class="opts">${it.opts.map((o, j) => `<button class="opt ${it.ans === j ? 'sel' : ''}" data-j="${j}"><span class="k">${'ABC'[j]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>
   <div class="duo2" style="margin-top:16px"><button class="cta ghost" id="eprev" ${EX.i ? '' : 'disabled'}>${t('back')}</button>${EX.i < n - 1 ? `<button class="cta" id="enext">${t('next')}<b>→</b></button>` : `<button class="cta" id="esub">${t('exam_submit')}<b>✓</b></button>`}</div>`;
  $('#epad').scrollTop = 0;
  $$('#epad .opt').forEach(b => b.onclick = e => { if (e.target.closest('.tw')) return; it.ans = +b.dataset.j; $$('#epad .opt').forEach(x => x.classList.toggle('sel', x === b)); vib(8); if (EX.i < n - 1) setTimeout(() => { EX.i++; renderExamQ(); }, 260); });
  $('#eprev').onclick = () => { EX.i--; renderExamQ(); };
  const nx = $('#enext'); if (nx) nx.onclick = () => { EX.i++; renderExamQ(); };
  const sb = $('#esub'); if (sb) sb.onclick = () => confirmDlg(t('exam_conf'), submitExam);
  $('.exx').onclick = () => confirmDlg(t('exam_conf'), submitExam);
  $('.egrid').onclick = () => {
    const sh = openSheet(`<div class="lbl">${t('q')}</div><div class="egridw">${EX.items.map((x, k) => `<button data-k="${k}" class="${k === EX.i ? 'cur' : x.ans >= 0 ? 'done' : ''}">${k + 1}</button>`).join('')}</div><button class="cta" id="esub2" style="margin-top:16px">${t('exam_submit')} (${EX.items.filter(x => x.ans >= 0).length}/${n})<b>✓</b></button>`);
    sh.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { EX.i = +b.dataset.k; closeSheet(); renderExamQ(); });
    sh.querySelector('#esub2').onclick = () => { closeSheet(); confirmDlg(t('exam_conf'), submitExam); };
  };
  const left = (EX.end - Date.now()) / 1000; $('#etm').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
}
function submitExam() {
  if (!EX || EX.over) return; EX.over = true; clearInterval(EX.timer);
  let score = 0; const by = {};
  EX.items.forEach(it => { const ok = it.ans >= 0 && it.opts[it.ans] === it.q.a; it.ok = ok; if (ok) score += it.pts; const b = by[it.q.s] || (by[it.q.s] = { got: 0, max: 0 }); b.max += it.pts; if (ok) b.got += it.pts; ST.grade(it.q.id, ok ? 2 : 0); });
  const secs = Math.round((Date.now() - EX.t0) / 1000), pass = score >= 90;
  ST.S.exams.push({ d: Date.now(), score, pass, secs }); ST.save(true);
  const wrong = EX.items.filter(x => !x.ok);
  $('#epad').innerHTML = `<div class="eres ${pass ? 'pass' : ''}"><div class="lbl" style="color:inherit;opacity:.7">${t('exam_title')}</div><div class="escore">${score}<small>/100</small></div><div class="eresult">${pass ? t('exam_pass') : t('exam_fail')}</div><div class="mono" style="opacity:.7;font-size:12px">${t('time')} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · min. 90</div></div>
   <div class="eblue">${BANK.sections.map(s => { const b = by[s.id]; if (!b) return ''; const r = b.got / b.max; return `<div class="ebar"><span>${esc(nameOf(s))}</span><b>${b.got}/${b.max}</b><i style="--w:${r * 100}%;--c:${r === 1 ? 'var(--go)' : r < .7 ? '#bdbdb8' : 'var(--a)'}"></i></div>`; }).join('')}</div>
   ${wrong.length ? `<div class="lbl" style="margin-top:20px">${t('weak_found')} · ${wrong.length}</div>${wrong.map(x => `<div class="ewrong">${x.q.sign ? `<img src="${x.q.sign}" alt="">` : ''}<div class="qtext plain">${hlText(x.q.q)}</div>${x.ans >= 0 ? `<div class="emy">${esc(x.opts[x.ans])}</div>` : ''}<div class="eright">→ ${esc(x.q.a)}</div></div>`).join('')}` : ''}
   <button class="cta" id="ehome" style="margin-top:20px">${t('home')}<b>→</b></button>`;
  $('#epad').scrollTop = 0; $('#ehome').onclick = () => { EX = null; show('home'); };
}

/* ---------- CARDS ---------- */
let deckIdx = 0, known = 0, deckMode = 'rules', DECK = [];
const markEx = (ex, re) => { if (!ex) return ''; try { return esc(ex).replace(new RegExp('(?<![\\p{L}])(?:' + re + ')\\p{L}*', 'iu'), m => `<mark>${m}</mark>`); } catch (e) { return esc(ex); } };
function wordDeck() {
  const mine = Object.values(MW.o).filter(w => (w.lang || L) === L || L !== 'sk').map(w => ({ kind: 'w', sk: w.sk, tr: w.tr, ex: w.ex, re: w.sk.split(' ')[0].slice(0, 5) }));
  const pool = GL.filter(g => (L === 'sk' ? g.core_sk : g.core_x) && g.ex && !MW.has(g.sk.toLowerCase()));
  const off = ST.today() * 5 % Math.max(1, pool.length);
  const core = [...pool.slice(off), ...pool.slice(0, off)].slice(0, 10).map(g => ({ kind: 'w', sk: g.sk, tr: L === 'sk' ? g.def : trOf(g), ex: g.ex, re: rxSrc(g) }));
  return [...shuffle(mine), ...core].slice(0, 14);
}
function ruleDeck() {
  const seen = ST.Q.filter(q => ST.S.cards[q.id]).sort((a, b) => ST.recall(ST.S.cards[a.id]) - ST.recall(ST.S.cards[b.id]));
  const pool = seen.length >= 6 ? seen.slice(0, 15) : [...seen, ...ST.newList().slice(0, 12 - seen.length)];
  return pool.map(q => ({ kind: 'r', id: q.id, q: q.q, a: q.a, sign: q.sign, img: q.img }));
}
function buildDeck() { deckIdx = 0; known = 0; DECK = deckMode === 'rules' ? ruleDeck() : wordDeck(); renderDeck(); }
$$('#cseg button').forEach(b => b.onclick = () => { deckMode = b.dataset.m; $$('#cseg button').forEach(x => x.classList.toggle('on', x === b)); $('#cseg').classList.toggle('r', deckMode === 'words'); vib(6); buildDeck(); });
function cardHTML(c) {
  if (c.kind === 'w') return `<div class="inner"><div class="face front"><div class="stamp l">${t('again')}</div><div class="stamp r">${t('know')}</div><div class="lbl">${t('words_seg')}</div><div style="flex:1"></div><div style="font:800 34px/1.05 IT;letter-spacing:-.03em">${esc(c.sk)}</div><div class="wex">${markEx(c.ex, c.re)}</div><div style="flex:1"></div><div class="lbl" style="text-align:center">${t('flip')}</div></div>
   <div class="face back"><div class="lbl" style="color:#8b8b86">${esc(c.sk)}</div><div style="flex:1"></div><div style="font:750 ${L === 'sk' ? '20px/1.35' : '28px/1.2'} IT;letter-spacing:-.02em"><span style="color:var(--a)">→</span> ${esc(c.tr)}</div><div class="wex dark">${markEx(c.ex, c.re)}</div><div style="flex:1"></div><div class="lbl" style="text-align:center;color:#8b8b86">${t('swipe')}</div></div></div>`;
  return `<div class="inner"><div class="face front"><div class="stamp l">${t('again')}</div><div class="stamp r">${t('know')}</div>${c.sign ? `<div class="sign3d sm"><img class="b" src="${c.sign}" alt=""><img class="f" src="${c.sign}" alt=""></div>` : c.img ? `<img src="${c.img}" class="cimg" alt="">` : '<div style="flex:1"></div>'}<div class="qtext" style="font-size:20px">${esc(c.q)}</div><div style="flex:1"></div><div class="lbl" style="text-align:center">${t('flip')}</div></div>
   <div class="face back"><div class="lbl" style="color:#8b8b86">${esc(c.q)}</div><div style="flex:1"></div><div style="font:750 23px/1.28 IT;letter-spacing:-.02em"><span style="color:var(--a)">→</span> ${esc(c.a)}</div><div style="flex:1"></div><div class="lbl" style="text-align:center;color:#8b8b86">${t('swipe')}</div></div></div>`;
}
function renderDeck() {
  const deck = $('#deck'); deck.innerHTML = ''; const C = DECK; $('#dcount').textContent = C.length ? `${Math.min(deckIdx + 1, C.length)}/${C.length}` : '';
  if (!C.length) { deck.innerHTML = `<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">${t('words_none')}</div>`; return; }
  if (deckIdx >= C.length) { deck.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div style="font:800 64px IT">${known}/${C.length}</div><div class="lbl" style="margin-top:8px">${t('known')}</div><button class="cta" id="deckAgain" style="margin-top:28px;justify-content:center;padding:0 30px">${t('again_btn')}</button></div></div>`; $('#deckAgain').onclick = buildDeck; return; }
  for (let k = Math.min(C.length - 1, deckIdx + 2); k >= deckIdx; k--) { const el = document.createElement('div'); el.className = 'fc'; el.innerHTML = cardHTML(C[k]); const depth = k - deckIdx; el.style.transform = `translateY(${depth * 14}px) scale(${1 - depth * .05})`; el.style.opacity = depth > 1 ? .6 : 1; el.style.transition = 'transform .45s cubic-bezier(.2,.9,.3,1),opacity .4s'; deck.appendChild(el); if (depth === 0) drag(el, C[k]); }
}
function drag(el, card) {
  let x0, y0, x = 0, y = 0, moved = false, lastX = 0, lastT = 0, vx = 0; const Lb = el.querySelector('.stamp.l'), Rb = el.querySelector('.stamp.r');
  el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; moved = false; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; lastX = e.clientX; lastT = performance.now(); });
  el.addEventListener('pointermove', e => { if (x0 == null) return; x = e.clientX - x0; y = e.clientY - y0; if (Math.abs(x) + Math.abs(y) > 6) moved = true; const now = performance.now(); vx = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now; el.style.transform = `translate(${x}px,${y * .4}px) rotate(${x * .06}deg)`; Lb.style.opacity = Math.max(0, -x / 110); Rb.style.opacity = Math.max(0, x / 110); });
  const end = () => {
    if (x0 == null) return; x0 = null;
    if (!moved) { el.style.transition = ''; el.style.transform = ''; el.classList.toggle('flip'); vib(6); return; }
    if (Math.abs(x) > 110 || Math.abs(vx) > .6) {
      const dir = (Math.abs(x) > 110 ? Math.sign(x) : Math.sign(vx)); if (dir > 0) known++; vib(dir > 0 ? [10, 30, 10] : 20);
      if (card.kind === 'r') { ST.grade(card.id, dir > 0 ? 2 : 0); ST.addTime(9); }
      el.animate([{ transform: el.style.transform }, { transform: `translate(${dir * 600}px,${y * .4 + 60}px) rotate(${dir * 28}deg)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).onfinish = () => { deckIdx++; renderDeck(); };
      [...$('#deck').children].filter(c => c !== el).forEach(c => { const m = c.style.transform.match(/translateY\(([\d.]+)px\) scale\(([\d.]+)\)/); if (m) { c.style.transform = `translateY(${Math.max(0, +m[1] - 14)}px) scale(${Math.min(1, +m[2] + .05)})`; c.style.opacity = 1; } });
    } else { el.style.transition = 'transform .55s cubic-bezier(.3,1.5,.5,1)'; el.style.transform = ''; Lb.style.opacity = 0; Rb.style.opacity = 0; }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

/* ---------- DICTIONARY ---------- */
let dtab = 'core';
const nm = s => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const dictItems = () => GL.filter(g => L === 'sk' ? g.core_sk : g.core_x);
const CAT_C = { road: '#4A7FB8', move: '#E0703A', signs: '#E3A321', rules: '#D2506E', people: '#8E6CC8', vehicle: '#3A8FD9', parts: '#B8873F', gear: '#2FA37A', weather: '#4DB6C9', docs: '#7A8F5A' };
const CAT_O = Object.keys(CAT_C);
function renderCats() {
  $('#cats').innerHTML = `<button data-c="core" class="${dtab === 'core' ? 'on' : ''}">${t('core')}</button><button data-c="mine" class="${dtab === 'mine' ? 'on' : ''}">${t('mine')}${MW.size ? ` · ${MW.size}` : ''}</button><button class="learnw" id="learnW">🃏 ${t('learn_words')}</button>`;
  $$('#cats [data-c]').forEach(b => b.onclick = () => { dtab = b.dataset.c; vib(5); renderCats(); renderTerms(true); });
  $('#learnW').onclick = () => { deckMode = 'words'; $$('#cseg button').forEach(x => x.classList.toggle('on', x.dataset.m === 'words')); $('#cseg').classList.add('r'); show('cards'); };
}
function renderTerms(anim) {
  const q = nm($('#dq').value || ''); let html = '';
  if (dtab === 'mine') {
    const arr = Object.entries(MW.o).filter(([k, w]) => !q || nm(w.sk).includes(q) || nm(w.tr).includes(q));
    html = arr.length ? arr.map(([k, w]) => `<div class="term" data-k="${esc(k)}"><button class="row"><div><div class="sk">${esc(w.sk)}</div><div class="ua">${esc(L === 'sk' ? (w.tr || '').slice(0, 70) : w.tr)}</div></div><span class="star on" data-del="${esc(k)}">★</span></button><div class="more"><div><div class="box">${w.ex ? `<span class="lbl">${t('example')}</span><br>${esc(w.ex)}` : ''}</div></div></div></div>`).join('') : `<div class="empty">${t('empty_mine')}</div>`;
  } else {
    let items = dictItems(); if (q) items = items.filter(g => nm(g.sk).includes(q) || nm(L === 'sk' ? (g.def || '') : trOf(g)).includes(q));
    items.sort((a, b) => CAT_O.indexOf(a.c) - CAT_O.indexOf(b.c)); let lastC = '';
    html = items.map(g => {
      const k = g.sk.toLowerCase(); const hdr = g.c !== lastC ? (lastC = g.c, `<div class="dgrp" style="--c:${CAT_C[g.c]}"><i></i>${t('cat_' + g.c)}<span>${items.filter(x => x.c === g.c).length}</span></div>`) : '';
      const sub = L === 'sk' ? (g.def || '').replace(/^(.{0,58}).*$/, (m, a) => m.length > 58 ? a + '…' : m) : trOf(g);
      return hdr + `<div class="term" data-id="${g.id}" style="--c:${CAT_C[g.c] || 'var(--a)'}"><button class="row"><div><div class="sk">${esc(g.sk)}</div><div class="ua">${esc(sub)}</div></div><span class="star ${MW.has(k) ? 'on' : ''}" data-star="${g.id}">★</span></button><div class="more"><div><div class="box">${L === 'sk' && g.def ? `<span class="lbl">${t('def')}</span><br>${esc(g.def)}` : ''}${g.tip && L === 'ua' ? `<div class="tipx">💡 ${esc(g.tip)}</div>` : ''}${g.ex ? `<div style="margin-top:9px"><span class="lbl">${t('example')}</span><br>${markEx(g.ex, rxSrc(g))}</div>` : ''}</div></div></div></div>`;
    }).join('');
  }
  $('#terms').innerHTML = html;
  if (anim) $$('.term').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(i, 10) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  $$('.term .row').forEach(r => r.onclick = e => {
    const st = e.target.closest('[data-star]'), del = e.target.closest('[data-del]'); const term = r.parentElement;
    if (del) { MW.del(del.dataset.del); vib(8); renderCats(); renderTerms(); return; }
    if (st) { const g = GL.find(x => x.id === +st.dataset.star), k = g.sk.toLowerCase(); if (MW.has(k)) MW.del(k); else MW.set(k, { sk: g.sk, tr: L === 'sk' ? (g.def || '') : trOf(g), ex: g.ex, lang: L }); st.classList.toggle('on'); vib(8); renderCats(); return; }
    vib(5); term.classList.toggle('open');
  });
}
$('#dq').addEventListener('input', () => renderTerms());
function openTermBySk(sk) { dtab = 'core'; $('#dq').value = ''; renderCats(); renderTerms(); const g = GL.find(x => x.sk === sk); setTimeout(() => { const el = g && $(`.term[data-id="${g.id}"]`); if (!el) return; el.classList.add('open'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 450); }

/* ---------- SETTINGS ---------- */
function openSettings() {
  const p = P();
  const seg = (k, opts) => `<div class="segx">${opts.map(([v, n]) => `<button data-k="${k}" data-v="${v}" class="${String(p[k]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const sh = openSheet(`<div style="display:flex;justify-content:space-between;align-items:center"><div class="h1" style="font-size:24px">${t('settings')}</div><button class="shx" id="setX" aria-label="close">✕</button></div>
   <div class="lbl sl">${t('ob_name')}</div><input class="obin sm" id="setName" maxlength="24" value="${esc(p.name)}">
   <div class="lbl sl">${t('set_lang')}</div>${seg('lang', [['ua', 'UA'], ['sk', 'SK'], ['en', 'EN']])}
   ${L === 'ua' ? `<div class="lbl sl">${t('gender')}</div>${seg('gender', [['f', t('g_f')], ['m', t('g_m')]])}` : ''}
   <div class="lbl sl">${t('set_exam')}</div><input class="obin sm" type="date" id="setDate" value="${p.examDate || ''}">
   <div class="lbl sl">${t('set_min')}</div>${seg('minutes', [[15, 15], [20, 20], [30, 30], [45, 45], [60, 60]])}
   <div class="lbl sl">${t('group')}</div>${seg('group', [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['T', 'T']])}
   <div class="lbl sl">${t('set_sound')}</div>${seg('sound', [[true, t('on')], [false, t('off')]])}
   <div class="lbl sl">${t('backup')}</div><div class="duo2"><button class="cta ghost sm" id="bkSave">${t('backup_save')}</button><button class="cta ghost sm" id="bkLoad">${t('backup_load')}</button></div>
   <button class="linkbtn" id="rst">${t('reset')}</button>
   <p class="about">${t('about')}</p>`);
  sh.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k; let v = b.dataset.v; if (k === 'minutes') v = +v; if (k === 'sound') v = v === 'true';
    p[k] = v; ST.save(); vib(6);
    if (k === 'lang') { L = v; applyI18n(true); }
    if (k === 'group') { ST.applyGroup(); renderHome(true); renderBento(); }
    if (k === 'sound') syncMute();
    if (k === 'gender') applyI18n(false);
    setTimeout(openSettings, k === 'lang' ? 260 : 0);
  });
  sh.querySelector('#setX').onclick = closeSheet;
  sh.querySelector('#setName').oninput = e => { p.name = e.target.value.trim(); ST.save(); $('#uname').textContent = p.name || 'CestIQ'; };
  sh.querySelector('#setDate').onchange = e => { p.examDate = e.target.value || null; ST.save(); renderHome(false); };
  sh.querySelector('#bkSave').onclick = () => {
    const blob = new Blob([ST.exportJSON()], { type: 'application/json' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `cestiq-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(t('backup_saved'));
  };
  sh.querySelector('#bkLoad').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => { try { ST.importJSON(await inp.files[0].text()); L = P().lang; closeSheet(); applyI18n(false); renderHome(true); toast(t('backup_loaded')); } catch (e) { toast(t('backup_bad')); } };
    inp.click();
  };
  sh.querySelector('#rst').onclick = () => confirmDlg(t('reset_conf'), () => { ST.reset(); location.reload(); });
}

/* ---------- layout ---------- */
function fit() { const H = dev.clientHeight; const tight = H < 600; $('.route').classList.toggle('tight', tight); const hh = Math.max(150, Math.min(360, H - 54 - 48 - (tight ? 120 : 205) - 104)); $('#hero').style.setProperty('--hh', hh + 'px'); }
window.addEventListener('resize', fit); fit();

/* ---------- start ---------- */
syncMute(); applyI18n(false);
$('#boot').classList.add('gone');
if (!P().onboarded) { show('onb'); renderOnb(); } else startIntro();
window.CESTIQ = { show, renderHome, startDaily, examIntro, openSettings };
})();
