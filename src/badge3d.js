// 3D metallic badge for the home page hero.
// Built into public/js/badge3d.js with `npm run build` (see package.json).
//
// Shapes are laid out in the same 200 x 220 grid as the flat SVG badge
// (x right, y down, center 100,112) and converted to 3D space by toXY().

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, Path,
  ExtrudeGeometry, SphereGeometry, CylinderGeometry, MeshPhysicalMaterial,
  PMREMGenerator, DirectionalLight, ACESFilmicToneMapping, SRGBColorSpace,
  CanvasTexture, RepeatWrapping, QuadraticBezierCurve, Vector2, Matrix4
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const CX = 100, CY = 112;
const toXY = (x, y) => new Vector2(x - CX, -(y - CY));

// Ribbons curve slightly back toward their ends, like a stamped banner.
const bend = x => -3.2 * Math.pow(x / 62, 2);

function bendGeometry(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bend(p.getX(i)));
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function polyShape(points) {
  const s = new Shape();
  points.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return s;
}

function starPoints(outer, inner, n, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (-90 + i * (180 / n)) * Math.PI / 180;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(new Vector2(cx + r * Math.cos(a), cy - r * Math.sin(a)));
  }
  return pts;
}

// Fine engine-turned engraving used as a bump map on the gold.
function engravingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  g.lineWidth = 2;
  for (let i = -256; i < 512; i += 8) {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.moveTo(i + 4, 0); g.lineTo(i + 260, 256); g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 14, 1 / 14);
  return t;
}

function buildBadge(font) {
  const badge = new Group();
  const engraving = engravingTexture();

  const gold = new MeshPhysicalMaterial({
    color: 0xd9a93a, metalness: 1, roughness: 0.28, clearcoat: 0.15, clearcoatRoughness: 0.3
  });
  const goldEngraved = gold.clone();
  goldEngraved.bumpMap = engraving;
  goldEngraved.bumpScale = 0.6;
  goldEngraved.roughness = 0.32;
  const silver = new MeshPhysicalMaterial({
    color: 0xcfcfcc, metalness: 1, roughness: 0.22, clearcoat: 0.2, clearcoatRoughness: 0.2
  });
  const silverShade = silver.clone();
  silverShade.color.set(0xa9a8a3);
  silverShade.roughness = 0.3;
  const enamel = new MeshPhysicalMaterial({
    color: 0x050506, metalness: 0, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.25
  });

  // Six-point star
  const R = 90, Ri = R / Math.sqrt(3);
  const star = new ExtrudeGeometry(polyShape(starPoints(R, Ri, 6)), {
    depth: 3, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 4
  });
  badge.add(new Mesh(star, goldEngraved));

  // Raised polished rim around the star's edge
  const rimShape = polyShape(starPoints(R - 2, Ri - 1, 6));
  rimShape.holes.push(new Path(starPoints(R - 12, Ri - 7, 6).reverse()));
  const rim = new ExtrudeGeometry(rimShape, {
    depth: 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 3
  });
  rim.translate(0, 0, 4.5);
  badge.add(new Mesh(rim, gold));

  // Ball tips
  const ball = new SphereGeometry(7, 32, 20);
  for (let i = 0; i < 6; i++) {
    const a = (-90 + i * 60) * Math.PI / 180;
    const m = new Mesh(ball, gold);
    m.position.set((R + 2) * Math.cos(a), -(R + 2) * Math.sin(a), 2.5);
    badge.add(m);
  }

  // Center seal: silver ring, black enamel, gold disc, RLF
  const disc = (r, h, z, mat) => {
    const m = new Mesh(new CylinderGeometry(r, r, h, 72), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = z + h / 2;
    badge.add(m);
  };
  disc(25, 4, 4.5, silver);
  disc(22, 0.6, 8.5, enamel);
  disc(18.5, 1.2, 9.1, gold);

  const rlf = new TextGeometry('RLF', {
    font, size: 14, depth: 1.2, curveSegments: 8,
    bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 2
  });
  rlf.computeBoundingBox();
  const bb = rlf.boundingBox;
  rlf.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 10.3);
  badge.add(new Mesh(rlf, enamel));

  // Banners (outline, the midline the lettering follows, and tails)
  const banners = [
    {
      text: 'PRIVATE', size: 12.5,
      edge: [[38, CY - 35], [100, CY - 65], [162, CY - 35], [162, CY - 13], [100, CY - 43], [38, CY - 13]],
      mid: [[42, CY - 24], [100, CY - 54], [158, CY - 24]],
      tails: [[[36, CY - 23], [27, CY - 12], [42, CY - 11]], [[164, CY - 23], [173, CY - 12], [158, CY - 11]]]
    },
    {
      text: 'SECURITY', size: 11.5,
      edge: [[38, CY + 21], [100, CY + 51], [162, CY + 21], [162, CY + 43], [100, CY + 73], [38, CY + 43]],
      mid: [[42, CY + 32], [100, CY + 62], [158, CY + 32]],
      tails: [[[36, CY + 31], [27, CY + 42], [42, CY + 43]], [[164, CY + 31], [173, CY + 42], [158, CY + 43]]]
    }
  ];

  const BANNER_Z = 8.5, BANNER_DEPTH = 2.5, BANNER_FRONT = BANNER_Z + BANNER_DEPTH + 0.6;

  for (const b of banners) {
    const [p0, c0, p1, p2, c1, p3] = b.edge.map(([x, y]) => toXY(x, y));
    const s = new Shape();
    s.moveTo(p0.x, p0.y);
    s.quadraticCurveTo(c0.x, c0.y, p1.x, p1.y);
    s.lineTo(p2.x, p2.y);
    s.quadraticCurveTo(c1.x, c1.y, p3.x, p3.y);
    s.closePath();
    const g = new ExtrudeGeometry(s, {
      depth: BANNER_DEPTH, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 48
    });
    g.translate(0, 0, BANNER_Z);
    badge.add(new Mesh(bendGeometry(g), silver));

    for (const tail of b.tails) {
      const tg = new ExtrudeGeometry(polyShape(tail.map(([x, y]) => toXY(x, y))), {
        depth: 2, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2
      });
      tg.translate(0, 0, 6.5);
      badge.add(new Mesh(bendGeometry(tg), silverShade));
    }

    // Lay each letter along the banner's curved midline
    const curve = new QuadraticBezierCurve(...b.mid.map(([x, y]) => toXY(x, y)));
    const spacing = 2.4;
    const letters = [...b.text].map(ch => {
      const geo = new TextGeometry(ch, {
        font, size: b.size, depth: 1, curveSegments: 8,
        bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 2
      });
      geo.computeBoundingBox();
      const lb = geo.boundingBox;
      geo.translate(-(lb.min.x + lb.max.x) / 2, -(lb.min.y + lb.max.y) / 2, 0);
      return { geo, width: lb.max.x - lb.min.x };
    });
    const total = letters.reduce((w, l) => w + l.width, 0) + spacing * (letters.length - 1);
    const length = curve.getLength();
    let s0 = (length - total) / 2;
    for (const l of letters) {
      const u = (s0 + l.width / 2) / length;
      const pos = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      l.geo.applyMatrix4(new Matrix4().makeRotationZ(Math.atan2(tan.y, tan.x)));
      l.geo.translate(pos.x, pos.y, BANNER_FRONT);
      badge.add(new Mesh(bendGeometry(l.geo), enamel));
      s0 += l.width + spacing;
    }
  }

  // Three small stars on the lower point
  const small = [[92, CY + 66], [100, CY + 67.5], [108, CY + 66]];
  for (const [x, y] of small) {
    const c = toXY(x, y);
    const g = new ExtrudeGeometry(polyShape(starPoints(3.4, 1.5, 5, c.x, c.y)), {
      depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 1
    });
    g.translate(0, 0, 4.5);
    badge.add(new Mesh(g, enamel));
  }

  return badge;
}

