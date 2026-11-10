import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText, Button, Dialog, IconButton, Notice, TextField, useToast } from '@/components/ui';
import { api } from '@/services/api';
import { useAppState } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { SavedConversation } from '@/utils/conversations';
import { downloadChat } from '@/utils/exportChat';

function ConversationItem({ conversation, selected, disabled, onOpen, onOptions }: {
  conversation: SavedConversation; selected: boolean; disabled: boolean; onOpen: () => void; onOptions: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.row, { backgroundColor: selected ? colors.primarySoft : 'transparent', borderRadius: radius.sm }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir conversa: ${conversation.title}`}
        accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onOpen}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => [styles.item, { opacity: disabled ? 0.6 : pressed ? 0.8 : 1 },
          focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle)]}>
        <AppText numberOfLines={1} style={{ fontSize: 14, color: selected ? colors.primaryStrong : colors.textPrimary }}>{conversation.title}</AppText>
      </Pressable>
      <IconButton icon="ellipsis-horizontal" accessibilityLabel={`Opções da conversa: ${conversation.title}`} disabled={disabled} onPress={onOptions} />
    </View>
  );
}

export function ConversationList({ active = true, onOpened }: { active?: boolean; onOpened?: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const { conversations, conversationId, openConversation, sending, historyLoading, historyError,
    renameConversation, deleteConversation, refreshConversations } = useAppState();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SavedConversation | null>(null);
  const [mode, setMode] = useState<'menu' | 'rename' | 'delete'>('menu');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = sending || historyLoading || authLoading;
  const filtered = conversations.filter((c) => c.title.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  const close = () => { if (!saving) setSelected(null); };
  const act = async () => {
    if (!selected || saving) return;
    if (mode === 'rename' && !title.trim()) { setError('Informe um título.'); return; }
    setSaving(true); setError(null);
    try {
      if (mode === 'delete') await deleteConversation(selected.id);
      else await renameConversation(selected.id, title);
      setSelected(null);
      toast.show(mode === 'delete' ? 'Conversa excluída.' : 'Título atualizado.', 'success');
    } catch { setError('Não foi possível concluir. A conversa foi mantida. Tente novamente.'); }
    finally { setSaving(false); }
  };
  return (
    <View style={styles.root}>
      {!user && !authLoading ? <AppText variant="caption" color="textSecondary">Entre na sua conta para acessar o histórico.</AppText> : null}
      <TextField label="Buscar chats" hideLabel icon="search" placeholder="Buscar chats" value={search} onChangeText={setSearch} editable={!!user} />
      <AppText variant="caption" color="textSecondary" style={styles.heading}>Seus chats</AppText>
      {historyLoading || authLoading ? <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">Carregando conversas…</AppText> : null}
      {historyError && user ? <><AppText variant="caption" color="danger">{historyError}</AppText><Button label="Atualizar chats" size="sm" variant="ghost" onPress={() => void refreshConversations().catch(() => toast.show('O histórico está indisponível.', 'danger'))} /></> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.items} keyboardShouldPersistTaps="handled" aria-label="Conversas salvas">
        {!filtered.length && !busy && user ? <AppText variant="caption" color="textSecondary" style={styles.empty}>{search.trim() ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecem aqui após a primeira resposta.'}</AppText> : null}
        {filtered.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} selected={active && conversation.id === conversationId}
          disabled={busy || saving}
          onOpen={() => { void openConversation(conversation.id).then((opened) => { if (opened) onOpened?.(); }); }}
          onOptions={() => { setSelected(conversation); setTitle(conversation.title); setMode('menu'); setError(null); }} />)}
      </ScrollView>
      <Dialog visible={selected !== null} title={mode === 'delete' ? 'Excluir conversa?' : mode === 'rename' ? 'Renomear conversa' : 'Opções da conversa'} onClose={close}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {mode === 'menu' ? (
          <>
            <AppText variant="subtitle">{selected?.title}</AppText>
            <Button label="Renomear" icon="pencil-outline" variant="secondary" disabled={saving || busy} onPress={() => setMode('rename')} />
            <Button label="Exportar conversa" icon="download-outline" variant="secondary" loading={saving} disabled={busy} onPress={() => {
              if (!selected || saving) return;
              setSaving(true); setError(null);
              void api.exportConversation(selected.id).then((file) => downloadChat(file.filename, file.content))
                .then(() => { setSelected(null); toast.show('Conversa exportada.', 'success'); })
                .catch(() => setError('Não foi possível exportar a conversa. Tente novamente.')).finally(() => setSaving(false));
            }} />
            <Button label="Excluir" icon="trash-outline" variant="danger" disabled={saving || busy} onPress={() => setMode('delete')} />
          </>
        ) : (
          <>
            {mode === 'rename' ? <TextField label="Título da conversa" value={title} onChangeText={setTitle} maxLength={100} editable={!saving} /> :
              <AppText>Esta conversa e suas mensagens serão excluídas da sua conta em todos os dispositivos. Esta ação não pode ser desfeita.</AppText>}
            <Button label={mode === 'delete' ? 'Confirmar exclusão' : 'Salvar título'} variant={mode === 'delete' ? 'danger' : 'primary'} loading={saving} disabled={busy} onPress={() => void act()} />
            <Button label="Cancelar" variant="ghost" disabled={saving} onPress={close} />
          </>
        )}
      </Dialog>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: spacing.xs },
  scroll: { flex: 1, minHeight: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  heading: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, fontSize: 12 },
  items: { gap: 2, padding: 2, paddingBottom: spacing.sm },
  item: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.sm, justifyContent: 'center' },
  empty: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
