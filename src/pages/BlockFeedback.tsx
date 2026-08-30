import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Settings, ChevronDown, ClipboardList, BarChart2, Package,
  MessageSquare, TrendingUp, CheckCircle2, AlertTriangle, Send, Info
} from 'lucide-react';

export const BlockFeedback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const navDropdownRef = useRef<HTMLDivElement>(null);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  // Form state
  const [reporterName, setReporterName] = useState('');
  const [roleDesignation, setRoleDesignation] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!blockId) { navigate('/'); return; }
    const token = localStorage.getItem(`hpv_block_token_${blockId}`) || sessionStorage.getItem(`hpv_block_token_${blockId}`);
    if (!token) { navigate('/'); return; }
  }, [blockId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setShowNavDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackType || !briefDescription.trim()) {
      setSubmitError('Please select a feedback type and provide a description.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: blockId,
          reporter_name: reporterName,
          role_designation: roleDesignation,
          mobile_number: mobileNumber,
          feedback_type: feedbackType,
          brief_description: briefDescription
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message);
    }
    setSubmitting(false);
  };

  const navItems = [
    { label: 'Daily Report', icon: ClipboardList, path: `/report?blockId=${blockId}`, active: false },
    { label: 'Monthly Due List Report', icon: BarChart2, path: `/due-list-report?blockId=${blockId}`, active: false },
    { label: 'HPV Vaccine Stock Balance Report', icon: Package, path: `/monthly-report?blockId=${blockId}`, active: false },
    { label: 'Trends', icon: TrendingUp, path: `/progress-trend?blockId=${blockId}`, active: false },
    { label: 'Feedback', icon: MessageSquare, path: `/feedback?blockId=${blockId}`, active: true },
  ];

  const feedbackTypes = [
    'Issue / Challenge / Bug',
    'Good Practice / Suggestion',
    'Other'
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between min-h-[60px]">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <img src="/headinglogo.png" alt="Logo" className="h-14 object-contain hover:opacity-80 transition-opacity" />
          </div>
          <div className="flex items-center gap-2">
            {/* Nav Dropdown */}
            <div className="relative" ref={navDropdownRef}>
              <button
                onClick={() => setShowNavDropdown(!showNavDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-hpv-purple-soft/40 hover:bg-hpv-purple-soft text-hpv-purple-dark text-xs font-bold transition-colors border border-hpv-purple/20"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Feedback
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNavDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showNavDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => { setShowNavDropdown(false); navigate(item.path); }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-3 transition-colors border-b border-slate-100 last:border-0
                        ${item.active ? 'bg-hpv-purple-soft/50 text-hpv-purple' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-hpv-purple' : 'text-slate-400'}`} />
                      {item.label}
                      {item.active && <span className="ml-auto text-[9px] bg-hpv-purple text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Current</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Settings */}
            <div className="relative">
              <button onClick={() => setShowSettingsDropdown(!showSettingsDropdown)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              {showSettingsDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                  <button onClick={() => { setShowSettingsDropdown(false); navigate(`/report?blockId=${blockId}`); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Change Passcode</button>
                  <button onClick={() => { localStorage.removeItem(`hpv_block_token_${blockId}`); sessionStorage.removeItem(`hpv_block_token_${blockId}`); navigate('/'); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100">Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-4 flex-1 space-y-4">
        {submitSuccess ? (
          /* Success State */
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Feedback Submitted!</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">Thank you. Your feedback has been recorded and will be reviewed by the concerned team.</p>
            </div>
            <button
              onClick={() => { setSubmitSuccess(false); setReporterName(''); setRoleDesignation(''); setMobileNumber(''); setFeedbackType(''); setBriefDescription(''); }}
              className="px-6 py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all"
            >
              Submit Another
            </button>
            <button
              onClick={() => navigate(`/report?blockId=${blockId}`)}
              className="text-sm font-bold text-hpv-purple hover:underline"
            >
              Back to Daily Report
            </button>
          </div>
        ) : (
          <>
            {/* Page Title */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Feedback Form</h2>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowInfoTooltip(true)}
                    onMouseLeave={() => setShowInfoTooltip(false)}
                    onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                    className="text-slate-400 hover:text-hpv-purple transition-colors"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {showInfoTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white text-[10px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
                      Use this form to report programme issues, challenges, system bugs, good practices or suggestions related to the HPV Vaccination Programme and/or HPV KAVACH. Feedback will be reviewed by the concerned team for appropriate action and follow-up.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Use this form to report issues, challenges, good practices or suggestions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Section A */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider">A. Reporter Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reporter Name</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={e => setReporterName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Role / Designation</label>
                    <input
                      type="text"
                      value={roleDesignation}
                      onChange={e => setRoleDesignation(e.target.value)}
                      placeholder="e.g. Block Programme Manager"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={e => setMobileNumber(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                    />
                  </div>
                </div>
              </div>

              {/* Section B */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider">B. Feedback</p>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Feedback Type *</label>
                  <div className="space-y-2">
                    {feedbackTypes.map(type => {
                      const colorMap: Record<string, string> = {
                        'Issue / Challenge / Bug': 'rose',
                        'Good Practice / Suggestion': 'emerald',
                        'Other': 'amber'
                      };
                      const color = colorMap[type];
                      const isSelected = feedbackType === type;
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? `border-${color}-400 bg-${color}-50`
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="feedbackType"
                            value={type}
                            checked={isSelected}
                            onChange={() => setFeedbackType(type)}
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? `border-${color}-500 bg-${color}-500` : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-sm font-semibold ${isSelected ? `text-${color}-700` : 'text-slate-600'}`}>{type}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Brief Description *</label>
                  <p className="text-[10px] text-slate-400 mb-2">Describe the issue, challenge, good practice or suggestion.</p>
                  <textarea
                    value={briefDescription}
                    onChange={e => setBriefDescription(e.target.value)}
                    rows={5}
                    placeholder="Please provide details here..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20 resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 text-right">{briefDescription.length} characters</p>
                </div>
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !feedbackType || !briefDescription.trim()}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                  : <><Send className="w-4 h-4" /> Submit Feedback</>
                }
              </button>
            </form>
          </>
        )}
      </main>

      <footer className="max-w-3xl mx-auto w-full text-center py-4 text-xs text-slate-400 px-4 space-y-2">
        <div className="font-medium text-[11px]">HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
