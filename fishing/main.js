import * as THREE from 'three';
import { SPECIES, createFish } from './fish.js';
import * as sfx from './sound.js';

// ============================================================
//  Helpers
// ============================================================
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const $ = (id) => document.getElementById(id);
function lerpAngle(a, b, k) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

// ============================================================
//  Renderer, scene, camera, lights
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const SKY = 0xa8d8f0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 30, 90);

// The camera is the player's eyes, standing on the dock looking out (-z)
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.8, 4.2);
camera.lookAt(0, 0.2, -10);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x2a4a3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, far: 50 });
scene.add(sun);

// ============================================================
//  Water: a flat grid whose vertex heights we move every frame
// ============================================================
function waveH(x, z, t) {
  return Math.sin(x * 0.22 + t * 1.1) * 0.12
       + Math.cos(z * 0.28 + t * 0.8) * 0.10
       + Math.sin((x + z) * 0.7 + t * 2.2) * 0.035;
}
const waterGeo = new THREE.PlaneGeometry(160, 160, 120, 120);
waterGeo.rotateX(-Math.PI / 2); // lay flat, so x/z in the geometry = world x/z
const waterPos = waterGeo.attributes.position;
const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
  color: 0x1f7fa6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.58, flatShading: true,
}));
water.receiveShadow = true;
scene.add(water);
function updateWater(t) {
  for (let i = 0; i < waterPos.count; i++) {
    waterPos.setY(i, waveH(waterPos.getX(i), waterPos.getZ(i), t));
  }
  waterPos.needsUpdate = true; // flatShading computes normals in the shader, no need to recompute
}

const seabed = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x2f5b56 })
);
seabed.position.y = -4;
scene.add(seabed);

// ============================================================
//  Scenery: islands with trees, and the dock
// ============================================================
const landMat = new THREE.MeshStandardMaterial({ color: 0x6e8b4e, flatShading: true });
const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f5e3a, flatShading: true });
function island(x, z, r) {
  const g = new THREE.Group();
  const land = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, 1.2, 9), landMat);
  land.position.y = 0.1;
  g.add(land);
  for (let i = 0; i < Math.round(r * 1.6); i++) {
    const h = rand(2, 4.5);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(rand(0.5, 0.9), h, 6), treeMat);
    const a = rand(0, Math.PI * 2), d = rand(0, r * 0.55);
    tree.position.set(Math.cos(a) * d, 0.7 + h / 2, Math.sin(a) * d);
    g.add(tree);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}
island(-30, -55, 7); island(22, -48, 5); island(45, -70, 9); island(-8, -78, 4);

const dock = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.12, 0.44),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8a6141).offsetHSL(0, 0, rand(-0.05, 0.05)), roughness: 0.9 })
  );
  plank.position.set(0, 0.6, -0.2 + i * 0.48);
  plank.castShadow = plank.receiveShadow = true;
  dock.add(plank);
}
const postMat = new THREE.MeshStandardMaterial({ color: 0x5e4330, roughness: 1 });
for (const z of [-0.2, 2.6, 5.6]) for (const x of [-1.1, 1.1]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), postMat);
  post.position.set(x, -0.8, z);
  post.castShadow = true;
  dock.add(post);
}
scene.add(dock);

// ============================================================
//  Rod, bobber, fishing line
// ============================================================
const ROD_LEN = 3.2;
const REST_X = -0.85;  // tilt forward over the water
const REST_Z = -0.12;
const rodPivot = new THREE.Group();   // rotates around the player's hands
rodPivot.position.set(0.55, 1.6, 2.6);
rodPivot.rotation.set(REST_X, 0, REST_Z);
scene.add(rodPivot);
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, ROD_LEN, 8),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4 }));
rod.position.y = ROD_LEN / 2;
const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10),
  new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }));
grip.position.y = 0.25;
const reelBox = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14),
  new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.7, roughness: 0.3 }));
reelBox.rotation.z = Math.PI / 2;
reelBox.position.set(0.09, 0.62, 0);
const rodTip = new THREE.Object3D();
rodTip.position.y = ROD_LEN;
rodPivot.add(rod, grip, reelBox, rodTip);

const bobber = new THREE.Group();
bobber.add(
  new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe53b2f, roughness: 0.4 })),
  new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }))
);
scene.add(bobber);

const LINE_PTS = 24;
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.85 }));
line.frustumCulled = false;
scene.add(line);

