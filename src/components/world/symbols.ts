/**
 * Colours and proportions of the State Flag, taken from the official drawing
 * (tools/symbols/Flag_of_Uzbekistan.svg, Law 18.11.1991 No. 407-XII):
 * on a 125-unit hoist the bands are blue 40 · red 2.5 · white 40 · red 2.5 · green 40.
 * Use these for anything that echoes the flag (card stripes etc.);
 * the flag itself is always the rasterised official image.
 */
export const FLAG_COLORS = { blue: '#008baf', white: '#ffffff', red: '#dd2a1b', green: '#54bd06' } as const;

/** Draws the five horizontal bands of the flag into the box (x, y, w, h). */
export function flagBands(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const u = h / 125;
  const bands: [string, number][] = [
    [FLAG_COLORS.blue, 40], [FLAG_COLORS.red, 2.5], [FLAG_COLORS.white, 40], [FLAG_COLORS.red, 2.5], [FLAG_COLORS.green, 40],
  ];
  let at = y;
  for (const [color, size] of bands) {
    ctx.fillStyle = color;
    ctx.fillRect(x, at, w, size * u + 0.5);
    at += size * u;
  }
}
