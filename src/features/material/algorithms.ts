import { createNoise4D } from 'simplex-noise';

export type Sample = { h: number; du: number; dv: number };
export type Field = ((u: number, v: number, out: Sample) => void) & { value?:(u:number,v:number)=>number };
export const algorithms = {
  value: 'Value', perlin: 'Perlin', simplex: 'Simplex', worley: 'Worley',
  uniform: '均匀白噪声', gaussian: '高斯噪声', salt: '椒盐噪声', poisson: '泊松计数',
  blue: 'Blue Noise', gabor: 'Gabor',
} as const;
export type Algorithm = keyof typeof algorithms;
export const TAU = Math.PI * 2;
export const mod = (x: number, n: number) => ((x % n) + n) % n;
export const frac = (x: number) => x - Math.floor(x);
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const scratch = (): Sample => ({ h: 0, du: 0, dv: 0 });
export function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function random(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function gaussian(rng: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(TAU * rng());
}
export function poisson(lambda: number, rng: () => number) {
  const limit = Math.exp(-lambda); let product = 1, k = 0;
  do { k++; product *= Math.max(1e-12, rng()); } while (product > limit && k < 256);
  return k - 1;
}
export function numerical(fn: (u: number, v: number) => number, step = 1e-5): Field {
  return Object.assign((u:number, v:number, o:Sample) => {
    o.h = fn(u, v);
    o.du = (fn(u + step, v) - fn(u - step, v)) / (2 * step);
    o.dv = (fn(u, v + step) - fn(u, v - step)) / (2 * step);
  },{value:fn});
}
export function heightAt(field:Field,u:number,v:number) {
  if(field.value)return field.value(u,v);
  const o=scratch();field(u,v,o);return o.h;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const fadeD = (t: number) => 30 * t * t * (t - 1) * (t - 1);
export function valueNoise(n: number, seed: number): Field {
  const grid = n <= 256 ? new Float64Array(n * n) : null;
  if (grid) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) grid[y * n + x] = hash(x, y, seed);
  const at = (x: number, y: number) => grid ? grid[mod(y, n) * n + mod(x, n)] : hash(mod(x, n), mod(y, n), seed);
  return (u, v, o) => {
    const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    const sx = fade(fx), sy = fade(fy), ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    o.h = ab + (cd - ab) * sy;
    o.du = ((b - a) * (1 - sy) + (d - c) * sy) * fadeD(fx) * n;
    o.dv = (cd - ab) * fadeD(fy) * n;
  };
}
export function perlinNoise(n: number, seed: number): Field {
  const gradient = (x: number, y: number) => {
    const a = TAU * hash(mod(x, n), mod(y, n), seed);
    return [Math.cos(a), Math.sin(a)];
  };
  return (u, v, o) => {
    const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a = gradient(ix, iy), b = gradient(ix + 1, iy), c = gradient(ix, iy + 1), d = gradient(ix + 1, iy + 1);
    const va = a[0] * fx + a[1] * fy, vb = b[0] * (fx - 1) + b[1] * fy;
    const vc = c[0] * fx + c[1] * (fy - 1), vd = d[0] * (fx - 1) + d[1] * (fy - 1);
    const sx = fade(fx), sy = fade(fy), dx = fadeD(fx), dy = fadeD(fy);
    const top = va + sx * (vb - va), bottom = vc + sx * (vd - vc), gain = .7;
    o.h = .5 + gain * (top + sy * (bottom - top));
    o.du = gain * n * ((a[0] + sx * (b[0] - a[0]) + dx * (vb - va)) * (1 - sy)
      + (c[0] + sx * (d[0] - c[0]) + dx * (vd - vc)) * sy);
    o.dv = gain * n * ((a[1] + sx * (b[1] - a[1])) * (1 - sy)
      + (c[1] + sx * (d[1] - c[1])) * sy + dy * (bottom - top));
  };
}
export type Point = { x: number; y: number };
export function torusDistance(a: Point, b: Point) {
  const x = Math.min(Math.abs(a.x - b.x), 1 - Math.abs(a.x - b.x));
  const y = Math.min(Math.abs(a.y - b.y), 1 - Math.abs(a.y - b.y));
  return Math.hypot(x, y);
}
// Mitchell best-candidate sampling on a torus. Candidates maximize nearest-neighbor distance.
export function bluePoints(count: number, seed: number, minDistance = 0): Point[] {
  const rng = random(seed), points: Point[] = [];
  for (let i = 0; i < count; i++) {
    let best = { x: rng(), y: rng() }, distance = -1;
    for (let c = 0; c < 24; c++) {
      const p = { x: rng(), y: rng() }; let nearest = Infinity;
      for (const q of points) nearest = Math.min(nearest, torusDistance(p, q));
      if (nearest > distance) { best = p; distance = nearest; }
    }
    if (distance >= minDistance) points.push(best);
  }
  return points;
}
function worleyNoise(n: number, seed: number): Field {
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let nearest = Infinity, vx = 0, vy = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = ix + dx, cy = iy + dy;
      const a = x - cx - (.15 + .7 * hash(mod(cx, n), mod(cy, n), seed));
      const b = y - cy - (.15 + .7 * hash(mod(cx, n), mod(cy, n), seed ^ 99)), d = a * a + b * b;
      if (d < nearest) { nearest = d; vx = a; vy = b; }
    }
    const d = Math.max(1e-12, Math.sqrt(nearest)); o.h = clamp(d / 1.2);
    o.du = o.h < 1 ? vx / d * n / 1.2 : 0; o.dv = o.h < 1 ? vy / d * n / 1.2 : 0;
  };
}
function gaborNoise(n: number, seed: number, direction: number): Field {
  const rng = random(seed), kernels = Array.from({ length: n * n * 2 }, () => ({
    x: rng(), y: rng(), angle: direction + (rng() - .5) * .6, phase: TAU * rng(), sign: rng() > .5 ? 1 : -1,
  }));
  const bins = new Map<number, typeof kernels>();
  for (const k of kernels) {
    const key = Math.floor(k.y * n) * n + Math.floor(k.x * n);
    const bucket = bins.get(key) ?? []; bucket.push(k); bins.set(key, bucket);
  }
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let sum = 0, du = 0, dv = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = ix + dx, cy = iy + dy;
      for (const k of bins.get(mod(cy, n) * n + mod(cx, n)) ?? []) {
        const a = x - cx - frac(k.x * n), b = y - cy - frac(k.y * n), q = (a * a + b * b) / 4;
        if (q >= 1) continue;
        const cs = Math.cos(k.angle), sn = Math.sin(k.angle), phase = TAU * (a * cs + b * sn) + k.phase;
        const envelope = Math.exp(-3 * q) * (1 - q) ** 3, ed = envelope * (-3 - 3 / (1 - q));
        const wave = Math.cos(phase), wd = -Math.sin(phase) * TAU;
        sum += k.sign * envelope * wave;
        du += k.sign * (ed * a / 2 * wave + envelope * wd * cs) * n;
        dv += k.sign * (ed * b / 2 * wave + envelope * wd * sn) * n;
      }
    }
    const t = Math.tanh(sum), gain = .3 * (1 - t * t);
    o.h = .5 + .3 * t; o.du = gain * du; o.dv = gain * dv;
  };
}
export function algorithmField(kind: Algorithm, n: number, seed: number, detail = .5, angle = 0): Field {
  if (kind === 'value') return valueNoise(n, seed);
  if (kind === 'perlin') return perlinNoise(n, seed);
  if (kind === 'simplex') {
    const simplex = createNoise4D(random(seed)), radius = n / TAU;
    return numerical((u, v) => .5 + .5 * simplex(
      Math.cos(TAU * u) * radius, Math.sin(TAU * u) * radius,
      Math.cos(TAU * v) * radius, Math.sin(TAU * v) * radius), 1e-6 / Math.max(1, n / 8));
  }
  if (kind === 'worley') return worleyNoise(n, seed);
  if (kind === 'gabor') return gaborNoise(Math.min(64,n), seed, angle);
  if (kind === 'blue') {
    const points = bluePoints(Math.min(512, n * n), seed), bins = Math.ceil(Math.sqrt(points.length)), radius = 2 / bins;
    const grid = new Map<number, Point[]>();
    for (const p of points) {
      const k = Math.floor(p.y * bins) * bins + Math.floor(p.x * bins);
      const list = grid.get(k) ?? []; list.push(p); grid.set(k, list);
    }
    return numerical((u, v) => {
      const x = frac(u), y = frac(v), ix = Math.floor(x * bins), iy = Math.floor(y * bins);
      let ink = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        for (const p of grid.get(mod(iy + dy, bins) * bins + mod(ix + dx, bins)) ?? []) {
          const d = torusDistance({ x, y }, p) / radius;
          if (d < 1) ink += (1 - d * d) ** 3;
        }
      }
      return Math.exp(-ink * 2);
    });
  }
  // Discrete noise uses cell-centered independent draws; gradients are zero inside each pixel cell.
  return (u, v, o) => {
    const x = mod(Math.floor(u * n), n), y = mod(Math.floor(v * n), n), rng = random((hash(x, y, seed) * 4294967296) >>> 0);
    if (kind === 'gaussian') o.h = clamp(.5 + gaussian(rng) * (.05 + detail * .25));
    else if (kind === 'salt') { const r = rng(); o.h = r < detail / 2 ? 0 : r > 1 - detail / 2 ? 1 : .5; }
    else if (kind === 'poisson') { const lambda = 1 + detail * 15; o.h = clamp(.5 + (poisson(lambda, rng) - lambda) / (6 * Math.sqrt(lambda))); }
    else o.h = rng();
    o.du = o.dv = 0;
  };
}
