export type ContentType = 'TEXT' | 'LATEX' | 'MIXED';
export type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
export type Rating = 0 | 1 | 2 | 3;

export interface Deck {
  id: string;
  name: string;
  description?: string | null;
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  totalCards?: number;
  dueCount?: number;
  newCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardSchedule {
  id: string;
  cardId: string;
  dueDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  state: CardState;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  backType: ContentType;
  imageUrl?: string | null;
  schedule?: CardSchedule | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  backType: ContentType;
  imageUrl?: string | null;
  state: CardState;
}

export interface StudySession {
  cards: StudyCard[];
  stats: {
    dueCount: number;
    newCount: number;
    totalToStudy: number;
  };
}

export interface DeckStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  due: number;
}
