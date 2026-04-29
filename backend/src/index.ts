import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import decksRouter from './routes/decks';
import cardsRouter from './routes/cards';
import studyRouter from './routes/study';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/decks', decksRouter);
// Cards router handles both /api/decks/:deckId/cards and /api/cards/:id
app.use('/api', cardsRouter);
app.use('/api/study', studyRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Better Memory backend running on http://localhost:${PORT}`);
});
