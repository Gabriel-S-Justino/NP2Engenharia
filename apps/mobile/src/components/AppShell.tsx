import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, usePathname, type Href } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppState } from '@/state/AppState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { ConnectionBadge } from './ConnectionBadge';
import { ConversationList } from './ConversationList';
import { TrafficMark } from './TrafficIdentity';

type IconName = ComponentProps<typeof Ionicons>['name'];
type NavItem = { href: Href; path: string; label: string; icon: IconName; primary: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', path: '/', label: 'Início', icon: 'compass-outline', primary: true },
  { href: '/chat', path: '/chat', label: 'Tire suas dúvidas', icon: 'chatbubbles-outline', primary: true },
  { href: '/documentos', path: '/documentos', label: 'Biblioteca', icon: 'book-outline', primary: true },
  { href: '/fontes', path: '/fontes', label: 'Fontes', icon: 'library-outline', primary: true },
  { href: '/testes', path: '/testes', label: 'Revisão de qualidade', icon: 'clipboard-outline', primary: false },
  { href: '/mentoria', path: '/mentoria', label: 'Diário da equipe', icon: 'school-outline', primary: false },
  { href: '/configuracoes', path: '/configuracoes', label: 'Configurações', icon: 'settings-outline', primary: false },
];

export function isActive(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}

function NavigationItem({ item, active, collapsed, onPress }: { item: NavItem; active: boolean; collapsed?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Link href={item.href} asChild onPress={onPress}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        aria-current={active ? 'page' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={StyleSheet.flatten([
          styles.navItem,
          { backgroundColor: active ? colors.primarySoft : 'transparent' },
          focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle),
        ])}>
        <View style={[styles.navRow, collapsed && styles.center]}>
          <Ionicons name={item.icon} size={19} color={active ? colors.primaryStrong : colors.textSecondary} />
          {!collapsed ? <AppText style={{ fontSize: 14, color: active ? colors.primaryStrong : colors.textPrimary }}>{item.label}</AppText> : null}
        </View>
      </Pressable>
    </Link>
  );
}

