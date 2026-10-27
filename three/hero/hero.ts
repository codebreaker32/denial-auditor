import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMRIScannerModel } from '../mri/src/createObjectModel';

// Hero renders for the deck and app: the img2threejs MRI scanner (stylized, user-accepted 2026-10-26)
// and the synthetic fax notice, each floating in a glass bubble, rendered on a transparent background.
// ?subject=mri|fax  ?bubble=0|1  ?w=&h=  ?az=&el=

const q = new URLSearchParams(location.search);
const subject = q.get('subject') ?? 'mri';
const withBubble = q.get('bubble') !== '0';
const w = Number(q.get('w') ?? 1200), h = Number(q.get('h') ?? 1200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(w, h);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// Soft studio light: a warm key from upper left, a cool fill, and a shadow-catcher for contact shadow.
const key = new THREE.DirectionalLight(0xfff6ec, 2.4);
key.position.set(-3, 6, 4);
key.castShadow = true;
key.intensity = 2.8;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 8;
key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dce3, 0.9));

const plastic = (color: string, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25 });
const MATERIALS: Record<string, THREE.Material> = {
  shell: plastic('#F3F1EC'),
  cover: plastic('#EFE6D4', 0.48),
  pad: plastic('#F2DFA0', 0.6),
  trim: new THREE.MeshPhysicalMaterial({ color: '#B7BBC2', roughness: 0.32, metalness: 0.6 }),
  display: new THREE.MeshPhysicalMaterial({ color: '#1F2328', roughness: 0.12, metalness: 0, clearcoat: 1 }),
};

function componentOf(o: THREE.Object3D): any {
  let n: THREE.Object3D | null = o;
  while (n) { if ((n.userData as any).sculptComponent) return (n.userData as any).sculptComponent; n = n.parent; }
  return null;
}

function bevelledExtrude(profile: { points: [number, number][]; depth: number; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }, bevel: number) {
  const shape = new THREE.Shape(profile.points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const o of profile.ovalHoles ?? []) {
    const p = new THREE.Path();
    p.absellipse(o.cx, o.cy, o.rx + bevel, o.ry + bevel, 0, Math.PI * 2, true, 0);
    shape.holes.push(p);
  }
  // Inset the outline by the bevel so the bevelled solid keeps the specified outer size.
  const inset = new THREE.Shape(profile.points.map(([x, y]) => { const r = Math.hypot(x, y) || 1; return new THREE.Vector2(x * (1 - bevel / r), y * (1 - bevel / r)); }));
  inset.holes = shape.holes;
  const g = new THREE.ExtrudeGeometry(inset, { depth: profile.depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 8, curveSegments: 96, steps: 1 });
  g.translate(0, 0, bevel);
  return g;
}

function buildMri(): THREE.Object3D {
  const model = createMRIScannerModel();
  model.traverse((o: any) => {
    if (!o.isMesh) return;
    const c = componentOf(o);
    if (c) o.material = MATERIALS[c.material] ?? MATERIALS.shell;
    o.castShadow = true; o.receiveShadow = true;
    if (c && c.id === 'gantry-shell') o.geometry = bevelledExtrude(c.geometryDescriptor.profile2D, 0.09);
    if (c && c.id === 'front-cover-panel') o.geometry = bevelledExtrude(c.geometryDescriptor.profile2D, 0.012);
    if (c && c.id === 'bore-liner') { o.geometry = new THREE.LatheGeometry(c.geometryDescriptor.latheProfile.points.map(([x, y]: number[]) => new THREE.Vector2(x, y)), 128); }
  });
  return model;
}

function buildFax(): Promise<THREE.Object3D> {
  // The real synthetic denial notice, on a gently curled sheet of paper.
  return new THREE.TextureLoader().loadAsync('letter.png').then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const aspect = 2200 / 1700;
    const g = new THREE.PlaneGeometry(2, 2 * aspect, 60, 80);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, 0.12 * Math.sin((x + 1) * Math.PI * 0.5) + 0.18 * Math.pow((y + aspect) / (2 * aspect), 3));
    }
    g.computeVertexNormals();
    const front = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.85, sheen: 0.2, side: THREE.FrontSide });
    const back = new THREE.MeshPhysicalMaterial({ color: '#F4F2EE', roughness: 0.9, side: THREE.BackSide });
    const grp = new THREE.Group();
    const a = new THREE.Mesh(g, front), b = new THREE.Mesh(g, back);
    a.castShadow = b.castShadow = true;
    grp.add(a, b);
    grp.rotation.set(-0.18, 0.42, 0.08);
    return grp;
  });
}

async function main() {
  const subjectObj = subject === 'fax' ? await buildFax() : buildMri();
  // Fit the subject inside a unit sphere.
  const box = new THREE.Box3().setFromObject(subjectObj);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const s = (subject === 'fax' ? 1.32 : Number(q.get('fit') ?? 1.62)) / Math.max(size.x, size.y, size.z);
  const holder = new THREE.Group();
  subjectObj.position.sub(center);
  holder.add(subjectObj);
  holder.scale.setScalar(s);
  if (subject === 'mri') holder.rotation.set(0.1, -0.45, 0);
  scene.add(holder);

  if (withBubble) {
    // Clear soap-glass: transparent centre, bright fresnel rim with a faint cool-to-warm tint,
    // plus the environment's specular highlights from a clearcoated shell.
    const rim = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tint: { value: new THREE.Color('#BFD3FF') }, warm: { value: new THREE.Color('#FFE3B0') } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 tint; uniform vec3 warm; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); vec3 c = mix(tint, warm, smoothstep(-1.0, 1.0, vP.y)); gl_FragColor = vec4(mix(vec3(1.0), c, 0.55), 0.02 + 0.55*f); }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 128, 96), rim));
    const shine = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.06, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 2.2, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.085, 128, 96), shine));
  }

  // A floating sphere casts one soft round contact shadow, drawn as a radial gradient below it.
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sx = sc.getContext('2d')!;
  const gr = sx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(20,24,32,0.22)'); gr.addColorStop(0.55, 'rgba(20,24,32,0.08)'); gr.addColorStop(1, 'rgba(20,24,32,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.22;
  scene.add(shadow);
  if (withBubble) {
    // The window highlight every glass sphere carries, upper left.
    const hc = document.createElement('canvas'); hc.width = hc.height = 128;
    const hx = hc.getContext('2d')!;
    const hg = hx.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0, 'rgba(255,255,255,0.95)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    hx.fillStyle = hg; hx.fillRect(0, 0, 128, 128);
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), depthWrite: false, toneMapped: false, opacity: 0.85 }));
    hl.scale.set(0.34, 0.2, 1); hl.position.set(-0.55, 0.62, 0.62);
    scene.add(hl);
  }

  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  const az = (Number(q.get('az') ?? 0) * Math.PI) / 180, el = (Number(q.get('el') ?? 8) * Math.PI) / 180;
  const d = 4.6;
  camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  (window as any).__ready = true;
}
main();
