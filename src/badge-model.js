// 3D metallic badge model (six-point star, PRIVATE / SECURITY banners, RLF seal).
//
// Shapes are laid out in the same 200 x 220 grid as the flat SVG badge
// (x right, y down, center 100,112) and converted to 3D space by toXY().

import {
  Group, Mesh, Shape, Path, ExtrudeGeometry, SphereGeometry, CylinderGeometry,
  MeshPhysicalMaterial, CanvasTexture, RepeatWrapping, QuadraticBezierCurve, Vector2, Matrix4
} from 'three';
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

// Returns a Group about 210 units tall, centered on the origin, facing +z,
// with its back face at z = 0.
export function buildBadge(font) {
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

  // Pin and catch on the back, like a real badge
  const pinBar = new Mesh(new CylinderGeometry(1.4, 1.4, 104, 16), silver);
  pinBar.rotation.z = Math.PI / 2;
  pinBar.position.set(2, 28, -3.2);
  badge.add(pinBar);
  for (const [x, r] of [[-54, 4], [54, 4.5]]) {
    const post = new Mesh(new CylinderGeometry(r, r, 5, 20), silverShade);
    post.rotation.x = Math.PI / 2;
    post.position.set(x, 28, -1.5);
    badge.add(post);
  }

  return badge;
}
