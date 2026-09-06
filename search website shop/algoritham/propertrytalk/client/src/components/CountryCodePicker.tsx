import React from 'react';

export interface SupportedCountryPhone {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  placeholder: string;
}

export const SUPPORTED_COUNTRY_PHONES: SupportedCountryPhone[] = [
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64', placeholder: '021 123 4567' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61', placeholder: '0412 345 678' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91', placeholder: '98765 43210' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', placeholder: '07911 123456' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', placeholder: '(555) 234-5678' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1', placeholder: '(555) 234-5678' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65', placeholder: '8123 4567' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', dialCode: '+852', placeholder: '9123 4567' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27', placeholder: '071 123 4567' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', dialCode: '+971', placeholder: '050 123 4567' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353', placeholder: '085 123 4567' },
];

interface CountryCodePickerProps {
  value: string; // Country code e.g. 'NZ'
  onChange: (country: SupportedCountryPhone) => void;
  disabled?: boolean;
  className?: string;
}

export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const current = SUPPORTED_COUNTRY_PHONES.find((c) => c.code.toUpperCase() === (value || 'NZ').toUpperCase()) || SUPPORTED_COUNTRY_PHONES[0];

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = SUPPORTED_COUNTRY_PHONES.find((c) => c.code === e.target.value);
    if (selected) {
      onChange(selected);
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={current.code}
        onChange={handleSelectChange}
        disabled={disabled}
        aria-label="Select Country Dial Code"
        className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-7 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {SUPPORTED_COUNTRY_PHONES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} ({c.dialCode})
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[10px]">
        ▼
      </div>
    </div>
  );
};
