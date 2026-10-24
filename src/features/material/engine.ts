import type { HeightLayer, MaterialProject } from './model';

export type Sample = { h: number; du: number; dv: number };
export type DecodedSource = { id: string; width: number; height: number; pixels: Float32Array };
export type MaterialMaps = { size: number; height: Float32Array; normal: Uint8ClampedArray };
type Field = (u: number, v: number, out: Sample) => void;
const TAU = Math.PI * 2;
const mod = (x: number, n: number) => ((x % n) + n) % n;
const frac = (x: number) => x - Math.floor(x);
const scratch = (): Sample => ({ h: 0, du: 0, dv: 0 });
function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const fadeD = (t: number) => 30 * t * t * (t - 1) * (t - 1);
function noise(n: number, seed: number): Field {
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
function fractal(l: HeightLayer): Field {
  const fields = Array.from({ length: l.octaves }, (_, i) => noise(l.scale * 2 ** i, (l.seed + i * 1619) >>> 0));
  const weights = fields.map((_, i) => (0.2 + l.detail * 0.65) ** i);
  const sum = weights.reduce((a, b) => a + b, 0), t = scratch();
  return (u, v, o) => {
    o.h = o.du = o.dv = 0;
    for (let i = 0; i < fields.length; i++) {
      fields[i](u, v, t); const w = weights[i] / sum;
      if (l.kind === 'ridged') {
        const sign = t.h < 0.5 ? 2 : -2;
        o.h += (1 - Math.abs(t.h * 2 - 1)) * w; o.du += t.du * sign * w; o.dv += t.dv * sign * w;
      } else { o.h += t.h * w; o.du += t.du * w; o.dv += t.dv * w; }
    }
  };
}
function cellular(l: HeightLayer): Field {
  const n = l.scale, points = new Float64Array(n * n * 2), cracked = l.kind === 'cracks';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 2;
    points[k] = 0.15 + hash(x, y, l.seed) * 0.7;
    points[k + 1] = 0.15 + hash(x, y, l.seed ^ 0x9e3779b9) * 0.7;
  }
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let f1 = Infinity, f2 = Infinity, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const cx = ix + dx, cy = iy + dy, k = (mod(cy, n) * n + mod(cx, n)) * 2;
      const vx = x - cx - points[k], vy = y - cy - points[k + 1], d = vx * vx + vy * vy;
      if (d < f1) { f2 = f1; x2 = x1; y2 = y1; f1 = d; x1 = vx; y1 = vy; }
      else if (d < f2) { f2 = d; x2 = vx; y2 = vy; }
    }
    const d1 = Math.max(Math.sqrt(f1), 1e-9), d2 = Math.max(Math.sqrt(f2), 1e-9);
    if (cracked) {
      const width = 0.035 + l.detail * 0.25, raw = (d2 - d1) / width, t = Math.max(0, Math.min(1, raw));
      o.h = t * t * (3 - 2 * t);
      const ds = raw > 0 && raw < 1 ? 6 * t * (1 - t) * n / width : 0;
      o.du = (x2 / d2 - x1 / d1) * ds; o.dv = (y2 / d2 - y1 / d1) * ds;
    } else {
      o.h = Math.max(0, 1 - d1 / 1.2);
      o.du = o.h > 0 ? -x1 / d1 * n / 1.2 : 0; o.dv = o.h > 0 ? -y1 / d1 * n / 1.2 : 0;
    }
  };
}
function directional(l: HeightLayer): Field {
  const n = l.scale, perturb = noise(4, l.seed), t = scratch();
  const ax = l.direction === 'horizontal' ? 0 : 1, ay = l.direction === 'vertical' ? 0 : 1;
  if (l.kind === 'fibers') {
    const fields = Array.from({ length: 4 }, (_, i) => noise(4, (l.seed + i * 1619) >>> 0));
    const weights = fields.map((_, i) => (0.3 + l.detail * 0.5) ** i), total = weights.reduce((a,b)=>a+b,0);
    return (u,v,o) => {
      o.h = o.du = o.dv = 0;
      for (let i=0;i<fields.length;i++) {
        const a=2**i,b=n*2**i,w=weights[i]/total;
        if (l.direction === 'horizontal') { fields[i](u*a,v*b,t);o.du+=t.du*a*w;o.dv+=t.dv*b*w; }
        else if (l.direction === 'vertical') { fields[i](v*a,u*b,t);o.du+=t.dv*b*w;o.dv+=t.du*a*w; }
        else { fields[i]((u+v)*a,(v-u)*b,t);o.du+=(t.du*a-t.dv*b)*w;o.dv+=(t.du*a+t.dv*b)*w; }
        o.h+=t.h*w;
      }
    };
  }
  return (u, v, o) => {
    if (l.kind === 'woven') {
      const a=TAU*n*2*u,b=TAU*n*2*v,pa=(1+Math.cos(a))/2,pb=(1+Math.cos(b))/2;
      const x=pa**3,y=pb**3,dx=-3*pa*pa*Math.sin(a)*TAU*n,dy=-3*pb*pb*Math.sin(b)*TAU*n;
      const mix=(1+Math.cos(a/2)*Math.cos(b/2))/2;
      const mu=-Math.sin(a/2)*Math.cos(b/2)*TAU*n/2,mv=-Math.cos(a/2)*Math.sin(b/2)*TAU*n/2;
      o.h=.12+.86*(mix*x+(1-mix)*y);
      o.du=.86*(mix*dx+mu*(x-y));o.dv=.86*((1-mix)*dy+mv*(x-y));
    } else {
      perturb(u, v, t);
      const distortion = 0.75;
      const phase = TAU * n * (ax * u + ay * v) + (t.h - 0.5) * distortion;
      const derivative = 0.5 * Math.cos(phase);
      o.h = 0.5 + 0.5 * Math.sin(phase);
      o.du = derivative * (TAU * n * ax + t.du * distortion);
      o.dv = derivative * (TAU * n * ay + t.dv * distortion);
    }
  };
}
function spots(l: HeightLayer): Field {
  const n = l.scale, data = new Float64Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 4;
    data[k] = hash(x, y, l.seed);
    data[k + 1] = hash(x, y, l.seed ^ 0x9e3779b9);
    data[k + 2] = 0.08 + hash(x, y, l.seed ^ 171) * (0.15 + l.detail * 0.3);
    data[k + 3] = hash(x, y, l.seed ^ 293) < 0.25 + l.detail * 0.75 ? 1 : 0;
  }
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let darkness = 0, du = 0, dv = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, k = (mod(cy, n) * n + mod(cx, n)) * 4;
      if (!data[k + 3]) continue;
      const vx = x - cx - data[k], vy = y - cy - data[k + 1], rr = data[k + 2] ** 2;
      const t = (vx * vx + vy * vy) / rr;
      if (t >= 1) continue;
      darkness += (1 - t) ** 3;
      const d = 6 * (1 - t) ** 2 * n / rr;
      du += vx * d; dv += vy * d;
    }
    o.h = Math.max(0, 1 - darkness); o.du = o.h > 0 ? du : 0; o.dv = o.h > 0 ? dv : 0;
  };
}
function imageField(source: DecodedSource, seamless: boolean): Field {
  const { width: w, height: h, pixels } = source;
  const read: Field = (u, v, o) => {
    const x = frac(u) * (w - 1), y = frac(v) * (h - 1), ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = pixels[iy * w + ix], b = pixels[iy * w + Math.min(ix + 1, w - 1)];
    const c = pixels[Math.min(iy + 1, h - 1) * w + ix], d = pixels[Math.min(iy + 1, h - 1) * w + Math.min(ix + 1, w - 1)];
    o.h = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    o.du = ((b - a) * (1 - fy) + (d - c) * fy) * (w - 1);
    o.dv = ((c - a) * (1 - fx) + (d - b) * fx) * (h - 1);
  };
  if (!seamless) return read;
  const a = scratch(), b = scratch(), c = scratch(), d = scratch();
  return (u, v, o) => {
    const wx = Math.sin(Math.PI * u) ** 2, wy = Math.sin(Math.PI * v) ** 2;
    const dx = Math.PI * Math.sin(TAU * u), dy = Math.PI * Math.sin(TAU * v);
    read(u, v, a); read(u + 0.5, v, b); read(u, v + 0.5, c); read(u + 0.5, v + 0.5, d);
    const top = a.h * wx + b.h * (1 - wx), bottom = c.h * wx + d.h * (1 - wx);
    o.h = top * wy + bottom * (1 - wy);
    o.du = (a.du * wx + b.du * (1 - wx) + (a.h - b.h) * dx) * wy
      + (c.du * wx + d.du * (1 - wx) + (c.h - d.h) * dx) * (1 - wy);
    o.dv = (a.dv * wx + b.dv * (1 - wx)) * wy + (c.dv * wx + d.dv * (1 - wx)) * (1 - wy) + (top - bottom) * dy;
  };
}
function layerField(l: HeightLayer, sources: DecodedSource[]): Field {
  let base: Field;
  if (l.kind === 'image') {
    const source = sources.find(s => s.id === l.sourceId); if (!source) throw new Error('灰度源解码失败');
    base = imageField(source, l.tileSource);
  } else if (l.kind === 'noise' || l.kind === 'ridged') base = fractal(l);
  else if (l.kind === 'cells' || l.kind === 'cracks') base = cellular(l);
  else if (l.kind === 'spots') base = spots(l);
  else base = directional(l);
  const wa = noise(3, l.seed ^ 31337), wb = noise(3, l.seed ^ 71391), a = scratch(), b = scratch();
  return (u, v, o) => {
    const warp = l.kind === 'image' ? 0 : l.warp * 0.12;
    if (warp) {
      wa(u, v, a); wb(u, v, b);
      base(u + (a.h - 0.5) * warp, v + (b.h - 0.5) * warp, o);
      const du = o.du, dv = o.dv;
      o.du = du * (1 + a.du * warp) + dv * b.du * warp;
      o.dv = du * a.dv * warp + dv * (1 + b.dv * warp);
    } else base(u, v, o);
    const sign = l.invert ? -1 : 1, value = ((o.h - 0.5) * sign * l.contrast) + 0.5 + l.bias;
    const gain = value > 0 && value < 1 ? sign * l.contrast : 0;
    o.h = Math.max(0, Math.min(1, value)); o.du *= gain; o.dv *= gain;
  };
}
export function createSampler(p: MaterialProject, sources: DecodedSource[] = []): Field {
  const layers = p.layers.filter(l => l.visible && l.opacity > 0).map(l => ({ l, field: layerField(l, sources) }));
  const t = scratch();
  return (u, v, o) => {
    o.h = 1; o.du = o.dv = 0;
    for (const { l, field } of layers) {
      field(u, v, t);
      let h = t.h, du = t.du, dv = t.dv;
      if (l.blend === 'add') { h = o.h + t.h - 0.5; du += o.du; dv += o.dv; }
      else if (l.blend === 'multiply') { h = o.h * t.h; du = o.du * t.h + t.du * o.h; dv = o.dv * t.h + t.dv * o.h; }
      else if (l.blend === 'max' && o.h >= t.h) { h = o.h; du = o.du; dv = o.dv; }
      o.h += (h - o.h) * l.opacity; o.du += (du - o.du) * l.opacity; o.dv += (dv - o.dv) * l.opacity;
      if (o.h <= 0 || o.h >= 1) { o.h = Math.max(0, Math.min(1, o.h)); o.du = o.dv = 0; }
    }
  };
}
export function encodeNormal(du: number, dv: number, strength: number, directX: boolean, out: Uint8ClampedArray, offset: number) {
  const x = -du * strength * 0.05, y = dv * strength * 0.05, inv = 1 / Math.hypot(x, y, 1);
  out[offset] = Math.round((x * inv * 0.5 + 0.5) * 255);
  const g = Math.round((y * inv * 0.5 + 0.5) * 255);
  out[offset + 1] = directX ? 255 - g : g;
  out[offset + 2] = Math.round((inv * 0.5 + 0.5) * 255); out[offset + 3] = 255;
}
export function renderMaterial(p: MaterialProject, size: number, sources: DecodedSource[] = [], progress?: (v: number) => void): MaterialMaps {
  const sample = createSampler(p, sources), t = scratch(), height = new Float32Array(size * size), normal = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      sample(x / size, y / size, t); const k = y * size + x;
      height[k] = t.h; encodeNormal(t.du, t.dv, p.normal.strength, p.normal.convention === 'directx', normal, k * 4);
    }
    if (y % 32 === 0) progress?.(y / size);
  }
  progress?.(1); return { size, height, normal };
}