const tip = V(), mid = V();
// Draw the line as a curve from rod tip to bobber that sags by `sag` units
function updateLine(sag) {
  const a = tip, b = bobber.position, p = lineGeo.attributes.position;
  mid.addVectors(a, b).multiplyScalar(0.5);
  mid.y -= sag;
  for (let i = 0; i < LINE_PTS; i++) {
    const u = i / (LINE_PTS - 1), w0 = (1 - u) ** 2, w1 = 2 * (1 - u) * u, w2 = u * u;
    p.setXYZ(i, w0 * a.x + w1 * mid.x + w2 * b.x, w0 * a.y + w1 * mid.y + w2 * b.y, w0 * a.z + w1 * mid.z + w2 * b.z);
  }
  p.needsUpdate = true;
}

// ============================================================
//  Splash rings
// ============================================================
const splashes = [];
function splash(x, z, size = 1) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, waveH(x, z, time) + 0.03, z);
  m.userData = { life: 0, size };
  scene.add(m);
  splashes.push(m);
}
function updateSplashes(dt) {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const m = splashes[i];
    m.userData.life += dt;
    const s = 1 + m.userData.life * 7 * m.userData.size;
    m.scale.set(s, s, s);
    m.material.opacity = 0.9 * (1 - m.userData.life);
    if (m.userData.life >= 1) {
      scene.remove(m); m.geometry.dispose(); m.material.dispose();
      splashes.splice(i, 1);
    }
  }
}

// ============================================================
//  Fish
// ============================================================
const RARITY_COLOR = { Common: '#6b7785', Uncommon: '#2f9e5b', Rare: '#2b7bbd', Legendary: '#d99a00' };

function pickSpecies(z) {
  const zone = z > -12 ? 0 : z > -22 ? 1 : 2;
  const total = SPECIES.reduce((s, sp) => s + sp.odds[zone], 0);
  let r = Math.random() * total;
  for (const sp of SPECIES) { r -= sp.odds[zone]; if (r <= 0) return sp; }
  return SPECIES[0];
}
const randomSpot = () => V(rand(-24, 24), 0, rand(-36, -4));

const fishes = [];
function spawnFish() {
  const p = randomSpot();
  const sp = pickSpecies(p.z);
  const kg = sp.min + (sp.max - sp.min) * Math.random() ** 2; // small fish are more common
  const { g, u } = createFish(sp);
  g.scale.setScalar(0.25 + Math.cbrt(kg) * 0.25);
  const depth = rand(-1.1, -0.5);
  g.position.set(p.x, depth, p.z);
  g.rotation.y = rand(0, Math.PI * 2);
  scene.add(g);
  fishes.push({ g, u, swim: 0, sp, kg, depth, speed: rand(0.6, 1.3), target: randomSpot(),
    mode: 'wander', phase: rand(0, Math.PI * 2), fleeT: 0 });
}
// Advance the body wave: rate = how fast it beats, amp = how far it bends
function swimAnim(f, dt, rate, amp) {
  f.swim += dt * rate;
  f.u.uSwim.value = f.swim;
  f.u.uAmp.value += (amp - f.u.uAmp.value) * Math.min(1, dt * 5);
}
function removeFish(f) {
  scene.remove(f.g);
  f.g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); // skin textures are shared, kept

  fishes.splice(fishes.indexOf(f), 1);
}
for (let i = 0; i < 16; i++) spawnFish();

// Free-swimming fish: wander, flee, or swim toward the bobber
function updateFish(dt) {
  for (const f of fishes) {
    if (f.mode === 'biting' || f.mode === 'hooked' || f.mode === 'landing') continue; // moved by the game logic
    const g = f.g;
    const approach = f.mode === 'approach';
    const tx = approach ? bobber.position.x : f.target.x;
    const tz = approach ? bobber.position.z : f.target.z;
    const speed = approach ? 1.5 : f.mode === 'flee' ? 4.5 : f.speed;
    const dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz);
    g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * (approach ? 6 : 2.5)));
    if (approach) {
      const step = Math.min(dist, speed * dt);
      if (dist > 0) { g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step; }
      g.position.y += (-0.45 - g.position.y) * dt * 2;
      if (dist < 0.3) startBite(f);
    } else {
      g.position.x += Math.sin(g.rotation.y) * speed * dt;
      g.position.z += Math.cos(g.rotation.y) * speed * dt;
      g.position.y += (f.depth + Math.sin(time + f.phase) * 0.1 - g.position.y) * dt * 2;
      if (dist < 1) f.target = randomSpot();
      if (f.mode === 'flee' && (f.fleeT += dt) > 2.5) f.mode = 'wander';
    }
    swimAnim(f, dt, 4 + speed * 5, 0.06 + speed * 0.035);
  }
}

