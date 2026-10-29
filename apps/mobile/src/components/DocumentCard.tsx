import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, IconButton } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { DocumentSummary } from '@/types/api';
import { DOCUMENT_STATUS, formatBytes, formatDateTime } from '@/utils/format';

type Props = {
  document: DocumentSummary;
  onOpen: (id: string) => void;
  onDelete?: (doc: DocumentSummary) => void;
  onReindex?: (doc: DocumentSummary) => void;
};

export function DocumentCard({ document: doc, onOpen, onDelete, onReindex }: Props) {
  const { colors } = useTheme();
  const status = DOCUMENT_STATUS[doc.status];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`documento-${doc.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir detalhes de ${doc.metadata.title ?? doc.filename}, ${status.label}`}
        onPress={() => onOpen(doc.id)}
        style={styles.main}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={doc.file_type === 'pdf' ? 'document-outline' : 'document-text-outline'} size={20} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {doc.metadata.title ?? doc.filename}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {doc.relative_path} · {doc.file_type.toUpperCase()} · {formatBytes(doc.size_bytes)}
          </AppText>
          <View style={styles.badges}>
            <Badge label={status.label} tone={status.tone} />
            {doc.status === 'processed' ? <Badge label={`${doc.chunk_count} trechos`} tone="evidence" /> : null}
            {doc.page_count ? <Badge label={`${doc.page_count} pág.`} /> : null}
            {doc.origin === 'upload' ? <Badge label="Enviado pela interface" tone="info" /> : null}
            {doc.origin === 'fixtures' ? <Badge label="Material sintético de teste" tone="warning" /> : null}
          </View>
          <AppText variant="caption" color="textSecondary">
            Atualizado em {formatDateTime(doc.updated_at)}
            {doc.indexed_at ? ` · indexado em ${formatDateTime(doc.indexed_at)}` : ''}
          </AppText>
          {doc.error_message ? (
            <AppText variant="caption" color={doc.status === 'failed' ? 'danger' : 'textSecondary'}>
              {doc.error_message}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {onReindex ? <IconButton icon="refresh" accessibilityLabel={`Reindexar ${doc.filename}`} onPress={() => onReindex(doc)} /> : null}
        {onDelete && doc.status !== 'excluded' ? (
          <IconButton icon="trash-outline" tone="danger" accessibilityLabel={`Remover ${doc.filename} do acervo`} onPress={() => onDelete(doc)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs, alignItems: 'flex-start' },
  main: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.xxs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  actions: { flexDirection: 'column', gap: spacing.xxs },
});
