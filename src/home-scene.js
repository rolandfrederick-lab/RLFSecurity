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

const LEAN = 0.3;         // badge tilt back from upright, in radians
const BADGE_HALF = 100;   // badge center to its top and bottom ball tips
const BALL_DEPTH = 5;     // how far the ball tips stick out behind the badge
const REST_RADIUS = 29;   // flashlight body radius where the badge top touches it
const TAIL_OFFSET = 201;  // flashlight center to the bottom of its tail switch
const STAGE_HEIGHT = 440; // ground to lens, roughly

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

  // Flashlight standing on its tail, lens up, centered on the spin axis.
  const flashlight = buildFlashlight();
  flashlight.rotation.z = Math.PI / 2;
  flashlight.position.set(0, TAIL_OFFSET, 0);

  // Badge: tilt it back and stand its bottom tip on the ground, with its top
  // tip resting against the front of the flashlight body.
  const lean = new Group();
  lean.add(buildBadge(font));
  lean.rotation.x = -LEAN;
  const topZ = REST_RADIUS + BALL_DEPTH;
  lean.position.set(0, BADGE_HALF * Math.cos(LEAN), topZ + BADGE_HALF * Math.sin(LEAN));

  const shadow = new Mesh(new PlaneGeometry(380, 380), new MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.5, 40);

  stage.add(shadow, flashlight, lean);
  // Center the pair vertically around the origin.
  stage.position.y = -STAGE_HEIGHT / 2 - 40;
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
    // Keep the whole still life in view, with room for the beam above it.
    const t = Math.tan((camera.fov * Math.PI / 180) / 2);
    const fitW = wide ? 700 : 420;
    const dist = Math.max((STAGE_HEIGHT * 1.45 / 2) / t, (fitW / 2) / (t * camera.aspect));
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
