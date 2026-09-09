import React, { useState } from 'react';
import { ShieldCheck, Info, X } from 'lucide-react';

interface VerifiedBadgeProps {
  categorySlug?: string;
  categoryName?: string;
  licenseNumber?: string;
  isVerified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showFullLabel?: boolean;
}

interface ProfessionCredential {
  shortLabel: string;
  fullLabel: string;
  authority: string;
  description: string;
}

const CREDENTIAL_MAP: Record<string, ProfessionCredential> = {
  'real-estate-agent': {
    shortLabel: 'REA Licensed',
    fullLabel: 'REA Licensed Real Estate Professional',
    authority: 'Real Estate Authority (REA)',
    description: 'Verified active licence on the official public register of the New Zealand Real Estate Authority.',
  },
  'mortgage-adviser': {
    shortLabel: 'FSPR Registered',
    fullLabel: 'FMA / FSPR Registered Financial Adviser',
    authority: 'Financial Markets Authority (FMA)',
    description: 'Verified on the Financial Service Providers Register under the Financial Markets Conduct Act.',
  },
  'insurance-adviser': {
    shortLabel: 'FSPR Licensed',
    fullLabel: 'FMA / FSPR Licensed Insurance Adviser',
    authority: 'Financial Markets Authority (FMA)',
    description: 'Verified qualified financial adviser authorized for personal and property risk products.',
  },
  'property-manager': {
    shortLabel: 'Verified PM',
    fullLabel: 'Residential Property Management Association Verified',
    authority: 'RPMA / Verified Trust Account',
    description: 'Verified identity, trust account compliance, and residential property management credentials.',
  },
  'property-lawyer': {
    shortLabel: 'NZLS Verified',
    fullLabel: 'NZ Law Society Verified Solicitor / Barrister',
    authority: 'New Zealand Law Society',
    description: 'Verified active practising certificate with fidelity fund coverage and solicitor trust accounting.',
  },
  'building-inspector': {
    shortLabel: 'NZIBI / BOINZ',
    fullLabel: 'NZIBI / BOINZ Certified Building Inspector',
    authority: 'NZ Institute of Building Inspectors',
    description: 'Certified inspector carrying active Professional Indemnity insurance compliant with NZS 4306:2005.',
  },
  'property-valuer': {
    shortLabel: 'VRB Licensed',
    fullLabel: 'Valuers Registration Board (VRB) Licensed',
    authority: 'Valuers Registration Board NZ',
    description: 'Registered valuer governed by the Valuers Act 1948 and Property Institute of New Zealand (PINZ).',
  },
  'builder-renovation': {
    shortLabel: 'LBP Certified',
    fullLabel: 'Licensed Building Practitioner (LBP)',
    authority: 'Ministry of Business, Innovation & Employment (MBIE)',
    description: 'Licensed building practitioner qualified to design, supervise, or carry out restricted building work.',
  },
  'property-tax-adviser': {
    shortLabel: 'CA ANZ / CPA',
    fullLabel: 'CA ANZ / CPA Licensed Property Tax Accountant',
    authority: 'Chartered Accountants ANZ / CPA',
    description: 'Chartered Accountant qualified in New Zealand bright-line rules, interest deductibility, and GST on property.',
  },
  'property-investment-expert': {
    shortLabel: 'Verified Expert',
    fullLabel: 'Verified Property Investment Specialist',
    authority: 'Property Institute / NZ Property Investors Federation',
    description: 'Vetted track record, verified financial modeling methodology, and regulatory compliance.',
  },
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  categorySlug,
  categoryName,
  licenseNumber,
  isVerified = true,
  size = 'sm',
  showFullLabel = false,
}) => {
  const [showModal, setShowModal] = useState(false);

  if (!isVerified) return null;

  const credential = (categorySlug && CREDENTIAL_MAP[categorySlug]) || {
    shortLabel: 'Verified Pro',
    fullLabel: 'Verified Property Professional',
    authority: 'PropertyTalk Verification Panel',
    description: 'Identity, business registration, and credentials audited and verified.',
  };

  const displayText = showFullLabel ? credential.fullLabel : credential.shortLabel;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        className={`inline-flex items-center font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-full transition shadow-2xs ${sizeClasses}`}
        title={`Click to view ${credential.fullLabel} details`}
      >
        <ShieldCheck className={`${iconSizes} text-emerald-600 shrink-0`} />
        <span>{displayText}</span>
      </button>

      {/* Verification Modal / Tooltip Sheet */}
      {showModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-slate-900 relative text-left"
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              Verified Professional
            </span>

            <h3 className="text-base font-black text-slate-900 mt-2">
              {credential.fullLabel}
            </h3>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {credential.description}
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Governing Body:</span>
                <span className="font-bold text-slate-800">{credential.authority}</span>
              </div>
              {licenseNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Licence / Reg No:</span>
                  <span className="font-bold text-slate-800 font-mono">#{licenseNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Verification Status:</span>
                <span className="font-bold text-emerald-600">Active & Audited</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
