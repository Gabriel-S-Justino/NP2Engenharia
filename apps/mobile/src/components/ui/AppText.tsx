import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { typography, type ColorTokens, type TypographyVariant } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  /** Nível de título para leitores de tela (web: h1–h6). */
  headingLevel?: 1 | 2 | 3 | 4;
};

export function AppText({ variant = 'body', color = 'textPrimary', headingLevel, style, ...rest }: Props) {
  const { colors } = useTheme();
  const headingProps = headingLevel
    ? ({ role: 'heading', 'aria-level': headingLevel } as const)
    : {};
  return (
    <Text
      {...headingProps}
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: colors[color] }, style]}
    />
  );
}
