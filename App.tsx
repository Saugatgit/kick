import React, { useState, createContext, useContext, useEffect } from 'react';
import { User, UserRole, FutsalVenue } from './types';
import { api, getSession, clearSession, SESSION_KEY } from './services/api';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import OwnerSignup from './pages/OwnerSignup';
import UserDashboard from './pages/UserDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookingPage from './pages/BookingPage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (name: string, email: string, password?: string, role?: UserRole, avatar?: string) => Promise<boolean>;
  onboardOwner: (ownerData: any, venueData: any) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'auth' | 'owner-signup' | 'dashboard' | 'booking'>('home');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on page load
  useEffect(() => {
    const restoreSession = async () => {
      const session = getSession();
      
      if (session) {
        
        // Set user immediately for better UX
        setUser(session.user);
        
        // Verify token with backend
        const tokenValid = await api.verifyToken(session.token);
        
        if (tokenValid) {
          setCurrentPage('dashboard');
        } else {
          clearSession();
          setUser(null);
          setCurrentPage('home');
        }
      } else {
        setCurrentPage('home');
      }
      
      setLoading(false);
    };
    
    restoreSession();
  }, []);

  const login = async (email: string, password?: string) => {
    const loggedUser = await api.login(email, password);
    if (loggedUser) {
      setUser(loggedUser);
      setCurrentPage('dashboard');
      return true;
    }
    return false;
  };

  const register = async (name: string, email: string, password?: string, role: UserRole = UserRole.USER, avatar?: string) => {
    const newUser = await api.register({ name, email, password, role, avatar });
    if (newUser) {
      setUser(newUser);
      setCurrentPage('dashboard');
      return true;
    }
    return false;
  };

  const onboardOwner = async (ownerData: any, venueData: any) => {
    const result = await api.onboardOwner(ownerData, venueData);
    if (result) {
      setUser(result.user);
      setCurrentPage('dashboard');
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setCurrentPage('home');
    clearSession();
  };

  const navigateToBooking = (venueId: string) => {
    // ADD NULL CHECK HERE
    if (!user) {
      setCurrentPage('auth');
      return;
    }
    
    // ADD NULL CHECK FOR USER ROLE
    if (user.role !== UserRole.USER) {
      alert(`As an ${user.role.toLowerCase()}, you cannot book fields. This feature is for players only.`);
      return;
    }
    
    setSelectedVenueId(venueId);
    setCurrentPage('booking');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': 
        return <Home onBook={navigateToBooking} />;
        
      case 'auth': 
        return <Auth onLogin={login} onRegister={register} onOwnerSignup={() => setCurrentPage('owner-signup')} />;
        
      case 'owner-signup': 
        return <OwnerSignup onComplete={onboardOwner} onBack={() => setCurrentPage('auth')} />;
        
      case 'booking': 
        return selectedVenueId ? 
          <BookingPage venueId={selectedVenueId} onBack={() => setCurrentPage('home')} /> : 
          <Home onBook={navigateToBooking} />;
        
      case 'dashboard':
        // FIX: Check if user exists before accessing role
        if (!user) {
          // If no user but trying to access dashboard, go to auth
          return <Auth onLogin={login} onRegister={register} onOwnerSignup={() => setCurrentPage('owner-signup')} />;
        }
        
        // Now we know user is not null
        if (user.role === UserRole.ADMIN) 
          return <AdminDashboard />;
        if (user.role === UserRole.OWNER) 
          return <OwnerDashboard />;
        return <UserDashboard onBook={() => setCurrentPage('home')} />;
        
      default: 
        return <Home onBook={navigateToBooking} />;
    }
  };

  // Show loading screen while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Restoring your session...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, onboardOwner, logout, loading }}>
      <div className="min-h-screen flex flex-col">
        <Navbar 
          onNavigate={(page) => setCurrentPage(page as any)} 
          currentPage={currentPage}
        />
        <main className="flex-grow">
          {renderPage()}
        </main>
        <footer className="bg-slate-900 text-white py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h3 className="text-2xl font-bold text-green-400 mb-4">KickOff</h3>
              <p className="text-slate-400">The premier futsal booking platform for athletes and field owners.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-slate-400">
                <li>About Us</li>
                <li className="cursor-pointer hover:text-white" onClick={() => setCurrentPage('owner-signup')}>Register Your Venue</li>
                <li>Support Center</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <p className="text-slate-400">support@kickoff.com</p>
              <p className="text-slate-400">+1 (555) 000-KICK</p>
            </div>
          </div>
          <div className="text-center mt-12 pt-8 border-t border-slate-800 text-slate-500 text-sm">
            © 2026 KickOff Futsal System. All rights reserved.
          </div>
        </footer>
      </div>
    </AuthContext.Provider>
  );
};

export default App;