import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Dialog, EmptyState, ErrorState, FilterChip, LoadingState, Notice, PageContainer, PageHeader, Row, SectionHeader, StatCard, TextField, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api, errorMessage } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { EvaluationCaseResult } from '@/types/api';
import { CATEGORY_LABEL, CHAT_STATUS, formatDateTime, formatPercent } from '@/utils/format';

const CHECK_LABELS: Record<string, string> = {
  respondeu: 'Respondeu',
  citacoes_validas: 'Citações válidas',
  fonte_esperada_citada: 'Fonte esperada citada',
  palavras_chave_na_resposta: 'Conteúdo esperado na resposta',
  fidelidade_ao_trecho_citado: 'Fiel ao trecho citado',
  recusou_ou_sinalizou_insuficiencia: 'Recusou/sinalizou insuficiência',
  sem_citacoes_inventadas: 'Sem citações inventadas',
  sem_termos_proibidos: 'Sem termos proibidos',
};

function CaseCard({ result, onAdjust }: { result: EvaluationCaseResult; onAdjust: (r: EvaluationCaseResult) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.case, { borderColor: result.passed ? colors.border : colors.danger, backgroundColor: colors.surface }]} testID={`caso-${result.case_id}`}>
      <Row>
        <Badge label={result.passed ? 'Aprovado' : 'Reprovado'} tone={result.passed ? 'success' : 'danger'} icon={result.passed ? 'checkmark' : 'close'} />
        <AppText variant="bodyStrong">{result.case_id}</AppText>
        <Badge label={CATEGORY_LABEL[result.category] ?? result.category} />
        <Badge label={CHAT_STATUS[result.status as keyof typeof CHAT_STATUS] ?? result.status} tone="info" />
      </Row>
      <AppText variant="bodyStrong">{result.question}</AppText>
      <View style={styles.compare}>
        <View style={[styles.compareCol, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="caption" color="textSecondary">
            ESPERADO ({result.expected_behavior === 'answer' ? 'responder' : 'recusar'})
          </AppText>
          <AppText variant="helper">{result.expected_answer}</AppText>
        </View>
        <View style={[styles.compareCol, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="caption" color="textSecondary">
            OBTIDO
          </AppText>
          <AppText variant="helper">{result.obtained_answer ?? '—'}</AppText>
        </View>
      </View>
      <Row gap={spacing.xxs}>
        {Object.entries(result.checks).map(([key, ok]) => (
          <Badge key={key} label={`${ok ? '✓' : '✗'} ${CHECK_LABELS[key] ?? key}`} tone={ok ? 'success' : 'danger'} />
        ))}
      </Row>
      {result.retrieved_sources.length ? (
        <AppText variant="caption" color="textSecondary">
          Fontes recuperadas:{' '}
          {result.retrieved_sources.map((s) => `${s.label} ${s.filename} p.${s.page ?? '—'} (${s.relevance.toFixed(2)}${s.cited_in_answer ? ', citada' : ''})`).join('; ')}
        </AppText>
      ) : (
        <AppText variant="caption" color="textSecondary">
          Nenhuma fonte citada.
        </AppText>
      )}
      {result.failure ? <Notice tone="danger" title="Falha identificada">{result.failure}</Notice> : null}
      {result.adjustment ? (
        <Notice tone="info" title={`Ajuste registrado (${formatDateTime(result.adjustment_at)})`}>
          {result.adjustment}
        </Notice>
      ) : null}
      {!result.passed || result.adjustment ? (
        <Button label={result.adjustment ? 'Atualizar ajuste' : 'Registrar ajuste'} size="sm" variant="secondary" icon="create-outline" onPress={() => onAdjust(result)} />
      ) : null}
    </View>
  );
}

export default function EvaluationScreen() {
  const toast = useToast();
  const overview = useAsync(() => api.evaluations(), []);
  const [suite, setSuite] = useState('fixtures');
  const [runId, setRunId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [adjusting, setAdjusting] = useState<EvaluationCaseResult | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useAsync(() => api.evaluationResults(runId ?? undefined, runId ? undefined : suite), [runId, suite]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const suiteInfo = overview.data?.suites.find((s) => s.id === suite);

  /** Acompanha a execução em segundo plano até o backend informar conclusão ou falha. */
  const waitForCompletion = async (attempt = 0): Promise<void> => {
    try {
      const ov = await api.evaluations();
      const current = ov.current;
      if (current && current.status === 'running' && attempt < 400) {
        timer.current = setTimeout(() => void waitForCompletion(attempt + 1), 1500);
        return;
      }
      setRunning(false);
      overview.setData(ov);
      if (current?.status === 'completed' && current.run_id) {
        toast.show('Avaliação concluída.', 'success');
        setRunId(current.run_id);
      } else if (current?.status === 'failed') {
        toast.show(current.error ?? 'A avaliação falhou.', 'danger');
      }
    } catch (err) {
      setRunning(false);
      toast.show(errorMessage(err), 'danger');
    }
  };

  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      await api.runEvaluation(suite);
      await waitForCompletion();
    } catch (err) {
      setRunning(false);
      toast.show(errorMessage(err), 'danger');
    }
  };

  const saveAdjustment = async () => {
    if (!adjusting || !results.data) return;
    if (adjustText.trim().length < 3) {
      setAdjustError('Descreva o ajuste aplicado (mínimo de 3 caracteres).');
      return;
    }
    setSavingAdjust(true);
    try {
      await api.registerAdjustment(results.data.summary.run_id, adjusting.case_id, adjustText.trim());
      toast.show('Ajuste registrado.', 'success');
      setAdjusting(null);
      void results.reload();
    } catch (err) {
      setAdjustError(errorMessage(err));
    } finally {
      setSavingAdjust(false);
    }
  };

  const summary = results.data?.summary;
  const list = (results.data?.results ?? []).filter((r) => filter === 'all' || !r.passed);
  const notEvaluated = results.error?.status === 404;

  return (
    <PageContainer>
      <PageHeader
        title="Laboratório de avaliação"
        description="Matriz de testes do RAG: 6 perguntas com informação presente, 2 ausentes e 2 fora do escopo/adversariais. Meta: 80% de comportamentos adequados."
        right={<Button label={running ? 'Executando…' : 'Executar testes'} icon="play" onPress={() => void run()} loading={running} disabled={!suiteInfo?.ready} testID="botao-executar-testes" />}
      />

      {overview.error ? <ErrorState message={overview.error.message} onRetry={() => void overview.reload()} /> : null}
      <Row gap={spacing.xs}>
        {overview.data?.suites.map((s) => (
          <FilterChip key={s.id} label={`${s.synthetic ? 'Sintética' : 'Acervo real'}: ${s.id}${s.ready ? '' : ' (não pronta)'}`} selected={suite === s.id} onPress={() => { setSuite(s.id); setRunId(null); }} />
        ))}
      </Row>
      {suiteInfo ? (
        <Notice tone={suiteInfo.synthetic ? 'warning' : suiteInfo.ready ? 'info' : 'danger'} title={suiteInfo.title}>
          <AppText variant="helper">{suiteInfo.description}</AppText>
        </Notice>
      ) : null}

      {results.loading && !results.data ? <LoadingState label="Carregando resultados…" /> : null}
      {notEvaluated ? (
        <EmptyState icon="flask-outline" title="Ainda não avaliado" message="Execute os testes para conhecer o desempenho atual do sistema." />
      ) : results.error ? (
        <ErrorState message={results.error.message} onRetry={() => void results.reload()} />
      ) : null}

      {summary ? (
        <>
          <View style={styles.grid}>
            <StatCard icon="speedometer-outline" label="Taxa de aprovação" value={formatPercent(summary.pass_rate, true)} hint={summary.target_met ? 'Meta de 80% atingida' : 'Abaixo da meta de 80%'} />
            <StatCard icon="list-outline" label="Testes executados" value={summary.executed} hint={`${summary.passed} aprovados · ${summary.failed} reprovados`} />
            <StatCard icon="time-outline" label="Última execução" value={formatDateTime(summary.finished_at)} hint={`Suíte “${summary.suite}”`} />
          </View>
          <Card>
            <SectionHeader title="Resultado por categoria" />
            {Object.entries(summary.by_category).map(([key, c]) => (
              <Row key={key}>
                <AppText variant="helper" style={styles.catLabel}>
                  {c.label}
                </AppText>
                <Badge label={`${c.passed}/${c.executed} · ${formatPercent(c.pass_rate, true)}`} tone={c.passed === c.executed ? 'success' : 'warning'} />
              </Row>
            ))}
            <SectionHeader title="Métricas de recuperação" description="Medem a busca, não a qualidade da resposta." />
            {Object.entries(summary.retrieval_metrics).map(([k, v]) => (
              <AppText key={k} variant="helper">
                {k}: {v === null ? '—' : String(v).replace('.', ',')}
              </AppText>
            ))}
            <AppText variant="caption" color="textSecondary">
              Parâmetros: top-k {String(summary.params.top_k)} · limiar {String(summary.params.similarity_threshold)} · chunk {String(summary.params.chunk_size)}/
              {String(summary.params.chunk_overlap)} · embeddings {String(summary.params.embedding)}
            </AppText>
          </Card>
          <Row gap={spacing.xs}>
            <FilterChip label="Todos os casos" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label={`Somente falhas (${summary.failed})`} selected={filter === 'failed'} onPress={() => setFilter('failed')} />
          </Row>
          <View style={styles.list}>
            {list.map((r) => (
              <CaseCard key={r.case_id} result={r} onAdjust={(res) => { setAdjusting(res); setAdjustText(res.adjustment ?? ''); setAdjustError(null); }} />
            ))}
            {!list.length ? <AppText color="textSecondary">Nenhum caso nesta visualização.</AppText> : null}
          </View>
        </>
      ) : null}

      {overview.data?.runs.length ? (
        <Card>
          <SectionHeader title="Histórico de execuções" />
          {overview.data.runs.map((r) => (
            <Row key={r.id}>
              <Button label={r.id} variant="ghost" size="sm" onPress={() => { setSuite(r.suite); setRunId(r.id); }} />
              <AppText variant="caption" color="textSecondary">
                {r.suite} · {formatDateTime(r.started_at)} · {r.status}
                {r.summary?.pass_rate !== undefined && r.summary?.pass_rate !== null ? ` · ${formatPercent(r.summary.pass_rate, true)}` : ''}
              </AppText>
            </Row>
          ))}
        </Card>
      ) : null}

      <Dialog
        visible={adjusting !== null}
        title={`Ajuste após a falha — ${adjusting?.case_id ?? ''}`}
        onClose={() => setAdjusting(null)}
        footer={
          <>
            <Button label="Cancelar" variant="secondary" onPress={() => setAdjusting(null)} />
            <Button label="Salvar ajuste" onPress={() => void saveAdjustment()} loading={savingAdjust} />
          </>
        }>
        <AppText variant="helper" color="textSecondary">
          Descreva a causa identificada e o ajuste aplicado. Depois, execute os testes novamente para registrar o novo resultado.
        </AppText>
        <TextField label="Causa e ajuste aplicado" multiline value={adjustText} onChangeText={setAdjustText} maxLength={4000} showCounter error={adjustError} />
      </Dialog>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  list: { gap: spacing.sm },
  catLabel: { minWidth: 200 },
  case: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  compare: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  compareCol: { flexGrow: 1, flexBasis: 260, padding: spacing.sm, borderRadius: radius.md, gap: 2 },
});
