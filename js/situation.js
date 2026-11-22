// Clay-style top-down 3D intersection situations. After answering, cars drive in the correct order.
import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const BG = '#E6E3DF';

const COLORS = { red: '#D9675B', blue: '#6E98D4', green: '#6DBE8A', yellow: '#E8C04A', white: '#F2F1EE', you: '#F2F1EE', orange: '#EE9A4D', black: '#3B3B3E', grey: '#A9A7A3', gray: '#A9A7A3', brown: '#A0785A', purple: '#9C7CC4', tram: '#E9C24F' };
const colorOf = c => COLORS[c] || c || '#A9A7A3';
function vehicleMesh(kind, color) {
  if (kind === 'tram') return boxVehicle(color, 2.3, 1.5, 9.5, true);
  if (kind === 'bus') return boxVehicle(color, 2.3, 1.6, 9.5, true);
  if (kind === 'van' || kind === 'truck') return boxVehicle(color, 2.0, 1.35, 5.2, false);
  if (kind === 'moto' || kind === 'bike') return twoWheeler(color);
  return carMesh(color);
}
function boxVehicle(color, w, h, l, windows) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#2E3238', roughness: 0.2, clearcoat: 1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, l, 4, 0.3), paint); body.position.y = h / 2 + 0.2; g.add(body);
  if (windows) {   // light roof, dark window bands along both sides
    const roofM = new THREE.MeshPhysicalMaterial({ color: '#F1EFEA', roughness: 0.5 });
    const roof = new THREE.Mesh(new RoundedBoxGeometry(w * 0.8, 0.1, l * 0.9, 2, 0.04), roofM); roof.position.y = h + 0.25; g.add(roof);
    for (const sx of [-1, 1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.32, l * 0.84), glass); band.position.set(sx * (w / 2 + 0.01), h * 0.78 + 0.2, 0); g.add(band); }
  }
  else { const cab = new THREE.Mesh(new RoundedBoxGeometry(w * 0.86, 0.5, 1.2, 3, 0.2), glass); cab.position.set(0, h + 0.3, -l / 2 + 0.9); g.add(cab); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function twoWheeler(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2B2B2E', roughness: 0.8 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.5, 2.0, 3, 0.2), paint); body.position.y = 0.55; g.add(body);
  const rider = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.9, 0.6, 3, 0.25), dark); rider.position.set(0, 1.25, 0.15); g.add(rider);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function signSprite(type) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.lineJoin = 'round';
  if (type === 'yield') { g.fillStyle = '#fff'; g.strokeStyle = '#D63A2F'; g.lineWidth = 14; g.beginPath(); g.moveTo(14, 22); g.lineTo(114, 22); g.lineTo(64, 112); g.closePath(); g.fill(); g.stroke(); }
  else if (type === 'stop') { g.fillStyle = '#D63A2F'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(64 + 56 * Math.cos(a), 64 + 56 * Math.sin(a)); } g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#fff'; g.font = '800 34px Inter Tight, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', 64, 66); }
  else if (type === 'main') { g.translate(64, 64); g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.fillRect(-42, -42, 84, 84); g.fillStyle = '#F2C230'; g.fillRect(-32, -32, 64, 64); g.strokeStyle = '#333'; g.lineWidth = 2; g.strokeRect(-42, -42, 84, 84); }
  else if (type === 'light') { g.fillStyle = '#222'; g.fillRect(40, 8, 48, 112); ['#D63A2F', '#E8B72F', '#2FA36B'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(64, 30 + i * 34, 13, 0, Math.PI * 2); g.fill(); }); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sp.scale.set(2.6, 2.6, 1); sp.renderOrder = 8; return sp;
}

