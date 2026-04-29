import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Card, ContentType, Deck } from '../types';
import { CardRenderer } from '../components/CardRenderer';

interface CardForm {
  front: string;
  back: string;
  backType: ContentType;
  image: File | null;
  previewUrl: string | null; // existing image URL or object URL
  clearImage: boolean;
}

const emptyForm = (): CardForm => ({
  front: '',
  back: '',
  backType: 'TEXT',
  image: null,
  previewUrl: null,
  clearImage: false,
});

export function DeckEditor() {
  const { deckId } = useParams<{ deckId?: string }>();
  const navigate = useNavigate();
  const isNew = !deckId || deckId === 'new';

  // Deck fields
  const [deck, setDeck] = useState<(Deck & { cards: Card[] }) | null>(null);
  const [deckName, setDeckName] = useState('');
  const [deckDesc, setDeckDesc] = useState('');
  const [newPerDay, setNewPerDay] = useState(20);
  const [maxReviews, setMaxReviews] = useState(200);
  const [deckSaving, setDeckSaving] = useState(false);
  const [deckLoading, setDeckLoading] = useState(!isNew);

  // Card form
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CardForm>(emptyForm());
  const [cardSaving, setCardSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew && deckId) {
      api.decks.get(deckId).then((d) => {
        setDeck(d);
        setDeckName(d.name);
        setDeckDesc(d.description ?? '');
        setNewPerDay(d.newCardsPerDay);
        setMaxReviews(d.maxReviewsPerDay);
        setDeckLoading(false);
      });
    }
  }, [deckId, isNew]);

  // ── Deck actions ──────────────────────────────────────────────────────────
  const saveDeck = async () => {
    if (!deckName.trim()) return;
    setDeckSaving(true);
    try {
      if (isNew) {
        const created = await api.decks.create({
          name: deckName.trim(),
          description: deckDesc.trim() || undefined,
          newCardsPerDay: newPerDay,
          maxReviewsPerDay: maxReviews,
        });
        navigate(`/deck/${created.id}/edit`, { replace: true });
      } else {
        await api.decks.update(deckId!, {
          name: deckName.trim(),
          description: deckDesc.trim() || undefined,
          newCardsPerDay: newPerDay,
          maxReviewsPerDay: maxReviews,
        });
      }
    } finally {
      setDeckSaving(false);
    }
  };

  const deleteDeck = async () => {
    if (!confirm(`Delete "${deckName}" and all its cards? This cannot be undone.`)) return;
    await api.decks.delete(deckId!);
    navigate('/');
  };

  // ── Card form helpers ──────────────────────────────────────────────────────
  const openNew = () => {
    setEditingCardId(null);
    setForm(emptyForm());
    setPreview(false);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const openEdit = (card: Card) => {
    setEditingCardId(card.id);
    setForm({
      front: card.front,
      back: card.back,
      backType: card.backType,
      image: null,
      previewUrl: card.imageUrl ?? null,
      clearImage: false,
    });
    setPreview(false);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCardId(null);
    if (form.image) URL.revokeObjectURL(form.previewUrl ?? '');
    setForm(emptyForm());
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.image) URL.revokeObjectURL(form.previewUrl ?? '');
    setForm((f) => ({
      ...f,
      image: file,
      previewUrl: URL.createObjectURL(file),
      clearImage: false,
    }));
  };

  const removeImage = () => {
    if (form.image) URL.revokeObjectURL(form.previewUrl ?? '');
    setForm((f) => ({ ...f, image: null, previewUrl: null, clearImage: true }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('front', form.front);
    fd.append('back', form.back);
    fd.append('backType', form.backType);
    if (form.image) fd.append('image', form.image);
    if (form.clearImage) fd.append('clearImage', 'true');
    return fd;
  };

  const saveCard = async () => {
    if (!form.front.trim()) return;
    setCardSaving(true);
    try {
      const fd = buildFormData();
      if (editingCardId) {
        const updated = await api.cards.update(editingCardId, fd);
        setDeck((d) => d && { ...d, cards: d.cards.map((c) => (c.id === updated.id ? updated : c)) });
      } else {
        const created = await api.cards.create(deckId!, fd);
        setDeck((d) => d && { ...d, cards: [created, ...d.cards] });
      }
      closeForm();
    } finally {
      setCardSaving(false);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!confirm('Delete this card?')) return;
    setDeletingId(cardId);
    await api.cards.delete(cardId);
    setDeck((d) => d && { ...d, cards: d.cards.filter((c) => c.id !== cardId) });
    setDeletingId(null);
    if (editingCardId === cardId) closeForm();
  };

  if (deckLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'New Deck' : 'Edit Deck'}
      </h1>

      {/* ── Deck settings card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
            <input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g. Japanese Vocabulary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={deckDesc}
              onChange={(e) => setDeckDesc(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              rows={2}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">New cards / day</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={newPerDay}
                onChange={(e) => setNewPerDay(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Max reviews / day</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={maxReviews}
                onChange={(e) => setMaxReviews(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={saveDeck}
            disabled={deckSaving || !deckName.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {deckSaving ? 'Saving…' : isNew ? 'Create Deck' : 'Save Changes'}
          </button>
          {!isNew && (
            <button
              onClick={deleteDeck}
              className="px-5 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors"
            >
              Delete Deck
            </button>
          )}
        </div>
      </div>

      {/* ── Cards section ─────────────────────────────────────────────────── */}
      {!isNew && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">
              Cards{' '}
              <span className="text-gray-400 font-normal">({deck?.cards.length ?? 0})</span>
            </h2>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Card
            </button>
          </div>

          {/* ── Card editor form ─────────────────────────────────────────── */}
          {showForm && (
            <div
              ref={formRef}
              className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 mb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">
                  {editingCardId ? 'Edit Card' : 'New Card'}
                </h3>
                <div className="flex items-center gap-3">
                  {/* Full card preview toggle — only shown in TEXT mode;
                      LaTeX mode always shows a live split-pane preview */}
                  {form.backType !== 'MIXED' && (
                    <button
                      onClick={() => setPreview((p) => !p)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {preview ? '✏️ Edit' : '👁 Preview'}
                    </button>
                  )}
                  <button onClick={closeForm} className="text-sm text-gray-400 hover:text-gray-600">
                    Cancel
                  </button>
                </div>
              </div>

              {preview && form.backType !== 'MIXED' ? (
                /* ── Full card preview (TEXT mode only) ── */
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                      Front
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center min-h-[60px]">
                      {form.front || <span className="text-gray-300">Empty</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                      Back
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 min-h-[60px]">
                      {form.back || form.previewUrl ? (
                        <CardRenderer
                          content={form.back}
                          type={form.backType}
                          imageUrl={form.previewUrl}
                        />
                      ) : (
                        <span className="text-gray-300">Empty</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Edit fields ── */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Front *</label>
                    <textarea
                      value={form.front}
                      onChange={(e) => setForm((f) => ({ ...f, front: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      rows={2}
                      placeholder="Question or concept"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-600">Back</label>
                      {/* Content type toggle */}
                      <div className="flex gap-1 text-xs border border-gray-200 rounded-lg p-0.5">
                        {(['TEXT', 'MIXED'] as ContentType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setForm((f) => ({ ...f, backType: t }))}
                            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                              form.backType === t
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {t === 'TEXT' ? 'Text' : 'LaTeX'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.backType === 'MIXED' ? (
                      /* ── Live split-pane: editor + real-time rendered preview ── */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-400 mb-1 font-medium">Source</div>
                          <textarea
                            value={form.back}
                            onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))}
                            className="flex-1 min-h-[160px] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
                            placeholder={'$x^2$ inline  ·  $$\\frac{a}{b}$$ block'}
                            spellCheck={false}
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-400 mb-1 font-medium">Preview</div>
                          <div className="flex-1 min-h-[160px] border border-purple-100 bg-purple-50 rounded-xl px-3 py-3 overflow-auto">
                            {form.back.trim() ? (
                              <CardRenderer
                                content={form.back}
                                type="MIXED"
                                imageUrl={form.previewUrl}
                                className="text-left text-sm"
                              />
                            ) : (
                              <span className="text-gray-300 text-sm">
                                Start typing to see your LaTeX rendered here…
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={form.back}
                        onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                        rows={4}
                        placeholder="Answer or explanation"
                      />
                    )}
                  </div>

                  {/* Image upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Image (optional)
                    </label>
                    {form.previewUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={form.previewUrl}
                          alt="Preview"
                          className="max-h-40 rounded-xl border border-gray-200 object-contain"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors w-full justify-center"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Upload image
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              <div className="mt-5">
                <button
                  onClick={saveCard}
                  disabled={cardSaving || !form.front.trim()}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {cardSaving ? 'Saving…' : editingCardId ? 'Update Card' : 'Add Card'}
                </button>
              </div>
            </div>
          )}

          {/* ── Card list ─────────────────────────────────────────────────── */}
          <div className="space-y-2">
            {deck?.cards.length === 0 && !showForm && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🃏</div>
                <div>No cards yet. Click "Add Card" to get started.</div>
              </div>
            )}
            {deck?.cards.map((card) => (
              <div
                key={card.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition-colors ${
                  editingCardId === card.id ? 'border-blue-200' : 'border-gray-100'
                }`}
              >
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{card.front}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {card.backType === 'MIXED' && (
                      <span className="text-purple-400 mr-1">∑</span>
                    )}
                    {card.back || <span className="italic text-gray-300">no text</span>}
                  </div>
                  {card.schedule && (
                    <div className="mt-1">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          card.schedule.state === 'NEW'
                            ? 'bg-gray-100 text-gray-500'
                            : card.schedule.state === 'LEARNING'
                            ? 'bg-orange-100 text-orange-600'
                            : card.schedule.state === 'REVIEW'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-500'
                        }`}
                      >
                        {card.schedule.state}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(card)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
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
                    onClick={() => deleteCard(card.id)}
                    disabled={deletingId === card.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
