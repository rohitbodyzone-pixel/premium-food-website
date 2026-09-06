import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Category, Country } from '../types';
import { api } from '../services/api';
import {
  ShieldCheck,
  Building,
  CreditCard,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const ExpertOnboardingPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [countryCode, setCountryCode] = useState('NZ');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('5');
  const [specialitiesInput, setSpecialitiesInput] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=register&role=EXPERT');
      return;
    }

    Promise.all([
      api.get<Category[]>('/categories'),
      api.get<Country[]>('/countries'),
      api.get<any>('/expert/onboarding/status').catch(() => null),
    ])
      .then(([cats, cnts, status]) => {
        setCategories(cats);
        setCountries(cnts);
        if (cats.length > 0) setCategoryId(cats[0].id);
        if (status?.hasProfile) {
          setStatusData(status);
          const p = status.profile;
          setCountryCode(p.countryCode || 'NZ');
          setCategoryId(p.categoryId || (cats[0] ? cats[0].id : ''));
          setTitle(p.title || '');
          setBusinessName(p.businessName || '');
          setBusinessRegNumber(p.businessRegNumber || '');
          setLicenseNumber(p.licenseNumber || '');
          setPayoutDetails(p.payoutDetails || '');
          setBio(p.bio || '');
          setCity(p.city || '');
          setYearsOfExperience(String(p.yearsOfExperience || '5'));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');

    try {
      const specialities = specialitiesInput
        ? specialitiesInput.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Residential Property', 'Contract Review'];

      const res = await api.post<any>('/expert/onboarding/apply', {
        countryCode,
        categoryId,
        title,
        businessName,
        businessRegNumber,
        licenseNumber,
        payoutDetails,
        bio,
        city: city || (countryCode === 'NZ' ? 'Auckland' : 'Sydney'),
        yearsOfExperience: parseInt(yearsOfExperience, 10),
        specialities,
      });

      setSuccessMsg('Your application has been submitted and is currently in the Super Admin verification queue.');
      await refreshUser();
      const newStatus = await api.get<any>('/expert/onboarding/status');
      setStatusData(newStatus);
    } catch (err: any) {
      alert(err.message || 'Failed to submit onboarding application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse h-96" />
      </div>
    );
  }

  const currentStatus = statusData?.profile?.verificationStatus || 'DRAFT';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Professional Verification & Onboarding
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
          PropertyTalk is a verified marketplace. Professionals must submit registration credentials before appearing in the directory or offering consultations.
        </p>
      </div>

      {/* Verification Status Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">
              Current Application Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  currentStatus === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : currentStatus === 'PENDING_VERIFICATION'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentStatus}
              </span>
              {currentStatus === 'VERIFIED' && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Authorized to Consult
                </span>
              )}
            </div>
          </div>

          {currentStatus === 'VERIFIED' && (
            <button
              onClick={() => navigate('/expert/dashboard')}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-700 transition"
            >
              Go to Expert Dashboard
            </button>
          )}
        </div>

        {/* Status explanation */}
        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          {currentStatus === 'VERIFIED' ? (
            <p className="text-emerald-800">
              🎉 Congratulations! Your credentials have been verified by Super Admin against official public registers. You can now toggle Online and receive calls.
            </p>
          ) : currentStatus === 'PENDING_VERIFICATION' ? (
            <p className="text-amber-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Your application is in the Super Admin verification queue. Admin will check your license number on the official register before activating your account.
              </span>
            </p>
          ) : (
            <p>
              Please complete the minimum required verification fields below. Unverified professionals cannot appear as verified or go online.
            </p>
          )}
        </div>
      </div>

      {/* Onboarding Application Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Verification Application
        </h2>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Country & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jurisdiction Country *
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Professional Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Professional Title & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Professional Title / Role *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Conveyancing Lawyer / Licensed Real Estate Agent"
              className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              City / Region *
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={countryCode === 'NZ' ? 'e.g. Auckland, Wellington' : 'e.g. Sydney, Melbourne'}
              className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>
        </div>

        {/* 3. Official License & Business Details (Crucial for manual admin verification) */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Licence & Register Verification Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Licence / Registration Number *
              </label>
              <input
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder={countryCode === 'NZ' ? 'e.g. REA-2009124 or FSP-719302' : 'e.g. NSW-LIC-2004812 or ACL-482910'}
                className="w-full text-xs font-mono font-medium p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Checked on the public register by Super Admin
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business / Agency Name *
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Barfoot & Thompson or Ray White"
                className="w-full text-xs font-medium p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Registration Number ({countryCode === 'NZ' ? 'NZBN' : 'ABN'})
              </label>
              <input
                type="text"
                value={businessRegNumber}
                onChange={(e) => setBusinessRegNumber(e.target.value)}
                placeholder={countryCode === 'NZ' ? 'e.g. 9429040001234' : 'e.g. ABN 45 102 938 471'}
                className="w-full text-xs font-medium p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank / Payout Details (Secure)
              </label>
              <input
                type="text"
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder="e.g. ANZ Bank: 01-0234-0987654-00"
                className="w-full text-xs font-medium p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* 4. Bio & Specialities */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Professional Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Describe your background, years in property, types of clients assisted..."
            rows={3}
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Specialities (comma separated)
          </label>
          <input
            type="text"
            value={specialitiesInput}
            onChange={(e) => setSpecialitiesInput(e.target.value)}
            placeholder="e.g. First Home Buyers, Auction Strategy, Off-Market Sales"
            className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>{submitting ? 'Submitting Application...' : 'Submit Verification Application'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
