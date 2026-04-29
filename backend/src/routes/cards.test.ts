import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mock fs so the module doesn't touch the real filesystem ──────────────────
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn(),
    },
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// ── Mock multer so no real file parsing happens ──────────────────────────────
vi.mock('multer', () => {
  const multer = () => ({
    single: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      // Simulate no file uploaded
      (req as any).file = undefined;
      next();
    },
  });
  (multer as any).diskStorage = vi.fn(() => ({}));
  return { default: multer };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  card: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

const { default: cardsRouter } = await import('./cards');

const app = express();
app.use(express.json());
app.use('/', cardsRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NOW = new Date('2024-03-01T12:00:00.000Z');

function makeCard(overrides = {}) {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    front: 'What is 2+2?',
    back: '4',
    backType: 'TEXT',
    imageUrl: null,
    schedule: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /decks/:deckId/cards ────────────────────────────────────────────────

describe('POST /decks/:deckId/cards — create card', () => {
  it('returns 201 with the created card', async () => {
    const card = makeCard();
    mockPrisma.card.create.mockResolvedValue(card);

    const res = await request(app)
      .post('/decks/deck-1/cards')
      .field('front', 'What is 2+2?')
      .field('back', '4')
      .field('backType', 'TEXT');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'card-1', front: 'What is 2+2?', back: '4' });
  });

  it('passes correct deckId to Prisma', async () => {
    mockPrisma.card.create.mockResolvedValue(makeCard());

    await request(app)
      .post('/decks/deck-42/cards')
      .field('front', 'Q')
      .field('back', 'A')
      .field('backType', 'TEXT');

    expect(mockPrisma.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deckId: 'deck-42' }),
      }),
    );
  });

  it('defaults imageUrl to null when no file uploaded', async () => {
    mockPrisma.card.create.mockResolvedValue(makeCard());

    await request(app)
      .post('/decks/deck-1/cards')
      .field('front', 'Q')
      .field('back', 'A')
      .field('backType', 'TEXT');

    expect(mockPrisma.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: null }),
      }),
    );
  });

  it('creates a MIXED (LaTeX) card and returns 201', async () => {
    // Note: the multer mock does not parse multipart text fields, so we
    // verify the route exists and delegates to Prisma — field parsing is
    // covered by integration tests.
    mockPrisma.card.create.mockResolvedValue(makeCard({ backType: 'MIXED', back: '$x^2$' }));

    const res = await request(app)
      .post('/decks/deck-1/cards')
      .field('front', 'Quadratic term')
      .field('back', '$x^2$')
      .field('backType', 'MIXED');

    expect(res.status).toBe(201);
    expect(mockPrisma.card.create).toHaveBeenCalledOnce();
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.card.create.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/decks/deck-1/cards')
      .field('front', 'Q')
      .field('back', 'A')
      .field('backType', 'TEXT');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── PUT /cards/:id ───────────────────────────────────────────────────────────

describe('PUT /cards/:id — update card', () => {
  it('returns 200 with the updated card', async () => {
    const existing = makeCard();
    const updated = makeCard({ front: 'Updated Q', back: 'Updated A' });
    mockPrisma.card.findUnique.mockResolvedValue(existing);
    mockPrisma.card.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/cards/card-1')
      .field('front', 'Updated Q')
      .field('back', 'Updated A');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ front: 'Updated Q', back: 'Updated A' });
    expect(mockPrisma.card.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'card-1' } }),
    );
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard());
    mockPrisma.card.update.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .put('/cards/card-1')
      .field('front', 'Q')
      .field('back', 'A');

    expect(res.status).toBe(500);
  });
});

// ─── DELETE /cards/:id ────────────────────────────────────────────────────────

describe('DELETE /cards/:id — delete card', () => {
  it('returns 204 on success', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard());
    mockPrisma.card.delete.mockResolvedValue({});

    const res = await request(app).delete('/cards/card-1');
    expect(res.status).toBe(204);
    expect(mockPrisma.card.delete).toHaveBeenCalledWith({ where: { id: 'card-1' } });
  });

  it('does not call unlinkSync when card has no image', async () => {
    const { unlinkSync } = await import('fs');
    mockPrisma.card.findUnique.mockResolvedValue(makeCard({ imageUrl: null }));
    mockPrisma.card.delete.mockResolvedValue({});

    await request(app).delete('/cards/card-1');
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrisma.card.findUnique.mockResolvedValue(makeCard());
    mockPrisma.card.delete.mockRejectedValue(new Error('DB error'));

    const res = await request(app).delete('/cards/card-1');
    expect(res.status).toBe(500);
  });
});
