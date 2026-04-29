import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/decks — list all decks with daily stats
router.get('/', async (_req: Request, res: Response) => {
  try {
    const decks = await prisma.deck.findMany({
      include: {
        _count: { select: { cards: true } },
        cards: { include: { schedule: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const result = decks.map((deck) => {
      const dueCards = deck.cards.filter(
        (c) =>
          c.schedule &&
          (c.schedule.state === 'REVIEW' || c.schedule.state === 'RELEARNING') &&
          c.schedule.dueDate <= endOfDay,
      );
      const newCards = deck.cards.filter(
        (c) => !c.schedule || c.schedule.state === 'NEW',
      );

      return {
        id: deck.id,
        name: deck.name,
        description: deck.description,
        newCardsPerDay: deck.newCardsPerDay,
        maxReviewsPerDay: deck.maxReviewsPerDay,
        totalCards: deck._count.cards,
        dueCount: Math.min(dueCards.length, deck.maxReviewsPerDay),
        newCount: Math.min(newCards.length, deck.newCardsPerDay),
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// POST /api/decks — create deck
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, newCardsPerDay, maxReviewsPerDay } = req.body;
    const deck = await prisma.deck.create({
      data: {
        name,
        description: description || null,
        newCardsPerDay: newCardsPerDay ?? 20,
        maxReviewsPerDay: maxReviewsPerDay ?? 200,
      },
    });
    res.status(201).json(deck);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

// GET /api/decks/:id — get deck with all cards
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.id },
      include: {
        cards: {
          include: { schedule: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    res.json(deck);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch deck' });
  }
});

// PUT /api/decks/:id — update deck
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, newCardsPerDay, maxReviewsPerDay } = req.body;
    const deck = await prisma.deck.update({
      where: { id: req.params.id },
      data: { name, description, newCardsPerDay, maxReviewsPerDay },
    });
    res.json(deck);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

// DELETE /api/decks/:id — delete deck
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.deck.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

export default router;
