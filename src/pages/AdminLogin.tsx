import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('UKHPV2026');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(async res => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (!res.ok) {
            throw new Error(data.error || 'Login failed');
          }
          return data;
        } catch (err: any) {
          throw new Error(err.message || 'Invalid response from server');
        }
      })
      .then(data => {
        setLoading(false);
        localStorage.setItem('hpv_admin_token', data.token);
        localStorage.setItem('hpv_admin_user', JSON.stringify(data.user));
        navigate('/admin');
      })
      .catch((err: any) => {
        console.error('Login error:', err);
        setLoading(false);
        setErrorMsg(err.message || 'Failed to connect to authentication server');
      });
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div className="bg-white rounded-[2rem] px-5 py-2 flex items-center justify-center shadow-sm shrink-0">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
        </div>
        <a
          href="/"
          className="text-xs font-semibold text-hpv-purple hover:text-hpv-purple-dark px-3 py-1.5 rounded-lg bg-hpv-purple-soft transition-colors"
        >
          Block Portal
        </a>
      </header>

      {/* Main Form */}
      <main className="max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 gradient-pink" />

          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-hpv-purple-dark text-hpv-pink mb-4 border border-hpv-pink/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              HPV Admin Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Authorized State & District Executive Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-hpv-pink focus:ring-2 focus:ring-hpv-pink/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-hpv-pink focus:ring-2 focus:ring-hpv-pink/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white gradient-pink shadow-lg shadow-hpv-pink/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'LOGIN TO ADMIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
            Initial Account Credentials: <span className="font-mono text-hpv-pink font-semibold">UKHPV2026</span>
          </div>
        </div>
      </main>

      <footer className="max-w-md mx-auto w-full text-center py-2 text-xs text-slate-500 space-y-2">
        <div>HPV Program Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-8 object-contain" />
        </div>
      </footer>
    </div>
  );
};
