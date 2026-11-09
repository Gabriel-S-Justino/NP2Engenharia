import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, ConfirmDialog, ErrorState, FilterChip, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader, TextField, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api, errorMessage } from '@/services/api';
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
  const { connection, lastHealthCheck, refreshHealth, adminToken, saveAdminToken } = useAppState();
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
      <PageHeader title="Configurações" description="Cuide do seu acesso, da aparência e das preferências do acervo." />

      <Card>
        <SectionHeader title="Conexão" right={<Button label="Verificar agora" size="sm" variant="secondary" onPress={() => void refreshHealth()} />} />
        <Item
          label="Disponibilidade do serviço"
          value={{ checking: 'Verificando', online: 'Conectado', degraded: 'Conectado com alertas', offline: 'Indisponível' }[connection]}
          tone={connection === 'online' ? 'success' : connection === 'degraded' ? 'warning' : connection === 'offline' ? 'danger' : undefined}
        />
        <Item label="Última verificação" value={formatDateTime(lastHealthCheck)} />
      </Card>

      {settings.loading && !s ? <LoadingState /> : null}
      {settings.error ? <ErrorState message={settings.error.message} onRetry={() => void settings.reload()} /> : null}

      {s ? (
        <>
          <Card>
            <SectionHeader title="Ajustes do acervo" description="Opções da equipe responsável pela preparação e consulta dos materiais." />
            {s.requires_reindex ? <Notice tone="warning">Há documentos indexados com parâmetros diferentes dos atuais. Reindexe o acervo.</Notice> : null}
            {form ? (
              <>
                <Row>
                  <View style={styles.half}>
                    <TextField label="Quantidade de trechos consultados" keyboardType="number-pad" value={form.top_k} onChangeText={(v) => setForm({ ...form, top_k: v })} error={errors.top_k} />
                  </View>
                  <View style={styles.half}>
                    <TextField
                      label="Correspondência mínima"
                      keyboardType="decimal-pad"
                      value={form.similarity_threshold}
                      onChangeText={(v) => setForm({ ...form, similarity_threshold: v })}
                      error={errors.similarity_threshold}
                      helper="Define o quanto um trecho precisa se relacionar com a pergunta."
                    />
                  </View>
                </Row>
                <Row>
                  <View style={styles.half}>
                    <TextField label="Tamanho dos trechos (caracteres)" keyboardType="number-pad" value={form.chunk_size} onChangeText={(v) => setForm({ ...form, chunk_size: v })} error={errors.chunk_size} />
                  </View>
                  <View style={styles.half}>
                    <TextField label="Sobreposição (caracteres)" keyboardType="number-pad" value={form.chunk_overlap} onChangeText={(v) => setForm({ ...form, chunk_overlap: v })} error={errors.chunk_overlap} />
                  </View>
                </Row>
                {chunkChanged ? <Notice tone="warning">Alterar o tamanho dos trechos exige preparar novamente os documentos.</Notice> : null}
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

          </Card>

          <Card>
            <SectionHeader title="Acesso administrativo" description="O token autoriza o envio e a organização dos documentos. Solicite-o à equipe responsável." />
            <Item label="Acesso protegido" value={s.admin_required ? 'Sim' : 'Não exigido'} />
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
                ? 'Partes dos documentos são enviadas ao serviço de IA para responder às perguntas. Use apenas materiais que você tem autorização para compartilhar.'
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
        message="As novas preferências de preparação só valem após reprocessar todos os documentos. Durante a reindexação, as respostas podem ficar indisponíveis."
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
