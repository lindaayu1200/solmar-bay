// rng.js - seeded PRNG (mulberry32) plus pure math helpers for Solmar Bay.
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Deterministic PRNG factory; returns rng() yielding floats in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure, stateless random/angle helpers built on an injected rng(). */
export const R = {
  /** True with probability p. */
  chance(rng, p) {
    return rng() < p;
  },
  /** Random element of an array. */
  pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  },
  /** Float in [a, b). */
  range(rng, a, b) {
    return a + rng() * (b - a);
  },
  /** Integer in [a, b] inclusive. */
  int(rng, a, b) {
    return Math.floor(a + rng() * (b - a + 1));
  },
  /** 6-char id string. */
  id(rng) {
    let s = '';
    for (let i = 0; i < 6; i++) s += CHARS[Math.floor(rng() * CHARS.length)];
    return s;
  },
};

/** Clamp v to [a, b]. */
export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/** Linear interpolation from a to b by t. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep easing of x between a and b. */
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Interpolate angles taking the shortest path around the circle. */
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Squared planar distance between (ax,az) and (bx,bz). */
export function dist2(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}