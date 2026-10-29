import { fireEvent, render, screen } from '@testing-library/react-native';

import { AssistantMessage } from '@/components/ChatMessage';
import { FormattedText } from '@/components/FormattedText';
import { SourceReference, citationToSource } from '@/components/SourceReference';
import { Button, EmptyState, ErrorState, StatCard } from '@/components/ui';
import { breakpointFor } from '@/hooks/useBreakpoint';

import { chatResponse, citation } from '@/test-utils/fixtures';

describe('SourceReference', () => {
  it('mostra documento, página, trecho e abre detalhes', async () => {
    const onOpen = jest.fn();
    await render(<SourceReference source={citationToSource(citation())} onOpen={onOpen} />);
    expect(screen.getByText('Documento de teste')).toBeOnTheScreen();
    expect(screen.getByText(/p\. 2/)).toBeOnTheScreen();
    expect(screen.getByText(/25 km\/h/)).toBeOnTheScreen();
    expect(screen.getByText('Similaridade 0,52')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(/Abrir detalhes de Fonte F1/));
    expect(onOpen).toHaveBeenCalledWith('doc_teste-c0001');
  });

  it('não inventa página ausente e sinaliza trecho suspeito', async () => {
    await render(<SourceReference source={citationToSource(citation({ page: null, suspicious: true }))} />);
    expect(screen.getByText(/Página não informada/)).toBeOnTheScreen();
    expect(screen.getByText(/formato de instrução/)).toBeOnTheScreen();
  });

  it('indica fonte indisponível sem ação de abrir', async () => {
    const onOpen = jest.fn();
    await render(<SourceReference source={{ ...citationToSource(citation()), unavailable: true }} onOpen={onOpen} />);
    expect(screen.getByText('Fonte indisponível')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Abrir detalhes/)).toBeNull();
  });
});

describe('AssistantMessage', () => {
  it('separa resposta gerada das evidências e identifica o modo demonstração', async () => {
    await render(<AssistantMessage response={chatResponse()} onOpenSource={jest.fn()} />);
    expect(screen.getByText('RESPOSTA')).toBeOnTheScreen();
    expect(screen.getByText('EVIDÊNCIAS CITADAS (1)')).toBeOnTheScreen();
    expect(screen.getByText('Modo demonstração (extrativo, sem LLM)')).toBeOnTheScreen();
  });

  it('exibe insuficiência de evidências sem resposta factual nem citações', async () => {
    const response = chatResponse({
      status: 'insufficient_evidence',
      evidence_status: 'insufficient',
      answer: null,
      citations: [],
      notice: 'Não encontrei evidências suficientes nos documentos disponíveis para responder com segurança.',
    });
    await render(<AssistantMessage response={response} onOpenSource={jest.fn()} />);
    expect(screen.queryByText('RESPOSTA')).toBeNull();
    expect(screen.getByText(/Não encontrei evidências suficientes/)).toBeOnTheScreen();
    expect(screen.getByText('Evidências insuficientes')).toBeOnTheScreen();
  });

  it('alerta quando as citações não são válidas', async () => {
    await render(<AssistantMessage response={chatResponse({ citations_valid: false })} onOpenSource={jest.fn()} />);
    expect(screen.getByText('Citações a conferir')).toBeOnTheScreen();
  });

  it('indica falha do provedor de IA', async () => {
    const response = chatResponse({ status: 'provider_error', evidence_status: 'none', answer: null, notice: 'O provedor de IA está indisponível.' });
    await render(<AssistantMessage response={response} onOpenSource={jest.fn()} />);
    expect(screen.getByText('Provedor de IA indisponível')).toBeOnTheScreen();
  });
});

it('FormattedText torna citações [F1] acionáveis', async () => {
  const onPress = jest.fn();
  await render(<FormattedText text={'- Item com fonte [F1]\n- **negrito**'} onCitationPress={onPress} knownLabels={['F1']} />);
  await fireEvent.press(screen.getByLabelText('Fonte F1'));
  expect(onPress).toHaveBeenCalledWith('F1');
  expect(screen.getByText('negrito')).toBeOnTheScreen();
});

it('estados vazio e de erro exibem mensagem e ação', async () => {
  const retry = jest.fn();
  await render(<ErrorState message="Falhou" onRetry={retry} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalled();
  await render(<EmptyState title="Seu acervo ainda está vazio" message="Adicione documentos." />);
  expect(screen.getByText('Seu acervo ainda está vazio')).toBeOnTheScreen();
});

it('StatCard mostra indisponível em vez de inventar valor', async () => {
  await render(<StatCard icon="layers-outline" label="Trechos indexados" value={null} />);
  expect(screen.getByLabelText('Trechos indexados: indisponível')).toBeOnTheScreen();
});

it('Button desabilitado não dispara ação', async () => {
  const onPress = jest.fn();
  await render(<Button label="Enviar" onPress={onPress} disabled />);
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
});

it('breakpoints documentados', () => {
  expect(breakpointFor(360)).toBe('mobileNarrow');
  expect(breakpointFor(420)).toBe('mobileWide');
  expect(breakpointFor(800)).toBe('tablet');
  expect(breakpointFor(1280)).toBe('desktop');
});
