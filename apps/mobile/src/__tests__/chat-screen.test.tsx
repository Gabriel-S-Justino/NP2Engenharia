import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ChatScreen from '@/app/chat';
import { ToastProvider } from '@/components/ui';
import { api } from '@/services/api';
import { AppStateProvider } from '@/state/AppState';

import { chatResponse } from '@/test-utils/fixtures';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => false },
  usePathname: () => '/chat',
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/services/api', () => {
  const actual = jest.requireActual('@/services/api');
  return {
    ...actual,
    api: {
      health: jest.fn(),
      stats: jest.fn(),
      chat: jest.fn(),
      chatHistory: jest.fn(),
      clearChat: jest.fn(),
    },
  };
});

const mocked = api as jest.Mocked<typeof api>;

function renderChat() {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppStateProvider pollMs={0}>
        <ToastProvider>
          <ChatScreen />
        </ToastProvider>
      </AppStateProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.health.mockResolvedValue({ status: 'ok', issues: [] } as never);
  mocked.stats.mockResolvedValue({ documents_processed: 3 } as never);
  mocked.chatHistory.mockResolvedValue({ conversation_id: 'c', items: [] });
});

it('valida pergunta vazia sem chamar o backend', async () => {
  await renderChat();
  await waitFor(() => expect(screen.getByTestId('botao-enviar')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('botao-enviar'));
  expect(await screen.findByText('Escreva uma pergunta antes de enviar.')).toBeOnTheScreen();
  expect(mocked.chat).not.toHaveBeenCalled();
});

it('envia pergunta, impede envio duplicado e exibe resposta com fontes', async () => {
  let resolve: (value: ReturnType<typeof chatResponse>) => void = () => undefined;
  mocked.chat.mockImplementation(() => new Promise((r) => (resolve = r)));
  await renderChat();
  await waitFor(() => expect(screen.getByTestId('botao-enviar')).toBeEnabled());
  await fireEvent.changeText(screen.getByTestId('campo-pergunta'), 'Qual a velocidade?');
  await fireEvent.press(screen.getByTestId('botao-enviar'));
  await fireEvent.changeText(screen.getByTestId('campo-pergunta'), 'Outra pergunta');
  await fireEvent.press(screen.getByTestId('botao-enviar'));
  expect(mocked.chat).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Buscando trechos e preparando a resposta…')).toBeOnTheScreen();
  resolve(chatResponse());
  expect(await screen.findByText('EVIDÊNCIAS CITADAS (1)')).toBeOnTheScreen();
});

it('mostra erro de conexão com opção de tentar novamente', async () => {
  const { ApiError } = jest.requireActual('@/services/api');
  mocked.chat.mockRejectedValueOnce(new ApiError('Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.', 'network'));
  await renderChat();
  await waitFor(() => expect(screen.getByTestId('botao-enviar')).toBeEnabled());
  await fireEvent.changeText(screen.getByTestId('campo-pergunta'), 'Pergunta');
  await fireEvent.press(screen.getByTestId('botao-enviar'));
  expect(await screen.findByText('Não foi possível obter a resposta')).toBeOnTheScreen();
  mocked.chat.mockResolvedValueOnce(chatResponse());
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('RESPOSTA')).toBeOnTheScreen();
});

it('desabilita envio quando não há documentos indexados', async () => {
  mocked.stats.mockResolvedValue({ documents_processed: 0 } as never);
  await renderChat();
  expect(await screen.findByText('Nenhum documento indexado')).toBeOnTheScreen();
  expect(screen.getByTestId('botao-enviar')).toBeDisabled();
});
