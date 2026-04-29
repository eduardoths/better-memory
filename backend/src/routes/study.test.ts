import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  deck: { findUnique: vi.fn() },
  card: { findUnique: vi.fn() },
  cardSchedule: { upsert: vi.fn() },
  review: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

const { default: studyRouter } = await import('./study');

const app = express();
app.use(express.json());
app.use('/', studyRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NOW = new Date('2024-03-01T12:00:00.000Z');

function makeCard(id: string, state: string, dueDate?: Date, overrides = {}) {
  const schedule = state === 'NEW'
    ? null
    : { state, dueDate: dueDate ?? new Date(NOW.getTime() - 86400000), interval: 5, easeFactor: 2.5, repetitions: 2 };
  return {
    id,
    deckId: 'deck-1',
    front: `Front ${id}`,
    back: `Back ${id}`,
    backType: 'TEXT',
    imageUrl: null,
    schedule,
    ...overrides,
  };
}

function makeDeck(cards: ReturnType<typeof makeCard>[]) {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    cards,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  // Default: no cards reviewed today
  mockPrisma.review.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── GET /:deckId — build study session ───────────────────────────────────────

describe('GET /:deckId — build study session', () => {
  it('returns 404 when deck not found', async () => {
    mockPrisma.deck.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(404);
  });

  it('returns empty session when no cards are due or new', async () => {
    const futureDate = new Date(NOW.getTime() + 86400000 * 5);
    const reviewCard = makeCard('c1', 'REVIEW', futureDate); // not due yet
    mockPrisma.deck.findUnique.mockResolvedValue(makeDeck([reviewCard]));

    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(0);
    expect(res.body.stats.dueCount).toBe(0);
  });

  it('includes due REVIEW cards', async () => {
    const dueCard = makeCard('c1', 'REVIEW', new Date(NOW.getTime() - 1000));
    mockPrisma.deck.findUnique.mockResolvedValue(makeDeck([dueCard]));

    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(1);
    expect(res.body.cards[0].id).toBe('c1');
    expect(res.body.stats.dueCount).toBe(1);
  });

  it('includes due RELEARNING cards', async () => {
    const dueCard = makeCard('c1', 'RELEARNING', new Date(NOW.getTime() - 1000));
    mockPrisma.deck.findUnique.mockResolvedValue(makeDeck([dueCard]));

    const res = await request(app).get('/deck-1');
    expect(res.body.cards).toHaveLength(1);
  });

  it('includes NEW cards up to newCardsPerDay', async () => {
    const newCards = Array.from({ length: 5 }, (_, i) => makeCard(`c${i}`, 'NEW'));
    mockPrisma.deck.findUnique.mockResolvedValue({
      ...makeDeck(newCards),
      newCardsPerDay: 3,
    });

    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(200);
    // Only 3 new cards shown (limited by newCardsPerDay)
    expect(res.body.cards).toHaveLength(3);
    expect(res.body.stats.newCount).toBe(5);
  });

  it('caps review cards at maxReviewsPerDay', async () => {
    const dueCards = Array.from({ length: 300 }, (_, i) =>
      makeCard(`c${i}`, 'REVIEW', new Date(NOW.getTime() - 1000)),
    );
    mockPrisma.deck.findUnique.mockResolvedValue({
      ...makeDeck(dueCards),
      maxReviewsPerDay: 50,
    });

    const res = await request(app).get('/deck-1');
    expect(res.body.cards.length).toBeLessThanOrEqual(50);
  });

  it('returns cards with the correct shape', async () => {
    const card = makeCard('c1', 'REVIEW', new Date(NOW.getTime() - 1000));
    mockPrisma.deck.findUnique.mockResolvedValue(makeDeck([card]));

    const res = await request(app).get('/deck-1');
    const returned = res.body.cards[0];
    expect(returned).toHaveProperty('id');
    expect(returned).toHaveProperty('front');
    expect(returned).toHaveProperty('back');
    expect(returned).toHaveProperty('backType');
    expect(returned).toHaveProperty('state');
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.findUnique.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(500);
  });
});

// ─── POST /:cardId/review — submit rating ─────────────────────────────────────

describe('POST /:cardId/review — submit review', () => {
  const scheduleResult = {
    id: 'sched-1',
    cardId: 'card-1',
    interval: 4,
    easeFactor: 2.5,
    repetitions: 1,
    state: 'REVIEW',
    dueDate: new Date(NOW.getTime() + 86400000 * 4),
  };

  beforeEach(() => {
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mockPrisma.cardSchedule.upsert.mockResolvedValue(scheduleResult);
    mockPrisma.review.create.mockResolvedValue({ id: 'rev-1', cardId: 'card-1', rating: 2 });
  });

  it('returns 404 when card not found', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/card-1/review').send({ rating: 2 });
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated schedule for a NEW card (Good)', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard('card-1', 'NEW'));

    const res = await request(app).post('/card-1/review').send({ rating: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('schedule');
  });

  it('calls cardSchedule.upsert and review.create in a transaction', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard('card-1', 'REVIEW'));

    await request(app).post('/card-1/review').send({ rating: 3 });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.cardSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: 'card-1' } }),
    );
    expect(mockPrisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cardId: 'card-1', rating: 3 }) }),
    );
  });

  it.each([0, 1, 2, 3])('accepts rating=%i and returns 200', async (rating) => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard('card-1', 'REVIEW'));
    const res = await request(app).post('/card-1/review').send({ rating });
    expect(res.status).toBe(200);
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.card.findUnique.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/card-1/review').send({ rating: 2 });
    expect(res.status).toBe(500);
  });
});

// ─── GET /:deckId/stats ───────────────────────────────────────────────────────

describe('GET /:deckId/stats — deck stats', () => {
  it('returns 404 when deck not found', async () => {
    mockPrisma.deck.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/deck-1/stats');
    expect(res.status).toBe(404);
  });

  it('returns correct counts per state', async () => {
    const cards = [
      makeCard('c1', 'NEW'),
      makeCard('c2', 'NEW'),
      makeCard('c3', 'LEARNING'),
      makeCard('c4', 'REVIEW', new Date(NOW.getTime() - 1000)), // due
      makeCard('c5', 'REVIEW', new Date(NOW.getTime() + 86400000 * 5)), // not due yet
      makeCard('c6', 'RELEARNING', new Date(NOW.getTime() - 1000)), // due
    ];
    mockPrisma.deck.findUnique.mockResolvedValue(makeDeck(cards));

    const res = await request(app).get('/deck-1/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 6,
      new: 2,
      learning: 1,
      review: 2,
      relearning: 1,
      due: 2, // c4 + c6
    });
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.findUnique.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/deck-1/stats');
    expect(res.status).toBe(500);
  });
});
