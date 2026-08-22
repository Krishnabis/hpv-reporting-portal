import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, Circle, Target, Activity, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Logo';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('UKHPV2026');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    if (token) {
      navigate('/admin');
    }

    fetch('/api/public/overall-stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Failed to fetch public stats:', err));
  }, [navigate]);

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
        if (rememberMe) {
          localStorage.setItem('hpv_admin_token', data.token);
          localStorage.setItem('hpv_admin_user', JSON.stringify(data.user));
        } else {
          sessionStorage.setItem('hpv_admin_token', data.token);
          sessionStorage.setItem('hpv_admin_user', JSON.stringify(data.user));
        }
        navigate('/admin');
      })
      .catch((err: any) => {
        console.error('Login error:', err);
        setLoading(false);
        setErrorMsg(err.message || 'Failed to connect to authentication server');
      });
  };

  if (!stats) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading System Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-50 flex flex-col justify-between p-2 sm:p-4">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div className="bg-white rounded-[2rem] px-5 py-2 flex items-center justify-center shadow-sm shrink-0">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
        </div>
        <a
          href="/"
          className="text-xs font-bold text-hpv-purple bg-hpv-purple-soft hover:bg-hpv-purple/20 px-4 py-2 rounded-xl transition-colors shrink-0"
        >
          Reporting Login
        </a>
      </header>

      {/* Main Form */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center min-h-0">
        <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-xl shadow-slate-200/60 relative overflow-hidden flex flex-col min-h-0">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />

          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-hpv-pink-soft text-hpv-pink-dark mb-2">
              <Circle className="w-2 h-2 fill-current" />
              National Health Mission – Uttarakhand
            </span>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              HPV Vaccination Program
            </h1>

            <div className="mt-1 flex items-center justify-center gap-2 text-sm font-bold text-hpv-purple">
              <span className="text-lg">🎯</span>
              Cervical Cancer Elimination
            </div>

            <p className="mt-2 text-[10px] font-medium text-slate-500 flex items-center justify-center gap-1.5 bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/50">
              <img src="https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg" alt="India Flag" className="w-3 h-2 rounded-[2px] shadow-sm" />
              <span>India: <strong className="text-slate-700">78,499</strong> new cases; <strong className="text-slate-700">42,392</strong> deaths <span className="text-[8px] text-slate-400">(NCRP-ICMR, 2024)</span></span>
            </p>
          </div>



          <form onSubmit={handleLogin} className="space-y-2 shrink-0">
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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-slate-50 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'ADMIN LOGIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500 hidden">
            Initial Account Credentials: <span className="font-mono text-emerald-600 font-semibold">UKHPV2026</span>
          </div>

          {/* Stats Boxes */}
          <div className="mt-3 pt-3 border-t border-slate-100 shrink-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-tight h-8 flex flex-col items-center justify-center text-center">
                  <span>Overall HPV</span>
                  <span>Vaccination Goal</span>
                </div>
                <div className="text-base font-extrabold text-slate-800 my-0.5 leading-none">&gt;90%</div>
                <div className="text-[9px] text-slate-500 font-semibold">Goal: &gt;{stats.total_target ? Math.round(stats.total_target * 0.90).toLocaleString('en-IN') : 0}</div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100/50 text-center flex flex-col justify-center">
                <div className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider leading-tight h-8 flex flex-col items-center justify-center text-center">
                  <span>Eligible girls</span>
                  <span>line listed</span>
                </div>
                <div className="text-base font-extrabold text-emerald-600 my-0.5 leading-none">{stats.overall_linelist_pct}%</div>
                <div className="text-[9px] font-semibold text-emerald-700/70">Count: {stats.total_line_list?.toLocaleString('en-IN')}</div>
              </div>

              <div className="bg-teal-50 rounded-xl p-2 border border-teal-100/50 text-center flex flex-col justify-center">
                <div className="text-[9px] font-bold text-teal-800 uppercase tracking-wider leading-tight h-8 flex flex-col items-center justify-center text-center">
                  <span>Eligible girls</span>
                  <span>vaccinated</span>
                </div>
                <div className="text-base font-extrabold text-teal-600 my-0.5 leading-none">{stats.overall_coverage_pct}%</div>
                <div className="text-[9px] font-semibold text-teal-700/70">Count: {stats.total_vaccinated?.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-md mx-auto w-full text-center py-2 text-xs text-slate-500 space-y-2">
        <div>HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
