import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius: number,
  cylLength: number,
  capSegments: number,
  radialSegments: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom: number) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts: number[] = [];
  const ringV: number[] = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts: number[] = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts: number[] = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: MRI Scanner
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createMRIScannerModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "MRI Scanner";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "analysisArtifact": "/home/aman/projects/nebius-nvidia/three/mri/material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "gantry-shell", "regionId": "shell", "specMaterialId": "shell", "profileId": "plastic.matte", "status": "proceed"}, {"componentId": "front-cover-panel", "regionId": "cover", "specMaterialId": "cover", "profileId": "plastic.matte", "status": "proceed"}, {"componentId": "couch-pad", "regionId": "pad", "specMaterialId": "pad", "profileId": "plastic.matte", "status": "proceed"}, {"componentId": "gantry-plinth", "regionId": "trim", "specMaterialId": "trim", "profileId": "metal.aluminum", "status": "proceed"}, {"componentId": "display-panel", "regionId": "display", "specMaterialId": "display", "profileId": "glass.clear", "status": "proceed"}], "controlledViewsRequired": ["albedo-unlit", "backlight-transmission", "environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["shell"] = createSculptMaterial(
    "shell",
    {"id": "shell", "name": "Shell plastic", "baseColor": "#EDEAE4", "roughness": {"base": 0.68, "variation": 0.06, "map": "material-evidence/shell_roughness.png"}, "metalness": {"base": 0.0, "variation": 0.0}, "finish": "satin", "evidenceRefs": ["gantry-front"], "finishClass": "plastic", "texturePalette": ["#EDEAE4", "#E2DED6"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.3, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5, "variation": 0.0}, "envMapIntensity": 0.7, "referenceMaterialId": "plastic.matte", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "matte", "materialReference": {"registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.matte", "method": "family-subtype-finish", "confidence": 0.831, "sourceRefs": ["three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "aoMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing"]}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1, 1], "anisotropy": 8, "colorSpace": "SRGBColorSpace for albedo; NoColorSpace for scalar/normal maps", "mapBindings": ["roughnessMap"]}, "referencePbr": {"version": "1.0", "sourceImage": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/00-shell.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.831, "estimatedFidelity": 0.831, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"roughness": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-00-shell/shell_roughness.png", "url": "shell_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-00-shell/shell_height.png", "url": "shell_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-00-shell/shell_normal.png", "url": "shell_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-00-shell/shell_ao.png", "url": "shell_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "albedo": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-00-shell/shell_albedo.png", "url": "shell_albedo.png", "channel": "albedo", "source": "solid base colour (flat-paint rule; reference pixels carried room lighting)"}}, "diagnostics": {"sourceWidth": 160, "sourceHeight": 190, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 160, "height": 186}, "mask": {"backgroundColor": "#7C7272", "backgroundNoise": 48.114, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.1357}, "mapStats": {"valueRange": 0.1086, "heightP90Gradient": 0.03626, "roughnessBase": 0.68, "roughnessVariation": 0.058, "normalStrength": 0.199, "blurRadius": 10}, "palette": ["#6C5D56", "#655852", "#73645D", "#5F534D", "#7D6D66"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}, "textureAnalysis": {"finishClass": "plastic", "recipe": {"metalness": 0.05, "roughness": 0.6, "clearcoat": 0.2, "clearcoatRoughness": 0.3, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.7, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#676262", "#6D6665", "#7E7675", "#908787", "#9C9698"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 122.8, "meanSaturation": 0.079, "gradientStrength": 0.206, "mottle": 0.014, "streakRatio": 1.16, "hueSpread": 0.003, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "gantry-shell", "regionId": "shell", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/00-shell.png", "bbox": {"x": 1560, "y": 330, "width": 160, "height": 190}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.009}, "observations": ["near-neutral colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "gantry-shell", "regionId": "shell", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "matte", "aliases": [], "confidence": 0.831, "source": "vision"}, "alternatives": []}, "ambientOcclusion": {"map": "material-evidence/shell_ao.png", "strength": 0.5}, "surfaceFrequencyBands": [{"id": "macro", "description": "broad panel shading", "frequency": 1.0, "amplitude": 0.02}, {"id": "meso", "description": "seams and inset steps", "frequency": 8.0, "amplitude": 0.006}, {"id": "micro", "description": "fine plastic grain", "frequency": 64.0, "amplitude": 0.001}], "albedo": {"base": "#EDEAE4", "secondary": "#E2DED6"}, "localOverrides": [{"id": "seam-ao", "kind": "seam", "region": "shell circumference seam", "roughnessDelta": 0.05, "aoDelta": 0.15}], "albedoPolicy": "solid base colour: flat-paint plastic; reference albedo carried room lighting"},
    options
  );
  materialMap["cover"] = createSculptMaterial(
    "cover",
    {"id": "cover", "name": "Front cover plastic", "baseColor": "#F2E6CF", "roughness": {"base": 0.68, "variation": 0.06, "map": "material-evidence/cover_roughness.png"}, "metalness": {"base": 0.0, "variation": 0.0}, "finish": "satin", "evidenceRefs": ["gantry-front"], "finishClass": "painted-metal", "texturePalette": ["#F2E6CF", "#E9DCC2"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 1.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.05, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5, "variation": 0.0}, "envMapIntensity": 1.0, "referenceMaterialId": "plastic.matte", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "matte", "materialReference": {"registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.matte", "method": "family-subtype-finish", "confidence": 0.751, "sourceRefs": ["three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "aoMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing"]}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1, 1], "anisotropy": 8, "colorSpace": "SRGBColorSpace for albedo; NoColorSpace for scalar/normal maps", "mapBindings": ["roughnessMap"]}, "referencePbr": {"version": "1.0", "sourceImage": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/01-cover.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.751, "estimatedFidelity": 0.751, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"roughness": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-01-cover/cover_roughness.png", "url": "cover_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-01-cover/cover_height.png", "url": "cover_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-01-cover/cover_normal.png", "url": "cover_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-01-cover/cover_ao.png", "url": "cover_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "albedo": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-01-cover/cover_albedo.png", "url": "cover_albedo.png", "channel": "albedo", "source": "solid base colour (flat-paint rule; reference pixels carried room lighting)"}}, "diagnostics": {"sourceWidth": 180, "sourceHeight": 170, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 180, "height": 170}, "mask": {"backgroundColor": "#B49D8C", "backgroundNoise": 12.884, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9442}, "mapStats": {"valueRange": 0.0805, "heightP90Gradient": 0.05611, "roughnessBase": 0.734, "roughnessVariation": 0.093, "normalStrength": 0.222, "blurRadius": 10}, "palette": ["#B59E8E", "#B39C8B", "#B7A090", "#B09887", "#938F92"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#988F8D", "#A7968D", "#B09A8B", "#B59E8E", "#B6A08F"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 158.7, "meanSaturation": 0.185, "gradientStrength": 0.075, "mottle": 0.007, "streakRatio": 1.11, "hueSpread": 0.001, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "front-cover-panel", "regionId": "cover", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/01-cover.png", "bbox": {"x": 880, "y": 470, "width": 180, "height": 170}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0091}, "observations": ["chromatic base-colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "front-cover-panel", "regionId": "cover", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "matte", "aliases": [], "confidence": 0.751, "source": "vision"}, "alternatives": []}, "ambientOcclusion": {"map": "material-evidence/cover_ao.png", "strength": 0.5}, "surfaceFrequencyBands": [{"id": "macro", "description": "broad panel shading", "frequency": 1.0, "amplitude": 0.02}, {"id": "meso", "description": "seams and inset steps", "frequency": 8.0, "amplitude": 0.006}, {"id": "micro", "description": "fine plastic grain", "frequency": 64.0, "amplitude": 0.001}], "albedo": {"base": "#F2E6CF", "secondary": "#E9DCC2"}, "albedoPolicy": "solid base colour: flat-paint plastic; reference albedo carried room lighting"},
    options
  );
  materialMap["pad"] = createSculptMaterial(
    "pad",
    {"id": "pad", "name": "Vinyl pad", "baseColor": "#EFE3B8", "roughness": {"base": 0.68, "variation": 0.06, "map": "material-evidence/pad_roughness.png"}, "metalness": {"base": 0.0, "variation": 0.0}, "finish": "satin", "evidenceRefs": ["couch"], "finishClass": "painted-metal", "texturePalette": ["#EFE3B8", "#E6D6A2"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 1.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.05, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5, "variation": 0.0}, "envMapIntensity": 1.0, "referenceMaterialId": "plastic.matte", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "matte", "materialReference": {"registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "profileId": "plastic.matte", "method": "family-subtype-finish", "confidence": 0.76, "sourceRefs": ["three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "aoMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing"]}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1, 1], "anisotropy": 8, "colorSpace": "SRGBColorSpace for albedo; NoColorSpace for scalar/normal maps", "mapBindings": ["roughnessMap"]}, "referencePbr": {"version": "1.0", "sourceImage": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/02-pad.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.76, "estimatedFidelity": 0.76, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"roughness": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-02-pad/pad_roughness.png", "url": "pad_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-02-pad/pad_height.png", "url": "pad_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-02-pad/pad_normal.png", "url": "pad_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-02-pad/pad_ao.png", "url": "pad_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "albedo": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-02-pad/pad_albedo.png", "url": "pad_albedo.png", "channel": "albedo", "source": "solid base colour (flat-paint rule; reference pixels carried room lighting)"}}, "diagnostics": {"sourceWidth": 310, "sourceHeight": 90, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 310, "height": 90}, "mask": {"backgroundColor": "#B9A592", "backgroundNoise": 19.131, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9274}, "mapStats": {"valueRange": 0.2023, "heightP90Gradient": 0.0351, "roughnessBase": 0.705, "roughnessVariation": 0.054, "normalStrength": 0.197, "blurRadius": 10}, "palette": ["#B09880", "#A9937D", "#B5A189", "#C2AE97", "#D2C8B4"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#B59D83", "#B0987F", "#AC9680", "#B6A691", "#CDBBA5"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 165.4, "meanSaturation": 0.238, "gradientStrength": 0.149, "mottle": 0.008, "streakRatio": 1.16, "hueSpread": 0.001, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "couch-pad", "regionId": "pad", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/02-pad.png", "bbox": {"x": 330, "y": 1390, "width": 310, "height": 90}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0083}, "observations": ["chromatic base-colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "couch-pad", "regionId": "pad", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "matte", "aliases": [], "confidence": 0.76, "source": "vision"}, "alternatives": []}, "ambientOcclusion": {"map": "material-evidence/pad_ao.png", "strength": 0.5}, "surfaceFrequencyBands": [{"id": "macro", "description": "broad panel shading", "frequency": 1.0, "amplitude": 0.02}, {"id": "meso", "description": "seams and inset steps", "frequency": 8.0, "amplitude": 0.006}, {"id": "micro", "description": "fine plastic grain", "frequency": 64.0, "amplitude": 0.001}], "albedo": {"base": "#EFE3B8", "secondary": "#E6D6A2"}, "albedoPolicy": "solid base colour: flat-paint plastic; reference albedo carried room lighting"},
    options
  );
  materialMap["trim"] = createSculptMaterial(
    "trim",
    {"id": "trim", "name": "Satin trim", "baseColor": "#B9BCC0", "roughness": {"base": 0.3, "variation": 0.06, "map": "material-evidence/trim_roughness.png"}, "metalness": {"base": 1.0, "variation": 0.0}, "finish": "satin", "evidenceRefs": ["base"], "finishClass": "plastic", "texturePalette": ["#B9BCC0", "#A9ACB1"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.3, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 0.7, "referenceMaterialId": "metal.aluminum", "materialFamily": "metal", "materialSubtype": "aluminum", "materialFinish": "satin", "materialReference": {"registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "profileId": "metal.aluminum", "method": "family-subtype-finish", "confidence": 0.736, "sourceRefs": ["three.mesh-standard", "three.pmrem", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "anisotropyMap"], "validationViews": ["neutral-studio", "environment-reflection", "grazing"]}, "anisotropy": {"base": 0.2, "variation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1, 1], "anisotropy": 8, "colorSpace": "SRGBColorSpace for albedo; NoColorSpace for scalar/normal maps", "mapBindings": ["roughnessMap"]}, "referencePbr": {"version": "1.0", "sourceImage": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/03-trim.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.736, "estimatedFidelity": 0.736, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"roughness": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-03-trim/trim_roughness.png", "url": "trim_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-03-trim/trim_height.png", "url": "trim_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-03-trim/trim_normal.png", "url": "trim_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-03-trim/trim_ao.png", "url": "trim_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "albedo": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-03-trim/trim_albedo.png", "url": "trim_albedo.png", "channel": "albedo", "source": "solid base colour (flat-paint rule; reference pixels carried room lighting)"}}, "diagnostics": {"sourceWidth": 300, "sourceHeight": 37, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 300, "height": 37}, "mask": {"backgroundColor": "#98999B", "backgroundNoise": 60.15, "transparentPixelFraction": 0.0, "foregroundCoverage": 1.0}, "mapStats": {"valueRange": 0.2452, "heightP90Gradient": 0.03081, "roughnessBase": 0.705, "roughnessVariation": 0.056, "normalStrength": 0.192, "blurRadius": 10}, "palette": ["#A79C9F", "#B4AAAA", "#C1B3AC", "#777783", "#968E92"]}, "warnings": ["foreground mask is tiny; material extraction is likely unreliable", "image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "plastic", "recipe": {"metalness": 0.05, "roughness": 0.6, "clearcoat": 0.2, "clearcoatRoughness": 0.3, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.7, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#7A7E8B", "#B19F9C", "#B3A6A5", "#ABA3A5", "#877E80"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 160.4, "meanSaturation": 0.084, "gradientStrength": 0.174, "mottle": 0.01, "streakRatio": 1.69, "hueSpread": 0.0, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "gantry-plinth", "regionId": "trim", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/03-trim.png", "bbox": {"x": 1300, "y": 1335, "width": 300, "height": 37}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0033}, "observations": ["near-neutral colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "gantry-plinth", "regionId": "trim", "materialId": null, "family": "metal", "subtype": "aluminum", "finish": "satin", "aliases": [], "confidence": 0.736, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "ambientOcclusion": {"map": "material-evidence/trim_ao.png", "strength": 0.5}, "surfaceFrequencyBands": [{"id": "macro", "description": "broad panel shading", "frequency": 1.0, "amplitude": 0.02}, {"id": "meso", "description": "seams and inset steps", "frequency": 8.0, "amplitude": 0.006}, {"id": "micro", "description": "fine plastic grain", "frequency": 64.0, "amplitude": 0.001}], "albedo": {"base": "#B9BCC0", "secondary": "#A9ACB1"}, "albedoPolicy": "solid base colour: flat-paint plastic; reference albedo carried room lighting"},
    options
  );
  materialMap["display"] = createSculptMaterial(
    "display",
    {"id": "display", "name": "Display glass", "baseColor": "#2A2E33", "roughness": {"base": 0.05, "variation": 0.06, "map": "material-evidence/display_roughness.png"}, "metalness": {"base": 0.0, "variation": 0.0}, "finish": "gloss", "evidenceRefs": ["gantry-front"], "finishClass": "worn-composite", "texturePalette": ["#2A2E33", "#1E2226"], "proceduralTexture": "mottle", "clearcoat": {"base": 0.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.0, "variation": 0.0}, "transmission": {"base": 1.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5, "variation": 0.0}, "envMapIntensity": 0.5, "referenceMaterialId": "glass.clear", "materialFamily": "glass", "materialSubtype": "clear", "materialFinish": "polished", "materialReference": {"registry": "/home/aman/.img2threejs/releases/a669e9a97cea4452b1c2310c5cca6aa0f6657c1f/img2threejs/docs/materials/material-reference.json", "profileId": "glass.clear", "method": "family-subtype-finish", "confidence": 0.801, "sourceRefs": ["three.mesh-physical", "three.pmrem", "gltf.2", "khronos.transmission", "khronos.volume", "google.filament-pbr"], "requiredMaps": ["roughnessMap", "thicknessMap"], "optionalMaps": ["map", "normalMap", "transmissionMap"], "validationViews": ["neutral-studio", "environment-reflection", "backlight-transmission", "reference-beauty"]}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1, 1], "anisotropy": 8, "colorSpace": "SRGBColorSpace for albedo; NoColorSpace for scalar/normal maps", "mapBindings": ["roughnessMap", "thicknessMap"]}, "referencePbr": {"version": "1.0", "sourceImage": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/04-display.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.801, "estimatedFidelity": 0.801, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"roughness": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-04-display/display_roughness.png", "url": "display_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-04-display/display_height.png", "url": "display_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-04-display/display_normal.png", "url": "display_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-04-display/display_ao.png", "url": "display_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "albedo": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/pbr-04-display/display_albedo.png", "url": "display_albedo.png", "channel": "albedo", "source": "solid base colour (flat-paint rule; reference pixels carried room lighting)"}}, "diagnostics": {"sourceWidth": 74, "sourceHeight": 50, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 17, "height": 50}, "mask": {"backgroundColor": "#89878F", "backgroundNoise": 173.796, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.0797}, "mapStats": {"valueRange": 0.2997, "heightP90Gradient": 0.03305, "roughnessBase": 0.68, "roughnessVariation": 0.05, "normalStrength": 0.195, "blurRadius": 10}, "palette": ["#2B2321", "#291F1B", "#261B18", "#71625D", "#4C3C39"]}, "warnings": ["foreground mask is very small", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#252426", "#28221F", "#51423F", "#7F7173", "#84787E"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 76.2, "meanSaturation": 0.175, "gradientStrength": 0.363, "mottle": 0.008, "streakRatio": 1.04, "hueSpread": 0.015, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "display-panel", "regionId": "display", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/04-display.png", "bbox": {"x": 1162, "y": 428, "width": 74, "height": 50}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0011}, "observations": ["near-neutral colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "display-panel", "regionId": "display", "materialId": null, "family": "glass", "subtype": "clear", "finish": "polished", "aliases": [], "confidence": 0.801, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "ambientOcclusion": {"map": "material-evidence/display_ao.png", "strength": 0.5}, "surfaceFrequencyBands": [{"id": "macro", "description": "broad panel shading", "frequency": 1.0, "amplitude": 0.02}, {"id": "meso", "description": "seams and inset steps", "frequency": 8.0, "amplitude": 0.006}, {"id": "micro", "description": "fine plastic grain", "frequency": 64.0, "amplitude": 0.001}], "albedo": {"base": "#2A2E33", "secondary": "#1E2226"}, "albedoPolicy": "solid base colour: flat-paint plastic; reference albedo carried room lighting"},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_gantry_shell_0 = makeAttachmentEndpoint(null);
  const node_gantry_shell_0 = new THREE.Group();
  node_gantry_shell_0.name = "Gantry shell__pivot";
  node_gantry_shell_0.scale.set(1, 1, 1);
  if (endpoint_gantry_shell_0) {
    node_gantry_shell_0.position.copy(endpoint_gantry_shell_0.start);
    node_gantry_shell_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_gantry_shell_0.position.set(0.0, 1.1, -0.8);
    node_gantry_shell_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_gantry_shell_0.userData.sculptComponent = {"id": "gantry-shell", "name": "Gantry shell", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Rounded-square (superellipse) ring extruded along the bore axis with a circular bore hole", "geometryDescriptor": {"topologyIntent": "Rounded-square (superellipse) ring extruded along the bore axis with a circular bore hole", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[1.0, 0.0], [0.9961, 0.2545], [0.9843, 0.3909], [0.9645, 0.5004], [0.9369, 0.5934], [0.9012, 0.6741], [0.8574, 0.7443], [0.8052, 0.8052], [0.7443, 0.8574], [0.6741, 0.9012], [0.5934, 0.9369], [0.5004, 0.9645], [0.3909, 0.9843], [0.2545, 0.9961], [0.0, 1.0], [-0.2545, 0.9961], [-0.3909, 0.9843], [-0.5004, 0.9645], [-0.5934, 0.9369], [-0.6741, 0.9012], [-0.7443, 0.8574], [-0.8052, 0.8052], [-0.8574, 0.7443], [-0.9012, 0.6741], [-0.9369, 0.5934], [-0.9645, 0.5004], [-0.9843, 0.3909], [-0.9961, 0.2545], [-1.0, 0.0], [-0.9961, -0.2545], [-0.9843, -0.3909], [-0.9645, -0.5004], [-0.9369, -0.5934], [-0.9012, -0.6741], [-0.8574, -0.7443], [-0.8052, -0.8052], [-0.7443, -0.8574], [-0.6741, -0.9012], [-0.5934, -0.9369], [-0.5004, -0.9645], [-0.3909, -0.9843], [-0.2545, -0.9961], [-0.0, -1.0], [0.2545, -0.9961], [0.3909, -0.9843], [0.5004, -0.9645], [0.5934, -0.9369], [0.6741, -0.9012], [0.7443, -0.8574], [0.8052, -0.8052], [0.8574, -0.7443], [0.9012, -0.6741], [0.9369, -0.5934], [0.9645, -0.5004], [0.9843, -0.3909], [0.9961, -0.2545]], "depth": 1.6, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 1.1, -0.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-shell-seam", "detailRef": "d-shell-seam", "kind": "seam-groove", "description": "shallow circumferential seam groove"}, {"id": "lf-side-vent", "detailRef": "d-side-vent", "kind": "vent-slots", "description": "vertical vent slots on the lateral side"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "shell"}, "materialRegions": [{"regionId": "shell", "materialId": "shell", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/00-shell.png", "bbox": {"x": 1560, "y": 330, "width": 160, "height": 190}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.009}}]};
  node_gantry_shell_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_gantry_shell_0);
  nodes["gantry-shell"] = node_gantry_shell_0;
  const mesh_gantry_shell_0Geometry = endpoint_gantry_shell_0
    ? new THREE.CylinderGeometry(endpoint_gantry_shell_0.endRadius, endpoint_gantry_shell_0.baseRadius, endpoint_gantry_shell_0.length, 32, 12)
    : buildExtrudeGeometry({"points": [[1.0, 0.0], [0.9961, 0.2545], [0.9843, 0.3909], [0.9645, 0.5004], [0.9369, 0.5934], [0.9012, 0.6741], [0.8574, 0.7443], [0.8052, 0.8052], [0.7443, 0.8574], [0.6741, 0.9012], [0.5934, 0.9369], [0.5004, 0.9645], [0.3909, 0.9843], [0.2545, 0.9961], [0.0, 1.0], [-0.2545, 0.9961], [-0.3909, 0.9843], [-0.5004, 0.9645], [-0.5934, 0.9369], [-0.6741, 0.9012], [-0.7443, 0.8574], [-0.8052, 0.8052], [-0.8574, 0.7443], [-0.9012, 0.6741], [-0.9369, 0.5934], [-0.9645, 0.5004], [-0.9843, 0.3909], [-0.9961, 0.2545], [-1.0, 0.0], [-0.9961, -0.2545], [-0.9843, -0.3909], [-0.9645, -0.5004], [-0.9369, -0.5934], [-0.9012, -0.6741], [-0.8574, -0.7443], [-0.8052, -0.8052], [-0.7443, -0.8574], [-0.6741, -0.9012], [-0.5934, -0.9369], [-0.5004, -0.9645], [-0.3909, -0.9843], [-0.2545, -0.9961], [-0.0, -1.0], [0.2545, -0.9961], [0.3909, -0.9843], [0.5004, -0.9645], [0.5934, -0.9369], [0.6741, -0.9012], [0.7443, -0.8574], [0.8052, -0.8052], [0.8574, -0.7443], [0.9012, -0.6741], [0.9369, -0.5934], [0.9645, -0.5004], [0.9843, -0.3909], [0.9961, -0.2545]], "depth": 1.6, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]});
  if (!endpoint_gantry_shell_0) {
    mesh_gantry_shell_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_gantry_shell_0 = new THREE.Mesh(
    mesh_gantry_shell_0Geometry,
    materialMap["shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_gantry_shell_0.name = "Gantry shell";
  if (endpoint_gantry_shell_0) {
    mesh_gantry_shell_0.position.copy(endpoint_gantry_shell_0.midpoint);
    mesh_gantry_shell_0.quaternion.copy(endpoint_gantry_shell_0.quaternion);
  }
  mesh_gantry_shell_0.castShadow = options.castShadow ?? true;
  mesh_gantry_shell_0.receiveShadow = options.receiveShadow ?? true;
  mesh_gantry_shell_0.userData.sculptComponent = {"id": "gantry-shell", "name": "Gantry shell", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Rounded-square (superellipse) ring extruded along the bore axis with a circular bore hole", "geometryDescriptor": {"topologyIntent": "Rounded-square (superellipse) ring extruded along the bore axis with a circular bore hole", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[1.0, 0.0], [0.9961, 0.2545], [0.9843, 0.3909], [0.9645, 0.5004], [0.9369, 0.5934], [0.9012, 0.6741], [0.8574, 0.7443], [0.8052, 0.8052], [0.7443, 0.8574], [0.6741, 0.9012], [0.5934, 0.9369], [0.5004, 0.9645], [0.3909, 0.9843], [0.2545, 0.9961], [0.0, 1.0], [-0.2545, 0.9961], [-0.3909, 0.9843], [-0.5004, 0.9645], [-0.5934, 0.9369], [-0.6741, 0.9012], [-0.7443, 0.8574], [-0.8052, 0.8052], [-0.8574, 0.7443], [-0.9012, 0.6741], [-0.9369, 0.5934], [-0.9645, 0.5004], [-0.9843, 0.3909], [-0.9961, 0.2545], [-1.0, 0.0], [-0.9961, -0.2545], [-0.9843, -0.3909], [-0.9645, -0.5004], [-0.9369, -0.5934], [-0.9012, -0.6741], [-0.8574, -0.7443], [-0.8052, -0.8052], [-0.7443, -0.8574], [-0.6741, -0.9012], [-0.5934, -0.9369], [-0.5004, -0.9645], [-0.3909, -0.9843], [-0.2545, -0.9961], [-0.0, -1.0], [0.2545, -0.9961], [0.3909, -0.9843], [0.5004, -0.9645], [0.5934, -0.9369], [0.6741, -0.9012], [0.7443, -0.8574], [0.8052, -0.8052], [0.8574, -0.7443], [0.9012, -0.6741], [0.9369, -0.5934], [0.9645, -0.5004], [0.9843, -0.3909], [0.9961, -0.2545]], "depth": 1.6, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 1.1, -0.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-shell-seam", "detailRef": "d-shell-seam", "kind": "seam-groove", "description": "shallow circumferential seam groove"}, {"id": "lf-side-vent", "detailRef": "d-side-vent", "kind": "vent-slots", "description": "vertical vent slots on the lateral side"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "shell"}, "materialRegions": [{"regionId": "shell", "materialId": "shell", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/00-shell.png", "bbox": {"x": 1560, "y": 330, "width": 160, "height": 190}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.009}}]};
  node_gantry_shell_0.add(mesh_gantry_shell_0);
  meshes["gantry-shell"] = mesh_gantry_shell_0;
  colliders["gantry-shell"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_gantry_shell_0);

  const endpoint_front_cover_panel_1 = makeAttachmentEndpoint(null);
  const node_front_cover_panel_1 = new THREE.Group();
  node_front_cover_panel_1.name = "Front cover panel__pivot";
  node_front_cover_panel_1.scale.set(1, 1, 1);
  if (endpoint_front_cover_panel_1) {
    node_front_cover_panel_1.position.copy(endpoint_front_cover_panel_1.start);
    node_front_cover_panel_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_front_cover_panel_1.position.set(0.0, 0.0, 1.6);
    node_front_cover_panel_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_front_cover_panel_1.userData.sculptComponent = {"id": "front-cover-panel", "name": "Front cover panel", "level": "meso", "role": "cover", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Thin superellipse annulus inset on the front face, lighter cream", "geometryDescriptor": {"topologyIntent": "Thin superellipse annulus inset on the front face, lighter cream", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.88, 0.0], [0.8765, 0.224], [0.8661, 0.344], [0.8488, 0.4403], [0.8245, 0.5222], [0.7931, 0.5932], [0.7545, 0.655], [0.7086, 0.7086], [0.655, 0.7545], [0.5932, 0.7931], [0.5222, 0.8245], [0.4403, 0.8488], [0.344, 0.8661], [0.224, 0.8765], [0.0, 0.88], [-0.224, 0.8765], [-0.344, 0.8661], [-0.4403, 0.8488], [-0.5222, 0.8245], [-0.5932, 0.7931], [-0.655, 0.7545], [-0.7086, 0.7086], [-0.7545, 0.655], [-0.7931, 0.5932], [-0.8245, 0.5222], [-0.8488, 0.4403], [-0.8661, 0.344], [-0.8765, 0.224], [-0.88, 0.0], [-0.8765, -0.224], [-0.8661, -0.344], [-0.8488, -0.4403], [-0.8245, -0.5222], [-0.7931, -0.5932], [-0.7545, -0.655], [-0.7086, -0.7086], [-0.655, -0.7545], [-0.5932, -0.7931], [-0.5222, -0.8245], [-0.4403, -0.8488], [-0.344, -0.8661], [-0.224, -0.8765], [-0.0, -0.88], [0.224, -0.8765], [0.344, -0.8661], [0.4403, -0.8488], [0.5222, -0.8245], [0.5932, -0.7931], [0.655, -0.7545], [0.7086, -0.7086], [0.7545, -0.655], [0.7931, -0.5932], [0.8245, -0.5222], [0.8488, -0.4403], [0.8661, -0.344], [0.8765, -0.224]], "depth": 0.03, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]}}, "parent": "gantry-shell", "attachment": {"parentId": "gantry-shell", "parentSocket": "gantry-shell-surface", "localStart": [0, 0, 0], "localEnd": [0, 0, 1.6], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0, 1.6], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cover", "materialLayers": ["cover"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-cover-inset", "detailRef": "d-front-cover-inset", "kind": "inset-panel", "description": "lighter annular inset inside the shell rim"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 230, 207, 1.0)", "secondaryAlbedo": "rgba(242, 230, 207, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "cover"}, "materialRegions": [{"regionId": "cover", "materialId": "cover", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/01-cover.png", "bbox": {"x": 880, "y": 470, "width": 180, "height": 170}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0091}}]};
  node_front_cover_panel_1.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["gantry-shell"] ?? root).add(node_front_cover_panel_1);
  nodes["front-cover-panel"] = node_front_cover_panel_1;
  const mesh_front_cover_panel_1Geometry = endpoint_front_cover_panel_1
    ? new THREE.CylinderGeometry(endpoint_front_cover_panel_1.endRadius, endpoint_front_cover_panel_1.baseRadius, endpoint_front_cover_panel_1.length, 32, 12)
    : buildExtrudeGeometry({"points": [[0.88, 0.0], [0.8765, 0.224], [0.8661, 0.344], [0.8488, 0.4403], [0.8245, 0.5222], [0.7931, 0.5932], [0.7545, 0.655], [0.7086, 0.7086], [0.655, 0.7545], [0.5932, 0.7931], [0.5222, 0.8245], [0.4403, 0.8488], [0.344, 0.8661], [0.224, 0.8765], [0.0, 0.88], [-0.224, 0.8765], [-0.344, 0.8661], [-0.4403, 0.8488], [-0.5222, 0.8245], [-0.5932, 0.7931], [-0.655, 0.7545], [-0.7086, 0.7086], [-0.7545, 0.655], [-0.7931, 0.5932], [-0.8245, 0.5222], [-0.8488, 0.4403], [-0.8661, 0.344], [-0.8765, 0.224], [-0.88, 0.0], [-0.8765, -0.224], [-0.8661, -0.344], [-0.8488, -0.4403], [-0.8245, -0.5222], [-0.7931, -0.5932], [-0.7545, -0.655], [-0.7086, -0.7086], [-0.655, -0.7545], [-0.5932, -0.7931], [-0.5222, -0.8245], [-0.4403, -0.8488], [-0.344, -0.8661], [-0.224, -0.8765], [-0.0, -0.88], [0.224, -0.8765], [0.344, -0.8661], [0.4403, -0.8488], [0.5222, -0.8245], [0.5932, -0.7931], [0.655, -0.7545], [0.7086, -0.7086], [0.7545, -0.655], [0.7931, -0.5932], [0.8245, -0.5222], [0.8488, -0.4403], [0.8661, -0.344], [0.8765, -0.224]], "depth": 0.03, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]});
  if (!endpoint_front_cover_panel_1) {
    mesh_front_cover_panel_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_front_cover_panel_1 = new THREE.Mesh(
    mesh_front_cover_panel_1Geometry,
    materialMap["cover"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_cover_panel_1.name = "Front cover panel";
  if (endpoint_front_cover_panel_1) {
    mesh_front_cover_panel_1.position.copy(endpoint_front_cover_panel_1.midpoint);
    mesh_front_cover_panel_1.quaternion.copy(endpoint_front_cover_panel_1.quaternion);
  }
  mesh_front_cover_panel_1.castShadow = options.castShadow ?? true;
  mesh_front_cover_panel_1.receiveShadow = options.receiveShadow ?? true;
  mesh_front_cover_panel_1.userData.sculptComponent = {"id": "front-cover-panel", "name": "Front cover panel", "level": "meso", "role": "cover", "importance": 0.8, "confidence": 0.75, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Thin superellipse annulus inset on the front face, lighter cream", "geometryDescriptor": {"topologyIntent": "Thin superellipse annulus inset on the front face, lighter cream", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.88, 0.0], [0.8765, 0.224], [0.8661, 0.344], [0.8488, 0.4403], [0.8245, 0.5222], [0.7931, 0.5932], [0.7545, 0.655], [0.7086, 0.7086], [0.655, 0.7545], [0.5932, 0.7931], [0.5222, 0.8245], [0.4403, 0.8488], [0.344, 0.8661], [0.224, 0.8765], [0.0, 0.88], [-0.224, 0.8765], [-0.344, 0.8661], [-0.4403, 0.8488], [-0.5222, 0.8245], [-0.5932, 0.7931], [-0.655, 0.7545], [-0.7086, 0.7086], [-0.7545, 0.655], [-0.7931, 0.5932], [-0.8245, 0.5222], [-0.8488, 0.4403], [-0.8661, 0.344], [-0.8765, 0.224], [-0.88, 0.0], [-0.8765, -0.224], [-0.8661, -0.344], [-0.8488, -0.4403], [-0.8245, -0.5222], [-0.7931, -0.5932], [-0.7545, -0.655], [-0.7086, -0.7086], [-0.655, -0.7545], [-0.5932, -0.7931], [-0.5222, -0.8245], [-0.4403, -0.8488], [-0.344, -0.8661], [-0.224, -0.8765], [-0.0, -0.88], [0.224, -0.8765], [0.344, -0.8661], [0.4403, -0.8488], [0.5222, -0.8245], [0.5932, -0.7931], [0.655, -0.7545], [0.7086, -0.7086], [0.7545, -0.655], [0.7931, -0.5932], [0.8245, -0.5222], [0.8488, -0.4403], [0.8661, -0.344], [0.8765, -0.224]], "depth": 0.03, "ovalHoles": [{"cx": 0.0, "cy": 0.06, "rx": 0.6, "ry": 0.6}]}}, "parent": "gantry-shell", "attachment": {"parentId": "gantry-shell", "parentSocket": "gantry-shell-surface", "localStart": [0, 0, 0], "localEnd": [0, 0, 1.6], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0, 1.6], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cover", "materialLayers": ["cover"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-cover-inset", "detailRef": "d-front-cover-inset", "kind": "inset-panel", "description": "lighter annular inset inside the shell rim"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 230, 207, 1.0)", "secondaryAlbedo": "rgba(242, 230, 207, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "cover"}, "materialRegions": [{"regionId": "cover", "materialId": "cover", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/01-cover.png", "bbox": {"x": 880, "y": 470, "width": 180, "height": 170}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0091}}]};
  node_front_cover_panel_1.add(mesh_front_cover_panel_1);
  meshes["front-cover-panel"] = mesh_front_cover_panel_1;
  colliders["front-cover-panel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_front_cover_panel_1);

  const endpoint_bore_liner_2 = makeAttachmentEndpoint(null);
  const node_bore_liner_2 = new THREE.Group();
  node_bore_liner_2.name = "Bore liner__pivot";
  node_bore_liner_2.scale.set(1, 1, 1);
  if (endpoint_bore_liner_2) {
    node_bore_liner_2.position.copy(endpoint_bore_liner_2.start);
    node_bore_liner_2.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_bore_liner_2.position.set(0.0, 0.06, 0.8);
    node_bore_liner_2.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_bore_liner_2.userData.sculptComponent = {"id": "bore-liner", "name": "Bore liner", "level": "meso", "role": "bore", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Revolved open tube lining the bore with a flared front lip", "geometryDescriptor": {"topologyIntent": "Revolved open tube lining the bore with a flared front lip", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.6, -0.86], [0.6, 0.8], [0.62, 0.84], [0.66, 0.86]], "segments": 64}}, "parent": "gantry-shell", "attachment": {"parentId": "gantry-shell", "parentSocket": "gantry-shell-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.06, 0.8], "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.06, 0.8], "rotation": [1.5707963267948966, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cover", "materialLayers": ["cover"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-bore-lip", "detailRef": "d-bore-lip", "kind": "flared-lip", "description": "rounded lip at the bore mouth"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 230, 207, 1.0)", "secondaryAlbedo": "rgba(242, 230, 207, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_bore_liner_2.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["gantry-shell"] ?? root).add(node_bore_liner_2);
  nodes["bore-liner"] = node_bore_liner_2;
  const mesh_bore_liner_2Geometry = endpoint_bore_liner_2
    ? new THREE.CylinderGeometry(endpoint_bore_liner_2.endRadius, endpoint_bore_liner_2.baseRadius, endpoint_bore_liner_2.length, 32, 12)
    : buildLatheGeometry({"points": [[0.6, -0.86], [0.6, 0.8], [0.62, 0.84], [0.66, 0.86]], "segments": 64});
  if (!endpoint_bore_liner_2) {
    mesh_bore_liner_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bore_liner_2 = new THREE.Mesh(
    mesh_bore_liner_2Geometry,
    materialMap["cover"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bore_liner_2.name = "Bore liner";
  if (endpoint_bore_liner_2) {
    mesh_bore_liner_2.position.copy(endpoint_bore_liner_2.midpoint);
    mesh_bore_liner_2.quaternion.copy(endpoint_bore_liner_2.quaternion);
  }
  mesh_bore_liner_2.castShadow = options.castShadow ?? true;
  mesh_bore_liner_2.receiveShadow = options.receiveShadow ?? true;
  mesh_bore_liner_2.userData.sculptComponent = {"id": "bore-liner", "name": "Bore liner", "level": "meso", "role": "bore", "importance": 0.8, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Revolved open tube lining the bore with a flared front lip", "geometryDescriptor": {"topologyIntent": "Revolved open tube lining the bore with a flared front lip", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.6, -0.86], [0.6, 0.8], [0.62, 0.84], [0.66, 0.86]], "segments": 64}}, "parent": "gantry-shell", "attachment": {"parentId": "gantry-shell", "parentSocket": "gantry-shell-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.06, 0.8], "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.06, 0.8], "rotation": [1.5707963267948966, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cover", "materialLayers": ["cover"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-bore-lip", "detailRef": "d-bore-lip", "kind": "flared-lip", "description": "rounded lip at the bore mouth"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(242, 230, 207, 1.0)", "secondaryAlbedo": "rgba(242, 230, 207, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_bore_liner_2.add(mesh_bore_liner_2);
  meshes["bore-liner"] = mesh_bore_liner_2;
  colliders["bore-liner"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_bore_liner_2);

  const endpoint_display_panel_3 = makeAttachmentEndpoint(null);
  const node_display_panel_3 = new THREE.Group();
  node_display_panel_3.name = "Status display__pivot";
  node_display_panel_3.scale.set(1, 1, 1);
  if (endpoint_display_panel_3) {
    node_display_panel_3.position.copy(endpoint_display_panel_3.start);
    node_display_panel_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_display_panel_3.position.set(0.0, 0.78, 0.04);
    node_display_panel_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_display_panel_3.userData.sculptComponent = {"id": "display-panel", "name": "Status display", "level": "micro", "role": "display", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small dark rectangular display above the bore", "geometryDescriptor": {"topologyIntent": "Small dark rectangular display above the bore", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "front-cover-panel", "attachment": {"parentId": "front-cover-panel", "parentSocket": "front-cover-panel-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.78, 0.04], "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 0.16, "height": 0.1, "depth": 0.02, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.78, 0.04], "rotation": [0, 0, 0], "scale": [0.16, 0.1, 0.02]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "display", "materialLayers": ["display"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-display", "detailRef": "d-display", "kind": "screen", "description": "dark glossy status screen"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(42, 46, 51, 1.0)", "secondaryAlbedo": "rgba(42, 46, 51, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "display"}, "materialRegions": [{"regionId": "display", "materialId": "display", "profileId": "glass.clear", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/04-display.png", "bbox": {"x": 1162, "y": 428, "width": 74, "height": 50}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_display_panel_3.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["front-cover-panel"] ?? root).add(node_display_panel_3);
  nodes["display-panel"] = node_display_panel_3;
  const mesh_display_panel_3Geometry = endpoint_display_panel_3
    ? new THREE.CylinderGeometry(endpoint_display_panel_3.endRadius, endpoint_display_panel_3.baseRadius, endpoint_display_panel_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_display_panel_3) {
    mesh_display_panel_3Geometry.scale(0.16, 0.1, 0.02);
  }
  const mesh_display_panel_3 = new THREE.Mesh(
    mesh_display_panel_3Geometry,
    materialMap["display"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_display_panel_3.name = "Status display";
  if (endpoint_display_panel_3) {
    mesh_display_panel_3.position.copy(endpoint_display_panel_3.midpoint);
    mesh_display_panel_3.quaternion.copy(endpoint_display_panel_3.quaternion);
  }
  mesh_display_panel_3.castShadow = options.castShadow ?? true;
  mesh_display_panel_3.receiveShadow = options.receiveShadow ?? true;
  mesh_display_panel_3.userData.sculptComponent = {"id": "display-panel", "name": "Status display", "level": "micro", "role": "display", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Small dark rectangular display above the bore", "geometryDescriptor": {"topologyIntent": "Small dark rectangular display above the bore", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "front-cover-panel", "attachment": {"parentId": "front-cover-panel", "parentSocket": "front-cover-panel-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.78, 0.04], "contactType": "embed", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["gantry-front"]}, "dimensions": {"width": 0.16, "height": 0.1, "depth": 0.02, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.78, 0.04], "rotation": [0, 0, 0], "scale": [0.16, 0.1, 0.02]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "display", "materialLayers": ["display"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-display", "detailRef": "d-display", "kind": "screen", "description": "dark glossy status screen"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["gantry-front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(42, 46, 51, 1.0)", "secondaryAlbedo": "rgba(42, 46, 51, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "display"}, "materialRegions": [{"regionId": "display", "materialId": "display", "profileId": "glass.clear", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/04-display.png", "bbox": {"x": 1162, "y": 428, "width": 74, "height": 50}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_display_panel_3.add(mesh_display_panel_3);
  meshes["display-panel"] = mesh_display_panel_3;
  colliders["display-panel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_display_panel_3);

  const endpoint_gantry_plinth_4 = makeAttachmentEndpoint(null);
  const node_gantry_plinth_4 = new THREE.Group();
  node_gantry_plinth_4.name = "Gantry plinth__pivot";
  node_gantry_plinth_4.scale.set(1, 1, 1);
  if (endpoint_gantry_plinth_4) {
    node_gantry_plinth_4.position.copy(endpoint_gantry_plinth_4.start);
    node_gantry_plinth_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_gantry_plinth_4.position.set(0.0, 0.08, 0.0);
    node_gantry_plinth_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_gantry_plinth_4.userData.sculptComponent = {"id": "gantry-plinth", "name": "Gantry plinth", "level": "macro", "role": "base", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Low recessed base block with grey satin trim under the ring", "geometryDescriptor": {"topologyIntent": "Low recessed base block with grey satin trim under the ring", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.4, "height": 0.16, "depth": 1.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.08, 0], "rotation": [0, 0, 0], "scale": [1.4, 0.16, 1.5]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "trim", "materialLayers": ["trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-plinth-trim", "detailRef": "d-plinth-trim", "kind": "trim-band", "description": "grey satin trim band"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["base"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(185, 188, 192, 1.0)", "secondaryAlbedo": "rgba(185, 188, 192, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "trim"}, "materialRegions": [{"regionId": "trim", "materialId": "trim", "profileId": "metal.aluminum", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/03-trim.png", "bbox": {"x": 1300, "y": 1335, "width": 300, "height": 37}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0033}}]};
  node_gantry_plinth_4.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_gantry_plinth_4);
  nodes["gantry-plinth"] = node_gantry_plinth_4;
  const mesh_gantry_plinth_4Geometry = endpoint_gantry_plinth_4
    ? new THREE.CylinderGeometry(endpoint_gantry_plinth_4.endRadius, endpoint_gantry_plinth_4.baseRadius, endpoint_gantry_plinth_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_gantry_plinth_4) {
    mesh_gantry_plinth_4Geometry.scale(1.4, 0.16, 1.5);
  }
  const mesh_gantry_plinth_4 = new THREE.Mesh(
    mesh_gantry_plinth_4Geometry,
    materialMap["trim"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_gantry_plinth_4.name = "Gantry plinth";
  if (endpoint_gantry_plinth_4) {
    mesh_gantry_plinth_4.position.copy(endpoint_gantry_plinth_4.midpoint);
    mesh_gantry_plinth_4.quaternion.copy(endpoint_gantry_plinth_4.quaternion);
  }
  mesh_gantry_plinth_4.castShadow = options.castShadow ?? true;
  mesh_gantry_plinth_4.receiveShadow = options.receiveShadow ?? true;
  mesh_gantry_plinth_4.userData.sculptComponent = {"id": "gantry-plinth", "name": "Gantry plinth", "level": "macro", "role": "base", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Low recessed base block with grey satin trim under the ring", "geometryDescriptor": {"topologyIntent": "Low recessed base block with grey satin trim under the ring", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.4, "height": 0.16, "depth": 1.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.08, 0], "rotation": [0, 0, 0], "scale": [1.4, 0.16, 1.5]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "trim", "materialLayers": ["trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-plinth-trim", "detailRef": "d-plinth-trim", "kind": "trim-band", "description": "grey satin trim band"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["base"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(185, 188, 192, 1.0)", "secondaryAlbedo": "rgba(185, 188, 192, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "trim"}, "materialRegions": [{"regionId": "trim", "materialId": "trim", "profileId": "metal.aluminum", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/03-trim.png", "bbox": {"x": 1300, "y": 1335, "width": 300, "height": 37}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0033}}]};
  node_gantry_plinth_4.add(mesh_gantry_plinth_4);
  meshes["gantry-plinth"] = mesh_gantry_plinth_4;
  colliders["gantry-plinth"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_gantry_plinth_4);

  const endpoint_couch_pedestal_5 = makeAttachmentEndpoint(null);
  const node_couch_pedestal_5 = new THREE.Group();
  node_couch_pedestal_5.name = "Couch pedestal__pivot";
  node_couch_pedestal_5.scale.set(1, 1, 1);
  if (endpoint_couch_pedestal_5) {
    node_couch_pedestal_5.position.copy(endpoint_couch_pedestal_5.start);
    node_couch_pedestal_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_couch_pedestal_5.position.set(0.0, 0.26, 1.95);
    node_couch_pedestal_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_couch_pedestal_5.userData.sculptComponent = {"id": "couch-pedestal", "name": "Couch pedestal", "level": "macro", "role": "base", "importance": 0.7, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Tapered pedestal block supporting the couch in front of the gantry", "geometryDescriptor": {"topologyIntent": "Tapered pedestal block supporting the couch in front of the gantry", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.42, "height": 0.52, "depth": 1.25, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.26, 1.95], "rotation": [0, 0, 0], "scale": [0.42, 0.52, 1.25]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_couch_pedestal_5.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_couch_pedestal_5);
  nodes["couch-pedestal"] = node_couch_pedestal_5;
  const mesh_couch_pedestal_5Geometry = endpoint_couch_pedestal_5
    ? new THREE.CylinderGeometry(endpoint_couch_pedestal_5.endRadius, endpoint_couch_pedestal_5.baseRadius, endpoint_couch_pedestal_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_couch_pedestal_5) {
    mesh_couch_pedestal_5Geometry.scale(0.42, 0.52, 1.25);
  }
  const mesh_couch_pedestal_5 = new THREE.Mesh(
    mesh_couch_pedestal_5Geometry,
    materialMap["shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_couch_pedestal_5.name = "Couch pedestal";
  if (endpoint_couch_pedestal_5) {
    mesh_couch_pedestal_5.position.copy(endpoint_couch_pedestal_5.midpoint);
    mesh_couch_pedestal_5.quaternion.copy(endpoint_couch_pedestal_5.quaternion);
  }
  mesh_couch_pedestal_5.castShadow = options.castShadow ?? true;
  mesh_couch_pedestal_5.receiveShadow = options.receiveShadow ?? true;
  mesh_couch_pedestal_5.userData.sculptComponent = {"id": "couch-pedestal", "name": "Couch pedestal", "level": "macro", "role": "base", "importance": 0.7, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Tapered pedestal block supporting the couch in front of the gantry", "geometryDescriptor": {"topologyIntent": "Tapered pedestal block supporting the couch in front of the gantry", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.42, "height": 0.52, "depth": 1.25, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.26, 1.95], "rotation": [0, 0, 0], "scale": [0.42, 0.52, 1.25]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_couch_pedestal_5.add(mesh_couch_pedestal_5);
  meshes["couch-pedestal"] = mesh_couch_pedestal_5;
  colliders["couch-pedestal"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_couch_pedestal_5);

  const endpoint_couch_top_6 = makeAttachmentEndpoint(null);
  const node_couch_top_6 = new THREE.Group();
  node_couch_top_6.name = "Couch top__pivot";
  node_couch_top_6.scale.set(1, 1, 1);
  if (endpoint_couch_top_6) {
    node_couch_top_6.position.copy(endpoint_couch_top_6.start);
    node_couch_top_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_couch_top_6.position.set(0.0, 0.31, -0.75);
    node_couch_top_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_couch_top_6.userData.sculptComponent = {"id": "couch-top", "name": "Couch top", "level": "meso", "role": "couch", "importance": 0.9, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Long flat couch board entering the bore", "geometryDescriptor": {"topologyIntent": "Long flat couch board entering the bore", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-pedestal", "attachment": {"parentId": "couch-pedestal", "parentSocket": "couch-pedestal-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.37, -0.55], "contactType": "butt", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.78, "height": 0.1, "depth": 3.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.31, -0.75], "rotation": [0, 0, 0], "scale": [0.78, 0.1, 3.2]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_couch_top_6.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["couch-pedestal"] ?? root).add(node_couch_top_6);
  nodes["couch-top"] = node_couch_top_6;
  const mesh_couch_top_6Geometry = endpoint_couch_top_6
    ? new THREE.CylinderGeometry(endpoint_couch_top_6.endRadius, endpoint_couch_top_6.baseRadius, endpoint_couch_top_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_couch_top_6) {
    mesh_couch_top_6Geometry.scale(0.78, 0.1, 3.2);
  }
  const mesh_couch_top_6 = new THREE.Mesh(
    mesh_couch_top_6Geometry,
    materialMap["shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_couch_top_6.name = "Couch top";
  if (endpoint_couch_top_6) {
    mesh_couch_top_6.position.copy(endpoint_couch_top_6.midpoint);
    mesh_couch_top_6.quaternion.copy(endpoint_couch_top_6.quaternion);
  }
  mesh_couch_top_6.castShadow = options.castShadow ?? true;
  mesh_couch_top_6.receiveShadow = options.receiveShadow ?? true;
  mesh_couch_top_6.userData.sculptComponent = {"id": "couch-top", "name": "Couch top", "level": "meso", "role": "couch", "importance": 0.9, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Long flat couch board entering the bore", "geometryDescriptor": {"topologyIntent": "Long flat couch board entering the bore", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-pedestal", "attachment": {"parentId": "couch-pedestal", "parentSocket": "couch-pedestal-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.37, -0.55], "contactType": "butt", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.78, "height": 0.1, "depth": 3.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.31, -0.75], "rotation": [0, 0, 0], "scale": [0.78, 0.1, 3.2]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "shell", "materialLayers": ["shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 234, 228, 1.0)", "secondaryAlbedo": "rgba(237, 234, 228, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_couch_top_6.add(mesh_couch_top_6);
  meshes["couch-top"] = mesh_couch_top_6;
  colliders["couch-top"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_couch_top_6);

  const endpoint_couch_pad_7 = makeAttachmentEndpoint(null);
  const node_couch_pad_7 = new THREE.Group();
  node_couch_pad_7.name = "Couch pad__pivot";
  node_couch_pad_7.scale.set(1, 1, 1);
  if (endpoint_couch_pad_7) {
    node_couch_pad_7.position.copy(endpoint_couch_pad_7.start);
    node_couch_pad_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_couch_pad_7.position.set(0.0, 0.075, 0.2);
    node_couch_pad_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_couch_pad_7.userData.sculptComponent = {"id": "couch-pad", "name": "Couch pad", "level": "meso", "role": "pad", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pale yellow vinyl pad on the couch top", "geometryDescriptor": {"topologyIntent": "Pale yellow vinyl pad on the couch top", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-top", "attachment": {"parentId": "couch-top", "parentSocket": "couch-top-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.075, 0.2], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.66, "height": 0.05, "depth": 2.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.075, 0.2], "rotation": [0, 0, 0], "scale": [0.66, 0.05, 2.6]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "pad", "materialLayers": ["pad"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-couch-pad", "detailRef": "d-couch-pad", "kind": "pad", "description": "vinyl pad with wedge pillow"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(239, 227, 184, 1.0)", "secondaryAlbedo": "rgba(239, 227, 184, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "pad"}, "materialRegions": [{"regionId": "pad", "materialId": "pad", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/02-pad.png", "bbox": {"x": 330, "y": 1390, "width": 310, "height": 90}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0083}}]};
  node_couch_pad_7.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["couch-top"] ?? root).add(node_couch_pad_7);
  nodes["couch-pad"] = node_couch_pad_7;
  const mesh_couch_pad_7Geometry = endpoint_couch_pad_7
    ? new THREE.CylinderGeometry(endpoint_couch_pad_7.endRadius, endpoint_couch_pad_7.baseRadius, endpoint_couch_pad_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_couch_pad_7) {
    mesh_couch_pad_7Geometry.scale(0.66, 0.05, 2.6);
  }
  const mesh_couch_pad_7 = new THREE.Mesh(
    mesh_couch_pad_7Geometry,
    materialMap["pad"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_couch_pad_7.name = "Couch pad";
  if (endpoint_couch_pad_7) {
    mesh_couch_pad_7.position.copy(endpoint_couch_pad_7.midpoint);
    mesh_couch_pad_7.quaternion.copy(endpoint_couch_pad_7.quaternion);
  }
  mesh_couch_pad_7.castShadow = options.castShadow ?? true;
  mesh_couch_pad_7.receiveShadow = options.receiveShadow ?? true;
  mesh_couch_pad_7.userData.sculptComponent = {"id": "couch-pad", "name": "Couch pad", "level": "meso", "role": "pad", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pale yellow vinyl pad on the couch top", "geometryDescriptor": {"topologyIntent": "Pale yellow vinyl pad on the couch top", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-top", "attachment": {"parentId": "couch-top", "parentSocket": "couch-top-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.075, 0.2], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.66, "height": 0.05, "depth": 2.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.075, 0.2], "rotation": [0, 0, 0], "scale": [0.66, 0.05, 2.6]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "pad", "materialLayers": ["pad"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lf-couch-pad", "detailRef": "d-couch-pad", "kind": "pad", "description": "vinyl pad with wedge pillow"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(239, 227, 184, 1.0)", "secondaryAlbedo": "rgba(239, 227, 184, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "pad"}, "materialRegions": [{"regionId": "pad", "materialId": "pad", "profileId": "plastic.matte", "crop": {"path": "/home/aman/projects/nebius-nvidia/three/mri/material-evidence/02-pad.png", "bbox": {"x": 330, "y": 1390, "width": 310, "height": 90}, "sourceWidth": 1920, "sourceHeight": 1751, "loaderWarnings": [], "coverage": 0.0083}}]};
  node_couch_pad_7.add(mesh_couch_pad_7);
  meshes["couch-pad"] = mesh_couch_pad_7;
  colliders["couch-pad"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_couch_pad_7);

  const attachment_pillow_8 = {"parentId": "couch-pad", "parentSocket": "couch-pad-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.07, -0.75], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]};
  const endpoint_pillow_8 = makeAttachmentEndpoint(attachment_pillow_8);
  const node_pillow_8 = new THREE.Group();
  node_pillow_8.name = "Pillow__pivot";
  node_pillow_8.scale.set(1, 1, 1);
  if (endpoint_pillow_8) {
    node_pillow_8.position.copy(endpoint_pillow_8.start);
    node_pillow_8.rotation.set(0.0, 0.0, 1.5707963267948966);
  } else {
    node_pillow_8.position.set(0.0, 0.07, -0.75);
    node_pillow_8.rotation.set(0.0, 0.0, 1.5707963267948966);
  }
  node_pillow_8.userData.sculptComponent = {"id": "pillow", "name": "Pillow", "level": "micro", "role": "pillow", "importance": 0.4, "confidence": 0.75, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Soft wedge pillow at the head end of the pad", "geometryDescriptor": {"topologyIntent": "Soft wedge pillow at the head end of the pad", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-pad", "attachment": {"parentId": "couch-pad", "parentSocket": "couch-pad-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.07, -0.75], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.55, "height": 0.14, "depth": 0.32, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.07, -0.75], "rotation": [0, 0, 1.5707963267948966], "scale": [0.55, 0.14, 0.32]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "pad", "materialLayers": ["pad"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(239, 227, 184, 1.0)", "secondaryAlbedo": "rgba(239, 227, 184, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_pillow_8.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["couch-pad"] ?? root).add(node_pillow_8);
  nodes["pillow"] = node_pillow_8;
  const mesh_pillow_8Geometry = endpoint_pillow_8
    ? new THREE.CylinderGeometry(endpoint_pillow_8.endRadius, endpoint_pillow_8.baseRadius, endpoint_pillow_8.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_pillow_8) {
    mesh_pillow_8Geometry.scale(0.55, 0.14, 0.32);
  }
  const mesh_pillow_8 = new THREE.Mesh(
    mesh_pillow_8Geometry,
    materialMap["pad"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pillow_8.name = "Pillow";
  if (endpoint_pillow_8) {
    mesh_pillow_8.position.copy(endpoint_pillow_8.midpoint);
    mesh_pillow_8.quaternion.copy(endpoint_pillow_8.quaternion);
  }
  mesh_pillow_8.castShadow = options.castShadow ?? true;
  mesh_pillow_8.receiveShadow = options.receiveShadow ?? true;
  mesh_pillow_8.userData.sculptComponent = {"id": "pillow", "name": "Pillow", "level": "micro", "role": "pillow", "importance": 0.4, "confidence": 0.75, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Soft wedge pillow at the head end of the pad", "geometryDescriptor": {"topologyIntent": "Soft wedge pillow at the head end of the pad", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "couch-pad", "attachment": {"parentId": "couch-pad", "parentSocket": "couch-pad-surface", "localStart": [0, 0, 0], "localEnd": [0, 0.07, -0.75], "contactType": "overlap", "embedDepth": 0.01, "gapTolerance": 0.01, "evidenceRefs": ["couch"]}, "dimensions": {"width": 0.55, "height": 0.14, "depth": 0.32, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.07, -0.75], "rotation": [0, 0, 1.5707963267948966], "scale": [0.55, 0.14, 0.32]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "pad", "materialLayers": ["pad"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["couch"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(239, 227, 184, 1.0)", "secondaryAlbedo": "rgba(239, 227, 184, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8}};
  node_pillow_8.add(mesh_pillow_8);
  meshes["pillow"] = mesh_pillow_8;
  colliders["pillow"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pillow_8);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createMRIScannerLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "MRI Scanner look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "color": "#FFF4E6", "intensity": 2.2, "direction": [-0.4, 0.8, 0.6], "note": "warm ceiling spot from upper left, as in the reference"}, {"id": "fill", "type": "hemisphere", "sky": "#FFFFFF", "ground": "#E8E4DC", "intensity": 0.9, "note": "bright white room bounce"}, {"id": "rim", "type": "directional", "color": "#FFFFFF", "intensity": 0.8, "direction": [0.6, 0.4, -0.7], "note": "back rim to separate the ring from the bubble"}, {"id": "environment", "type": "environment", "preset": "room", "intensity": 0.7, "note": "soft studio environment for satin plastic"}, {"id": "exposure", "type": "tone-mapping", "toneMapping": "ACESFilmic", "exposure": 1.0, "note": "exposure 1.0 with ACES filmic tone mapping to keep the off-white plastic from clipping"}, {"id": "contact-shadow", "type": "ground-shadow", "note": "soft contact shadow under the plinth and couch pedestal (shadow-catcher plane, radius 0.6, opacity 0.25)"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createMRIScannerEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameMRIScannerCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createMRIScannerPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureMRIScannerRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createMRIScannerInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
