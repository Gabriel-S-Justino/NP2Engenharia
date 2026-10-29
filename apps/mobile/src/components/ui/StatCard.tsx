import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Card } from './Layout';
import { Skeleton } from './Feedback';

type Props = {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
};

/** Indicador numérico. Valores ausentes aparecem como "—" (indisponível), nunca como zero inventado. */
export function StatCard({ label, value, hint, icon, loading }: Props) {
  const { colors } = useTheme();
  const display = value === null || value === undefined ? '—' : String(value);
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <AppText variant="caption" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      </View>
      {loading ? (
        <Skeleton height={30} width="50%" />
      ) : (
        <AppText variant="display" accessibilityLabel={`${label}: ${display === '—' ? 'indisponível' : display}`}>
          {display}
        </AppText>
      )}
      {hint ? (
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: 200, minWidth: 160 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  icon: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
