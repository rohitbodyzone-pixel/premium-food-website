export const DEFAULT_FREE_CALL_DURATION_SECONDS = 60; // 1 minute
export const DEFAULT_FREE_CONSULTATION_DURATION_SECONDS = 60; // 1 minute

export const INITIAL_COUNTRIES = [
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    currency: 'NZD',
    currencySymbol: '$',
    isActive: true,
    freeCallMinutesDefault: 1,
    legalText: 'Property professionals in New Zealand are governed by the Real Estate Agents Act 2008, Financial Services Legislation Amendment Act 2019, and Lawyers and Conveyancers Act 2006.'
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    currency: 'AUD',
    currencySymbol: '$',
    isActive: true,
    freeCallMinutesDefault: 1,
    legalText: 'Property professionals in Australia are licensed under state property regulations and Australian Securities and Investments Commission (ASIC) frameworks.'
  }
];

export const INITIAL_CATEGORIES = [
  {
    slug: 'real-estate-agent',
    name: 'Real Estate Agent',
    icon: 'Home',
    description: 'Licensed agents for buying, selling, market appraisals, and property negotiation.',
    displayOrder: 1,
  },
  {
    slug: 'mortgage-adviser',
    name: 'Mortgage Adviser',
    icon: 'Landmark',
    description: 'Registered finance brokers and mortgage advisers for home loans, pre-approvals, and refinancing.',
    displayOrder: 2,
  },
  {
    slug: 'property-lawyer',
    name: 'Property Lawyer / Conveyancer',
    icon: 'Scale',
    description: 'Specialist legal practitioners for contract reviews, settlements, title searches, and property law.',
    displayOrder: 3,
  },
  {
    slug: 'building-inspector',
    name: 'Building Inspector',
    icon: 'ShieldCheck',
    description: 'Accredited pre-purchase building inspectors, weathertightness, moisture, and structural experts.',
    displayOrder: 4,
  },
  {
    slug: 'property-manager',
    name: 'Property Manager',
    icon: 'Key',
    description: 'Licensed property management professionals for tenancy management, rental appraisals, and compliance.',
    displayOrder: 5,
  },
  {
    slug: 'property-valuer',
    name: 'Property Valuer',
    icon: 'Calculator',
    description: 'Registered property and land valuers for official mortgage valuations, probate, and capital assessments.',
    displayOrder: 6,
  },
  {
    slug: 'insurance-adviser',
    name: 'Insurance Adviser',
    icon: 'Shield',
    description: 'Licensed insurance advisers specializing in home, building, landlord, and property protection policies.',
    displayOrder: 7,
  },
  {
    slug: 'builder-renovation',
    name: 'Builder / Renovation Expert',
    icon: 'Hammer',
    description: 'Licensed builders and renovation contractors for feasibility, alterations, extensions, and defect remedies.',
    displayOrder: 8,
  },
  {
    slug: 'property-tax-adviser',
    name: 'Property Accountant / Tax Adviser',
    icon: 'FileText',
    description: 'Specialist property accountants for bright-line rules, negative gearing, depreciation, and tax structures.',
    displayOrder: 9,
  },
  {
    slug: 'property-investment-expert',
    name: 'Property Investment Expert',
    icon: 'TrendingUp',
    description: 'Experienced property investment strategists, buyer agents, and portfolio growth specialists.',
    displayOrder: 10,
  }
];

