import { parseConversations, rememberConversation } from '@/utils/conversations';
import { chatResponse } from '@/test-utils/fixtures';

it('ignora dados inválidos e duplicados do catálogo local', () => {
  expect(parseConversations('inválido')).toEqual([]);
  expect(parseConversations('{}')).toEqual([]);
  expect(parseConversations(JSON.stringify([
    { id: 'a', title: 'Primeira', updatedAt: '2026-11-09T10:00:00Z' },
    { id: 'a', title: 'Duplicada', updatedAt: '2026-11-09T11:00:00Z' },
    { id: 'b', title: 'Recente', updatedAt: '2026-11-09T12:00:00Z' },
    { id: 'c', title: 'Inválida', updatedAt: 'não é data' },
  ])).map((c) => c.title)).toEqual(['Recente', 'Primeira']);
});

it('mantém o título inicial e ordena pela última resposta', () => {
  const first = { ...chatResponse(), question: 'Primeira pergunta', created_at: '2026-11-09T10:00:00Z' };
  const second = { ...chatResponse(), question: 'Outro assunto', created_at: '2026-11-09T11:00:00Z' };
  let list = rememberConversation([], 'a', [first]);
  list = rememberConversation(list, 'b', [second]);
  list = rememberConversation(list, 'a', [{ ...second, question: 'Continuação', created_at: '2026-11-09T12:00:00Z' }]);
  expect(list.map((c) => c.id)).toEqual(['a', 'b']);
  expect(list[0].title).toBe('Primeira pergunta');
  expect(rememberConversation(list, 'vazia', [])).toEqual(list);
});
