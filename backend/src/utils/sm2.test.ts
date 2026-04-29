import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNextSchedule, getInitialSchedule } from './sm2';
import type { Schedule } from './sm2';

// Fix "now" so interval/date calculations are deterministic
const FIXED_NOW = new Date('2024-03-01T12:00:00.000Z');

function addDays(days: number): Date {
  const d = new Date(FIXED_NOW);
  d.setDate(d.getDate() + days);
  return d;
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    interval: 10,
    easeFactor: 2.5,
    repetitions: 3,
    dueDate: FIXED_NOW,
    state: 'REVIEW',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── getInitialSchedule ───────────────────────────────────────────────────────

describe('getInitialSchedule', () => {
  it('returns correct defaults', () => {
    const s = getInitialSchedule();
    expect(s.interval).toBe(0);
    expect(s.easeFactor).toBe(2.5);
    expect(s.repetitions).toBe(0);
    expect(s.state).toBe('NEW');
  });
});

// ─── Again (rating = 0) ───────────────────────────────────────────────────────

describe('Again (rating 0)', () => {
  it('NEW → LEARNING, resets repetitions, decreases ease', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'NEW', easeFactor: 2.5, repetitions: 0 }), 0);
    expect(result.state).toBe('LEARNING');
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBeCloseTo(2.3);
  });

  it('LEARNING → LEARNING', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'LEARNING', repetitions: 1 }), 0);
    expect(result.state).toBe('LEARNING');
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it('REVIEW → RELEARNING (lapses)', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW' }), 0);
    expect(result.state).toBe('RELEARNING');
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it('RELEARNING → RELEARNING', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'RELEARNING' }), 0);
    expect(result.state).toBe('RELEARNING');
    expect(result.interval).toBe(1);
  });

  it('ease factor does not go below 1.3', () => {
    const result = calculateNextSchedule(makeSchedule({ easeFactor: 1.35 }), 0);
    expect(result.easeFactor).toBe(1.3);
  });

  it('due date is 1 day from now', () => {
    const result = calculateNextSchedule(makeSchedule(), 0);
    expect(result.dueDate).toEqual(addDays(1));
  });
});

// ─── Hard (rating = 1) ───────────────────────────────────────────────────────

describe('Hard (rating 1)', () => {
  it('NEW → LEARNING, interval stays 1, ease decreases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'NEW', easeFactor: 2.5 }), 1);
    expect(result.state).toBe('LEARNING');
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBeCloseTo(2.35);
  });

  it('LEARNING → LEARNING, interval stays 1', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'LEARNING', repetitions: 1 }), 1);
    expect(result.state).toBe('LEARNING');
    expect(result.interval).toBe(1);
  });

  it('RELEARNING → RELEARNING, interval stays 1', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'RELEARNING' }), 1);
    expect(result.state).toBe('RELEARNING');
    expect(result.interval).toBe(1);
  });

  it('REVIEW → REVIEW, interval = ceil(prev × 1.2), ease decreases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 10, easeFactor: 2.5 }), 1);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(12); // ceil(10 * 1.2)
    expect(result.easeFactor).toBeCloseTo(2.35);
    expect(result.repetitions).toBe(4);
  });

  it('REVIEW: interval minimum is 1 even if calc gives 0', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 0 }), 1);
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('ease factor does not go below 1.3', () => {
    const result = calculateNextSchedule(makeSchedule({ easeFactor: 1.4 }), 1);
    expect(result.easeFactor).toBe(1.3);
  });

  it('REVIEW: repetitions incremented', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', repetitions: 5 }), 1);
    expect(result.repetitions).toBe(6);
  });
});

// ─── Good (rating = 2) ───────────────────────────────────────────────────────

