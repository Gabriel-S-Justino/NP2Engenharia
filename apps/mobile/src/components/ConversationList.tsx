import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText, TextField } from '@/components/ui';
import { useAppState } from '@/state/AppState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { SavedConversation } from '@/utils/conversations';

function ConversationItem({ conversation, selected, disabled, onOpen }: {
  conversation: SavedConversation; selected: boolean; disabled: boolean; onOpen: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir conversa: ${conversation.title}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onOpen}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: selected || pressed ? colors.primarySoft : 'transparent', opacity: disabled ? 0.6 : 1 },
        focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle),
      ]}>
      <AppText numberOfLines={1} style={{ fontSize: 14, color: selected ? colors.primaryStrong : colors.textPrimary }}>
        {conversation.title}
      </AppText>
    </Pressable>
  );
}

/** Mesmo catálogo e mesmas ações do histórico, apresentados diretamente na navegação lateral. */
export function ConversationList({ active = true, onOpened }: { active?: boolean; onOpened?: () => void }) {
  const { conversations, conversationId, openConversation, sending, historyLoading, historyError } = useAppState();
  const [search, setSearch] = useState('');
  const busy = sending || historyLoading;
  const filtered = conversations.filter((c) => c.title.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  return (
    <View style={styles.root}>
      <TextField label="Buscar chats" hideLabel icon="search" placeholder="Buscar chats" value={search} onChangeText={setSearch} />
      <AppText variant="caption" color="textSecondary" style={styles.heading}>Seus chats</AppText>
      {historyLoading ? <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">Carregando conversas…</AppText> : null}
      {historyError ? <AppText variant="caption" color="danger" accessibilityRole="alert">{historyError}</AppText> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.items} keyboardShouldPersistTaps="handled" aria-label="Conversas salvas">
        {!filtered.length && !historyLoading ? (
          <AppText variant="caption" color="textSecondary" style={styles.empty}>
            {search.trim() ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecem aqui após a primeira resposta.'}
          </AppText>
        ) : filtered.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            selected={active && conversation.id === conversationId}
            disabled={busy}
            onOpen={() => { void openConversation(conversation.id).then((opened) => { if (opened) onOpened?.(); }); }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: spacing.xs },
  scroll: { flex: 1, minHeight: 0 },
  heading: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, fontSize: 12 },
  items: { gap: 2, padding: 2, paddingBottom: spacing.sm },
  item: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.sm, justifyContent: 'center' },
  empty: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
