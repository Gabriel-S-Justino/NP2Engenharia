import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';

import { AppShell } from '@/components/AppShell';
import { ConversationList } from '@/components/ConversationList';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppState } from '@/state/AppState';

jest.mock('expo-router', () => {
  return {
    usePathname: () => '/chat',
    router: { navigate: jest.fn() },
    Link: ({ children }: { children: ReactNode }) => children,
  };
});
jest.mock('@/hooks/useBreakpoint', () => ({ useBreakpoint: jest.fn() }));
jest.mock('@/state/AppState', () => ({ useAppState: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

function state() {
  return {
    conversations: [
      { id: 'c1', title: 'Como funciona a preferência?', updatedAt: '2026-11-09T12:00:00Z' },
      { id: 'c2', title: 'O que significa esta placa?', updatedAt: '2026-11-08T12:00:00Z' },
    ],
    conversationId: 'c1', sending: false, historyLoading: false, historyError: null,
    newConversation: jest.fn(), openConversation: jest.fn().mockResolvedValue(true), connection: 'online',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBreakpoint).mockReturnValue({ hasSidebar: true, isTablet: false, isCompact: false, isDesktop: true } as ReturnType<typeof useBreakpoint>);
  jest.mocked(useAppState).mockReturnValue(state() as unknown as ReturnType<typeof useAppState>);
});

it('mostra os chats diretamente na sidebar, sem abrir um modal', async () => {
  await render(<AppShell><Text>Conteúdo</Text></AppShell>);
  expect(screen.getByRole('button', { name: 'Abrir conversa: Como funciona a preferência?' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Abrir conversa: Como funciona a preferência?' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByLabelText('Buscar chats')).toBeOnTheScreen();
});

it('busca pelo título e abre o chat escolhido', async () => {
  const onOpened = jest.fn();
  const open = jest.mocked(useAppState)().openConversation;
  await render(<ConversationList onOpened={onOpened} />);
  await fireEvent.changeText(screen.getByLabelText('Buscar chats'), 'placa');
  expect(screen.queryByRole('button', { name: /Como funciona/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir conversa: O que significa esta placa?' }));
  await waitFor(() => expect(onOpened).toHaveBeenCalled());
  expect(open).toHaveBeenCalledWith('c2');
});

it('nova conversa e retomada abrem a tela de chat sem apagar o histórico', async () => {
  const appState = jest.mocked(useAppState)();
  await render(<AppShell><Text>Conteúdo</Text></AppShell>);
  await fireEvent.press(screen.getByRole('button', { name: 'Nova conversa' }));
  expect(appState.newConversation).toHaveBeenCalledTimes(1);
  expect(router.navigate).toHaveBeenCalledWith('/chat');
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir conversa: O que significa esta placa?' }));
  await waitFor(() => expect(appState.openConversation).toHaveBeenCalledWith('c2'));
});

it('impede troca de conversa enquanto a resposta está chegando', async () => {
  jest.mocked(useAppState).mockReturnValue({ ...state(), sending: true } as unknown as ReturnType<typeof useAppState>);
  await render(<AppShell><Text>Conteúdo</Text></AppShell>);
  expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Abrir conversa: Como funciona a preferência?' })).toBeDisabled();
});

it('no celular abre o mesmo histórico em um menu lateral e fecha após selecionar', async () => {
  jest.mocked(useBreakpoint).mockReturnValue({ hasSidebar: false, isTablet: false, isCompact: true, isDesktop: false } as ReturnType<typeof useBreakpoint>);
  await render(<AppShell><Text>Conteúdo</Text></AppShell>);
  expect(screen.queryByRole('button', { name: /Abrir conversa:/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir menu de conversas' }));
  expect(screen.getByRole('dialog', { name: 'Menu de conversas' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir conversa: O que significa esta placa?' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('menu recolhido expande para mostrar a busca e os chats', async () => {
  await render(<AppShell><Text>Conteúdo</Text></AppShell>);
  await fireEvent.press(screen.getByRole('button', { name: 'Recolher menu' }));
  expect(screen.queryByRole('button', { name: /Abrir conversa:/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Buscar chats' }));
  expect(screen.getByRole('button', { name: 'Abrir conversa: Como funciona a preferência?' })).toBeOnTheScreen();
});
