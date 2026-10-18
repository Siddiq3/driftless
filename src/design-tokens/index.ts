/**
 * Driftless design tokens — original identity: deep-indigo night sky, warm amber lantern glow.
 * Every foreground/background pair used for text is listed in TEXT_PAIRS and must meet WCAG AA.
 */

export const palette = {
  night900: '#0E0B1F',
  night800: '#17132E',
  night700: '#221C42',
  night500: '#4A4378',
  mist100: '#F4F1FA',
  mist300: '#C9C3DC',
  mist500: '#9A93B4',
  amber400: '#FFB547',
  amber600: '#E08A00',
  sage400: '#7FD1A8',
  coral400: '#FF8A7A',
  white: '#FFFFFF',
} as const;

export type Theme = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  success: string;
  warning: string;
  border: string;
};

export const dark: Theme = {
  bg: palette.night900,
  surface: palette.night800,
  surfaceRaised: palette.night700,
  text: palette.mist100,
  textMuted: palette.mist300,
  accent: palette.amber400,
  onAccent: palette.night900,
  success: palette.sage400,
  warning: palette.coral400,
  border: palette.night500,
};

export const light: Theme = {
  bg: palette.mist100,
  surface: palette.white,
  surfaceRaised: palette.white,
  text: palette.night900,
  textMuted: '#4E4868',
  accent: '#9A5B00',
  onAccent: palette.white,
  success: '#1F6B47',
  warning: '#A8321F',
  border: palette.mist300,
};

/** 4-pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

/** Type scale in sp/pt. Components must allow font scaling (dynamic type) — never fix heights. */
export const type = {
  display: { size: 34, lineHeight: 40, weight: '700' },
  title: { size: 24, lineHeight: 30, weight: '700' },
  heading: { size: 19, lineHeight: 25, weight: '600' },
  body: { size: 16, lineHeight: 23, weight: '400' },
  label: { size: 14, lineHeight: 19, weight: '500' },
  caption: { size: 12, lineHeight: 16, weight: '400' },
} as const;

/** Minimum touch target (dp/pt). */
export const MIN_TOUCH = 48;

/** [foreground key, background key] pairs rendered as text in the UI. */
export const TEXT_PAIRS: readonly (readonly [keyof Theme, keyof Theme])[] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceRaised'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['onAccent', 'accent'],
  ['success', 'surface'],
  ['warning', 'surface'],
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad colour ${hex}`);
  const n = parseInt(m[1]!, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
