/* ------------------------------------------------------------------ */
/*  Shared plot color palette                                          */
/*  Used by both the map polygons and the plots list icons.            */
/* ------------------------------------------------------------------ */

export const plotColors = [
  "#cfb991", // gold (brand)
  "#60a5fa", // blue
  "#34d399", // emerald
  "#f472b6", // pink
  "#a78bfa", // violet
  "#fbbf24", // amber
  "#f87171", // red
  "#2dd4bf", // teal
];

export function getPlotColor(index: number) {
  return plotColors[index % plotColors.length];
}