// ============================================================
//  Score (kept in this browser between visits)
// ============================================================
let save = { score: 0, catches: 0, best: null };
try { const s = JSON.parse(localStorage.getItem('fishing-save')); if (s) save = s; } catch { /* storage unavailable */ }
function persist() { try { localStorage.setItem('fishing-save', JSON.stringify(save)); } catch { /* ignore */ } }
function renderHud() {
  $('catches').textContent = save.catches;
  $('score').textContent = save.score;
  $('best').textContent = save.best ? `${save.best.name} ${save.best.kg.toFixed(2)} kg` : '—';
}
renderHud();

// ============================================================
//  Game state machine
//  idle → charging → casting → waiting → bite → reeling → landing → idle
// ============================================================
const ZONE_LO = 0.30, ZONE_HI = 0.75;            // green zone on the tension bar
const REEL_END = V(0.5, 0, -1.0);                 // where a reeled-in fish ends up
const LAND_TO = V(0.35, 2.2, 1.6);                // where a caught fish is shown
let state = 'idle';
let time = 0, aimX = 0, power = 0, chargeT = 0;
let castT = 0, castDur = 1, castH = 3;
const castFrom = V(), castTo = V(), reelFrom = V(), landFrom = V();
let waitTimer = 0, biteTimer = 0, nibbleT = 0, landT = 0, cardTimer = 0;
let approacher = null, hooked = null;
let tension = 0, progress = 0, slack = 0, holding = false, tickT = 0;

function setStatus(text, cls = '') { const s = $('status'); s.textContent = text; s.className = cls; }
function show(id, on) { $(id).classList.toggle('hidden', !on); }
setStatus('Aim with the mouse · hold to charge a cast · release to throw');

function floatBobber(offset) {
  const p = bobber.position;
  p.y = waveH(p.x, p.z, time) + 0.04 + offset;
  bobber.rotation.z = Math.sin(time * 1.7) * 0.12;
}

function cast() {
  show('power', false);
  const dist = 5 + power * 26;
  castFrom.copy(bobber.position);
  castDur = 0.6 + power * 0.7;
  castH = 1.5 + power * 4;
  castTo.set(clamp(0.5 + aimX * dist * 0.45, -22, 22), 0, 0.2 - dist);
  castTo.y = waveH(castTo.x, castTo.z, time + castDur);
  castT = 0;
  state = 'casting';
  sfx.sfxCast(power);
  setStatus('');
}
function land() {
  splash(castTo.x, castTo.z, 1);
  sfx.sfxPlop(1);
  state = 'waiting';
  waitTimer = rand(1.2, 3.5);
  setStatus('Waiting for a bite…  (click to reel in)');
}
function chooseBiter() {
  let best = null, bestD = 12;            // only fish within 12 units notice the bobber
  for (const f of fishes) {
    if (f.mode !== 'wander') continue;
    const d = Math.hypot(f.g.position.x - bobber.position.x, f.g.position.z - bobber.position.z);
    if (d < bestD) { bestD = d; best = f; }
  }
  if (best) { best.mode = 'approach'; approacher = best; } else waitTimer = 1.5;
}
function startBite(f) {
  f.mode = 'biting';
  state = 'bite';
  biteTimer = f.sp.rarity === 'Legendary' ? 0.7 : 0.95;
  splash(bobber.position.x, bobber.position.z, 0.5);
  setStatus('BITE! Click now!', 'alert');
  sfx.sfxBite();
}
function scare(f) { f.mode = 'flee'; f.fleeT = 0; f.target = randomSpot(); }
function missBite() {
  scare(approacher);
  approacher = null;
  state = 'waiting';
  waitTimer = rand(2, 4);
  setStatus('Too slow, it got away. Keep waiting…');
  sfx.sfxEscape();
}
function reelInEmpty() {
  if (approacher) { approacher.mode = 'wander'; approacher = null; }
  state = 'idle';
  setStatus('Reeled in. Hold to cast again.');
}
function hook() {
  hooked = approacher;
  approacher = null;
  hooked.mode = 'hooked';
  state = 'reeling';
  tension = 0.45; progress = 0; slack = 0; holding = true;
  reelFrom.copy(bobber.position);
  show('reel', true);
  splash(bobber.position.x, bobber.position.z, 0.8);
  sfx.sfxSplash(1);
  setStatus('Hold to reel · let go to ease off · keep the needle in the green');
}
function lose(msg) {
  if (tension >= 1) sfx.sfxSnap(); else sfx.sfxEscape();
  sfx.setStrain(0);
  scare(hooked);
  hooked = null;
  holding = false;
  state = 'idle';
  show('reel', false);
  setStatus(msg, 'bad');
}
function landCatch() {
  const f = hooked;
  f.mode = 'landing';
  state = 'landing';
  landT = 0;
  landFrom.copy(f.g.position);
  show('reel', false);
  splash(f.g.position.x, f.g.position.z, 1.2);
  sfx.sfxSplash(1.3);
  sfx.sfxCatch(f.sp.rarity);
  sfx.setStrain(0);
  const pts = Math.max(1, Math.round(f.kg * f.sp.pts));
  save.catches++;
  save.score += pts;
  if (!save.best || f.kg > save.best.kg) save.best = { name: f.sp.name, kg: f.kg };
  persist();
  renderHud();
  $('cardRarity').textContent = f.sp.rarity;
  $('cardRarity').style.color = RARITY_COLOR[f.sp.rarity];
  $('cardName').textContent = f.sp.name;
  $('cardStats').textContent = `${f.kg.toFixed(2)} kg · +${pts} points`;
  show('card', true);
  cardTimer = 4;
  setStatus(`You caught a ${f.sp.name}!`, 'good');
}

