// Photo road (AI render) + 3D stylised traffic light overlay. "Driving" = zoom into the vanishing point.
import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const dev = document.getElementById('dev');
const IMG_W = 864, IMG_H = 1536, VP = [0.537, 0.443];      // vanishing point in the render (fraction)
const road = document.getElementById('roadimg');
const tint = document.getElementById('roadtint');
const canvas = document.getElementById('scene3d');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(0, 0, 0); camera.lookAt(0, 0, -1);
scene.add(new THREE.HemisphereLight('#ffffff', '#cfcfcb', 1.6));
const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(-4, 6, 5); scene.add(key);
const rim = new THREE.DirectionalLight('#ffffff', 1.2); rim.position.set(5, 3, -4); scene.add(rim);
// soft studio env for reflections
{ const pm = new THREE.PMREMGenerator(renderer); const env = new THREE.Scene(); env.background = new THREE.Color('#e4e4e2');
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: '#f4f4f2', side: THREE.BackSide })); env.add(box);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: '#ffffff' })); panel.position.set(0, 4.5, 0); panel.rotation.x = Math.PI / 2; env.add(panel);
  scene.environment = pm.fromScene(env, 0.02).texture; }

// ---------- stylish traffic light ----------
const LAMP = ['#FF3B22', '#FF8A1A', '#16D98A'];
const tl = new THREE.Group();
const coat = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.38, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.35 });
const body = new THREE.Mesh(new RoundedBoxGeometry(0.56, 1.62, 0.36, 8, 0.2), coat); body.position.y = 2.95; tl.add(body);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 2.2, 32), coat); pole.position.y = 1.1; tl.add(pole);
const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 32), coat); foot.position.y = 0.03; tl.add(foot);
const lensMats = [], lensY = [3.43, 2.95, 2.47];
lensY.forEach((y, i) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.022, 16, 64), new THREE.MeshStandardMaterial({ color: '#2a2a2d', metalness: 0.8, roughness: 0.25 }));
  ring.position.set(0, y, 0.185); tl.add(ring);
  const m = new THREE.MeshPhysicalMaterial({ color: '#0d0d0f', emissive: new THREE.Color(LAMP[i]), emissiveIntensity: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), m);
  lens.rotation.x = Math.PI / 2; lens.scale.set(1, 0.35, 1); lens.position.set(0, y, 0.18); tl.add(lens); lensMats.push(m);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 48, 1, true, Math.PI * 0.15, Math.PI * 0.7), coat);
  hood.rotation.x = Math.PI / 2; hood.rotation.z = Math.PI; hood.position.set(0, y + 0.01, 0.27); tl.add(hood);
});
// glow sprites
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  for (let i = 0; i <= 24; i++) { const x = i / 24, a = Math.exp(-x * x * 7.5) * (1 - x); gr.addColorStop(x, `rgba(255,255,255,${a.toFixed(4)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
const gmat = new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
const glow = new THREE.Sprite(gmat); glow.scale.set(2.2, 2.2, 1); tl.add(glow);
const gmat2 = gmat.clone(); const bigGlow = new THREE.Sprite(gmat2); bigGlow.scale.set(6, 6, 1); tl.add(bigGlow);
const spill = new THREE.PointLight('#fff', 0, 6, 1.5); tl.add(spill);
scene.add(tl);

// ---------- layout ----------
let W = 1, H = 1, cover = { s: 1, ox: 0, oy: 0 }, vpx = 0, vpy = 0;
function layout() {
  W = dev.clientWidth; H = dev.clientHeight;
  const s = Math.max(W / IMG_W, H / IMG_H); const iw = IMG_W * s, ih = IMG_H * s;
  cover = { s, ox: (W - iw) / 2, oy: (H - ih) / 2 };
  road.style.width = iw + 'px'; road.style.height = ih + 'px'; road.style.left = cover.ox + 'px'; road.style.top = cover.oy + 'px';
  vpx = cover.ox + VP[0] * iw; vpy = cover.oy + VP[1] * ih;
  road.style.transformOrigin = `${vpx - cover.ox}px ${vpy - cover.oy}px`;
  // 3D canvas: centred on the vanishing point so the horizon matches the photo
  const ch = Math.max(vpy, H - vpy) * 2, cw = Math.max(vpx, W - vpx) * 2;
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; canvas.style.left = (vpx - cw / 2) + 'px'; canvas.style.top = (vpy - ch / 2) + 'px';
  renderer.setSize(cw, ch, false); camera.aspect = cw / ch;
  // vertical fov chosen so that the photo's road edge geometry roughly matches (35mm, cam height 1.3 m)
  camera.fov = 2 * Math.atan((ch / 2) / (ih * 0.72)) * 180 / Math.PI; camera.updateProjectionMatrix();
}
new ResizeObserver(layout).observe(dev); layout();

// ---------- state ----------
let shakeCur = 0;
let prog = 0, pFrom = 0, pTo = 0, pT0 = 0, pDur = 1, phase = 1, light = 0, lightT = 0, shake = 0, running = true;
let lane = 0, lFrom = 0, lTo = 0, lT0 = 0, lDur = 1;
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const col = new THREE.Color();
function frame(now) {
  requestAnimationFrame(frame); if (!running) return;
  const k = Math.max(0, Math.min(1, (now - pT0) / pDur)); prog = pFrom + (pTo - pFrom) * ease(k);
  light += (lightT - light) * 0.07;
  // driving: zoom photo into the VP; camera zoom keeps 3D aligned with the photo
  const z = 1 + Math.pow(prog / 100, 1.15) * 1.05;
  shakeCur += (shake - shakeCur) * (shake ? 0.25 : 0.045); const ts = now / 1000;
  const jx = (Math.sin(ts * 41) * 0.5 + Math.sin(ts * 23.7) * 0.28) * shakeCur, jy = (Math.sin(ts * 33 + 1.3) * 0.42) * shakeCur;
  const lk = Math.max(0, Math.min(1, (now - lT0) / lDur)); lane = lFrom + (lTo - lFrom) * ease(lk);
  // right-lane view: shear around the horizon so the near road slides left, the vanishing point stays
  const skew = -Math.atan((0.26 * W) / Math.max(1, H - vpy)) * 180 / Math.PI * lane;
  road.style.transform = `translate(${jx}px,${jy}px) scale(${z}) skewX(${skew}deg)`;
  canvas.style.transform = `translate(${jx}px,${jy}px)`;
  camera.zoom = z; camera.updateProjectionMatrix();
  // light approaches: distance shrinks with progress
  const d = 150 / (1 + prog * 0.06);
  tl.position.set(2.3, -1.32, -d);
  tl.rotation.y = -0.12;
  lensMats.forEach((m, i) => { m.emissiveIntensity = i === phase ? 4.5 * light : 0; m.color.set(i === phase && light > .05 ? LAMP[i] : '#0d0d0f'); });
  col.set(LAMP[phase]); gmat.color.copy(col); gmat2.color.copy(col);
  gmat.opacity = 0.95 * light; gmat2.opacity = 0.32 * light;
  glow.position.set(0, lensY[phase], 0.3); bigGlow.position.copy(glow.position);
  spill.color.copy(col); spill.intensity = 3 * light; spill.position.set(0, lensY[phase], 0.8);
  // coloured light falling on the photo around the light's screen position
  const v = new THREE.Vector3(0, lensY[phase], 0).applyMatrix4(tl.matrixWorld).project(camera);
  const cw = parseFloat(canvas.style.width), ch = parseFloat(canvas.style.height);
  const sx = parseFloat(canvas.style.left) + (v.x + 1) / 2 * cw, sy = parseFloat(canvas.style.top) + (1 - v.y) / 2 * ch;
  const rad = Math.min(420, 30 + 2600 / d);
  tint.style.background = `radial-gradient(circle at ${sx}px ${sy}px, ${LAMP[phase]}${Math.round(light * 46).toString(16).padStart(2, '0')} 0, transparent ${rad}px)`;
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

window.SCN = {
  drive(to, dur = 2200) { pFrom = prog; pTo = to; pT0 = performance.now(); pDur = dur; },
  setPhase(i, flicker) { if (flicker && i !== phase) { lightT = 0; setTimeout(() => { phase = i; lightT = 1; }, 420); } else phase = i; },
  lightOn(on) { lightT = on ? 1 : 0; },
  engine(on) { shake = on ? 1 : 0; },
  lane(k, dur = 1800) { lFrom = lane; lTo = k; lT0 = performance.now(); lDur = dur; },
  pause(p) { running = !p; },
};