export const INITIAL_OFFICIAL_REGISTERS = [
  // New Zealand
  {
    countryCode: 'NZ',
    categorySlug: 'real-estate-agent',
    title: 'NZ Real Estate Authority (REA) Public Register',
    urlPattern: 'https://www.rea.govt.nz/public-register/',
    notes: 'Verify individual license status, agency affiliation, and disciplinary history.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'mortgage-adviser',
    title: 'NZ Financial Service Providers Register (FSPR)',
    urlPattern: 'https://fsp-register.companiesoffice.govt.nz/',
    notes: 'Search FSP number to ensure registration and dispute resolution scheme membership.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'property-lawyer',
    title: 'New Zealand Law Society Register',
    urlPattern: 'https://www.lawsociety.org.nz/for-the-public/get-legal-help/find-a-lawyer/',
    notes: 'Confirm current practicing certificate in New Zealand.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'building-inspector',
    title: 'NZ Institute of Building Inspectors (NZIBI) / BOINZ',
    urlPattern: 'https://www.nzibi.co.nz/find-an-inspector/',
    notes: 'Check accredited inspector status and insurance requirements.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'property-manager',
    title: 'Real Estate Institute of NZ (REINZ) Property Management Register',
    urlPattern: 'https://www.reinz.co.nz/find-an-agency',
    notes: 'Verify accredited property management qualifications and trust accounting.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'property-valuer',
    title: 'New Zealand Valuers Registration Board (VRB)',
    urlPattern: 'https://www.linz.govt.nz/regulatory/valuers-registration-board',
    notes: 'Confirm valid statutory registration as a Registered Valuer in NZ.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'insurance-adviser',
    title: 'Financial Markets Authority (FMA) / FSPR Insurance Register',
    urlPattern: 'https://fsp-register.companiesoffice.govt.nz/',
    notes: 'Verify financial advice provider license and dispute scheme.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'builder-renovation',
    title: 'Licensed Building Practitioners (LBP) Register NZ',
    urlPattern: 'https://lbp.digital.business.govt.nz/public-register',
    notes: 'Check license class (Carpentry, Site, Design) and suspension history.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'property-tax-adviser',
    title: 'Chartered Accountants Australia and New Zealand (CA ANZ)',
    urlPattern: 'https://www.charteredaccountantsanz.com/find-a-ca',
    notes: 'Confirm CA ANZ / CPA professional accreditation.'
  },
  {
    countryCode: 'NZ',
    categorySlug: 'property-investment-expert',
    title: 'New Zealand Property Investors Federation (NZPIF) Directory',
    urlPattern: 'https://www.nzpif.org.nz/',
    notes: 'Check verified credentials and code of ethics adherence.'
  },

  // Australia
  {
    countryCode: 'AU',
    categorySlug: 'real-estate-agent',
    title: 'Australian State Fair Trading & Property Register',
    urlPattern: 'https://www.onegov.nsw.gov.au/publicregister/',
    notes: 'Check state-level real estate agent licenses and registrations.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'mortgage-adviser',
    title: 'ASIC Professional Registers (Credit Licensees & Advisers)',
    urlPattern: 'https://connectonline.asic.gov.au/RegistrySearch/faces/landing/ProfessionalRegisters.jspx',
    notes: 'Verify Australian Credit License (ACL) or Credit Representative number.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'property-lawyer',
    title: 'Law Society of NSW / Legal Services Board Register',
    urlPattern: 'https://www.lawsociety.com.au/for-the-public/finding-a-lawyer',
    notes: 'Verify current Australian legal practitioner certificate.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'building-inspector',
    title: 'Master Builders Australia & HIA Member Directory',
    urlPattern: 'https://www.masterbuilders.com.au/find-a-builder',
    notes: 'Verify credentials and professional indemnity insurance.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'property-manager',
    title: 'Australian State Fair Trading Property Manager Licensing',
    urlPattern: 'https://www.consumer.vic.gov.au/licensing-and-registration',
    notes: 'Verify state real estate & property management agent license.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'property-valuer',
    title: 'Australian Property Institute (API) Certified Practising Valuer',
    urlPattern: 'https://www.api.org.au/find-a-member/',
    notes: 'Verify API Certified Practising Valuer (CPV) accreditation.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'insurance-adviser',
    title: 'ASIC Australian Financial Services Licensee (AFSL) Register',
    urlPattern: 'https://connectonline.asic.gov.au/',
    notes: 'Confirm AFSL authorization for general or life insurance advice.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'builder-renovation',
    title: 'Victorian Building Authority (VBA) / NSW Fair Trading Builder Check',
    urlPattern: 'https://www.vba.vic.gov.au/tools/find-practitioner',
    notes: 'Verify registered domestic builder unlimited license.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'property-tax-adviser',
    title: 'Tax Practitioners Board (TPB) Australian Public Register',
    urlPattern: 'https://www.tpb.gov.au/public-register',
    notes: 'Confirm registered tax agent number and compliance status.'
  },
  {
    countryCode: 'AU',
    categorySlug: 'property-investment-expert',
    title: 'Property Investment Professionals of Australia (PIPA)',
    urlPattern: 'https://www.pipa.asn.au/find-a-member/',
    notes: 'Verify Qualified Property Investment Adviser (QPIA) status.'
  }
];