function updateGame(dt) {
  rodTip.getWorldPosition(tip);
  let rodX = REST_X, rodZ = REST_Z - aimX * 0.25, sag = 0.5;

  switch (state) {
    case 'idle':
    case 'charging': {
      if (state === 'charging') {
        chargeT += dt;
        const p = (chargeT * 0.9) % 2;            // power swings 0 → 1 → 0 while held
        power = p < 1 ? p : 2 - p;
        $('powerFill').style.width = `${power * 100}%`;
        rodX = REST_X + 0.15 + power * 0.6;       // pull the rod back
      }
      rodX += Math.sin(time * 1.5) * 0.02;
      bobber.position.set(tip.x + Math.sin(time * 2) * 0.05, tip.y - 0.7, tip.z); // dangling
      bobber.rotation.z = 0;
      bobber.scale.setScalar(0.4); // it's close to the camera, so draw it smaller
      sag = 0;
      break;
    }
    case 'casting': {
      castT += dt;
      const u = Math.min(castT / castDur, 1);
      bobber.position.lerpVectors(castFrom, castTo, u);
      bobber.position.y += Math.sin(Math.PI * u) * castH; // arc through the air
      bobber.scale.setScalar(lerp(0.4, 1, u));
      rodX = castT < 0.2 ? REST_X - 0.45 : REST_X;          // whip forward
      sag = 0.1;
      if (u >= 1) land();
      break;
    }
    case 'waiting': {
      if (approacher) {
        const d = approacher.g.position.distanceTo(bobber.position);
        if (d < 2.5 && nibbleT <= 0 && Math.random() < dt * 1.5) { nibbleT = 0.15; sfx.sfxNibble(); } // small twitches
      } else if ((waitTimer -= dt) <= 0) chooseBiter();
      nibbleT -= dt;
      floatBobber(nibbleT > 0 ? -0.07 : 0);
      sag = 0.6;
      break;
    }
    case 'bite': {
      floatBobber(-0.16 + Math.sin(time * 35) * 0.04);
      approacher.g.position.set(bobber.position.x, -0.4, bobber.position.z);
      swimAnim(approacher, dt, 16, 0.14);
      if ((biteTimer -= dt) <= 0) missBite();
      sag = 0.4;
      break;
    }
    case 'reeling': {
      const f = hooked, sp = f.sp;
      const str = sp.strength * (0.75 + 0.5 * (f.kg - sp.min) / (sp.max - sp.min)); // bigger = stronger
      const surge = Math.max(0, Math.sin(time * 2.3 + f.phase)) * Math.max(0, Math.sin(time * 0.9 + f.phase * 2));
      tension += ((holding ? 0.55 : -0.9) + (0.12 + surge * 0.55) * str) * dt;
      tension = Math.max(0, tension);
      const inZone = tension >= ZONE_LO && tension <= ZONE_HI;
      progress = clamp(progress + (inZone ? dt / Math.min(3 + f.kg * 0.5, 9) : -dt * 0.04), 0, 1);
      slack = tension <= 0.01 ? slack + dt : Math.max(0, slack - dt);

      // bobber is dragged toward the dock as progress grows; the fish pulls it side to side
      bobber.position.x = lerp(reelFrom.x, REEL_END.x, progress) + Math.sin(time * 1.3 + f.phase) * 0.8 * (1 - progress);
      bobber.position.z = lerp(reelFrom.z, REEL_END.z, progress);
      floatBobber(-0.1 - surge * 0.12);
      f.g.position.set(bobber.position.x, -0.45, bobber.position.z);
      f.g.rotation.y = Math.PI + Math.sin(time * 3) * 0.4;
      swimAnim(f, dt, 20, 0.2);
      if (surge > 0.4 && Math.random() < dt * 6) { splash(bobber.position.x, bobber.position.z, 0.4); sfx.sfxSplash(0.5); }
      if (holding && (tickT -= dt) <= 0) { sfx.sfxReelTick(); tickT = 0.07; }    // reel clicks while holding
      sfx.setStrain(tension > 0.8 ? (tension - 0.8) * 0.4 : 0);                 // line hums near breaking

      $('needle').style.left = `${Math.min(tension, 1) * 100}%`;
      $('progressFill').style.width = `${progress * 100}%`;
      $('tension').classList.toggle('danger', tension > 0.85);
      rodX = REST_X + 0.25 + tension * 0.35;
      rodZ = REST_Z + Math.sin(time * 40) * 0.03 * tension;
      sag = (1 - Math.min(tension, 1)) * 1.2;

      if (tension >= 1) lose('Snap! The line broke. Let go when the needle runs high.');
      else if (slack > 1.5) lose('The line went slack and the fish slipped off.');
      else if (progress >= 1) landCatch();
      break;
    }
    case 'landing': {
      landT += dt;
      const f = hooked, u = Math.min(landT / 0.9, 1);
      f.g.position.lerpVectors(landFrom, LAND_TO, u);
      f.g.position.y += Math.sin(Math.PI * u) * 1.2;
      f.g.rotation.set(0, Math.PI / 2 + Math.sin(time * 6) * 0.3, 0);  // side-on, flapping
      swimAnim(f, dt, 14, 0.22);
      bobber.position.copy(f.g.position).add(V(0, 0.35, 0));
      bobber.scale.setScalar(lerp(1, 0.4, u));
      rodX = REST_X + 0.5;
      sag = 0;
      if (landT > 2.4) {
        removeFish(f);
        spawnFish();
        hooked = null;
        state = 'idle';
        setStatus('Hold to cast again');
      }
      break;
    }
  }

  // ease the rod toward its target pose, then redraw the line
  rodPivot.rotation.x += (rodX - rodPivot.rotation.x) * Math.min(1, dt * 12);
  rodPivot.rotation.z += (rodZ - rodPivot.rotation.z) * Math.min(1, dt * 12);
  rodTip.getWorldPosition(tip);
  updateLine(sag);

  if (cardTimer > 0 && (cardTimer -= dt) <= 0) show('card', false);
}

