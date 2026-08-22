import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parse } from 'csv-parse/browser/esm/sync';

export const SuperAdminUpload: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleDownloadTemplate = (type: 'block-pop' | 'city-pop' | 'block-live' | 'city-live') => {
    let headers = '';
    let filename = '';
    if (type === 'block-pop') {
      headers = 'State,District,Block,population\n';
      filename = 'Block_Population_Template.csv';
    } else if (type === 'city-pop') {
      headers = 'State,District,City,population\n';
      filename = 'City_Population_Template.csv';
    } else if (type === 'block-live') {
      headers = 'State,District,Block,linelisted,vaccinated\n';
      filename = 'Block_LiveData_Template.csv';
    } else if (type === 'city-live') {
      headers = 'State,District,City,linelisted,vaccinated\n';
      filename = 'City_LiveData_Template.csv';
    }

    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, apiEndpoint: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const records = parse(csvData, { columns: true, skip_empty_lines: true });

        const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ data: records })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        
        const errorText = json.errors?.length ? ` (with ${json.errors.length} errors, check console)` : '';
        setMessage({ type: 'success', text: `Successfully processed ${json.successCount} records${errorText}.` });
        if (json.errors?.length) {
          console.warn("Upload Warnings:", json.errors);
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to parse or upload CSV.' });
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Error reading file' });
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const renderSection = (title: string, btnText: string, type: 'block-pop' | 'city-pop' | 'block-live' | 'city-live', apiEndpoint: string, colorClass: string) => {
    return (
      <div className={`p-4 rounded-xl border ${colorClass} bg-white flex flex-col gap-3 justify-between shadow-sm hover:shadow-md transition-all`}>
        <div>
          <h3 className="font-bold text-slate-800 text-sm mb-1">{title}</h3>
          <p className="text-[10px] text-slate-500 mb-3">Upload bulk {title.toLowerCase()} via CSV file.</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => handleDownloadTemplate(type)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download Template
          </button>
          
          <label className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-hpv-purple text-white text-xs font-bold cursor-pointer hover:bg-hpv-purple-dark transition-colors text-center relative overflow-hidden">
            <UploadCloud className="w-4 h-4" />
            {btnText}
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={(e) => handleFileUpload(e, apiEndpoint)}
              disabled={loading}
            />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Super Admin CSV Upload</h1>
        <p className="text-slate-500 text-sm mt-1">Bulk upload population and live reporting data for blocks and cities.</p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading && (
        <div className="text-sm font-semibold text-hpv-purple animate-pulse">Processing CSV upload...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Population Section */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
            <UsersIcon className="w-5 h-5 text-indigo-500" />
            Upload Population Data
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderSection('Block Population', 'Upload Block Population', 'block-pop', '/api/superadmin/upload-population', 'border-indigo-100')}
            {renderSection('City Population', 'Upload City Population', 'city-pop', '/api/superadmin/upload-population', 'border-indigo-100')}
          </div>
        </div>

        {/* Live Data Section */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
            <ActivityIcon className="w-5 h-5 text-emerald-500" />
            Upload Live Data
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderSection('Block Live Data', 'Upload Block Live Data', 'block-live', '/api/superadmin/upload-livedata', 'border-emerald-100')}
            {renderSection('City Live Data', 'Upload City Live Data', 'city-live', '/api/superadmin/upload-livedata', 'border-emerald-100')}
          </div>
        </div>

      </div>
    </div>
  );
};

// Simple inline icons
const UsersIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);
