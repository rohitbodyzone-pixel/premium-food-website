import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

// Get all active countries
router.get('/', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get specific country details
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const country = await prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        officialRegisterLinks: {
          include: { category: true },
        },
      },
    });

    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }

    res.json(country);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch country details' });
  }
});

export default router;