function start(container) {
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // No WebGL: the flat SVG badge stays in place.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const key = new DirectionalLight(0xfff4dd, 0.6);
  key.position.set(-60, 120, 160);
  scene.add(key);
  const rimLight = new DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(120, -40, 80);
  scene.add(rimLight);

  const camera = new PerspectiveCamera(26, 1, 10, 2000);

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let badge = null;
  let targetX = 0, targetY = 0, curX = 0, curY = 0;
  let pointerActive = false;
  let visible = true;
  let running = false;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the whole badge (about 210 units tall, 200 wide) with a little margin.
    const fitH = 225, fitW = 215;
    const vFov = camera.fov * Math.PI / 180;
    const distH = (fitH / 2) / Math.tan(vFov / 2);
    const distW = (fitW / 2) / (Math.tan(vFov / 2) * camera.aspect);
    camera.position.set(0, 0, Math.max(distH, distW));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function render(time) {
    if (!badge) return;
    if (!pointerActive && !reduceMotion) {
      // Gentle idle sway so the light moves across the metal.
      targetY = Math.sin(time / 2200) * 0.3;
      targetX = Math.sin(time / 3100) * 0.12;
    }
    curX += (targetX - curX) * 0.06;
    curY += (targetY - curY) * 0.06;
    badge.rotation.set(curX, curY, 0);
    renderer.render(scene, camera);
  }

  function loop(time) {
    render(time);
    if (visible && !document.hidden && !reduceMotion) requestAnimationFrame(loop);
    else running = false;
  }

  function play() {
    if (!running && visible && !document.hidden && !reduceMotion) {
      running = true;
      requestAnimationFrame(loop);
    }
  }

  window.addEventListener('pointermove', e => {
    const r = container.getBoundingClientRect();
    const nx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2;
    const ny = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 2;
    targetY = Math.max(-1, Math.min(1, nx)) * 0.32;
    targetX = Math.max(-1, Math.min(1, ny)) * 0.2;
    pointerActive = e.pointerType === 'mouse';
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      play();
    }).observe(container);
  }
  document.addEventListener('visibilitychange', play);
  window.addEventListener('resize', () => { resize(); if (reduceMotion) render(0); });

  new FontLoader().load(new URL('fonts/cinzel-badge.json', document.baseURI).href, font => {
    badge = buildBadge(font);
    if (reduceMotion) badge.rotation.set(0.08, -0.25, 0);
    scene.add(badge);
    container.appendChild(canvas);
    resize();
    if (reduceMotion) { curX = 0.08; curY = -0.25; targetX = curX; targetY = curY; render(0); }
    container.classList.add('is-3d');
    play();
  });
}

document.querySelectorAll('[data-badge-3d]').forEach(start);
