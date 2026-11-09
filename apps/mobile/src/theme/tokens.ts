/**
 * Tokens do design system do Lumme.
 *
 * Componentes usam apenas nomes semânticos (background, surface, textPrimary...).
 * O contraste das combinações principais é verificado em src/__tests__/tokens.test.ts (WCAG 2.2 AA).
 */

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  focus: string;
  disabled: string;
  disabledText: string;
  evidence: string;
  evidenceSoft: string;
  overlay: string;
  accent: string;
  accentSoft: string;
  board: string;
  boardText: string;
  boardMuted: string;
};

export const lightColors: ColorTokens = {
  background: '#F6F5EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EDEFE5',
  textPrimary: '#19382F',
  textSecondary: '#53645B',
  textOnPrimary: '#FFFFFF',
  border: '#DCE2D5',
  borderStrong: '#A0AFA0',
  primary: '#1C6048',
  primaryStrong: '#154A38',
  primarySoft: '#E4F0E5',
  success: '#216942',
  successSoft: '#E7F2E7',
  warning: '#87520C',
  warningSoft: '#FFF1C8',
  danger: '#B32630',
  dangerSoft: '#FCEBEB',
  info: '#245E76',
  infoSoft: '#E7F2F6',
  focus: '#1C6048',
  disabled: '#DCE2D5',
  disabledText: '#546255',
  evidence: '#1B654B',
  evidenceSoft: '#E7F1E7',
  overlay: 'rgba(14, 36, 28, 0.48)',
  accent: '#EFC64B',
  accentSoft: '#FFF2C8',
  board: '#163F34',
  boardText: '#FFFDF2',
  boardMuted: '#CCDFD0',
};

export const darkColors: ColorTokens = {
  background: '#101C17',
  surface: '#182820',
  surfaceElevated: '#20362B',
  surfaceMuted: '#22362B',
  textPrimary: '#F5F5E9',
  textSecondary: '#B6C8B9',
  textOnPrimary: '#101C17',
  border: '#304A39',
  borderStrong: '#58735F',
  primary: '#9DD8B4',
  primaryStrong: '#B8E9C7',
  primarySoft: '#233E2D',
  success: '#4ADE80',
  successSoft: '#12291D',
  warning: '#FBBF24',
  warningSoft: '#2D2310',
  danger: '#F87171',
  dangerSoft: '#311717',
  info: '#67C7E8',
  infoSoft: '#102633',
  focus: '#B8E9C7',
  disabled: '#304333',
  disabledText: '#B7C9B8',
  evidence: '#5EEAD4',
  evidenceSoft: '#0F2A2A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  accent: '#F2CB59',
  accentSoft: '#3C331B',
  board: '#193D2F',
  boardText: '#FFFDF2',
  boardMuted: '#CCDFD0',
};

/** Escala de espaçamento (px). */
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  helper: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily: 'monospace' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const elevation = {
  none: {},
  low: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  medium: { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
} as const;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Altura mínima de controles; 44px atende à área de toque recomendada (WCAG 2.5.8 / HIG). */
export const controlHeight = { sm: 36, md: 44, lg: 52 } as const;

export const maxContentWidth = { reading: 760, page: 1240 } as const;

/** Breakpoints (largura mínima, px). */
export const breakpoints = { mobileNarrow: 0, mobileWide: 400, tablet: 768, desktop: 1024 } as const;

export const durations = { fast: 120, normal: 200, slow: 320 } as const;