// ---------- semantic junction -> paths ----------
const ARM = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const RIGHT_OF = { S: 'E', E: 'N', N: 'W', W: 'S' };   // coming FROM arm X, a right turn exits into arm RIGHT_OF[X]
const LEFT_OF = { S: 'W', W: 'N', N: 'E', E: 'S' };
const LANE = 1.65, IN0 = 9.5, EDGE = 4.4, OUT1 = 11.5;
function pathFor(v) {
  const a = ARM[v.from]; const h = [-a[0], -a[1]];                      // heading into the junction
  const r = [-h[1], h[0]];                                               // right-hand side of the heading
  const exitArm = v.move === 'left' ? LEFT_OF[v.from] : v.move === 'right' ? RIGHT_OF[v.from] : v.move === 'u' ? v.from : OPP[v.from];
  const e = ARM[exitArm]; const re = [-e[1], e[0]];
  const ln = v.lane ?? LANE, d0 = (v.wait ? EDGE + 1.2 : IN0) + (v.back || 0);
  const start = [a[0] * d0 + r[0] * ln, a[1] * d0 + r[1] * ln];
  const entry = [a[0] * (EDGE + (v.back || 0) * 0) + r[0] * ln, a[1] * EDGE + r[1] * ln];
  const exitS = [e[0] * EDGE + re[0] * LANE, e[1] * EDGE + re[1] * LANE];
  const end = [e[0] * OUT1 + re[0] * LANE, e[1] * OUT1 + re[1] * LANE];
  let mids = [];
  if (v.move === 'straight' || !v.move) mids = [[(entry[0] + exitS[0]) / 2, (entry[1] + exitS[1]) / 2]];
  else if (v.move === 'u') mids = [[r[0] * -0.2 + h[0] * 1.2, r[1] * -0.2 + h[1] * 1.2]];
  else {   // quadratic bezier with control at the corner where the two lane lines meet
    const ctrl = Math.abs(h[0]) > 0 ? [exitS[0], entry[1]] : [entry[0], exitS[1]];
    for (const t of [0.25, 0.5, 0.75]) { const u = 1 - t; mids.push([u * u * entry[0] + 2 * u * t * ctrl[0] + t * t * exitS[0], u * u * entry[1] + 2 * u * t * ctrl[1] + t * t * exitS[1]]); }
  }
  return [start, entry, ...mids, exitS, end];
}
function normalize(def) {
  if (def.cars) return def;                                              // hand-made legacy definition
  // several vehicles on one arm: a tram keeps the inner track, others take the outer side; otherwise they queue
  const byArm = {}; def.vehicles.forEach(v => (byArm[v.from] = byArm[v.from] || []).push(v));
  Object.values(byArm).forEach(g => { if (g.length < 2) return; const tram = g.some(v => v.kind === 'tram');
    g.forEach((v, i) => { if (tram) v.lane = v.kind === 'tram' ? 0.55 : 2.6; else v.back = i * 6.5; }); });
  return Object.assign({ accent: '#FF7A1A' }, def, {
    cars: def.vehicles.map(v => ({ id: v.id, you: !!v.you, kind: v.kind || 'car', color: colorOf(v.you ? 'you' : (v.color || (v.kind === 'tram' ? 'tram' : 'grey'))), path: pathFor(v) })),
  });
}

function carMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#2E3238', roughness: 0.18, metalness: 0.1, clearcoat: 1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.72, 4.15, 5, 0.34), paint); body.position.y = 0.56; g.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.62, 2.25, 5, 0.3), glass); cabin.position.set(0, 1.14, 0.25); g.add(cabin);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.1, 1.1, 3, 0.05), paint); hood.position.set(0, 0.96, -1.45); g.add(hood);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function ribbon(curve, width, color, opacity = 1) {
  const N = 80, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const s = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(width / 2);
    pos.push(p.x - s.x, 0.04, p.z - s.z, p.x + s.x, 0.04, p.z + s.z);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  // arrow head: flat triangle lying on the road, pointing along the path
  const end = curve.getPointAt(1), tg = curve.getTangentAt(1);
  const sh = new THREE.Shape(); sh.moveTo(0, 0.75); sh.lineTo(-0.62, -0.45); sh.lineTo(0.62, -0.45); sh.closePath();
  const hg = new THREE.ShapeGeometry(sh); hg.rotateX(-Math.PI / 2);
  const head = new THREE.Mesh(hg, m.material); head.position.set(end.x, 0.05, end.z); head.rotation.y = Math.atan2(-tg.x, -tg.z);
  const grp = new THREE.Group(); grp.add(m); grp.add(head);
  return grp;
}

function badge(n, accent) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#141414'; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
  g.strokeStyle = accent; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#fff'; g.font = '800 64px Inter Tight, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(1.5, 1.5, 1); s.renderOrder = 10; return s;
}

