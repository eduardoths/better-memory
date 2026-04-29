import type { Card, Deck, DeckStats, StudySession } from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

async function upload<T>(path: string, method: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method, body: formData });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export const api = {
  decks: {
    list: () => request<(Deck & { totalCards: number; dueCount: number; newCount: number })[]>('/decks'),
    get: (id: string) => request<Deck & { cards: Card[] }>(`/decks/${id}`),
    create: (data: Partial<Deck>) =>
      request<Deck>('/decks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Deck>) =>
      request<Deck>(`/decks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/decks/${id}`, { method: 'DELETE' }),
  },

  cards: {
    create: (deckId: string, formData: FormData) =>
      upload<Card>(`/decks/${deckId}/cards`, 'POST', formData),
    update: (id: string, formData: FormData) =>
      upload<Card>(`/cards/${id}`, 'PUT', formData),
    delete: (id: string) => request<void>(`/cards/${id}`, { method: 'DELETE' }),
  },

  study: {
    getSession: (deckId: string) => request<StudySession>(`/study/${deckId}`),
    submitReview: (cardId: string, rating: number) =>
      request(`/study/${cardId}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      }),
    getStats: (deckId: string) => request<DeckStats>(`/study/${deckId}/stats`),
  },
};
