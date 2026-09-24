// 3D tactical flashlight: anodized aluminum body, knurled grip, steel bezel
// and clip, rubber tail switch, glowing lens and a soft light beam.

import {
  Group, Mesh, LatheGeometry, CylinderGeometry, CircleGeometry, BoxGeometry, ConeGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping,
  AdditiveBlending, DoubleSide, Vector2
} from 'three';

// Diamond knurling used as a bump map on the grip.
function knurlTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#000000';
  g.lineWidth = 5;
  for (let i = -128; i <= 256; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(10, 8);
  return t;
}

// Light fading from the lens outward, for the beam cone.
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return new CanvasTexture(c);
}

const lathe = (pts, mat) => new Mesh(new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 96), mat);

// Returns a Group about 420 units long lying along the x axis, lens facing +x,
// centered on the origin. `LENGTH` and radii are exported for placing props.
export const LENGTH = 420;
export const BODY_RADIUS = 28;
export const HEAD_RADIUS = 46;

export function buildFlashlight({ beam = true } = {}) {
  const light = new Group();
  const side = new Group();  // turns the flashlight onto its side
  const inner = new Group(); // built along +y (tail at 0)
  light.add(side);
  side.add(inner);

  const anodized = new MeshPhysicalMaterial({
    color: 0x1b1b1e, metalness: 0.75, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5
  });
  const knurled = anodized.clone();
  knurled.bumpMap = knurlTexture();
  knurled.bumpScale = 1.2;
  knurled.roughness = 0.55;
  const steel = new MeshPhysicalMaterial({ color: 0xc9c9c6, metalness: 1, roughness: 0.22 });
  const rubber = new MeshStandardMaterial({ color: 0x101011, metalness: 0, roughness: 0.85 });

  // Main body: tail cap, body, flared head
  inner.add(lathe([
    [0, 6], [24, 6], [29, 10], [30, 16], [30, 44], [28, 48],
    [28, 250], [30, 262], [42, 300], [44, 306], [44, 358], [0, 358]
  ], anodized));

  // Knurled grip sleeve with two machined rings
  const grip = new Mesh(new CylinderGeometry(28.6, 28.6, 170, 96, 1, true), knurled);
  grip.position.y = 150;
  inner.add(grip);
  for (const y of [62, 238]) {
    const ring = new Mesh(new CylinderGeometry(29.6, 29.6, 5, 96), anodized);
    ring.position.y = y;
    inner.add(ring);
  }

  // Steel bezel with a lip around the lens
  inner.add(lathe([[44, 356], [46, 360], [46, 392], [44, 396], [38, 396], [38, 390], [0, 390]], steel));

  // Reflector and glowing lens
  const reflector = lathe([[10, 372], [37, 389], [37.5, 390], [0, 390]], steel);
  inner.add(reflector);
  const lens = new Mesh(new CircleGeometry(37, 64), new MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff1d0, emissiveIntensity: beam ? 2.6 : 0.2, roughness: 0.1
  }));
  lens.rotation.x = -Math.PI / 2;
  lens.position.y = 391;
  inner.add(lens);

  // Rubber tail switch
  const button = new Mesh(new CylinderGeometry(14, 16, 8, 48), rubber);
  button.position.y = 3;
  inner.add(button);

  // Pocket clip
  const clip = new Mesh(new BoxGeometry(9, 118, 3), steel);
  clip.position.set(0, 112, 31);
  inner.add(clip);
  const clipFoot = new Mesh(new BoxGeometry(9, 6, 7), steel);
  clipFoot.position.set(0, 53, 29.5);
  inner.add(clipFoot);

  // Lay it on its side: tail toward -x, lens toward +x.
  inner.position.y = -LENGTH / 2 + 10;
  side.rotation.z = -Math.PI / 2;

  if (beam) {
    const cone = new Mesh(new ConeGeometry(190, 620, 64, 1, true), new MeshBasicMaterial({
      color: 0xffe9b8, alphaMap: beamTexture(), transparent: true, opacity: 0.22,
      blending: AdditiveBlending, depthWrite: false, side: DoubleSide
    }));
    // Cone apex points +y by default; flip so it opens away from the lens.
    cone.rotation.z = Math.PI;
    cone.position.y = 391 + 310;
    inner.add(cone);
  }

  return light;
}
