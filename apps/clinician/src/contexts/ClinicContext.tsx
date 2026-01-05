'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { Clinic, ClinicsResponse } from '@/lib/types';
import { useAuth } from './AuthContext';

interface ClinicContextType {
  clinics: Clinic[];
  selectedClinic: Clinic | null;
  setSelectedClinic: (clinic: Clinic | null) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

const SELECTED_CLINIC_KEY = 'nephrawn_selected_clinic_id';

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinicState] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClinics = async () => {
    if (!isAuthenticated) {
      setClinics([]);
      setSelectedClinicState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<ClinicsResponse>('/clinician/clinics');
      setClinics(response.clinics);

      // Restore previously selected clinic or default to first
      const savedClinicId = localStorage.getItem(SELECTED_CLINIC_KEY);
      const savedClinic = response.clinics.find((c) => c.id === savedClinicId);

      if (savedClinic) {
        setSelectedClinicState(savedClinic);
      } else if (response.clinics.length > 0) {
        setSelectedClinicState(response.clinics[0]);
      }
    } catch (err) {
      setError('Failed to load clinics');
      console.error('Failed to fetch clinics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, [isAuthenticated]);

  const setSelectedClinic = (clinic: Clinic | null) => {
    setSelectedClinicState(clinic);
    if (clinic) {
      localStorage.setItem(SELECTED_CLINIC_KEY, clinic.id);
    } else {
      localStorage.removeItem(SELECTED_CLINIC_KEY);
    }
  };

  return (
    <ClinicContext.Provider
      value={{
        clinics,
        selectedClinic,
        setSelectedClinic,
        isLoading,
        error,
        refetch: fetchClinics,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}
