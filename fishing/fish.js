import * as THREE from 'three';

// ============================================================
//  Species: game stats + how each one looks
//  odds = how common it is [near, middle, far] from the dock
// ============================================================
export const SPECIES = [
  { name: 'Roach', rarity: 'Common', min: 0.1, max: 0.6, strength: 0.45, pts: 8, odds: [40, 20, 8],
    look: { h: 1.3, w: 0.5, back: '#3b4e60', side: '#c9d3da', side2: '#e6ebee', belly: '#f8f6f0',
      fin: 0xd1452e, iris: 0xd23a2a, pattern: 'roach', fork: 0.07,
      dorsal: [0.44, 0.6, 0.2], anal: [0.18, 0.32, 0.12] } },
  { name: 'Perch', rarity: 'Common', min: 0.2, max: 1.2, strength: 0.55, pts: 10, odds: [50, 30, 15],
    look: { h: 1.35, w: 0.5, back: '#2f421c', side: '#99a038', side2: '#c9c46c', belly: '#f2ead0',
      fin: 0xe2552d, topFin: 0x6b6e50, iris: 0xe0b23a, pattern: 'perch', fork: 0.04,
      spiny: [0.5, 0.74, 0.24], dorsal: [0.3, 0.47, 0.15], anal: [0.2, 0.32, 0.12] } },
  { name: 'Pike', rarity: 'Uncommon', min: 1.5, max: 9, strength: 1.0, pts: 14, odds: [8, 25, 25],
    look: { h: 0.72, w: 0.68, back: '#26371c', side: '#566f32', side2: '#87974e', belly: '#eef0dc',
      fin: 0x8a7440, iris: 0xd6b94a, pattern: 'pike', fork: 0.03,
      dorsal: [0.1, 0.26, 0.16], anal: [0.1, 0.24, 0.14] } },
  { name: 'Salmon', rarity: 'Rare', min: 2, max: 12, strength: 1.2, pts: 18, odds: [2, 15, 28],
    look: { h: 1.0, w: 0.48, back: '#3d5266', side: '#bfc9d2', side2: '#e2e6ea', belly: '#fbfbfb',
      fin: 0x7d8f9e, iris: 0xc9ced3, pattern: 'salmon', fork: 0.025, adipose: 0.2,
      dorsal: [0.45, 0.6, 0.18], anal: [0.18, 0.3, 0.11] } },
  { name: 'Golden Trout', rarity: 'Legendary', min: 1, max: 5, strength: 1.4, pts: 60, odds: [0, 3, 9],
    look: { h: 1.08, w: 0.5, back: '#6f6420', side: '#f2b625', side2: '#f8d35c', belly: '#e3532a',
      fin: 0xf08a2b, iris: 0xf2c94c, pattern: 'golden', fork: 0.03, adipose: 0.2,
      dorsal: [0.45, 0.6, 0.18], anal: [0.18, 0.3, 0.12] } },
];

// ============================================================
//  Body shape: half-height along the fish, t = 0 tail → 1 nose
//  The fish lies along z, from z = -1 (tail) to z = +1 (nose)
// ============================================================
// one smooth curve: thin at the tail, deepest a bit ahead of the middle, rounded-pointed nose
function prof(t) {
  return 0.045 * (1 - t) + 0.55 * t * Math.pow(1 - t, 0.7);
}
const zAt = (t) => -1 + 2 * t;

