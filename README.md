# BetterMemory

A personal spaced-repetition flashcard app built with React + TypeScript + Node.js + PostgreSQL.

## Features

- **Decks** — create and manage multiple decks with per-deck limits
- **Cards** — front (text) + back (text, LaTeX via `$...$` / `$$...$$`, or image)
- **SM-2 algorithm** — four-button rating (Again / Hard / Good / Easy) with auto-scheduling
- **Daily limits** — configurable new cards/day and max reviews/day per deck
- **Mobile-ready** — responsive UI accessible from iPhone on the same network
- **Card states** — NEW → LEARNING → REVIEW (with RELEARNING on lapse)

## Documentation

| Guide | Description |
|-------|-------------|
| [Local Setup](docs/local-setup.md) | Database, backend, frontend — first-time and daily use |
| [Testing](docs/testing.md) | Running backend and frontend test suites |
| [Deploy](docs/deploy.md) | VPS setup, GitHub Actions CI/CD, Makefile reference |

---

## Spaced Repetition (SM-2)

| Rating | Meaning | Effect |
|--------|---------|--------|
| **Again** (1) | Complete blank | Resets card, ease -0.20 |
| **Hard** (2) | Recalled with effort | Interval ×1.2, ease -0.15 |
| **Good** (3) | Recalled with hesitation | Interval × ease factor |
| **Easy** (4) | Instant recall | Interval × ease × 1.3, ease +0.15 |

**New card flow:** 1 day → 4 days → graduated to REVIEW
**Lapsed card:** goes back to RELEARNING, interval halved on next Good

**Keyboard shortcuts in study mode:**
- `Space` / `Enter` — flip card
- `1` `2` `3` `4` — rate Again / Hard / Good / Easy

---

## Card back types

| Type | Usage |
|------|-------|
| **Text** | Plain text answer |
| **LaTeX** | Mix text with math: `$x^2$` inline, `$$\frac{a}{b}$$` block |

You can also attach an **image** to any card's back (JPEG, PNG, GIF, WebP, SVG · max 10 MB).

---

## Project structure

```
better-memory/
├── backend/
│   ├── prisma/schema.prisma   # DB schema (Deck, Card, CardSchedule, Review)
│   ├── src/
│   │   ├── index.ts           # Express entry point
│   │   ├── routes/
│   │   │   ├── decks.ts       # CRUD for decks
│   │   │   ├── cards.ts       # CRUD for cards + image upload
│   │   │   └── study.ts       # Study session + review submission
│   │   └── utils/sm2.ts       # SM-2 scheduling algorithm
│   └── uploads/               # Uploaded images (gitignored)
└── frontend/
    └── src/
        ├── pages/
        │   ├── Home.tsx        # Deck list with daily stats
        │   ├── DeckEditor.tsx  # Create/edit deck and its cards
        │   └── Study.tsx       # Flip-card study session
        ├── components/
        │   ├── Layout.tsx      # App shell + header
        │   └── CardRenderer.tsx # Text / LaTeX / image renderer
        ├── api/client.ts       # Typed API wrapper
        └── types/index.ts      # Shared TypeScript types
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Math rendering | KaTeX |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| File uploads | Multer |
| Dev DB | Docker Compose |
