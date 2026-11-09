import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewInstance, type TextInputKeyPressEvent } from 'react-native';

import { ChatHistoryPanel } from '@/components/ChatHistoryPanel';
import { TrafficMark } from '@/components/TrafficIdentity';
import { AssistantMessage, FailedMessage, UserMessage } from '@/components/ChatMessage';
import { SourceReference, citationToSource } from '@/components/SourceReference';
import { AppText, Badge, Button, ConfirmDialog, Dialog, EmptyState, IconButton, LoadingState, Notice, Row, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { api } from '@/services/api';
import { useAppState } from '@/state/AppState';
import { useTheme } from '@/theme/ThemeProvider';
import { maxContentWidth, spacing } from '@/theme/tokens';
import type { ChatResponse } from '@/types/api';

const MAX_CHARS = 1000;

function EvidencePanel({ response, onOpenSource }: { response: ChatResponse; onOpenSource: (id: string) => void }) {
  return (
    <View style={styles.panelBody}>
      <AppText variant="helper" color="textSecondary">
        Pergunta: “{response.question}”
      </AppText>
      {response.citations.map((c) => (
        <SourceReference key={c.source_id} source={citationToSource(c)} onOpen={onOpenSource} />
      ))}
    </View>
  );
}

function ChatConversation() {
  const { colors } = useTheme();
  const { isDesktop } = useBreakpoint();
  const { entries, ask, retry, sending, clearConversation, historyLoading, conversations, connection, historyError, conversationId, openConversation, newConversation } = useAppState();
  const stats = useAsync(() => api.stats(), [connection]);
  const [question, setQuestion] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ChatResponse | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const latestAnswer = [...entries].reverse().find((e) => e.kind === 'answer');

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [entries.length, sending, conversationId]);

  const noDocuments = stats.data !== null && stats.data.documents_processed === 0;

  const submit = () => {
    if (sending || historyLoading || historyError) return;
    const text = question.trim();
    if (!text) {
      setInputError('Escreva uma pergunta antes de enviar.');
      return;
    }
    if (text.length > MAX_CHARS) {
      setInputError(`A pergunta deve ter no máximo ${MAX_CHARS} caracteres.`);
      return;
    }
    setInputError(null);
    setQuestion('');
    void ask(text);
  };

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    // Web: Enter envia; Shift+Enter quebra linha.
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as { shiftKey?: boolean }).shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const openSource = (id: string) => router.push({ pathname: '/fontes', params: { source: id } });
  const showSidePanel = isDesktop && latestAnswer?.kind === 'answer' && latestAnswer.response.citations.length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <View style={styles.conversationColumn}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}><TrafficMark />
            <View style={styles.flex}>
              <AppText variant="title" headingLevel={1}>
                Tire suas dúvidas
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Aprenda sobre trânsito com respostas apoiadas nos seus materiais.
              </AppText>
            </View>
            <IconButton icon="folder-open-outline" accessibilityLabel="Abrir documentos do acervo" onPress={() => router.navigate('/documentos')} />
            <IconButton icon="trash-outline" accessibilityLabel="Limpar conversa" onPress={() => setConfirmClear(true)} disabled={!entries.length || sending || historyLoading} />
          </View>

          <View style={[styles.chatActions, { borderBottomColor: colors.border }]}>
            <Button label="Histórico de chats" icon="time-outline" variant="ghost" size="sm" disabled={sending || historyLoading} onPress={() => setHistoryVisible(true)} />
            <Button label="Nova conversa" icon="add" variant="secondary" size="sm" disabled={sending || historyLoading} onPress={newConversation} />
          </View>

          <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
            <View style={styles.messagesInner}>
              {historyError ? (
                <Notice tone="danger" title="Histórico indisponível">
                  <AppText>{historyError}</AppText>
                  <Button label="Tentar carregar novamente" variant="secondary" size="sm" disabled={historyLoading || sending} onPress={() => { if (conversationId) void openConversation(conversationId); }} />
                </Notice>
              ) : null}
              {historyLoading ? <LoadingState label="Carregando histórico…" /> : null}
              {!historyLoading && !entries.length && conversations.some((c) => c.id === conversationId) && !historyError ? (
                <Notice tone="info">Esta conversa não tem mensagens disponíveis. Elas podem ter sido removidas pelo prazo de retenção do serviço.</Notice>
              ) : null}
              {!historyLoading && !entries.length && !historyError ? (
                noDocuments ? (
                  <EmptyState
                    icon="folder-open-outline"
                    title="Seu material ainda não está pronto"
                    message="Adicione documentos à biblioteca ou aguarde a preparação dos arquivos enviados."
                    action={<Button label="Ir para documentos" onPress={() => router.navigate('/documentos')} />}
                  />
                ) : (
                  <EmptyState
                    icon="chatbubbles-outline"
                    title="Qual caminho você quer entender melhor?"
                    message="Pergunte sobre regras, sinalização ou segurança. A cada resposta, você pode conferir o documento e a página de origem."
                  />
                )
              ) : null}
              {entries.map((entry) => (
                <View key={entry.id} style={styles.turn}>
                  <UserMessage text={entry.question} />
                  {entry.kind === 'pending' ? <LoadingState label="Buscando trechos e preparando a resposta…" /> : null}
                  {entry.kind === 'answer' ? (
                    <AssistantMessage response={entry.response} onOpenSource={openSource} onShowEvidence={isDesktop ? undefined : setPanel} showInlineSources={!isDesktop || entry !== latestAnswer} />
                  ) : null}
                  {entry.kind === 'error' ? <FailedMessage message={entry.message} onRetry={entry.retryable ? () => void retry(entry.id) : undefined} /> : null}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.composerInner}>
              {connection === 'offline' ? (
                <Notice tone="danger">Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.</Notice>
              ) : null}
              <Row wrap={false} style={styles.composerRow}>
                <View style={styles.flex}>
                  <TextField
                    label="Sua pergunta"
                    hideLabel
                    placeholder="Ex.: Qual é a velocidade máxima permitida em vias locais?"
                    value={question}
                    onChangeText={(t) => {
                      setQuestion(t);
                      if (inputError) setInputError(null);
                    }}
                    onKeyPress={onKeyPress}
                    multiline
                    maxLength={MAX_CHARS}
                    showCounter
                    error={inputError}
                    helper={Platform.OS === 'web' ? 'Enter envia · Shift+Enter quebra a linha' : undefined}
                    editable={!sending && !historyLoading && !historyError}
                    testID="campo-pergunta"
                  />
                </View>
                <Button label="Enviar" icon="send" onPress={submit} loading={sending} disabled={historyLoading || noDocuments || !!historyError} testID="botao-enviar" />
              </Row>
            </View>
          </View>
        </View>

        {showSidePanel && latestAnswer?.kind === 'answer' ? (
          <View style={[styles.sidePanel, { borderLeftColor: colors.border, backgroundColor: colors.surface }]} aria-label="Fontes da resposta">
            <ScrollView contentContainerStyle={styles.sidePanelContent}>
              <Row>
                <AppText variant="subtitle" headingLevel={2}>
                  De onde vem a resposta
                </AppText>
                <Badge label={`${latestAnswer.response.citations.length} trecho(s)`} tone="evidence" />
              </Row>
              <EvidencePanel response={latestAnswer.response} onOpenSource={openSource} />
            </ScrollView>
          </View>
        ) : null}
      </View>

      <ChatHistoryPanel visible={historyVisible} onClose={() => setHistoryVisible(false)} />
      <Dialog visible={panel !== null} title="Fontes da resposta" variant="sheet" onClose={() => setPanel(null)}>
        {panel ? <EvidencePanel response={panel} onOpenSource={(id) => { setPanel(null); openSource(id); }} /> : null}
      </Dialog>
      <ConfirmDialog
        visible={confirmClear}
        title="Limpar conversa?"
        message="O histórico desta conversa será apagado deste dispositivo e do servidor. Esta ação não pode ser desfeita."
        confirmLabel="Limpar conversa"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void clearConversation();
        }}
      />
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen() {
  const { conversationId } = useAppState();
  return <ChatConversation key={conversationId ?? 'loading'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  conversationColumn: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.lg, borderBottomWidth: 1 },
  chatActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderBottomWidth: 1 },
  messages: { padding: spacing.md, flexGrow: 1 },
  messagesInner: { width: '100%', maxWidth: maxContentWidth.reading, alignSelf: 'center', gap: spacing.lg },
  turn: { gap: spacing.sm },
  composer: { borderTopWidth: 1, padding: spacing.sm },
  composerInner: { width: '100%', maxWidth: maxContentWidth.reading, alignSelf: 'center', gap: spacing.xs },
  composerRow: { alignItems: 'flex-start' },
  sidePanel: { width: 360, borderLeftWidth: 1 },
  sidePanelContent: { padding: spacing.md, gap: spacing.md },
  panelBody: { gap: spacing.sm },
});
