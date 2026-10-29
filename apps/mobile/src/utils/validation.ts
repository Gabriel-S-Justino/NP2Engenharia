/** Validação de formulários no cliente (o backend valida novamente). */
import type { MentorEntryIn } from '@/types/api';

const REQUIRED: (keyof MentorEntryIn)[] = ['entry_date', 'stage', 'prompt', 'response', 'decision'];

export function validateMentorEntry(entry: MentorEntryIn): Partial<Record<keyof MentorEntryIn, string>> {
  const errors: Partial<Record<keyof MentorEntryIn, string>> = {};
  for (const key of REQUIRED) {
    const value = String(entry[key] ?? '').trim();
    if (!value) errors[key] = 'Campo obrigatório.';
  }
  if (entry.entry_date && !/^\d{4}-\d{2}-\d{2}$/.test(entry.entry_date)) errors.entry_date = 'Use o formato AAAA-MM-DD.';
  if (entry.prompt && entry.prompt.trim().length < 5) errors.prompt = 'Cole o prompt completo enviado à IA mentora.';
  if (entry.response && entry.response.trim().length < 5) errors.response = 'Cole a resposta recebida.';
  return errors;
}


export type RetrievalForm = { top_k: string; similarity_threshold: string; chunk_size: string; chunk_overlap: string };

export function validateRetrievalForm(form: RetrievalForm): Partial<Record<keyof RetrievalForm, string>> {
  const errors: Partial<Record<keyof RetrievalForm, string>> = {};
  const topK = Number(form.top_k);
  const threshold = Number(form.similarity_threshold.replace(',', '.'));
  const size = Number(form.chunk_size);
  const overlap = Number(form.chunk_overlap);
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) errors.top_k = 'Informe um inteiro entre 1 e 20.';
  if (Number.isNaN(threshold) || threshold < -1 || threshold > 1) errors.similarity_threshold = 'Informe um valor entre -1 e 1.';
  if (!Number.isInteger(size) || size < 200 || size > 4000) errors.chunk_size = 'Informe um inteiro entre 200 e 4000.';
  if (!Number.isInteger(overlap) || overlap < 0 || overlap > 1000) errors.chunk_overlap = 'Informe um inteiro entre 0 e 1000.';
  else if (!errors.chunk_size && overlap >= size) errors.chunk_overlap = 'A sobreposição deve ser menor que o tamanho do chunk.';
  return errors;
}

