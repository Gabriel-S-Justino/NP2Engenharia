import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Notice } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { ChatResponse } from '@/types/api';
import { CHAT_STATUS, EVIDENCE_STATUS, formatMs } from '@/utils/format';

import { FormattedText } from './FormattedText';
import { SourceReference, citationToSource } from './SourceReference';

export function UserMessage({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.user, { backgroundColor: colors.primarySoft }]} accessibilityLabel={`Sua pergunta: ${text}`}>
      <AppText variant="caption" color="textSecondary">
        Você perguntou
      </AppText>
      <AppText selectable>{text}</AppText>
    </View>
  );
}

/** Aviso sobre o nível de evidência. Não usa percentuais de "confiança" (não medidos). */
export function ConfidenceNotice({ response }: { response: ChatResponse }) {
  if (response.status === 'answered' && response.evidence_status === 'sufficient' && !response.notice) return null;
  const tone =
    response.status === 'answered'
      ? 'warning'
      : response.status === 'provider_error' || response.status === 'index_unavailable'
        ? 'danger'
        : response.status === 'blocked'
          ? 'warning'
          : 'info';
  return (
    <Notice tone={tone} title={response.status === 'answered' ? EVIDENCE_STATUS[response.evidence_status].label : CHAT_STATUS[response.status]}>
      {response.notice ?? 'Confira os trechos antes de concluir.'}
    </Notice>
  );
}

type AssistantProps = {
  response: ChatResponse;
  onOpenSource: (sourceId: string) => void;
  onShowEvidence?: (response: ChatResponse) => void;
  showInlineSources?: boolean;
};

/** Resposta do assistente: separa claramente a RESPOSTA GERADA das EVIDÊNCIAS RECUPERADAS. */
export function AssistantMessage({ response, onOpenSource, onShowEvidence, showInlineSources = true }: AssistantProps) {
  const { colors } = useTheme();
  const cited = response.citations.filter((c) => c.cited_in_answer);
  const others = response.citations.filter((c) => !c.cited_in_answer);
  const labels = response.citations.map((c) => c.label);
  const openLabel = (label: string) => {
    const citation = response.citations.find((c) => c.label === label);
    if (citation) onOpenSource(citation.source_id);
  };
  return (
    <View style={[styles.assistant, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`resposta-${response.interaction_id}`}>
      <View style={styles.metaRow}>
        <Badge
          label={response.generation.is_llm ? `Gerado por ${response.generation.model}` : response.generation.mode === 'demo_extractive' ? 'Modo demonstração (extrativo, sem LLM)' : 'Sem geração'}
          tone={response.generation.is_llm ? 'primary' : 'neutral'}
          icon={response.generation.is_llm ? 'sparkles-outline' : 'document-text-outline'}
        />
        {response.status === 'answered' ? (
          <Badge label={EVIDENCE_STATUS[response.evidence_status].label} tone={EVIDENCE_STATUS[response.evidence_status].tone} />
        ) : null}
        <AppText variant="caption" color="textSecondary">
          {formatMs(response.latency.total_ms)}
        </AppText>
      </View>

      <ConfidenceNotice response={response} />

      {response.answer ? (
        <View style={styles.section} accessibilityLabel="Resposta gerada">
          <AppText variant="caption" color="textSecondary" headingLevel={3}>
            RESPOSTA
          </AppText>
          <FormattedText text={response.answer} onCitationPress={openLabel} knownLabels={labels} />
          {!response.citations_valid ? (
            <Notice tone="warning" title="Citações a conferir">
              A resposta contém citações inválidas ou não apresentou fontes. Trate o conteúdo com cautela.
            </Notice>
          ) : null}
        </View>
      ) : null}

      {response.warnings.length ? (
        <View style={styles.section}>
          {response.warnings.map((w) => (
            <AppText key={w} variant="caption" color="warning">
              • {w}
            </AppText>
          ))}
        </View>
      ) : null}

      {showInlineSources && response.citations.length ? (
        <View style={[styles.section, styles.evidence, { borderTopColor: colors.border }]}>
          <AppText variant="caption" color="textSecondary" headingLevel={3}>
            {cited.length ? `EVIDÊNCIAS CITADAS (${cited.length})` : `TRECHOS RECUPERADOS (${others.length})`}
          </AppText>
          {(cited.length ? cited : others).map((c) => (
            <SourceReference key={c.source_id} source={citationToSource(c)} onOpen={onOpenSource} compact />
          ))}
          {cited.length && others.length ? (
            <AppText variant="caption" color="textSecondary">
              +{others.length} trecho(s) recuperado(s) e não citado(s).
            </AppText>
          ) : null}
        </View>
      ) : null}

      {onShowEvidence && response.retrieval ? (
        <Button label="Ver painel de evidências" icon="layers-outline" variant="ghost" size="sm" onPress={() => onShowEvidence(response)} />
      ) : null}
    </View>
  );
}

export function FailedMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice tone="danger" title="Não foi possível obter a resposta">
      <AppText variant="helper">{message}</AppText>
      {onRetry ? <Button label="Tentar novamente" icon="refresh" size="sm" variant="secondary" onPress={onRetry} /> : null}
    </Notice>
  );
}

const styles = StyleSheet.create({
  user: { alignSelf: 'flex-end', maxWidth: '90%', padding: spacing.sm, borderRadius: radius.lg, gap: 2 },
  assistant: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.xs },
  evidence: { borderTopWidth: 1, paddingTop: spacing.sm },
});
