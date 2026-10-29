import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, ConfirmDialog, ErrorState, FilterChip, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader, TextField, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api, errorMessage, getBaseUrl } from '@/services/api';
import { useAppState } from '@/state/AppState';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { SettingsOut } from '@/types/api';
import { formatDateTime } from '@/utils/format';
import { validateRetrievalForm, type RetrievalForm } from '@/utils/validation';

function toForm(s: SettingsOut): RetrievalForm {
  return {
    top_k: String(s.top_k),
    similarity_threshold: String(s.similarity_threshold),
    chunk_size: String(s.chunk_size),
    chunk_overlap: String(s.chunk_overlap),
  };
}

function Item({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }) {
  return (
    <Row style={styles.item}>
      <AppText variant="caption" color="textSecondary" style={styles.itemLabel}>
        {label}
      </AppText>
      {tone ? <Badge label={value} tone={tone} /> : <AppText variant="helper" selectable style={styles.itemValue}>{value}</AppText>}
    </Row>
  );
}

export default function SettingsScreen() {
  const toast = useToast();
  const { preference, setPreference } = useTheme();
  const { health, connection, lastHealthCheck, refreshHealth, adminToken, saveAdminToken } = useAppState();
  const settings = useAsync(() => api.settings(), [connection]);
  // Rascunho local; null = valores atuais do servidor.
  const [draft, setForm] = useState<RetrievalForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof RetrievalForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmReindex, setConfirmReindex] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const s = settings.data;
  const form = draft ?? (s ? toForm(s) : null);
  const chunkChanged = !!(s && form && (Number(form.chunk_size) !== s.chunk_size || Number(form.chunk_overlap) !== s.chunk_overlap));

  const submit = async (confirmed = false) => {
    if (!form || !s) return;
    const found = validateRetrievalForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (chunkChanged && !confirmed) {
      setConfirmReindex(true);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        top_k: Number(form.top_k),
        similarity_threshold: Number(form.similarity_threshold.replace(',', '.')),
        chunk_size: Number(form.chunk_size),
        chunk_overlap: Number(form.chunk_overlap),
        confirm_reindex: confirmed,
      });
      settings.setData(updated);
      setForm(null);
      toast.show(chunkChanged ? 'Configuração salva. A reindexação foi iniciada.' : 'Configuração salva.', 'success');
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
      setConfirmReindex(false);
    }
  };

  return (
    <PageContainer width="reading">
      <PageHeader title="Configurações" description="Parâmetros do pipeline RAG e da conexão. Chaves de API nunca são exibidas." />

      <Card>
        <SectionHeader title="Conexão" right={<Button label="Verificar agora" size="sm" variant="secondary" onPress={() => void refreshHealth()} />} />
        <Item label="Endereço da API" value={getBaseUrl()} />
        <Item
          label="Estado do backend"
          value={{ checking: 'Verificando', online: 'Conectado', degraded: 'Conectado com alertas', offline: 'Indisponível' }[connection]}
          tone={connection === 'online' ? 'success' : connection === 'degraded' ? 'warning' : connection === 'offline' ? 'danger' : undefined}
        />
        <Item label="Última verificação" value={formatDateTime(lastHealthCheck)} />
        {health ? <Item label="Ambiente / versão" value={`${health.app_env} · ${health.version}`} /> : null}
        <AppText variant="caption" color="textSecondary">
          O endereço é definido por EXPO_PUBLIC_API_URL no build. Em celular físico, use o IP do computador na rede local (não “localhost”).
        </AppText>
      </Card>

      {settings.loading && !s ? <LoadingState /> : null}
      {settings.error ? <ErrorState message={settings.error.message} onRetry={() => void settings.reload()} /> : null}

      {s ? (
        <>
          <Card>
            <SectionHeader title="Modelos" />
            <Item label="Provedor de geração" value={s.llm_provider === 'demo' ? 'Demonstração (extrativo, sem LLM)' : s.llm_provider} />
            <Item label="Modelo de geração" value={s.llm_model} />
            <Item label="Provedor configurado" value={s.llm_configured ? 'Sim' : 'Não'} tone={s.llm_configured ? 'success' : 'danger'} />
            <Item label="Provedor de embeddings" value={s.embedding_provider} />
            <Item label="Modelo de embeddings" value={s.embedding_model} />
            <Item
              label="Busca semântica"
              value={s.embedding_semantic === null ? 'Indisponível' : s.embedding_semantic ? 'Sim' : 'Não (lexical, apenas testes)'}
              tone={s.embedding_semantic ? 'success' : 'warning'}
            />
            <Item label="Índice vetorial" value={`${s.vector_store} · ${s.similarity_metric}`} />
            {!s.llm_is_real ? (
              <Notice tone="info">Para usar um LLM real, configure LLM_PROVIDER=anthropic e LLM_API_KEY no servidor (nunca no aplicativo). Veja docs/VARIAVEIS_AMBIENTE.md.</Notice>
            ) : null}
          </Card>

          <Card>
            <SectionHeader title="Recuperação e chunking" description={`Unidade dos chunks: ${s.chunk_unit}. Filtros disponíveis: ${s.available_filters.join(', ')}.`} />
            {s.requires_reindex ? <Notice tone="warning">Há documentos indexados com parâmetros diferentes dos atuais. Reindexe o acervo.</Notice> : null}
            {form ? (
              <>
                <Row>
                  <View style={styles.half}>
                    <TextField label="Trechos recuperados (top-k)" keyboardType="number-pad" value={form.top_k} onChangeText={(v) => setForm({ ...form, top_k: v })} error={errors.top_k} />
                  </View>
                  <View style={styles.half}>
                    <TextField
                      label="Limiar de similaridade"
                      keyboardType="decimal-pad"
                      value={form.similarity_threshold}
                      onChangeText={(v) => setForm({ ...form, similarity_threshold: v })}
                      error={errors.similarity_threshold}
                      helper="Calibre com scripts/calibrate_threshold.py"
                    />
                  </View>
                </Row>
                <Row>
                  <View style={styles.half}>
                    <TextField label="Tamanho do chunk" keyboardType="number-pad" value={form.chunk_size} onChangeText={(v) => setForm({ ...form, chunk_size: v })} error={errors.chunk_size} />
                  </View>
                  <View style={styles.half}>
                    <TextField label="Sobreposição" keyboardType="number-pad" value={form.chunk_overlap} onChangeText={(v) => setForm({ ...form, chunk_overlap: v })} error={errors.chunk_overlap} />
                  </View>
                </Row>
                {chunkChanged ? <Notice tone="warning">Alterar o chunking exige reindexar todo o acervo.</Notice> : null}
                <Row>
                  <Button label="Salvar parâmetros" onPress={() => void submit()} loading={saving} />
                  <Button label="Descartar" variant="ghost" onPress={() => { setForm(null); setErrors({}); }} />
                </Row>
                {s.admin_required && !adminToken ? (
                  <AppText variant="caption" color="warning">
                    Alterações exigem o token administrativo (abaixo).
                  </AppText>
                ) : null}
              </>
            ) : null}
            <AppText variant="caption" color="textSecondary">
              Margem de evidência fraca: {s.weak_evidence_margin} · cobertura mínima de termos (modo demonstração): {s.min_term_coverage}
            </AppText>
          </Card>

          <Card>
            <SectionHeader title="Acesso administrativo" description="Upload, indexação, exclusão, avaliação e alterações exigem o token quando o servidor o define." />
            <Item label="Token exigido pelo servidor" value={s.admin_required ? 'Sim' : 'Não (ambiente local)'} />
            <Item label="Token neste dispositivo" value={adminToken ? 'Configurado' : 'Não configurado'} tone={adminToken ? 'success' : undefined} />
            <TextField label="Token administrativo" secureTextEntry autoCapitalize="none" autoCorrect={false} value={tokenInput} onChangeText={setTokenInput} placeholder="Cole o token fornecido pelo responsável" />
            <Row>
              <Button label="Salvar token" size="sm" onPress={() => { void saveAdminToken(tokenInput); setTokenInput(''); toast.show('Token salvo neste dispositivo.', 'success'); }} disabled={!tokenInput.trim()} />
              {adminToken ? <Button label="Remover token" size="sm" variant="ghost" onPress={() => void saveAdminToken(null)} /> : null}
            </Row>
          </Card>

          <Card>
            <SectionHeader title="Privacidade" />
            <Item label="Retenção do histórico" value={s.history_retention_days ? `${s.history_retention_days} dias` : 'Sem expurgo automático'} />
            <Item label="Limite por arquivo" value={`${s.max_upload_size_mb} MB`} />
            <Item label="Limite por pergunta" value={`${s.max_question_chars} caracteres`} />
            <Notice tone={s.llm_is_real ? 'warning' : 'info'}>
              {s.llm_is_real
                ? 'Os trechos recuperados são enviados ao provedor de IA externo para gerar a resposta. Não indexe documentos confidenciais sem autorização.'
                : 'No modo demonstração nenhum conteúdo é enviado a serviços externos.'}
            </Notice>
          </Card>
        </>
      ) : null}

      <Card>
        <SectionHeader title="Aparência" />
        <Row gap={spacing.xs}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((p) => (
            <FilterChip key={p} label={{ system: 'Seguir o sistema', light: 'Claro', dark: 'Escuro' }[p]} selected={preference === p} onPress={() => setPreference(p)} />
          ))}
        </Row>
      </Card>

      <ConfirmDialog
        visible={confirmReindex}
        title="Reindexar o acervo?"
        message="Os novos parâmetros de chunking só valem após reprocessar todos os documentos. Durante a reindexação, as respostas podem ficar indisponíveis."
        confirmLabel="Salvar e reindexar"
        loading={saving}
        onCancel={() => setConfirmReindex(false)}
        onConfirm={() => void submit(true)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  half: { flexGrow: 1, flexBasis: 200 },
  item: { justifyContent: 'space-between' },
  itemLabel: { minWidth: 160 },
  itemValue: { flex: 1, textAlign: 'right' },
});
