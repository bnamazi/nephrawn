'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  href: string;
}

interface TabNavProps {
  tabs: Tab[];
  basePath: string;
}

export default function TabNav({ tabs, basePath }: TabNavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200">
      <div className="flex space-x-8">
        {tabs.map((tab) => {
          const fullPath = `${basePath}${tab.href}`;
          const isActive = tab.href === ''
            ? pathname === basePath
            : pathname.startsWith(fullPath);

          return (
            <Link
              key={tab.href}
              href={fullPath}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
