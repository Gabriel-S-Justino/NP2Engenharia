import { validateMentorEntry, validateRetrievalForm } from '@/utils/validation';

it('exige campos obrigatórios do diário da IA mentora', () => {
  const errors = validateMentorEntry({ entry_date: '29/10/2026', stage: '', prompt: 'x', response: '', decision: '' });
  expect(errors.entry_date).toMatch(/AAAA-MM-DD/);
  expect(errors.stage).toBeDefined();
  expect(errors.prompt).toBeDefined();
  expect(errors.response).toBeDefined();
  expect(errors.decision).toBeDefined();
  expect(
    validateMentorEntry({ entry_date: '2026-10-29', stage: 'Chunking', prompt: 'Avalie os chunks', response: 'Resposta real', decision: 'Manter' }),
  ).toEqual({});
});

it('valida parâmetros de recuperação antes de enviar', () => {
  expect(validateRetrievalForm({ top_k: '0', similarity_threshold: '2', chunk_size: '100', chunk_overlap: '-1' })).toEqual({
    top_k: expect.any(String),
    similarity_threshold: expect.any(String),
    chunk_size: expect.any(String),
    chunk_overlap: expect.any(String),
  });
  expect(validateRetrievalForm({ top_k: '5', similarity_threshold: '0,35', chunk_size: '800', chunk_overlap: '800' }).chunk_overlap).toMatch(/menor/);
  expect(validateRetrievalForm({ top_k: '5', similarity_threshold: '0.35', chunk_size: '800', chunk_overlap: '120' })).toEqual({});
});