function mount(el, def0) {
  const def = normalize(def0);
  const W = el.clientWidth, H = el.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  const aspect = W / H, fh = 21, fw = Math.max(fh * aspect, 22);
  const cam = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, 200);
  cam.position.set(0, 30, 15); cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc9c2', 1.35));
  const sun = new THREE.DirectionalLight('#fff6ec', 2.6); sun.position.set(-16, 14, -6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 }); sun.shadow.radius = 5; sun.shadow.bias = -0.0004;
  scene.add(sun);
  // ground + roads
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: BG, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const roadM = new THREE.MeshStandardMaterial({ color: '#D2CFCB', roughness: 0.95 });
  const RW = 6.6;
  const arms = def.arms || ['N', 'E', 'S', 'W'];
  const mainM = new THREE.MeshStandardMaterial({ color: '#BDB9B4', roughness: 0.95 });
  const main = def.main || [];
  const plane = (w, d, x, z, m, y = 0.01) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); r.rotation.x = -Math.PI / 2; r.position.set(x, y, z); r.receiveShadow = true; scene.add(r); return r; };
  plane(RW, RW, 0, 0, main.length ? mainM : roadM);
  for (const k of arms) { const [ax, az] = ARM[k], L = 40, c = RW / 2 + L / 2; plane(ax ? L : RW, ax ? RW : L, ax * c, az * c, main.includes(k) ? mainM : roadM); }
  const lineM = new THREE.MeshBasicMaterial({ color: '#F7F6F3' });
  const addLine = (x, z, w, d) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, z); scene.add(l); };
  for (const k of arms) {
    const [ax, az] = ARM[k];
    for (let i = 0; i < 6; i++) { const d = RW / 2 + 1.5 + i * 3; ax ? addLine(ax * d, 0, 1.6, 0.14) : addLine(0, az * d, 0.14, 1.6); }
    ax ? (addLine(ax * (RW / 2 + 20), RW / 2, 40, 0.12), addLine(ax * (RW / 2 + 20), -RW / 2, 40, 0.12)) : (addLine(RW / 2, az * (RW / 2 + 20), 0.12, 40), addLine(-RW / 2, az * (RW / 2 + 20), 0.12, 40));
    if (!main.includes(k) && main.length) {   // give-way line across the minor arm
      for (let i = -1; i <= 1; i += 0.5) ax ? addLine(ax * (RW / 2 + 0.4), i * 1.2 + (az || 0), 0.5, 0.35) : addLine(i * 1.2, az * (RW / 2 + 0.4), 0.35, 0.5);
    }
  }
  if (!arms.includes('N')) addLine(0, -RW / 2, RW + 0.1, 0.12);
  if (!arms.includes('S')) addLine(0, RW / 2, RW + 0.1, 0.12);
  if (!arms.includes('E')) addLine(RW / 2, 0, 0.12, RW + 0.1);
  if (!arms.includes('W')) addLine(-RW / 2, 0, 0.12, RW + 0.1);
  // tram rails along each tram path
  const railM = new THREE.MeshBasicMaterial({ color: '#8E8A85', transparent: true, opacity: 0.75, depthWrite: false });
  (def.cars || []).filter(c => c.kind === 'tram').forEach(c => {
    const cv = new THREE.CatmullRomCurve3(c.path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    for (const off of [-0.6, 0.6]) {
      const N = 60, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const p = cv.getPointAt(i / N), tg = cv.getTangentAt(i / N), sv = new THREE.Vector3(-tg.z, 0, tg.x).normalize(), q = p.clone().addScaledVector(sv, off);
        pos.push(q.x - sv.x * 0.06, 0.03, q.z - sv.z * 0.06, q.x + sv.x * 0.06, 0.03, q.z + sv.z * 0.06);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx);
      scene.add(new THREE.Mesh(gg, railM));
    }
  });
  // signs at the approaches (right-hand side of the incoming lane)
  for (const [k, type] of Object.entries(def.signs || {})) {
    if (!ARM[k]) continue; const [ax, az] = ARM[k]; const h = [-ax, -az], r = [-h[1], h[0]];
    const x = ax * (RW / 2 + 1.6) + r[0] * (RW / 2 + 1.1), z = az * (RW / 2 + 1.6) + r[1] * (RW / 2 + 1.1);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#7d7b78' })); post.position.set(x, 1.1, z); post.castShadow = true; scene.add(post);
    const sp = signSprite(type); sp.position.set(x, 2.9, z); scene.add(sp);
  }
  // cars, arrows, "you" ring
  const items = def.cars.map(c => {
    const curve = new THREE.CatmullRomCurve3(c.path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    const mesh = vehicleMesh(c.kind, c.color); scene.add(mesh);
    const arrow = ribbon(curve, 0.42, c.you ? def.accent : (c.arrow || c.color), c.you ? 0.95 : 0.85); scene.add(arrow);
    let ring = null;
    if (c.you) {
      const rc = document.createElement('canvas'); rc.width = rc.height = 256; const g = rc.getContext('2d'); const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128);
      gr.addColorStop(0, def.accent + 'cc'); gr.addColorStop(.35, def.accent + '55'); gr.addColorStop(1, def.accent + '00'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      ring = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
    }
    const it = { def: c, curve, mesh, arrow, ring, badge: null };
    place(it, 0); return it;
  });
  function place(it, t) {
    const p = it.curve.getPointAt(t), tg = it.curve.getTangentAt(t);
    it.mesh.position.set(p.x, 0, p.z); it.mesh.rotation.y = Math.atan2(-tg.x, -tg.z);
    if (it.ring) it.ring.position.set(p.x, 0.03, p.z);
    if (it.badge) it.badge.position.set(p.x, 3.2, p.z);
  }
  const render = () => renderer.render(scene, cam);
  render();
  let alive = true;
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  async function play(order) {
    for (let n = 0; n < order.length; n++) {
      const grp = order[n];                       // ids moving together
      const its = items.filter(i => grp.includes(i.def.id));
      its.forEach(i => { i.badge = badge(n + 1, def.accent); scene.add(i.badge); place(i, 0); });
      await new Promise(res => { const t0 = performance.now(), D = 1700;
        const step = now => { if (!alive) return res(); const k = Math.min(1, (now - t0) / D), e = ease(k);
          its.forEach(i => { place(i, e * 0.999); i.arrow.children[0].material.opacity = 0.9 * (1 - k); });
          render(); k < 1 ? requestAnimationFrame(step) : res(); };
        requestAnimationFrame(step); });
      await new Promise(r => setTimeout(r, 180));
    }
  }
  return { play, def, destroy() { alive = false; renderer.dispose(); el.innerHTML = ''; } };
}

window.SIT = { mount };
document.dispatchEvent(new Event('sit-ready'));