function Sidebar({ collapsed = false, onToggle, onClose }: { collapsed?: boolean; onToggle?: () => void; onClose?: () => void }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { newConversation, sending, historyLoading } = useAppState();
  const [toolsOpen, setToolsOpen] = useState(false);
  const busy = sending || historyLoading;
  const startChat = () => {
    if (busy) return;
    newConversation();
    router.navigate('/chat');
    onClose?.();
  };
  const goToChat = () => { router.navigate('/chat'); onClose?.(); };
  const settings = NAV_ITEMS.find((item) => item.path === '/configuracoes')!;
  return (
    <View
      role="navigation"
      aria-label="Navegação principal"
      style={[styles.sidebar, { width: collapsed ? 72 : onClose ? '100%' : 280, backgroundColor: colors.surfaceMuted, borderRightColor: colors.border }]}>
      <View style={[styles.brand, collapsed && styles.center]}>
        {!collapsed ? (
          <>
            <TrafficMark />
            <View style={styles.flex}>
              <AppText variant="subtitle">Lumme</AppText>
              <AppText variant="caption" color="textSecondary">Escola de trânsito</AppText>
            </View>
          </>
        ) : null}
        <IconButton
          icon={onClose ? 'close-outline' : 'menu-outline'}
          accessibilityLabel={onClose ? 'Fechar menu de conversas' : collapsed ? 'Expandir menu' : 'Recolher menu'}
          onPress={onClose ?? onToggle ?? (() => undefined)}
        />
      </View>
      {collapsed ? (
        <>
          <IconButton icon="create-outline" accessibilityLabel="Nova conversa" disabled={busy} onPress={startChat} />
          <IconButton icon="search-outline" accessibilityLabel="Buscar chats" onPress={onToggle ?? (() => undefined)} />
        </>
      ) : <Button label="Nova conversa" icon="create-outline" variant="secondary" disabled={busy} onPress={startChat} />}
      <View style={styles.links}>
        {NAV_ITEMS.filter((item) => item.primary).map((item) => (
          <NavigationItem key={item.path} item={item} active={isActive(pathname, item.path)} collapsed={collapsed} onPress={onClose} />
        ))}
      </View>
      {!collapsed ? <ConversationList active={isActive(pathname, '/chat')} onOpened={goToChat} /> : <View style={styles.flex} />}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ferramentas da equipe"
          accessibilityState={{ expanded: toolsOpen && !collapsed }}
          onPress={() => { if (collapsed) { setToolsOpen(true); onToggle?.(); } else setToolsOpen(!toolsOpen); }}
          style={styles.navItem}>
          <View style={[styles.navRow, collapsed && styles.center]}>
            <Ionicons name="grid-outline" size={19} color={colors.textSecondary} />
            {!collapsed ? (
              <>
                <AppText style={[styles.flex, { fontSize: 14 }]}>Ferramentas da equipe</AppText>
                <Ionicons name={toolsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
              </>
            ) : null}
          </View>
        </Pressable>
        {toolsOpen && !collapsed ? (
          <ScrollView style={styles.tools} contentContainerStyle={styles.links}>
            {NAV_ITEMS.filter((item) => !item.primary && item.path !== '/configuracoes').map((item) => (
              <NavigationItem key={item.path} item={item} active={isActive(pathname, item.path)} onPress={onClose} />
            ))}
          </ScrollView>
        ) : null}
        <NavigationItem item={settings} active={isActive(pathname, settings.path)} collapsed={collapsed} onPress={onClose} />
        {!collapsed ? <View style={styles.connection}><ConnectionBadge /></View> : null}
      </View>
    </View>
  );
}

/** Sidebar fixa em telas amplas e painel lateral à esquerda no celular. */
export function AppShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { hasSidebar, isTablet } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const { newConversation, sending, historyLoading } = useAppState();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isCollapsed = collapsed ?? isTablet;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, flexDirection: hasSidebar ? 'row' : 'column' }]}>
      {hasSidebar ? <Sidebar collapsed={isCollapsed} onToggle={() => setCollapsed(!isCollapsed)} /> : null}
      {!hasSidebar ? (
        <View style={[styles.mobileHeader, { backgroundColor: colors.surfaceMuted, borderBottomColor: colors.border, paddingTop: insets.top }]}>
          <IconButton icon="menu-outline" accessibilityLabel="Abrir menu de conversas" onPress={() => setDrawerOpen(true)} />
          <AppText variant="subtitle" style={styles.flex}>Lumme</AppText>
          <IconButton icon="create-outline" accessibilityLabel="Nova conversa" disabled={sending || historyLoading} onPress={() => { newConversation(); router.navigate('/chat'); }} />
        </View>
      ) : null}
      <View role="main" style={[styles.flex, !hasSidebar && { paddingBottom: insets.bottom }]}>{children}</View>
      <Modal visible={drawerOpen && !hasSidebar} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fechar menu de conversas" onPress={() => setDrawerOpen(false)} />
          <View
            role="dialog"
            aria-modal
            aria-label="Menu de conversas"
            accessibilityViewIsModal
            style={[styles.drawer, { backgroundColor: colors.surfaceMuted, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  flex: { flex: 1, minHeight: 0, minWidth: 0 },
  sidebar: { height: '100%', minHeight: 0, borderRightWidth: 1, padding: spacing.sm, gap: spacing.xs },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 52, paddingBottom: spacing.xs },
  center: { justifyContent: 'center', alignItems: 'center' },
  links: { gap: 2 },
  navItem: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.sm, justifyContent: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: { borderTopWidth: 1, paddingTop: spacing.xs, gap: 2 },
  tools: { maxHeight: 96 },
  connection: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xxs },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing.xs, paddingHorizontal: spacing.xs, borderBottomWidth: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'flex-start' },
  drawer: { height: '100%', width: 280, maxWidth: '90%' },
});
