/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Ratings:
 *   0 = Again  - complete blackout, start over
 *   1 = Hard   - correct with significant difficulty
 *   2 = Good   - correct with some hesitation
 *   3 = Easy   - perfect recall, answered instantly
 *
 * States:
 *   NEW        - never studied
 *   LEARNING   - first passes through the card (short intervals)
 *   REVIEW     - graduated card, shown at growing intervals
 *   RELEARNING - lapsed from REVIEW, relearning
 */

export type Rating = 0 | 1 | 2 | 3;
export type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

export interface Schedule {
  interval: number;    // days until next review
  easeFactor: number;  // multiplier, starts at 2.5, min 1.3
  repetitions: number; // consecutive successful reviews
  dueDate: Date;
  state: CardState;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function calculateNextSchedule(current: Schedule, rating: Rating): Schedule {
  const now = new Date();

  // ─── Again (0) ────────────────────────────────────────────────────────────
  if (rating === 0) {
    return {
      interval: 1,
      easeFactor: Math.max(1.3, current.easeFactor - 0.2),
      repetitions: 0,
      dueDate: addDays(now, 1),
      state: current.state === 'REVIEW' || current.state === 'RELEARNING' ? 'RELEARNING' : 'LEARNING',
    };
  }

  // ─── Hard (1) ─────────────────────────────────────────────────────────────
  if (rating === 1) {
    if (current.state === 'NEW' || current.state === 'LEARNING' || current.state === 'RELEARNING') {
      return {
        interval: 1,
        easeFactor: Math.max(1.3, current.easeFactor - 0.15),
        repetitions: current.repetitions,
        dueDate: addDays(now, 1),
        state: current.state === 'RELEARNING' ? 'RELEARNING' : 'LEARNING',
      };
    }
    const newInterval = Math.max(1, Math.ceil(current.interval * 1.2));
    return {
      interval: newInterval,
      easeFactor: Math.max(1.3, current.easeFactor - 0.15),
      repetitions: current.repetitions + 1,
      dueDate: addDays(now, newInterval),
      state: 'REVIEW',
    };
  }

  // ─── Good (2) ─────────────────────────────────────────────────────────────
  if (rating === 2) {
    if (current.state === 'NEW') {
      // First pass: 1 day, then 4 days before graduating to REVIEW
      if (current.repetitions === 0) {
        return { interval: 1, easeFactor: current.easeFactor, repetitions: 1, dueDate: addDays(now, 1), state: 'LEARNING' };
      }
      return { interval: 4, easeFactor: current.easeFactor, repetitions: 2, dueDate: addDays(now, 4), state: 'REVIEW' };
    }
    if (current.state === 'LEARNING') {
      return { interval: 4, easeFactor: current.easeFactor, repetitions: current.repetitions + 1, dueDate: addDays(now, 4), state: 'REVIEW' };
    }
    if (current.state === 'RELEARNING') {
      const ni = Math.max(1, Math.ceil(current.interval * 0.5));
      return { interval: ni, easeFactor: current.easeFactor, repetitions: current.repetitions + 1, dueDate: addDays(now, ni), state: 'REVIEW' };
    }
    // REVIEW
    const ni = Math.ceil(current.interval * current.easeFactor);
    return { interval: ni, easeFactor: current.easeFactor, repetitions: current.repetitions + 1, dueDate: addDays(now, ni), state: 'REVIEW' };
  }

  // ─── Easy (3) ─────────────────────────────────────────────────────────────
  if (rating === 3) {
    if (current.state === 'NEW' || current.state === 'LEARNING' || current.state === 'RELEARNING') {
      return {
        interval: 4,
        easeFactor: Math.min(4.0, current.easeFactor + 0.15),
        repetitions: current.repetitions + 1,
        dueDate: addDays(now, 4),
        state: 'REVIEW',
      };
    }
    const ni = Math.ceil(current.interval * current.easeFactor * 1.3);
    return {
      interval: ni,
      easeFactor: Math.min(4.0, current.easeFactor + 0.15),
      repetitions: current.repetitions + 1,
      dueDate: addDays(now, ni),
      state: 'REVIEW',
    };
  }

  return current;
}

export function getInitialSchedule(): Schedule {
  return {
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: new Date(),
    state: 'NEW',
  };
}
