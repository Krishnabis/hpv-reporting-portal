import re

with open('src/components/AdminTrend.tsx', 'r') as f:
    content = f.read()

# Props definition
prop_def = """interface AdminTrendProps {
  statesList: any[];
  divisionsList: any[];
  districtsList: any[];
  blocksList: any[];
  filterLevel: 'State' | 'Division' | 'District' | 'Block';
  setFilterLevel: (level: 'State' | 'Division' | 'District' | 'Block') => void;
  filterStateId: string;
  setFilterStateId: (id: string) => void;
  filterDivisionId: string;
  setFilterDivisionId: (id: string) => void;
  filterDistrictId: string;
  setFilterDistrictId: (id: string) => void;"""

content = re.sub(r'interface AdminTrendProps \{.*?filterDistrictId: string;\n  setFilterDistrictId: \(id: string\) => void;', prop_def, content, flags=re.DOTALL)

# Prop extraction
prop_ext = """export const AdminTrend: React.FC<AdminTrendProps> = ({
  statesList, divisionsList, districtsList, blocksList,
  filterLevel, setFilterLevel,
  filterStateId, setFilterStateId,
  filterDivisionId, setFilterDivisionId,
  filterDistrictId, setFilterDistrictId,"""

content = re.sub(r'export const AdminTrend: React.FC<AdminTrendProps> = \(\{\n  statesList, districtsList, blocksList,\n  filterLevel, setFilterLevel,\n  filterStateId, setFilterStateId,\n  filterDistrictId, setFilterDistrictId,', prop_ext, content)


# Handle generate API params
handle_gen = """      const params = new URLSearchParams({
        level: filterLevel.toUpperCase(),
        divisionId: filterDivisionId,
        districtId: filterDistrictId,
        blockId: filterBlockId
      });"""
content = re.sub(r'      const params = new URLSearchParams\(\{\n        level: filterLevel\.toUpperCase\(\),\n        districtId: filterDistrictId,\n        blockId: filterBlockId\n      \}\);', handle_gen, content)


# Scope name calculation
scope_str = """      if (filterLevel === 'State') {
        const state = statesList.find(s => s.id.toString() === filterStateId);
        setScopeName(state ? state.name : 'State');
      } else if (filterLevel === 'Division') {
        if (filterDivisionId === 'ALL') setScopeName('All Divisions');
        else {
          const div = divisionsList.find(d => d.id.toString() === filterDivisionId);
          setScopeName(div ? div.name : 'Division');
        }
      } else if (filterLevel === 'District') {"""
content = re.sub(r'      if \(filterLevel === \'State\'\) \{\n        const state = statesList\.find\(s => s\.id\.toString\(\) === filterStateId\);\n        setScopeName\(state \? state\.name : \'State\'\);\n      \} else if \(filterLevel === \'District\'\) \{', scope_str, content)


# Area select options
area_options = """            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as any)} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none">
              <option value="State">State</option>
              <option value="Division">Division</option>
              <option value="District">District</option>
              <option value="Block">Block</option>
            </select>"""
content = re.sub(r'            <select value=\{filterLevel\}.*?>\n              <option value="State">State</option>\n              <option value="District">District</option>\n              <option value="Block">Block</option>\n            </select>', area_options, content)

# Division dropdown UI
div_ui = """          {filterLevel === 'Division' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Division</label>
              <SearchableSelect 
                label="Division"
                options={[{value: 'ALL', label: 'All Divisions'}, ...divisionsList.filter(d => String(d.state_id) === filterStateId).map(d => ({ value: d.id.toString(), label: d.name }))]} 
                value={filterDivisionId} 
                onChange={setFilterDivisionId} 
                placeholder="Select Division..." 
              />
            </div>
          )}

          {filterLevel === 'District' && ("""
content = re.sub(r'          \{filterLevel === \'District\' && \(', div_ui, content)


with open('src/components/AdminTrend.tsx', 'w') as f:
    f.write(content)

