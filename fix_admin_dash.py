import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    code = f.read()

# 1. Fix fetchMasterLocations bug
bad_fetch = """    Promise.all([
      fetch('/api/locations/states').then(r => r.json()).then(data => setStates(data)),
      fetch('/api/locations/blocks').then(r => r.json()),
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
    ]).then(([blocks, states, districts]) => {
      setMasterBlocks(Array.isArray(blocks) ? blocks : []);
      setStatesList(Array.isArray(states) ? states : []);
      setAllDistrictsList(Array.isArray(districts) ? districts : []);
    })"""
good_fetch = """    Promise.all([
      fetch('/api/locations/blocks').then(r => r.json()),
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
    ]).then(([blocks, states, districts]) => {
      setMasterBlocks(Array.isArray(blocks) ? blocks : []);
      setStatesList(Array.isArray(states) ? states : []);
      setStates(Array.isArray(states) ? states : []);
      setAllDistrictsList(Array.isArray(districts) ? districts : []);
    })"""
code = code.replace(bad_fetch, good_fetch)

# 2. Fix Header
bad_header = """                  <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-1.5">
                    <span className="text-[#188E94]">Monitoring Dashboard:</span>
                    <span className="text-purple-900">Uttarakhand</span>
                  </h1>"""
good_header = """                  <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-1.5">
                    <span className="text-[#188E94]">Monitoring Dashboard:</span>
                    {adminUser?.role === 'SUPER_ADMIN' ? (
                      <select 
                        value={dashboardStateId} 
                        onChange={(e) => setDashboardStateId(e.target.value)}
                        className="text-purple-900 bg-transparent outline-none cursor-pointer border-b-2 border-transparent hover:border-purple-300 ml-1 pb-0.5 text-lg"
                      >
                        <option value="">All States</option>
                        {statesList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-purple-900 ml-1">{adminUser?.state_name || 'Assigned State'}</span>
                    )}
                  </h1>"""
code = code.replace(bad_header, good_header)

# 3. Fix Footer
bad_footer = """<span className="text-[11px] font-bold text-blue-600 block">a healthier Uttarakhand</span>"""
good_footer = """<span className="text-[11px] font-bold text-blue-600 block">a healthier {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name : 'India') : (adminUser?.state_name || 'State')}</span>"""
code = code.replace(bad_footer, good_footer)

# 4. Fix Reports State Filter
bad_reports_state_filter = """                      options={[{ id: '5', name: 'Uttarakhand' }]}
                      value={{ id: '5', name: 'Uttarakhand' }}"""
good_reports_state_filter = """                      options={adminUser?.role === 'SUPER_ADMIN' ? statesList.map(s => ({ id: String(s.id), name: s.name })) : (adminUser?.state_name ? [{ id: String(adminUser?.state_id), name: adminUser.state_name }] : [])}
                      value={dashboardStateId ? { id: dashboardStateId, name: statesList.find(s => String(s.id) === dashboardStateId)?.name || '' } : (adminUser?.state_name ? { id: String(adminUser?.state_id), name: adminUser.state_name } : null)}"""
code = code.replace(bad_reports_state_filter, good_reports_state_filter)

# 5. Fix Reports District Filter
bad_district_filter_opt = """options={districtsList.map(d => ({ id: String(d.id), name: `${d.name} (State: Uttarakhand)` }))}"""
good_district_filter_opt = """options={districtsList.map(d => ({ id: String(d.id), name: `${d.name} (State: ${statesList.find(s => s.id === d.state_id)?.name || 'Unknown'})` }))}"""
code = code.replace(bad_district_filter_opt, good_district_filter_opt)

bad_district_filter_val = """value={filterDistrictId === 'ALL' ? null : { id: filterDistrictId, name: districtsList.find(d => String(d.id) === filterDistrictId)?.name + ' (State: Uttarakhand)' || '' }}"""
good_district_filter_val = """value={filterDistrictId === 'ALL' ? null : { id: filterDistrictId, name: districtsList.find(d => String(d.id) === filterDistrictId) ? `${districtsList.find(d => String(d.id) === filterDistrictId)?.name} (State: ${statesList.find(s => s.id === districtsList.find(d => String(d.id) === filterDistrictId)?.state_id)?.name || 'Unknown'})` : '' }}"""
code = code.replace(bad_district_filter_val, good_district_filter_val)

# 6. Fix Reports Block Filter
bad_block_filter_opt = """options={masterBlocks.map(b => ({ id: String(b.id), name: `${b.name} (State: Uttarakhand, District: ${b.district_name})` }))}"""
good_block_filter_opt = """options={masterBlocks.map(b => ({ id: String(b.id), name: `${b.name} (State: ${b.state_name || statesList.find(s => s.id === allDistrictsList.find(d => d.id === b.district_id)?.state_id)?.name}, District: ${b.district_name})` }))}"""
code = code.replace(bad_block_filter_opt, good_block_filter_opt)

bad_block_filter_val = """value={filterBlockId === 'ALL' ? null : { id: filterBlockId, name: masterBlocks.find(b => String(b.id) === filterBlockId) ? `${masterBlocks.find(b => String(b.id) === filterBlockId)?.name} (State: Uttarakhand, District: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.district_name})` : '' }}"""
good_block_filter_val = """value={filterBlockId === 'ALL' ? null : { id: filterBlockId, name: masterBlocks.find(b => String(b.id) === filterBlockId) ? `${masterBlocks.find(b => String(b.id) === filterBlockId)?.name} (State: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.state_name || 'Unknown'}, District: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.district_name})` : '' }}"""
code = code.replace(bad_block_filter_val, good_block_filter_val)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(code)
