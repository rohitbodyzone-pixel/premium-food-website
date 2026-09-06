import React, { createContext, useContext, useState, useEffect } from 'react';
import { Country } from '../types';
import { api } from '../services/api';

interface CountryContextType {
  selectedCountry: Country | null;
  countries: Country[];
  setCountryCode: (code: string) => void;
  isCountryModalOpen: boolean;
  setIsCountryModalOpen: (open: boolean) => void;
  loading: boolean;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export const CountryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(() => {
    return localStorage.getItem('pt_country') || '';
  });
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Country[]>('/countries')
      .then((data) => {
        setCountries(data);
        if (!selectedCode && data.length > 0) {
          // If none chosen yet, default to NZ or first country
          const initial = data.find((c) => c.code === 'NZ') || data[0];
          setSelectedCode(initial.code);
          localStorage.setItem('pt_country', initial.code);
        }
      })
      .catch((err) => console.error('Failed to load countries:', err))
      .finally(() => setLoading(false));
  }, []);

  const setCountryCode = (code: string) => {
    setSelectedCode(code);
    localStorage.setItem('pt_country', code);
    setIsCountryModalOpen(false);
  };

  const selectedCountry = countries.find((c) => c.code === selectedCode) || countries[0] || null;

  return (
    <CountryContext.Provider
      value={{
        selectedCountry,
        countries,
        setCountryCode,
        isCountryModalOpen,
        setIsCountryModalOpen,
        loading,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
};

export const useCountry = () => {
  const context = useContext(CountryContext);
  if (!context) throw new Error('useCountry must be used within a CountryProvider');
  return context;
};
