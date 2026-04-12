import React from 'react';
import { useAuth } from '../App';
import { UserRole } from '../types';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage }) => {
  const { user, logout } = useAuth();

  const renderAvatar = (avatarUrl: string | undefined) => {
    if (!avatarUrl || avatarUrl.length < 5) { // Simple check for emoji vs URL
      return (
        <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-lg">
          {avatarUrl || '😊'}
        </div>
      );
    }
    return <img src={avatarUrl} className="w-8 h-8 rounded-full border border-slate-200 object-cover" alt="Avatar" />;
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => onNavigate('home')}
        >
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">KickOff</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => onNavigate('home')}
            className={`font-medium ${currentPage === 'home' ? 'text-green-600' : 'text-slate-600 hover:text-green-600'}`}
          >
            Venues
          </button>
          {!user ? (
            <button 
              onClick={() => onNavigate('auth')}
              className="px-5 py-2 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition-colors"
            >
              Sign In
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onNavigate('dashboard')}
                className={`font-medium ${currentPage === 'dashboard' ? 'text-green-600' : 'text-slate-600 hover:text-green-600'}`}
              >
                {user.role === UserRole.ADMIN ? 'Admin Panel' : 'Dashboard'}
              </button>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="flex items-center gap-3">
                {renderAvatar(user.avatar)}
                <button 
                  onClick={logout}
                  className="text-sm font-semibold text-slate-500 hover:text-red-600"
                >
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;