
import React, { useState, useRef } from 'react';
import { UserRole } from '../types';

interface AuthProps {
  onLogin: (email: string, password?: string) => Promise<boolean>;
  onRegister: (name: string, email: string, password?: string, role?: UserRole, avatar?: string) => Promise<boolean>;
  onOwnerSignup: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onRegister, onOwnerSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await onLogin(email, password);
    if (!success) {
      setError('Invalid credentials. Check the hint below.');
    }
    setLoading(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await onRegister(name, email, password, UserRole.USER, avatar || "😊");
    if (!success) {
      setError('An account with this email already exists.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 bg-slate-50">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-green-600"></div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800">{isLogin ? 'Welcome Back' : 'Join as Player'}</h2>
            <p className="text-slate-500 mt-2">
              {isLogin ? 'Log in to manage your matches' : 'Start booking pitches in seconds'}
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Log In</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sign Up</button>
          </div>

          <form onSubmit={isLogin ? handleLoginSubmit : handleRegisterSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" required />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" required />
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{isLogin ? 'Password' : 'Create Password'}</label>
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-10 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">{error}</div>}

            <button type="submit" disabled={loading} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]">
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Player Account')}
            </button>
          </form>

          {!isLogin && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 mb-4">Are you a Futsal Ground Owner?</p>
              <button onClick={onOwnerSignup} className="w-full py-3 bg-white border-2 border-green-600 text-green-700 font-bold rounded-xl hover:bg-green-50 transition-all">Register Your Futsal Business</button>
            </div>
          )}
        </div>

        {/* Developer Help Box */}
        <div className="mt-8 p-4 bg-slate-800 text-white rounded-2xl w-full text-xs font-mono shadow-inner border border-slate-700">
          <p className="text-green-400 font-bold mb-2 uppercase tracking-widest">Dev Credentials Hint:</p>
          <ul className="space-y-1 opacity-80">
            <li>User: <span className="text-green-200">saugat@gmail.com</span> / <span className="text-green-200">saugatu</span></li>
            <li>Owner: <span className="text-green-200">sau@gat.com</span> / <span className="text-green-200">saugat</span></li>
            <li>Owner: <span className="text-green-200">mike@futsal.com</span> / <span className="text-green-200">mike123</span></li>
            <li>Admin: <span className="text-green-200">admin@kickoff.com</span> / <span className="text-green-200">admin123</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Auth;
