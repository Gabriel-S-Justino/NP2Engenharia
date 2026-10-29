/**
 * Tokens do design system do Acervo IA.
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
};

export const lightColors: ColorTokens = {
  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF2F8',
  textPrimary: '#172033',
  textSecondary: '#556275',
  textOnPrimary: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#B8C2D1',
  primary: '#4F46E5',
  primaryStrong: '#3730A3',
  primarySoft: '#EEF0FF',
  success: '#15803D',
  successSoft: '#E8F6EE',
  warning: '#B45309',
  warningSoft: '#FDF3E3',
  danger: '#B91C1C',
  dangerSoft: '#FCEBEB',
  info: '#0E6A8A',
  infoSoft: '#E6F3F8',
  focus: '#4F46E5',
  disabled: '#E2E8F0',
  disabledText: '#6B7686',
  evidence: '#0F766E',
  evidenceSoft: '#E6F4F2',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkColors: ColorTokens = {
  background: '#0B1020',
  surface: '#121A2B',
  surfaceElevated: '#1B263A',
  surfaceMuted: '#172238',
  textPrimary: '#F1F5F9',
  textSecondary: '#A3B2C7',
  textOnPrimary: '#0B1020',
  border: '#29364B',
  borderStrong: '#3B4A63',
  primary: '#818CF8',
  primaryStrong: '#A5B4FC',
  primarySoft: '#1E2447',
  success: '#4ADE80',
  successSoft: '#12291D',
  warning: '#FBBF24',
  warningSoft: '#2D2310',
  danger: '#F87171',
  dangerSoft: '#311717',
  info: '#67C7E8',
  infoSoft: '#102633',
  focus: '#A5B4FC',
  disabled: '#22304A',
  disabledText: '#8291A8',
  evidence: '#5EEAD4',
  evidenceSoft: '#0F2A2A',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Escala de espaçamento (px). */
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700' as const },
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

export const maxContentWidth = { reading: 760, page: 1120 } as const;

/** Breakpoints (largura mínima, px). */
export const breakpoints = { mobileNarrow: 0, mobileWide: 400, tablet: 768, desktop: 1024 } as const;

export const durations = { fast: 120, normal: 200, slow: 320 } as const;
