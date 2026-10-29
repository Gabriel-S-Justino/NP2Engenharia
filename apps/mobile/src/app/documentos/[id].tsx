import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MetadataTable } from '@/components/MetadataTable';
import { SourceReference } from '@/components/SourceReference';
import { AppText, Badge, Button, Card, ErrorState, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';
import { spacing } from '@/theme/tokens';
import { DOCUMENT_STATUS } from '@/utils/format';

const PAGE_SIZE = 10;

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const doc = useAsync(() => api.document(id), [id]);
  const chunks = useAsync(() => api.documentChunks(id, page, PAGE_SIZE), [id, page]);

  if (doc.loading && !doc.data) return <PageContainer><LoadingState /></PageContainer>;
  if (doc.error || !doc.data) {
    return (
      <PageContainer>
        <ErrorState message={doc.error?.message ?? 'Documento não encontrado.'} onRetry={() => void doc.reload()} />
        <Button label="Voltar para documentos" variant="secondary" onPress={() => router.navigate('/documentos')} />
      </PageContainer>
    );
  }
  const d = doc.data;
  const totalPages = chunks.data ? Math.max(1, Math.ceil(chunks.data.total / PAGE_SIZE)) : 1;
  return (
    <PageContainer>
      <Button label="Voltar" icon="arrow-back" variant="ghost" size="sm" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/documentos'))} style={styles.back} />
      <PageHeader title={d.metadata.title ?? d.filename} description={d.relative_path} right={<Badge label={DOCUMENT_STATUS[d.status].label} tone={DOCUMENT_STATUS[d.status].tone} />} />
      {d.error_message ? <Notice tone={d.status === 'failed' ? 'danger' : 'info'} title={d.status === 'failed' ? 'Motivo da falha' : 'Observação'}>{d.error_message}</Notice> : null}
      {d.warnings.length ? (
        <Notice tone="warning" title="Avisos da extração">
          {d.warnings.map((w) => (
            <AppText key={w} variant="helper">
              • {w}
            </AppText>
          ))}
        </Notice>
      ) : null}
      <Card>
        <SectionHeader title="Metadados" description="Campos não fornecidos pela fonte aparecem como “Não informado”." />
        <MetadataTable document={d} />
      </Card>
      <View style={styles.chunks}>
        <SectionHeader title={`Trechos indexados (${chunks.data?.total ?? d.chunk_count})`} description="Texto original de cada trecho usado na busca, com página e seção." />
        {chunks.loading && !chunks.data ? <LoadingState /> : null}
        {chunks.error ? <ErrorState message={chunks.error.message} onRetry={() => void chunks.reload()} /> : null}
        {chunks.data?.items.map((c) => (
          <SourceReference
            key={c.id}
            source={{ sourceId: c.id, title: `Trecho ${c.ordinal}`, page: c.page, section: c.section, excerpt: c.text, suspicious: c.suspicious }}
            onOpen={(sid) => router.push({ pathname: '/fontes', params: { source: sid } })}
          />
        ))}
        {chunks.data && chunks.data.total > PAGE_SIZE ? (
          <Row>
            <Button label="Anterior" variant="secondary" size="sm" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
            <AppText variant="caption" color="textSecondary">
              Página {page} de {totalPages}
            </AppText>
            <Button label="Próxima" variant="secondary" size="sm" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
          </Row>
        ) : null}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  chunks: { gap: spacing.sm },
});
