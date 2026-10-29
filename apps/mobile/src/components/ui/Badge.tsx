import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'evidence';

export function useToneColors(tone: Tone) {
  const { colors } = useTheme();
  return {
    neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
    primary: { fg: colors.primaryStrong, bg: colors.primarySoft },
    success: { fg: colors.success, bg: colors.successSoft },
    warning: { fg: colors.warning, bg: colors.warningSoft },
    danger: { fg: colors.danger, bg: colors.dangerSoft },
    info: { fg: colors.info, bg: colors.infoSoft },
    evidence: { fg: colors.evidence, bg: colors.evidenceSoft },
  }[tone];
}

/** Rótulo de estado. Sempre combina cor + texto (+ ícone opcional): o estado não depende só da cor. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: ComponentProps<typeof Ionicons>['name'] }) {
  const c = useToneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]} accessible accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={14} color={c.fg} /> : null}
      <AppText variant="caption" style={{ color: c.fg }}>
        {label}
      </AppText>
    </View>
  );
}

export function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtro: ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.borderStrong,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {selected ? <Ionicons name="checkmark" size={14} color={colors.primaryStrong} /> : null}
      <AppText variant="caption" style={{ color: selected ? colors.primaryStrong : colors.textPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
