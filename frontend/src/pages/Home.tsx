import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Deck } from '../types';

type DeckWithStats = Deck & { totalCards: number; dueCount: number; newCount: number };

export function Home() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.decks
      .list()
      .then(setDecks)
      .catch(() => setError('Could not reach the server. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
  const totalNew = decks.reduce((s, d) => s + d.newCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-500">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="font-medium">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Daily summary banner */}
      {decks.length > 0 && (totalDue > 0 || totalNew > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{totalDue}</div>
            <div className="text-xs text-blue-500 mt-1 font-medium uppercase tracking-wide">
              Due today
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{totalNew}</div>
            <div className="text-xs text-emerald-500 mt-1 font-medium uppercase tracking-wide">
              New cards
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Your Decks</h2>
        <button
          onClick={() => navigate('/deck/new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">📚</div>
          <div className="text-lg font-medium text-gray-500">No decks yet</div>
          <div className="text-sm mt-1">Create your first deck and start learning!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => {
            const hasCards = deck.dueCount > 0 || deck.newCount > 0;
            return (
              <div
                key={deck.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
              >
                {/* Deck icon */}
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0 select-none">
                  {deck.name[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{deck.name}</div>
                  {deck.description && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{deck.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {deck.dueCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                        {deck.dueCount} due
                      </span>
                    )}
                    {deck.newCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                        {deck.newCount} new
                      </span>
                    )}
                    {deck.dueCount === 0 && deck.newCount === 0 && deck.totalCards > 0 && (
                      <span className="text-xs text-gray-400">All caught up ✓</span>
                    )}
                    <span className="text-xs text-gray-300">{deck.totalCards} cards</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/deck/${deck.id}/edit`)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit deck"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate(`/study/${deck.id}`)}
                    disabled={!hasCards}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Study
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
