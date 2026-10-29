import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { DocumentSummary } from '@/types/api';
import { NOT_INFORMED, formatBytes, formatDateTime } from '@/utils/format';

/** Tabela de metadados: distingue valores conhecidos de "Não informado" (nunca inventa valores). */
export function MetadataTable({ document: d }: { document: DocumentSummary }) {
  const { colors } = useTheme();
  const m = d.metadata;
  const rows: [string, string | null | undefined][] = [
    ['Título', m.title],
    ['Arquivo', d.filename],
    ['Autor', m.author],
    ['Instituição', m.institution],
    ['Data', m.published_date],
    ['Versão', m.version],
    ['Assunto', m.subject],
    ['URL', m.url],
    ['Licença', m.license],
    ['Confiabilidade', m.reliability_notes],
    ['Origem dos metadados', m.metadata_origin],
    ['Tipo', d.file_type.toUpperCase()],
    ['Tamanho', formatBytes(d.size_bytes)],
    ['Páginas', d.page_count !== null ? String(d.page_count) : null],
    ['Trechos', String(d.chunk_count)],
    ['Origem do arquivo', { documentos: 'Pasta Documentos/', upload: 'Enviado pela interface', fixtures: 'Material sintético de teste' }[d.origin]],
    ['Indexado em', d.indexed_at ? formatDateTime(d.indexed_at) : null],
    ['ID', d.id],
  ];
  return (
    <View accessibilityRole="list">
      {rows.map(([label, value]) => (
        <View key={label} style={[styles.row, { borderBottomColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value ?? NOT_INFORMED}`}>
          <AppText variant="caption" color="textSecondary" style={styles.label}>
            {label}
          </AppText>
          <AppText variant="helper" color={value ? 'textPrimary' : 'textSecondary'} style={styles.value} selectable>
            {value ?? NOT_INFORMED}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { width: 160 },
  value: { flex: 1, minWidth: 180 },
});
