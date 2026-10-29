import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/components/DocumentCard';
import {
  AppText,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChip,
  Notice,
  PageContainer,
  PageHeader,
  ProgressIndicator,
  Row,
  Skeleton,
  TextField,
  useToast,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useIngestion } from '@/hooks/useIngestion';
import { ApiError, api, errorMessage } from '@/services/api';
import { spacing } from '@/theme/tokens';
import type { DocumentStatus, DocumentSummary } from '@/types/api';
import { DOCUMENT_STATUS, formatDateTime } from '@/utils/format';

const STATUS_FILTERS: (DocumentStatus | 'all')[] = ['all', 'processed', 'failed', 'pending', 'processing', 'excluded'];
const SORTS = [
  { id: 'name', label: 'Nome' },
  { id: 'updated', label: 'Atualização' },
  { id: 'status', label: 'Estado' },
];
const ALLOWED = ['pdf', 'txt', 'md'];

export default function DocumentsScreen() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [sort, setSort] = useState('name');
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmReindex, setConfirmReindex] = useState(false);
  const [busy, setBusy] = useState(false);

  const docs = useAsync(
    () => api.documents({ search: search || undefined, status: statusFilter === 'all' ? undefined : statusFilter, sort, pageSize: 200 }),
    [search, statusFilter, sort],
  );
  const settings = useAsync(() => api.settings(), []);
  const ingestion = useIngestion(() => {
    void docs.reload();
    toast.show('Indexação concluída. Confira o estado de cada documento.', 'success');
  });

  const running = ingestion.status?.running ?? false;
  const current = ingestion.status?.current;
  const last = ingestion.status?.last;
  const maxMb = settings.data?.max_upload_size_mb ?? 20;

  const startScan = async () => {
    setBusy(true);
    try {
      await api.scan();
      toast.show('Os documentos estão sendo preparados para consulta.', 'info');
      ingestion.track();
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const reindexAll = async () => {
    setConfirmReindex(false);
    setBusy(true);
    try {
      await api.reindex();
      toast.show('Reindexação completa iniciada.', 'info');
      ingestion.track();
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const reindexOne = async (doc: DocumentSummary) => {
    try {
      await api.reindex([doc.id]);
      toast.show(`Reprocessando “${doc.filename}”.`, 'info');
      ingestion.track();
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    }
  };

  const pickAndUpload = async () => {
    if (uploading) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'text/markdown', '.md'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED.includes(ext)) {
      toast.show('Arquivo não suportado. Envie PDF, TXT ou MD.', 'danger');
      return;
    }
    if (asset.size && asset.size > maxMb * 1024 * 1024) {
      toast.show(`O arquivo excede o limite de ${maxMb} MB.`, 'danger');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadDocument({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: Platform.OS === 'web' ? ((asset as unknown as { file?: Blob }).file ?? null) : null,
      });
      toast.show(uploaded.message, 'success');
      ingestion.track();
      void docs.reload();
    } catch (err) {
      const msg = err instanceof ApiError && err.code === 'duplicado' ? err.message : errorMessage(err);
      toast.show(msg, 'danger');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const result = await api.deleteDocument(toDelete.id);
      toast.show(result.message, 'success');
      setToDelete(null);
      void docs.reload();
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    } finally {
      setDeleting(false);
    }
  };

  const items = docs.data?.items ?? [];
  const counts = items.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }), {});

  return (
    <PageContainer>
      <PageHeader
        title="Documentos"
        description="Acervo usado nas respostas. Os arquivos da pasta Documentos/ nunca são alterados pelo sistema."
        right={
          <>
            <Button label="Enviar arquivo" icon="cloud-upload-outline" onPress={() => void pickAndUpload()} loading={uploading} disabled={running} />
            <Button label="Indexar pasta" icon="sync-outline" variant="secondary" onPress={() => void startScan()} loading={busy} disabled={running} />
            <Button label="Reindexar tudo" icon="refresh" variant="ghost" onPress={() => setConfirmReindex(true)} disabled={running || busy} />
          </>
        }
      />

      <AppText variant="caption" color="textSecondary">
        Formatos aceitos: {settings.data?.supported_file_types.join(', ').toUpperCase() ?? 'PDF, TXT, MD'} · limite de {maxMb} MB por arquivo.
        PDFs digitalizados (imagem) precisam de OCR.
      </AppText>

      {running && current ? (
        <Card>
          <AppText variant="bodyStrong">Os documentos estão sendo preparados para consulta.</AppText>
          {current.stats.to_process > 0 ? (
            <ProgressIndicator current={current.stats.processed_so_far} total={current.stats.to_process} label="Documentos processados" />
          ) : (
            <AppText variant="helper" color="textSecondary">
              Verificando arquivos novos ou alterados…
            </AppText>
          )}
        </Card>
      ) : null}

      {!running && last ? (
        <Notice tone={last.status === 'failed' ? 'danger' : last.stats.failed ? 'warning' : 'success'} title={`Última indexação (${formatDateTime(last.finished_at)})`}>
          <AppText variant="helper">
            {last.status === 'failed'
              ? last.error_message ?? 'A indexação falhou.'
              : `${last.stats.new} novo(s), ${last.stats.updated} atualizado(s), ${last.stats.unchanged} sem alteração, ${last.stats.failed} com falha, ${last.stats.removed} removido(s), ${last.stats.skipped} ignorado(s).`}
          </AppText>
        </Notice>
      ) : null}

      {ingestion.status && !ingestion.status.index.compatible ? (
        <Notice tone="danger" title="Índice incompatível">
          {ingestion.status.index.message ?? 'Reindexe o acervo para continuar.'}
        </Notice>
      ) : null}

      <View style={styles.filters}>
        <TextField label="Buscar por nome ou metadado" icon="search" value={search} onChangeText={setSearch} placeholder="Buscar documentos" hideLabel />
        <Row gap={spacing.xs}>
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'Todos' : `${DOCUMENT_STATUS[s].label}${counts[s] && statusFilter === 'all' ? ` (${counts[s]})` : ''}`}
              selected={statusFilter === s}
              onPress={() => setStatusFilter(s)}
            />
          ))}
        </Row>
        <Row gap={spacing.xs}>
          <AppText variant="caption" color="textSecondary">
            Ordenar por:
          </AppText>
          {SORTS.map((o) => (
            <FilterChip key={o.id} label={o.label} selected={sort === o.id} onPress={() => setSort(o.id)} />
          ))}
        </Row>
      </View>

      {docs.loading && !docs.data ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={88} />
          ))}
        </View>
      ) : docs.error ? (
        <ErrorState message={docs.error.message} onRetry={() => void docs.reload()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={search || statusFilter !== 'all' ? 'Nenhum documento encontrado' : 'Seu acervo ainda está vazio'}
          message={
            search || statusFilter !== 'all'
              ? 'Ajuste a busca ou os filtros.'
              : 'Adicione documentos para começar a consultar suas fontes. Coloque arquivos em Documentos/ e use “Indexar pasta”, ou envie um arquivo.'
          }
        />
      ) : (
        <View style={styles.list}>
          <Row>
            <Badge label={`${docs.data?.total ?? 0} documento(s)`} />
          </Row>
          {items.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onOpen={(id) => router.push({ pathname: '/documentos/[id]', params: { id } })}
              onDelete={setToDelete}
              onReindex={running ? undefined : (d) => void reindexOne(d)}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={toDelete !== null}
        title="Remover documento do acervo?"
        message={
          toDelete?.origin === 'upload'
            ? `“${toDelete?.filename}” será removido do índice e o arquivo enviado será apagado do servidor.`
            : `“${toDelete?.filename}” será removido do índice e deixará de ser usado nas respostas. O arquivo original em Documentos/ será preservado.`
        }
        confirmLabel="Remover"
        destructive
        loading={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        visible={confirmReindex}
        title="Reindexar todo o acervo?"
        message="Todos os documentos serão processados novamente (extração, chunks e embeddings). Durante a operação, as respostas podem ficar indisponíveis."
        confirmLabel="Reindexar"
        onCancel={() => setConfirmReindex(false)}
        onConfirm={() => void reindexAll()}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm },
  list: { gap: spacing.sm },
});
