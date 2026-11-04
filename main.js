import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Renderer: draws to a <canvas> using WebGL
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Scene: the container for everything we draw
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1117);
scene.fog = new THREE.Fog(0x0f1117, 12, 30);

// 3. Camera: field of view 60°, aspect, near/far clip planes
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4, 3, 6);

// 4. Controls: mouse drag to orbit around the target
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// 5. Lights
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242c, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 8, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// 6. Objects
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2; // plane is vertical by default; lay it flat
ground.receiveShadow = true;
scene.add(ground);

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.7, 0.25, 160, 24),
  new THREE.MeshStandardMaterial({ color: 0xff6b4a, metalness: 0.3, roughness: 0.35 })
);
knot.position.set(0, 1.6, 0);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4ac1ff, roughness: 0.5 })
);
cube.position.set(-2.5, 0.5, 0.5);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.1, roughness: 0.2 })
);
sphere.position.set(2.4, 0.6, -0.5);

const shapes = [knot, cube, sphere];
for (const m of shapes) {
  m.castShadow = true;
  scene.add(m);
}

// 7. Click to recolor: cast a ray from the camera through the mouse point
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  // convert pixels to normalized device coords (-1..1)
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(shapes)[0];
  if (hit) hit.object.material.color.setHSL(Math.random(), 0.7, 0.55);
});

// 8. Keep canvas and camera in sync with window size
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 9. Animation loop: runs ~60 times per second
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  knot.rotation.x = t * 0.4;
  knot.rotation.y = t * 0.6;
  cube.rotation.y = t;
  sphere.position.y = 0.6 + Math.abs(Math.sin(t * 2)) * 0.8; // bounce
  controls.update();
  renderer.render(scene, camera);
});
