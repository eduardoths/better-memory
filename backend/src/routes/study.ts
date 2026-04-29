import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateNextSchedule, Rating } from '../utils/sm2';

const router = Router();
const prisma = new PrismaClient();

// GET /api/study/:deckId — build today's study session
//
// Order: due review/relearning cards first, then new cards.
// Respects deck daily limits.
router.get('/:deckId', async (req: Request, res: Response) => {
  try {
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.deckId },
      include: { cards: { include: { schedule: true } } },
    });
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Cards reviewed today (to enforce daily limits without double-counting)
    const reviewedTodayRaw = await prisma.review.findMany({
      where: { card: { deckId: deck.id }, reviewedAt: { gte: startOfDay } },
      select: { cardId: true, card: { select: { schedule: true } } },
      distinct: ['cardId'],
    });

    // IDs of cards whose FIRST review ever was today (i.e. were NEW today)
    const newCardsStudiedToday = new Set(
      reviewedTodayRaw
        .filter((r) => {
          // card is in LEARNING state (transitioned from NEW today)
          const state = r.card.schedule?.state;
          return state === 'LEARNING';
        })
        .map((r) => r.cardId),
    );

    // ── Review queue ──────────────────────────────────────────────────────────
    const dueCards = deck.cards.filter(
      (c) =>
        c.schedule &&
        (c.schedule.state === 'REVIEW' || c.schedule.state === 'RELEARNING') &&
        c.schedule.dueDate <= endOfDay,
    );

    // ── New card queue ────────────────────────────────────────────────────────
    const allNewCards = deck.cards.filter(
      (c) => !c.schedule || c.schedule.state === 'NEW',
    );
    const newCardsRemaining = Math.max(0, deck.newCardsPerDay - newCardsStudiedToday.size);

    const sessionCards = [
      ...dueCards.slice(0, deck.maxReviewsPerDay),
      ...allNewCards.slice(0, newCardsRemaining),
    ].map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      backType: c.backType,
      imageUrl: c.imageUrl,
      state: c.schedule?.state ?? 'NEW',
    }));

    res.json({
      cards: sessionCards,
      stats: {
        dueCount: dueCards.length,
        newCount: allNewCards.length,
        totalToStudy: sessionCards.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build study session' });
  }
});

// POST /api/study/:cardId/review — submit a rating for a card
router.post('/:cardId/review', async (req: Request, res: Response) => {
  try {
    const { rating } = req.body as { rating: Rating };
    const { cardId } = req.params;

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { schedule: true },
    });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const current = card.schedule ?? {
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: new Date(),
      state: 'NEW' as const,
    };

    const next = calculateNextSchedule(
      {
        interval: current.interval,
        easeFactor: current.easeFactor,
        repetitions: current.repetitions,
        dueDate: current.dueDate,
        state: current.state as any,
      },
      rating,
    );

    const [updatedSchedule] = await prisma.$transaction([
      prisma.cardSchedule.upsert({
        where: { cardId },
        create: { cardId, ...next },
        update: next,
      }),
      prisma.review.create({ data: { cardId, rating } }),
    ]);

    res.json({ schedule: updatedSchedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/study/:deckId/stats — breakdown counts per state
router.get('/:deckId/stats', async (req: Request, res: Response) => {
  try {
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.deckId },
      include: { cards: { include: { schedule: true } } },
    });
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    res.json({
      total: deck.cards.length,
      new: deck.cards.filter((c) => !c.schedule || c.schedule.state === 'NEW').length,
      learning: deck.cards.filter((c) => c.schedule?.state === 'LEARNING').length,
      review: deck.cards.filter((c) => c.schedule?.state === 'REVIEW').length,
      relearning: deck.cards.filter((c) => c.schedule?.state === 'RELEARNING').length,
      due: deck.cards.filter(
        (c) =>
          c.schedule &&
          (c.schedule.state === 'REVIEW' || c.schedule.state === 'RELEARNING') &&
          c.schedule.dueDate <= endOfDay,
      ).length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
