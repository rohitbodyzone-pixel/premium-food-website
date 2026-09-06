import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Post a review for an expert
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { expertId, rating, comment } = req.body;
    const consumerId = req.user!.id;

    if (!expertId || !rating || !comment) {
      res.status(400).json({ error: 'Expert ID, star rating (1-5), and written comment are required' });
      return;
    }

    const ratingNum = parseInt(String(rating), 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      return;
    }

    // Check if consumer has already reviewed this expert (duplicate prevention)
    const existing = await prisma.review.findUnique({
      where: {
        expertId_consumerId: {
          expertId,
          consumerId,
        },
      },
    });

    if (existing) {
      res.status(409).json({ error: 'You have already submitted a review for this expert.' });
      return;
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        expertId,
        consumerId,
        rating: ratingNum,
        comment: comment.trim(),
      },
      include: {
        consumer: { select: { id: true, name: true } },
      },
    });

    // Recalculate expert average rating and review count
    const allReviews = await prisma.review.findMany({
      where: { expertId },
      select: { rating: true },
    });

    const totalCount = allReviews.length;
    const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
    const newAverage = parseFloat((sum / totalCount).toFixed(2));

    await prisma.expertProfile.update({
      where: { id: expertId },
      data: {
        ratingAvg: newAverage,
        ratingCount: totalCount,
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for an expert
router.get('/expert/:expertId', async (req: Request, res: Response) => {
  try {
    const { expertId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { expertId },
      include: {
        consumer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
