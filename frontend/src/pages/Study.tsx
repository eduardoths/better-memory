import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CardRenderer } from '../components/CardRenderer';
import type { Rating, StudyCard, StudySession } from '../types';

const RATINGS: { label: string; key: string; color: string; bg: string }[] = [
  { label: 'Again', key: '1', color: 'text-red-600', bg: 'bg-red-50 border-red-200 hover:bg-red-100 active:bg-red-200' },
  { label: 'Hard',  key: '2', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100 active:bg-orange-200' },
  { label: 'Good',  key: '3', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200' },
  { label: 'Easy',  key: '4', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100 active:bg-blue-200' },
];

const STATE_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-500',
  LEARNING: 'bg-orange-100 text-orange-600',
  REVIEW: 'bg-emerald-100 text-emerald-600',
  RELEARNING: 'bg-red-100 text-red-500',
};

export function Study() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<StudySession | null>(null);
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [tally, setTally] = useState({ again: 0, hard: 0, good: 0, easy: 0 });

  useEffect(() => {
    if (!deckId) return;
    api.study.getSession(deckId).then((s) => {
      setSession(s);
      setQueue(s.cards);
      setLoading(false);
    });
  }, [deckId]);

  const card = queue[current];
  const progress = session ? (current / session.cards.length) * 100 : 0;

  const flip = useCallback(() => {
    if (!flipped) setFlipped(true);
  }, [flipped]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || submitting) return;
      setSubmitting(true);

      const keys = ['again', 'hard', 'good', 'easy'] as const;
      setTally((t) => ({ ...t, [keys[rating]]: t[keys[rating]] + 1 }));

      try {
        await api.study.submitReview(card.id, rating);
      } catch {
        // best-effort: still advance
      }

      if (current + 1 >= queue.length) {
        setDone(true);
      } else {
        setCurrent((c) => c + 1);
        setFlipped(false);
      }
      setSubmitting(false);
    },
    [card, submitting, current, queue.length],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) flip();
      }
      if (flipped && !submitting) {
        if (e.key === '1') rate(0);
        if (e.key === '2') rate(1);
        if (e.key === '3') rate(2);
        if (e.key === '4') rate(3);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, flip, rate, submitting]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  // ── Empty session ────────────────────────────────────────────────────────
  if (!session || queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">All done!</h2>
        <p className="text-gray-400 mb-6">No cards to study right now. Come back tomorrow!</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────────
  if (done) {
    const total = tally.again + tally.hard + tally.good + tally.easy;
    const pct = total > 0 ? Math.round(((tally.good + tally.easy) / total) * 100) : 0;

    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Session complete!</h2>
        <p className="text-gray-400 mb-8">{total} cards reviewed · {pct}% correct</p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
          {[
            { label: 'Again', count: tally.again, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Hard',  count: tally.hard,  color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Good',  count: tally.good,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Easy',  count: tally.easy,  color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map((r) => (
            <div key={r.label} className={`${r.bg} rounded-2xl p-4`}>
              <div className={`text-2xl font-bold ${r.color}`}>{r.count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/deck/${deckId}/edit`)}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Edit Deck
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  // ── Study card ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>
            {current + 1} / {queue.length}
          </span>
          <span className={STATE_COLORS[card.state] + ' px-2 py-0.5 rounded-full text-xs font-medium'}>
            {card.state}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card flip */}
      <div
        className="card-scene mb-6 cursor-pointer select-none"
        style={{ minHeight: 280 }}
        onClick={!flipped ? flip : undefined}
      >
        <div className={`card-inner ${flipped ? 'flipped' : ''}`} style={{ minHeight: 280 }}>
          {/* Front */}
          <div className="card-face bg-white border border-gray-100 shadow-md">
            <div className="text-xl text-center text-gray-900 leading-relaxed px-4">
              {card.front}
            </div>
          </div>

          {/* Back */}
          <div className="card-face card-back-face bg-blue-50 border border-blue-100 shadow-md">
            <CardRenderer
              content={card.back}
              type={card.backType}
              imageUrl={card.imageUrl}
              className="text-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Hint / Rating */}
      {!flipped ? (
        <p className="text-center text-gray-300 text-sm">
          Tap the card or press <kbd className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs">Space</kbd> to reveal
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-xs text-gray-400 mb-1">How well did you remember?</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r, i) => (
              <button
                key={r.label}
                onClick={() => rate(i as Rating)}
                disabled={submitting}
                className={`flex flex-col items-center py-3 px-1 border rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${r.bg} ${r.color}`}
              >
                <span>{r.label}</span>
                <span className="text-xs opacity-50 mt-0.5">[{r.key}]</span>
              </button>
            ))}
          </div>

          {/* Rating guide */}
          <div className="text-xs text-gray-300 text-center mt-2">
            Again — complete blank · Hard — recalled with effort · Good — recalled with hesitation · Easy — instant recall
          </div>
        </div>
      )}
    </div>
  );
}
