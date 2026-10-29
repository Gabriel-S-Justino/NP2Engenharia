import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText, Badge } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { Citation } from '@/types/api';
import { NOT_INFORMED, formatScore, pageLabel } from '@/utils/format';

/** Dados mínimos de uma referência. Só exibe o que o backend forneceu. */
export type SourceRefData = {
  label?: string;
  sourceId: string;
  title: string;
  filename?: string;
  page: number | null;
  section?: string | null;
  excerpt: string;
  relevance?: number | null;
  url?: string | null;
  license?: string | null;
  institution?: string | null;
  author?: string | null;
  suspicious?: boolean;
  cited?: boolean;
  unavailable?: boolean;
};

export function citationToSource(c: Citation): SourceRefData {
  return {
    label: c.label,
    sourceId: c.source_id,
    title: c.document_title,
    filename: c.filename,
    page: c.page,
    section: c.section,
    excerpt: c.excerpt,
    relevance: c.relevance,
    url: c.url,
    license: c.license,
    institution: c.institution,
    author: c.author,
    suspicious: c.suspicious,
    cited: c.cited_in_answer,
  };
}

type Props = {
  source: SourceRefData;
  onOpen?: (sourceId: string) => void;
  compact?: boolean;
  highlighted?: boolean;
  testID?: string;
};

/**
 * Componente central de rastreabilidade: documento, página, seção, trecho e metadados.
 * A "relevância" é a similaridade de cosseno com a pergunta — não é probabilidade de acerto.
 */
export function SourceReference({ source, onOpen, compact, highlighted, testID }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(!compact);
  const [focused, setFocused] = useState(false);
  const meta = [source.section ? `Seção: ${source.section}` : null, source.institution ?? source.author ?? null].filter(Boolean);
  const accessibleSummary = `${source.label ? `Fonte ${source.label}: ` : ''}${source.title}, ${pageLabel(source.page)}`;
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          borderColor: highlighted ? colors.evidence : colors.border,
          backgroundColor: colors.surface,
          borderLeftColor: source.unavailable ? colors.disabledText : colors.evidence,
        },
      ]}>
      <View style={styles.header}>
        {source.label ? (
          <View style={[styles.label, { backgroundColor: colors.evidenceSoft }]}>
            <AppText variant="caption" style={{ color: colors.evidence, fontWeight: '700' }}>
              {source.label}
            </AppText>
          </View>
        ) : null}
        <View style={styles.titleBox}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {source.title}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {pageLabel(source.page)}
            {source.filename ? ` · ${source.filename}` : ''}
          </AppText>
        </View>
      </View>

      <View style={styles.badges}>
        {source.cited === false ? <Badge label="Recuperado, não citado" tone="neutral" /> : null}
        {source.relevance !== undefined && source.relevance !== null ? (
          <Badge label={`Similaridade ${formatScore(source.relevance)}`} tone="evidence" icon="analytics-outline" />
        ) : null}
        {source.suspicious ? <Badge label="Contém texto com formato de instrução (ignorado)" tone="warning" icon="shield-outline" /> : null}
        {source.unavailable ? <Badge label="Fonte indisponível" tone="danger" /> : null}
      </View>

      {expanded ? (
        <View style={[styles.excerpt, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="helper" selectable accessibilityLabel={`Trecho de evidência: ${source.excerpt}`}>
            “{source.excerpt}”
          </AppText>
        </View>
      ) : null}

      {expanded && meta.length ? (
        <AppText variant="caption" color="textSecondary">
          {meta.join(' · ')}
        </AppText>
      ) : null}
      {expanded && (source.url || source.license) ? (
        <AppText variant="caption" color="textSecondary">
          Licença: {source.license ?? NOT_INFORMED}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {compact ? (
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? `Ocultar trecho de ${accessibleSummary}` : `Mostrar trecho de ${accessibleSummary}`} onPress={() => setExpanded((v) => !v)} style={styles.action}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            <AppText variant="caption" color="primary">
              {expanded ? 'Ocultar trecho' : 'Ver trecho'}
            </AppText>
          </Pressable>
        ) : null}
        {onOpen && !source.unavailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir detalhes de ${accessibleSummary}`}
            onPress={() => onOpen(source.sourceId)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.action, focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle)]}>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <AppText variant="caption" color="primary">
              Detalhes da fonte
            </AppText>
          </Pressable>
        ) : null}
        {source.url ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Abrir URL da fonte ${source.title}`} onPress={() => void Linking.openURL(source.url as string)} style={styles.action}>
            <Ionicons name="link-outline" size={16} color={colors.primary} />
            <AppText variant="caption" color="primary">
              URL original
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  header: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  label: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  titleBox: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  excerpt: { padding: spacing.sm, borderRadius: radius.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 2 },
});
