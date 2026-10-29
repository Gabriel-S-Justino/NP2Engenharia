import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { useToneColors } from './Badge';
import { IconButton } from './Button';

type ToastTone = 'success' | 'danger' | 'info' | 'warning';
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void }>({ show: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const c = useToneColors(item.tone);
  const icon = item.tone === 'success' ? 'checkmark-circle' : item.tone === 'danger' ? 'alert-circle' : item.tone === 'warning' ? 'warning' : 'information-circle';
  return (
    <View style={[styles.toast, elevation.medium, { backgroundColor: c.bg, borderColor: c.fg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={20} color={c.fg} />
      <AppText variant="helper" style={styles.message}>
        {item.message}
      </AppText>
      <IconButton icon="close" accessibilityLabel="Dispensar aviso" onPress={onClose} />
    </View>
  );
}

/** Feedback após operações (sucesso/erro), anunciado a leitores de tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      counter.current += 1;
      const id = counter.current;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'danger' ? 8000 : 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.container, { bottom: insets.bottom + 80 }]}>
        {items.map((item) => (
          <ToastView key={item.id} item={item} onClose={() => dismiss(item.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', gap: spacing.xs },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 560,
    width: '100%',
  },
  message: { flex: 1, paddingVertical: spacing.xs },
});
