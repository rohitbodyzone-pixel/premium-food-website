import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'propertytalk_super_secret_jwt_key_2026';

export interface AuthUser {
  id: string;
  email: string;
  phoneNumber?: string;
  role: 'CONSUMER' | 'EXPERT' | 'SUPER_ADMIN';
  name: string;
  countryCode?: string;
  expertProfileId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Extracts auth token from Authorization header OR HttpOnly cookie
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies.pt_token) {
    return req.cookies.pt_token;
  }
  return null;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { expertProfile: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User account no longer exists' });
      return;
    }

    if (user.accountStatus === 'SUSPENDED') {
      res.status(403).json({ error: 'Account suspended. Please contact customer support.' });
      return;
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      res.status(423).json({ error: `Account temporarily locked due to multiple failed login attempts. Try again in ${minutesLeft} minutes.` });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      phoneNumber: user.phoneNumber || undefined,
      role: user.role as any,
      name: user.name,
      countryCode: user.countryCode || undefined,
      expertProfileId: user.expertProfile?.id,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
};

export const requireRole = (...roles: Array<'CONSUMER' | 'EXPERT' | 'SUPER_ADMIN'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Forbidden: Access requires one of [${roles.join(', ')}] role` });
      return;
    }

    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { expertProfile: true },
      });
      if (user && user.accountStatus !== 'SUSPENDED') {
        req.user = {
          id: user.id,
          email: user.email || '',
          phoneNumber: user.phoneNumber || undefined,
          role: user.role as any,
          name: user.name,
          countryCode: user.countryCode || undefined,
          expertProfileId: user.expertProfile?.id,
        };
      }
    }
  } catch (e) {
    // Ignore invalid optional tokens
  }
  next();
};