// A tube of ellipse-shaped rings; uv.x runs tail → nose, uv.y runs belly → back
function bodyGeometry(L) {
  const NL = 64, NR = 36, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NL; i++) {
    const t = i / NL, h = prof(t) * L.h, w = h * L.w, c = -0.02 * Math.sin(Math.PI * t) * L.h;
    for (let j = 0; j <= NR; j++) {
      const a = -Math.PI / 2 + (j / NR) * Math.PI * 2; // start at the belly so the seam is hidden
      const s = Math.sin(a), co = Math.cos(a);
      const hy = s > 0 ? h : h * 1.08;                  // belly slightly fuller than the back
      pos.push(w * co, c + hy * s, zAt(t));
      uv.push(t, (s + 1) / 2);
    }
  }
  for (let i = 0; i < NL; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + NR + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const center = pos.length / 3;                       // close the hole at the tail end
  pos.push(0, 0, -1); uv.push(0, 0.5);
  for (let j = 0; j < NR; j++) idx.push(center, j + 1, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ============================================================
//  Painted skin, one canvas per species (canvas top = fish's back)
// ============================================================
const skinCache = new Map();
function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function skinTexture(L) {
  if (skinCache.has(L)) return skinCache.get(L);
  const W = 1024, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), r = seeded(42);

  // dark back → silver side → pale belly
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.back); g.addColorStop(0.3, L.side); g.addColorStop(0.52, L.side2);
  g.addColorStop(0.72, L.belly); g.addColorStop(1, L.belly);
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  x.save();
  if (L.pattern === 'perch') {            // dark vertical bars
    x.filter = 'blur(5px)'; x.fillStyle = 'rgba(28,38,14,0.62)';
    for (let i = 0; i < 7; i++) {
      const cx = W * (0.2 + i * 0.085);
      x.beginPath(); x.moveTo(cx - 20, 0); x.lineTo(cx + 20, 0); x.lineTo(cx + 5, H * 0.64); x.lineTo(cx - 5, H * 0.64); x.fill();
    }
  } else if (L.pattern === 'pike') {      // rows of pale bean-shaped spots
    x.fillStyle = 'rgba(222,220,145,0.78)';
    for (let i = 0; i < 260; i++) {
      x.beginPath();
      x.ellipse(r() * W * 0.88, H * (0.1 + r() * 0.56), 6 + r() * 7, 3 + r() * 2.5, (r() - 0.5) * 0.4, 0, Math.PI * 2);
      x.fill();
    }
  } else if (L.pattern === 'salmon') {    // pink sheen + black speckles on the upper half
    x.filter = 'blur(10px)'; x.fillStyle = 'rgba(232,170,160,0.22)'; x.fillRect(0, H * 0.38, W, H * 0.2);
    x.filter = 'none'; x.fillStyle = 'rgba(18,22,28,0.85)';
    for (let i = 0; i < 90; i++) {
      const px = r() * W * 0.9, py = H * (0.04 + r() * 0.34), s = 2 + r() * 2.5;
      x.fillRect(px - s, py - 1, s * 2, 2); x.fillRect(px - 1, py - s, 2, s * 2); // small x-marks
    }
  } else if (L.pattern === 'golden') {    // red side band, soft parr marks, dark speckles
    x.filter = 'blur(7px)'; x.fillStyle = 'rgba(214,52,32,0.72)';
    x.beginPath(); x.ellipse(W * 0.45, H * 0.53, W * 0.42, H * 0.05, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(95,90,30,0.32)';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(W * (0.14 + i * 0.075), H * 0.5, 17, 34, 0, 0, Math.PI * 2); x.fill(); }
    x.filter = 'none'; x.fillStyle = 'rgba(40,35,10,0.7)';
    for (let i = 0; i < 50; i++) { x.beginPath(); x.arc(r() * W * 0.9, H * (0.04 + r() * 0.26), 2 + r() * 2, 0, Math.PI * 2); x.fill(); }
  } else if (L.pattern === 'roach') {     // faint blue sheen
    x.filter = 'blur(12px)'; x.fillStyle = 'rgba(120,150,190,0.18)'; x.fillRect(0, H * 0.25, W, H * 0.15);
  }
  x.restore();

  // scales: rows of tiny overlapping arcs (light edge + dark shadow)
  x.lineWidth = 1.2;
  for (let row = 0, y = 4; y < H; row++, y += 9) {
    for (let px = (row % 2) * 6; px < W * 0.79; px += 12) {
      x.strokeStyle = 'rgba(255,255,255,0.10)';
      x.beginPath(); x.arc(px, y, 7, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.07)';
      x.beginPath(); x.arc(px, y + 1.5, 7, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    }
  }
  // lateral line
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, H * 0.48); x.quadraticCurveTo(W * 0.45, H * 0.44, W * 0.79, H * 0.36); x.stroke();
  // gill cover
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(W * 0.8, H * 0.1); x.quadraticCurveTo(W * 0.765, H * 0.55, W * 0.81, H * 0.9); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(W * 0.808, H * 0.12); x.quadraticCurveTo(W * 0.774, H * 0.55, W * 0.818, H * 0.88); x.stroke();
  // mouth
  x.strokeStyle = 'rgba(20,10,10,0.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(W * 0.955, H * 0.57); x.lineTo(W, H * 0.55); x.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  skinCache.set(L, tex);
  return tex;
}

// Fin texture: white with fine dark rays, more see-through toward the tips.
// dir 'x' = rays run left → right, 'y' = bottom → top.
const finTex = {};
function finTexture(dir) {
  if (finTex[dir]) return finTex[dir];
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = dir === 'x' ? x.createLinearGradient(0, 0, S, 0) : x.createLinearGradient(0, S, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.65)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'source-atop';
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const f = (i + 0.5) / 16;
    x.beginPath();
    if (dir === 'x') { x.moveTo(0, S / 2 + (f - 0.5) * 30); x.lineTo(S, f * S); }
    else { x.moveTo(S / 2 + (f - 0.5) * 30, S); x.lineTo(f * S, 0); }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  finTex[dir] = tex;
  return tex;
}

// ============================================================
//  Fins (built flat, then moved into place in the fish's space)
// ============================================================
function shapeGeo(shape) {
  const g = new THREE.ShapeGeometry(shape, 12);
  g.computeBoundingBox();
  const b = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {   // stretch the texture over the whole fin
    uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  return g;
}
// A fin standing on the back (sign = 1) or belly (sign = -1), spanning t0..t1
function finAlong(L, [t0, t1, ht], sign, spiny = false) {
  const s0 = -zAt(t1), s1 = -zAt(t0), len = s1 - s0, s = new THREE.Shape();
  s.moveTo(s0, 0);
  if (spiny) {                          // perch's spiky front dorsal
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n, hh = ht * (1 - 0.5 * u);
      s.lineTo(s0 + len * u, sign * hh);
      if (i < n) s.lineTo(s0 + len * (u + 0.5 / n), sign * hh * 0.68);
    }
  } else {
    s.lineTo(s0 + len * 0.14, sign * ht);
    s.quadraticCurveTo(s0 + len * 0.5, sign * ht * 0.55, s1, sign * ht * 0.18);
  }
  s.lineTo(s1, 0);
  s.closePath();
  const g = shapeGeo(s);
  g.rotateY(Math.PI / 2);               // shape x → fish -z
  const base = Math.min(prof(t0), prof(t1)) * L.h * 0.85;
  g.translate(0, sign > 0 ? base : -base * 1.08, 0);
  return g;
}
function tailGeo(L) {
  const s = new THREE.Shape(), notch = 0.32 - L.fork * 2;
  s.moveTo(0, 0.05);
  s.quadraticCurveTo(0.12, 0.08, 0.32, 0.26);
  s.quadraticCurveTo(0.27, 0.12, notch, 0);
  s.quadraticCurveTo(0.27, -0.12, 0.32, -0.26);
  s.quadraticCurveTo(0.12, -0.08, 0, -0.05);
  s.closePath();
  const g = shapeGeo(s);
  g.scale(1, 0.85 + 0.15 * L.h, 1);
  g.rotateY(Math.PI / 2);
  g.translate(0, 0, -0.97);
  return g;
}
// Paired side fins (pectoral behind the gills, pelvic under the belly)
function sideFin(L, t, side, size, yK, xK) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.025);
  s.quadraticCurveTo(0.14, 0.05, 0.2, -0.01);
  s.quadraticCurveTo(0.12, -0.045, 0, -0.025);
  s.closePath();
  const g = shapeGeo(s);
  g.scale(size, size, size);
  g.rotateY(Math.PI / 2 - side * 0.45); // point back and a little outward
  const h = prof(t) * L.h, w = h * L.w;
  g.translate(side * w * xK, h * yK, zAt(t));
  return g;
}

