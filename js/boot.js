// Loads the question bank + content, then starts the app. Registers the service worker for offline use.
(async function () {
  const V = '1';
  try {
    const [bank, content] = await Promise.all([
      fetch('data/bank.json?v=' + V).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/content.json?v=' + V).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);
    const tr = await fetch('data/tr.json?v=' + V).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    window.DATA = Object.assign({ bank, tr }, content);
    // key words of translated questions become tappable (word -> [base form, ua, en])
    for (const x of Object.values(tr)) for (const [w, v] of Object.entries(x.w || {})) if (!DATA.lex[w]) DATA.lex[w] = v;
    Store.setBank(bank);
    const s = document.createElement('script'); s.src = 'js/app.js?v=' + V; document.body.appendChild(s);
  } catch (e) {
    console.error(e);
    document.querySelector('#boot').innerHTML = '<div class="err">CestIQ: nepodarilo sa načítať dáta. Skontrolujte pripojenie a obnovte stránku.<br><br>Не вдалося завантажити дані. Оновіть сторінку.</div>';
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
