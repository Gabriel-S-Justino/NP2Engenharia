import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Dialog, EmptyState, LoadingState, Notice, TextField } from '@/components/ui';
import { useAppState } from '@/state/AppState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';

export function ChatHistoryPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { conversations, conversationId, openConversation, newConversation, sending, historyLoading, historyError } = useAppState();
  const [search, setSearch] = useState('');
  const busy = sending || historyLoading;
  const filtered = conversations.filter((c) => c.title.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));

  return (
    <Dialog visible={visible} title="Histórico de chats" variant="sheet" onClose={onClose}>
      <AppText variant="helper" color="textSecondary">
        Conversas salvas neste navegador ou dispositivo. Abra uma delas para continuar de onde parou.
      </AppText>
      <Button label="Nova conversa" icon="add" disabled={busy} onPress={() => { newConversation(); onClose(); }} />
      <TextField label="Buscar conversa" placeholder="Busque pela primeira pergunta" value={search} onChangeText={setSearch} />
      {historyError ? <Notice tone="danger">{historyError}</Notice> : null}
      {historyLoading ? <LoadingState label="Abrindo conversa…" /> : null}
      {!filtered.length ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={search.trim() ? 'Nenhuma conversa encontrada' : 'Seu histórico começa aqui'}
          message={search.trim() ? 'Tente outro termo de busca.' : 'As conversas com respostas recebidas aparecem aqui automaticamente.'}
        />
      ) : filtered.map((conversation) => {
        const selected = conversation.id === conversationId;
        return (
          <Pressable
            key={conversation.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir conversa: ${conversation.title}`}
            accessibilityState={{ selected, disabled: busy }}
            disabled={busy}
            onPress={() => { void openConversation(conversation.id).then((opened) => { if (opened) onClose(); }); }}
            style={({ pressed }) => [
              styles.item,
              { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface, opacity: busy ? 0.6 : pressed ? 0.8 : 1 },
            ]}>
            <View style={styles.row}>
              <AppText variant="subtitle" style={styles.title} numberOfLines={2}>{conversation.title}</AppText>
              {selected ? <Badge label="Atual" tone="primary" /> : null}
            </View>
            <AppText variant="caption" color="textSecondary">{formatDateTime(conversation.updatedAt)}</AppText>
          </Pressable>
        );
      })}
      <AppText variant="caption" color="textSecondary">
        O histórico não é sincronizado entre dispositivos. Mensagens seguem o prazo de retenção do serviço.
      </AppText>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, minHeight: 72 },
  row: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  title: { flex: 1 },
});
