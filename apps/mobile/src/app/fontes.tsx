import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MetadataTable } from '@/components/MetadataTable';
import { SourceReference } from '@/components/SourceReference';
import { AppText, Badge, Button, Card, EmptyState, ErrorState, FilterChip, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { DOCUMENT_STATUS, NOT_INFORMED } from '@/utils/format';

function SourceDetailView({ sourceId }: { sourceId: string }) {
  const detail = useAsync(() => api.source(sourceId), [sourceId]);
  if (detail.loading && !detail.data) return <LoadingState label="Carregando fonte…" />;
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        title="Não foi possível recuperar a fonte"
        message={detail.error?.message ?? 'Fonte não encontrada. O documento pode ter sido removido ou reindexado.'}
        onRetry={() => void detail.reload()}
      />
    );
  }
  const { chunk, document: d } = detail.data;
  return (
    <View style={styles.detail}>
      <Card>
        <SectionHeader title="Trecho de origem" description={`Identificador do trecho: ${chunk.id}`} />
        <SourceReference
          highlighted
          source={{
            sourceId: chunk.id,
            title: d.metadata.title ?? d.filename,
            filename: d.filename,
            page: chunk.page,
            section: chunk.section,
            excerpt: chunk.text,
            url: d.metadata.url,
            license: d.metadata.license,
            institution: d.metadata.institution,
            author: d.metadata.author,
            suspicious: chunk.suspicious,
          }}
        />
        <AppText variant="caption" color="textSecondary">
          Posição no texto limpo da página: caracteres {chunk.char_start}–{chunk.char_end} · seção {chunk.section ?? NOT_INFORMED}
        </AppText>
        <Notice tone="info">
          Uma citação indica de onde veio a informação, mas não garante que a resposta esteja correta. Leia o trecho e, se necessário, o documento original.
        </Notice>
      </Card>
      <Card>
        <SectionHeader title="Documento" right={<Button label="Ver todos os trechos" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/documentos/[id]', params: { id: d.id } })} />} />
        <MetadataTable document={d} />
      </Card>
    </View>
  );
}

export default function SourcesScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ source?: string }>();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | null>(null);
  const docs = useAsync(() => api.documents({ search: search || undefined, fileType: type ?? undefined, pageSize: 200 }), [search, type]);
  const selected = typeof params.source === 'string' && params.source ? params.source : null;

  return (
    <PageContainer>
      <PageHeader title="Fontes e evidências" description="Rastreie de onde vem cada informação: documento, página, seção, trecho original e metadados." />
      {selected ? (
        <>
          <Button label="Voltar à lista de fontes" icon="arrow-back" variant="ghost" size="sm" onPress={() => router.setParams({ source: '' })} style={styles.back} />
          <SourceDetailView sourceId={selected} />
        </>
      ) : (
        <>
          <TextField label="Buscar por título" icon="search" hideLabel placeholder="Buscar por título ou metadado" value={search} onChangeText={setSearch} />
          <Row gap={spacing.xs}>
            {[null, 'pdf', 'txt', 'md'].map((t) => (
              <FilterChip key={t ?? 'all'} label={t ? t.toUpperCase() : 'Todos os tipos'} selected={type === t} onPress={() => setType(t)} />
            ))}
          </Row>
          {docs.loading && !docs.data ? <LoadingState /> : null}
          {docs.error ? <ErrorState message={docs.error.message} onRetry={() => void docs.reload()} /> : null}
          {docs.data && docs.data.items.length === 0 ? (
            <EmptyState title="Nenhuma fonte encontrada" message="Adicione e indexe documentos para consultar suas fontes." />
          ) : null}
          <View style={styles.list}>
            {docs.data?.items.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir fonte ${d.metadata.title ?? d.filename}`}
                onPress={() => router.push({ pathname: '/documentos/[id]', params: { id: d.id } })}
                style={({ pressed }) => [styles.item, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}>
                <AppText variant="bodyStrong">{d.metadata.title ?? d.filename}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {d.metadata.institution ?? d.metadata.author ?? 'Autoria/instituição não informada'} · {d.metadata.published_date ?? 'data não informada'} · versão {d.metadata.version ?? NOT_INFORMED.toLowerCase()}
                </AppText>
                <Row gap={spacing.xxs}>
                  <Badge label={DOCUMENT_STATUS[d.status].label} tone={DOCUMENT_STATUS[d.status].tone} />
                  <Badge label={`Licença: ${d.metadata.license ?? NOT_INFORMED}`} />
                  {d.metadata.url ? <Badge label="Possui URL" tone="info" /> : null}
                </Row>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  detail: { gap: spacing.md },
  back: { alignSelf: 'flex-start' },
  list: { gap: spacing.sm },
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xxs },
});
