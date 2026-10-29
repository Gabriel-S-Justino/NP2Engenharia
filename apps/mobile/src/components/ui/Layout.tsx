import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, maxContentWidth, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

/** Contêiner de página com rolagem, largura máxima de leitura e espaçamento responsivo. */
export function PageContainer({ children, scroll = true, width = 'page' }: { children: ReactNode; scroll?: boolean; width?: 'page' | 'reading' }) {
  const { colors } = useTheme();
  const { isCompact } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const padding = isCompact ? spacing.md : spacing.xl;
  const inner = (
    <View style={[styles.inner, { maxWidth: maxContentWidth[width], padding, paddingTop: padding + (isCompact ? insets.top : 0) }]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={[styles.flex, { backgroundColor: colors.background }]}>{inner}</View>;
  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function PageHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  const { isCompact } = useBreakpoint();
  return (
    <View style={[styles.header, isCompact && styles.headerCompact]}>
      <View style={styles.headerText}>
        <AppText variant={isCompact ? 'title' : 'display'} headingLevel={1}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="body" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function SectionHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.headerText}>
        <AppText variant="subtitle" headingLevel={2}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="helper" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, tone = 'default', testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'muted'; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        elevation.low,
        { backgroundColor: tone === 'muted' ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Row({ children, gap = spacing.sm, wrap = true, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: { width: '100%', alignSelf: 'center', gap: spacing.lg, flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap' },
  headerCompact: { alignItems: 'flex-start' },
  headerText: { flex: 1, minWidth: 220, gap: spacing.xxs },
  headerRight: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
});
