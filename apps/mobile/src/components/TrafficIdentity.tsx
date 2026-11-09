import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Elementos decorativos: sinalização e escola, sem interação ou estado do produto. */
export function TrafficMark() {
  const { colors } = useTheme();
  return (
    <View style={[styles.mark, { backgroundColor: colors.board }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.lights}>
        <View style={[styles.light, { backgroundColor: '#E9A198' }]} />
        <View style={[styles.light, { backgroundColor: colors.accent }]} />
        <View style={[styles.light, { backgroundColor: '#A1D6AB' }]} />
      </View>
      <Ionicons name="book-outline" size={22} color={colors.boardText} />
    </View>
  );
}

export function StudyHero({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { isCompact } = useBreakpoint();
  return (
    <View style={[styles.hero, { backgroundColor: colors.board, padding: isCompact ? spacing.lg : spacing.xl }]}>
      <View style={styles.heroBody}>
        <View style={styles.copy}>
          <AppText variant="caption" style={{ color: colors.accent, letterSpacing: 2, fontWeight: '700' }}>APRENDA. ENTENDA. SIGA EM FRENTE.</AppText>
          <AppText variant="display" style={[styles.headline, { color: colors.boardText }, isCompact && styles.compactHeadline]}>
            Um caminho mais seguro começa com conhecimento.
          </AppText>
          <AppText style={{ color: colors.boardMuted, maxWidth: 520 }}>
            Tire suas dúvidas sobre as leis de trânsito e aprenda com o apoio dos documentos do seu acervo.
          </AppText>
        </View>
        {!isCompact ? (
          <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.signPost, { backgroundColor: colors.boardMuted }]} />
            <View style={[styles.sign, { backgroundColor: colors.accent }]}>
              <Ionicons name="school" size={48} color={colors.board} style={styles.upright} />
            </View>
            <View style={styles.crossing}>{[0, 1, 2, 3, 4].map((i) => <View key={i} style={[styles.crossingStripe, { backgroundColor: colors.boardText }]} />)}</View>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>{children}</View>
      <View style={styles.road} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <View key={i} style={[styles.dash, { backgroundColor: colors.accent }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 46, height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  lights: { gap: 3 },
  light: { width: 6, height: 6, borderRadius: 3 },
  hero: { borderRadius: radius.lg, gap: spacing.lg, overflow: 'hidden' },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  copy: { flex: 1, gap: spacing.sm },
  headline: { maxWidth: 570, fontSize: 38, lineHeight: 46 },
  compactHeadline: { fontSize: 29, lineHeight: 36 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', paddingBottom: spacing.sm },
  illustration: { width: 175, height: 180, alignItems: 'center', justifyContent: 'center' },
  signPost: { position: 'absolute', width: 7, height: 100, bottom: 19 },
  sign: { width: 96, height: 96, borderRadius: 12, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center', marginTop: -28 },
  upright: { transform: [{ rotate: '-45deg' }] },
  crossing: { position: 'absolute', bottom: 0, flexDirection: 'row', gap: 6, transform: [{ skewX: '-18deg' }] },
  crossingStripe: { width: 19, height: 23, opacity: 0.8 },
  road: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', gap: 20, paddingBottom: 8 },
  dash: { width: 30, height: 3, opacity: 0.6, flexShrink: 0 },
});
