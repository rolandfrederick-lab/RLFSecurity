// Home page background: the badge leaning against a flashlight, fixed behind
// the page. It turns one full circle as the visitor scrolls from top to bottom.
// Built into public/js/home-scene.js with `npm run build` (see package.json).

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, MeshBasicMaterial,
  PMREMGenerator, DirectionalLight, ACESFilmicToneMapping, SRGBColorSpace, CanvasTexture
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { buildBadge } from './badge-model.js';
import { buildFlashlight } from './flashlight-model.js';

const LEAN = 0.42;        // badge tilt back from upright, in radians
const BADGE_X = -60;      // where along the flashlight the badge rests
const BADGE_HALF = 100;   // badge center to its bottom ball tip
const REST_RADIUS = 35;   // flashlight radius at the contact point, plus clearance
const AXIS_Y = 38;        // flashlight axis height at its middle
const AXIS_TILT = 0.04;   // head is wider than the tail, so it sits slightly raised

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

function buildStage(font) {
  const stage = new Group();

  const flashlight = buildFlashlight();
  flashlight.rotation.z = AXIS_TILT;

  // Badge: tilt it back, stand its bottom tip on the ground, then move the
  // flashlight behind it so the badge's back rests on the flashlight body.
  const lean = new Group();
  lean.add(buildBadge(font));
  lean.rotation.x = -LEAN;
  lean.position.set(BADGE_X, BADGE_HALF * Math.cos(LEAN), 0);

  const axisAtBadge = AXIS_Y + BADGE_X * Math.tan(AXIS_TILT);
  const s = Math.sin(LEAN), c = Math.cos(LEAN);
  const flashZ = (-REST_RADIUS - s * (axisAtBadge - BADGE_HALF * c)) / c;
  flashlight.position.set(0, AXIS_Y, flashZ);

  const shadow = new Mesh(new PlaneGeometry(620, 240), new MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.5, flashZ + 10);

  stage.add(shadow, flashlight, lean);
  // Center the pair vertically around the origin.
  stage.position.y = -95;
  return stage;
}

function start(container) {
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // No WebGL: the page keeps its plain background.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const key = new DirectionalLight(0xfff1dc, 0.9);
  key.position.set(-200, 300, 400);
  const rim = new DirectionalLight(0xcfe0ff, 1.4); // outlines the dark flashlight
  rim.position.set(300, 200, -400);
  scene.add(key, rim);

  const camera = new PerspectiveCamera(30, 1, 10, 5000);
  const spin = new Group(); // turns with scrolling
  scene.add(spin);

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wide = false;
  let viewWidth = 1;
  let curAngle = null, curX = null;
  let running = false;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w > 900;
    // Keep the whole still life in view: about 560 units wide, 300 tall.
    const t = Math.tan((camera.fov * Math.PI / 180) / 2);
    const fitW = wide ? 900 : 600;
    const dist = Math.max(170 / t, (fitW / 2) / (t * camera.aspect));
    camera.position.set(0, dist * 0.22, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    viewWidth = 2 * dist * t * camera.aspect;
  }

  function targets() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / max));
    // Start beside the headline on wide screens, then glide to the center.
    const heroFade = Math.min(1, window.scrollY / (window.innerHeight * 0.8));
    return {
      angle: reduceMotion ? -0.55 : -0.55 + progress * Math.PI * 2,
      x: wide ? viewWidth * 0.22 * (1 - heroFade) : 0
    };
  }

  function frame(time) {
    const t = targets();
    if (curAngle === null || reduceMotion) { curAngle = t.angle; curX = t.x; }
    curAngle += (t.angle - curAngle) * 0.08;
    curX += (t.x - curX) * 0.08;
    spin.rotation.y = curAngle;
    spin.position.x = curX;
    spin.position.y = reduceMotion ? 0 : Math.sin(time / 1800) * 3;
    renderer.render(scene, camera);

    const settled = Math.abs(t.angle - curAngle) < 0.0005 && Math.abs(t.x - curX) < 0.05;
    if (!document.hidden && !(reduceMotion && settled)) requestAnimationFrame(frame);
    else running = false;
  }

  function play() {
    if (!running && !document.hidden) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  if (reduceMotion) {
    // No continuous motion: keep a fixed view and redraw only when needed.
    window.addEventListener('scroll', play, { passive: true });
  }
  window.addEventListener('resize', () => { resize(); play(); });
  document.addEventListener('visibilitychange', play);

  new FontLoader().load(new URL('fonts/cinzel-badge.json', document.baseURI).href, font => {
    spin.add(buildStage(font));
    container.appendChild(canvas);
    resize();
    container.classList.add('ready');
    play();
  });
}

document.querySelectorAll('[data-home-scene]').forEach(start);
