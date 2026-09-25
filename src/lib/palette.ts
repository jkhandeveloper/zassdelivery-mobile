import { useTheme } from "@/components/providers";

/**
 * The design tokens as plain values, for the places a `className` cannot reach:
 * SVG fills and gradients, lucide icon colours, and navigator props.
 *
 * These mirror `src/global.css` and must be kept in step with it. Anything that
 * *can* take a class should use the semantic utility instead.
 */

export interface Palette {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  brand: string;
  brandContrast: string;
  brandSoft: string;
  saffron: string;
  gold: string;
  danger: string;
  success: string;
  /** The navy hero panel, identical in both themes — it is the brand ground. */
  heroFrom: string;
  heroTo: string;
  heroGlow: string;
}

const LIGHT: Palette = {
  canvas: "#F2F8FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EDF4F9",
  border: "#E3EDF4",
  textPrimary: "#0A1622",
  textSecondary: "#4C6577",
  textMuted: "#75909F",
  brand: "#0E7490",
  brandContrast: "#FFFFFF",
  brandSoft: "#DFF3F9",
  saffron: "#D9480F",
  gold: "#FBBF24",
  danger: "#DC2626",
  success: "#047857",
  heroFrom: "#0A1622",
  heroTo: "#123049",
  heroGlow: "#22D3EE",
};

const DARK: Palette = {
  canvas: "#0A1622",
  surface: "#111F2D",
  surfaceMuted: "#17293A",
  border: "#1C3145",
  textPrimary: "#E8F3FA",
  textSecondary: "#9CB5C8",
  textMuted: "#6B8599",
  brand: "#22D3EE",
  brandContrast: "#04202B",
  brandSoft: "#0D2F3D",
  saffron: "#FF8A3D",
  gold: "#FBBF24",
  danger: "#FB7185",
  success: "#34D399",
  heroFrom: "#06101A",
  heroTo: "#0F2A40",
  heroGlow: "#22D3EE",
};

export function usePalette(): Palette {
  const { resolved } = useTheme();

  return resolved === "dark" ? DARK : LIGHT;
}

/**
 * The background every navigator paints behind its screens.
 *
 * Without it a screen that returns a bare loading, empty or error state — no
 * Screen wrapper of its own — shows React Navigation's default light grey,
 * which in dark mode is a white page with near-white text on it.
 */
export function useSceneStyle(): { backgroundColor: string } {
  return { backgroundColor: usePalette().canvas };
}

/**
 * A stable, pleasant colour pair for something that has no picture — a
 * restaurant without a cover, a dish without a photo. Derived from the name so
 * the same place always gets the same tile.
 */
const TILE_PAIRS: readonly (readonly [string, string])[] = [
  ["#FF8A3D", "#D9480F"],
  ["#22D3EE", "#0E7490"],
  ["#A78BFA", "#5B46D9"],
  ["#34D399", "#047857"],
  ["#FBBF24", "#B45309"],
  ["#FB7185", "#BE123C"],
];

export function tileColors(seed: string): readonly [string, string] {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return TILE_PAIRS[Math.abs(hash) % TILE_PAIRS.length] ?? TILE_PAIRS[0]!;
}