describe('Good (rating 2)', () => {
  it('NEW, reps=0 → LEARNING, interval=1, reps=1', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'NEW', repetitions: 0 }), 2);
    expect(result.state).toBe('LEARNING');
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('NEW, reps>0 → REVIEW, interval=4, reps++', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'NEW', repetitions: 1 }), 2);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(4);
    expect(result.repetitions).toBe(2);
  });

  it('LEARNING → REVIEW, interval=4', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'LEARNING', repetitions: 1 }), 2);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(4);
  });

  it('REVIEW → REVIEW, interval = ceil(prev × easeFactor)', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 10, easeFactor: 2.5, repetitions: 3 }), 2);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(25); // ceil(10 * 2.5)
    expect(result.repetitions).toBe(4);
  });

  it('REVIEW: ease factor unchanged on Good', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', easeFactor: 2.2 }), 2);
    expect(result.easeFactor).toBeCloseTo(2.2);
  });

  it('RELEARNING → REVIEW, interval = ceil(prev × 0.5)', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'RELEARNING', interval: 20 }), 2);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(10); // ceil(20 * 0.5)
  });

  it('RELEARNING → REVIEW, interval minimum is 1', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'RELEARNING', interval: 1 }), 2);
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('due date matches the computed interval', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 10, easeFactor: 2.5 }), 2);
    expect(result.dueDate).toEqual(addDays(result.interval));
  });
});

// ─── Easy (rating = 3) ───────────────────────────────────────────────────────

describe('Easy (rating 3)', () => {
  it('NEW → REVIEW, interval=4, ease increases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'NEW', repetitions: 0, easeFactor: 2.5 }), 3);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(4);
    expect(result.easeFactor).toBeCloseTo(2.65);
  });

  it('LEARNING → REVIEW, interval=4, ease increases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'LEARNING', easeFactor: 2.5 }), 3);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(4);
    expect(result.easeFactor).toBeCloseTo(2.65);
  });

  it('RELEARNING → REVIEW, interval=4, ease increases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'RELEARNING', easeFactor: 2.0 }), 3);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(4);
    expect(result.easeFactor).toBeCloseTo(2.15);
  });

  it('REVIEW → REVIEW, interval = ceil(prev × ease × 1.3), ease increases', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 10, easeFactor: 2.5, repetitions: 3 }), 3);
    expect(result.state).toBe('REVIEW');
    expect(result.interval).toBe(33); // ceil(10 * 2.5 * 1.3)
    expect(result.easeFactor).toBeCloseTo(2.65);
    expect(result.repetitions).toBe(4);
  });

  it('ease factor does not exceed 4.0', () => {
    const result = calculateNextSchedule(makeSchedule({ easeFactor: 3.9 }), 3);
    expect(result.easeFactor).toBe(4.0);
  });

  it('due date matches the computed interval', () => {
    const result = calculateNextSchedule(makeSchedule({ state: 'REVIEW', interval: 10, easeFactor: 2.5 }), 3);
    expect(result.dueDate).toEqual(addDays(result.interval));
  });
});

// ─── General invariants ───────────────────────────────────────────────────────

describe('invariants across all ratings and states', () => {
  const ratings = [0, 1, 2, 3] as const;
  const states = ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const;

  for (const rating of ratings) {
    for (const state of states) {
      it(`rating=${rating}, state=${state}: interval >= 1 and dueDate >= now`, () => {
        const schedule = makeSchedule({ state, interval: 5, repetitions: 2 });
        const result = calculateNextSchedule(schedule, rating);
        expect(result.interval).toBeGreaterThanOrEqual(1);
        expect(result.dueDate.getTime()).toBeGreaterThanOrEqual(FIXED_NOW.getTime());
      });

      it(`rating=${rating}, state=${state}: ease stays between 1.3 and 4.0`, () => {
        const schedule = makeSchedule({ state, easeFactor: 2.5 });
        const result = calculateNextSchedule(schedule, rating);
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
        expect(result.easeFactor).toBeLessThanOrEqual(4.0);
      });
    }
  }
});
