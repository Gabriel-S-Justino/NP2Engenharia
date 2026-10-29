import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { controlHeight, iconSize, radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = TextInputProps & {
  label: string;
  hideLabel?: boolean;
  helper?: string;
  error?: string | null;
  multiline?: boolean;
  icon?: 'search';
  maxLength?: number;
  showCounter?: boolean;
};

/** Campo de texto com rótulo, ajuda e erro associados (accessibilityLabel/aria-describedby). */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, hideLabel, helper, error, multiline, icon, maxLength, showCounter, style, value, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const helpId = useId();
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.borderStrong;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <View style={styles.wrapper}>
      {!hideLabel && (
        <AppText variant="caption" color="textSecondary" nativeID={`${helpId}-label`}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: colors.surface, minHeight: multiline ? 88 : controlHeight.md },
          focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle),
        ]}>
        {icon === 'search' && <Ionicons name="search" size={iconSize.md} color={colors.textSecondary} />}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-describedby={helper || error ? helpId : undefined}
          aria-invalid={!!error}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          maxLength={maxLength}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[typography.body, styles.input, { color: colors.textPrimary }, multiline && styles.multiline, style]}
          {...rest}
        />
      </View>
      <View style={styles.helperRow}>
        {error ? (
          <AppText nativeID={helpId} variant="caption" color="danger" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : helper ? (
          <AppText nativeID={helpId} variant="caption" color="textSecondary">
            {helper}
          </AppText>
        ) : (
          <View />
        )}
        {showCounter && maxLength ? (
          <AppText variant="caption" color={length >= maxLength ? 'danger' : 'textSecondary'}>
            {length}/{maxLength}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xxs, flexShrink: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  input: { flex: 1, paddingVertical: spacing.xs, outlineStyle: 'none' } as never,
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
});
