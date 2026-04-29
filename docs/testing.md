# Testing

Both backend and frontend use [Vitest](https://vitest.dev/).

---

## Backend tests

```bash
cd backend

# Run all tests once
npm test

# Run in watch mode (re-runs on file save)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Coverage output is written to `backend/coverage/`.

### What's tested

| File | What it covers |
|------|----------------|
| `src/utils/sm2.test.ts` | SM-2 algorithm — all ratings × all states, ease factor bounds, interval minimum, due dates |
| `src/routes/decks.test.ts` | Deck CRUD endpoints (create, list, get, update, delete) |
| `src/routes/cards.test.ts` | Card CRUD endpoints (create, update, delete) |
| `src/routes/study.test.ts` | Study session building, review submission (all 4 ratings), stats endpoint |

### How Prisma is mocked

Tests use `vi.hoisted()` to define a mock Prisma client before any module imports run:

```ts
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = { deck: { findMany: vi.fn(), ... }, ... };
  return { mockPrisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));
```

This pattern is required because Vitest hoists `vi.mock()` calls but evaluates the factory lazily — `vi.hoisted()` ensures the mock object is created before that factory runs.

---

## Frontend tests

```bash
cd frontend

# Run all tests once
npm test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Coverage output is written to `frontend/coverage/`.

### What's tested

| File | What it covers |
|------|----------------|
| `src/components/CardRenderer.test.tsx` | TEXT rendering, inline/block LaTeX, multiple expressions, invalid LaTeX graceful fallback, image present/absent |

### Environment

Frontend tests run in [jsdom](https://github.com/jsdom/jsdom) (a browser-like DOM environment). KaTeX is imported and runs normally inside jsdom.

---

## Running everything at once

```bash
# From the project root
(cd backend && npm test) && (cd frontend && npm test)
```
