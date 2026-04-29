import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  deck: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Import router after mock is registered
const { default: decksRouter } = await import('./decks');

const app = express();
app.use(express.json());
app.use('/', decksRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NOW = new Date('2024-03-01T12:00:00.000Z');

function makeDeck(overrides = {}) {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    description: 'A test deck',
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    createdAt: NOW,
    updatedAt: NOW,
    _count: { cards: 0 },
    cards: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET / — list decks', () => {
  it('returns 200 with an empty array when no decks', async () => {
    mockPrisma.deck.findMany.mockResolvedValue([]);

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns decks with computed stats', async () => {
    const endOfDay = new Date(NOW);
    endOfDay.setHours(23, 59, 59, 999);

    const dueCard = {
      id: 'card-due',
      schedule: { state: 'REVIEW', dueDate: new Date(NOW.getTime() - 1000) }, // due in the past
    };
    const newCard = {
      id: 'card-new',
      schedule: null,
    };

    mockPrisma.deck.findMany.mockResolvedValue([
      makeDeck({ _count: { cards: 2 }, cards: [dueCard, newCard] }),
    ]);

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 'deck-1',
      name: 'Test Deck',
      totalCards: 2,
      dueCount: 1,
      newCount: 1,
    });
  });

  it('caps dueCount at maxReviewsPerDay', async () => {
    const now = new Date();
    const dueCards = Array.from({ length: 300 }, (_, i) => ({
      id: `card-${i}`,
      schedule: { state: 'REVIEW', dueDate: new Date(now.getTime() - 1000) },
    }));

    mockPrisma.deck.findMany.mockResolvedValue([
      makeDeck({ maxReviewsPerDay: 200, _count: { cards: 300 }, cards: dueCards }),
    ]);

    const res = await request(app).get('/');
    expect(res.body[0].dueCount).toBe(200);
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.findMany.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST / — create deck', () => {
  it('returns 201 with the created deck', async () => {
    const created = makeDeck();
    mockPrisma.deck.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/')
      .send({ name: 'Test Deck', description: 'A test deck' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'deck-1', name: 'Test Deck' });
    expect(mockPrisma.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Test Deck' }) }),
    );
  });

  it('applies default newCardsPerDay=20 and maxReviewsPerDay=200', async () => {
    mockPrisma.deck.create.mockResolvedValue(makeDeck());

    await request(app).post('/').send({ name: 'Deck' });

    expect(mockPrisma.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newCardsPerDay: 20, maxReviewsPerDay: 200 }),
      }),
    );
  });

  it('accepts custom newCardsPerDay and maxReviewsPerDay', async () => {
    mockPrisma.deck.create.mockResolvedValue(makeDeck());

    await request(app).post('/').send({ name: 'Deck', newCardsPerDay: 5, maxReviewsPerDay: 50 });

    expect(mockPrisma.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newCardsPerDay: 5, maxReviewsPerDay: 50 }),
      }),
    );
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.create.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/').send({ name: 'Deck' });
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id — get deck', () => {
  it('returns 200 with the deck and its cards', async () => {
    const deck = makeDeck({ cards: [{ id: 'card-1', front: 'Q', back: 'A', schedule: null }] });
    mockPrisma.deck.findUnique.mockResolvedValue(deck);

    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('deck-1');
    expect(res.body.cards).toHaveLength(1);
  });

  it('returns 404 when deck not found', async () => {
    mockPrisma.deck.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.findUnique.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/deck-1');
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

describe('PUT /:id — update deck', () => {
  it('returns 200 with the updated deck', async () => {
    const updated = makeDeck({ name: 'Renamed' });
    mockPrisma.deck.update.mockResolvedValue(updated);

    const res = await request(app).put('/deck-1').send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(mockPrisma.deck.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'deck-1' } }),
    );
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/deck-1').send({ name: 'X' });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /:id — delete deck', () => {
  it('returns 204 on success', async () => {
    mockPrisma.deck.delete.mockResolvedValue({});
    const res = await request(app).delete('/deck-1');
    expect(res.status).toBe(204);
    expect(mockPrisma.deck.delete).toHaveBeenCalledWith({ where: { id: 'deck-1' } });
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.deck.delete.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/deck-1');
    expect(res.status).toBe(500);
  });
});
