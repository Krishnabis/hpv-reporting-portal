import React, { useState, useEffect } from 'react';
import { SearchIcon, MapPinIcon, Edit2Icon, SaveIcon, XIcon, PlusIcon } from 'lucide-react';

export const LocationMaster = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Dropdown data
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  
  // Create mode
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'country'|'state'|'division'|'district'|'block'>('block');
  const [createForm, setCreateForm] = useState<any>({});
  const [createMsg, setCreateMsg] = useState('');

  const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');

  const fetchDropdowns = async () => {
    try {
      const [cRes, sRes, rRes, dRes] = await Promise.all([
        fetch('/api/locations/countries', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/locations/states', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/locations/divisions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/locations/districts', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCountries(await cRes.json());
      setStates(await sRes.json());
      setDivisions(await rRes.json());
      setDistricts(await dRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/locations-master-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDropdowns();
    fetchLocations();
  }, []);

  const handleEdit = (loc: any) => {
    setEditRowId(loc.id);
    setEditForm({
      population: loc.population,
      linelisted: loc.linelisted,
      vaccinated: loc.vaccinated,
      name: loc.name,
      district_id: loc.district_id,
      reporting_date: new Date().toISOString().split('T')[0] // Default to today for editing stats
    });
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`/api/locations/block/${editRowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editForm.name,
          district_id: editForm.district_id,
          base_population: editForm.population ? parseInt(editForm.population) : undefined,
          linelisted: editForm.linelisted ? parseInt(editForm.linelisted) : undefined,
          vaccinated: editForm.vaccinated ? parseInt(editForm.vaccinated) : undefined,
          reporting_date: editForm.reporting_date
        })
      });
      if (res.ok) {
        setEditRowId(null);
        fetchLocations();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      console.error(e);
      alert('Save failed');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg('Saving...');
    try {
      let body: any = { name: createForm.name, lgd_code: createForm.lgd_code };
      if (createType === 'state') body.country_id = createForm.country_id;
      if (createType === 'division') body.state_id = createForm.state_id;
      if (createType === 'district') { body.division_id = createForm.division_id; body.state_id = createForm.state_id; }
      if (createType === 'block') { body.district_id = createForm.district_id; body.is_urban = createForm.is_urban; }

      const res = await fetch(`/api/locations/${createType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setCreateMsg('✅ Created successfully');
        setCreateForm({});
        fetchDropdowns();
        fetchLocations();
        setTimeout(() => setIsCreating(false), 1500);
      } else {
        const err = await res.json();
        setCreateMsg('❌ ' + err.error);
      }
    } catch (e) {
      setCreateMsg('❌ Error saving');
    }
  };

  const filtered = locations.filter(loc => 
    !search || 
    loc.name?.toLowerCase().includes(search.toLowerCase()) || 
    loc.district_name?.toLowerCase().includes(search.toLowerCase()) ||
    loc.state_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 flex-1 min-h-0 flex flex-col pb-4 h-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Master Location Registry</h1>
          <p className="text-xs text-slate-500 mt-1">Manage all divisions, populations, and manual stats overrides.</p>
        </div>
        <button onClick={() => setIsCreating(!isCreating)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700">
          {isCreating ? <XIcon className="w-4 h-4"/> : <PlusIcon className="w-4 h-4"/>} 
          {isCreating ? 'Close' : 'Add New Location'}
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['country', 'state', 'division', 'district', 'block'] as const).map(t => (
              <button key={t} onClick={() => { setCreateType(t); setCreateMsg(''); setCreateForm({}); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${createType === t ? 'bg-hpv-purple text-white' : 'bg-slate-100 text-slate-600'}`}>
                {t}
              </button>
            ))}
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {(createType === 'state' || createType === 'division' || createType === 'district' || createType === 'block') && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Country</label>
                <select required onChange={e => setCreateForm({...createForm, country_id: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50">
                  <option value="">Select...</option>
                  {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {(createType === 'division' || createType === 'district' || createType === 'block') && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">State</label>
                <select required onChange={e => setCreateForm({...createForm, state_id: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50">
                  <option value="">Select...</option>
                  {states.filter(s => !createForm.country_id || String(s.country_id) === String(createForm.country_id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {(createType === 'district' || createType === 'block') && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Division</label>
                <select required onChange={e => setCreateForm({...createForm, division_id: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50">
                  <option value="">Select...</option>
                  {divisions.filter(r => !createForm.state_id || String(r.state_id) === String(createForm.state_id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            {createType === 'block' && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">District</label>
                <select required onChange={e => setCreateForm({...createForm, district_id: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50">
                  <option value="">Select...</option>
                  {districts.filter(d => (!createForm.division_id || String(d.division_id) === String(createForm.division_id)) && (!createForm.state_id || String(d.state_id) === String(createForm.state_id))).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Name</label>
              <input required type="text" onChange={e => setCreateForm({...createForm, name: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">LGD Code</label>
              <input required type="text" onChange={e => setCreateForm({...createForm, lgd_code: e.target.value})} className="p-2 border rounded-lg text-xs font-semibold bg-slate-50"/>
            </div>
            
            {createType === 'block' && (
              <div className="flex items-center gap-2 h-[34px]">
                <input type="checkbox" id="isUrban" onChange={e => setCreateForm({...createForm, is_urban: e.target.checked})} className="w-4 h-4"/>
                <label htmlFor="isUrban" className="text-xs font-bold text-slate-700">Is Urban Body?</label>
              </div>
            )}

            <button type="submit" className="h-[34px] bg-hpv-purple text-white font-bold text-xs rounded-lg hover:bg-hpv-purple-dark transition-colors">
              Save Location
            </button>
          </form>
          {createMsg && <p className="text-xs font-bold text-emerald-600 mt-2">{createMsg}</p>}
        </div>
      )}

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 shrink-0">
        <SearchIcon className="w-5 h-5 text-slate-400 ml-1" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any location..." className="w-full bg-transparent text-sm text-slate-900 focus:outline-none" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1 relative">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-semibold animate-pulse">Loading Locations...</div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-semibold uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3">Location Hierarchy</th>
                  <th className="px-3 py-3 text-right">Population</th>
                  <th className="px-3 py-3 text-right">Line Listed</th>
                  <th className="px-3 py-3 text-right">Vaccinated</th>
                  <th className="px-3 py-3 text-center">Reports</th>
                  <th className="px-3 py-3">Last Report</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(loc => {
                  const isEditing = editRowId === loc.id;
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-hpv-teal-dark text-sm">{isEditing ? <input className="border p-1 rounded" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /> : loc.name}</span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {loc.district_name} • {loc.division_name || 'No Division'} • {loc.state_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-700">
                        {isEditing ? <input type="number" className="border p-1 w-20 text-right rounded" value={editForm.population} onChange={e => setEditForm({...editForm, population: e.target.value})} /> : loc.population?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-amber-600">
                        {isEditing ? <input type="number" className="border p-1 w-20 text-right rounded" value={editForm.linelisted} onChange={e => setEditForm({...editForm, linelisted: e.target.value})} /> : loc.linelisted?.toLocaleString() || '0'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600">
                        {isEditing ? <input type="number" className="border p-1 w-20 text-right rounded" value={editForm.vaccinated} onChange={e => setEditForm({...editForm, vaccinated: e.target.value})} /> : loc.vaccinated?.toLocaleString() || '0'}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-500">
                        {loc.reports_count}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {isEditing ? <input type="date" className="border p-1 rounded" value={editForm.reporting_date} onChange={e => setEditForm({...editForm, reporting_date: e.target.value})} /> : loc.last_reported_date}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 rounded"><SaveIcon className="w-4 h-4"/></button>
                            <button onClick={() => setEditRowId(null)} className="text-rose-600 hover:text-rose-700 p-1 bg-rose-50 rounded"><XIcon className="w-4 h-4"/></button>
                          </div>
                        ) : (
                          <button onClick={() => handleEdit(loc)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            <Edit2Icon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
