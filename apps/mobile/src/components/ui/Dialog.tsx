import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button, IconButton } from './Button';

type DialogProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 'sheet': painel inferior no celular / lateral no desktop (usado para evidências). */
  variant?: 'dialog' | 'sheet';
};

/** Diálogo modal acessível. Fecha com o botão, com Esc (web) ou tocando fora. */
export function Dialog({ visible, title, onClose, children, footer, variant = 'dialog' }: DialogProps) {
  const { colors } = useTheme();
  const { isCompact } = useBreakpoint();
  const asSheet = variant === 'sheet';
  const position = asSheet ? (isCompact ? styles.bottom : styles.side) : styles.centered;
  return (
    <Modal visible={visible} transparent animationType={asSheet && isCompact ? 'slide' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, position]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          role="dialog"
          aria-modal
          aria-label={title}
          style={[
            styles.panel,
            elevation.medium,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            asSheet ? (isCompact ? styles.panelBottom : styles.panelSide) : styles.panelCentered,
          ]}>
          <View style={styles.header}>
            <AppText variant="subtitle" headingLevel={2} style={styles.title}>
              {title}
            </AppText>
            <IconButton icon="close" accessibilityLabel="Fechar" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação obrigatória antes de operações destrutivas ou que exigem reindexação. */
export function ConfirmDialog({ visible, title, message, confirmLabel, destructive, loading, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={loading} />
          <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} />
        </>
      }>
      <AppText>{message}</AppText>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  bottom: { justifyContent: 'flex-end' },
  side: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  panel: { borderWidth: 1, overflow: 'hidden' },
  panelCentered: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: radius.lg },
  panelBottom: { width: '100%', maxHeight: '85%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  panelSide: { width: 480, maxWidth: '100%', height: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, paddingRight: spacing.xs, paddingTop: spacing.xs, gap: spacing.xs },
  title: { flex: 1 },
  body: { padding: spacing.md, gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, flexWrap: 'wrap' },
});