// ============================================================
//  Input: mouse / touch / space bar
// ============================================================
function press() {
  sfx.initAudio(); // audio can only start after a user gesture
  if (state === 'idle') {
    state = 'charging'; chargeT = 0; power = 0;
    show('power', true); show('card', false); setStatus('Release to cast');
  } else if (state === 'waiting') reelInEmpty();
  else if (state === 'bite') hook();
  else if (state === 'reeling') holding = true;
}
function release() {
  if (state === 'charging') cast();
  holding = false;
}
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 0) press(); });
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('pointermove', (e) => { aimX = (e.clientX / window.innerWidth) * 2 - 1; });
// mute button + M key
const soundBtn = $('sound');
const showMute = () => { soundBtn.textContent = sfx.isMuted() ? '🔇 Sound off (M)' : '🔊 Sound on (M)'; };
showMute();
soundBtn.addEventListener('click', () => { sfx.initAudio(); sfx.toggleMute(); showMute(); soundBtn.blur(); }); // blur so Space doesn't re-press it
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') { sfx.initAudio(); sfx.toggleMute(); showMute(); } });

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (!e.repeat) press();
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  Main loop
// ============================================================
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // cap so a background tab doesn't jump
  time += dt;
  updateWater(time);
  updateFish(dt);
  updateGame(dt);
  updateSplashes(dt);
  renderer.render(scene, camera);
});

// ============================================================
//  Preview mode: open ?preview to see every species up close
// ============================================================
if (new URLSearchParams(location.search).has('preview')) {
  const shown = SPECIES.map((sp, i) => {
    const { g, u } = createFish(sp);
    g.scale.setScalar(0.55);
    g.position.set(-2.4 + i * 1.2, 2.2 + (i % 2) * 0.25, 0.6);
    g.rotation.y = Math.PI / 2;      // side-on, nose to the right
    scene.add(g);
    return { g, u };
  });
  rodPivot.visible = bobber.visible = line.visible = false;
  setStatus('Preview: ' + SPECIES.map((s) => s.name).join(' · '));
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    updateWater(time);
    for (const f of shown) { f.u.uSwim.value += dt * 6; f.u.uAmp.value = 0.12; }
    renderer.render(scene, camera);
  });
}
