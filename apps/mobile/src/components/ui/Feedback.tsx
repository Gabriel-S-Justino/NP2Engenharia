import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { durations, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { useToneColors, type Tone } from './Badge';
import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function EmptyState({ icon = 'folder-open-outline', title, message, action }: { icon?: IconName; title: string; message: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="summary">
      <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <AppText variant="subtitle" style={styles.textCenter}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.textCenter}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

/** Erro compreensível: o que ocorreu, o que fazer e se é possível tentar novamente. */
export function ErrorState({ title = 'Algo não saiu como esperado', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <AppText variant="subtitle" style={styles.textCenter}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.textCenter}>
        {message}
      </AppText>
      {onRetry ? <Button label="Tentar novamente" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} />
      <AppText variant="helper" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

/** Placeholder de carregamento. Respeita "reduzir movimento" do sistema (sem pulsar). */
export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | `${number}%` }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: durations.slow * 2, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0.6, duration: durations.slow * 2, useNativeDriver: false }),
          ]),
        );
        loop.start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity }}
    />
  );
}

/** Indicador de progresso apenas com dados reais (atual/total); sem percentuais inventados. */
export function ProgressIndicator({ current, total, label }: { current: number; total: number; label: string }) {
  const { colors } = useTheme();
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: current }}>
      <AppText variant="caption" color="textSecondary">
        {label}: {current} de {total}
      </AppText>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.bar, { backgroundColor: colors.primary, width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

/** Aviso contextual (insuficiência de evidências, divergências, limitações). */
export function Notice({ tone = 'info', title, children, icon }: { tone?: Tone; title?: string; children: ReactNode; icon?: IconName }) {
  const c = useToneColors(tone);
  const defaultIcon: IconName =
    tone === 'danger' ? 'alert-circle-outline' : tone === 'warning' ? 'warning-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.fg }]} accessibilityRole="text">
      <Ionicons name={icon ?? defaultIcon} size={20} color={c.fg} />
      <View style={styles.noticeBody}>
        {title ? (
          <AppText variant="bodyStrong" style={{ color: c.fg }}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? <AppText variant="helper">{children}</AppText> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center', maxWidth: 520 },
  progress: { gap: spacing.xxs },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8 },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderLeftWidth: 4 },
  noticeBody: { flex: 1, gap: spacing.xxs },
});
