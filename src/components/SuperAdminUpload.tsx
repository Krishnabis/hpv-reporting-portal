import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parse } from 'csv-parse/browser/esm/sync';

export const SuperAdminUpload: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string, errors?: string[], successes?: string[] } | null>(null);

  const handleDownloadTemplate = (type: 'population' | 'livedata' | 'locations' | 'vaccine_ccp' | 'stock_receive' | 'stock_issue') => {
    let headers = '';
    let filename = '';
    if (type === 'population') {
      headers = 'State,District,BlockOrCity,population\n';
      filename = 'Population_Template.csv';
    } else if (type === 'livedata') {
      headers = 'statename,districtlgdcode,districtname,blocklgdcode,blockname,linelisted,vaccinated,Date(DD-MM-YYYY)\n';
      filename = 'LiveData_Template.csv';
    } else if (type === 'locations') {
      headers = 'sno,countrycode,countryname,statelgdcode,statename,divisioncode,divisionname,districtlgdcode,districtname,blockorcitylgdcode,blockorcityname,urbanorrural,Urbantype,HQ(Y/N),DVS(Y/N),Healthblockname,population,districtthpvtarget,linelisted,vaccinated,Date(YYYY-MM-DD)\n';
      filename = 'Locations_Template.csv';
    } else if (type === 'vaccine_ccp') {
      headers = 'Country Code,Country Name,State Code,State Name,Division Code,Division Name,District Code,District Name,Block / City Code,Block / City Name,Facility Name,Health Facility  Type,Facility acronym,Setting,ULB Code,ULB Type,Sub District Name,Pin Code,Address,Latitude,Longitude,Alt.,Health Facility Group,Ownership,Parent organization,Hospital Facility ID,ABDM Org Facility ID,Department Name,Department Type,Service Domain,Service Catgeory,Service,Service Unit,UNIT Level,UNIT Sub Level,UNIT TYPE,Name of UNIT Incharge,CCL ID,CCLBlock HQ (Yes),Contact Number,Status\n';
      filename = 'Vaccine_CCP_Template.csv';
    } else if (type === 'stock_receive') {
      headers = 'Date,Quantity,Batch No,Batch Expiry,Manufacturer,VVM Status,Source Level,Source CCL ID,Source CCL Name,Destination Level,Destination CCL ID,Destination CCL Name,Remarks\n';
      filename = 'Stock_Receive_Template.csv';
    } else if (type === 'stock_issue') {
      headers = 'Date,Quantity,Batch No,Manufacturer,Source Level,Source CCL ID,Source CCL Name,Destination Level,Destination CCL ID,Destination CCL Name,Remarks\n';
      filename = 'Stock_Issue_Template.csv';
    }

    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTable = async (type: 'population' | 'livedata' | 'locations' | 'vaccine_ccp' | 'stock_receive' | 'stock_issue') => {
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const res = await fetch(`/api/superadmin/export-table/${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch table data');
      const data = await res.json();
      
      if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) {
        alert('No data found in this table.');
        return;
      }
      
      const downloadCSV = (tableData: any[], filename: string) => {
        if (!tableData || tableData.length === 0) return;
        const headers = Object.keys(tableData[0]);
        const csvRows = [headers.join(',')];
        
        for (const row of tableData) {
          const values = headers.map(header => {
            const val = row[header];
            const str = (val === null || val === undefined) ? '' : String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          csvRows.push(values.join(','));
        }
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      };

      if (Array.isArray(data)) {
        downloadCSV(data, `${type}_table_export.csv`);
      } else {
        // It's an object with multiple arrays (e.g., locations)
        for (const key of Object.keys(data)) {
          downloadCSV(data[key], `${key}_table_export.csv`);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error exporting table');
    }
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
        const records = parse(csvData, { 
          columns: (header: string[]) => header.map(h => h.trim()), 
          skip_empty_lines: true, 
          relax_column_count: true 
        });

        const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ data: records })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Server returned an unexpected response. The file may be too large or the server timed out. Try uploading fewer rows at a time.');
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        
        let messageText = `Successfully processed ${json.successCount} records${json.errors?.length ? ` (Skipped ${json.errors.length} rows with errors)` : ''}.`;
        let messageType: 'success' | 'error' = 'success';
        
        if (json.successCount === 0 && json.errors?.length > 0) {
          messageText = `No records were added or updated. All rows were skipped (older data or errors).`;
          messageType = 'error'; // Show red box since nothing was added
        } else if (json.successCount > 0 && json.errors?.length > 0) {
          messageText = `Added/Updated ${json.successCount} records. Skipped ${json.errors.length} rows containing older data or errors.`;
        }

        setMessage({ 
          type: messageType, 
          text: messageText,
          errors: json.errors || [],
          successes: json.details || []
        });
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

  const renderSection = (title: string, btnText: string, type: 'population' | 'livedata' | 'locations' | 'vaccine_ccp' | 'stock_receive' | 'stock_issue', apiEndpoint: string, colorClass: string) => {
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
          
          <button 
            onClick={() => handleDownloadTable(type)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download Table
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
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto h-full flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Super Admin CSV Upload</h1>
        <p className="text-slate-500 text-sm mt-1">Bulk upload population and live reporting data for blocks and cities.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex flex-col gap-2 text-sm font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
          <div className="flex items-center gap-2">
            {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {message.text}
          </div>
          {message.errors && message.errors.length > 0 && (
            <div className="mt-2 bg-white/60 p-3 rounded-lg border border-emerald-200/50 max-h-40 overflow-y-auto text-xs text-slate-700 font-mono space-y-1">
              {message.errors.map((err, idx) => (
                <div key={idx} className="text-rose-600 border-b border-rose-100/50 pb-1 last:border-0 last:pb-0">
                  • {err}
                </div>
              ))}
            </div>
          )}
          {message.successes && message.successes.length > 0 && (
            <div className="mt-2 bg-white/60 p-3 rounded-lg border border-emerald-200/50 max-h-40 overflow-y-auto text-xs text-slate-700 font-mono space-y-1">
              {message.successes.map((msg, idx) => (
                <div key={idx} className="text-emerald-700 border-b border-emerald-100/50 pb-1 last:border-0 last:pb-0">
                  ✓ {msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-sm font-semibold text-hpv-purple animate-pulse">Processing CSV upload...</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Population Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UsersIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Upload Population Data</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Population', 'Upload Population', 'population', '/api/superadmin/upload-population', 'border-indigo-100')}
          </div>
        </div>

        {/* Live Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ActivityIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">Upload Live Data</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Live Data', 'Upload Live Data', 'livedata', '/api/superadmin/upload-livedata', 'border-emerald-100')}
          </div>
        </div>

        {/* Locations Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPinIcon className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">Upload Locations (Master)</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Locations', 'Upload Locations', 'locations', '/api/superadmin/upload-locations', 'border-amber-100')}
          </div>
        </div>

        {/* Vaccine CCP Facilities Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <HospitalIcon className="w-5 h-5 text-pink-600" />
            <h2 className="text-base font-bold text-slate-800">Upload Health Facilities</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Vaccine CCP', 'Upload Facilities', 'vaccine_ccp', '/api/superadmin/upload-vaccine-ccp', 'border-pink-100')}
          </div>
        </div>

        {/* Stock Receive Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-teal-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <h2 className="text-base font-bold text-slate-800">Upload Stock Receive</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Stock Receive', 'Upload Stock Receive', 'stock_receive', '/api/superadmin/upload-stock-receive', 'border-teal-100')}
          </div>
        </div>

        {/* Stock Issue Data */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-purple-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <h2 className="text-base font-bold text-slate-800">Upload Stock Issue</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {renderSection('Stock Issue', 'Upload Stock Issue', 'stock_issue', '/api/superadmin/upload-stock-issue', 'border-purple-100')}
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
const MapPinIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
);
const HospitalIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);
