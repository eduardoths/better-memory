import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-lg"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="font-bold text-blue-600 hover:text-blue-700 text-lg transition-colors"
          >
            BetterMemory
          </button>
          <span className="text-gray-300 text-sm ml-auto hidden sm:block">
            Spaced repetition
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {children}
      </main>
    </div>
  );
}
