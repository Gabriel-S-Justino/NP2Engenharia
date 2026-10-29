import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '@/components/AppShell';
import { ToastProvider } from '@/components/ui';
import { AppStateProvider } from '@/state/AppState';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function Themed() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppShell>
        <Slot />
      </AppShell>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStateProvider>
          <ToastProvider>
            <Themed />
          </ToastProvider>
        </AppStateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
