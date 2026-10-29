import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConnectionBadge } from '@/components/ConnectionBadge';
import { AppText, Badge, Button, Card, EmptyState, ErrorState, Notice, PageContainer, PageHeader, Row, SectionHeader, StatCard } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';
import { useAppState } from '@/state/AppState';
import { spacing } from '@/theme/tokens';
import { formatDateTime, formatMs, formatPercent } from '@/utils/format';

export default function Dashboard() {
  const { connection, health } = useAppState();
  const stats = useAsync(() => api.stats(), [connection]);
  const s = stats.data;
  const evaluation = s?.last_evaluation;

  return (
    <PageContainer>
      <PageHeader
        title="Visão geral"
        description="Consulte leis de trânsito com respostas baseadas em documentos e fontes verificáveis."
        right={<ConnectionBadge />}
      />

      {connection === 'offline' ? (
        <ErrorState
          title="Backend indisponível"
          message="Não foi possível conectar ao serviço. Verifique se o backend está em execução e o endereço configurado em Configurações."
          onRetry={() => void stats.reload()}
        />
      ) : null}

      {health?.issues.length ? (
        <Notice tone="warning" title="Alertas do sistema">
          {health.issues.map((issue) => (
            <AppText key={issue} variant="helper">
              • {issue}
            </AppText>
          ))}
        </Notice>
      ) : null}

      {stats.error && connection !== 'offline' ? <ErrorState message={stats.error.message} onRetry={() => void stats.reload()} /> : null}

      <View style={styles.grid}>
        <StatCard icon="documents-outline" label="Documentos cadastrados" value={s?.documents_total} loading={stats.loading && !s} />
        <StatCard
          icon="checkmark-done-outline"
          label="Documentos processados"
          value={s?.documents_processed}
          hint={s && s.documents_failed ? `${s.documents_failed} com falha` : undefined}
          loading={stats.loading && !s}
        />
        <StatCard icon="layers-outline" label="Trechos indexados" value={s?.chunks_indexed} loading={stats.loading && !s} />
        <StatCard
          icon="chatbubble-ellipses-outline"
          label="Perguntas respondidas"
          value={s?.questions_answered}
          hint={s ? `${s.questions_total} perguntas · ${s.refusals} recusas seguras` : undefined}
          loading={stats.loading && !s}
        />
      </View>

      {s && s.documents_total === 0 ? (
        <Card>
          <EmptyState
            title="Seu acervo ainda está vazio"
            message="Adicione documentos para começar a consultar suas fontes. Coloque PDFs ou TXT na pasta Documentos/ e indexe, ou envie arquivos pela biblioteca."
            action={<Button label="Abrir biblioteca de documentos" icon="folder-open-outline" onPress={() => router.navigate('/documentos')} />}
          />
        </Card>
      ) : null}

      {s?.using_fixtures_only ? (
        <Notice tone="warning" title="Somente material sintético">
          O acervo contém apenas documentos sintéticos de teste. Eles não são fontes reais sobre leis de trânsito.
        </Notice>
      ) : null}

      <View style={styles.columns}>
        <Card style={styles.column}>
          <SectionHeader title="Consultar o acervo" description="Faça perguntas e confira os trechos que sustentam cada resposta." />
          <Button label="Iniciar conversa" icon="chatbubbles-outline" onPress={() => router.navigate('/chat')} disabled={!s || s.documents_processed === 0} />
          {s && s.documents_processed === 0 ? (
            <AppText variant="caption" color="textSecondary">
              Disponível após a indexação de ao menos um documento.
            </AppText>
          ) : null}
        </Card>

        <Card style={styles.column}>
          <SectionHeader title="Base documental" />
          <AppText variant="helper">Última indexação: {s?.last_indexed_at ? formatDateTime(s.last_indexed_at) : 'ainda não realizada'}</AppText>
          <AppText variant="helper">Taxa de sucesso da ingestão: {formatPercent(s?.ingestion_success_rate)}</AppText>
          <AppText variant="helper">
            Embeddings: {health ? `${health.embeddings.provider} · ${health.embeddings.semantic ? 'semântico' : 'lexical (não semântico)'}` : '—'}
          </AppText>
          <AppText variant="helper">
            Geração: {health ? (health.llm.is_llm ? `LLM ${health.llm.model}` : 'modo demonstração (extrativo, sem LLM)') : '—'}
          </AppText>
          <Button label="Gerenciar documentos" variant="secondary" size="sm" onPress={() => router.navigate('/documentos')} />
        </Card>

        <Card style={styles.column}>
          <SectionHeader title="Avaliação do sistema" />
          {evaluation ? (
            <>
              <Row>
                <AppText variant="title">{formatPercent(evaluation.pass_rate, true)}</AppText>
                <Badge label={evaluation.target_met ? 'Meta de 80% atingida' : 'Abaixo da meta de 80%'} tone={evaluation.target_met ? 'success' : 'danger'} />
              </Row>
              <AppText variant="helper" color="textSecondary">
                {evaluation.passed} de {evaluation.executed} testes aprovados · suíte “{evaluation.suite}” · {formatDateTime(evaluation.finished_at)}
              </AppText>
            </>
          ) : (
            <AppText variant="helper" color="textSecondary">
              Ainda não avaliado. Execute os testes para conhecer o desempenho atual do sistema.
            </AppText>
          )}
          <Button label="Abrir laboratório de avaliação" variant="secondary" size="sm" onPress={() => router.navigate('/testes')} />
        </Card>
      </View>

      {s && s.questions_total > 0 ? (
        <Card>
          <SectionHeader title="Métricas de uso (dados reais)" />
          <Row gap={spacing.lg}>
            <AppText variant="helper">Recuperação média: {formatMs(s.avg_retrieval_ms)}</AppText>
            <AppText variant="helper">Geração média: {formatMs(s.avg_generation_ms)}</AppText>
            <AppText variant="helper">Tempo total médio: {formatMs(s.avg_total_ms)}</AppText>
            <AppText variant="helper">Fontes por resposta: {s.avg_sources_per_answer?.toFixed(1).replace('.', ',') ?? '—'}</AppText>
            <AppText variant="helper">Respostas com citações válidas: {formatPercent(s.citation_valid_rate)}</AppText>
          </Row>
        </Card>
      ) : null}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexGrow: 1, flexBasis: 280 },
});
