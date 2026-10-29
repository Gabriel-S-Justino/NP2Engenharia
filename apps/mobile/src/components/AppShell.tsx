import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname, type Href } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Dialog, IconButton } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { ConnectionBadge } from './ConnectionBadge';

type IconName = ComponentProps<typeof Ionicons>['name'];
type NavItem = { href: Href; path: string; label: string; icon: IconName; primary: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', path: '/', label: 'Visão geral', icon: 'grid-outline', primary: true },
  { href: '/chat', path: '/chat', label: 'Assistente', icon: 'chatbubbles-outline', primary: true },
  { href: '/documentos', path: '/documentos', label: 'Documentos', icon: 'folder-outline', primary: true },
  { href: '/fontes', path: '/fontes', label: 'Fontes', icon: 'library-outline', primary: true },
  { href: '/testes', path: '/testes', label: 'Avaliação', icon: 'flask-outline', primary: false },
  { href: '/mentoria', path: '/mentoria', label: 'Diário da IA mentora', icon: 'school-outline', primary: false },
  { href: '/configuracoes', path: '/configuracoes', label: 'Configurações', icon: 'settings-outline', primary: false },
];

export function isActive(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}

function NavigationItem({ item, active, collapsed, onPress }: { item: NavItem; active: boolean; collapsed?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      aria-current={active ? 'page' : undefined}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.navItem,
        collapsed && styles.navItemCollapsed,
        { backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent' },
        focused && ({ outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid' } as ViewStyle),
      ]}>
      <Ionicons name={active ? (item.icon.replace('-outline', '') as IconName) : item.icon} size={20} color={active ? colors.primaryStrong : colors.textSecondary} />
      {!collapsed ? (
        <AppText variant={active ? 'bodyStrong' : 'body'} style={{ color: active ? colors.primaryStrong : colors.textPrimary }}>
          {item.label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  return (
    <View
      role="navigation"
      aria-label="Navegação principal"
      style={[styles.sidebar, { width: collapsed ? 72 : 248, backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="library" size={18} color={colors.textOnPrimary} />
        </View>
        {!collapsed ? (
          <View style={styles.flex}>
            <AppText variant="subtitle">Acervo IA</AppText>
            <AppText variant="caption" color="textSecondary">
              Leis de trânsito com fontes
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <NavigationItem key={item.path} item={item} collapsed={collapsed} active={isActive(pathname, item.path)} onPress={() => router.navigate(item.href)} />
        ))}
      </View>
      <View style={styles.sidebarFooter}>
        {!collapsed ? <ConnectionBadge /> : null}
        <IconButton icon={collapsed ? 'chevron-forward' : 'chevron-back'} accessibilityLabel={collapsed ? 'Expandir menu' : 'Recolher menu'} onPress={onToggle} />
      </View>
    </View>
  );
}

function BottomBar() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const moreActive = secondary.some((i) => isActive(pathname, i.path));
  return (
    <>
      <View
        role="navigation"
        aria-label="Navegação principal"
        style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
        {primary.map((item) => {
          const active = isActive(pathname, item.path);
          return (
            <Pressable
              key={item.path}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.navigate(item.href)}
              style={styles.bottomItem}>
              <Ionicons name={active ? (item.icon.replace('-outline', '') as IconName) : item.icon} size={22} color={active ? colors.primary : colors.textSecondary} />
              <AppText variant="caption" numberOfLines={1} style={{ color: active ? colors.primary : colors.textSecondary }}>
                {item.label === 'Visão geral' ? 'Início' : item.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Mais opções de navegação" accessibilityState={{ selected: moreActive }} onPress={() => setMoreOpen(true)} style={styles.bottomItem}>
          <Ionicons name={moreActive ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={22} color={moreActive ? colors.primary : colors.textSecondary} />
          <AppText variant="caption" style={{ color: moreActive ? colors.primary : colors.textSecondary }}>
            Mais
          </AppText>
        </Pressable>
      </View>
      <Dialog visible={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)} variant="sheet">
        <ConnectionBadge />
        {secondary.map((item) => (
          <NavigationItem
            key={item.path}
            item={item}
            active={isActive(pathname, item.path)}
            onPress={() => {
              setMoreOpen(false);
              router.navigate(item.href);
            }}
          />
        ))}
      </Dialog>
    </>
  );
}

/** Estrutura adaptativa: sidebar (tablet/desktop) ou barra inferior (celular). */
export function AppShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { hasSidebar, isTablet } = useBreakpoint();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const isCollapsed = collapsed ?? isTablet;
  return (
    <View style={[styles.root, { backgroundColor: colors.background, flexDirection: hasSidebar ? 'row' : 'column' }]}>
      {hasSidebar ? <Sidebar collapsed={isCollapsed} onToggle={() => setCollapsed(!isCollapsed)} /> : null}
      <View role="main" style={styles.flex}>
        {children}
      </View>
      {!hasSidebar ? <BottomBar /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  sidebar: { borderRightWidth: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  brandCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  logo: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  navList: { gap: spacing.xxs, flex: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  sidebarFooter: { gap: spacing.xs, alignItems: 'flex-start' },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: spacing.xxs },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
});
