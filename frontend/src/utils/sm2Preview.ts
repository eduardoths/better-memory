import type { CardState } from '../types';

/** Returns the next interval (in days) for each rating [Again, Hard, Good, Easy]. */
export function previewIntervals(
  state: CardState,
  interval: number,
  easeFactor: number,
  repetitions: number,
): [number, number, number, number] {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  // Again (0) — always 1 day
  const again = 1;

  // Hard (1)
  let hard: number;
  if (state === 'REVIEW') {
    hard = Math.max(1, Math.ceil(interval * 1.2));
  } else {
    hard = 1;
  }

  // Good (2)
  let good: number;
  if (state === 'NEW') {
    good = repetitions === 0 ? 1 : 4;
  } else if (state === 'LEARNING') {
    good = 4;
  } else if (state === 'RELEARNING') {
    good = Math.max(1, Math.ceil(interval * 0.5));
  } else {
    // REVIEW
    good = Math.ceil(interval * easeFactor);
  }

  // Easy (3)
  let easy: number;
  if (state === 'REVIEW') {
    easy = Math.ceil(interval * clamp(easeFactor + 0.15, 1.3, 4.0) * 1.3);
  } else {
    easy = 4;
  }

  return [again, hard, good, easy];
}

/** Formats a day count as a compact human-readable string. */
export function formatDays(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}yr`;
}
