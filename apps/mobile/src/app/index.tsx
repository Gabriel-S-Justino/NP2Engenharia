import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConnectionBadge } from '@/components/ConnectionBadge';
import { StudyHero } from '@/components/TrafficIdentity';
import { AppText, Badge, Button, Card, EmptyState, ErrorState, Notice, PageContainer, PageHeader, Row, SectionHeader, StatCard } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';
import { useAppState } from '@/state/AppState';
import { spacing } from '@/theme/tokens';
import { formatDateTime, formatPercent } from '@/utils/format';

export default function Dashboard() {
  const { connection, health } = useAppState();
  const stats = useAsync(() => api.stats(), [connection]);
  const s = stats.data;
  const evaluation = s?.last_evaluation;

  return (
    <PageContainer>
      <PageHeader title="Seu ponto de partida" description="Aprender sobre trânsito faz parte de cuidar de todos no caminho." right={<ConnectionBadge />} />
      {connection === 'offline' ? (
        <ErrorState title="Estamos sem conexão" message="Não foi possível acessar seu acervo. Tente novamente em instantes." onRetry={() => void stats.reload()} />
      ) : null}
      {health?.issues.length ? (
        <Notice tone="warning" title="O serviço precisa de atenção">
          Algumas funções podem estar limitadas. Confira as configurações ou fale com a equipe responsável.
        </Notice>
      ) : null}
      {stats.error && connection !== 'offline' ? <ErrorState message={stats.error.message} onRetry={() => void stats.reload()} /> : null}
      <StudyHero>
        <Button label="Iniciar conversa" icon="chatbubbles-outline" variant="secondary" onPress={() => router.navigate('/chat')} disabled={!s || s.documents_processed === 0} />
        {s && s.documents_processed === 0 ? <AppText variant="caption" style={styles.heroHint}>A conversa fica disponível quando seu primeiro documento estiver pronto.</AppText> : null}
      </StudyHero>
      <View style={styles.grid}>
        <StatCard icon="book-outline" label="Materiais na biblioteca" value={s?.documents_total} loading={stats.loading && !s} />
        <StatCard icon="checkmark-circle-outline" label="Prontos para consulta" value={s?.documents_processed} hint={s && s.documents_failed ? `${s.documents_failed} precisam de atenção` : undefined} loading={stats.loading && !s} />
        <StatCard icon="chatbubble-ellipses-outline" label="Dúvidas respondidas" value={s?.questions_answered} loading={stats.loading && !s} />
      </View>
      {s && s.documents_total === 0 ? (
        <Card><EmptyState icon="book-outline" title="Sua biblioteca começa aqui" message="Envie seus materiais de trânsito e prepare um acervo para estudar e consultar sempre que precisar." action={<Button label="Abrir biblioteca de documentos" icon="folder-open-outline" onPress={() => router.navigate('/documentos')} />} /></Card>
      ) : null}
      {s?.using_fixtures_only ? <Notice tone="warning" title="Material de teste">Estes documentos são exemplos fictícios e não devem orientar decisões no trânsito.</Notice> : null}
      <View style={styles.columns}>
        <Card style={styles.column}>
          <SectionHeader title="Sua biblioteca de apoio" description="As respostas começam nos documentos que você adicionou." />
          <AppText variant="helper" color="textSecondary">Última atualização: {s?.last_indexed_at ? formatDateTime(s.last_indexed_at) : 'aguardando seu primeiro material'}.</AppText>
          <Button label="Gerenciar documentos" icon="book-outline" variant="secondary" size="sm" onPress={() => router.navigate('/documentos')} />
        </Card>
        <Card style={styles.column}>
          <SectionHeader title="Revisão da equipe" description="Um espaço para acompanhar a qualidade das respostas." />
          {evaluation ? (
            <Row>
              <Badge label={evaluation.target_met ? 'Meta de qualidade atingida' : 'Revisão necessária'} tone={evaluation.target_met ? 'success' : 'warning'} />
              <AppText variant="helper" color="textSecondary">{formatPercent(evaluation.pass_rate, true)} de aprovação na última revisão.</AppText>
            </Row>
          ) : <AppText variant="helper" color="textSecondary">A equipe ainda não registrou uma avaliação.</AppText>}
          <Button label="Abrir laboratório de avaliação" icon="clipboard-outline" variant="ghost" size="sm" onPress={() => router.navigate('/testes')} />
        </Card>
      </View>
      <AppText variant="caption" color="textSecondary" style={styles.footer}>Aprenda com as fontes. Confira o contexto. Leve o cuidado para o trânsito.</AppText>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexGrow: 1, flexBasis: 280 },
  heroHint: { color: '#CCDFD0', maxWidth: 320 },
  footer: { textAlign: 'center', paddingVertical: spacing.sm },
});
