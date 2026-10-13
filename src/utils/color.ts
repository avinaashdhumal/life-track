/**
 * Opaque tints for cards.
 *
 * Android draws `elevation` shadows behind a view, so a card with a semi-transparent background
 * (e.g. `${primary}12`) and a shadow shows a grey band through its fill. Blending the tint over the
 * page background gives the same look with an opaque color that renders cleanly everywhere.
 */

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `color` at `alpha` (0..1) over the opaque `base`, as an opaque "#rrggbb". Falls back to `base` on bad input. */
export function tintOver(color: string, alpha: number, base: string): string {
  const fg = parseHex(color);
  const bg = parseHex(base);
  if (!fg || !bg) return base;
  const a = Math.min(1, Math.max(0, alpha));
  const mix = fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
