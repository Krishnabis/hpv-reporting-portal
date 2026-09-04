import React, { useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { BlockShell, useBlock } from '../components/BlockShell';

const FEEDBACK_TYPES = ['Issue / Challenge / Bug', 'Good Practice / Suggestion', 'Other'] as const;
const COLOR_MAP: Record<string, string> = {
  'Issue / Challenge / Bug': 'rose',
  'Good Practice / Suggestion': 'emerald',
  'Other': 'amber',
};

const FeedbackContent: React.FC = () => {
  const { blockId } = useBlock();
  const [reporterName, setReporterName] = useState('');
  const [roleDesignation, setRoleDesignation] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackType || !briefDescription.trim()) { setSubmitError('Please select a feedback type and provide a description.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_id: blockId, reporter_name: reporterName, role_designation: roleDesignation, mobile_number: mobileNumber, feedback_type: feedbackType, brief_description: briefDescription })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitSuccess(true);
    } catch (err: any) { setSubmitError(err.message); }
    setSubmitting(false);
  };

  const handleReset = () => {
    setSubmitSuccess(false); setReporterName(''); setRoleDesignation('');
    setMobileNumber(''); setFeedbackType(''); setBriefDescription(''); setSubmitError('');
  };

  return (
    <div className="space-y-3">
      {submitSuccess ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">Feedback Submitted!</h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs">Thank you. Your feedback has been recorded and will be reviewed by the concerned team.</p>
          </div>
          <button onClick={handleReset} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all">
            Submit Another
          </button>
        </div>
      ) : (
        <>
          {/* Title */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-slate-900">Feedback Form</h2>
              <div className="relative">
                <button onMouseEnter={() => setShowInfoTooltip(true)} onMouseLeave={() => setShowInfoTooltip(false)} className="text-slate-400 hover:text-hpv-purple transition-colors">
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showInfoTooltip && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-72 bg-slate-800 text-white text-[9px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
                    Use this form to report programme issues, challenges, bugs, good practices or suggestions related to the HPV Vaccination Programme. Feedback will be reviewed for appropriate action.
                    <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Report issues, challenges, good practices or suggestions.</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Reporter Info */}
              <div className="space-y-3">
                <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider border-b border-slate-100 pb-1.5">A. Reporter Information</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reporter Name</label>
                    <input type="text" value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="Your name"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-1 focus:ring-hpv-purple/20"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Role / Designation</label>
                    <input type="text" value={roleDesignation} onChange={e => setRoleDesignation(e.target.value)} placeholder="e.g. BPM"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-1 focus:ring-hpv-purple/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mobile Number</label>
                    <input type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="10-digit mobile number"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-1 focus:ring-hpv-purple/20"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Feedback Details */}
              <div className="space-y-3">
                <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider border-b border-slate-100 pb-1.5">B. Feedback Details</p>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Feedback Type *</label>
                  <div className="flex gap-1.5">
                    {FEEDBACK_TYPES.map(type => {
                      const color = COLOR_MAP[type];
                      const isSelected = feedbackType === type;
                      return (
                        <label key={type} className={`flex-1 flex flex-col items-center justify-center text-center p-1.5 rounded-lg border cursor-pointer transition-all ${isSelected ? `border-${color}-400 bg-${color}-50` : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}>
                          <input type="radio" name="feedbackType" value={type} checked={isSelected} onChange={() => setFeedbackType(type)} className="hidden" />
                          <span className={`text-[9px] font-bold leading-tight ${isSelected ? `text-${color}-700` : 'text-slate-600'}`}>{type.replace(' / ', '\n')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Brief Description *</label>
                  <textarea value={briefDescription} onChange={e => setBriefDescription(e.target.value)} rows={2} placeholder="Please provide details here..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-1 focus:ring-hpv-purple/20 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
              {submitError && (
                <div className="flex-1 w-full px-3 py-2 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                </div>
              )}
              <button type="submit" disabled={submitting || !feedbackType || !briefDescription.trim()}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${submitError ? 'w-full sm:w-auto shrink-0' : 'w-full ml-auto sm:w-1/3'}`}>
                {submitting ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : <><Send className="w-3.5 h-3.5" /> Submit Feedback</>}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export const BlockFeedback: React.FC = () => (
  <BlockShell currentPage="feedback">
    <FeedbackContent />
  </BlockShell>
);
