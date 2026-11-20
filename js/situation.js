// Clay-style top-down 3D intersection situations. After answering, cars drive in the correct order.
import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const BG = '#E6E3DF';

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

function mount(el, def) {
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
  [[RW, 80, 0], [80, RW, 0]].forEach(([w, d]) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadM); r.rotation.x = -Math.PI / 2; r.position.y = 0.01; r.receiveShadow = true; scene.add(r); });
  const lineM = new THREE.MeshBasicMaterial({ color: '#F7F6F3' });
  const addLine = (x, z, w, d) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, z); scene.add(l); };
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 6; k++) { const d = RW / 2 + 1.5 + k * 3; addLine(0, sgn * d, 0.14, 1.6); addLine(sgn * d, 0, 1.6, 0.14); }   // centre dashes on each arm
    addLine(sgn * RW / 2, sgn * 24, 0.12, 40); addLine(-sgn * RW / 2, sgn * 24, 0.12, 40);                                           // edge lines (vertical arms)
    addLine(sgn * 24, RW / 2, 40, 0.12); addLine(sgn * 24, -RW / 2, 40, 0.12);
  }
  // cars, arrows, "you" ring
  const items = def.cars.map(c => {
    const curve = new THREE.CatmullRomCurve3(c.path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    const mesh = carMesh(c.color); scene.add(mesh);
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
  return { play, destroy() { alive = false; renderer.dispose(); el.innerHTML = ''; } };
}

window.SIT = { mount };
document.dispatchEvent(new Event('sit-ready'));
