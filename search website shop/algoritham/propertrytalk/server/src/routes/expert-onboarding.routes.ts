import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Submit or update Expert Onboarding Application
router.post('/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      countryCode,
      categoryId,
      title,
      bio,
      yearsOfExperience,
      city,
      languages,
      specialities,
      photoUrl,
      businessName,
      businessRegNumber,
      licenseNumber,
      payoutDetails,
      documents = [], // array of { docType, title, fileUrl }
    } = req.body;

    if (!countryCode || !categoryId || !title || !businessName || !licenseNumber) {
      res.status(400).json({
        error: 'Missing required onboarding fields: Country, Category, Title, Business Name, and Professional License Number are required.',
      });
      return;
    }

    // Ensure user role is updated to EXPERT if currently CONSUMER
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'EXPERT', countryCode: countryCode.toUpperCase() },
    });

    const parsedLanguages = Array.isArray(languages) ? JSON.stringify(languages) : JSON.stringify(['English']);
    const parsedSpecialities = Array.isArray(specialities) ? JSON.stringify(specialities) : JSON.stringify([]);

    // Upsert expert profile in PENDING_VERIFICATION status
    const existing = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    let profile;
    if (existing) {
      profile = await prisma.expertProfile.update({
        where: { id: existing.id },
        data: {
          countryCode: countryCode.toUpperCase(),
          categoryId,
          title,
          bio: bio || '',
          yearsOfExperience: parseInt(String(yearsOfExperience || 0), 10),
          city: city || 'Auckland',
          languages: parsedLanguages,
          specialities: parsedSpecialities,
          photoUrl: photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
          businessName,
          businessRegNumber,
          licenseNumber,
          payoutDetails,
          verificationStatus: 'PENDING_VERIFICATION',
          isOnline: false, // Must remain offline until verified by Super Admin
        },
      });
    } else {
      profile = await prisma.expertProfile.create({
        data: {
          userId,
          countryCode: countryCode.toUpperCase(),
          categoryId,
          title,
          bio: bio || '',
          yearsOfExperience: parseInt(String(yearsOfExperience || 0), 10),
          city: city || 'Auckland',
          languages: parsedLanguages,
          specialities: parsedSpecialities,
          photoUrl: photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
          businessName,
          businessRegNumber,
          licenseNumber,
          payoutDetails,
          verificationStatus: 'PENDING_VERIFICATION',
          isOnline: false,
        },
      });
    }

    // Add submitted verification documents
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        await prisma.verificationDocument.create({
          data: {
            expertProfileId: profile.id,
            docType: doc.docType || 'GOVERNMENT_ID',
            title: doc.title || 'Verification Document',
            fileUrl: doc.fileUrl || 'https://placehold.co/600x400/png?text=Verified+Doc',
          },
        });
      }
    } else {
      // Default placeholder verification items if user just filled form
      await prisma.verificationDocument.createMany({
        data: [
          {
            expertProfileId: profile.id,
            docType: 'GOVERNMENT_ID',
            title: 'Submitted Photo Identification',
            fileUrl: 'https://placehold.co/600x400/png?text=Submitted+Photo+ID',
          },
          {
            expertProfileId: profile.id,
            docType: 'LICENSE_CERTIFICATE',
            title: `License Proof (${licenseNumber})`,
            fileUrl: 'https://placehold.co/600x400/png?text=License+Proof',
          },
        ],
      });
    }

    // Add an audit log entry for submission
    await prisma.verificationAuditLog.create({
      data: {
        expertProfileId: profile.id,
        action: 'SUBMITTED',
        notes: `Expert submitted application for ${countryCode} category ${categoryId} with license ${licenseNumber}`,
        source: 'Expert Onboarding Portal',
      },
    });

    res.json({
      success: true,
      message: 'Your verification application has been submitted and is pending Super Admin review.',
      profile,
    });
  } catch (error) {
    console.error('Error in expert onboarding:', error);
    res.status(500).json({ error: 'Failed to submit expert application' });
  }
});

// Check expert onboarding / verification status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await prisma.expertProfile.findUnique({
      where: { userId },
      include: {
        category: true,
        country: true,
        documents: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!profile) {
      res.json({ hasProfile: false, status: 'NOT_STARTED' });
      return;
    }

    res.json({
      hasProfile: true,
      status: profile.verificationStatus,
      profile,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expert onboarding status' });
  }
});

export default router;
