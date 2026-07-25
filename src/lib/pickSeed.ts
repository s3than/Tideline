export function lcgIndex(seed: number, max: number): number {
  const next = (((seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * max;
  return Math.floor(next);
}

export function monthSeed(month: string, slug: string): number {
  const offset = [...slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 97;
  return Number(month) * 100 + offset;
}
