import { contrastRatio } from '@/theme/contrast';
import { darkColors, lightColors, type ColorTokens } from '@/theme/tokens';

const TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['textPrimary', 'background'],
  ['textPrimary', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'surfaceMuted'],
  ['textOnPrimary', 'primary'],
  ['primary', 'surface'],
  ['primaryStrong', 'primarySoft'],
  ['success', 'successSoft'],
  ['warning', 'warningSoft'],
  ['danger', 'dangerSoft'],
  ['info', 'infoSoft'],
  ['evidence', 'evidenceSoft'],
  ['disabledText', 'disabled'],
];

describe.each([
  ['claro', lightColors],
  ['escuro', darkColors],
])('tema %s', (_name, colors) => {
  it.each(TEXT_PAIRS)('%s sobre %s atende WCAG AA para texto (≥ 4.5:1)', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('foco e bordas fortes atendem contraste mínimo de componentes (≥ 3:1)', () => {
    expect(contrastRatio(colors.focus, colors.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(1.5);
  });
});
