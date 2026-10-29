import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader, TextField, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api, errorMessage } from '@/services/api';

import type { MentorEntryIn } from '@/types/api';
import { validateMentorEntry } from '@/utils/validation';

const EMPTY: MentorEntryIn = {
  entry_date: new Date().toISOString().slice(0, 10),
  stage: '',
  prompt: '',
  response: '',
  evidence: '',
  decision: '',
  change_made: '',
  test_executed: '',
  result_before: '',
  result_after: '',
  author: '',
};

export default function MentorScreen() {
  const toast = useToast();
  const log = useAsync(() => api.mentorLog(), []);
  const [form, setForm] = useState<MentorEntryIn>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof MentorEntryIn, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof MentorEntryIn) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const found = validateMentorEntry(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? null : v])) as MentorEntryIn;
      await api.addMentorEntry(clean);
      toast.show('Registro salvo no diário.', 'success');
      setForm({ ...EMPTY, entry_date: form.entry_date });
      void log.reload();
    } catch (err) {
      toast.show(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="reading">
      <PageHeader
        title="Diário da IA mentora"
        description="Registre cada validação real: prompt enviado, resposta recebida, evidências conferidas, decisão da equipe, alteração e resultado."
      />
      <Notice tone="info" title="Somente interações reais">
        Não registre interações que não aconteceram. Confira as sugestões da IA mentora contra as fontes originais antes de decidir. Os prompts sugeridos estão em docs/DIARIO_VALIDACAO_IA.md.
      </Notice>

      <Card>
        <SectionHeader title="Novo registro" />
        <Row>
          <View style={styles.half}>
            <TextField label="Data (AAAA-MM-DD) *" value={form.entry_date} onChangeText={set('entry_date')} error={errors.entry_date} />
          </View>
          <View style={styles.half}>
            <TextField label="Etapa do projeto *" placeholder="Ex.: chunking, limiar, segurança" value={form.stage} onChangeText={set('stage')} error={errors.stage} />
          </View>
        </Row>
        <TextField label="Prompt enviado à IA mentora *" multiline value={form.prompt} onChangeText={set('prompt')} error={errors.prompt} />
        <TextField label="Resposta recebida *" multiline value={form.response} onChangeText={set('response')} error={errors.response} />
        <TextField label="Evidências consultadas pela equipe" multiline value={form.evidence ?? ''} onChangeText={set('evidence')} />
        <TextField label="Decisão tomada *" multiline value={form.decision} onChangeText={set('decision')} error={errors.decision} />
        <TextField label="Alteração realizada" multiline value={form.change_made ?? ''} onChangeText={set('change_made')} />
        <TextField label="Teste executado" value={form.test_executed ?? ''} onChangeText={set('test_executed')} />
        <Row>
          <View style={styles.half}>
            <TextField label="Resultado anterior" value={form.result_before ?? ''} onChangeText={set('result_before')} />
          </View>
          <View style={styles.half}>
            <TextField label="Resultado posterior" value={form.result_after ?? ''} onChangeText={set('result_after')} />
          </View>
        </Row>
        <TextField label="Integrante responsável" value={form.author ?? ''} onChangeText={set('author')} />
        <Button label="Salvar registro" icon="save-outline" onPress={() => void save()} loading={saving} testID="salvar-mentoria" />
      </Card>

      <SectionHeader title={`Registros (${log.data?.total ?? 0})`} />
      {log.loading && !log.data ? <LoadingState /> : null}
      {log.error ? <ErrorState message={log.error.message} onRetry={() => void log.reload()} /> : null}
      {log.data && log.data.items.length === 0 ? (
        <EmptyState icon="school-outline" title="Nenhuma validação registrada" message="Os registros aparecerão aqui depois que a equipe validar decisões com a IA mentora." />
      ) : null}
      {log.data?.items.map((e) => (
        <Card key={e.id}>
          <Row>
            <Badge label={e.entry_date} tone="primary" />
            <AppText variant="bodyStrong">{e.stage}</AppText>
            {e.author ? <Badge label={e.author} /> : null}
          </Row>
          <AppText variant="caption" color="textSecondary">PROMPT</AppText>
          <AppText variant="helper" selectable>{e.prompt}</AppText>
          <AppText variant="caption" color="textSecondary">RESPOSTA</AppText>
          <AppText variant="helper" selectable>{e.response}</AppText>
          <AppText variant="caption" color="textSecondary">DECISÃO</AppText>
          <AppText variant="helper">{e.decision}</AppText>
          {e.change_made ? <AppText variant="helper">Alteração: {e.change_made}</AppText> : null}
          {e.test_executed ? <AppText variant="helper">Teste: {e.test_executed}</AppText> : null}
          {e.result_before || e.result_after ? (
            <AppText variant="helper">
              Resultado: {e.result_before ?? '—'} → {e.result_after ?? '—'}
            </AppText>
          ) : null}
        </Card>
      ))}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  half: { flexGrow: 1, flexBasis: 220 },
});

