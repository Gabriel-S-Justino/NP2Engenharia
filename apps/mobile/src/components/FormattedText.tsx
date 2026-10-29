import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

type Props = {
  text: string;
  /** Chamado ao tocar em um rótulo de citação [F1]. */
  onCitationPress?: (label: string) => void;
  knownLabels?: string[];
};

const TOKEN = /(\*\*[^*]+\*\*|\[F\d{1,2}\])/g;

/** Formatação básica e segura (sem HTML): parágrafos, listas "- ", **negrito** e citações [F1]. */
export function FormattedText({ text, onCitationPress, knownLabels }: Props) {
  const { colors } = useTheme();
  const blocks = text.split(/\n{2,}/);

  const renderInline = (line: string, key: string) =>
    line.split(TOKEN).filter(Boolean).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={`${key}-${i}`} style={{ fontWeight: '700' }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      const citation = part.match(/^\[(F\d{1,2})\]$/);
      if (citation) {
        const label = citation[1];
        const known = !knownLabels || knownLabels.includes(label);
        return (
          <Text
            key={`${key}-${i}`}
            accessibilityRole={onCitationPress && known ? 'link' : undefined}
            accessibilityLabel={`Fonte ${label}`}
            onPress={onCitationPress && known ? () => onCitationPress(label) : undefined}
            style={[styles.citation, { color: colors.evidence, backgroundColor: colors.evidenceSoft }]}>
            {` ${label} `}
          </Text>
        );
      }
      return <Text key={`${key}-${i}`}>{part}</Text>;
    });

  return (
    <View style={styles.container}>
      {blocks.map((block, b) => {
        const lines = block.split('\n');
        return (
          <View key={b} style={styles.block}>
            {lines.map((line, l) => {
              const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
              const content = bullet ? bullet[1] : line;
              return (
                <View key={l} style={bullet ? styles.bulletRow : undefined}>
                  {bullet ? <Text style={[typography.body, { color: colors.textSecondary }]}>•</Text> : null}
                  <Text style={[typography.body, styles.flex, { color: colors.textPrimary }]} selectable>
                    {renderInline(content, `${b}-${l}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  block: { gap: spacing.xxs },
  bulletRow: { flexDirection: 'row', gap: spacing.xs, paddingLeft: spacing.xxs },
  flex: { flexShrink: 1 },
  citation: { fontWeight: '700', fontSize: 13, borderRadius: 4 },
});
