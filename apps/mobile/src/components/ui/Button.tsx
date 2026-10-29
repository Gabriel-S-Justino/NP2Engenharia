import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { controlHeight, iconSize, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Botão acessível: foco visível no teclado (web), estados de carregamento e desabilitado. */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, size = 'md', accessibilityHint, style, testID }: ButtonProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.textPrimary, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: controlHeight[size],
          backgroundColor: inactive ? colors.disabled : palette.bg,
          borderColor: inactive ? colors.disabled : palette.border,
          opacity: pressed ? 0.85 : 1,
        },
        focused && { outlineColor: colors.focus, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
        style,
      ]}>
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={inactive ? colors.disabledText : palette.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={iconSize.md} color={inactive ? colors.disabledText : palette.fg} />
        ) : null}
        <AppText variant="bodyStrong" style={{ color: inactive ? colors.disabledText : palette.fg }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  testID?: string;
};

/** Botão só com ícone: sempre exige rótulo acessível (não depende apenas do ícone). */
export function IconButton({ icon, accessibilityLabel, onPress, disabled, tone = 'default', testID }: IconButtonProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const color = disabled ? colors.disabledText : tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.textSecondary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={6}
      {...(Platform.OS === 'web' ? { title: accessibilityLabel } : {})}
      style={({ pressed }) => [
        styles.icon,
        { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
        focused && { outlineColor: colors.focus, outlineWidth: 3, outlineStyle: 'solid' } as ViewStyle,
      ]}>
      <Ionicons name={icon} size={iconSize.md} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  icon: {
    width: controlHeight.md,
    height: controlHeight.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
