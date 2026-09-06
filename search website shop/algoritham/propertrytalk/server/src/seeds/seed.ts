import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  INITIAL_COUNTRIES,
  INITIAL_CATEGORIES,
  INITIAL_OFFICIAL_REGISTERS,
  DEFAULT_FREE_CALL_DURATION_SECONDS,
} from '../config/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PropertyTalk Database...');

  // 1. Seed System Configs
  await prisma.systemConfig.upsert({
    where: { key: 'free_call_duration_seconds' },
    update: { value: String(DEFAULT_FREE_CALL_DURATION_SECONDS) },
    create: {
      key: 'free_call_duration_seconds',
      value: String(DEFAULT_FREE_CALL_DURATION_SECONDS),
      description: 'Default free audio/video consultation duration in seconds',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'platform_commission_pct' },
    update: { value: '20' },
    create: {
      key: 'platform_commission_pct',
      value: '20',
      description: 'Platform commission percentage on paid extension consultations',
    },
  });

  // 2. Seed Countries
  for (const c of INITIAL_COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        flag: c.flag,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        isActive: c.isActive,
        freeCallMinutesDefault: c.freeCallMinutesDefault,
        legalText: c.legalText,
      },
      create: c,
    });
  }

  // 3. Seed Categories
  const categoryMap = new Map<string, string>();
  for (const cat of INITIAL_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        displayOrder: cat.displayOrder,
      },
      create: cat,
    });
    categoryMap.set(cat.slug, record.id);
  }

  // 4. Seed Official Register Links
  for (const reg of INITIAL_OFFICIAL_REGISTERS) {
    const categoryId = categoryMap.get(reg.categorySlug);
    if (categoryId) {
      const existing = await prisma.officialRegisterLink.findFirst({
        where: {
          countryCode: reg.countryCode,
          categoryId,
        },
      });

      if (!existing) {
        await prisma.officialRegisterLink.create({
          data: {
            countryCode: reg.countryCode,
            categoryId,
            title: reg.title,
            urlPattern: reg.urlPattern,
            notes: reg.notes,
          },
        });
      }
    }
  }

  const commonPassword = await bcrypt.hash('password123', 10);

  // 5. Seed Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@propertytalk.com' },
    update: {},
    create: {
      email: 'admin@propertytalk.com',
      passwordHash: commonPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      countryCode: 'NZ',
    },
  });

  // 6. Seed Consumer
  const consumer = await prisma.user.upsert({
    where: { email: 'james.wilson@gmail.com' },
    update: {},
    create: {
      email: 'james.wilson@gmail.com',
      passwordHash: commonPassword,
      name: 'James Wilson',
      role: 'CONSUMER',
      countryCode: 'NZ',
      phone: '+64 21 555 0192',
    },
  });

  // Seed default mock payment method for consumer
  let paymentCustomer = await prisma.paymentCustomer.findUnique({
    where: { userId: consumer.id },
  });
  if (!paymentCustomer) {
    paymentCustomer = await prisma.paymentCustomer.create({
      data: {
        userId: consumer.id,
        providerCustomerId: `cus_demo_${consumer.id.substring(0, 8)}`,
      },
    });
  }

  const existingMethods = await prisma.paymentMethodReference.findMany({
    where: { paymentCustomerId: paymentCustomer.id },
  });
  if (existingMethods.length === 0) {
    const defaultCard = await prisma.paymentMethodReference.create({
      data: {
        paymentCustomerId: paymentCustomer.id,
        providerMethodId: `pm_mock_visa_4242`,
        cardBrand: 'visa',
        cardLast4: '4242',
        cardExpMonth: 12,
        cardExpYear: 2028,
        isDefault: true,
      },
    });
    await prisma.paymentCustomer.update({
      where: { id: paymentCustomer.id },
      data: { defaultPaymentMethodId: defaultCard.id },
    });
  }

  // 7. Seed Demo Experts (Verified)
  const demoExperts = [
    // NEW ZEALAND
    {
      email: 'sarah.jenkins@propertytalk.co.nz',
      name: 'Sarah Jenkins',
      countryCode: 'NZ',
      categorySlug: 'real-estate-agent',
      title: 'Licensed Residential Specialist & Auctioneer',
      city: 'Auckland',
      bio: 'Over 12 years helping families and investors buy and sell across Greater Auckland. Specialist in market valuation, tender preparation, and auction strategy.',
      yearsOfExperience: 12,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Auckland Residential', 'First-Home Auctions', 'Off-market Sales']),
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Jenkins & Co Realty (Demo)',
      businessRegNumber: '9429040001234',
      licenseNumber: 'REA-2009124',
      hourlyRate: 180,
      callPerMinuteRate: 3.0,
      isOnline: true,
      ratingAvg: 4.95,
      ratingCount: 38,
    },
    {
      email: 'liam.patel@propertytalk.co.nz',
      name: 'Liam Patel',
      countryCode: 'NZ',
      categorySlug: 'mortgage-adviser',
      title: 'Senior Registered Financial & Mortgage Adviser',
      city: 'Wellington',
      bio: 'Independent mortgage broker specializing in complex pre-approvals, low-deposit lending, self-employed income verification, and New Zealand bank refinancing.',
      yearsOfExperience: 9,
      languages: JSON.stringify(['English', 'Hindi', 'Gujarati']),
      specialities: JSON.stringify(['Kainga Ora First Home Grants', 'Self-Employed Lending', 'Refinancing']),
      photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
      businessName: 'Capital Finance Hub (Demo)',
      businessRegNumber: '9429038882341',
      licenseNumber: 'FSP-719302',
      hourlyRate: 150,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.9,
      ratingCount: 29,
    },
    {
      email: 'claire.beaumont@propertytalk.co.nz',
      name: 'Claire Beaumont',
      countryCode: 'NZ',
      categorySlug: 'property-lawyer',
      title: 'Partner & Senior Property Conveyancing Solicitor',
      city: 'Christchurch',
      bio: 'Dedicated conveyancer and property solicitor. Extensive experience in title defect checks, cross-lease conversions, sale & purchase agreement reviews, and KiwiSaver withdrawals.',
      yearsOfExperience: 15,
      languages: JSON.stringify(['English', 'French']),
      specialities: JSON.stringify(['Title Investigations', 'Sale & Purchase Agreements', 'Canterbury EQC Rebuild Claims']),
      photoUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=400&auto=format&fit=crop&q=80',
      businessName: 'Beaumont Property Law (Demo)',
      businessRegNumber: '9429031119876',
      licenseNumber: 'NZLS-50291',
      hourlyRate: 220,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 5.0,
      ratingCount: 44,
    },
    {
      email: 'dave.mckinnon@propertytalk.co.nz',
      name: 'Dave McKinnon',
      countryCode: 'NZ',
      categorySlug: 'building-inspector',
      title: 'Accredited BOINZ Pre-Purchase Building Inspector',
      city: 'Auckland',
      bio: '18 years in residential construction and building pathology. Weathertightness, thermal imaging, moisture ingress testing, and comprehensive pre-purchase inspections.',
      yearsOfExperience: 18,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Monolithic Cladding', 'Moisture Scanning', 'Structural Due Diligence']),
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      businessName: 'Apex Building Inspections NZ (Demo)',
      businessRegNumber: '9429032223456',
      licenseNumber: 'BOINZ-8819',
      hourlyRate: 160,
      callPerMinuteRate: 2.5,
      isOnline: false,
      ratingAvg: 4.88,
      ratingCount: 52,
    },
    {
      email: 'sophie.hall@propertytalk.co.nz',
      name: 'Sophie Hall',
      countryCode: 'NZ',
      categorySlug: 'property-manager',
      title: 'Senior Licensed Property Manager & Tenancy Specialist',
      city: 'Auckland',
      bio: '10 years managing premium residential portfolios. Healthy Homes Standards compliance, tenant vetting, and dispute resolution.',
      yearsOfExperience: 10,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Healthy Homes Audit', 'Rental Yield Optimization', 'Tenancy Tribunal']),
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Harbour Residential Management (Demo)',
      businessRegNumber: '9429041239999',
      licenseNumber: 'REINZ-PM-2015',
      hourlyRate: 140,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.93,
      ratingCount: 26,
    },
    {
      email: 'thomas.cooper@propertytalk.co.nz',
      name: 'Thomas Cooper',
      countryCode: 'NZ',
      categorySlug: 'property-valuer',
      title: 'Registered Urban & Residential Property Valuer',
      city: 'Wellington',
      bio: 'Statutory registered valuer providing bank-accepted valuations, capital gain assessments, and pre-purchase equity evaluations.',
      yearsOfExperience: 13,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Mortgage Security Valuations', 'Probate & Estate Valuation', 'Insurance Rebuild Cost']),
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      businessName: 'Cooper Valuations NZ (Demo)',
      businessRegNumber: '9429048881234',
      licenseNumber: 'VRB-9021',
      hourlyRate: 190,
      callPerMinuteRate: 3.0,
      isOnline: true,
      ratingAvg: 4.97,
      ratingCount: 31,
    },
    {
      email: 'zoe.adams@propertytalk.co.nz',
      name: 'Zoe Adams',
      countryCode: 'NZ',
      categorySlug: 'insurance-adviser',
      title: 'Specialist Property & Landlord Insurance Broker',
      city: 'Christchurch',
      bio: 'Helping Kiwi buyers navigate full-replacement building cover, natural hazard insurance (EQC/Tokomapu), and landlord loss of rent policies.',
      yearsOfExperience: 8,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['High-hazard Zones', 'Landlord Liability', 'Pre-settlement Cover']),
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      businessName: 'Adams Property Insurance Advisors (Demo)',
      businessRegNumber: '9429047776543',
      licenseNumber: 'FSP-629103',
      hourlyRate: 150,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.91,
      ratingCount: 22,
    },
    {
      email: 'jack.taylor@propertytalk.co.nz',
      name: 'Jack Taylor',
      countryCode: 'NZ',
      categorySlug: 'builder-renovation',
      title: 'Licensed Building Practitioner (LBP) & Renovation Specialist',
      city: 'Auckland',
      bio: '20 years in residential renovations, villa restorations, and home extensions. Unbiased construction cost and feasibility guidance.',
      yearsOfExperience: 20,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Villa Renovations', 'Structural Alterations', 'Council Consents']),
      photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
      businessName: 'Taylor Craft Construction (Demo)',
      businessRegNumber: '9429046663210',
      licenseNumber: 'LBP-BP109284',
      hourlyRate: 175,
      callPerMinuteRate: 2.8,
      isOnline: false,
      ratingAvg: 4.86,
      ratingCount: 37,
    },
    {
      email: 'emily.chen@propertytalk.co.nz',
      name: 'Emily Chen',
      countryCode: 'NZ',
      categorySlug: 'property-tax-adviser',
      title: 'Chartered Property Tax Accountant & Bright-Line Specialist',
      city: 'Auckland',
      bio: 'Advising property investors on bright-line property rules, interest deductibility, LTC structuring, and GST on property development.',
      yearsOfExperience: 11,
      languages: JSON.stringify(['English', 'Mandarin']),
      specialities: JSON.stringify(['Bright-Line Test', 'Look-Through Companies', 'Development GST']),
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Chen Property Accounting (Demo)',
      businessRegNumber: '9429045551122',
      licenseNumber: 'CAANZ-48190',
      hourlyRate: 200,
      callPerMinuteRate: 3.2,
      isOnline: true,
      ratingAvg: 4.98,
      ratingCount: 41,
    },
    {
      email: 'hamish.mcdonald@propertytalk.co.nz',
      name: 'Hamish McDonald',
      countryCode: 'NZ',
      categorySlug: 'property-investment-expert',
      title: 'Senior Property Investment Strategist & Portfolio Advisor',
      city: 'Queenstown',
      bio: 'Helping investors acquire cash-flow and capital growth assets in NZ regions. Cash-flow modeling, yields, and strategic acquisition.',
      yearsOfExperience: 15,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Regional Yields', 'Queenstown Short-term Rentals', 'Portfolio Expansion']),
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      businessName: 'Alpine Property Strategy (Demo)',
      businessRegNumber: '9429044449988',
      licenseNumber: 'NZPIF-HON-819',
      hourlyRate: 210,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 4.92,
      ratingCount: 29,
    },

    // AUSTRALIA
    {
      email: 'marcus.vance@propertytalk.com.au',
      name: 'Marcus Vance',
      countryCode: 'AU',
      categorySlug: 'real-estate-agent',
      title: 'Licensed Estate Agent & Eastern Suburbs Buyer Advocate',
      city: 'Sydney',
      bio: 'Over 14 years representing buyers and sellers in Sydney and NSW regional hotspots. Expert negotiation, off-market acquisitions, and strata property evaluations.',
      yearsOfExperience: 14,
      languages: JSON.stringify(['English', 'Greek']),
      specialities: JSON.stringify(['Sydney Prestige', 'Off-Market Sourcing', 'Buyer Advocacy']),
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      businessName: 'Vance Property Group (Demo)',
      businessRegNumber: 'ABN 45 102 938 471',
      licenseNumber: 'NSW-LIC-20048123',
      hourlyRate: 200,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 4.96,
      ratingCount: 61,
    },
    {
      email: 'priya.sharma@propertytalk.com.au',
      name: 'Priya Sharma',
      countryCode: 'AU',
      categorySlug: 'mortgage-adviser',
      title: 'Accredited Mortgage Broker & Credit Specialist',
      city: 'Melbourne',
      bio: 'MFAA accredited broker accessing 40+ Australian major and boutique lenders. First home super saver scheme guidance, investor portfolio structuring, and expat financing.',
      yearsOfExperience: 8,
      languages: JSON.stringify(['English', 'Hindi', 'Punjabi']),
      specialities: JSON.stringify(['MFAA Member', 'Australian Expat Lending', 'Investor Portfolios']),
      photoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80',
      businessName: 'AusMortgage Partners (Demo)',
      businessRegNumber: 'ABN 88 493 021 954',
      licenseNumber: 'ACL-482910',
      hourlyRate: 150,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.92,
      ratingCount: 33,
    },
    {
      email: 'andrew.sterling@propertytalk.com.au',
      name: 'Andrew Sterling',
      countryCode: 'AU',
      categorySlug: 'property-lawyer',
      title: 'Principal Property Solicitor & Conveyancing Attorney',
      city: 'Brisbane',
      bio: 'Queensland Law Society accredited property law specialist. Guiding interstate buyers, off-the-plan contracts, body corporate bylaws, and stamp duty concessions.',
      yearsOfExperience: 11,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Off-the-Plan Contracts', 'Body Corporate Law', 'Foreign Investment (FIRB)']),
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      businessName: 'Sterling Legal Brisbane (Demo)',
      businessRegNumber: 'ABN 32 948 201 556',
      licenseNumber: 'QLS-P48190',
      hourlyRate: 210,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 4.89,
      ratingCount: 27,
    },
    {
      email: 'brett.walker@propertytalk.com.au',
      name: 'Brett Walker',
      countryCode: 'AU',
      categorySlug: 'building-inspector',
      title: 'Senior Master Builders Pest & Building Consultant',
      city: 'Perth',
      bio: '16 years diagnosing structural movement, termite activity, and construction compliance across Western Australia. Fast turnaround and plain-English reports.',
      yearsOfExperience: 16,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Timber Pest Inspections', 'Slab & Foundation Cracking', 'New Build Handover QA']),
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
      businessName: 'WestCoast Building Diagnostics (Demo)',
      businessRegNumber: 'ABN 71 839 201 443',
      licenseNumber: 'WA-BP-10294',
      hourlyRate: 155,
      callPerMinuteRate: 2.5,
      isOnline: false,
      ratingAvg: 4.94,
      ratingCount: 39,
    },
    {
      email: 'natasha.miller@propertytalk.com.au',
      name: 'Natasha Miller',
      countryCode: 'AU',
      categorySlug: 'property-manager',
      title: 'Licensed Senior Property Manager & Rental Strategist',
      city: 'Melbourne',
      bio: 'Victoria Consumer Affairs licensed property agent. Routine inspections, VCAT representation, lease negotiations, and proactive asset maintenance.',
      yearsOfExperience: 12,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['VCAT Hearings', 'High-Yield Residential', 'Melbourne Suburbs']),
      photoUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=400&auto=format&fit=crop&q=80',
      businessName: 'Miller Asset Management Melbourne (Demo)',
      businessRegNumber: 'ABN 62 819 304 912',
      licenseNumber: 'VIC-PM-082194',
      hourlyRate: 145,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.95,
      ratingCount: 34,
    },
    {
      email: 'david.harrison@propertytalk.com.au',
      name: 'David Harrison',
      countryCode: 'AU',
      categorySlug: 'property-valuer',
      title: 'Certified Practising Valuer (CPV) & Land Economist',
      city: 'Sydney',
      bio: 'Over 17 years valuing high-end residential and commercial assets throughout Sydney. Family law, stamp duty assessments, and bank finance valuations.',
      yearsOfExperience: 17,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Family Law Property Settlements', 'Capital Gains Tax Valuations', 'Pre-sale Appraisals']),
      photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
      businessName: 'Harrison Property Valuations (Demo)',
      businessRegNumber: 'ABN 19 402 819 223',
      licenseNumber: 'API-CPV-6812',
      hourlyRate: 220,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 4.98,
      ratingCount: 48,
    },
    {
      email: 'chloe.sullivan@propertytalk.com.au',
      name: 'Chloe Sullivan',
      countryCode: 'AU',
      categorySlug: 'insurance-adviser',
      title: 'Strata & Landlord Property Insurance Specialist',
      city: 'Brisbane',
      bio: 'Licensed general insurance broker helping Australian homeowners and landlords insure against storm, flood, accidental damage, and tenant default.',
      yearsOfExperience: 9,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Queensland Flood Cover', 'Strata Title Insurance', 'Landlord Default Protection']),
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Coastline Insurance Brokers (Demo)',
      businessRegNumber: 'ABN 83 291 048 571',
      licenseNumber: 'AFSL-481920',
      hourlyRate: 155,
      callPerMinuteRate: 2.5,
      isOnline: true,
      ratingAvg: 4.9,
      ratingCount: 25,
    },
    {
      email: 'lucas.martin@propertytalk.com.au',
      name: 'Lucas Martin',
      countryCode: 'AU',
      categorySlug: 'builder-renovation',
      title: 'Registered Master Builder & Renovation Consultant',
      city: 'Sydney',
      bio: 'Licensed residential builder specializing in home additions, structural wall removals, and pre-purchase building feasibility reports.',
      yearsOfExperience: 19,
      languages: JSON.stringify(['English', 'Italian']),
      specialities: JSON.stringify(['Structural Feasibility', 'Kitchen & Bath Expansions', 'Sydney Terrace Restorations']),
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      businessName: 'Martin & Co Master Builders (Demo)',
      businessRegNumber: 'ABN 51 928 304 819',
      licenseNumber: 'NSW-BLD-18920C',
      hourlyRate: 185,
      callPerMinuteRate: 3.0,
      isOnline: false,
      ratingAvg: 4.87,
      ratingCount: 31,
    },
    {
      email: 'michael.zhang@propertytalk.com.au',
      name: 'Michael Zhang',
      countryCode: 'AU',
      categorySlug: 'property-tax-adviser',
      title: 'Property Tax Agent & Quantity Depreciation Specialist',
      city: 'Melbourne',
      bio: 'Registered tax agent providing tax depreciation schedules (Division 40 & 43), negative gearing advice, and CGT reduction strategies.',
      yearsOfExperience: 14,
      languages: JSON.stringify(['English', 'Mandarin', 'Cantonese']),
      specialities: JSON.stringify(['Tax Depreciation Schedules', 'Negative Gearing Tax Planning', 'Foreign Resident CGT']),
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      businessName: 'Apex Tax & Depreciation Australia (Demo)',
      businessRegNumber: 'ABN 74 918 203 948',
      licenseNumber: 'TPB-25910482',
      hourlyRate: 195,
      callPerMinuteRate: 3.0,
      isOnline: true,
      ratingAvg: 4.96,
      ratingCount: 50,
    },
    {
      email: 'olivia.bennett@propertytalk.com.au',
      name: 'Olivia Bennett',
      countryCode: 'AU',
      categorySlug: 'property-investment-expert',
      title: 'Qualified Property Investment Adviser (QPIA) & Buyers Agent',
      city: 'Gold Coast',
      bio: 'PIPA accredited adviser structuring multi-property portfolios across Queensland and NSW high-growth corridors. Data-driven property selection.',
      yearsOfExperience: 13,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Queensland Growth Corridors', 'Off-Market Sourcing', 'Yield vs Growth Strategy']),
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Bennett Property Advisory (Demo)',
      businessRegNumber: 'ABN 49 109 283 746',
      licenseNumber: 'QPIA-91024',
      hourlyRate: 220,
      callPerMinuteRate: 3.5,
      isOnline: true,
      ratingAvg: 4.94,
      ratingCount: 42,
    },
  ];

  for (const exp of demoExperts) {
    const user = await prisma.user.upsert({
      where: { email: exp.email },
      update: { name: exp.name, countryCode: exp.countryCode },
      create: {
        email: exp.email,
        passwordHash: commonPassword,
        name: exp.name,
        role: 'EXPERT',
        countryCode: exp.countryCode,
      },
    });

    const categoryId = categoryMap.get(exp.categorySlug)!;

    const chatMinor = Math.round((exp.callPerMinuteRate || 3.0) * 100 * 0.8);
    const audioMinor = Math.round((exp.callPerMinuteRate || 3.0) * 100 * 0.85);
    const videoMinor = Math.round((exp.callPerMinuteRate || 3.0) * 100);

    const profile = await prisma.expertProfile.upsert({
      where: { userId: user.id },
      update: {
        isOnline: exp.isOnline,
        ratingAvg: exp.ratingAvg,
        ratingCount: exp.ratingCount,
        freeCallMinutes: 1,
        chatRateMinorUnits: chatMinor,
        audioRateMinorUnits: audioMinor,
        videoRateMinorUnits: videoMinor,
        paidConsultationsEnabled: true,
        payoutStatus: 'ACTIVE',
      },
      create: {
        userId: user.id,
        countryCode: exp.countryCode,
        categoryId,
        title: exp.title,
        bio: exp.bio,
        yearsOfExperience: exp.yearsOfExperience,
        city: exp.city,
        languages: exp.languages,
        specialities: exp.specialities,
        photoUrl: exp.photoUrl,
        businessName: exp.businessName,
        businessRegNumber: exp.businessRegNumber,
        licenseNumber: exp.licenseNumber,
        verificationStatus: 'VERIFIED',
        isOnline: exp.isOnline,
        hourlyRate: exp.hourlyRate,
        callPerMinuteRate: exp.callPerMinuteRate,
        chatRateMinorUnits: chatMinor,
        audioRateMinorUnits: audioMinor,
        videoRateMinorUnits: videoMinor,
        paidConsultationsEnabled: true,
        payoutStatus: 'ACTIVE',
        freeCallMinutes: 1,
        ratingAvg: exp.ratingAvg,
        ratingCount: exp.ratingCount,
        isDemo: true,
      },
    });

    // Create a demo verified document record
    await prisma.verificationDocument.createMany({
      data: [
        {
          expertProfileId: profile.id,
          docType: 'GOVERNMENT_ID',
          title: 'Passport / Photo ID (Verified)',
          fileUrl: 'https://placehold.co/600x400/png?text=Gov+Photo+ID+Verified',
        },
        {
          expertProfileId: profile.id,
          docType: 'LICENSE_CERTIFICATE',
          title: `Professional Registration Certificate (${exp.licenseNumber})`,
          fileUrl: 'https://placehold.co/600x400/png?text=License+Certificate+Verified',
        },
      ],
    });

    // Seed Availability Slots
    for (let day = 1; day <= 5; day++) {
      await prisma.appointmentSlot.create({
        data: {
          expertProfileId: profile.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true,
        },
      });
    }

    // Seed a sample review
    await prisma.review.upsert({
      where: {
        expertId_consumerId: {
          expertId: profile.id,
          consumerId: consumer.id,
        },
      },
      update: {},
      create: {
        expertId: profile.id,
        consumerId: consumer.id,
        rating: 5,
        comment: `Excellent advice! The 1-minute free consultation quickly confirmed what documents I needed, and we completed a full review immediately after. Highly recommended.`,
      },
    });
  }

  // 8. Seed 2 PENDING VERIFICATION Experts for the Super Admin Verification Queue
  const pendingExperts = [
    {
      email: 'hannah.clark@applicant.nz',
      name: 'Hannah Clark',
      countryCode: 'NZ',
      categorySlug: 'property-lawyer',
      title: 'Commercial & Residential Conveyancing Lawyer',
      city: 'Hamilton',
      bio: '7 years in conveyancing and commercial leases. Applying for verified status on PropertyTalk.',
      yearsOfExperience: 7,
      languages: JSON.stringify(['English']),
      specialities: JSON.stringify(['Commercial Leases', 'Residential Sales']),
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      businessName: 'Clark Legal Solutions Ltd',
      businessRegNumber: '9429045558881',
      licenseNumber: 'NZLS-78192',
      payoutDetails: 'ANZ Bank NZ: 01-0234-0987654-00',
    },
    {
      email: 'jason.reid@applicant.com.au',
      name: 'Jason Reid',
      countryCode: 'AU',
      categorySlug: 'real-estate-agent',
      title: 'Senior Buyers Agent & Property Valuer',
      city: 'Melbourne',
      bio: 'Experienced Melbourne property buyer advocate looking to consult interstate and expat purchasers.',
      yearsOfExperience: 10,
      languages: JSON.stringify(['English', 'Mandarin']),
      specialities: JSON.stringify(['Inner Melbourne', 'Auction Bidding']),
      photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
      businessName: 'Reid Property Advisory',
      businessRegNumber: 'ABN 19 827 364 510',
      licenseNumber: 'VIC-EA-098231',
      payoutDetails: 'Commonwealth Bank: BSB 063-000 Acc 12345678',
    },
  ];

  for (const pending of pendingExperts) {
    const user = await prisma.user.upsert({
      where: { email: pending.email },
      update: {},
      create: {
        email: pending.email,
        passwordHash: commonPassword,
        name: pending.name,
        role: 'EXPERT',
        countryCode: pending.countryCode,
      },
    });

    const categoryId = categoryMap.get(pending.categorySlug)!;

    const profile = await prisma.expertProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        countryCode: pending.countryCode,
        categoryId,
        title: pending.title,
        bio: pending.bio,
        yearsOfExperience: pending.yearsOfExperience,
        city: pending.city,
        languages: pending.languages,
        specialities: pending.specialities,
        photoUrl: pending.photoUrl,
        businessName: pending.businessName,
        businessRegNumber: pending.businessRegNumber,
        licenseNumber: pending.licenseNumber,
        payoutDetails: pending.payoutDetails,
        verificationStatus: 'PENDING_VERIFICATION', // Ready for admin review
        isOnline: false, // Cannot go online while unverified
        isDemo: true,
      },
    });

    await prisma.verificationDocument.createMany({
      data: [
        {
          expertProfileId: profile.id,
          docType: 'GOVERNMENT_ID',
          title: "Driver's License Photo (Front & Back)",
          fileUrl: 'https://placehold.co/600x400/png?text=Applicant+Drivers+License',
        },
        {
          expertProfileId: profile.id,
          docType: 'LICENSE_CERTIFICATE',
          title: `Practicing License Document (${pending.licenseNumber})`,
          fileUrl: 'https://placehold.co/600x400/png?text=Official+Licence+Doc',
        },
      ],
    });
  }

  console.log('✅ PropertyTalk database seeded successfully!');
  console.log('   - 2 Countries: NZ, AU');
  console.log('   - 10 Categories seeded and verified');
  console.log('   - 20 Verified Demo Professionals with reviews & availability');
  console.log('   - 2 Pending Experts in Super Admin verification queue');
  console.log('   - 1 Super Admin (admin@propertytalk.com / password123)');
  console.log('   - 1 Consumer (james.wilson@gmail.com / password123)');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
