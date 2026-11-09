import type { ChatResponse } from '@/types/api';

export type SavedConversation = { id: string; title: string; updatedAt: string };
export const CONVERSATIONS_KEY = 'conversations-v1';

export function parseConversations(value: string | null): SavedConversation[] {
  try {
    const data: unknown = JSON.parse(value ?? 'null');
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.filter((item): item is SavedConversation => {
      if (!item || typeof item !== 'object') return false;
      const c = item as Partial<SavedConversation>;
      if (typeof c.id !== 'string' || !c.id || typeof c.title !== 'string' || !c.title ||
          typeof c.updatedAt !== 'string' || !Number.isFinite(Date.parse(c.updatedAt)) || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).map(({ id, title, updatedAt }) => ({ id, title: title.slice(0, 100), updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function rememberConversation(list: SavedConversation[], id: string, items: ChatResponse[]): SavedConversation[] {
  if (!items.length) return list;
  const previous = list.find((c) => c.id === id);
  const first = items[0];
  const latest = items[items.length - 1];
  const saved = {
    id,
    title: previous?.title ?? first.question.replace(/\s+/g, ' ').trim().slice(0, 100),
    updatedAt: latest.created_at,
  };
  return [...list.filter((c) => c.id !== id), saved].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
