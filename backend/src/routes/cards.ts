import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for image uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype);
    cb(null, ok);
  },
});

// POST /api/decks/:deckId/cards — create card (with optional image)
router.post('/decks/:deckId/cards', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const { front, back, backType } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const card = await prisma.card.create({
      data: {
        deckId,
        front,
        back: back || '',
        backType: backType || 'TEXT',
        imageUrl,
      },
      include: { schedule: true },
    });
    res.status(201).json(card);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT /api/cards/:id — update card (with optional image replacement)
router.put('/cards/:id', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { front, back, backType, clearImage } = req.body;

    // If new image uploaded, delete old one
    if (req.file || clearImage === 'true') {
      const existing = await prisma.card.findUnique({ where: { id: req.params.id } });
      if (existing?.imageUrl) {
        const oldPath = path.join(process.cwd(), existing.imageUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : clearImage === 'true'
      ? null
      : undefined;

    const card = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        front,
        back: back ?? undefined,
        backType: backType ?? undefined,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
      include: { schedule: true },
    });
    res.json(card);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE /api/cards/:id
router.delete('/cards/:id', async (req: Request, res: Response) => {
  try {
    const card = await prisma.card.findUnique({ where: { id: req.params.id } });
    if (card?.imageUrl) {
      const imgPath = path.join(process.cwd(), card.imageUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await prisma.card.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

export default router;
