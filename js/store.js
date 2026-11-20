// CestIQ store: persistence, spaced repetition, CestIQ score, streak, daily plan, backup.
(function () {
  const KEY = 'cestiq.v1';
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32];          // days until next review per box
  const STABILITY = [0.35, 4, 8, 16, 32, 64, 128];    // memory half-life-ish (days) per box, for the forgetting curve
  const T_NEW = 30, T_REV = 11, REV_PER_Q = 4.5, MOCKS = 8, MOCK_MIN = 28;

  const blank = () => ({
    v: 1,
    profile: { name: '', lang: 'ua', gender: 'f', group: 'B', examDate: null, minutes: 30, sound: true, onboarded: false, created: Date.now() },
    cards: {}, days: {}, myWords: {}, words: {}, exams: [],
  });

  let S = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.v === 1) { const b = blank(); return Object.assign(b, raw, { profile: Object.assign(b.profile, raw.profile) }); }
    } catch (e) { }
    return blank();
  }
  let saveT = null;
  function save(now) {
    clearTimeout(saveT);
    const f = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
    now ? f() : (saveT = setTimeout(f, 200));
  }
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  const dayLog = (d = today()) => S.days[d] || (S.days[d] = { ans: 0, ok: 0, sec: 0 });

  // ---------- bank helpers ----------
  let BANK = null, Q = [], QID = {}, ORDER = [], SECQ = {};
  function setBank(b) {
    BANK = b; QID = {}; b.questions.forEach(q => QID[q.id] = q); applyGroup();
  }
  function applyGroup() {
    const g = S.profile.group || 'B';
    Q = BANK.questions.filter(q => !q.g.length || q.g.includes(g));
    SECQ = {}; Q.forEach(q => (SECQ[q.s] = SECQ[q.s] || []).push(q));
    // curriculum: interleave topics from all sections proportionally, so each day mixes rules, signs, crossings…
    const secMax = {}; BANK.questions.forEach(q => secMax[q.s] = Math.max(secMax[q.s] || 0, q.n));
    const rank = {}; [...BANK.topics].sort((a, b) => (a.r[0] - 1) / secMax[a.s] - (b.r[0] - 1) / secMax[b.s] || a.s - b.s).forEach((t, i) => rank[t.id] = i);
    ORDER = [...Q].sort((a, b) => rank[a.t] - rank[b.t] || a.n - b.n);
  }

  // ---------- spaced repetition ----------
  /** g: 0 wrong, 1 unsure, 2 right */
  function grade(id, g) {
    const t = today();
    const c = S.cards[id] || (S.cards[id] = { b: 0, due: t, seen: 0, ok: 0, bad: 0, last: Date.now(), first: t });
    c.seen++; c.last = Date.now(); c.lastDay = t;
    if (g === 0) { c.bad++; c.b = c.b >= 3 ? 1 : 0; c.due = t; }
    else if (g === 1) { c.ok++; c.b = Math.max(1, c.b); c.due = t + 1; }
    else { c.ok++; c.b = Math.min(6, c.b + 1); c.due = t + INTERVALS[c.b]; }
    const L = dayLog(); L.ans++; if (g) L.ok++;
    save();
    return c;
  }
  function recall(c, now = Date.now()) {
    if (!c) return 0;
    const el = Math.max(0, (now - c.last) / 864e5);
    const top = c.b === 0 ? 0.32 : 0.97;
    return top * Math.exp(-el / STABILITY[c.b]);
  }

  // ---------- CestIQ: predicted exam score 0..100 ----------
  function sectionScore(s, now) {
    const qs = SECQ[s] || []; if (!qs.length) return 0;
    let p = 0; for (const q of qs) p += recall(S.cards[q.id], now);
    return p / qs.length;
  }
  function cestiq(now = Date.now()) {
    let total = 0;
    for (const sec of BANK.sections) { const [n, pts] = sec.exam; total += n * pts * sectionScore(sec.id, now); }
    return Math.max(0, Math.min(100, total));
  }
  const phaseOf = v => v < 25 ? 0 : v < 90 ? 1 : 2;

  function topicStats(tid) {
    const qs = Q.filter(q => q.t === tid); let learned = 0, mastered = 0;
    for (const q of qs) { const c = S.cards[q.id]; if (c && c.b >= 1) learned++; if (c && c.b >= 4) mastered++; }
    return { n: qs.length, learned, mastered };
  }
  // how much the learner works on a section lately (0..1), for the living topic blocks
  function activity() {
    const t = today(), raw = {};
    for (const [id, c] of Object.entries(S.cards)) {
      const q = QID[id]; if (!q) continue;
      raw[q.s] = (raw[q.s] || 0) + c.seen * Math.exp(-(t - (c.lastDay ?? c.first)) / 6);
    }
    const max = Math.max(1, ...Object.values(raw));
    const out = {}; for (const s of BANK.sections) out[s.id] = (raw[s.id] || 0) / max;
    return out;
  }

  // ---------- streak ----------
  function streak() {
    let d = today(), n = 0;
    if (!S.days[d]?.ans) d--;
    while (S.days[d]?.ans) { n++; d--; }
    return n;
  }

  // ---------- plan ----------
  function workloadHours(n) { return n * (T_NEW + REV_PER_Q * T_REV) / 3600 + MOCKS * MOCK_MIN / 60; }
  function plan() {
    const n = Q.length, m = S.profile.minutes, H = workloadHours(n);
    let days = Math.ceil(H * 60 / m);
    if (S.profile.examDate) {
      const left = Math.max(3, Math.round((new Date(S.profile.examDate) - new Date()) / 864e5));
      days = Math.min(days, left);
    }
    const learnDays = Math.max(1, Math.round(days * 0.8));
    return { hours: H, days, weeks: Math.ceil(days / 7), newPerDay: Math.max(8, Math.ceil(n / learnDays)) };
  }
  function dueList() {
    const t = today();
    return Q.filter(q => { const c = S.cards[q.id]; return c && c.due <= t; })
      .sort((a, b) => S.cards[a.id].due - S.cards[b.id].due || S.cards[a.id].b - S.cards[b.id].b);
  }
  function newList() { return ORDER.filter(q => !S.cards[q.id]); }
  function newToday() { const t = today(); return Object.values(S.cards).filter(c => c.first === t).length; }
  function todayPlan() {
    const p = plan(), budget = Math.max(0, S.profile.minutes * 60 - dayLog().sec);
    const due = dueList(), unseen = newList();
    let nRev = Math.min(due.length, Math.floor((unseen.length ? budget * 0.5 : budget) / T_REV));
    let nNew = Math.max(0, Math.min(unseen.length, p.newPerDay - newToday(), Math.floor((budget - nRev * T_REV) / T_NEW)));
    if (!nRev && !nNew) nRev = Math.min(due.length, 12);
    return { rev: due.slice(0, nRev), neu: unseen.slice(0, nNew), dueAll: due.length };
  }

  // ---------- backup ----------
  function exportJSON() { return JSON.stringify(Object.assign({ app: 'cestiq', exported: new Date().toISOString() }, S)); }
  function importJSON(txt) {
    const o = JSON.parse(txt);
    if (!o || o.v !== 1 || !o.cards) throw new Error('bad');
    const b = blank(); S = Object.assign(b, o, { profile: Object.assign(b.profile, o.profile) }); delete S.app; delete S.exported;
    applyGroup(); save(true);
  }
  function reset() { const lang = S.profile.lang; S = blank(); S.profile.lang = lang; applyGroup(); save(true); }

  window.Store = {
    get S() { return S; }, save, today, dayLog,
    setBank, applyGroup, get Q() { return Q; }, get QID() { return QID; }, get ORDER() { return ORDER; }, get SECQ() { return SECQ; },
    grade, recall, cestiq, sectionScore, phaseOf, topicStats, activity, streak, plan, todayPlan, dueList, newList,
    addTime(sec) { dayLog().sec += Math.min(90, Math.max(0, sec)); save(); },
    exportJSON, importJSON, reset,
  };
})();
