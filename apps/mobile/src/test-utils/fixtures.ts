/**
 * DADOS DE TESTE (fixtures isoladas). Usados apenas nos testes automatizados do frontend;
 * nunca são exibidos na aplicação como dados reais.
 */
import type { ChatResponse, Citation } from '@/types/api';

export const citation = (over: Partial<Citation> = {}): Citation => ({
  label: 'F1',
  source_id: 'doc_teste-c0001',
  document_id: 'doc_teste',
  document_title: 'Documento de teste',
  filename: 'teste.pdf',
  page: 2,
  section: 'Art. 4º',
  excerpt: 'A velocidade máxima é de 25 km/h.',
  relevance: 0.52,
  url: null,
  license: null,
  author: null,
  institution: null,
  published_date: null,
  version: null,
  origin: 'fixtures',
  suspicious: false,
  cited_in_answer: true,
  ...over,
});

export const chatResponse = (over: Partial<ChatResponse> = {}): ChatResponse => ({
  interaction_id: 'int_1',
  conversation_id: 'conv_1',
  question: 'Qual a velocidade?',
  status: 'answered',
  evidence_status: 'sufficient',
  answer: 'A velocidade máxima é de 25 km/h [F1].',
  notice: null,
  citations: [citation()],
  citations_valid: true,
  warnings: [],
  retrieval: null,
  generation: { provider: 'demo', model: 'extrativo-deterministico', mode: 'demo_extractive', is_llm: false },
  latency: { retrieval_ms: 3, generation_ms: 1, total_ms: 5 },
  created_at: '2026-10-29T12:00:00+00:00',
  ...over,
});
