import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Add divisions to state
state_replace = """  const [allDistrictsList, setAllDistrictsList] = useState<any[]>([]);
  const [divisionsList, setDivisionsList] = useState<any[]>([]);"""
content = re.sub(r'  const \[allDistrictsList, setAllDistrictsList\] = useState<any\[\]>\(\[\]\);', state_replace, content)

# 2. Add filterDivisionId
filter_state = """  const [filterLevel, setFilterLevel] = useState<'STATE' | 'DIVISION' | 'DISTRICT' | 'BLOCK'>('DISTRICT');
  const [filterDivisionId, setFilterDivisionId] = useState('ALL');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');"""
content = re.sub(r'  const \[filterLevel, setFilterLevel\] = useState<\'STATE\' \| \'DISTRICT\' \| \'BLOCK\'>\(\'DISTRICT\'\);\n  const \[filterDistrictId, setFilterDistrictId\] = useState\(\'ALL\'\);', filter_state, content)

# 3. Update fetchMasterLocations to include divisions
fetch_locs = """  const fetchMasterLocations = () => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    Promise.all([
      fetch('/api/locations/blocks').then(r => r.json()),
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
      fetch('/api/locations/divisions').then(r => r.json()),
    ]).then(([blocks, states, districts, divisions]) => {
      setMasterBlocks(Array.isArray(blocks) ? blocks : []);
      setStatesList(Array.isArray(states) ? states : []);
      setStates(Array.isArray(states) ? states : []);
      setAllDistrictsList(Array.isArray(districts) ? districts : []);
      setDivisionsList(Array.isArray(divisions) ? divisions : []);
    }).catch(err => console.error(err));
  };"""
content = re.sub(r'  const fetchMasterLocations = \(\) => \{.*?\n  \};\n', fetch_locs + '\n', content, flags=re.DOTALL)


# 4. Update fetchReport to include filterDivisionId
fetch_rep = """  const fetchReport = () => {
    setLoadingReport(true);
    const params = new URLSearchParams({
      date: filterDate,
      level: filterLevel,
      divisionId: filterDivisionId,
      districtId: filterDistrictId,
      blockId: filterBlockId
    });"""
content = re.sub(r'  const fetchReport = \(\) => \{\n    setLoadingReport\(true\);\n    const params = new URLSearchParams\(\{\n      date: filterDate,\n      level: filterLevel,\n      districtId: filterDistrictId,\n      blockId: filterBlockId\n    \}\);', fetch_rep, content)


# 5. Update Reports Tab UI: Add 'Division' to levels
levels_arr = """                  {['State', 'Division', 'District', 'Block'].map(l => ("""
content = re.sub(r'                  \{\[\'State\', \'District\', \'Block\'\]\.map\(l => \(', levels_arr, content)


# 6. Update Reports Tab UI: Add Division select
div_select = """
              {/* Division Select (if Division, District, or Block level) */}
              {(filterLevel === 'DIVISION' || filterLevel === 'DISTRICT' || filterLevel === 'BLOCK') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Division</span>
                  <select
                    className="p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 min-w-[150px]"
                    value={filterDivisionId}
                    onChange={(e) => {
                      setFilterDivisionId(e.target.value);
                      setFilterDistrictId('ALL');
                      setFilterBlockId('ALL');
                    }}
                  >
                    <option value="ALL">All Divisions</option>
                    {divisionsList
                      .filter(d => d.state_id === (dashboardStateId || reqUser?.state_id))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* District Select (if District or Block level) */}
              {(filterLevel === 'DISTRICT' || filterLevel === 'BLOCK') && (
"""

content = re.sub(r'              \{\/\* District Select \(if District or Block level\) \*\/\}\n              \{\(filterLevel === \'DISTRICT\' \|\| filterLevel === \'BLOCK\'\) && \(', div_select, content)

# Update district filter to use division
dist_filter = """                    {allDistrictsList
                      .filter(d => String(d.state_id) === String(dashboardStateId || adminUser?.state_id))
                      .filter(d => filterDivisionId === 'ALL' || String(d.division_id) === String(filterDivisionId))
                      .map(d => ("""
content = re.sub(r'                    \{allDistrictsList\n                      \.filter\(d => String\(d\.state_id\) === String\(dashboardStateId \|\| adminUser\?\.state_id\)\)\n                      \.map\(d => \(', dist_filter, content)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(content)

