'use client';

import { useAuth } from '@/contexts/AuthContext';
import Button from './ui/Button';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Nephrawn</span>
            <span className="ml-2 text-sm text-gray-500">Clinician</span>
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
