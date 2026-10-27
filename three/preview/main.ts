import * as THREE from 'three';
import { createMRIScannerModel, createMRIScannerLookDevLights, createMRIScannerEnvironment, frameMRIScannerCamera, configureMRIScannerRenderer } from '../mri/src/createObjectModel';

// Evaluation render: plain renderer, no composer (the review rules forbid DOF/bloom here).
const q = new URLSearchParams(location.search);
const w = Number(q.get('w') ?? 1280), h = Number(q.get('h') ?? 1166);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(w, h); renderer.setPixelRatio(1);
configureMRIScannerRenderer(renderer);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') ?? '#ECEAE6');
scene.environment = createMRIScannerEnvironment(renderer);
const model = createMRIScannerModel();
scene.add(model);
if (q.get('strip') === '1') model.traverse((o: any) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { for (const k of ['map','roughnessMap','metalnessMap','normalMap','aoMap','bumpMap','displacementMap','alphaMap','emissiveMap','clearcoatMap','thicknessMap','transmissionMap']) if (m[k]) m[k] = null; m.needsUpdate = true; } } });
const lights = createMRIScannerLookDevLights((q.get('mode') as any) ?? 'reference');
if (lights && (lights as any).isObject3D) scene.add(lights as any);
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 40), w / h, 0.01, 100);
frameMRIScannerCamera(camera, model, { azimuthDeg: Number(q.get('az') ?? -38), elevationDeg: Number(q.get('el') ?? 12), margin: Number(q.get('m') ?? 1.1) });
renderer.render(scene, camera);
(window as any).__ready = true;
