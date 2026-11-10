import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { api } from '@/services/api';

import { AppText, Badge, Button, Notice, useToast } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { ChatResponse } from '@/types/api';
import { CHAT_STATUS, EVIDENCE_STATUS } from '@/utils/format';

import { userFacingText } from '@/utils/presentation';

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
      {userFacingText(response.notice ?? 'Confira os trechos antes de concluir.')}
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
  const toast = useToast();
  const [rating, setRating] = useState<-1 | 1 | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const submitRating = async (value: -1 | 1) => {
    if (savingRating) return;
    setSavingRating(true);
    try { await api.feedback(response.interaction_id, value); setRating(value); toast.show('Avaliação registrada.', 'success'); }
    catch { toast.show('Não foi possível registrar sua avaliação. Tente novamente.', 'danger'); }
    finally { setSavingRating(false); }
  };
  const copy = async () => {
    const text = [response.answer || response.notice || '', '', ...response.citations.map((c) => `[${c.label}] ${c.document_title || c.filename}, página ${c.page ?? 'não informada'}\n${c.excerpt}`)].join('\n');
    try { if (!await Clipboard.setStringAsync(text)) throw new Error('clipboard'); toast.show('Resposta e fontes copiadas.', 'success'); }
    catch { toast.show('Não foi possível copiar. Selecione o texto para copiar manualmente.', 'danger'); }
  };
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
          label={response.generation.is_llm ? 'Assistente IA' : response.generation.mode === 'demo_extractive' ? 'Modo demonstração (extrativo, sem LLM)' : 'Sem geração'}
          tone={response.generation.is_llm ? 'primary' : 'neutral'}
          icon={response.generation.is_llm ? 'sparkles-outline' : 'document-text-outline'}
        />
        {response.status === 'answered' ? (
          <Badge label={EVIDENCE_STATUS[response.evidence_status].label} tone={EVIDENCE_STATUS[response.evidence_status].tone} />
        ) : null}

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
              • {userFacingText(w)}
            </AppText>
          ))}
        </View>
      ) : null}

      {showInlineSources && response.citations.length ? (
        <View style={[styles.section, styles.evidence, { borderTopColor: colors.border }]}>
          <AppText variant="caption" color="textSecondary" headingLevel={3}>
            {cited.length ? `FONTES DA RESPOSTA (${cited.length})` : `CONSULTE NO MATERIAL (${others.length})`}
          </AppText>
          {(cited.length ? cited : others).map((c) => (
            <SourceReference key={c.source_id} source={citationToSource(c)} onOpen={onOpenSource} compact />
          ))}
          {cited.length && others.length ? (
            <AppText variant="caption" color="textSecondary">
              +{others.length} trecho(s) de apoio para consulta.
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Button label="Copiar resposta" icon="copy-outline" variant="ghost" size="sm" onPress={() => void copy()} />
        <Button label={rating === 1 ? 'Útil ✓' : 'Útil'} icon="thumbs-up-outline" variant="ghost" size="sm" disabled={savingRating} onPress={() => void submitRating(1)} />
        <Button label={rating === -1 ? 'Não ajudou ✓' : 'Não ajudou'} icon="thumbs-down-outline" variant="ghost" size="sm" disabled={savingRating} onPress={() => void submitRating(-1)} />
      </View>
      {onShowEvidence && response.retrieval ? (
        <Button label="Conferir fontes" icon="layers-outline" variant="ghost" size="sm" onPress={() => onShowEvidence(response)} />
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
  assistant: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.xs },
  evidence: { borderTopWidth: 1, paddingTop: spacing.sm },
});
