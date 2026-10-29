import type { ChatStatus, DocumentStatus, EvidenceStatus } from '@/types/api';

export const NOT_INFORMED = 'Não informado';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NOT_INFORMED;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return NOT_INFORMED;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(2).replace('.', ',');
}

export function formatPercent(value: number | null | undefined, alreadyPercent = false): string {
  if (value === null || value === undefined) return '—';
  const pct = alreadyPercent ? value : value * 100;
  return `${pct.toFixed(1).replace('.', ',').replace(',0', '')}%`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`;
}

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  processed: { label: 'Processado', tone: 'success' },
  failed: { label: 'Falha', tone: 'danger' },
  pending: { label: 'Aguardando', tone: 'warning' },
  processing: { label: 'Processando', tone: 'info' },
  excluded: { label: 'Fora do índice', tone: 'neutral' },
};

export const CHAT_STATUS: Record<ChatStatus, string> = {
  answered: 'Respondida com evidências',
  insufficient_evidence: 'Evidências insuficientes',
  out_of_scope: 'Fora do escopo do acervo',
  no_documents: 'Acervo sem documentos processados',
  blocked: 'Instruções maliciosas ignoradas',
  provider_error: 'Provedor de IA indisponível',
  index_unavailable: 'Índice indisponível',
};

export const EVIDENCE_STATUS: Record<EvidenceStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  sufficient: { label: 'Evidência encontrada', tone: 'success' },
  weak: { label: 'Evidência fraca', tone: 'warning' },
  conflicting: { label: 'Fontes divergentes', tone: 'warning' },
  insufficient: { label: 'Sem evidência suficiente', tone: 'danger' },
  none: { label: 'Sem recuperação', tone: 'neutral' },
};

export const CATEGORY_LABEL: Record<string, string> = {
  present: 'A — Informação presente',
  absent: 'B — Informação ausente',
  out_of_scope: 'C — Fora do escopo',
  adversarial: 'C — Adversarial',
};

export function pageLabel(page: number | null | undefined): string {
  return page === null || page === undefined ? 'Página não informada' : `p. ${page}`;
}
