import re

with open('src/components/AdminTrend.tsx', 'r') as f:
    content = f.read()

div_opts_str = """          {filterLevel === 'Division' && (() => {
            const divOptions = [{id: 'ALL', name: 'All Divisions'}, ...divisionsList.filter(d => String(d.state_id) === filterStateId).map(d => ({ id: d.id.toString(), name: d.name }))];
            return (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Division</label>
                <SearchableSelect 
                  label="Division"
                  options={divOptions} 
                  value={divOptions.find(o => o.id === filterDivisionId) || null} 
                  onChange={(opt) => opt && setFilterDivisionId(opt.id.toString())} 
                  placeholder="Select Division..." 
                />
              </div>
            );
          })()}"""

content = re.sub(r'          \{filterLevel === \'Division\' && \(\n            <div className="flex flex-col gap-1">\n              <label className="text-\[10px\] font-bold uppercase tracking-wider text-slate-600">Division</label>\n              <SearchableSelect \n                label="Division"\n                options=\{.*?\n                value=\{filterDivisionId\} \n                onChange=\{setFilterDivisionId\} \n                placeholder="Select Division\.\.\." \n              />\n            </div>\n          \)\}', div_opts_str, content, flags=re.DOTALL)


with open('src/components/AdminTrend.tsx', 'w') as f:
    f.write(content)

