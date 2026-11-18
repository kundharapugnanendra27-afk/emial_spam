export type ThemePresetId = 'warm_beige' | 'soft_cream' | 'classic_slate' | 'custom';

export interface ThemeSettings {
  presetId: ThemePresetId;
  canvasBg: string;
  surfaceBg: string;
  subtleBg: string;
  borderColor: string;
  textPrimary: string;
  textMuted: string;
  accentColor: string;
}

export const THEME_PRESETS: Record<Exclude<ThemePresetId, 'custom'>, ThemeSettings> = {
  warm_beige: {
    presetId: 'warm_beige',
    canvasBg: '#F4EFE6',
    surfaceBg: '#FCF9F3',
    subtleBg: '#EBE3D5',
    borderColor: '#DDD3C0',
    textPrimary: '#241E18',
    textMuted: '#695E51',
    accentColor: '#7A3E1D',
  },
  soft_cream: {
    presetId: 'soft_cream',
    canvasBg: '#FAF6EE',
    surfaceBg: '#FFFFFF',
    subtleBg: '#F2ECE1',
    borderColor: '#E5DCCD',
    textPrimary: '#221D17',
    textMuted: '#685F54',
    accentColor: '#2563EB',
  },
  classic_slate: {
    presetId: 'classic_slate',
    canvasBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    subtleBg: '#F1F5F9',
    borderColor: '#E2E8F0',
    textPrimary: '#0F172A',
    textMuted: '#64748B',
    accentColor: '#1D4ED8',
  },
};

export const DEFAULT_THEME: ThemeSettings = THEME_PRESETS.warm_beige;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [36, 30, 24];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function getContrastTextColor(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#1E1A15' : '#FFFFFF';
}

export function applyThemeCssVars(theme: ThemeSettings): React.CSSProperties {
  const accentText = getContrastTextColor(theme.accentColor);
  return {
    '--pl-bg': theme.canvasBg,
    '--pl-surface': theme.surfaceBg,
    '--pl-subtle': theme.subtleBg,
    '--pl-border': theme.borderColor,
    '--pl-text': theme.textPrimary,
    '--pl-muted': theme.textMuted,
    '--pl-accent': theme.accentColor,
    '--pl-accent-text': accentText,
  } as React.CSSProperties;
}
