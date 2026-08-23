import React, { useState, useEffect } from 'react';
import { Search, Unlock, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PopulationData {
  id: number;
  name: string;
  is_urban: boolean;
  division_name: string;
  district_name: string;
  state_name: string;
  profile: {
    id: string;
    base_population: number;
    is_unlocked?: boolean;
    unlock_requested?: boolean;
  } | null;
}

export const AdminPopulation: React.FC<{ activeStateId?: string }> = ({ activeStateId }) => {
  const [data, setData] = useState<PopulationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPopulationData = () => {
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    const url = activeStateId ? `/api/admin/population?state_id=${activeStateId}` : '/api/admin/population';
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPopulationData();
  }, [activeStateId]);

  const handleUnlock = (blockId: number) => {
    if (!window.confirm('Are you sure you want to unlock population editing for this location?')) return;
    
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    fetch(`/api/blocks/${blockId}/unlock-population`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(json => {
        if (json.error) {
          alert(json.error);
        } else {
          fetchPopulationData();
        }
      })
      .catch(err => console.error(err));
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.district_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingRequests = data.filter(item => item.profile?.unlock_requested);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading Population Data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto h-full flex flex-col gap-4">
      {/* Top Heading & Search */}
      <div className="flex-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Alerts</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and unlock population entry access for all locations.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search block, urban body, district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20 shadow-sm"
          />
        </div>
      </div>

      {/* High Priority Approval Table */}
      <div className="flex-1 bg-rose-50 rounded-2xl shadow-sm border border-rose-200 overflow-hidden flex flex-col">
        <div className="px-6 py-3 border-b border-rose-200 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600 shadow-sm">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-rose-900 text-sm">High Priority Unlock Requests</h3>
            <p className="text-[10px] text-rose-700 mt-0.5">These locations have requested access to edit their population.</p>
          </div>
        </div>
        <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-rose-100 text-rose-900 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Block / Urban Body</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Population</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {pendingRequests.map((row) => (
                  <tr key={row.id} className="hover:bg-rose-100/50 transition-colors">
                    <td className="px-4 py-2 font-medium text-rose-800">{row.state_name}</td>
                    <td className="px-4 py-2 font-medium text-rose-800">{row.division_name || '—'}</td>
                    <td className="px-4 py-2 font-bold text-rose-900">{row.district_name}</td>
                    <td className="px-4 py-2 font-bold text-hpv-purple">{row.name}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.is_urban ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {row.is_urban ? 'Urban' : 'Rural'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="font-mono font-extrabold text-rose-900">
                        {row.profile!.base_population.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleUnlock(row.id)}
                          className="px-3 py-1 bg-hpv-purple text-white text-[10px] font-bold rounded shadow hover:bg-hpv-purple-dark hover:scale-105 active:scale-95 transition-all"
                        >
                          Unlock Editing
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {pendingRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-rose-400 text-xs font-medium">
                      No pending unlock requests at this time.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
};