// ============================================================
//  Swimming: bend every vertex sideways with a wave that grows
//  toward the tail (done on the GPU, inside the material shader)
// ============================================================
function addSwim(mat, u) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwim = u.uSwim;
    shader.uniforms.uAmp = u.uAmp;
    shader.vertexShader = 'uniform float uSwim;\nuniform float uAmp;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float env = pow(clamp((1.0 - position.z) * 0.5, 0.0, 1.6), 2.0);
       transformed.x += uAmp * env * sin(uSwim - position.z * 2.6);`
    );
  };
  mat.customProgramCacheKey = () => 'fish-swim';
  return mat;
}

// ============================================================
//  Build one fish. Returns { g: Group, u: swim uniforms }
// ============================================================
export function createFish(sp) {
  const L = sp.look;
  const u = { uSwim: { value: Math.random() * 10 }, uAmp: { value: 0.1 } };
  const g = new THREE.Group();

  const body = new THREE.Mesh(bodyGeometry(L), addSwim(new THREE.MeshPhysicalMaterial({
    map: skinTexture(L), roughness: 0.36, metalness: 0.12,
    clearcoat: 0.7, clearcoatRoughness: 0.3, iridescence: 0.35, iridescenceIOR: 1.6,
  }), u));
  g.add(body);

  const finMat = (color, dir) => addSwim(new THREE.MeshStandardMaterial({
    color, map: finTexture(dir), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55,
  }), u);
  const lowX = finMat(L.fin, 'x'), lowY = finMat(L.fin, 'y'), topY = finMat(L.topFin ?? L.fin, 'y');

  g.add(new THREE.Mesh(tailGeo(L), lowX));
  if (L.spiny) g.add(new THREE.Mesh(finAlong(L, L.spiny, 1, true), topY));
  g.add(new THREE.Mesh(finAlong(L, L.dorsal, 1), topY));
  g.add(new THREE.Mesh(finAlong(L, L.anal, -1), lowY));
  if (L.adipose) g.add(new THREE.Mesh(finAlong(L, [L.adipose - 0.03, L.adipose + 0.03, 0.05], 1), topY));
  for (const side of [1, -1]) {
    g.add(new THREE.Mesh(sideFin(L, 0.74, side, 1.6, -0.35, 0.92), lowX));  // pectoral
    g.add(new THREE.Mesh(sideFin(L, 0.5, side, 1.3, -0.9, 0.4), lowX));   // pelvic
  }

  // eyes: shiny iris + dark glossy pupil
  const t = 0.87, h = prof(t) * L.h, w = h * L.w, r = 0.026 + 0.008 * L.h;
  const irisMat = new THREE.MeshStandardMaterial({ color: L.iris, metalness: 0.6, roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05 });
  for (const side of [1, -1]) {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), irisMat);
    iris.position.set(side * (0.95 * w - 0.35 * r), h * 0.3, zAt(t));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 16, 12), pupilMat);
    pupil.position.set(side * (0.95 * w + 0.3 * r), h * 0.3, zAt(t));
    g.add(iris, pupil);
  }
  return { g, u };
}
