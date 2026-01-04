'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { AlertsResponse } from '@/lib/types';
import Button from './ui/Button';
import { cn } from '@/lib/utils';

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
    { href: '/alerts', label: 'Alerts', badge: openAlertCount },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and nav links */}
          <div className="flex items-center gap-8">
            <Link href="/patients" className="flex items-center">
              <span className="text-xl font-bold text-blue-600">Nephrawn</span>
              <span className="ml-2 text-sm text-gray-500">Clinician</span>
            </Link>

            {isAuthenticated && (
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
