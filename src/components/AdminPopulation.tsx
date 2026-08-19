import React, { useState, useEffect } from 'react';
import { Search, Unlock, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PopulationData {
  id: number;
  name: string;
  is_urban: boolean;
  district_name: string;
  state_name: string;
  profile: {
    id: string;
    base_population: number;
    is_unlocked?: boolean;
    unlock_requested?: boolean;
  } | null;
}

export const AdminPopulation: React.FC = () => {
  const [data, setData] = useState<PopulationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPopulationData = () => {
    fetch('/api/admin/population')
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
  }, []);

  const handleUnlock = (blockId: number) => {
    if (!window.confirm('Are you sure you want to unlock population editing for this location?')) return;
    
    fetch(`/api/blocks/${blockId}/unlock-population`, { method: 'POST' })
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading Population Data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Population Access Control</h2>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900 text-slate-100 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">State</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4">Block / Urban Body</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Population (Unlock Access)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-600">{row.state_name}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{row.district_name}</td>
                  <td className="px-6 py-4 font-bold text-hpv-purple">{row.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      row.is_urban ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {row.is_urban ? 'Urban' : 'Rural'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!row.profile ? (
                      <span className="text-slate-400 font-medium italic">Not Set</span>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-extrabold text-slate-900">
                          {row.profile.base_population.toLocaleString()}
                        </span>
                        
                        {row.profile.unlock_requested ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200">
                              <ShieldAlert className="w-3 h-3" />
                              Unlock Requested
                            </span>
                            <button
                              onClick={() => handleUnlock(row.id)}
                              className="px-3 py-1 bg-hpv-purple text-white text-xs font-bold rounded shadow-sm hover:bg-hpv-purple-dark transition-colors"
                            >
                              Unlock
                            </button>
                          </div>
                        ) : row.profile.is_unlocked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Unlocked
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUnlock(row.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 hover:text-hpv-purple hover:bg-hpv-purple-soft text-xs font-bold rounded border border-slate-200 transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Unlock
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No locations found matching your search.
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
