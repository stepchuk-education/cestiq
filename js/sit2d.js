// 2D junction scenes made from the official picture (same view, same objects, restyled).
// Vehicles are cut-out sprites that drive along their arrows in the official order.
(function () {
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  function along(path, t) {   // point on a polyline at fraction t of its length
    if (path.length < 2) return path[0] || [0, 0];
    const seg = []; let L = 0;
    for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
    let r = t * L;
    for (let i = 0; i < seg.length; i++) { if (r <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, r / seg[i]) : 0; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; } r -= seg[i]; }
  }
  function mount(el, def) {
    el.innerHTML = '';
    const box = document.createElement('div'); box.className = 's2box'; box.style.aspectRatio = def.ar;
    box.innerHTML = `<img class="s2full" src="${def.full}" alt=""><img class="s2bg" src="${def.bg}" alt="">`;
    el.appendChild(box);
    const items = def.vehicles.map(v => {
      const it = { v, el: null, badge: null };
      if (v.sprite) {
        const [x0, y0, x1, y1] = v.box; const im = document.createElement('img'); im.className = 's2car'; im.src = v.sprite; im.alt = '';
        Object.assign(im.style, { left: x0 * 100 + '%', top: y0 * 100 + '%', width: (x1 - x0) * 100 + '%', height: (y1 - y0) * 100 + '%' });
        box.appendChild(im); it.el = im;
      } else if (v.you) {
        const dot = document.createElement('div'); dot.className = 's2you'; box.appendChild(dot); it.el = dot; it.dot = true;
        const p = v.path[0]; dot.style.left = p[0] * 100 + '%'; dot.style.top = p[1] * 100 + '%';
      }
      if (def.stay && def.stay.includes(v.id) && v.box) { const s = document.createElement('div'); s.className = 's2stop'; s.style.left = (v.box[0] + v.box[2]) / 2 * 100 + '%'; s.style.top = v.box[1] * 100 + '%'; box.appendChild(s); }
      return it;
    });
    let alive = true, started = false;
    function setT(it, t) {
      const v = it.v, p0 = v.path[0], p = along(v.path, t);
      if (it.dot) { it.el.style.left = p[0] * 100 + '%'; it.el.style.top = p[1] * 100 + '%'; it.el.style.opacity = t > .9 ? (1 - t) * 10 : 1; return; }
      const dx = (p[0] - p0[0]) * box.clientWidth, dy = (p[1] - p0[1]) * box.clientHeight, sc = 1 + ((v.scale || 1) - 1) * t;
      it.el.style.transform = `translate(${dx}px,${dy}px) scale(${sc})`; it.el.style.opacity = t > .8 ? Math.max(0, 1 - (t - .8) / .2) : 1;
      if (it.badge) { it.badge.style.left = (v.box[0] + v.box[2]) / 2 * 100 + '%'; it.badge.style.top = v.box[1] * 100 + '%'; it.badge.style.transform = `translate(calc(-50% + ${dx}px), calc(-60% + ${dy}px))`; it.badge.style.opacity = t > .8 ? (1 - t) * 5 : 1; }
    }
    async function play(order) {
      if (!started) { started = true; box.classList.add('cut'); }   // switch to the background without the moving vehicles
      items.forEach(it => { setT(it, 0); it.seg = 0; it.nseg = order.filter(g => g.includes(it.v.id)).length || 1; });
      for (let n = 0; n < order.length && alive; n++) {
        const its = items.filter(i => order[n].includes(i.v.id));   // a vehicle listed twice moves in two parts (e.g. enters, waits, finishes)
        its.forEach(i => { if (i.badge) i.badge.remove(); const b = document.createElement('div'); b.className = 's2badge'; b.textContent = n + 1; box.appendChild(b); i.badge = b; if (i.dot) { b.style.display = 'none'; i.el.dataset.n = n + 1; i.el.classList.add('go'); } });
        await new Promise(res => { const t0 = performance.now(), D = 1800; const step = now => { if (!alive) return res(); const k = Math.min(1, (now - t0) / D); its.forEach(i => setT(i, (i.seg + ease(k)) / i.nseg)); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
        its.forEach(i => i.seg++);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return { play, def, destroy() { alive = false; el.innerHTML = ''; } };
  }
  window.SIT2 = { mount };
})();
