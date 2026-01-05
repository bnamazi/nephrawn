'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { api } from '@/lib/api';
import { AlertsResponse } from '@/lib/types';
import Button from './ui/Button';
import { cn } from '@/lib/utils';

function ClinicSwitcher() {
  const { clinics, selectedClinic, setSelectedClinic, isLoading } = useClinic();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />;
  }

  if (clinics.length === 0) {
    return null;
  }

  // Single clinic - just show the name, no dropdown
  if (clinics.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-700">{clinics[0].name}</span>
      </div>
    );
  }

  // Multiple clinics - show dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-700">
          {selectedClinic?.name || 'Select Clinic'}
        </span>
        <svg
          className={cn('w-4 h-4 text-gray-500 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
          {clinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => {
                setSelectedClinic(clinic);
                setIsOpen(false);
              }}
              className={cn(
                'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between',
                clinic.id === selectedClinic?.id && 'bg-blue-50 text-blue-700'
              )}
            >
              <span>{clinic.name}</span>
              {clinic.id === selectedClinic?.id && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [openAlertCount, setOpenAlertCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAlertCount = async () => {
      try {
        const response = await api.get<AlertsResponse>('/clinician/alerts?status=OPEN');
        setOpenAlertCount(response.alerts.length);
      } catch {
        // Silently fail - navbar shouldn't block on alert count
      }
    };

    fetchAlertCount();
    // Refresh count every 60 seconds
    const interval = setInterval(fetchAlertCount, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const navLinks = [
    { href: '/patients', label: 'Patients' },
    { href: '/invites', label: 'Invites' },
    { href: '/alerts', label: 'Alerts', badge: openAlertCount },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo, clinic switcher, and nav links */}
          <div className="flex items-center gap-6">
            <Link href="/patients" className="flex items-center">
              <span className="text-xl font-bold text-blue-600">Nephrawn</span>
              <span className="ml-2 text-sm text-gray-500">Clinician</span>
            </Link>

            {isAuthenticated && (
              <>
                <ClinicSwitcher />
                <div className="flex items-center gap-1">
                  {navLinks.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        {link.label}
                        {link.badge !== undefined && link.badge > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right side */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
